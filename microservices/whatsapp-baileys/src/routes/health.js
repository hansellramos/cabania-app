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

  const dbUp = components.database.status === 'up';
  const status = dbUp ? 'healthy' : 'unhealthy';

  res.status(dbUp ? 200 : 503).json({
    status,
    uptime: process.uptime(),
    venue_connections: venueConnections,
    components,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
