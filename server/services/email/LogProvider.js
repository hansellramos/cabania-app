const EmailProvider = require('./EmailProvider')

/**
 * Writes the email to the console instead of sending it. For local development
 * and tests (EMAIL_PROVIDER=log), so no real address ever gets a message.
 */
class LogProvider extends EmailProvider {
  async send({ to, subject, html, text }) {
    const body = text || String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    console.log('[email:log]', JSON.stringify({ to, subject, preview: body.slice(0, 400) }))
    return { success: true, messageId: `log-${Date.now()}` }
  }

  async verify() {
    return true
  }
}

module.exports = LogProvider
