/**
 * In-app assistant for the team: answers questions about bookings, money,
 * chats, commissions and settings with read-only tools that apply the signed-in
 * user's permissions, and can open a screen of the app for them (navigate).
 *
 * POST /api/assistant/chat { messages: [{ role, content }], context: { path } }
 *   -> { reply, actions: [{ type: 'navigate', path, label }] }
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

// Screens the assistant can open, with the URL filters each one understands.
const ROUTES = `
- /next?venues=<id,id> — próximos alquileres (tarjetas por fecha)
- /business/accommodations?view=calendar|list — hospedajes en calendario o lista
- /business/accommodations/<id>?tab=resumen|pagos|deposito|contrato|comisiones|mensajes — detalle de un alquiler
- /business/payments?status=verified|pending&method=<texto>&from=YYYY-MM-DD&to=YYYY-MM-DD&q=<texto>&basis=cash|accrual — ingresos
- /business/payments/online?view=open|review|paid|closed|all&from=&to=&q= — pagos en línea (Bold)
- /business/expenses?venue_id=&category_id=&from=&to=&q= — egresos
- /business/deposits?status=pending|refunded|claimed&venue_id=&q= — depósitos
- /business/estimates?status=pending|converted&venue_id=&q= — cotizaciones
- /business/commissions/payments?agent_id=&status=pending|paid&venue_id=&q= — pagos a comisionistas
- /business/commissions/agents — comisionistas
- /business/contacts y /business/contacts/<id> — contactos
- /business/venues/<id>?tab=informacion|ubicacion|galeria — detalle de una cabaña; /business/venues/<id>/edit — configuración (anticipo, avisos, seguimiento)
- /business/venues/<id>/plans — planes y precios; /business/venues/<id>/payment-methods — métodos de pago
- /venues/<id>/chat?channel=all|whatsapp|instagram|web&q=&conversation_id=<id> — chat de la cabaña
- /business/pending-tasks, /business/maintenance, /business/inventory — tareas, mantenimiento, inventario
- /dashboard — análisis de hospedajes; /analytics — análisis financiero; /settings — configuración personal`;

// Query params each screen understands (anything else is dropped from navigate).
const ROUTE_PARAMS = [
  [/^\/next$/, ['venues']],
  [/^\/business\/accommodations$/, ['view']],
  [/^\/business\/accommodations\/[0-9a-f-]{36}$/, ['tab']],
  [/^\/business\/payments$/, ['status', 'method', 'from', 'to', 'q', 'basis']],
  [/^\/business\/payments\/online$/, ['view', 'from', 'to', 'q']],
  [/^\/business\/expenses$/, ['venue_id', 'category_id', 'from', 'to', 'q']],
  [/^\/business\/deposits$/, ['status', 'venue_id', 'q']],
  [/^\/business\/estimates$/, ['status', 'venue_id', 'q']],
  [/^\/business\/commissions\/payments$/, ['agent_id', 'status', 'venue_id', 'q']],
  [/^\/business\/venues\/[0-9a-f-]{36}$/, ['tab']],
  [/^\/venues\/[0-9a-f-]{36}\/chat$/, ['channel', 'q', 'conversation_id']],
  [/^\/(business\/(commissions\/agents|contacts(\/[0-9a-f-]{36})?|estimates\/[0-9a-f-]{36}|venues\/[0-9a-f-]{36}\/(edit|plans|payment-methods)|pending-tasks|maintenance|inventory)|dashboard|analytics|settings)$/, []]
];

/** A known screen with only the filters it supports, or null. */
function cleanRoute(raw) {
  const [pathname, search = ''] = String(raw || '').split('?');
  const known = ROUTE_PARAMS.find(([re]) => re.test(pathname));
  if (!known) return null;
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) if (known[1].includes(key) && value) kept.set(key, value);
  const query = kept.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const TOOLS = [
  {
    name: 'list_bookings',
    description: 'Lista alquileres (hospedajes) con fecha, cabaña, cliente, personas, plan, total, pagado, saldo, estado del contrato y si no asistió.',
    properties: {
      from: { type: 'string', description: 'Desde (YYYY-MM-DD). Por defecto hoy.' },
      to: { type: 'string', description: 'Hasta (YYYY-MM-DD). Por defecto 60 días después de from.' },
      venue_id: { type: 'string', description: 'Solo esta cabaña.' },
      only: { type: 'string', enum: ['all', 'with_balance', 'unsigned_contract', 'no_show'], description: 'Filtro: con saldo pendiente, contrato sin firmar o no asistieron.' },
      customer: { type: 'string', description: 'Parte del nombre del cliente.' }
    }
  },
  {
    name: 'get_booking',
    description: 'Detalle completo de un alquiler: cliente y contacto, plan, personas, precios, pagos, depósito, contrato y otrosíes, comisionista, no asistencia.',
    properties: { booking_id: { type: 'string', description: 'ID del alquiler (de list_bookings).' } },
    required: ['booking_id']
  },
  {
    name: 'check_dates',
    description: 'Qué fechas están libres u ocupadas en las cabañas.',
    properties: {
      dates: { type: 'array', items: { type: 'string' }, description: 'Fechas YYYY-MM-DD a revisar.' },
      venue_id: { type: 'string', description: 'Solo esta cabaña (si no, todas).' }
    },
    required: ['dates']
  },
  {
    name: 'money_summary',
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
    description: 'Comisiones de comisionistas: cuánto se le debe a cada uno (pendientes) y lo pagado, con sus alquileres.',
    properties: {
      status: { type: 'string', enum: ['pending', 'paid', 'all'], description: 'Por defecto pending.' },
      agent: { type: 'string', description: 'Parte del nombre del comisionista.' }
    }
  },
  {
    name: 'chats_needing_attention',
    description: 'Conversaciones con clientes que necesitan a alguien del equipo: escaladas o pausadas, y mensajes del cliente sin respuesta.',
    properties: { venue_id: { type: 'string', description: 'Solo esta cabaña.' } }
  },
  {
    name: 'open_quotes',
    description: 'Cotizaciones pendientes (clientes que cotizaron y no han pagado), con el link de pago enviado o no.',
    properties: { venue_id: { type: 'string' } }
  },
  {
    name: 'pending_work',
    description: 'Trabajo pendiente del equipo: tareas de mantenimiento abiertas y depósitos por devolver.',
    properties: { venue_id: { type: 'string' } }
  },
  {
    name: 'venue_info',
    description: 'Configuración de una cabaña: planes con precios, horarios y comida; anticipo; métodos de pago; avisos de alquiler; mensaje de seguimiento.',
    properties: { venue_id: { type: 'string' } },
    required: ['venue_id']
  },
  {
    name: 'find_contacts',
    description: 'Busca contactos (clientes) por nombre, teléfono, Instagram o correo, con cuántos alquileres tiene.',
    properties: { query: { type: 'string' } },
    required: ['query']
  },
  {
    name: 'navigate',
    description: 'Muestra un botón para ir a una pantalla de la app (ver la lista de rutas del sistema). Con open=true la app además la abre de inmediato.',
    properties: {
      path: { type: 'string', description: 'Ruta de la app con sus filtros, ej: /business/payments?status=pending&from=2026-10-01' },
      label: { type: 'string', description: 'Texto corto del botón, ej: "Ver ingresos pendientes"' },
      open: { type: 'boolean', description: 'true solo si el usuario pidió ver, abrir o ir a esa pantalla. false para ofrecerla como botón.' }
    },
    required: ['path', 'label']
  }
].map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: { type: 'object', properties: t.properties, ...(t.required && { required: t.required }) }
  }
}));

