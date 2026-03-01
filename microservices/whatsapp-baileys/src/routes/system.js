const express = require('express');
const router = express.Router();
const systemBaileysService = require('../services/systemBaileysService');

// POST /api/system/connect
router.post('/system/connect', async (req, res) => {
  try {
    const result = await systemBaileysService.connectSystem();
    res.json(result);
  } catch (error) {
    console.error('[system] Connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/system/disconnect
router.post('/system/disconnect', async (req, res) => {
  try {
    await systemBaileysService.disconnectSystem();
    res.json({ success: true });
  } catch (error) {
    console.error('[system] Disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/system/status
router.get('/system/status', async (req, res) => {
  try {
    const status = await systemBaileysService.getSystemStatus();
    res.json(status);
  } catch (error) {
    console.error('[system] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
