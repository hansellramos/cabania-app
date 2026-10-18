/**
 * Notification center: the kinds of events the venue's team can hear about,
 * who hears and through which channels (in-app bell, email, WhatsApp from the
 * system number), configured per organization and optionally per venue
 * (notification_settings).
 *
 * Usage from anywhere in the server:
 *   notify('payment_received', { organizationId, venueId, data: { accommodationId, amount } })
 * notify() never throws and never writes to a guest: recipients are always the
 * organization's users, the extra team addresses or the team phones configured.
 *
 * To add a type: add it to TYPES with its label, defaults and build(data, ctx),
 * which returns { title, body, link, email: { subject, intro, details, ctaLabel } }.
 */

const { getEmailProvider } = require('./email')
const { notificationEmail } = require('./email/templates')

const CHANNELS = ['in_app', 'email', 'whatsapp']
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CO')}`

/** "sábado, 3 de octubre" for a booking date stored as a UTC day. */
const formatBookingDate = (value) => (value
  ? new Date(value).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
  : '')

const firstName = (fullname) => String(fullname || '').trim().split(/\s+/)[0] || null

/** Where a booking came from, as the team calls it. */
const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  baileys: 'WhatsApp',
  cloud_api: 'WhatsApp',
  twilio: 'WhatsApp',
  instagram: 'Instagram',
  web: 'chat de la página web',
  api: 'API (agente externo)',
  assistant: 'asistente de CabanIA'
}
const channelLabel = (channel) => CHANNEL_LABELS[channel] || channel || 'un medio externo'

const people = (acc) => {
  const adults = acc.adults || 0
  const children = acc.children || 0
  const total = adults + children
  return `${total} persona${total === 1 ? '' : 's'}`
    + (children ? ` (${adults} adulto${adults === 1 ? '' : 's'} y ${children} niño${children === 1 ? '' : 's'})` : '')
}

/**
 * The registry. `defaults` applies while the organization has not configured
 * the type; `recipients` is who gets it by default: 'admins' (the organization's
 * administrators) or 'members' (everyone in the organization). `pending` types
 * are reserved for features still being built (they can be configured already).
 */
