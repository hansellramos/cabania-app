/**
 * System Baileys Auth State stored in PostgreSQL (system_whatsapp_connection.session_data)
 *
 * Same pattern as baileysStore.js but for the system connection.
 */

const { initAuthCreds, BufferJSON } = require('baileys');

/**
 * Create a DB-backed auth state for the system Baileys connection.
 */
async function useSystemDBAuthState(prisma, recordId) {
  const connection = await prisma.system_whatsapp_connection.findUnique({
    where: { id: recordId },
    select: { session_data: true }
  });

  let sessionData = connection?.session_data || {};

  let creds;
  if (sessionData.creds) {
    creds = JSON.parse(JSON.stringify(sessionData.creds), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
  }

  const keys = sessionData.keys || {};

  async function writeSessionData(updatedCreds, updatedKeys) {
    const data = {
      creds: JSON.parse(JSON.stringify(updatedCreds, BufferJSON.replacer)),
      keys: updatedKeys
    };
    await prisma.system_whatsapp_connection.update({
      where: { id: recordId },
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
          await writeSessionData(creds, keys);
        }
      }
    },
    saveCreds: async () => {
      await writeSessionData(creds, keys);
    }
  };
}

module.exports = { useSystemDBAuthState };
