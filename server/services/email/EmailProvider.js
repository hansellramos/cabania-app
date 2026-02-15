/**
 * Abstract email provider interface.
 * All email providers (SMTP, SendGrid, etc.) must implement this class.
 */
class EmailProvider {
  /**
   * Send an email
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML body
   * @param {string} [options.text] - Plain text body (optional)
   * @param {string} [options.from] - Override default from address
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async send({ to, subject, html, text, from }) {
    throw new Error('EmailProvider.send() must be implemented by subclass')
  }

  /**
   * Verify the provider connection is working
   * @returns {Promise<boolean>}
   */
  async verify() {
    throw new Error('EmailProvider.verify() must be implemented by subclass')
  }
}

module.exports = EmailProvider
