/**
 * System Baileys Message Handler (Microservice version)
 *
 * Handles incoming messages to the system WhatsApp number.
 * Processes resume commands from venue owners.
 */

const { prisma } = require('../db');
const logger = require('../logger');

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

async function handleSystemMessage(socket, message) {
  try {
    const msg = message;
    const remoteJid = msg.key?.remoteJid;

    if (!remoteJid) return;
    if (remoteJid === 'status@broadcast') return;
    if (remoteJid.endsWith('@g.us')) return;
    if (msg.key?.fromMe) return;

    const messageText = extractSystemText(msg.message);
    if (!messageText) return;

    const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
    logger.info(`[baileys-system] Message from ${senderPhone}: ${(messageText || '').substring(0, 80)}`, { phone: senderPhone });

    const isResumeCommand = RESUME_PATTERNS.some(p => p.test(messageText));
    if (!isResumeCommand) return;

    // Find venues for this phone
    const matchingConnections = await prisma.whatsapp_connections.findMany({
      where: { notification_phone: senderPhone }
    });
    const venueIdsFromNotif = matchingConnections.map(c => c.venue_id);

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
      logger.info(`[baileys-system] No venues found for phone ${senderPhone}`, { phone: senderPhone });
      return;
    }

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
          logger.warn(`[baileys-system] Failed to send greeting to ${conv.phone}: ${err.message}`, { phone: conv.phone, error: err.message });
        }
      }
    }

    await socket.sendMessage(remoteJid, {
      text: `✅ Listo, CabanIA retomó ${escalatedConversations.length} conversación(es) de ${venueNames || 'tus venues'}. ${resumedCount > 0 ? `Se notificó a ${resumedCount} cliente(s).` : ''}`
    });

    logger.info(`[baileys-system] Resumed ${escalatedConversations.length} conversations for venues: ${allVenueIds.join(', ')}`, { venueIds: allVenueIds });
  } catch (err) {
    logger.error(`[baileys-system] Error handling system message: ${err.message}`, { error: err.message, stack: err.stack });
  }
}

function extractSystemText(message) {
  if (!message) return null;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  return null;
}

module.exports = { handleSystemMessage };
