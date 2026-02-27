/**
 * Baileys Auth State stored in PostgreSQL (whatsapp_connections.session_data)
 *
 * Replaces filesystem-based auth with DB persistence.
 * session_data JSON structure: { creds: {...}, keys: { preKeys: {...}, ... } }
 */

const { initAuthCreds, BufferJSON } = require('baileys');

/**
 * Create a DB-backed auth state for Baileys.
 * Reads/writes to whatsapp_connections.session_data for the given venueId.
 */
async function useDBAuthState(prisma, venueId) {
  // Load existing session data from DB
  const connection = await prisma.whatsapp_connections.findUnique({
    where: { venue_id: venueId },
    select: { session_data: true }
  });

  let sessionData = connection?.session_data || {};

  // Parse creds or init fresh
  let creds;
  if (sessionData.creds) {
    creds = JSON.parse(JSON.stringify(sessionData.creds), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
  }

  // Parse stored keys or start empty
  const keys = sessionData.keys || {};

  // Helper to write session_data back to DB
  async function writeSessionData(updatedCreds, updatedKeys) {
    const data = {
      creds: JSON.parse(JSON.stringify(updatedCreds, BufferJSON.replacer)),
      keys: updatedKeys
    };
    await prisma.whatsapp_connections.update({
      where: { venue_id: venueId },
      data: {
        session_data: data,
        updated_at: new Date()
      }
    });
  }

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          const bucket = keys[type] || {};
          for (const id of ids) {
            const value = bucket[id];
            if (value) {
              data[id] = JSON.parse(JSON.stringify(value), BufferJSON.reviver);
            }
          }
          return data;
        },
        set: async (data) => {
          for (const category in data) {
            if (!keys[category]) keys[category] = {};
            for (const id in data[category]) {
              const value = data[category][id];
              if (value) {
                keys[category][id] = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
              } else {
                delete keys[category][id];
              }
            }
          }
          // Persist keys along with current creds
          await writeSessionData(creds, keys);
        }
      }
    },
    saveCreds: async () => {
      await writeSessionData(creds, keys);
    }
  };
}

module.exports = { useDBAuthState };
