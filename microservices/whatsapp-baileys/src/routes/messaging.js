const express = require('express');
const router = express.Router();
const baileysService = require('../services/baileysService');
const systemBaileysService = require('../services/systemBaileysService');

// POST /api/send/venue — send message from a venue's WhatsApp
router.post('/send/venue', async (req, res) => {
  try {
    const { venueId, phone, text } = req.body;
    if (!venueId || !phone || !text) {
      return res.status(400).json({ error: 'Missing venueId, phone, or text' });
    }
    await baileysService.sendMessage(venueId, phone, text);
    res.json({ success: true });
  } catch (error) {
    console.error('[messaging] Venue send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/send/venue/image — send image from a venue's WhatsApp
router.post('/send/venue/image', async (req, res) => {
  try {
    const { venueId, phone, imageUrl, caption } = req.body;
    if (!venueId || !phone || !imageUrl) {
      return res.status(400).json({ error: 'Missing venueId, phone, or imageUrl' });
    }
    await baileysService.sendImage(venueId, phone, imageUrl, caption);
    res.json({ success: true });
  } catch (error) {
    console.error('[messaging] Venue image send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/send/system — send message from system WhatsApp
router.post('/send/system', async (req, res) => {
  try {
    const { phone, text } = req.body;
    if (!phone || !text) {
      return res.status(400).json({ error: 'Missing phone or text' });
    }
    const sent = await systemBaileysService.sendSystemMessage(phone, text);
    res.json({ success: sent });
  } catch (error) {
    console.error('[messaging] System send error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
