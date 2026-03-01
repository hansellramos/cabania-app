/**
 * Baileys Message Handler (Microservice version)
 *
 * Calls the main app's chat API via MAIN_APP_URL instead of localhost.
 */

const { downloadMediaMessage } = require('baileys');
const { prisma } = require('../db');
const config = require('../config');

/**
 * Handle an incoming WhatsApp message from Baileys.
 */
async function handleMessage(venueId, socket, message) {
  try {
    const msg = message;
    const remoteJid = msg.key?.remoteJid;

    if (!remoteJid) return;
    if (remoteJid === 'status@broadcast') return;
    if (remoteJid.endsWith('@g.us')) return;
    if (msg.key?.fromMe) return;

    // Handle image messages
    let mediaUrl = null;
    let mediaType = null;
    if (msg.message?.imageMessage) {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        // Upload to main app
        const uploadUrl = `${config.MAIN_APP_URL}/api/uploads/chat-media`;
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');

        const uploadHeaders = {};
        if (config.MAIN_APP_INTERNAL_KEY) {
          uploadHeaders['X-Internal-Key'] = config.MAIN_APP_INTERNAL_KEY;
        }

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mediaUrl = uploadData.url;
          mediaType = 'image';
          console.log(`[baileys] Image uploaded for venue ${venueId}: ${mediaUrl}`);
        } else {
          console.error('[baileys] Failed to upload image:', await uploadRes.text());
        }
      } catch (imgErr) {
        console.error('[baileys] Error downloading/uploading image:', imgErr.message);
      }
    }

    const messageText = extractText(msg.message);
    if (!messageText && !mediaUrl) return;

    const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
    const pushName = msg.pushName || null;

    // Check excluded phones
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

    // Find existing conversation
    let conversation = await prisma.chat_conversations.findFirst({
      where: {
        venue_id: venueId,
        phone: senderPhone,
        source: 'baileys'
      },
      orderBy: { created_at: 'desc' }
    });

    if (conversation?.status === 'human_attention') {
      console.log(`[baileys] Conv ${conversation.id} in human_attention, skipping auto-response`);
      return;
    }

    let conversationId = conversation?.id || null;

    // Call the main app's chat API via HTTP
    const chatUrl = `${config.MAIN_APP_URL}/api/chat/${venueId}`;
    const body = {
      message: messageText || (mediaUrl ? '[Imagen]' : ''),
      source: 'baileys',
      visitor_phone: senderPhone,
      visitor_name: pushName,
      conversation_id: conversationId,
      media_url: mediaUrl || undefined,
      media_type: mediaType || undefined
    };

    const headers = { 'Content-Type': 'application/json' };
    if (config.MAIN_APP_INTERNAL_KEY) {
      headers['X-Internal-Key'] = config.MAIN_APP_INTERNAL_KEY;
    }

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[baileys] Chat API error for venue ${venueId}:`, response.status, errText);
      return;
    }

    const data = await response.json();
    const replyText = data.response || data.message;
    const assistantMessageId = data.assistant_message_id;

    if (!replyText) {
      console.warn(`[baileys] No response text from chat API for venue ${venueId}`);
      return;
    }

    try {
      const sentMsg = await socket.sendMessage(remoteJid, { text: replyText });
      console.log(`[baileys] Replied to ${senderPhone} for venue ${venueId}`);

      // Report 'sent' status + external_id to main app
      if (assistantMessageId && config.MAIN_APP_INTERNAL_KEY) {
        updateMessageStatus(assistantMessageId, 'sent', sentMsg?.key?.id).catch(err =>
          console.error('[baileys] Failed to report sent status:', err.message)
        );
        logEvent(venueId, 'message_sent', null, senderPhone).catch(() => {});
      }
    } catch (sendErr) {
      console.error(`[baileys] Failed to send message for venue ${venueId}:`, sendErr.message);
      // Report 'failed' status
      if (assistantMessageId && config.MAIN_APP_INTERNAL_KEY) {
        updateMessageStatus(assistantMessageId, 'failed', null, sendErr.message).catch(err =>
          console.error('[baileys] Failed to report failed status:', err.message)
        );
        logEvent(venueId, 'message_failed', sendErr.message, senderPhone).catch(() => {});
      }
    }

    // Log incoming message event
    logEvent(venueId, 'message_received', null, senderPhone).catch(() => {});
  } catch (err) {
    console.error('[baileys] Error handling message:', err);
  }
}

function extractText(message) {
  if (!message) return null;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  return null;
}

/**
 * Update message delivery status on the main app.
 */
async function updateMessageStatus(messageId, status, externalId, errorDetails) {
  const url = `${config.MAIN_APP_URL}/api/chat/messages/${messageId}/status`;
  const body = { status };
  if (externalId) body.external_id = externalId;
  if (errorDetails) body.error_details = errorDetails;

  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': config.MAIN_APP_INTERNAL_KEY
    },
    body: JSON.stringify(body)
  });
}

/**
 * Log a WhatsApp event to the main app.
 */
async function logEvent(venueId, eventType, details, phone, messageId) {
  const url = `${config.MAIN_APP_URL}/api/whatsapp/events`;
  const body = {
    venue_id: venueId,
    event_type: eventType,
    details: details || undefined,
    phone: phone || undefined,
    message_id: messageId || undefined
  };

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': config.MAIN_APP_INTERNAL_KEY
    },
    body: JSON.stringify(body)
  });
}

module.exports = { handleMessage, extractText, updateMessageStatus, logEvent };
