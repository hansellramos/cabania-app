/**
 * Tools over CabanIA's data that apply a user's permissions and organizations.
 * Shared by the in-app assistant (server/assistant.js) and the API for external
 * AI agents (server/agent-api.js: REST, OpenAPI and MCP).
 *
 * Each definition says how it is exposed over REST (http.method + http.path,
 * relative to /api/agent/v1). Tools with write: true change data and are only
 * offered to agent keys that allow changes.
 */

const TIMEZONE = 'America/Bogota';
const MAX_TOOL_ROUNDS = 6;

const money = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CO')}`;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
const dayRange = (from, to) => ({
  gte: new Date(`${from}T00:00:00.000Z`),
  lte: new Date(`${to}T23:59:59.999Z`)
});
const validDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
// "domingo 1 de noviembre": models often get the weekday wrong, so it comes written.
const dayLabel = (d) => (d
  ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '')
  : null);

const DEFINITIONS = [
  {
    name: 'get_context',
    http: { method: 'GET', path: '/context' },
    description: 'Contexto para empezar: hoy (hora de Colombia) y los próximos días con su día de la semana, el usuario, sus cabañas (id y nombre) y qué puede hacer. Llámalo primero.',
    properties: {}
  },
  {
    name: 'list_bookings',
    http: { method: 'GET', path: '/bookings' },
    description: 'Lista alquileres (hospedajes) con fecha, cabaña, cliente, personas, plan, total, pagado, saldo, estado del contrato y si no asistió.',
    properties: {
      from: { type: 'string', description: 'Desde (YYYY-MM-DD). Por defecto hoy.' },
      to: { type: 'string', description: 'Hasta (YYYY-MM-DD). Por defecto 60 días después de from.' },
      venue_id: { type: 'string', description: 'Solo esta cabaña.' },
      only: { type: 'string', enum: ['all', 'with_balance', 'unsigned_contract', 'no_show', 'cancelled'], description: 'Filtro: con saldo pendiente, contrato sin firmar, no asistieron o cancelados (los cancelados no salen en los demás).' },
      customer: { type: 'string', description: 'Parte del nombre del cliente.' }
    }
  },
  {
    name: 'get_booking',
    http: { method: 'GET', path: '/bookings/{booking_id}' },
    description: 'Detalle completo de un alquiler: cliente y contacto, plan, personas, precios, pagos, depósito, contrato y otrosíes, comisionista, no asistencia.',
    properties: { booking_id: { type: 'string', description: 'ID del alquiler (de list_bookings).' } },
    required: ['booking_id']
  },
  {
    name: 'check_dates',
    http: { method: 'GET', path: '/availability' },
    description: 'Qué fechas están libres u ocupadas en las cabañas.',
    properties: {
      dates: { type: 'array', items: { type: 'string' }, description: 'Fechas YYYY-MM-DD a revisar.' },
      venue_id: { type: 'string', description: 'Solo esta cabaña (si no, todas).' }
    },
    required: ['dates']
  },
  {
    name: 'money_summary',
    http: { method: 'GET', path: '/money/summary' },
    description: 'Resumen de dinero de un período: ingresos verificados (por método), egresos por categoría, utilidad, comisiones de Bold y saldo por cobrar de alquileres próximos.',
    properties: {
      from: { type: 'string', description: 'Desde (YYYY-MM-DD).' },
      to: { type: 'string', description: 'Hasta (YYYY-MM-DD).' },
      venue_id: { type: 'string', description: 'Solo esta cabaña.' }
    },
    required: ['from', 'to']
  },
  {
    name: 'commissions',
    http: { method: 'GET', path: '/commissions' },
    description: 'Comisiones de comisionistas: cuánto se le debe a cada uno (pendientes) y lo pagado, con sus alquileres.',
    properties: {
      status: { type: 'string', enum: ['pending', 'paid', 'all'], description: 'Por defecto pending.' },
      agent: { type: 'string', description: 'Parte del nombre del comisionista.' }
    }
  },
  {
    name: 'chats_needing_attention',
    http: { method: 'GET', path: '/chats/attention' },
    description: 'Conversaciones con clientes que necesitan a alguien del equipo: escaladas o pausadas, y mensajes del cliente sin respuesta.',
    properties: { venue_id: { type: 'string', description: 'Solo esta cabaña.' } }
  },
  {
    name: 'open_quotes',
    http: { method: 'GET', path: '/quotes' },
    description: 'Cotizaciones pendientes (clientes que cotizaron y no han pagado), con el link de pago enviado o no.',
    properties: { venue_id: { type: 'string', description: 'Solo esta cabaña.' } }
  },
  {
    name: 'pending_work',
    http: { method: 'GET', path: '/pending-work' },
    description: 'Trabajo pendiente del equipo: tareas de mantenimiento abiertas y depósitos por devolver.',
    properties: { venue_id: { type: 'string', description: 'Solo esta cabaña.' } }
  },
  {
    name: 'venue_info',
    http: { method: 'GET', path: '/venues/{venue_id}' },
    description: 'Configuración de una cabaña: planes (con su id) con precios, horarios y comida; anticipo; métodos de pago; avisos de alquiler; mensaje de seguimiento.',
    properties: { venue_id: { type: 'string', description: 'ID de la cabaña (de get_context).' } },
    required: ['venue_id']
  },
  {
    name: 'find_contacts',
    http: { method: 'GET', path: '/contacts' },
    description: 'Busca contactos (clientes) por nombre, teléfono, Instagram o correo, con cuántos alquileres tiene.',
    properties: { query: { type: 'string', description: 'Nombre, teléfono, @instagram o correo (mínimo 2 caracteres).' } },
    required: ['query']
  },
  {
    name: 'create_quote',
    write: true,
    http: { method: 'POST', path: '/quotes' },
    description: 'Crea una cotización pendiente para un cliente (aparece en Cotizaciones; el equipo la convierte en alquiler cuando pague). El precio sale del plan si no se da agreed_price.',
    properties: {
      venue_id: { type: 'string', description: 'ID de la cabaña.' },
      date: { type: 'string', description: 'Fecha del alquiler (YYYY-MM-DD).' },
      plan_id: { type: 'string', description: 'ID del plan (de venue_info).' },
      adults: { type: 'integer', description: 'Adultos.' },
      children: { type: 'integer', description: 'Niños.' },
      customer_name: { type: 'string', description: 'Nombre del cliente.' },
      whatsapp: { type: 'string', description: 'WhatsApp del cliente con indicativo, ej: 573001234567.' },
      instagram: { type: 'string', description: 'Usuario de Instagram del cliente (si no hay WhatsApp).' },
      email: { type: 'string', description: 'Correo del cliente.' },
      agreed_price: { type: 'number', description: 'Precio acordado total, si es distinto al del plan.' },
      notes: { type: 'string', description: 'Notas para el equipo.' }
    },
    required: ['venue_id', 'date', 'plan_id', 'adults', 'customer_name']
  },
  {
    name: 'create_booking',
    write: true,
    http: { method: 'POST', path: '/bookings' },
    description: 'Crea un alquiler confirmado en una fecha libre. Usa un contacto existente (customer_contact_id de find_contacts) o crea uno con customer_name y whatsapp/email. Revisa antes la fecha con check_dates.',
    properties: {
      venue_id: { type: 'string', description: 'ID de la cabaña.' },
      date: { type: 'string', description: 'Fecha (YYYY-MM-DD).' },
      plan_id: { type: 'string', description: 'ID del plan (de venue_info).' },
      adults: { type: 'integer', description: 'Adultos.' },
      children: { type: 'integer', description: 'Niños.' },
      customer_contact_id: { type: 'string', description: 'ID de un contacto existente.' },
      customer_name: { type: 'string', description: 'Nombre, para crear el contacto si no existe.' },
      whatsapp: { type: 'string', description: 'WhatsApp con indicativo, para el contacto nuevo.' },
      email: { type: 'string', description: 'Correo, para el contacto nuevo.' },
      agreed_price: { type: 'number', description: 'Precio acordado total, si es distinto al del plan.' }
    },
    required: ['venue_id', 'date', 'plan_id', 'adults']
  },
  {
    name: 'record_payment',
    write: true,
    http: { method: 'POST', path: '/bookings/{booking_id}/payments' },
    description: 'Registra un pago recibido de un alquiler. Queda sin verificar hasta que alguien del equipo lo revise en la app.',
    properties: {
      booking_id: { type: 'string', description: 'ID del alquiler.' },
      amount: { type: 'number', description: 'Monto en pesos colombianos.' },
      method: { type: 'string', description: 'Método: Transferencia, Nequi, Efectivo, Bold, etc.' },
      date: { type: 'string', description: 'Fecha del pago (YYYY-MM-DD). Por defecto hoy.' },
      reference: { type: 'string', description: 'Referencia o comprobante.' },
      notes: { type: 'string', description: 'Notas.' }
    },
    required: ['booking_id', 'amount', 'method']
  },
  {
    name: 'cancel_booking',
    write: true,
    http: { method: 'POST', path: '/bookings/{booking_id}/cancel' },
    description: 'Cancela un alquiler: la fecha queda libre y se anula la comisión pendiente. Normalmente la cabaña se queda con lo pagado; si se devuelve dinero, indica refund_amount (queda como egreso "Devoluciones"). Confirma con el usuario el monto a devolver.',
    properties: {
      booking_id: { type: 'string', description: 'ID del alquiler.' },
      reason: { type: 'string', description: 'Motivo de la cancelación.' },
      refund_amount: { type: 'number', description: 'Dinero que se le devuelve al cliente (0 si no se devuelve nada). No puede ser mayor que lo pagado y verificado.' },
      refund_method: { type: 'string', description: 'Cómo se devuelve: Transferencia, Nequi, Efectivo…' },
      refund_date: { type: 'string', description: 'Fecha de la devolución (YYYY-MM-DD). Por defecto hoy.' }
    },
    required: ['booking_id', 'refund_amount']
  },
  {
    name: 'mark_no_show',
    write: true,
    http: { method: 'POST', path: '/bookings/{booking_id}/no-show' },
    description: 'Marca que el cliente no asistió (solo el día del alquiler o después). Los pagos se quedan como están.',
    properties: {
      booking_id: { type: 'string', description: 'ID del alquiler.' },
      note: { type: 'string', description: 'Qué pasó.' }
    },
    required: ['booking_id']
  }
];

