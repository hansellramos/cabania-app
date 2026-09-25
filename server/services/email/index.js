const SmtpProvider = require('./SmtpProvider')
const ResendProvider = require('./ResendProvider')

let instance = null

/**
 * Get the configured email provider instance (singleton).
 * Reads EMAIL_PROVIDER env var to decide which provider to use: 'smtp' (default)
 * or 'resend' (HTTPS API with RESEND_API_KEY; needed on Railway, which blocks SMTP).
 *
 * To add a new provider:
 *   1. Create MyProvider.js extending EmailProvider
 *   2. Add a case here
 *   3. Set EMAIL_PROVIDER=myprovider in .env
 */
function getEmailProvider() {
  if (instance) return instance

  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase()

  switch (provider) {
    case 'resend':
      instance = new ResendProvider({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.SMTP_FROM,
      })
      break

    case 'smtp':
    default:
      instance = new SmtpProvider({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM,
      })
      break

    // Example: to add SendGrid in the future:
    // case 'sendgrid':
    //   const SendGridProvider = require('./SendGridProvider')
    //   instance = new SendGridProvider({ apiKey: process.env.SENDGRID_API_KEY })
    //   break
  }

  return instance
}

module.exports = { getEmailProvider }
