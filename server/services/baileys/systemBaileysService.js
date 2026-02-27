/**
 * System Baileys WhatsApp Service
 *
 * A single global WhatsApp connection for system-level notifications
 * (escalation alerts, resume confirmations, etc.).
 * Unlike baileysService.js which manages per-venue connections,
 * this service manages ONE connection stored in system_whatsapp_connection.
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const { prisma } = require('../../db');
const { useSystemDBAuthState } = require('./systemBaileysStore');
const { handleSystemMessage } = require('./systemBaileysHandler');

// Single global connection
let systemSocket = null;
let systemPhoneNumber = null;

// Retry state
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * Get or create the single system_whatsapp_connection record.
 */
async function getOrCreateRecord() {
  let record = await prisma.system_whatsapp_connection.findFirst();
  if (!record) {
    record = await prisma.system_whatsapp_connection.create({
      data: { channel: 'baileys', status: 'disconnected' }
    });
  }
  return record;
}

/**
 * Connect the system WhatsApp via Baileys.
 */
async function connectSystem() {
  // Disconnect existing
  if (systemSocket) {
    await disconnectSystem(false);
  }

  const record = await getOrCreateRecord();

  await prisma.system_whatsapp_connection.update({
    where: { id: record.id },
    data: { status: 'qr_pending', qr_code: null, updated_at: new Date() }
  });

  // Load auth state
  const { state, saveCreds } = await useSystemDBAuthState(prisma, record.id);

  // Create socket
  const { version } = await fetchLatestBaileysVersion();
  systemSocket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    defaultQueryTimeoutMs: 60000,
    browser: ['CabanIA System', 'Chrome', '22.0'],
  });

  retryCount = 0;

  // --- connection.update ---
  systemSocket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[baileys-system] QR code generated');
      await prisma.system_whatsapp_connection.update({
        where: { id: record.id },
        data: { qr_code: qr, status: 'qr_pending', updated_at: new Date() }
      });
    }

    if (connection === 'open') {
      console.log('[baileys-system] Connected');
      const meId = systemSocket.user?.id;
      systemPhoneNumber = meId ? meId.split(':')[0].split('@')[0] : null;

      await prisma.system_whatsapp_connection.update({
        where: { id: record.id },
        data: {
          status: 'connected',
          phone_number: systemPhoneNumber,
          qr_code: null,
          last_connected: new Date(),
          updated_at: new Date()
        }
      });
      retryCount = 0;
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[baileys-system] Connection closed, code: ${statusCode}, reconnect: ${shouldReconnect}`);

      if (statusCode === DisconnectReason.loggedOut) {
        await prisma.system_whatsapp_connection.update({
          where: { id: record.id },
          data: {
            status: 'disconnected',
            session_data: null,
            qr_code: null,
            phone_number: null,
            updated_at: new Date()
          }
        });
        systemSocket = null;
        systemPhoneNumber = null;
        retryCount = 0;
      } else if (shouldReconnect) {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * retryCount;
          console.log(`[baileys-system] Reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          setTimeout(() => connectSystem(), delay);
        } else {
          console.error('[baileys-system] Max retries reached');
          await prisma.system_whatsapp_connection.update({
            where: { id: record.id },
            data: { status: 'disconnected', qr_code: null, updated_at: new Date() }
          });
          systemSocket = null;
          retryCount = 0;
        }
      }
    }
  });

  // --- creds.update ---
  systemSocket.ev.on('creds.update', saveCreds);

  // --- messages.upsert ---
  systemSocket.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return;
    for (const msg of msgs) {
      await handleSystemMessage(systemSocket, msg);
    }
  });

  return { status: 'qr_pending' };
}

/**
 * Disconnect the system WhatsApp.
 */
async function disconnectSystem(clearSession = true) {
  if (systemSocket) {
    try {
      await systemSocket.logout();
    } catch (err) {
      try { systemSocket.end(); } catch (_) {}
    }
  }
  systemSocket = null;
  systemPhoneNumber = null;
  retryCount = 0;

  const record = await getOrCreateRecord();
  const updateData = {
    status: 'disconnected',
    qr_code: null,
    updated_at: new Date()
  };
  if (clearSession) {
    updateData.session_data = null;
    updateData.phone_number = null;
  }
  await prisma.system_whatsapp_connection.update({
    where: { id: record.id },
    data: updateData
  });
}

/**
 * Get current status of the system WhatsApp.
 */
async function getSystemStatus() {
  const record = await prisma.system_whatsapp_connection.findFirst();
  if (!record) {
    return { status: 'not_configured', qr_code: null, phone_number: null };
  }
  return {
    status: record.status,
    qr_code: record.qr_code,
    phone_number: record.phone_number,
    last_connected: record.last_connected,
    channel: record.channel
  };
}

/**
 * Send a message from the system WhatsApp.
 */
async function sendSystemMessage(phone, text) {
  if (!systemSocket) {
    console.warn('[baileys-system] No active system connection, cannot send message');
    return false;
  }
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await systemSocket.sendMessage(jid, { text });
  return true;
}

/**
 * Restore system connection on startup if it was previously connected.
 */
async function restoreSystemConnection() {
  try {
    const record = await prisma.system_whatsapp_connection.findFirst({
      where: { status: 'connected', channel: 'baileys' }
    });
    if (record) {
      console.log('[baileys-system] Restoring system connection...');
      await connectSystem();
    } else {
      console.log('[baileys-system] No system connection to restore');
    }
  } catch (err) {
    console.error('[baileys-system] Error restoring connection:', err.message);
  }
}

module.exports = {
  connectSystem,
  disconnectSystem,
  getSystemStatus,
  sendSystemMessage,
  restoreSystemConnection
};
