/**
 * HTML email templates for CabanIA
 */

const APP_URL = () => process.env.APP_URL || 'https://cabania.app'

function invitationEmail({ inviterName, organizationName, token, message, expiresAt, acceptUrl }) {
  const onboardingUrl = acceptUrl || `${APP_URL()}/#/onboarding?token=${token}`
  const expireDate = new Date(expiresAt).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return {
    subject: `${inviterName} te invita a CabanIA`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#10b981,#0ea5e9);border-radius:12px;line-height:48px;font-size:24px;">
                &#127969;
              </div>
              <h1 style="color:#f1f5f9;font-size:24px;margin:16px 0 0;font-weight:700;">CabanIA</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin:0 0 16px;">
                <strong style="color:#f1f5f9;">${inviterName}</strong> te ha invitado a unirte a
                ${organizationName ? `<strong style="color:#f1f5f9;">${organizationName}</strong> en` : ''} CabanIA — la plataforma que centraliza reservas, pagos y operación de tus propiedades.
              </p>
              ${message ? `
              <div style="background-color:rgba(255,255,255,0.04);border-left:3px solid #10b981;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
                <p style="color:#94a3b8;font-size:14px;margin:0;font-style:italic;">"${message}"</p>
              </div>` : ''}
              <div style="text-align:center;margin:32px 0;">
                <a href="${onboardingUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#0ea5e9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;">
                  Aceptar invitación
                </a>
              </div>
              <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
                Esta invitación expira el ${expireDate}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">
                Si no esperabas esta invitación, puedes ignorar este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `${inviterName} te ha invitado a unirte a CabanIA${organizationName ? ` (${organizationName})` : ''}.\n\nAcepta la invitación aquí: ${onboardingUrl}\n\nEsta invitación expira el ${expireDate}.`
  }
}

function invitationWhatsAppMessage({ inviterName, organizationName, token, acceptUrl }) {
  const onboardingUrl = acceptUrl || `${APP_URL()}/#/onboarding?token=${token}`
  return `¡Hola! 👋 *${inviterName}* te invita a unirte a CabanIA${organizationName ? ` (${organizationName})` : ''} — la plataforma que centraliza reservas, pagos y operación de tus propiedades.\n\nRegístrate aquí: ${onboardingUrl}`
}

function loginCodeEmail({ code, userName, expiresMinutes }) {
  const digits = code.split('')
  const digitCells = digits.map(d =>
    `<td style="width:48px;height:56px;background-color:rgba(255,255,255,0.06);border:1px solid rgba(16,185,129,0.3);border-radius:10px;text-align:center;font-size:28px;font-weight:700;color:#f1f5f9;letter-spacing:2px;font-family:'SF Mono',Monaco,Consolas,monospace;">${d}</td>`
  ).join('<td style="width:8px;"></td>')

  return {
    subject: 'Tu código de acceso — CabanIA',
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#10b981,#0ea5e9);border-radius:12px;line-height:48px;font-size:24px;">
                &#128274;
              </div>
              <h1 style="color:#f1f5f9;font-size:24px;margin:16px 0 0;font-weight:700;">CabanIA</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin:0 0 8px;">
                Hola${userName ? ` <strong style="color:#f1f5f9;">${userName}</strong>` : ''},
              </p>
              <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin:0 0 28px;">
                Tu código de acceso es:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>${digitCells}</tr>
              </table>
              <p style="color:#94a3b8;font-size:14px;text-align:center;margin:0 0 8px;">
                Este código expira en <strong style="color:#f1f5f9;">${expiresMinutes} minutos</strong>.
              </p>
              <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
                Si no solicitaste este código, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">
                No compartas este código con nadie. El equipo de CabanIA nunca te lo pedirá.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Tu código de acceso en CabanIA es: ${code}\n\nExpira en ${expiresMinutes} minutos. Si no lo solicitaste, ignora este mensaje.`
  }
}

function loginCodeWhatsAppMessage({ code, userName, expiresMinutes }) {
  return `🔐 *CabanIA* — Código de acceso\n\nHola${userName ? ` ${userName}` : ''}, tu código es: *${code}*\n\nExpira en ${expiresMinutes} minutos. No compartas este código.`
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * Notification for the venue's team (contract signed, payment, new booking,
 * reminder...): a headline, a short paragraph, a table of details and a button
 * to open it in the app. `details` is a list of [label, value].
 */
function notificationEmail({ subject, title, intro, details = [], ctaUrl, ctaLabel = 'Ver en CabanIA', venueName, settingsUrl }) {
  const rows = details
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `
                <tr>
                  <td style="padding:8px 0;color:#94a3b8;font-size:14px;width:40%;vertical-align:top;">${escapeHtml(label)}</td>
                  <td style="padding:8px 0;color:#f1f5f9;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
                </tr>`).join('')
  const manageUrl = settingsUrl || `${APP_URL()}/#/business/notifications`

  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0f172a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 40px 8px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#10b981,#0ea5e9);border-radius:8px;padding:4px 10px;color:#fff;font-size:13px;font-weight:700;">CabanIA</span>
              ${venueName ? `<span style="color:#64748b;font-size:13px;margin-left:8px;">${escapeHtml(venueName)}</span>` : ''}
              <h1 style="color:#f1f5f9;font-size:22px;margin:16px 0 0;font-weight:700;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 32px;">
              ${intro ? `<p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin:8px 0 16px;">${escapeHtml(intro)}</p>` : ''}
              ${rows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);margin:0 0 8px;">${rows}
              </table>` : ''}
              ${ctaUrl ? `
              <div style="text-align:center;margin:28px 0 0;">
                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#0ea5e9);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:600;">
                  ${escapeHtml(ctaLabel)}
                </a>
              </div>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">
                Recibes este correo por la configuración de notificaciones de tu organización.
                <a href="${escapeHtml(manageUrl)}" style="color:#64748b;">Cambiar notificaciones</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: [
      title,
      intro,
      ...details.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => `${label}: ${value}`),
      ctaUrl ? `\n${ctaLabel}: ${ctaUrl}` : null
    ].filter(Boolean).join('\n')
  }
}

module.exports = { invitationEmail, invitationWhatsAppMessage, loginCodeEmail, loginCodeWhatsAppMessage, notificationEmail }
