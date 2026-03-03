/**
 * Baileys Message Handler (Microservice version)
 *
 * Calls the main app's chat API via MAIN_APP_URL instead of localhost.
 */

const { downloadMediaMessage } = require('baileys');
const Sentry = require('@sentry/node');
const { prisma } = require('../db');
const config = require('../config');
const logger = require('../logger');

/**
 * Handle an incoming WhatsApp message from Baileys.
 */
async function handleMessage(venueId, socket, message) {
  const startTime = Date.now();
  let senderPhone = '?';
  let step = 'init';

  try {
    const msg = message;
    const remoteJid = msg.key?.remoteJid;

    if (!remoteJid) return;
    if (remoteJid === 'status@broadcast') return;
    if (remoteJid.endsWith('@g.us')) return;
    if (msg.key?.fromMe) return;

    senderPhone = remoteJid.replace('@s.whatsapp.net', '');
    const pushName = msg.pushName || null;
    const msgType = msg.message?.imageMessage ? 'image'
      : msg.message?.videoMessage ? 'video'
      : msg.message?.documentMessage ? 'document'
      : msg.message?.stickerMessage ? 'sticker'
      : msg.message?.audioMessage ? 'audio'
      : 'text';

    step = 'received';
    logger.info(`[msg:${step}] ${senderPhone} → venue ${venueId} (${msgType})`, { venueId, phone: senderPhone, pushName, msgType, step });

    // Handle image messages
    let mediaUrl = null;
    let mediaType = null;
    if (msg.message?.imageMessage) {
      step = 'media_download';
      logger.info(`[msg:${step}] Downloading image...`, { venueId, phone: senderPhone, step });
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        step = 'media_upload';
        logger.info(`[msg:${step}] Uploading image (${buffer.length} bytes)...`, { venueId, phone: senderPhone, step, bytes: buffer.length });

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
          logger.info(`[msg:media_uploaded] ${mediaUrl}`, { venueId, phone: senderPhone, step: 'media_uploaded', mediaUrl });
        } else {
          const errText = await uploadRes.text();
          logger.error(`[msg:media_upload_failed] ${uploadRes.status}: ${errText}`, { venueId, phone: senderPhone, step: 'media_upload_failed', status: uploadRes.status });
        }
      } catch (imgErr) {
        logger.error(`[msg:media_error] ${imgErr.message}`, { venueId, phone: senderPhone, step: 'media_error', error: imgErr.message });
      }
    }

    const messageText = extractText(msg.message);
    if (!messageText && !mediaUrl) {
      logger.info(`[msg:skipped] No text or media to process`, { venueId, phone: senderPhone, step: 'skipped', msgType });
      return;
    }

    // Check excluded phones
    step = 'check_excluded';
    const connection = await prisma.whatsapp_connections.findUnique({
      where: { venue_id: venueId },
      select: { excluded_phones: true }
    });
    const excludedPhones = Array.isArray(connection?.excluded_phones) ? connection.excluded_phones : [];
    const isExcluded = excludedPhones.some(e => senderPhone.endsWith(e.phone) || e.phone.endsWith(senderPhone));
    if (isExcluded) {
      logger.info(`[msg:excluded] ${senderPhone} is excluded`, { venueId, phone: senderPhone, step: 'excluded' });
      return;
    }

    // Find existing conversation
    step = 'find_conversation';
    let conversation = await prisma.chat_conversations.findFirst({
      where: {
        venue_id: venueId,
        phone: senderPhone,
        source: 'baileys'
      },
      orderBy: { created_at: 'desc' }
    });

    if (conversation?.status === 'human_attention') {
      logger.info(`[msg:human_attention] Conv ${conversation.id} escalated, skipping`, { venueId, phone: senderPhone, step: 'human_attention', conversationId: conversation.id });
      return;
    }

    let conversationId = conversation?.id || null;
    logger.info(`[msg:conversation] ${conversationId ? `Existing conv ${conversationId}` : 'New conversation'}`, { venueId, phone: senderPhone, step: 'conversation', conversationId });

    // Call the main app's chat API
    step = 'call_chat_api';
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

    logger.info(`[msg:${step}] POST ${chatUrl}`, { venueId, phone: senderPhone, step, messagePreview: (messageText || '[media]').substring(0, 50) });

    const apiStart = Date.now();
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const apiMs = Date.now() - apiStart;

    if (!response.ok) {
      step = 'chat_api_error';
      const errText = await response.text();
      logger.error(`[msg:${step}] ${response.status} in ${apiMs}ms: ${errText.substring(0, 200)}`, { venueId, phone: senderPhone, step, status: response.status, apiMs });
      return;
    }

    step = 'parse_response';
    const data = await response.json();
    const replyText = data.response || data.message;
    const assistantMessageId = data.assistant_message_id;
    const tokensUsed = data.usage || null;

    logger.info(`[msg:ai_response] AI responded in ${apiMs}ms (${replyText ? replyText.length : 0} chars)`, {
      venueId, phone: senderPhone, step: 'ai_response', apiMs,
      replyLength: replyText?.length || 0,
      assistantMessageId,
      conversationId: data.conversation_id || conversationId,
      tokensUsed,
    });

    if (!replyText) {
      logger.warn(`[msg:no_reply] Chat API returned no response text`, { venueId, phone: senderPhone, step: 'no_reply' });
      return;
    }

    // Send WhatsApp reply
    step = 'send_whatsapp';
    try {
      const sentMsg = await socket.sendMessage(remoteJid, { text: replyText });
      step = 'sent';
      const totalMs = Date.now() - startTime;
      logger.info(`[msg:${step}] Reply sent to ${senderPhone} (total: ${totalMs}ms, AI: ${apiMs}ms)`, {
        venueId, phone: senderPhone, step, totalMs, apiMs,
        externalId: sentMsg?.key?.id,
      });

      // Report 'sent' status
      if (assistantMessageId && config.MAIN_APP_INTERNAL_KEY) {
        step = 'report_status';
        updateMessageStatus(assistantMessageId, 'sent', sentMsg?.key?.id).catch(err =>
          logger.warn(`[msg:status_report_failed] ${err.message}`, { venueId, phone: senderPhone, step: 'status_report_failed' })
        );
        logEvent(venueId, 'message_sent', null, senderPhone).catch(err =>
          logger.warn(`[msg:event_log_failed] ${err.message}`, { venueId })
        );
      }
    } catch (sendErr) {
      step = 'send_failed';
      logger.error(`[msg:${step}] ${sendErr.message}`, { venueId, phone: senderPhone, step, error: sendErr.message });
      Sentry.captureException(sendErr);
      if (assistantMessageId && config.MAIN_APP_INTERNAL_KEY) {
        updateMessageStatus(assistantMessageId, 'failed', null, sendErr.message).catch(err =>
          logger.warn(`[msg:status_report_failed] ${err.message}`, { venueId, phone: senderPhone })
        );
        logEvent(venueId, 'message_failed', sendErr.message, senderPhone).catch(err =>
          logger.warn(`[msg:event_log_failed] ${err.message}`, { venueId })
        );
      }
    }

    // Log incoming message event
    logEvent(venueId, 'message_received', null, senderPhone).catch(err =>
      logger.warn(`[msg:event_log_failed] ${err.message}`, { venueId })
    );
  } catch (err) {
    const totalMs = Date.now() - startTime;
    logger.error(`[msg:CRASH] at step="${step}" after ${totalMs}ms: ${err.message}`, {
      venueId, phone: senderPhone, step, totalMs,
      error: err.message, stack: err.stack,
    });
    Sentry.captureException(err);
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
