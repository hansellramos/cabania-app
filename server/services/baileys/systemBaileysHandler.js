/**
 * System Baileys Message Handler
 *
 * Handles incoming messages to the system WhatsApp number.
 * Primarily processes resume commands from venue owners.
 */

const { prisma } = require('../../db');

// Patterns that indicate the owner wants to resume CabanIA
const RESUME_PATTERNS = [
  /ya puedes seguir/i,
  /activa el bot/i,
  /activa cabania/i,
  /reactiva/i,
  /reanuda/i,
  /resume/i,
  /vuelve a responder/i,
  /enciende el bot/i,
  /bot on/i
];

/**
 * Handle an incoming message to the system WhatsApp.
 */
async function handleSystemMessage(socket, message) {
  try {
    const msg = message;
    const remoteJid = msg.key?.remoteJid;

    // Ignore group messages, status broadcasts, own messages
    if (!remoteJid) return;
    if (remoteJid === 'status@broadcast') return;
    if (remoteJid.endsWith('@g.us')) return;
    if (msg.key?.fromMe) return;

    const messageText = extractSystemText(msg.message);
    if (!messageText) return;

    const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
    console.log(`[baileys-system] Message from ${senderPhone}: ${messageText.substring(0, 80)}`);

    // Check if this is a resume command
    const isResumeCommand = RESUME_PATTERNS.some(p => p.test(messageText));
    if (!isResumeCommand) {
      // Not a recognized command — ignore or send help
      return;
    }

    // Find which venue(s) this phone number is the owner of
    // Check notification_phone in whatsapp_connections first, then venue.whatsapp
    const matchingConnections = await prisma.whatsapp_connections.findMany({
      where: { notification_phone: senderPhone }
    });

    const venueIdsFromNotif = matchingConnections.map(c => c.venue_id);

    // Also check venues where whatsapp matches sender phone
    const matchingVenues = await prisma.venues.findMany({
      where: {
        whatsapp: { equals: parseInt(senderPhone) || 0 }
      },
      select: { id: true, name: true }
    });

    const allVenueIds = [...new Set([
      ...venueIdsFromNotif,
      ...matchingVenues.map(v => v.id)
    ])];

    if (allVenueIds.length === 0) {
      console.log(`[baileys-system] No venues found for phone ${senderPhone}`);
      return;
    }

    // Find escalated conversations for these venues
    const escalatedConversations = await prisma.chat_conversations.findMany({
      where: {
        venue_id: { in: allVenueIds },
        status: 'human_attention'
      }
    });

    if (escalatedConversations.length === 0) {
      await socket.sendMessage(remoteJid, {
        text: '✅ No hay conversaciones escaladas actualmente. CabanIA ya está respondiendo normalmente.'
      });
      return;
    }

    // Resume all escalated conversations
    await prisma.chat_conversations.updateMany({
      where: {
        venue_id: { in: allVenueIds },
        status: 'human_attention'
      },
      data: {
        status: 'active',
        escalated_at: null,
        escalated_reason: null,
        resume_at: null,
        updated_at: new Date()
      }
    });

    // Get venue names for confirmation
    const venues = await prisma.venues.findMany({
      where: { id: { in: allVenueIds } },
      select: { id: true, name: true }
    });
    const venueNames = venues.map(v => v.name).filter(Boolean).join(', ');

    // Send greeting to each resumed client via their venue's Baileys connection
    let baileysService;
    try {
      baileysService = require('./baileysService');
    } catch (_) {}

    let resumedCount = 0;
    for (const conv of escalatedConversations) {
      if (conv.phone && conv.source === 'baileys' && baileysService) {
        try {
          await baileysService.sendMessage(
            conv.venue_id,
            conv.phone,
            '¡Hola! 👋 CabanIA está disponible nuevamente para ayudarte. ¿En qué puedo asistirte?'
          );
          resumedCount++;
        } catch (err) {
          console.error(`[baileys-system] Failed to send greeting to ${conv.phone}:`, err.message);
        }
      }
    }

    // Confirm to the owner
    await socket.sendMessage(remoteJid, {
      text: `✅ Listo, CabanIA retomó ${escalatedConversations.length} conversación(es) de ${venueNames || 'tus venues'}. ${resumedCount > 0 ? `Se notificó a ${resumedCount} cliente(s).` : ''}`
    });

    console.log(`[baileys-system] Resumed ${escalatedConversations.length} conversations for venues: ${allVenueIds.join(', ')}`);
  } catch (err) {
    console.error('[baileys-system] Error handling system message:', err);
  }
}

/**
 * Extract text from Baileys message.
 */
function extractSystemText(message) {
  if (!message) return null;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  return null;
}

module.exports = { handleSystemMessage };
