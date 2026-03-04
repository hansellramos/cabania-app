const express = require('express');
const router = express.Router();
const baileysService = require('../services/baileysService');
const { prisma } = require('../db');
const config = require('../config');
const { getMetrics } = require('../metrics');

router.get('/health', async (req, res) => {
  const venueConnections = baileysService.connections.size;
  const components = {};
  const problems = [];

  // 1. Check database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    components.database = { status: 'up', latency_ms: Date.now() - start };
  } catch (err) {
    components.database = { status: 'down', error: err.message };
    problems.push('database_down');
  }

  // 2. Check chat API (main app) reachability
  try {
    const start = Date.now();
    const apiRes = await fetch(`${config.MAIN_APP_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    if (apiRes.ok) {
      components.chat_api = { status: 'up', latency_ms: latency };
    } else {
      components.chat_api = { status: 'down', http_status: apiRes.status, latency_ms: latency };
      problems.push('chat_api_error');
    }
  } catch (err) {
    components.chat_api = { status: 'down', error: err.message };
    problems.push('chat_api_unreachable');
  }

  // 3. Pipeline metrics
  const pipeline = getMetrics();
  components.pipeline = {
    messages_received: pipeline.messages_received,
    messages_sent: pipeline.messages_sent,
    messages_failed: pipeline.messages_failed,
    chat_api_errors: pipeline.chat_api_errors,
    connection_drops: pipeline.connection_drops,
    last_message_received_at: pipeline.last_message_received_at,
    last_message_sent_at: pipeline.last_message_sent_at,
    last_error: pipeline.last_error,
    last_error_step: pipeline.last_error_step,
  };

  // 4. Check for stale pipeline: messages received but none sent recently
  if (pipeline.messages_received > 0 && pipeline.messages_sent === 0) {
    problems.push('pipeline_no_messages_sent');
  }
  if (pipeline.last_message_received_at && !pipeline.last_message_sent_at) {
    problems.push('pipeline_receiving_not_sending');
  }

  // 5. Gather per-venue details
  const venueDetails = {};
  for (const [vid, entry] of baileysService.connections) {
    const detail = { phone: entry.phoneNumber || null };
    if (components.database.status === 'up') {
      try {
        const lastMsg = await prisma.chat_messages.findFirst({
          where: {
            conversation: { venue_id: vid, source: 'baileys' },
            role: 'assistant'
          },
          orderBy: { created_at: 'desc' },
          select: { created_at: true, status: true }
        });
        detail.last_message_at = lastMsg?.created_at || null;
        detail.last_message_status = lastMsg?.status || null;

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentErrors = await prisma.whatsapp_event_log.count({
          where: { venue_id: vid, event_type: { in: ['message_failed', 'error'] }, created_at: { gte: oneHourAgo } }
        });
        detail.recent_errors_1h = recentErrors;
      } catch (_) {}
    }
    venueDetails[vid] = detail;
  }

  // Determine overall status
  const dbUp = components.database.status === 'up';
  const chatApiUp = components.chat_api?.status === 'up';
  let status = 'healthy';
  let httpStatus = 200;

  if (!dbUp) {
    status = 'unhealthy';
    httpStatus = 503;
  } else if (!chatApiUp) {
    status = 'degraded';
    httpStatus = 503;
  } else if (problems.length > 0) {
    status = 'degraded';
    // Still return 200 for non-critical problems to avoid false alarms on startup
    // Only 503 when chat API or DB is actually down
  }

  res.status(httpStatus).json({
    status,
    uptime: process.uptime(),
    venue_connections: venueConnections,
    venue_details: venueDetails,
    components,
    problems: problems.length > 0 ? problems : undefined,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
