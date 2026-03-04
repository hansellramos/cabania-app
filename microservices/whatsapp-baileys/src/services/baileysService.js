/**
 * Baileys WhatsApp Service (Microservice version)
 *
 * Manages WhatsApp Web connections per venue using Baileys library.
 * Always available (no Vercel check needed).
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const Sentry = require('@sentry/node');
const { prisma } = require('../db');
const { useDBAuthState } = require('../stores/baileysStore');
const { handleMessage, logEvent } = require('./baileysHandler');
const logger = require('../logger');
const metrics = require('../metrics');

const connections = new Map();
const retryCounts = new Map();
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

async function connectVenue(venueId) {
  if (connections.has(venueId)) {
    await disconnectVenue(venueId, false);
  }

  let dbConn = await prisma.whatsapp_connections.findUnique({
    where: { venue_id: venueId }
  });
  if (!dbConn) {
    dbConn = await prisma.whatsapp_connections.create({
      data: { venue_id: venueId, status: 'qr_pending' }
    });
  } else {
    await prisma.whatsapp_connections.update({
      where: { venue_id: venueId },
      data: { status: 'qr_pending', qr_code: null, updated_at: new Date() }
    });
  }

  const { state, saveCreds } = await useDBAuthState(prisma, venueId);

  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    defaultQueryTimeoutMs: 60000,
    browser: ['CabanIA', 'Chrome', '22.0'],
  });

  connections.set(venueId, { socket, venueId, phoneNumber: dbConn.phone_number });
  retryCounts.set(venueId, 0);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info(`[baileys] QR code generated for venue ${venueId}`, { venueId });
      await prisma.whatsapp_connections.update({
        where: { venue_id: venueId },
        data: { qr_code: qr, status: 'qr_pending', updated_at: new Date() }
      });
      logEvent(venueId, 'qr_generated').catch(err =>
        logger.warn(`[baileys] Failed to log qr_generated event: ${err.message}`, { venueId })
      );
    }

    if (connection === 'open') {
      logger.info(`[baileys] Connected for venue ${venueId}`, { venueId });
      const meId = socket.user?.id;
      const phoneNumber = meId ? meId.split(':')[0].split('@')[0] : null;

      await prisma.whatsapp_connections.update({
        where: { venue_id: venueId },
        data: {
          status: 'connected',
          phone_number: phoneNumber,
          qr_code: null,
          last_connected: new Date(),
          updated_at: new Date()
        }
      });

      const entry = connections.get(venueId);
      if (entry) entry.phoneNumber = phoneNumber;
      retryCounts.set(venueId, 0);
      logEvent(venueId, 'connected', null, phoneNumber).catch(err =>
        logger.warn(`[baileys] Failed to log connected event: ${err.message}`, { venueId })
      );
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      metrics.recordConnectionDrop();
      logger.info(`[baileys] Connection closed for venue ${venueId}, code: ${statusCode}, reconnect: ${shouldReconnect}`, { venueId, statusCode });
      logEvent(venueId, 'disconnected', JSON.stringify({ statusCode, reason: lastDisconnect?.error?.message })).catch(err =>
        logger.warn(`[baileys] Failed to log disconnected event: ${err.message}`, { venueId })
      );

      if (statusCode === DisconnectReason.loggedOut) {
        await prisma.whatsapp_connections.update({
          where: { venue_id: venueId },
          data: {
            status: 'disconnected',
            session_data: null,
            qr_code: null,
            phone_number: null,
            updated_at: new Date()
          }
        });
        connections.delete(venueId);
        retryCounts.delete(venueId);
      } else if (shouldReconnect) {
        const retries = (retryCounts.get(venueId) || 0) + 1;
        retryCounts.set(venueId, retries);

        if (retries <= MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * retries;
          logger.info(`[baileys] Reconnecting venue ${venueId} in ${delay}ms (attempt ${retries}/${MAX_RETRIES})`, { venueId, retries });
          setTimeout(() => connectVenue(venueId), delay);
        } else {
          logger.error(`[baileys] Max retries reached for venue ${venueId}`, { venueId, retries: MAX_RETRIES });
          Sentry.captureException(new Error(`Max retries reached for venue ${venueId}`));
          logEvent(venueId, 'max_retries_reached', JSON.stringify({ retries: MAX_RETRIES })).catch(err =>
            logger.warn(`[baileys] Failed to log max_retries event: ${err.message}`, { venueId })
          );
          await prisma.whatsapp_connections.update({
            where: { venue_id: venueId },
            data: { status: 'disconnected', qr_code: null, updated_at: new Date() }
          });
          connections.delete(venueId);
          retryCounts.delete(venueId);
        }
      }
    }
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return;
    for (const msg of msgs) {
      await handleMessage(venueId, socket, msg);
    }
  });

  // Track message delivery/read status updates from WhatsApp
  socket.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      try {
        const waStatus = update.update?.status;
        const statusMap = { 2: 'sent', 3: 'delivered', 4: 'read' };
        if (statusMap[waStatus] && update.key?.id) {
          await prisma.chat_messages.updateMany({
            where: { external_id: update.key.id },
            data: { status: statusMap[waStatus] }
          });
        }
      } catch (err) {
        // Silently ignore — external_id may not exist for non-tracked messages
      }
    }
  });

  return { venueId, status: 'qr_pending' };
}

async function disconnectVenue(venueId, clearSession = true) {
  const entry = connections.get(venueId);
  if (entry?.socket) {
    try {
      await entry.socket.logout();
    } catch (err) {
      try { entry.socket.end(); } catch (_) {}
    }
  }
  connections.delete(venueId);
  retryCounts.delete(venueId);

  const updateData = {
    status: 'disconnected',
    qr_code: null,
    updated_at: new Date()
  };
  if (clearSession) {
    updateData.session_data = null;
    updateData.phone_number = null;
  }

  try {
    await prisma.whatsapp_connections.update({
      where: { venue_id: venueId },
      data: updateData
    });
  } catch (_) {}
}

async function getStatus(venueId) {
  const dbConn = await prisma.whatsapp_connections.findUnique({
    where: { venue_id: venueId }
  });
  if (!dbConn) {
    return { status: 'not_configured', qr_code: null, phone_number: null };
  }
  return {
    status: dbConn.status,
    qr_code: dbConn.qr_code,
    phone_number: dbConn.phone_number,
    last_connected: dbConn.last_connected
  };
}

async function sendMessage(venueId, phone, text) {
  const entry = connections.get(venueId);
  if (!entry?.socket) {
    throw new Error('No active WhatsApp connection for this venue');
  }
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await entry.socket.sendMessage(jid, { text });
}

async function sendImage(venueId, phone, imageUrl, caption) {
  const entry = connections.get(venueId);
  if (!entry?.socket) {
    throw new Error('No active WhatsApp connection for this venue');
  }
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await entry.socket.sendMessage(jid, { image: { url: imageUrl }, caption: caption || '' });
}

async function restoreAllConnections() {
  try {
    const activeConnections = await prisma.whatsapp_connections.findMany({
      where: { status: 'connected' }
    });

    if (activeConnections.length === 0) {
      logger.info('[baileys] No connections to restore');
      return;
    }

    logger.info(`[baileys] Restoring ${activeConnections.length} connection(s)...`);
    for (const conn of activeConnections) {
      try {
        await connectVenue(conn.venue_id);
      } catch (err) {
        logger.error(`[baileys] Failed to restore venue ${conn.venue_id}: ${err.message}`, { venueId: conn.venue_id, error: err.message });
        Sentry.captureException(err);
      }
    }
  } catch (err) {
    logger.error(`[baileys] Error restoring connections: ${err.message}`, { error: err.message });
    Sentry.captureException(err);
  }
}

module.exports = {
  connectVenue,
  disconnectVenue,
  getStatus,
  sendMessage,
  sendImage,
  restoreAllConnections,
  connections
};
