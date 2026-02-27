/**
 * Baileys Message Handler
 *
 * Receives incoming WhatsApp messages, calls the chat API internally,
 * and sends the AI response back via Baileys.
 */

const { prisma } = require('../../db');

const PORT = process.env.PORT || 3000;

/**
 * Handle an incoming WhatsApp message from Baileys.
 * @param {string} venueId - The venue this socket belongs to
 * @param {object} socket - The Baileys WASocket
 * @param {object} message - The raw Baileys message object
 */
async function handleMessage(venueId, socket, message) {
  try {
    const msg = message;
    const remoteJid = msg.key?.remoteJid;

    // Ignore: group messages, status broadcasts, own messages
    if (!remoteJid) return;
    if (remoteJid === 'status@broadcast') return;
    if (remoteJid.endsWith('@g.us')) return;
    if (msg.key?.fromMe) return;

    // Extract message text
    const messageText = extractText(msg.message);
    if (!messageText) return;

    // Extract sender info
    const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
    const pushName = msg.pushName || null;

    // Check if sender is in the excluded phones list
    const connection = await prisma.whatsapp_connections.findUnique({
      where: { venue_id: venueId },
      select: { excluded_phones: true }
    });
    const excludedPhones = Array.isArray(connection?.excluded_phones) ? connection.excluded_phones : [];
    const isExcluded = excludedPhones.some(e => senderPhone.endsWith(e.phone) || e.phone.endsWith(senderPhone));
    if (isExcluded) {
      console.log(`[baileys] Ignored message from excluded phone ${senderPhone} for venue ${venueId}`);
      return;
    }

    console.log(`[baileys] Message from ${senderPhone} for venue ${venueId}: ${messageText.substring(0, 50)}...`);

    // Find or create conversation for this phone + venue
    let conversation = await prisma.chat_conversations.findFirst({
      where: {
        venue_id: venueId,
        phone: senderPhone,
        source: 'baileys'
      },
      orderBy: { created_at: 'desc' }
    });

    // Skip auto-response if conversation is in human_attention mode
    if (conversation?.status === 'human_attention') {
      console.log(`[baileys] Conv ${conversation.id} in human_attention, skipping auto-response`);
      return;
    }

    let conversationId = conversation?.id || null;

    // Call the chat API internally
    const chatUrl = `http://localhost:${PORT}/api/chat/${venueId}`;
    const body = {
      message: messageText,
      source: 'baileys',
      visitor_phone: senderPhone,
      visitor_name: pushName,
      conversation_id: conversationId
    };

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[baileys] Chat API error for venue ${venueId}:`, response.status, errText);
      return;
    }

    const data = await response.json();
    const replyText = data.response || data.message;

    if (!replyText) {
      console.warn(`[baileys] No response text from chat API for venue ${venueId}`);
      return;
    }

    // Send response back via WhatsApp
    await socket.sendMessage(remoteJid, { text: replyText });
    console.log(`[baileys] Replied to ${senderPhone} for venue ${venueId}`);
  } catch (err) {
    console.error('[baileys] Error handling message:', err);
  }
}

/**
 * Extract text content from various Baileys message types.
 */
function extractText(message) {
  if (!message) return null;
  // Standard text message
  if (message.conversation) return message.conversation;
  // Extended text (reply, link preview, etc.)
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  // Image/video with caption
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  // Document with caption
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  return null;
}

module.exports = { handleMessage, extractText };
