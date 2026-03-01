const config = require('./config');
const express = require('express');
const cors = require('cors');
const { validateApiKey } = require('./middleware/apiKey');
const { prisma } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Health check (no API key required)
app.use('/api', require('./routes/health'));

// All other routes require API key
app.use('/api', validateApiKey, require('./routes/venue'));
app.use('/api', validateApiKey, require('./routes/system'));
app.use('/api', validateApiKey, require('./routes/messaging'));

// Services (loaded after config is validated)
const baileysService = require('./services/baileysService');
const systemBaileysService = require('./services/systemBaileysService');

/**
 * Calculate the next resume time at given hour in America/Bogota timezone.
 */
function getNextResumeTime(hour = 3) {
  const now = new Date();
  const bogotaOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const bogotaMinutes = utcMinutes + bogotaOffset;

  const targetBogotaMs = new Date(now);
  targetBogotaMs.setUTCHours(hour - (bogotaOffset / 60), 0, 0, 0);

  if (targetBogotaMs <= now) {
    targetBogotaMs.setUTCDate(targetBogotaMs.getUTCDate() + 1);
  }

  return targetBogotaMs;
}

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`[whatsapp-service] Running on port ${config.PORT}`);

  // Restore venue connections
  baileysService.restoreAllConnections().catch(err => {
    console.error('[baileys] Error restoring connections on startup:', err.message);
  });

  // Restore system connection
  systemBaileysService.restoreSystemConnection().catch(err => {
    console.error('[baileys-system] Error restoring system connection on startup:', err.message);
  });

  // Auto-resume escalated conversations — check every 5 minutes
  setInterval(async () => {
    try {
      const now = new Date();
      const toResume = await prisma.chat_conversations.findMany({
        where: {
          status: 'human_attention',
          resume_at: { lte: now }
        }
      });

      if (toResume.length === 0) return;

      console.log(`[auto-resume] Resuming ${toResume.length} conversation(s)`);

      await prisma.chat_conversations.updateMany({
        where: {
          status: 'human_attention',
          resume_at: { lte: now }
        },
        data: {
          status: 'active',
          escalated_at: null,
          escalated_reason: null,
          resume_at: null,
          updated_at: now
        }
      });

      for (const conv of toResume) {
        if (conv.phone && conv.source === 'baileys') {
          try {
            await baileysService.sendMessage(
              conv.venue_id,
              conv.phone,
              '¡Hola! 👋 CabanIA está disponible nuevamente para ayudarte. ¿En qué puedo asistirte?'
            );
          } catch (err) {
            // Connection may not be active
          }
        }
      }
    } catch (err) {
      console.error('[auto-resume] Error:', err.message);
    }
  }, 5 * 60 * 1000);
});