module.exports = function registerAssistantRoutes(app, deps) {
  const {
    prisma, llmService, isAuthenticated, hasPermission, hasOwnOnly,
    getAccessibleVenueIds, getAgentAccommodationIds, logAICall
  } = deps;

  /** What this user may see, resolved once per request. */
  async function userScope(req) {
    const userId = String(req.user.claims?.sub || req.user.id || '');
    const perms = req.userPermissions;
    const venueIds = await getAccessibleVenueIds(perms); // null = all
    const venues = await prisma.venues.findMany({
      where: venueIds === null ? {} : { id: { in: venueIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    const can = (p) => hasPermission(perms, p) || hasPermission(perms, `${p}:own`);
    const ownBookingsOnly = hasOwnOnly(perms, 'accommodations:view');
    const agentBookingIds = ownBookingsOnly ? await getAgentAccommodationIds(userId) : new Set();
    return { userId, perms, venueIds, venues, can, ownBookingsOnly, agentBookingIds };
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
        no_show_note: acc.no_show_note || null
      };
    },

    async check_dates(args, scope) {
      if (!scope.can('accommodations:view')) return { error: 'Sin permiso para ver alquileres.' };
      const dates = (Array.isArray(args.dates) ? args.dates : []).map(validDay).filter(Boolean).slice(0, 31);
      if (!dates.length) return { error: 'Indica las fechas en formato YYYY-MM-DD.' };
      const venues = scope.venues.filter(v => !args.venue_id || v.id === args.venue_id);
      const booked = await prisma.accommodations.findMany({
        where: { venue: { in: venues.map(v => v.id) }, date: { in: dates.map(d => new Date(`${d}T00:00:00.000Z`)) } },
        select: { venue: true, date: true }
      });
      const taken = new Set(booked.map(b => `${b.venue}|${isoDay(b.date)}`));
      return {
        venues: venues.map(v => ({
          venue: v.name,
          venue_id: v.id,
          free: dates.filter(d => !taken.has(`${v.id}|${d}`)).map(dayLabel),
          booked: dates.filter(d => taken.has(`${v.id}|${d}`)).map(dayLabel)
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
        where: { venue, date: { gte: new Date(`${todayIso()}T00:00:00.000Z`) }, no_show_at: null },
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
        where: canAll ? {} : { user_id: scope.userId },
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
      const contacts = await prisma.contacts.findMany({
        where: {
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
          name: c.fullname,
          whatsapp: c.whatsapp ? String(c.whatsapp) : null,
          instagram: c.instagram,
          email: c.email,
          bookings: cm[c.id] || 0,
          link: `/business/contacts/${c.id}`
        }))
      };
    }
  };

  function systemPrompt(scope, req, context) {
    const now = new Date().toLocaleString('es-CO', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const user = req.assistantUser;
    return `Eres el asistente interno de CabanIA, una app para administrar cabañas de alquiler (pasadías, eventos, hospedaje). Hablas con ${user?.display_name || user?.email || 'un usuario'} (perfil: ${user?.profile?.name || (user?.is_super_admin ? 'superadmin' : 'sin perfil')}), del equipo que administra las cabañas. No es un huésped.

Ahora: ${now} (hora de Colombia). Hoy es ${todayIso()}.
Próximos días: ${Array.from({ length: 10 }, (_, i) => { const d = isoDay(new Date(Date.now() + i * 86400000 - 5 * 3600000)); return `${dayLabel(d)} = ${d}`; }).join('; ')}.
Pantalla donde está el usuario: ${context?.path || 'desconocida'}.
Cabañas a las que tiene acceso (nombre → id):
${scope.venues.map(v => `- ${v.name} → ${v.id}`).join('\n') || '- ninguna'}
${scope.ownBookingsOnly ? '\nEste usuario solo ve sus propios alquileres (o los que vendió como comisionista).' : ''}

CÓMO RESPONDER:
- Usa las herramientas para cualquier dato; nunca inventes cifras, fechas ni nombres. Si una herramienta dice que no hay permiso, díselo sin rodeos.
- Responde en español, tratando al usuario de tú ("recibiste", "tienes"), breve y al grano: primero la respuesta, luego el detalle en una lista corta. Montos como $1.234.567.
- Para fechas usa date_label (o las fechas ya escritas que devuelven las herramientas) tal cual: no calcules el día de la semana por tu cuenta.
- Resuelve fechas relativas ("este fin de semana", "el mes pasado") con la fecha de hoy.
- Si el usuario pide ver, abrir o ir a algo, llama navigate con open=true (la app lo lleva ahí).
- Si tu respuesta resume una lista o un alquiler, llama navigate con open=false para dejarle el botón a la pantalla completa (con los filtros que correspondan).
- Los botones SOLO existen si llamas navigate: nunca escribas links, rutas ni frases como "ver aquí:" o "ver lista completa:" en el texto.
- Usa solo las rutas y filtros de la lista. Si ninguna pantalla filtra lo que pidió (ej. "reservas con saldo"), responde con la lista en el texto y no llames navigate.
- Siempre responde con texto: navigate complementa tu respuesta, no la reemplaza.
- Si está dentro de un alquiler (/business/accommodations/<id>) y pregunta por "este alquiler", usa ese id.
- No puedes modificar datos todavía: si te piden un cambio, explica dónde hacerlo y abre esa pantalla con navigate.

PANTALLAS QUE PUEDES ABRIR (navigate):${ROUTES}`;
  }

  // POST /api/assistant/chat
  app.post('/api/assistant/chat', isAuthenticated, async (req, res) => {
    const started = Date.now();
    try {
      const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const history = incoming
        .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
      if (!history.length || history[history.length - 1].role !== 'user') {
        return res.status(400).json({ error: 'Falta el mensaje del usuario' });
      }
      const scope = await userScope(req);
      req.assistantUser = await prisma.users.findUnique({
        where: { id: scope.userId },
        select: { display_name: true, email: true, is_super_admin: true, profile: { select: { name: true } } }
      });

      const setting = await prisma.ai_settings.findUnique({ where: { setting_key: 'internal_assistant' } })
        || await prisma.ai_settings.findUnique({ where: { setting_key: 'customer_chat' } });
      const providerCode = setting?.provider_code || 'anthropic_claude';
      const config = llmService.getModelConfig(providerCode);
      if (!config) return res.status(500).json({ error: 'Modelo de IA no configurado' });
      const isAnthropic = config.provider === 'anthropic';

      const system = systemPrompt(scope, req, req.body?.context);
      const messages = [{ role: 'system', content: system }, ...history];
      const actions = [];
      const call = () => llmService.callLLMByCode(providerCode, messages, {
        model: setting?.model || undefined, tools: TOOLS, maxTokens: 1500, temperature: 0.3
      });

      let response = await call();
      let inputTokens = response.usage?.prompt_tokens || response.usage?.input_tokens || 0;
      let outputTokens = response.usage?.completion_tokens || response.usage?.output_tokens || 0;
      const toolsUsed = [];
      for (let round = 0; response.tool_calls?.length && round < MAX_TOOL_ROUNDS; round++) {
        const results = [];
        for (const tc of response.tool_calls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* keep {} */ }
          let result;
          if (tc.function.name === 'navigate') {
            const path = cleanRoute(args.path);
            if (path) {
              actions.push({ type: 'navigate', path, label: String(args.label || 'Abrir').slice(0, 60), open: args.open === true });
              result = { ok: true, path, note: path !== args.path ? 'Se quitaron filtros que esa pantalla no soporta.' : undefined };
            } else {
              result = { error: 'Esa pantalla no existe: usa solo las rutas de la lista del sistema.' };
            }
          } else if (tools[tc.function.name]) {
            try {
              result = await tools[tc.function.name](args, scope);
            } catch (err) {
              console.error('[assistant] Tool failed', { tool: tc.function.name, error: err.message });
              result = { error: 'No se pudo consultar ese dato en este momento.' };
            }
          } else {
            result = { error: 'Herramienta desconocida' };
          }
          toolsUsed.push(tc.function.name);
          results.push({ tc, args, content: JSON.stringify(result) });
        }
        if (isAnthropic) {
          messages.push({
            role: 'assistant',
            content: [
              ...(response.content ? [{ type: 'text', text: response.content }] : []),
              ...results.map(r => ({ type: 'tool_use', id: r.tc.id, name: r.tc.function.name, input: r.args }))
            ]
          });
          messages.push({ role: 'user', content: results.map(r => ({ type: 'tool_result', tool_use_id: r.tc.id, content: r.content })) });
        } else {
          messages.push({ role: 'assistant', content: response.content || null, tool_calls: response.tool_calls });
          for (const r of results) messages.push({ role: 'tool', tool_call_id: r.tc.id, content: r.content });
        }
        response = await call();
        inputTokens += response.usage?.prompt_tokens || response.usage?.input_tokens || 0;
        outputTokens += response.usage?.completion_tokens || response.usage?.output_tokens || 0;
      }

      // The model sometimes answers only with a navigate: ask for the words too.
      if (!(response.content || '').trim() && toolsUsed.some(t => t !== 'navigate')) {
        messages.push({ role: 'user', content: '[Sistema] Responde ahora al usuario con texto, usando los datos que ya consultaste.' });
        response = await llmService.callLLMByCode(providerCode, messages, { model: setting?.model || undefined, maxTokens: 1500, temperature: 0.3 });
      }
      const reply = (response.content || '').trim()
        || (actions.some(a => a.open) ? 'Listo, te lo abrí.' : 'No pude armar una respuesta. ¿Me lo preguntas de otra forma?');
      logAICall({
        feature: 'internal_assistant',
        provider_code: providerCode,
        model: response.model || setting?.model || providerCode,
        system_prompt: system,
        user_prompt: history[history.length - 1].content,
        response_content: reply,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        response_time_ms: Date.now() - started,
        user_id: scope.userId,
        metadata: { tools_used: toolsUsed, path: req.body?.context?.path || null }
      });
      res.json({ reply, actions });
    } catch (error) {
      console.error('[assistant] Chat failed', error);
      res.status(500).json({ error: 'El asistente no está disponible en este momento' });
    }
  });
};
