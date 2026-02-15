const nodemailer = require('nodemailer')
const EmailProvider = require('./EmailProvider')

class SmtpProvider extends EmailProvider {
  constructor(config) {
    super()
    this.from = config.from || process.env.SMTP_FROM || 'noreply@cabania.info'
    this.transporter = nodemailer.createTransport({
      host: config.host || process.env.SMTP_HOST,
      port: parseInt(config.port || process.env.SMTP_PORT || '587', 10),
      secure: (config.port || process.env.SMTP_PORT) === '465',
      auth: {
        user: config.user || process.env.SMTP_USER,
        pass: config.pass || process.env.SMTP_PASS,
      },
    })
  }

  async send({ to, subject, html, text, from }) {
    try {
      const info = await this.transporter.sendMail({
        from: from || this.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      })
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('SMTP send error:', error.message)
      return { success: false, error: error.message }
    }
  }

  async verify() {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP verify error:', error.message)
      return false
    }
  }
}

module.exports = SmtpProvider