const TYPES = {
  booking_created_ai: {
    label: 'Alquiler creado por la IA o un medio externo',
    description: 'Un alquiler que se cerró sin que nadie del equipo lo registrara: pagado por el chat de WhatsApp, Instagram o la página web, o creado por el asistente o la API.',
    defaults: { in_app: true, email: false, whatsapp: false },
    // As before the notification center: in the bell of everyone in the organization.
    recipients: 'members',
    async build({ accommodationId, channel, paidAmount, balance, contractUrl, manual }, ctx) {
      const { acc, venue, plan, customer, agent } = await ctx.loadBooking(accommodationId)
      const date = formatBookingDate(acc.date)
      const summary = `Se registró un alquiler para el ${date} en ${venue.name}: ${people(acc)}.`
      const details = [
        ['Fecha', date],
        ['Cabaña', venue.name],
        ['Personas', people(acc)],
        ['Plan', plan?.name],
        ['Cliente', customer?.fullname ? `${customer.fullname}${customer.whatsapp ? ` (${customer.whatsapp})` : ''}` : null],
        ['Por', channelLabel(channel)],
        ['Vendido por', agent?.name],
        ['Pagado', paidAmount ? `${money(paidAmount)}${balance > 0 ? ` · Saldo pendiente: ${money(balance)}` : ''}` : null],
        ['Contrato', contractUrl ? 'Generado, pendiente de firma' : null],
        ['Nota', manual ? 'Pago conciliado a mano' : null]
      ]
      return {
        title: `Nuevo alquiler: ${date}`,
        body: `${summary} ${details.slice(3).filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join(' · ')}`.trim(),
        whatsappTitle: `🎉 *Nuevo alquiler confirmado - ${venue.name}*`,
        link: `/business/accommodations/${acc.id}`,
        email: { subject: `Nuevo alquiler: ${venue.name}, ${date}`, intro: summary, details, ctaLabel: 'Ver el alquiler' }
      }
    }
  },

  contract_signed: {
    label: 'Contrato u otrosí firmado',
    description: 'El cliente firmó el contrato de su alquiler o un otrosí.',
    defaults: { in_app: true, email: false, whatsapp: false },
    recipients: 'admins',
    async build({ accommodationId, amendmentNumber }, ctx) {
      const { acc, venue, plan, customer } = await ctx.loadBooking(accommodationId)
      const date = formatBookingDate(acc.date)
      const client = firstName(customer?.fullname)
      const what = amendmentNumber ? `el otrosí #${amendmentNumber}` : 'el contrato'
      const intro = `${client || 'El cliente'} firmó ${what} del alquiler del ${date} en ${venue.name}.`
      return {
        title: `${amendmentNumber ? `Otrosí #${amendmentNumber}` : 'Contrato'} firmado: ${date}`,
        body: intro,
        whatsappTitle: `✍️ *${amendmentNumber ? 'Otrosí' : 'Contrato'} firmado - ${venue.name}*`,
        link: `/business/accommodations/${acc.id}`,
        email: {
          subject: `${client || 'El cliente'} firmó ${what}: ${venue.name}, ${date}`,
          intro,
          details: [['Fecha del alquiler', date], ['Cliente', client], ['Cabaña', venue.name], ['Plan', plan?.name], ['Personas', people(acc)]],
          ctaLabel: 'Ver el alquiler'
        }
      }
    }
  },

  payment_received: {
    label: 'Pago recibido',
    description: 'Se registró o verificó un pago de un alquiler, incluidos los pagos en línea con Bold.',
    defaults: { in_app: true, email: false, whatsapp: false },
    recipients: 'admins',
    async build({ accommodationId, amount, method, verified, balance }, ctx) {
      const { acc, venue, customer } = await ctx.loadBooking(accommodationId)
      const date = formatBookingDate(acc.date)
      const client = firstName(customer?.fullname)
      if (balance === undefined) balance = await ctx.bookingBalance(acc)
      const intro = `${verified ? 'Pago recibido' : 'Pago registrado, pendiente de verificar'}: ${money(amount)}`
        + `${method ? ` (${method})` : ''} del alquiler${client ? ` de ${client}` : ''} para el ${date} en ${venue.name}.`
      return {
        title: `${verified ? 'Pago recibido' : 'Pago por verificar'}: ${money(amount)}`,
        body: `${intro}${balance > 0 ? ` Saldo pendiente: ${money(balance)}.` : ' Sin saldo pendiente.'}`,
        whatsappTitle: `💰 *${verified ? 'Pago recibido' : 'Pago por verificar'} - ${venue.name}*`,
        link: `/business/accommodations/${acc.id}`,
        email: {
          subject: `${verified ? 'Pago recibido' : 'Pago por verificar'}: ${money(amount)} · ${venue.name}, ${date}`,
          intro,
          details: [['Monto', money(amount)], ['Método', method], ['Fecha del alquiler', date], ['Cliente', client], ['Saldo pendiente', money(balance)]],
          ctaLabel: 'Ver el alquiler'
        }
      }
    }
  },

  booking_reminder: {
    label: 'Recordatorio de alquiler próximo',
    description: 'Días antes de la llegada del cliente, según lo que defina cada plan (por defecto 1 día antes).',
    defaults: { in_app: true, email: false, whatsapp: false },
    recipients: 'admins',
    async build({ accommodationId, daysBefore }, ctx) {
      const { acc, venue, plan, customer, contract } = await ctx.loadBooking(accommodationId)
      const date = formatBookingDate(acc.date)
      const when = daysBefore === 0 ? 'hoy' : daysBefore === 1 ? 'mañana' : `en ${daysBefore} días`
      const balance = await ctx.bookingBalance(acc)
      const hours = [plan?.check_in_time, plan?.check_out_time].filter(Boolean).join(' a ')
      const intro = `${when.charAt(0).toUpperCase()}${when.slice(1)} (${date}) llega${customer?.fullname ? ` ${customer.fullname}` : ' un cliente'} a ${venue.name}: ${people(acc)}.`
      const details = [
        ['Fecha', date],
        ['Cabaña', venue.name],
        ['Plan', plan?.name],
        ['Horario', hours || null],
        ['Personas', people(acc)],
        ['Cliente', customer?.fullname ? `${customer.fullname}${customer.whatsapp ? ` (${customer.whatsapp})` : ''}` : null],
        ['Saldo pendiente', balance > 0 ? money(balance) : 'Sin saldo'],
        ['Contrato', contract ? (contract.status === 'signed' ? 'Firmado' : 'Sin firmar') : 'Sin contrato']
      ]
      return {
        title: `Alquiler ${when}: ${venue.name}`,
        body: `${intro} ${details.slice(2).filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join(' · ')}`,
        whatsappTitle: `⏰ *Alquiler ${when} - ${venue.name}*`,
        link: `/business/accommodations/${acc.id}`,
        email: { subject: `Recordatorio: alquiler ${when} en ${venue.name} (${date})`, intro, details, ctaLabel: 'Ver el alquiler' }
      }
    }
  },

  recurring_expense_overdue: {
    label: 'Gasto recurrente vencido',
    description: 'Un gasto recurrente (servicios, nómina…) pasó su fecha sin registrarse.',
    defaults: { in_app: true, email: false, whatsapp: false },
    recipients: 'admins',
    pending: true,
    build: genericBuild
  },

  membership_expiring: {
    label: 'Membresía por vencer',
    description: 'La suscripción de la organización a CabanIA está por vencer.',
    defaults: { in_app: true, email: false, whatsapp: false },
    recipients: 'admins',
    pending: true,
    build: genericBuild
  }
}

