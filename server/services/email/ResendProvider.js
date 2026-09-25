const EmailProvider = require('./EmailProvider')

const RESEND_API = 'https://api.resend.com/emails'

/**
 * Email over Resend's HTTPS API. Railway blocks outbound SMTP (ports 25, 465,
 * 587 and 2525) below the Pro plan, so production cannot use SmtpProvider.
 * The sender domain must be verified in Resend (SPF/DKIM records).
 */
class ResendProvider extends EmailProvider {
  constructor(config = {}) {
    super()
    this.apiKey = config.apiKey || process.env.RESEND_API_KEY
    this.from = config.from || process.env.SMTP_FROM || 'CabanIA <hola@cabania.co>'
    this.replyTo = config.replyTo || process.env.EMAIL_REPLY_TO || null
  }

  async send({ to, subject, html, text, from }) {
    if (!this.apiKey) return { success: false, error: 'RESEND_API_KEY no configurada' }
    const recipients = (Array.isArray(to) ? to : String(to || '').split(/[,;]/))
      .map(address => address.trim())
      .filter(Boolean)
    try {
      const res = await fetch(RESEND_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from || this.from,
          to: recipients,
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''),
          ...(this.replyTo && { reply_to: this.replyTo }),
        }),
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const error = `Resend ${res.status}: ${body.message || body.name || res.statusText}`
        console.error('Resend send error:', error)
        return { success: false, error }
      }
      return { success: true, messageId: body.id }
    } catch (error) {
      console.error('Resend send error:', error.message)
      return { success: false, error: error.message }
    }
  }

  async verify() {
    return !!this.apiKey
  }
}

module.exports = ResendProvider
