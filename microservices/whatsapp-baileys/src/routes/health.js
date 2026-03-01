const express = require('express');
const router = express.Router();
const baileysService = require('../services/baileysService');
const { prisma } = require('../db');

router.get('/health', async (req, res) => {
  const venueConnections = baileysService.connections.size;
  const components = {};

  // Check database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    components.database = { status: 'up', latency_ms: Date.now() - start };
  } catch (err) {
    components.database = { status: 'down', error: err.message };
  }

  // Gather per-venue details
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

  const dbUp = components.database.status === 'up';
  const status = dbUp ? 'healthy' : 'unhealthy';

  res.status(dbUp ? 200 : 503).json({
    status,
    uptime: process.uptime(),
    venue_connections: venueConnections,
    venue_details: venueDetails,
    components,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
