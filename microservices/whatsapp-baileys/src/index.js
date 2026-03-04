const config = require('./config');
const Sentry = require('@sentry/node');
const logger = require('./logger');

if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: 0.1,
  });
}

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

// Sentry error handler (must be after routes)
Sentry.setupExpressErrorHandler(app);

// Services (loaded after config is validated)
const baileysService = require('./services/baileysService');
const systemBaileysService = require('./services/systemBaileysService');
const { getMetrics } = require('./metrics');

// Global error handlers
process.on('unhandledRejection', (reason) => {
  logger.error('[process] Unhandled rejection', { error: String(reason) });
  Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  logger.error('[process] Uncaught exception', { error: err.message, stack: err.stack });
  Sentry.captureException(err);
});

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
  logger.info(`[whatsapp-service] Running on port ${config.PORT}`);

  // Restore venue connections
  baileysService.restoreAllConnections().catch(err => {
    logger.error('[baileys] Error restoring connections on startup', { error: err.message });
  });

  // Restore system connection
  systemBaileysService.restoreSystemConnection().catch(err => {
    logger.error('[baileys-system] Error restoring system connection on startup', { error: err.message });
  });

  // Pipeline health monitor — check every 5 minutes
  let lastAlertedChatApiDown = false;
  let lastAlertedPipelineStale = false;

  setInterval(async () => {
    try {
      const m = getMetrics();
      const hasConnections = baileysService.connections.size > 0;

      // Check if chat API is reachable
      let chatApiUp = false;
      try {
        const res = await fetch(`${config.MAIN_APP_URL}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        chatApiUp = res.ok;
      } catch (_) {}

      if (!chatApiUp && hasConnections) {
        if (!lastAlertedChatApiDown) {
          const err = new Error(`Pipeline alert: Chat API unreachable at ${config.MAIN_APP_URL}`);
          logger.error(`[pipeline:alert] Chat API unreachable`, { mainAppUrl: config.MAIN_APP_URL, venueConnections: baileysService.connections.size });
          Sentry.captureException(err, { level: 'fatal', extra: { metrics: m } });
          lastAlertedChatApiDown = true;
        }
      } else {
        lastAlertedChatApiDown = false;
      }

      // Check for stale pipeline: receiving messages but failing to send
      if (hasConnections && m.messages_received > 0) {
        const receivedRecently = m.last_message_received_at &&
          (Date.now() - new Date(m.last_message_received_at).getTime()) < 30 * 60 * 1000;
        const sentRecently = m.last_message_sent_at &&
          (Date.now() - new Date(m.last_message_sent_at).getTime()) < 30 * 60 * 1000;

        if (receivedRecently && !sentRecently && m.messages_sent === 0) {
          if (!lastAlertedPipelineStale) {
            const err = new Error(`Pipeline alert: Messages received (${m.messages_received}) but none sent. Last error: ${m.last_error || 'unknown'} at step ${m.last_error_step || 'unknown'}`);
            logger.error(`[pipeline:alert] Receiving but not sending`, { metrics: m });
            Sentry.captureException(err, { level: 'error', extra: { metrics: m } });
            lastAlertedPipelineStale = true;
          }
        } else {
          lastAlertedPipelineStale = false;
        }
      }

      // Log pipeline status periodically
      if (hasConnections) {
        logger.info(`[pipeline:status] received=${m.messages_received} sent=${m.messages_sent} failed=${m.messages_failed} api_errors=${m.chat_api_errors} drops=${m.connection_drops} chat_api=${chatApiUp ? 'up' : 'DOWN'}`, {
          ...m, chatApiUp, venueConnections: baileysService.connections.size
        });
      }
    } catch (err) {
      logger.error(`[pipeline:monitor_error] ${err.message}`, { error: err.message });
    }
  }, 5 * 60 * 1000);

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

      logger.info(`[auto-resume] Resuming ${toResume.length} conversation(s)`);

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
            logger.warn(`[auto-resume] Failed to send greeting to ${conv.phone}`, { error: err.message });
          }
        }
      }
    } catch (err) {
      logger.error('[auto-resume] Error', { error: err.message });
    }
  }, 5 * 60 * 1000);
});
