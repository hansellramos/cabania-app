/**
 * Baileys WhatsApp Service
 *
 * Manages WhatsApp Web connections per venue using Baileys library.
 * - Socket lifecycle (connect, disconnect, reconnect)
 * - QR code generation for UI
 * - Session persistence via DB (baileysStore)
 * - In-memory Map of active connections
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const { prisma } = require('../../db');
const { useDBAuthState } = require('./baileysStore');
const { handleMessage } = require('./baileysHandler');

// Active connections: venueId → { socket, venueId, phoneNumber }
const connections = new Map();

// Retry counters to prevent infinite reconnect loops
const retryCounts = new Map();
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * Connect a venue to WhatsApp via Baileys.
 * Creates/updates the whatsapp_connections record and starts the socket.
 */
async function connectVenue(venueId) {
  // Disconnect existing socket if any
  if (connections.has(venueId)) {
    await disconnectVenue(venueId, false);
  }

  // Ensure DB record exists
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

  // Load auth state from DB
  const { state, saveCreds } = await useDBAuthState(prisma, venueId);

  // Create Baileys socket
  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    defaultQueryTimeoutMs: 60000,
    browser: ['CabanIA', 'Chrome', '22.0'],
  });

  // Store in memory
  connections.set(venueId, { socket, venueId, phoneNumber: dbConn.phone_number });

  // Reset retry counter on new connection attempt
  retryCounts.set(venueId, 0);

  // --- Event: connection.update ---
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // New QR code generated — save for UI polling
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

      // Update in-memory record
      const entry = connections.get(venueId);
      if (entry) entry.phoneNumber = phoneNumber;

      retryCounts.set(venueId, 0);
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[baileys] Connection closed for venue ${venueId}, code: ${statusCode}, reconnect: ${shouldReconnect}`);

      if (statusCode === DisconnectReason.loggedOut) {
        // User logged out — clear session and mark disconnected
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
        // Attempt reconnection with backoff
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

  // --- Event: creds.update ---
  socket.ev.on('creds.update', saveCreds);

  // --- Event: messages.upsert ---
  socket.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    // Only handle new messages (not history sync)
    if (type !== 'notify') return;
    for (const msg of msgs) {
      await handleMessage(venueId, socket, msg);
    }
  });

  return { venueId, status: 'qr_pending' };
}

/**
 * Disconnect a venue's WhatsApp session.
 * @param {string} venueId
 * @param {boolean} clearSession - If true, clears session_data (full logout)
 */
async function disconnectVenue(venueId, clearSession = true) {
  const entry = connections.get(venueId);
  if (entry?.socket) {
    try {
      await entry.socket.logout();
    } catch (err) {
      // Logout may fail if already disconnected
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
  } catch (_) {
    // Record may not exist
  }
}

/**
 * Get the current status of a venue's WhatsApp connection.
 */
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

/**
 * Send a text message via a venue's WhatsApp connection.
 */
async function sendMessage(venueId, phone, text) {
  const entry = connections.get(venueId);
  if (!entry?.socket) {
    throw new Error('No active WhatsApp connection for this venue');
  }
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await entry.socket.sendMessage(jid, { text });
}

/**
 * Restore all previously connected venues on server startup.
 */
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

/**
 * Check if Baileys is available (for environments where it shouldn't run, e.g. Vercel).
 */
function isAvailable() {
  return !process.env.VERCEL;
}

module.exports = {
  connectVenue,
  disconnectVenue,
  getStatus,
  sendMessage,
  restoreAllConnections,
  isAvailable,
  connections
};