/**
 * For types whose caller writes the message: data = { title, body, link,
 * details: [[label, value]], subject, ctaLabel }.
 */
async function genericBuild(data) {
  return {
    title: data.title,
    body: data.body || null,
    link: data.link || null,
    email: { subject: data.subject || data.title, intro: data.body, details: data.details || [], ctaLabel: data.ctaLabel }
  }
}

const splitList = (value) => String(value || '').split(/[,;\s]+/).map(v => v.trim()).filter(Boolean)

function createNotifier({ prisma, whatsappClient, cleanPhone, appBaseUrl }) {
  /** The booking with what the messages mention. */
  async function loadBooking(accommodationId) {
    const acc = accommodationId ? await prisma.accommodations.findUnique({ where: { id: accommodationId } }) : null
    if (!acc?.venue) throw new Error(`Alquiler ${accommodationId} no encontrado`)
    const [venue, plan, customer, agent, contract] = await Promise.all([
      prisma.venues.findUnique({ where: { id: acc.venue } }),
      acc.plan_id ? prisma.venue_plans.findUnique({ where: { id: acc.plan_id }, select: { name: true, check_in_time: true, check_out_time: true } }) : null,
      acc.customer ? prisma.contacts.findUnique({ where: { id: acc.customer }, select: { fullname: true, whatsapp: true } }) : null,
      acc.commission_agent_id ? prisma.commission_agents.findUnique({ where: { id: acc.commission_agent_id }, select: { name: true, user_id: true } }) : null,
      prisma.contracts.findFirst({ where: { accommodation_id: acc.id }, select: { status: true } })
    ])
    return { acc, venue: venue || { id: acc.venue, name: 'la cabaña' }, plan, customer, agent, contract }
  }

  /** What is still owed on a booking (agreed price minus verified payments). */
  async function bookingBalance(acc) {
    const paid = await prisma.payments.aggregate({ where: { accommodation: acc.id, verified: true }, _sum: { amount: true } })
    const agreed = Number(acc.agreed_price ?? acc.calculated_price ?? 0)
    return Math.max(0, agreed - Number(paid._sum.amount || 0))
  }

  /** Users of the organization with whether each one is an administrator. */
  async function organizationMembers(organizationId) {
    const memberships = await prisma.user_organizations.findMany({
      where: { organization_id: organizationId },
      select: { user_id: true }
    })
    if (!memberships.length) return []
    const users = await prisma.users.findMany({
      where: { id: { in: memberships.map(m => m.user_id) } },
      select: { id: true, email: true, display_name: true, is_super_admin: true, is_locked: true, profile: { select: { code: true, name: true, permissions: true } } }
    })
    return users.filter(u => !u.is_locked).map(u => ({
      id: u.id,
      email: u.email,
      name: u.display_name || u.email || u.id,
      profile: u.profile?.name || null,
      // Administrators: the "Administrador de Organización" profile, a super admin,
      // or a custom profile that can edit venues.
      is_admin: !!(u.is_super_admin || u.profile?.code === 'organization:admin'
        || (Array.isArray(u.profile?.permissions) && u.profile.permissions.includes('venues:edit')))
    })).sort((a, b) => Number(b.is_admin) - Number(a.is_admin) || a.name.localeCompare(b.name))
  }

  const fromRow = (def, row) => ({
    source: row.venue_id ? 'venue' : 'organization',
    enabled: row.enabled,
    channels: { ...def.defaults, ...(row.channels || {}) },
    recipient_user_ids: Array.isArray(row.recipient_user_ids) ? row.recipient_user_ids.map(String) : null,
    email_to_users: row.email_to_users,
    extra_emails: row.extra_emails || '',
    whatsapp_phones: row.whatsapp_phones || '',
    updated_at: row.updated_at
  })

  /**
   * Before the notification center, new-booking alerts were configured on the
   * venue (notify_booking_*). A venue that turned them on and has no row of its
   * own keeps them, like a venue override.
   */
  async function legacyVenueSettings(def, venueId) {
    const venue = await prisma.venues.findUnique({
      where: { id: venueId },
      select: { notify_booking_whatsapp: true, notify_booking_whatsapp_phone: true, notify_booking_email: true, notify_booking_emails: true }
    })
    if (!venue?.notify_booking_whatsapp && !venue?.notify_booking_email) return null
    return {
      source: 'legacy',
      enabled: true,
      channels: { ...def.defaults, whatsapp: venue.notify_booking_whatsapp, email: venue.notify_booking_email },
      recipient_user_ids: null,
      // The old alert emailed only the addresses typed on the venue.
      email_to_users: false,
      extra_emails: venue.notify_booking_emails || '',
      whatsapp_phones: venue.notify_booking_whatsapp_phone || ''
    }
  }

  /**
   * The settings that apply to a type for a venue (or the whole organization):
   * the venue's own row, else the organization's, else the type's defaults.
   */
  async function resolveSettings(type, organizationId, venueId = null) {
    const def = TYPES[type]
    const rows = await prisma.notification_settings.findMany({
      where: { organization_id: organizationId, type, OR: [{ venue_id: null }, ...(venueId ? [{ venue_id: venueId }] : [])] }
    })
    const venueRow = venueId && rows.find(r => r.venue_id === venueId)
    if (venueRow) return fromRow(def, venueRow)
    if (type === 'booking_created_ai' && venueId) {
      const legacy = await legacyVenueSettings(def, venueId)
      if (legacy) return legacy
    }
    const orgRow = rows.find(r => r.venue_id === null)
    if (orgRow) return fromRow(def, orgRow)
    return {
      source: 'default', enabled: true, channels: { ...def.defaults }, recipient_user_ids: null,
      email_to_users: true, extra_emails: '', whatsapp_phones: ''
    }
  }

  /** Who gets it: the chosen users that are still in the organization, or the default. */
  function pickRecipients(def, settings, members) {
    if (settings.recipient_user_ids) {
      const chosen = new Set(settings.recipient_user_ids.map(String))
      return members.filter(m => chosen.has(m.id))
    }
    return def.recipients === 'members' ? members : members.filter(m => m.is_admin)
  }

  async function sendWhatsApp(type, venue, phones, text) {
    if (!whatsappClient?.isAvailable()) {
      console.warn('[notify] System WhatsApp unavailable', { type, venue: venue?.id })
      return 0
    }
    let sent = 0
    for (const phone of phones) {
      try {
        await whatsappClient.sendSystemMessage(phone, text)
        sent += 1
      } catch (err) {
        console.error('[notify] WhatsApp failed', { type, venue: venue?.id, error: err.message })
      }
    }
    return sent
  }

  /**
   * Deliver an event of `type` to whoever the organization chose.
   * excludeUserIds: users who should not hear (e.g. whoever did it).
   */
  async function notify(type, { organizationId = null, venueId = null, data = {}, excludeUserIds = [] } = {}) {
    try {
      const def = TYPES[type]
      if (!def) throw new Error(`Tipo de notificación desconocido: ${type}`)
      const venue = venueId ? await prisma.venues.findUnique({ where: { id: venueId }, select: { id: true, name: true, organization: true, whatsapp: true } }) : null
      organizationId = organizationId || venue?.organization || null
      if (!organizationId) {
        console.warn('[notify] No organization', { type, venue: venueId })
        return null
      }

      const settings = await resolveSettings(type, organizationId, venueId)
      if (!settings.enabled) return { type, skipped: 'disabled' }

      const message = await def.build(data, { loadBooking, bookingBalance })
      const excluded = new Set(excludeUserIds.filter(Boolean).map(String))
      const members = await organizationMembers(organizationId)
      const recipients = pickRecipients(def, settings, members).filter(m => !excluded.has(m.id))
      const appUrl = message.link ? `${appBaseUrl()}/#${message.link}` : appBaseUrl()
      const result = { type, in_app: 0, email: 0, whatsapp: 0 }

      if (settings.channels.in_app && recipients.length) {
        const created = await prisma.notifications.createMany({
          data: recipients.map(m => ({
            user_id: m.id,
            organization_id: organizationId,
            venue_id: venue?.id || null,
            type,
            title: String(message.title).slice(0, 255),
            body: message.body || null,
            link: message.link || null
          }))
        })
        result.in_app = created.count
      }

      if (settings.channels.email) {
        const addresses = new Set([
          ...(settings.email_to_users ? recipients.map(m => m.email) : []),
          ...splitList(settings.extra_emails)
        ].filter(e => e && EMAIL_PATTERN.test(e)).map(e => e.toLowerCase()))
        if (!addresses.size) console.warn('[notify] Email on but no valid address', { type, organization: organizationId, venue: venueId })
        const email = notificationEmail({
          subject: message.email?.subject || message.title,
          title: message.title,
          intro: message.email?.intro ?? message.body,
          details: message.email?.details || [],
          ctaUrl: appUrl,
          ctaLabel: message.email?.ctaLabel,
          venueName: venue?.name
        })
        // One email per address: the team does not see each other's addresses.
        for (const to of addresses) {
          const sent = await getEmailProvider().send({ to, ...email })
          if (sent?.success) result.email += 1
          else console.error('[notify] Email failed', { type, venue: venueId, error: sent?.error })
        }
      }

      if (settings.channels.whatsapp) {
        let phones = splitList(settings.whatsapp_phones).map(cleanPhone).filter(Boolean)
        // No phone typed: the venue's own WhatsApp, as the old new-booking alert did.
        if (!phones.length && venue?.whatsapp) phones = [cleanPhone(String(venue.whatsapp))].filter(Boolean)
        if (!phones.length) {
          console.warn('[notify] WhatsApp on but no phone', { type, venue: venueId })
        } else {
          const text = `${message.whatsappTitle || `🔔 *${message.title}*`}\n\n${message.body || ''}\n\nVer en CabanIA: ${appUrl}`
          result.whatsapp = await sendWhatsApp(type, venue, [...new Set(phones)], text)
        }
      }

      console.log('[notify] Sent', { ...result, organization: organizationId, venue: venueId, source: settings.source })
      return result
    } catch (err) {
      console.error('[notify] Failed', { type, venue: venueId, error: err.message })
      return null
    }
  }

  return { notify, resolveSettings, organizationMembers, loadBooking }
}

/** What the settings screen needs to know about each type. */
const typeCatalog = () => Object.entries(TYPES).map(([code, def]) => ({
  code,
  label: def.label,
  description: def.description,
  defaults: def.defaults,
  default_recipients: def.recipients,
  pending: !!def.pending
}))

module.exports = { TYPES, CHANNELS, createNotifier, typeCatalog, channelLabel }
