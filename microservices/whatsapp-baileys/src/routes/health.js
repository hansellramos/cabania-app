const express = require('express');
const router = express.Router();
const baileysService = require('../services/baileysService');

router.get('/health', (req, res) => {
  const venueConnections = baileysService.connections.size;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    venue_connections: venueConnections,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