/** Definitions in the OpenAI function format (also used for Anthropic by llm-service). */
const asFunctions = (defs) => defs.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: { type: 'object', properties: t.properties, ...(t.required && { required: t.required }) }
  }
}));

/** Read-only tools for the in-app assistant (it cannot change data yet). */
const ASSISTANT_TOOLS = DEFINITIONS.filter(t => !t.write && t.name !== 'get_context');

function createAgentTools(deps) {
  const {
    prisma, hasPermission, hasOwnOnly, getAccessibleVenueIds, getAgentAccommodationIds,
    findBookingConflict, cleanPhone, cleanInstagram, cancelAccommodation
  } = deps;

  /**
   * What this user may see, resolved once per request. Like the rest of the
   * app, a super admin sees only their own organizations unless viewAll
   * ("view all" / god mode) is on.
   */
  async function userScope({ userId, perms, viewAll = false }) {
    userId = String(userId || '');
    let venueIds = await getAccessibleVenueIds(perms); // null = all
    if (venueIds === null && perms?.isSuperAdmin && viewAll !== true) {
      const memberships = await prisma.user_organizations.findMany({ where: { user_id: userId }, select: { organization_id: true } });
      const own = await prisma.venues.findMany({
        where: { organization: { in: memberships.map(m => m.organization_id) } },
        select: { id: true }
      });
      venueIds = own.map(v => v.id);
    }
    const venues = await prisma.venues.findMany({
      where: venueIds === null ? {} : { id: { in: venueIds } },
      select: { id: true, name: true, organization: true },
      orderBy: { name: 'asc' }
    });
    // Organizations the user works in (null = all, only for a super admin viewing all).
    const orgIds = venueIds === null ? null : [...new Set(venues.map(v => v.organization).filter(Boolean))];
    const can = (p) => hasPermission(perms, p) || hasPermission(perms, `${p}:own`);
    const ownBookingsOnly = hasOwnOnly(perms, 'accommodations:view');
    const agentBookingIds = ownBookingsOnly ? await getAgentAccommodationIds(userId) : new Set();
    return { userId, perms, venueIds, orgIds, venues, can, ownBookingsOnly, agentBookingIds };
  }

  const venueFilter = (scope, venueId) => {
    if (venueId) {
      if (scope.venueIds !== null && !scope.venueIds.includes(venueId)) return { in: [] };
      return venueId;
    }
    return scope.venueIds === null ? undefined : { in: scope.venueIds };
  };

  const bookingWhere = (scope, extra = {}) => ({
    ...extra,
    ...(scope.ownBookingsOnly && {
      OR: [{ created_by: scope.userId }, { id: { in: [...scope.agentBookingIds] } }]
    })
  });

  async function describeBookings(list) {
    if (!list.length) return [];
    const ids = list.map(a => a.id);
    const [venues, customers, plans, paid, contracts] = await Promise.all([
      prisma.venues.findMany({ where: { id: { in: [...new Set(list.map(a => a.venue).filter(Boolean))] } }, select: { id: true, name: true } }),
      prisma.contacts.findMany({ where: { id: { in: [...new Set(list.map(a => a.customer).filter(Boolean))] } }, select: { id: true, fullname: true } }),
      prisma.venue_plans.findMany({ where: { id: { in: [...new Set(list.map(a => a.plan_id).filter(Boolean))] } }, select: { id: true, name: true } }),
      prisma.payments.groupBy({ by: ['accommodation'], where: { accommodation: { in: ids }, verified: true }, _sum: { amount: true } }),
      prisma.contracts.findMany({ where: { accommodation_id: { in: ids } }, select: { accommodation_id: true, status: true } })
    ]);
    const byId = (rows) => Object.fromEntries(rows.map(r => [r.id, r]));
    const v = byId(venues); const c = byId(customers); const p = byId(plans);
    const paidMap = Object.fromEntries(paid.map(r => [r.accommodation, Number(r._sum.amount || 0)]));
    const contractMap = Object.fromEntries(contracts.map(r => [r.accommodation_id, r.status]));
    return list.map(a => {
      const total = Math.round(Number(a.agreed_price ?? a.calculated_price ?? 0));
      const paidAmount = paidMap[a.id] || 0;
      return {
        id: a.id,
        date: a.date ? isoDay(a.date) : null,
        date_label: a.date ? dayLabel(isoDay(a.date)) : null,
        venue: v[a.venue]?.name || null,
        customer: c[a.customer]?.fullname || null,
        adults: a.adults || 0,
        children: a.children || 0,
        plan: p[a.plan_id]?.name || null,
        total: money(total),
        paid: money(paidAmount),
        balance: money(Math.max(0, total - paidAmount)),
        balance_value: Math.max(0, total - paidAmount),
        contract: contractMap[a.id] ? (contractMap[a.id] === 'signed' ? 'firmado' : 'sin firmar') : 'sin contrato',
        // A no-show moved to a new date as a courtesy is an active booking again.
        no_show: !!a.no_show_at && !a.rescheduled_at,
        cancelled: !!a.cancelled_at,
        rescheduled_from: a.rescheduled_at && a.original_date ? isoDay(a.original_date) : null,
        link: `/business/accommodations/${a.id}`
      };
    });
  }

  const tools = {
    async list_bookings(args, scope) {
      if (!scope.can('accommodations:view')) return { error: 'Sin permiso para ver alquileres.' };
      const from = validDay(args.from) || todayIso();
      const to = validDay(args.to) || isoDay(new Date(new Date(`${from}T00:00:00Z`).getTime() + 60 * 86400000));
      const where = bookingWhere(scope, { venue: venueFilter(scope, args.venue_id), date: dayRange(from, to) });
      if (args.only === 'no_show') where.no_show_at = { not: null };
      where.cancelled_at = args.only === 'cancelled' ? { not: null } : null;
      let list = await prisma.accommodations.findMany({ where, orderBy: { date: 'asc' }, take: 200 });
      let rows = await describeBookings(list);
      if (args.customer) {
        const q = String(args.customer).toLowerCase();
        rows = rows.filter(r => (r.customer || '').toLowerCase().includes(q));
      }
      if (args.only === 'with_balance') rows = rows.filter(r => r.balance_value > 0);
      if (args.only === 'unsigned_contract') rows = rows.filter(r => r.contract !== 'firmado');
      return { from, to, count: rows.length, bookings: rows.slice(0, 60), truncated: rows.length > 60 };
    },

    async get_booking(args, scope) {
      if (!scope.can('accommodations:view')) return { error: 'Sin permiso para ver alquileres.' };
      if (!/^[0-9a-f-]{36}$/i.test(args.booking_id || '')) return { error: 'booking_id no válido: búscalo primero con list_bookings.' };
      const acc = await prisma.accommodations.findFirst({
        where: bookingWhere(scope, { id: args.booking_id, venue: venueFilter(scope) })
      });
      if (!acc) return { error: 'Alquiler no encontrado o sin acceso.' };
      const [summary] = await describeBookings([acc]);
      const [customer, payments, deposit, contract, agent] = await Promise.all([
        acc.customer ? prisma.contacts.findUnique({ where: { id: acc.customer } }) : null,
        prisma.payments.findMany({ where: { accommodation: acc.id }, orderBy: { payment_date: 'asc' } }),
        prisma.deposits.findFirst({ where: { accommodation_id: acc.id } }),
        prisma.contracts.findFirst({ where: { accommodation_id: acc.id } }),
        acc.commission_agent_id ? prisma.commission_agents.findUnique({ where: { id: acc.commission_agent_id }, select: { name: true } }) : null
      ]);
      return {
        ...summary,
        customer_contact: customer ? { whatsapp: customer.whatsapp ? String(customer.whatsapp) : null, instagram: customer.instagram, email: customer.email } : null,
        payments: payments.map(p => ({ date: p.payment_date ? isoDay(p.payment_date) : null, amount: money(p.amount), method: p.payment_method, verified: p.verified })),
        deposit: deposit ? { amount: money(deposit.amount), status: deposit.status, refund: deposit.refund_amount ? money(deposit.refund_amount) : null } : null,
        contract: contract ? {
          status: contract.status,
          signed_at: contract.accepted_at,
          // Otrosíes exist once contract amendments are deployed.
          amendments: prisma.contract_amendments
            ? await prisma.contract_amendments.findMany({ where: { contract_id: contract.id }, select: { number: true, status: true } })
            : []
        } : null,
        commission_agent: agent?.name || null,
        no_show_note: acc.no_show_note || null,
        cancel_note: acc.cancel_note || null
      };
    },

    async check_dates(args, scope) {
      if (!scope.can('accommodations:view')) return { error: 'Sin permiso para ver alquileres.' };
      const dates = (Array.isArray(args.dates) ? args.dates : []).map(validDay).filter(Boolean).slice(0, 31);
      if (!dates.length) return { error: 'Indica las fechas en formato YYYY-MM-DD.' };
      const venues = scope.venues.filter(v => !args.venue_id || v.id === args.venue_id);
      const booked = await prisma.accommodations.findMany({
        where: { venue: { in: venues.map(v => v.id) }, date: { in: dates.map(d => new Date(`${d}T00:00:00.000Z`)) }, cancelled_at: null },
        select: { venue: true, date: true }
      });
      const taken = new Set(booked.map(b => `${b.venue}|${isoDay(b.date)}`));
      return {
        venues: venues.map(v => ({
          venue: v.name,
          venue_id: v.id,
          free: dates.filter(d => !taken.has(`${v.id}|${d}`)).map(d => ({ date: d, label: dayLabel(d) })),
          booked: dates.filter(d => taken.has(`${v.id}|${d}`)).map(d => ({ date: d, label: dayLabel(d) }))
        }))
      };
    },

    async money_summary(args, scope) {
      if (!hasPermission(scope.perms, 'payments:view')) return { error: 'Sin permiso para ver la contabilidad.' };
      const from = validDay(args.from); const to = validDay(args.to);
      if (!from || !to) return { error: 'Indica from y to (YYYY-MM-DD).' };
      const venue = venueFilter(scope, args.venue_id);
      const venueBookings = await prisma.accommodations.findMany({ where: { venue }, select: { id: true } });
      const payments = await prisma.payments.findMany({
        where: { verified: true, payment_date: dayRange(from, to), accommodation: { in: venueBookings.map(b => b.id) } },
        select: { amount: true, payment_method: true }
      });
      const income = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const byMethod = {};
      for (const p of payments) byMethod[p.payment_method || 'Otro'] = (byMethod[p.payment_method || 'Otro'] || 0) + Number(p.amount || 0);

      let expenses = null;
      if (hasPermission(scope.perms, 'expenses:view')) {
        const rows = await prisma.expenses.findMany({
          where: { expense_date: dayRange(from, to), ...(venue !== undefined && { venue_id: venue }) },
          select: { amount: true, category: { select: { name: true } } }
        });
        const byCategory = {};
        for (const e of rows) byCategory[e.category?.name || 'Sin categoría'] = (byCategory[e.category?.name || 'Sin categoría'] || 0) + Number(e.amount || 0);
        const total = rows.reduce((s, e) => s + Number(e.amount || 0), 0);
        expenses = {
          total: money(total),
          total_value: total,
          by_category: Object.fromEntries(Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, money(v)])),
          bold_fees: money(byCategory['Comisiones de pago'] || 0)
        };
      }

      const upcoming = await prisma.accommodations.findMany({
        where: { venue, date: { gte: new Date(`${todayIso()}T00:00:00.000Z`) }, no_show_at: null, cancelled_at: null },
        take: 300
      });
      const upcomingRows = await describeBookings(upcoming);
      const receivable = upcomingRows.reduce((s, r) => s + r.balance_value, 0);

      return {
        from, to,
        income: money(income),
        income_by_method: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, money(v)])),
        expenses,
        net: expenses ? money(income - expenses.total_value) : 'sin permiso para ver egresos',
        receivable_upcoming: money(receivable),
        note: 'Ingresos = pagos verificados con fecha de pago en el período (base de caja).'
      };
    },

    async commissions(args, scope) {
      const canAll = hasPermission(scope.perms, 'commissions:view');
      const agents = await prisma.commission_agents.findMany({
        where: canAll
          ? (scope.orgIds === null ? {} : {
            OR: [{ organization_id: { in: scope.orgIds } }, { venue_id: { in: scope.venueIds } }]
          })
          : { user_id: scope.userId },
        select: { id: true, name: true }
      });
      if (!agents.length) return { error: canAll ? 'No hay comisionistas.' : 'Sin permiso para ver comisiones.' };
      const filtered = args.agent ? agents.filter(a => a.name.toLowerCase().includes(String(args.agent).toLowerCase())) : agents;
      const status = args.status || 'pending';
      const payments = await prisma.commission_payments.findMany({
        where: { agent_id: { in: filtered.map(a => a.id) }, ...(status !== 'all' && { status }) },
        orderBy: { created_at: 'desc' },
        take: 200
      });
      const bookings = await describeBookings(await prisma.accommodations.findMany({
        where: { id: { in: payments.map(p => p.accommodation_id) } }
      }));
      const bookingMap = Object.fromEntries(bookings.map(b => [b.id, b]));
      return {
        status,
        agents: filtered.map(a => {
          const mine = payments.filter(p => p.agent_id === a.id);
          return {
            agent: a.name,
            agent_id: a.id,
            total: money(mine.reduce((s, p) => s + Number(p.calculated_amount || 0), 0)),
            items: mine.slice(0, 20).map(p => ({
              amount: money(p.calculated_amount),
              status: p.status,
              booking: bookingMap[p.accommodation_id] ? `${bookingMap[p.accommodation_id].date} · ${bookingMap[p.accommodation_id].venue} · ${bookingMap[p.accommodation_id].customer || 'sin cliente'}` : null
            }))
          };
        })
      };
    },

    async chats_needing_attention(args, scope) {
      const venue = venueFilter(scope, args.venue_id);
      const since = new Date(Date.now() - 3 * 86400000);
      const conversations = await prisma.chat_conversations.findMany({
        where: { venue_id: venue, updated_at: { gte: since } },
        include: { messages: { orderBy: { created_at: 'desc' }, take: 1 } },
        orderBy: { updated_at: 'desc' },
        take: 100
      });
      const names = Object.fromEntries(scope.venues.map(v => [v.id, v.name]));
      const out = [];
      for (const c of conversations) {
        const last = c.messages[0];
        const waiting = last?.role === 'user' && Date.now() - new Date(last.created_at).getTime() > 10 * 60 * 1000;
        if (c.status !== 'human_attention' && !waiting) continue;
        out.push({
          venue: names[c.venue_id] || null,
          who: c.name || c.phone,
          channel: c.source,
          reason: c.status === 'human_attention' ? (c.escalated_reason === 'human_reply' ? 'atendiendo el equipo' : 'escalada') : 'mensaje sin respuesta',
          last_message: last ? String(last.content).replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 140) : null,
          at: last?.created_at || c.updated_at,
          link: `/venues/${c.venue_id}/chat?conversation_id=${c.id}`
        });
      }
      return { count: out.length, conversations: out.slice(0, 30) };
    },

    async open_quotes(args, scope) {
      if (!scope.can('estimates:view')) return { error: 'Sin permiso para ver cotizaciones.' };
      const quotes = await prisma.estimates.findMany({
        where: { status: 'pending', venue_id: venueFilter(scope, args.venue_id), created_at: { gte: new Date(Date.now() - 30 * 86400000) } },
        orderBy: { created_at: 'desc' },
        take: 50
      });
      const names = Object.fromEntries(scope.venues.map(v => [v.id, v.name]));
      return {
        count: quotes.length,
        quotes: quotes.map(q => ({
          id: q.id,
          venue: names[q.venue_id] || null,
          customer: q.customer_name,
          date: q.check_in ? isoDay(q.check_in) : null,
          people: (q.adults || 0) + (q.children || 0),
          total: money(q.agreed_price ?? q.calculated_price),
          payment: q.payment_status === 'link_sent' ? 'link de pago enviado' : (q.payment_status || 'sin pago'),
          created: isoDay(q.created_at),
          link: `/business/estimates/${q.id}`
        }))
      };
    },

    async pending_work(args, scope) {
      const venue = venueFilter(scope, args.venue_id);
      const names = Object.fromEntries(scope.venues.map(v => [v.id, v.name]));
      const result = {};
      if (scope.can('maintenance:view')) {
        const tasks = await prisma.pending_tasks.findMany({
          where: { venue_id: venue, status: { notIn: ['completed', 'done', 'cancelled'] } },
          orderBy: [{ due_date: 'asc' }],
          take: 50
        });
        result.tasks = tasks.map(t => ({ title: t.title, venue: names[t.venue_id] || null, priority: t.priority, status: t.status, due: t.due_date ? isoDay(t.due_date) : null }));
      }
      if (scope.can('deposits:view')) {
        const deposits = await prisma.deposits.findMany({ where: { venue_id: venue, status: 'pending' }, take: 50 });
        const bookings = await describeBookings(await prisma.accommodations.findMany({ where: { id: { in: deposits.map(d => d.accommodation_id).filter(Boolean) } } }));
        const bm = Object.fromEntries(bookings.map(b => [b.id, b]));
        result.deposits_to_refund = deposits.map(d => ({
          amount: money(d.amount),
          booking: bm[d.accommodation_id] ? `${bm[d.accommodation_id].date} · ${bm[d.accommodation_id].venue} · ${bm[d.accommodation_id].customer || 'sin cliente'}` : null,
          past: bm[d.accommodation_id]?.date ? bm[d.accommodation_id].date < todayIso() : null
        }));
      }
      return Object.keys(result).length ? result : { error: 'Sin permiso para ver tareas ni depósitos.' };
    },

    async venue_info(args, scope) {
      if (!scope.venues.some(v => v.id === args.venue_id)) return { error: 'Cabaña no encontrada o sin acceso.' };
      const venue = await prisma.venues.findUnique({ where: { id: args.venue_id } });
      const [plans, methods] = await Promise.all([
        prisma.venue_plans.findMany({ where: { venue_id: venue.id, is_active: true }, orderBy: { adult_price: 'asc' } }),
        prisma.venue_payment_methods.findMany({ where: { venue_id: venue.id, is_active: true }, select: { method_type: true, label: true } })
      ]);
      return {
        venue: venue.name,
        plans: plans.map(p => ({
          id: p.id,
          name: p.name,
          adult: money(p.adult_price),
          child: money(p.child_price),
          people: `${p.min_guests || 1}–${p.max_capacity || '∞'}`,
          hours: [p.check_in_time, p.check_out_time].filter(Boolean).join(' a ') || null,
          food: p.includes_food ? (p.food_description || 'sí') : 'no'
        })),
        advance: venue.advance_percentage ? `${venue.advance_percentage}%` : '100% (sin anticipo configurado)',
        payment_methods: methods.map(m => `${m.label} (${m.method_type})`),
        booking_notices: {
          email: venue.notify_booking_email ? venue.notify_booking_emails : 'apagado',
          whatsapp: venue.notify_booking_whatsapp ? (venue.notify_booking_whatsapp_phone || 'WhatsApp de la cabaña') : 'apagado'
        },
        followup: venue.followup_enabled
          ? `desde las ${venue.followup_time}, tras ${venue.followup_min_idle_hours} h sin respuesta`
          : 'apagado',
        human_reply_pause_hours: venue.human_reply_pause_hours,
        edit_link: `/business/venues/${venue.id}/edit`
      };
    },

    async find_contacts(args, scope) {
      if (!scope.can('contacts:view')) return { error: 'Sin permiso para ver contactos.' };
      const q = String(args.query || '').trim();
      if (q.length < 2) return { error: 'Escribe al menos 2 caracteres.' };
      const digits = q.replace(/\D/g, '');
      // Same scope as the contacts screen: the user's organizations, plus the
      // customers of bookings in their venues (e.g. created by the chat).
      let allowedIds = null;
      if (scope.orgIds !== null) {
        const [linked, customers] = await Promise.all([
          prisma.contact_organization.findMany({ where: { organization: { in: scope.orgIds } }, select: { contact: true } }),
          prisma.accommodations.findMany({ where: { venue: { in: scope.venueIds }, customer: { not: null } }, select: { customer: true } })
        ]);
        allowedIds = [...new Set([...linked.map(l => l.contact), ...customers.map(c => c.customer)])];
      }
      const contacts = await prisma.contacts.findMany({
        where: {
          ...(allowedIds !== null && { id: { in: allowedIds } }),
          OR: [
            { fullname: { contains: q, mode: 'insensitive' } },
            { instagram: { contains: q.replace(/^@/, ''), mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            ...(digits.length >= 6 ? [{ whatsapp: { equals: Number(digits) } }] : [])
          ]
        },
        take: 10
      });
      const counts = await prisma.accommodations.groupBy({
        by: ['customer'],
        where: { customer: { in: contacts.map(c => c.id) }, venue: venueFilter(scope) },
        _count: { _all: true }
      });
      const cm = Object.fromEntries(counts.map(c => [c.customer, c._count._all]));
      return {
        contacts: contacts.map(c => ({
          id: c.id,
          name: c.fullname,
          whatsapp: c.whatsapp ? String(c.whatsapp) : null,
          instagram: c.instagram,
          email: c.email,
          bookings: cm[c.id] || 0,
          link: `/business/contacts/${c.id}`
        }))
      };
    },

    async get_context(args, scope) {
      const user = await prisma.users.findUnique({
        where: { id: scope.userId },
        select: { display_name: true, email: true, is_super_admin: true, profile: { select: { name: true } } }
      });
      const today = todayIso();
      return {
        now: new Date().toLocaleString('es-CO', { timeZone: TIMEZONE, dateStyle: 'full', timeStyle: 'short' }),
        today,
        next_days: Array.from({ length: 14 }, (_, i) => {
          const d = isoDay(new Date(new Date(`${today}T12:00:00Z`).getTime() + i * 86400000));
          return { date: d, label: dayLabel(d) };
        }),
        user: { name: user?.display_name || user?.email || null, profile: user?.profile?.name || (user?.is_super_admin ? 'superadmin' : null) },
        venues: scope.venues.map(v => ({ id: v.id, name: v.name })),
        can: {
          see_bookings: scope.can('accommodations:view'),
          see_money: hasPermission(scope.perms, 'payments:view'),
          create_bookings: hasPermission(scope.perms, 'accommodations:create'),
          record_payments: hasPermission(scope.perms, 'payments:create'),
          edit_bookings: scope.can('accommodations:edit')
        },
        notes: [
          'Montos en pesos colombianos (COP).',
          'Usa los labels de fechas tal cual: no calcules el día de la semana.',
          ...(scope.ownBookingsOnly ? ['Este usuario solo ve sus propios alquileres (o los que vendió como comisionista).'] : [])
        ]
      };
    },

    async create_quote(args, scope) {
      if (!hasPermission(scope.perms, 'accommodations:create')) return { error: 'Sin permiso para crear cotizaciones.' };
      const venue = scope.venues.find(v => v.id === args.venue_id);
      if (!venue) return { error: 'Cabaña no encontrada o sin acceso: usa un id de get_context.' };
      const date = validDay(args.date);
      if (!date) return { error: 'date debe ser YYYY-MM-DD.' };
      if (date < todayIso()) return { error: 'Esa fecha ya pasó.' };
      const plan = await findPlan(venue.id, args.plan_id);
      if (!plan) return { error: 'Plan no encontrado en esa cabaña: usa un id de venue_info.' };
      const { adults, children } = people(args);
      if (!adults) return { error: 'Indica cuántos adultos.' };
      const capacityError = checkCapacity(plan, adults + children);
      if (capacityError) return { error: capacityError };
      const name = String(args.customer_name || '').trim().slice(0, 255);
      if (!name) return { error: 'Indica el nombre del cliente.' };
      const whatsapp = cleanPhone(args.whatsapp);
      const instagram = cleanInstagram(args.instagram);
      const email = validEmail(args.email);
      const [contactType, contactValue] = whatsapp ? ['whatsapp', whatsapp] : instagram ? ['instagram', instagram] : email ? ['email', email] : [];
      if (!contactType) return { error: 'Indica un WhatsApp, Instagram o correo del cliente.' };
      const calculated = planPrice(plan, adults, children);
      const quote = await prisma.estimates.create({
        data: {
          venue_id: venue.id,
          plan_id: plan.id,
          customer_name: name,
          contact_type: contactType,
          contact_value: contactValue,
          contact_phone: whatsapp && contactType !== 'whatsapp' ? whatsapp : null,
          contact_email: email,
          check_in: new Date(`${date}T00:00:00.000Z`),
          check_out: new Date(`${date}T00:00:00.000Z`),
          adults,
          children,
          calculated_price: calculated,
          agreed_price: positive(args.agreed_price) ?? calculated,
          notes: agentNote(scope, args.notes),
          status: 'pending',
          created_by: scope.userId
        }
      });
      return {
        ok: true,
        quote_id: quote.id,
        venue: venue.name,
        date_label: dayLabel(date),
        plan: plan.name,
        total: money(quote.agreed_price),
        link: `/business/estimates/${quote.id}`
      };
    },

    async create_booking(args, scope) {
      if (!hasPermission(scope.perms, 'accommodations:create')) return { error: 'Sin permiso para crear alquileres.' };
      const venue = scope.venues.find(v => v.id === args.venue_id);
      if (!venue) return { error: 'Cabaña no encontrada o sin acceso: usa un id de get_context.' };
      const date = validDay(args.date);
      if (!date) return { error: 'date debe ser YYYY-MM-DD.' };
      if (date < todayIso()) return { error: 'Esa fecha ya pasó.' };
      const plan = await findPlan(venue.id, args.plan_id);
      if (!plan) return { error: 'Plan no encontrado en esa cabaña: usa un id de venue_info.' };
      const { adults, children } = people(args);
      if (!adults) return { error: 'Indica cuántos adultos.' };
      const capacityError = checkCapacity(plan, adults + children);
      if (capacityError) return { error: capacityError };
      const day = new Date(`${date}T00:00:00.000Z`);
      const { conflict } = await findBookingConflict(venue.id, day, day);
      if (conflict) return { error: `${dayLabel(date)} ya está ocupado en ${venue.name}.` };

      const customer = await resolveCustomer(args, scope, venue);
      if (customer.error) return customer;

      const calculated = planPrice(plan, adults, children);
      // Like the app: a user linked to a commission agent of the venue sells as that agent.
      const linkedAgent = await prisma.commission_agents.findFirst({
        where: { user_id: scope.userId, venue_id: venue.id, is_active: true }
      });
      const booking = await prisma.accommodations.create({
        data: {
          venue: venue.id,
          date: day,
          plan_id: plan.id,
          adults,
          children,
          customer: customer.id,
          calculated_price: calculated,
          agreed_price: positive(args.agreed_price) ?? calculated,
          created_by: scope.userId,
          ...(linkedAgent && { commission_agent_id: linkedAgent.id })
        }
      });
      const [summary] = await describeBookings([booking]);
      return { ok: true, booking: summary, customer_created: customer.created };
    },

    async record_payment(args, scope) {
      if (!hasPermission(scope.perms, 'payments:create')) return { error: 'Sin permiso para registrar pagos.' };
      const booking = await findBooking(args.booking_id, scope);
      if (!booking) return { error: 'Alquiler no encontrado o sin acceso.' };
      const amount = positive(args.amount);
      if (!amount || amount > 1e9) return { error: 'amount debe ser un monto mayor que cero.' };
      const method = String(args.method || '').trim().slice(0, 100);
      if (!method) return { error: 'Indica el método de pago.' };
      const date = args.date ? validDay(args.date) : todayIso();
      if (!date) return { error: 'date debe ser YYYY-MM-DD.' };
      const payment = await prisma.payments.create({
        data: {
          accommodation: booking.id,
          amount,
          payment_method: method,
          payment_date: new Date(`${date}T00:00:00.000Z`),
          reference: args.reference ? String(args.reference).slice(0, 255) : null,
          notes: agentNote(scope, args.notes),
          verified: false,
          created_by: scope.userId
        }
      });
      const [summary] = await describeBookings([booking]);
      return {
        ok: true,
        payment_id: payment.id,
        amount: money(amount),
        verified: false,
        note: 'Queda pendiente de verificar en la app; el saldo cambia cuando se verifique.',
        booking: summary
      };
    },

    async cancel_booking(args, scope) {
      const booking = await findBooking(args.booking_id, scope);
      const canEdit = booking && (hasPermission(scope.perms, 'accommodations:edit')
        || (hasPermission(scope.perms, 'accommodations:edit:own') && booking.created_by === scope.userId));
      if (!canEdit) return { error: 'Alquiler no encontrado o sin permiso para editarlo.' };
      const amount = Number(args.refund_amount);
      if (!Number.isFinite(amount) || amount < 0) return { error: 'refund_amount debe ser 0 o un monto positivo.' };
      const result = await cancelAccommodation(booking, {
        userId: scope.userId,
        note: agentNote(scope, args.reason),
        refund: { amount, method: args.refund_method, date: validDay(args.refund_date) }
      });
      if (result.error) return { error: result.error };
      return {
        ok: true,
        booking_id: booking.id,
        refund: amount > 0 ? money(amount) : 'sin devolución',
        note: 'Cancelado: la fecha quedó libre y la comisión pendiente se anuló.'
      };
    },

    async mark_no_show(args, scope) {
      const booking = await findBooking(args.booking_id, scope);
      const canEdit = booking && (hasPermission(scope.perms, 'accommodations:edit')
        || (hasPermission(scope.perms, 'accommodations:edit:own') && booking.created_by === scope.userId));
      if (!canEdit) return { error: 'Alquiler no encontrado o sin permiso para editarlo.' };
      if (booking.cancelled_at) return { error: 'Ese alquiler está cancelado.' };
      if (booking.no_show_at) return { error: 'Ya estaba marcado como "no asistió".' };
      if (booking.date && isoDay(booking.date) > todayIso()) return { error: 'Solo se puede marcar el día del alquiler o después.' };
      await prisma.accommodations.update({
        where: { id: booking.id },
        data: { no_show_at: new Date(), no_show_by: scope.userId, no_show_note: agentNote(scope, args.note) }
      });
      return { ok: true, booking_id: booking.id, note: 'Marcado como "no asistió". Los pagos se quedan como están.' };
    }
  };

  /** A booking the user may see, or null. */
  async function findBooking(id, scope) {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) return null;
    if (!scope.can('accommodations:view')) return null;
    return prisma.accommodations.findFirst({ where: bookingWhere(scope, { id, venue: venueFilter(scope) }) });
  }

  async function findPlan(venueId, planId) {
    if (!/^[0-9a-f-]{36}$/i.test(planId || '')) return null;
    return prisma.venue_plans.findFirst({ where: { id: planId, venue_id: venueId, is_active: true } });
  }

  /** The booking's customer: an existing contact the user can see, or a new one. */
  async function resolveCustomer(args, scope, venue) {
    if (args.customer_contact_id) {
      if (!/^[0-9a-f-]{36}$/i.test(args.customer_contact_id)) return { error: 'customer_contact_id no válido.' };
      const allowed = await contactAllowed(args.customer_contact_id, scope);
      return allowed ? { id: args.customer_contact_id, created: false } : { error: 'Contacto no encontrado o sin acceso.' };
    }
    const name = String(args.customer_name || '').trim().slice(0, 255);
    if (!name) return { id: null, created: false };
    const whatsapp = cleanPhone(args.whatsapp);
    const email = validEmail(args.email);
    if (whatsapp) {
      const existing = await prisma.contacts.findFirst({ where: { whatsapp: Number(whatsapp) } });
      if (existing && await contactAllowed(existing.id, scope)) return { id: existing.id, created: false };
    }
    if (!hasPermission(scope.perms, 'contacts:create')) return { error: 'Sin permiso para crear contactos: usa customer_contact_id.' };
    const contact = await prisma.contacts.create({
      data: { fullname: name, whatsapp: whatsapp ? Number(whatsapp) : null, email }
    });
    if (venue.organization) {
      await prisma.contact_organization.create({
        data: { contact: contact.id, organization: venue.organization, type: 'customer' }
      });
    }
    return { id: contact.id, created: true };
  }

  /** Same scope as find_contacts: the user's organizations and their venues' customers. */
  async function contactAllowed(contactId, scope) {
    if (scope.orgIds === null) return !!(await prisma.contacts.findUnique({ where: { id: contactId }, select: { id: true } }));
    const [linked, customer] = await Promise.all([
      prisma.contact_organization.findFirst({ where: { contact: contactId, organization: { in: scope.orgIds } } }),
      prisma.accommodations.findFirst({ where: { customer: contactId, venue: { in: scope.venueIds } }, select: { id: true } })
    ]);
    return !!(linked || customer);
  }

  return { tools, userScope, describeBookings };
}

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const people = (args) => ({
  adults: Math.max(0, Math.min(500, parseInt(args.adults, 10) || 0)),
  children: Math.max(0, Math.min(500, parseInt(args.children, 10) || 0))
});
const checkCapacity = (plan, total) => {
  if (plan.min_guests && total < plan.min_guests) return `El plan ${plan.name} es para mínimo ${plan.min_guests} personas.`;
  if (plan.max_capacity && total > plan.max_capacity) return `El plan ${plan.name} es para máximo ${plan.max_capacity} personas.`;
  return null;
};
const planPrice = (plan, adults, children) =>
  Math.round(Number(plan.adult_price || 0) * adults + Number(plan.child_price || 0) * children);
const validEmail = (v) => {
  const text = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 255 ? text : null;
};
// Changes made by an external agent are marked, so the team knows where they came from.
const agentNote = (scope, note) => {
  const text = String(note || '').trim().slice(0, 1000);
  if (!scope.agentKeyName) return text || null;
  return [text, `(Registrado por el agente de IA "${scope.agentKeyName}")`].filter(Boolean).join(' ');
};

module.exports = {
  DEFINITIONS,
  ASSISTANT_TOOLS: asFunctions(ASSISTANT_TOOLS),
  asFunctions,
  createAgentTools,
  TIMEZONE,
  todayIso,
  isoDay,
  dayLabel
};

