let client = null

function getTwilioClient() {
  if (client) return client
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    console.warn('Twilio credentials not configured — WhatsApp sending disabled')
    return null
  }
  const twilio = require('twilio')
  client = twilio(accountSid, authToken)
  return client
}

/**
 * Send a WhatsApp message via Twilio
 * @param {Object} options
 * @param {string} options.to - Recipient phone number (E.164 format, e.g. +573001234567)
 * @param {string} options.body - Message text
 * @param {string} [options.templateSid] - Twilio content template SID (for approved templates)
 * @param {Object} [options.templateVars] - Template variables
 * @returns {Promise<{ success: boolean, sid?: string, error?: string }>}
 */
async function sendWhatsApp({ to, body, templateSid, templateVars }) {
  const twilioClient = getTwilioClient()
  if (!twilioClient) {
    return { success: false, error: 'Twilio not configured' }
  }

  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

  try {
    const messageOptions = {
      from,
      to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    }

    if (templateSid) {
      messageOptions.contentSid = templateSid
      if (templateVars) {
        messageOptions.contentVariables = JSON.stringify(templateVars)
      }
    } else {
      messageOptions.body = body
    }

    const message = await twilioClient.messages.create(messageOptions)
    return { success: true, sid: message.sid }
  } catch (error) {
    console.error('Twilio WhatsApp error:', error.message)
    return { success: false, error: error.message }
  }
}

module.exports = { sendWhatsApp }
