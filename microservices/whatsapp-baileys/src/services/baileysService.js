/**
 * Baileys WhatsApp Service (Microservice version)
 *
 * Manages WhatsApp Web connections per venue using Baileys library.
 * Always available (no Vercel check needed).
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const { prisma } = require('../db');
const { useDBAuthState } = require('../stores/baileysStore');
const { handleMessage } = require('./baileysHandler');

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
      console.log(`[baileys] QR code generated for venue ${venueId}`);
      await prisma.whatsapp_connections.update({
        where: { venue_id: venueId },
        data: { qr_code: qr, status: 'qr_pending', updated_at: new Date() }
      });
    }

    if (connection === 'open') {
      console.log(`[baileys] Connected for venue ${venueId}`);
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
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[baileys] Connection closed for venue ${venueId}, code: ${statusCode}, reconnect: ${shouldReconnect}`);

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
          console.log(`[baileys] Reconnecting venue ${venueId} in ${delay}ms (attempt ${retries}/${MAX_RETRIES})`);
          setTimeout(() => connectVenue(venueId), delay);
        } else {
          console.error(`[baileys] Max retries reached for venue ${venueId}`);
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

async function restoreAllConnections() {
  try {
    const activeConnections = await prisma.whatsapp_connections.findMany({
      where: { status: 'connected' }
    });

    if (activeConnections.length === 0) {
      console.log('[baileys] No connections to restore');
      return;
    }

    console.log(`[baileys] Restoring ${activeConnections.length} connection(s)...`);
    for (const conn of activeConnections) {
      try {
        await connectVenue(conn.venue_id);
      } catch (err) {
        console.error(`[baileys] Failed to restore venue ${conn.venue_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[baileys] Error restoring connections:', err.message);
  }
}

module.exports = {
  connectVenue,
  disconnectVenue,
  getStatus,
  sendMessage,
  restoreAllConnections,
  connections
};
