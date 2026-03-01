const express = require('express');
const router = express.Router();
const baileysService = require('../services/baileysService');

// POST /api/venues/:venueId/connect
router.post('/venues/:venueId/connect', async (req, res) => {
  try {
    const result = await baileysService.connectVenue(req.params.venueId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[venue] Connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/venues/:venueId/disconnect
router.post('/venues/:venueId/disconnect', async (req, res) => {
  try {
    await baileysService.disconnectVenue(req.params.venueId);
    res.json({ success: true, status: 'disconnected' });
  } catch (error) {
    console.error('[venue] Disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/venues/:venueId/status
router.get('/venues/:venueId/status', async (req, res) => {
  try {
    const status = await baileysService.getStatus(req.params.venueId);
    res.json(status);
  } catch (error) {
    console.error('[venue] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
