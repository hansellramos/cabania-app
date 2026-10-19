/**
 * Tools over CabanIA's data that apply a user's permissions and organizations.
 * Shared by the in-app assistant (server/assistant.js) and the API for external
 * AI agents (server/agent-api.js: REST, OpenAPI and MCP).
 *
 * Each definition says how it is exposed over REST (http.method + http.path,
 * relative to /api/agent/v1). Tools with write: true change data and are only
 * offered to agent keys that allow changes.
 */

const analytics = require('./lib/analytics');
const modules = require('./modules');
const recurringSchedule = require('./services/recurringExpenses');

const TIMEZONE = 'America/Bogota';
const MAX_TOOL_ROUNDS = 6;

const moduleOff = (key) => `El módulo ${modules.moduleName(key)} está desactivado en esta organización.`;
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
    description: 'Detalle completo de un alquiler: cliente y contacto, plan, personas, precios, pagos, depósito, contrato y otrosíes, comisionista, no asistencia. Incluye la ganancia del alquiler (ingresos menos gastos, comisión y comisiones de pago) si el usuario puede verla.',
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
    description: 'Trabajo pendiente del equipo: tareas de mantenimiento abiertas, depósitos por devolver y egresos recurrentes vencidos o por pagar (ej: el cuidandero de este mes sin registrar).',
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
      agreed_price: { type: 'number', description: 'Precio acordado total, si es distinto al del plan.' },
      start_time: { type: 'string', description: 'Hora de llegada HH:MM en 24 h (ej: 19:30). Por defecto la del plan.' },
      end_time: { type: 'string', description: 'Hora de salida HH:MM en 24 h (ej: 00:00 = medianoche). Si es menor o igual a la de llegada, es del día siguiente. Por defecto la del plan.' },
      commission_agent: { type: 'string', description: 'Comisionista que vendió el alquiler: su id o su nombre (de commissions). Se registra su comisión pendiente según sus reglas.' }
    },
    required: ['venue_id', 'date', 'plan_id', 'adults']
  },
  {
    name: 'update_booking',
    write: true,
    http: { method: 'PATCH', path: '/bookings/{booking_id}' },
    description: 'Corrige un alquiler: horario, comisionista, personas, precio acordado, plan o fecha. Solo cambia los campos que envíes.',
    properties: {
      booking_id: { type: 'string', description: 'ID del alquiler.' },
      date: { type: 'string', description: 'Nueva fecha (YYYY-MM-DD); debe estar libre.' },
      start_time: { type: 'string', description: 'Hora de llegada HH:MM (24 h).' },
      end_time: { type: 'string', description: 'Hora de salida HH:MM (24 h); menor o igual a la llegada = día siguiente.' },
      plan_id: { type: 'string', description: 'ID del plan (de venue_info).' },
      adults: { type: 'integer', description: 'Adultos.' },
      children: { type: 'integer', description: 'Niños.' },
      agreed_price: { type: 'number', description: 'Precio acordado total.' },
      commission_agent: { type: 'string', description: 'Comisionista (id o nombre). "ninguno" para quitarlo.' }
    },
    required: ['booking_id']
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
  },
  {
    name: 'list_notifications',
    http: { method: 'GET', path: '/notifications' },
    description: 'Notificaciones del usuario (la campana de la app): alquileres nuevos, pagos, contratos firmados, recordatorios, egresos recurrentes vencidos… Por defecto las no leídas.',
    properties: {
      include_read: { type: 'boolean', description: 'Incluir también las ya leídas.' },
      limit: { type: 'integer', description: 'Cuántas (máximo 50, por defecto 20).' }
    }
  },
  {
    name: 'mark_notifications_read',
    write: true,
    http: { method: 'POST', path: '/notifications/read' },
    description: 'Marca notificaciones como leídas: las indicadas en notification_ids, o todas con all=true.',
    properties: {
      notification_ids: { type: 'array', items: { type: 'string' }, description: 'IDs de list_notifications.' },
      all: { type: 'boolean', description: 'Marcar todas las no leídas.' }
    }
  },
  {
    name: 'list_expenses',
    http: { method: 'GET', path: '/expenses' },
    description: 'Egresos (gastos) registrados en un período: monto, categoría, descripción, proveedor, alquiler asociado y si pagan un egreso recurrente. Incluye el total por categoría y las categorías disponibles.',
    properties: {
      from: { type: 'string', description: 'Desde (YYYY-MM-DD). Por defecto hace 30 días.' },
      to: { type: 'string', description: 'Hasta (YYYY-MM-DD). Por defecto hoy.' },
      venue_id: { type: 'string', description: 'Solo esta cabaña.' },
      booking_id: { type: 'string', description: 'Solo los gastos de este alquiler (ignora las fechas).' },
      category: { type: 'string', description: 'Solo esta categoría (nombre).' },
      search: { type: 'string', description: 'Texto en la descripción, notas o proveedor.' },
      recurring: { type: 'string', enum: ['only', 'none'], description: '"only": solo los que pagan un egreso recurrente; "none": solo los que no.' }
    }
  },
  {
    name: 'recurring_expenses',
    http: { method: 'GET', path: '/recurring-expenses' },
    description: 'Egresos recurrentes configurados (cuidandero, servicios, internet…): frecuencia, monto esperado, estado del período actual (vencido, pendiente, registrado, omitido…), períodos sin registrar y próxima fecha.',
    properties: {
      venue_id: { type: 'string', description: 'Solo esta cabaña.' },
      only_pending: { type: 'boolean', description: 'Solo los vencidos o por pagar pronto.' }
    }
  },
  {
    name: 'record_expense',
    write: true,
    http: { method: 'POST', path: '/expenses' },
    description: 'Registra un egreso (gasto) de una cabaña o de un alquiler (booking_id: aseo, comida, decoración… cuentan en la ganancia de ese alquiler). Si paga un egreso recurrente, pasa recurring_expense_id (y period si no es el más cercano a la fecha).',
    properties: {
      amount: { type: 'number', description: 'Monto en pesos colombianos.' },
      category: { type: 'string', description: 'Categoría (nombre, ej: Limpieza, Alimentación, Nómina). Ver list_expenses.' },
      description: { type: 'string', description: 'Qué se pagó.' },
      booking_id: { type: 'string', description: 'Alquiler al que pertenece el gasto (la cabaña sale del alquiler).' },
      venue_id: { type: 'string', description: 'Cabaña, si el gasto no es de un alquiler.' },
      date: { type: 'string', description: 'Fecha del gasto (YYYY-MM-DD). Por defecto hoy.' },
      payment_method: { type: 'string', description: 'Cómo se pagó: Efectivo, Transferencia, Nequi…' },
      provider: { type: 'string', description: 'Proveedor (nombre de uno existente).' },
      reference: { type: 'string', description: 'Referencia o número de factura.' },
      notes: { type: 'string', description: 'Notas.' },
      recurring_expense_id: { type: 'string', description: 'Egreso recurrente que paga (de recurring_expenses).' },
      period: { type: 'string', description: 'Fecha del período que paga (YYYY-MM-DD, de recurring_expenses).' }
    },
    required: ['amount', 'category', 'description']
  },
  {
    name: 'update_expense',
    write: true,
    http: { method: 'PATCH', path: '/expenses/{expense_id}' },
    description: 'Corrige un egreso: monto, categoría, descripción, fecha, alquiler asociado, o lo vincula/desvincula de un egreso recurrente. Solo cambia lo que envíes.',
    properties: {
      expense_id: { type: 'string', description: 'ID del egreso (de list_expenses).' },
      amount: { type: 'number', description: 'Monto.' },
      category: { type: 'string', description: 'Categoría (nombre).' },
      description: { type: 'string', description: 'Descripción.' },
      date: { type: 'string', description: 'Fecha (YYYY-MM-DD).' },
      booking_id: { type: 'string', description: 'Alquiler al que pertenece; "ninguno" para quitarlo.' },
      recurring_expense_id: { type: 'string', description: 'Egreso recurrente que paga; "ninguno" para que deje de contar como pago recurrente.' },
      period: { type: 'string', description: 'Período del recurrente que paga (YYYY-MM-DD).' }
    },
    required: ['expense_id']
  },
  {
    name: 'create_recurring_expense',
    write: true,
    http: { method: 'POST', path: '/recurring-expenses' },
    description: 'Configura un egreso recurrente (se repite cada semana, quincena, mes, dos meses o año) para avisar cuando no se registre. Con from_expense_id toma la cabaña, categoría, monto y fecha de un egreso ya registrado y lo vincula como el pago de ese período.',
    properties: {
      from_expense_id: { type: 'string', description: 'Egreso existente que se repite (de list_expenses).' },
      name: { type: 'string', description: 'Nombre (ej: "Cuidandero", "Internet"). Por defecto la descripción del egreso.' },
      frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'bimonthly', 'yearly'], description: 'Semanal, quincenal (días 15 y último), mensual, bimestral o anual.' },
      due_day: { type: 'integer', description: 'Día de pago: del mes (1–31) o de la semana (1 = lunes … 7 = domingo). Por defecto el de start_date.' },
      expected_amount: { type: 'number', description: 'Monto esperado.' },
      category: { type: 'string', description: 'Categoría (nombre).' },
      venue_id: { type: 'string', description: 'Cabaña (si no viene de un egreso).' },
      start_date: { type: 'string', description: 'Desde cuándo (YYYY-MM-DD). Por defecto la fecha del egreso o hoy.' },
      end_date: { type: 'string', description: 'Hasta cuándo, si termina (YYYY-MM-DD).' },
      payment_method: { type: 'string', description: 'Cómo se paga normalmente.' },
      description: { type: 'string', description: 'Notas.' }
    },
    required: ['frequency']
  },
  {
    name: 'update_recurring_expense',
    write: true,
    http: { method: 'PATCH', path: '/recurring-expenses/{recurring_expense_id}' },
    description: 'Cambia un egreso recurrente: monto, día, frecuencia, nombre; active=false para que deje de ser recurrente (los gastos ya registrados se conservan); skip_period para marcar que un período no aplica, unskip_period para deshacerlo.',
    properties: {
      recurring_expense_id: { type: 'string', description: 'ID (de recurring_expenses).' },
      name: { type: 'string', description: 'Nombre.' },
      frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'bimonthly', 'yearly'], description: 'Frecuencia.' },
      due_day: { type: 'integer', description: 'Día de pago.' },
      expected_amount: { type: 'number', description: 'Monto esperado.' },
      category: { type: 'string', description: 'Categoría (nombre).' },
      end_date: { type: 'string', description: 'Hasta cuándo (YYYY-MM-DD); "ninguna" para quitarla.' },
      payment_method: { type: 'string', description: 'Cómo se paga.' },
      active: { type: 'boolean', description: 'false = deja de ser recurrente (no avisa más); true = lo reactiva.' },
      skip_period: { type: 'string', description: 'Período (YYYY-MM-DD) que no se paga ni se debe.' },
      unskip_period: { type: 'string', description: 'Deshacer un período omitido.' }
    },
    required: ['recurring_expense_id']
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
    findBookingConflict, cleanPhone, cleanInstagram, cancelAccommodation, computeCommission,
    notify, notifier, computeBookingProfit, canViewProfits,
    withRecurringStatus, applyRecurringLink, recurringExpenseData, bogotaNow
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
    // Módulos opcionales: encendido si lo está en alguna de sus organizaciones.
    const enabledModules = perms?.isSuperAdmin ? modules.MODULE_KEYS : await modules.enabledModulesFor(orgIds);
    const moduleOn = (key) => enabledModules.includes(key);
    return { userId, perms, venueIds, orgIds, venues, can, ownBookingsOnly, agentBookingIds, moduleOn };
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
        hours: hoursLabel(a),
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
        cancel_note: acc.cancel_note || null,
        profit: await bookingProfit(acc, scope)
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
      if (!scope.moduleOn('commissions')) return { error: moduleOff('commissions') };
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
      if (!scope.moduleOn('estimates')) return { error: moduleOff('estimates') };
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
      if (scope.can('maintenance:view') && scope.moduleOn('pending_tasks')) {
        const tasks = await prisma.pending_tasks.findMany({
          where: { venue_id: venue, status: { notIn: ['completed', 'done', 'cancelled'] } },
          orderBy: [{ due_date: 'asc' }],
          take: 50
        });
        result.tasks = tasks.map(t => ({ title: t.title, venue: names[t.venue_id] || null, priority: t.priority, status: t.status, due: t.due_date ? isoDay(t.due_date) : null }));
      }
      if (scope.can('deposits:view') && scope.moduleOn('deposits')) {
        const deposits = await prisma.deposits.findMany({ where: { venue_id: venue, status: 'pending' }, take: 50 });
        const bookings = await describeBookings(await prisma.accommodations.findMany({ where: { id: { in: deposits.map(d => d.accommodation_id).filter(Boolean) } } }));
        const bm = Object.fromEntries(bookings.map(b => [b.id, b]));
        result.deposits_to_refund = deposits.map(d => ({
          amount: money(d.amount),
          booking: bm[d.accommodation_id] ? `${bm[d.accommodation_id].date} · ${bm[d.accommodation_id].venue} · ${bm[d.accommodation_id].customer || 'sin cliente'}` : null,
          past: bm[d.accommodation_id]?.date ? bm[d.accommodation_id].date < todayIso() : null
        }));
      }
      if (canExpenses(scope) && withRecurringStatus) {
        const defs = await prisma.recurring_expenses.findMany({ where: { venue_id: venue, is_active: true } });
        const due = (await withRecurringStatus(defs, bogotaNow().date)).filter(r => r.status === 'vencido' || r.status === 'pendiente');
        result.recurring_expenses_due = due.map(r => ({
          recurring_expense_id: r.id,
          name: r.name,
          venue: names[r.venue_id] || null,
          status: r.status === 'vencido' ? 'vencido (sin registrar)' : 'por pagar pronto',
          period: r.current_period,
          overdue_periods: r.overdue_periods,
          expected: r.expected_amount != null ? money(r.expected_amount) : null
        }));
      }
      return Object.keys(result).length ? result : { error: 'Sin permiso para ver tareas, depósitos ni egresos.' };
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
        booking_notices: await describeBookingNotices(venue),
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
          edit_bookings: scope.can('accommodations:edit'),
          see_booking_profit: !!canViewProfits?.(scope.perms),
          manage_expenses: canExpenses(scope)
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
      if (!await modules.isModuleEnabledForOrg(venue.organization, 'estimates')) return { error: moduleOff('estimates') };
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
      analytics.track('quote_created', {
        userId: scope.userId,
        venueId: venue.id,
        properties: { source: toolSource(scope), channel: contactType, total_bucket: analytics.amountBucket(quote.agreed_price) },
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

      const schedule = scheduleFrom(args.start_time || plan.check_in_time, args.end_time || plan.check_out_time);
      if (schedule.error) return schedule;

      // Named agent, or like the app: a user linked to an agent of the venue sells as that agent.
      // Sin el módulo de comisiones el alquiler queda sin comisionista.
      let agent = null;
      const commissionsOn = await modules.isModuleEnabledForOrg(venue.organization, 'commissions');
      if (commissionsOn && args.commission_agent) {
        agent = await findCommissionAgent(args.commission_agent, venue);
        if (agent.error) return agent;
      } else if (commissionsOn) {
        agent = await prisma.commission_agents.findFirst({
          where: { user_id: scope.userId, venue_id: venue.id, is_active: true }
        });
      }

      const customer = await resolveCustomer(args, scope, venue);
      if (customer.error) return customer;

      const calculated = planPrice(plan, adults, children);
      const booking = await prisma.accommodations.create({
        data: {
          venue: venue.id,
          date: day,
          ...schedule.data,
          plan_id: plan.id,
          adults,
          children,
          customer: customer.id,
          calculated_price: calculated,
          agreed_price: positive(args.agreed_price) ?? calculated,
          created_by: scope.userId,
          ...(agent && { commission_agent_id: agent.id })
        }
      });
      analytics.track('booking_created', {
        userId: scope.userId,
        venueId: venue.id,
        properties: {
          source: toolSource(scope),
          plan_type: plan.plan_type || null,
          adults_bucket: analytics.countBucket(adults + children),
          total_bucket: analytics.amountBucket(booking.agreed_price),
          has_agent: !!agent,
        },
      });
      const commission = agent ? await recordCommission(booking, agent, plan, scope) : null;
      // The team hears about it (except whoever asked the agent for it).
      notify?.('booking_created_ai', {
        organizationId: venue.organization,
        venueId: venue.id,
        data: { accommodationId: booking.id, channel: scope.agentKeyName ? 'api' : 'assistant' },
        excludeUserIds: [scope.userId]
      });
      const [summary] = await describeBookings([booking]);
      return { ok: true, booking: summary, customer_created: customer.created, commission };
    },

    async update_booking(args, scope) {
      const booking = await findBooking(args.booking_id, scope);
      const canEdit = booking && (hasPermission(scope.perms, 'accommodations:edit')
        || (hasPermission(scope.perms, 'accommodations:edit:own') && booking.created_by === scope.userId));
      if (!canEdit) return { error: 'Alquiler no encontrado o sin permiso para editarlo.' };
      if (booking.cancelled_at) return { error: 'Ese alquiler está cancelado.' };
      const venue = scope.venues.find(v => v.id === booking.venue) || { id: booking.venue, name: 'la cabaña' };
      const data = {};
      const changed = [];

      if (args.date !== undefined) {
        const date = validDay(args.date);
        if (!date) return { error: 'date debe ser YYYY-MM-DD.' };
        if (date < todayIso()) return { error: 'Esa fecha ya pasó.' };
        const day = new Date(`${date}T00:00:00.000Z`);
        const { conflict } = await findBookingConflict(booking.venue, day, day);
        if (conflict && conflict.id !== booking.id) return { error: `${dayLabel(date)} ya está ocupado en ${venue.name}.` };
        data.date = day;
        changed.push('fecha');
      }
      let plan = booking.plan_id ? await prisma.venue_plans.findUnique({ where: { id: booking.plan_id } }) : null;
      if (args.plan_id !== undefined) {
        plan = await findPlan(booking.venue, args.plan_id);
        if (!plan) return { error: 'Plan no encontrado en esa cabaña: usa un id de venue_info.' };
        data.plan_id = plan.id;
        changed.push('plan');
      }
      if (args.adults !== undefined || args.children !== undefined) {
        const { adults, children } = people({
          adults: args.adults ?? booking.adults,
          children: args.children ?? booking.children
        });
        if (!adults) return { error: 'Indica cuántos adultos.' };
        data.adults = adults;
        data.children = children;
        changed.push('personas');
      }
      if (plan && (data.plan_id || data.adults !== undefined)) {
        const capacityError = checkCapacity(plan, (data.adults ?? booking.adults ?? 0) + (data.children ?? booking.children ?? 0));
        if (capacityError) return { error: capacityError };
        data.calculated_price = planPrice(plan, data.adults ?? booking.adults ?? 0, data.children ?? booking.children ?? 0);
      }
      if (args.agreed_price !== undefined) {
        const price = positive(args.agreed_price);
        if (!price) return { error: 'agreed_price debe ser un monto mayor que cero.' };
        data.agreed_price = price;
        changed.push('precio');
      }
      if (args.start_time !== undefined || args.end_time !== undefined) {
        const current = currentSchedule(booking);
        const schedule = scheduleFrom(args.start_time ?? current.start, args.end_time ?? current.end);
        if (schedule.error) return schedule;
        Object.assign(data, schedule.data);
        changed.push('horario');
      }
      let agent;
      if (args.commission_agent !== undefined) {
        if (/^(ninguno|none|no)$/i.test(String(args.commission_agent).trim())) {
          data.commission_agent_id = null;
        } else {
          agent = await findCommissionAgent(args.commission_agent, venue);
          if (agent.error) return agent;
          data.commission_agent_id = agent.id;
        }
        changed.push('comisionista');
      }
      if (!changed.length) return { error: 'No indicaste nada para cambiar.' };

      const updated = await prisma.accommodations.update({ where: { id: booking.id }, data });
      let commission = agent && plan ? await recordCommission(updated, agent, plan, scope) : null;
      // Price or people changed: a commission not yet paid follows the new values.
      if (!agent && plan && updated.commission_agent_id && (data.adults !== undefined || data.agreed_price !== undefined || data.plan_id)) {
        commission = await refreshPendingCommission(updated, plan);
      }
      const [summary] = await describeBookings([updated]);
      return {
        ok: true,
        changed,
        booking: summary,
        commission,
        ...(data.commission_agent_id === null && { note: 'Se quitó el comisionista; si tenía una comisión registrada, revísala en la pestaña Comisiones del alquiler.' })
      };
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
      notify?.('payment_received', {
        venueId: booking.venue,
        data: { accommodationId: booking.id, amount, method, verified: false },
        excludeUserIds: [scope.userId]
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
    },

    async list_notifications(args, scope) {
      const limit = Math.max(1, Math.min(50, parseInt(args.limit, 10) || 20));
      const where = { user_id: scope.userId, ...(args.include_read !== true && { read_at: null }) };
      const [items, unread] = await Promise.all([
        prisma.notifications.findMany({ where, orderBy: { created_at: 'desc' }, take: limit }),
        prisma.notifications.count({ where: { user_id: scope.userId, read_at: null } })
      ]);
      const names = Object.fromEntries(scope.venues.map(v => [v.id, v.name]));
      return {
        unread,
        count: items.length,
        notifications: items.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          venue: names[n.venue_id] || null,
          at: n.created_at,
          read: !!n.read_at,
          link: n.link
        }))
      };
    },

    async mark_notifications_read(args, scope) {
      const where = { user_id: scope.userId, read_at: null };
      if (args.all !== true) {
        const ids = (Array.isArray(args.notification_ids) ? args.notification_ids : [])
          .map(String).filter(id => /^[0-9a-f-]{36}$/i.test(id));
        if (!ids.length) return { error: 'Indica notification_ids (de list_notifications) o all=true.' };
        where.id = { in: ids };
      }
      const { count } = await prisma.notifications.updateMany({ where, data: { read_at: new Date() } });
      const unread = await prisma.notifications.count({ where: { user_id: scope.userId, read_at: null } });
      return { ok: true, marked: count, unread };
    },

    async list_expenses(args, scope) {
      if (!canExpenses(scope)) return { error: 'Sin permiso para ver egresos.' };
      const and = [expenseScopeWhere(scope, args.venue_id)];
      let from = null; let to = null;
      if (args.booking_id) {
        const booking = await findBooking(args.booking_id, scope);
        if (!booking) return { error: 'Alquiler no encontrado o sin acceso.' };
        and.push({ accommodation_id: booking.id });
      } else {
        to = validDay(args.to) || todayIso();
        from = validDay(args.from) || isoDay(new Date(new Date(`${to}T00:00:00Z`).getTime() - 30 * 86400000));
        and.push({ expense_date: dayRange(from, to) });
      }
      const categories = await expenseCategories();
      if (args.category) {
        const category = findByName(categories, args.category);
        if (!category) return { error: `No existe la categoría "${args.category}". Categorías: ${categories.map(c => c.name).join(', ')}.` };
        and.push({ category_id: category.id });
      }
      if (args.recurring === 'only') and.push({ recurring_expense_id: { not: null } });
      if (args.recurring === 'none') and.push({ recurring_expense_id: null });
      const q = String(args.search || '').trim();
      if (q) {
        and.push({
          OR: [
            { description: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { provider: { name: { contains: q, mode: 'insensitive' } } }
          ]
        });
      }
      const rows = await prisma.expenses.findMany({
        where: { AND: and },
        include: {
          category: { select: { name: true } },
          provider: { select: { name: true } },
          recurring_expense: { select: { id: true, name: true } }
        },
        orderBy: { expense_date: 'desc' },
        take: 300
      });
      const bookings = await describeBookings(await prisma.accommodations.findMany({
        where: { id: { in: [...new Set(rows.map(e => e.accommodation_id).filter(Boolean))] } }
      }));
      const bookingMap = Object.fromEntries(bookings.map(b => [b.id, b]));
      const names = Object.fromEntries(scope.venues.map(v => [v.id, v.name]));
      const byCategory = {};
      for (const e of rows) byCategory[e.category?.name || 'Sin categoría'] = (byCategory[e.category?.name || 'Sin categoría'] || 0) + Number(e.amount || 0);
      const totalValue = rows.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      return {
        from, to,
        count: rows.length,
        total: money(totalValue),
        by_category: Object.fromEntries(Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, money(v)])),
        expenses: rows.slice(0, 100).map(e => describeExpense(e, names, bookingMap)),
        truncated: rows.length > 100,
        categories: categories.map(c => c.name)
      };
    },

    async recurring_expenses(args, scope) {
      if (!canExpenses(scope)) return { error: 'Sin permiso para ver egresos.' };
      const defs = await prisma.recurring_expenses.findMany({
        where: { venue_id: venueFilter(scope, args.venue_id), ...(args.only_pending === true && { is_active: true }) },
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' }
      });
      let rows = await withRecurringStatus(defs, bogotaNow().date);
      if (args.only_pending === true) rows = rows.filter(r => r.status === 'vencido' || r.status === 'pendiente');
      return {
        today: bogotaNow().date,
        count: rows.length,
        recurring_expenses: rows.map(describeRecurring),
        link: '/business/expenses?tab=recurrentes'
      };
    },

    async record_expense(args, scope) {
      if (!canExpenses(scope)) return { error: 'Sin permiso para registrar egresos.' };
      const amount = positive(args.amount);
      if (!amount || amount > 1e9) return { error: 'amount debe ser un monto mayor que cero.' };
      const description = String(args.description || '').trim().slice(0, 1000);
      if (!description) return { error: 'Indica la descripción del gasto.' };
      const categories = await expenseCategories();
      const category = findByName(categories, args.category);
      if (!category) return { error: `No existe la categoría "${args.category || ''}". Categorías: ${categories.map(c => c.name).join(', ')}.` };
      const date = args.date ? validDay(args.date) : todayIso();
      if (!date) return { error: 'date debe ser YYYY-MM-DD.' };

      let booking = null;
      let venueId = args.venue_id || null;
      if (args.booking_id) {
        booking = await findBooking(args.booking_id, scope);
        if (!booking) return { error: 'Alquiler no encontrado o sin acceso.' };
        venueId = booking.venue;
      }
      if (!venueId && scope.venues.length === 1) venueId = scope.venues[0].id;
      const venue = scope.venues.find(v => v.id === venueId);
      if (!venue) return { error: venueId ? 'Cabaña no encontrada o sin acceso.' : 'Indica venue_id o booking_id.' };

      const provider = args.provider ? await findProvider(args.provider, venue) : null;
      const notes = [
        args.notes,
        args.payment_method && `Pagado con: ${String(args.payment_method).slice(0, 100)}`,
        args.provider && !provider && `Proveedor: ${String(args.provider).slice(0, 100)}`
      ].filter(Boolean).join('. ');
      const data = {
        organization_id: venue.organization || null,
        venue_id: venue.id,
        category_id: category.id,
        amount,
        description,
        expense_date: new Date(`${date}T00:00:00.000Z`),
        reference: args.reference ? String(args.reference).slice(0, 255) : null,
        notes: agentNote(scope, notes),
        provider_id: provider?.id || null,
        accommodation_id: booking?.id || null,
        created_by: scope.userId
      };
      if (args.recurring_expense_id) {
        const def = await findRecurring(args.recurring_expense_id, scope);
        if (!def) return { error: 'Egreso recurrente no encontrado o sin acceso.' };
        if (def.venue_id !== venue.id) return { error: `El egreso recurrente "${def.name}" es de otra cabaña.` };
        const error = await linkRecurring(data, def.id, args.period);
        if (error) return { error };
      }
      const expense = await prisma.expenses.create({
        data,
        include: { category: { select: { name: true } }, provider: { select: { name: true } }, recurring_expense: { select: { id: true, name: true } } }
      });
      analytics.track('expense_created', {
        userId: scope.userId,
        organizationId: expense.organization_id || null,
        venueId: expense.venue_id,
        properties: { category_id: expense.category_id, amount_bucket: analytics.amountBucket(amount), linked_to_booking: !!booking, has_receipt: false, source: toolSource(scope) }
      });
      const bookingMap = booking ? Object.fromEntries((await describeBookings([booking])).map(b => [b.id, b])) : {};
      return {
        ok: true,
        expense: describeExpense(expense, { [venue.id]: venue.name }, bookingMap),
        ...(booking && { profit: await bookingProfit(booking, scope) })
      };
    },

    async update_expense(args, scope) {
      if (!canExpenses(scope)) return { error: 'Sin permiso para editar egresos.' };
      const existing = await findExpense(args.expense_id, scope);
      if (!existing) return { error: 'Egreso no encontrado o sin acceso.' };
      const data = {};
      const changed = [];
      if (args.amount !== undefined) {
        const amount = positive(args.amount);
        if (!amount || amount > 1e9) return { error: 'amount debe ser un monto mayor que cero.' };
        data.amount = amount; changed.push('monto');
      }
      if (args.category !== undefined) {
        const categories = await expenseCategories();
        const category = findByName(categories, args.category);
        if (!category) return { error: `No existe la categoría "${args.category}". Categorías: ${categories.map(c => c.name).join(', ')}.` };
        data.category_id = category.id; changed.push('categoría');
      }
      if (args.description !== undefined) {
        const description = String(args.description || '').trim().slice(0, 1000);
        if (!description) return { error: 'La descripción no puede quedar vacía.' };
        data.description = description; changed.push('descripción');
      }
      if (args.date !== undefined) {
        const date = validDay(args.date);
        if (!date) return { error: 'date debe ser YYYY-MM-DD.' };
        data.expense_date = new Date(`${date}T00:00:00.000Z`); changed.push('fecha');
      }
      if (args.booking_id !== undefined) {
        if (isNone(args.booking_id)) {
          data.accommodation_id = null;
        } else {
          const booking = await findBooking(args.booking_id, scope);
          if (!booking) return { error: 'Alquiler no encontrado o sin acceso.' };
          if (existing.venue_id && booking.venue !== existing.venue_id) return { error: 'Ese alquiler es de otra cabaña.' };
          data.accommodation_id = booking.id;
          data.venue_id = booking.venue;
        }
        changed.push('alquiler');
      }
      if (args.recurring_expense_id !== undefined || args.period !== undefined) {
        if (isNone(args.recurring_expense_id)) {
          await applyRecurringLink(Object.assign(data, { recurring_expense_id: null }));
        } else {
          const def = await findRecurring(args.recurring_expense_id || existing.recurring_expense_id, scope);
          if (!def) return { error: 'Egreso recurrente no encontrado o sin acceso.' };
          if (def.venue_id !== (data.venue_id || existing.venue_id)) return { error: `El egreso recurrente "${def.name}" es de otra cabaña.` };
          const error = await linkRecurring(data, def.id, args.period, existing);
          if (error) return { error };
        }
        changed.push('egreso recurrente');
      }
      if (!changed.length) return { error: 'No indicaste nada para cambiar.' };
      const expense = await prisma.expenses.update({
        where: { id: existing.id },
        data: { ...data, updated_at: new Date(), updated_by: scope.userId },
        include: { category: { select: { name: true } }, provider: { select: { name: true } }, recurring_expense: { select: { id: true, name: true } } }
      });
      const bookings = expense.accommodation_id
        ? await describeBookings(await prisma.accommodations.findMany({ where: { id: expense.accommodation_id } }))
        : [];
      return {
        ok: true,
        changed,
        expense: describeExpense(expense, Object.fromEntries(scope.venues.map(v => [v.id, v.name])), Object.fromEntries(bookings.map(b => [b.id, b])))
      };
    },

    async create_recurring_expense(args, scope) {
      if (!canExpenses(scope)) return { error: 'Sin permiso para configurar egresos.' };
      let source = null;
      if (args.from_expense_id) {
        source = await findExpense(args.from_expense_id, scope);
        if (!source) return { error: 'Egreso no encontrado o sin acceso.' };
        if (!source.venue_id) return { error: 'Ese egreso no tiene cabaña: indica venue_id y los datos del recurrente.' };
        if (source.recurring_expense_id) {
          const current = await prisma.recurring_expenses.findUnique({ where: { id: source.recurring_expense_id }, select: { name: true } });
          return { error: `Ese egreso ya es un pago del recurrente "${current?.name || source.recurring_expense_id}".` };
        }
      }
      let categoryId = source?.category_id || null;
      if (args.category) {
        const categories = await expenseCategories();
        const category = findByName(categories, args.category);
        if (!category) return { error: `No existe la categoría "${args.category}". Categorías: ${categories.map(c => c.name).join(', ')}.` };
        categoryId = category.id;
      }
      let venueId = source?.venue_id || args.venue_id || (scope.venues.length === 1 ? scope.venues[0].id : null);
      if (!scope.venues.some(v => v.id === venueId)) return { error: venueId ? 'Cabaña no encontrada o sin acceso.' : 'Indica venue_id o from_expense_id.' };
      const startDate = args.start_date ? validDay(args.start_date) : (source ? isoDay(source.expense_date) : todayIso());
      if (!startDate) return { error: 'start_date debe ser YYYY-MM-DD.' };
      const { data, error } = await recurringExpenseData({
        venue_id: venueId,
        name: args.name || source?.description,
        frequency: args.frequency,
        start_date: startDate,
        end_date: args.end_date ? validDay(args.end_date) : undefined,
        due_day: args.due_day,
        expected_amount: args.expected_amount ?? (source ? Number(source.amount) : undefined),
        category_id: categoryId,
        provider_id: source?.provider_id,
        description: args.description,
        payment_method: args.payment_method
      });
      if (error) return { error: `${error}.` };
      const def = await prisma.recurring_expenses.create({ data: { ...data, created_by: scope.userId } });
      let linked = null;
      if (source) {
        const link = { organization_id: source.organization_id };
        const linkError = await linkRecurring(link, def.id, null, source);
        if (!linkError) {
          await prisma.expenses.update({ where: { id: source.id }, data: { ...link, updated_at: new Date(), updated_by: scope.userId } });
          linked = `El egreso del ${isoDay(source.expense_date)} quedó como el pago del período ${isoDay(link.recurring_period)}.`;
        }
      }
      const [row] = await withRecurringStatus([await prisma.recurring_expenses.findUnique({ where: { id: def.id }, include: { category: { select: { name: true } } } })], bogotaNow().date);
      return { ok: true, recurring_expense: describeRecurring(row), ...(linked && { note: linked }) };
    },

    async update_recurring_expense(args, scope) {
      if (!canExpenses(scope)) return { error: 'Sin permiso para configurar egresos.' };
      const def = await findRecurring(args.recurring_expense_id, scope);
      if (!def) return { error: 'Egreso recurrente no encontrado o sin acceso.' };
      const body = {};
      for (const key of ['name', 'frequency', 'due_day', 'expected_amount', 'payment_method']) {
        if (args[key] !== undefined) body[key] = args[key];
      }
      // The day is validated against the frequency (weekday or day of month).
      if (body.due_day !== undefined && body.frequency === undefined) body.frequency = def.frequency;
      if (args.end_date !== undefined) {
        if (isNone(args.end_date)) body.end_date = null;
        else if (!validDay(args.end_date)) return { error: 'end_date debe ser YYYY-MM-DD.' };
        else body.end_date = validDay(args.end_date);
      }
      if (args.category !== undefined) {
        const categories = await expenseCategories();
        const category = findByName(categories, args.category);
        if (!category) return { error: `No existe la categoría "${args.category}". Categorías: ${categories.map(c => c.name).join(', ')}.` };
        body.category_id = category.id;
      }
      if (typeof args.active === 'boolean') body.is_active = args.active;
      const { data, error } = await recurringExpenseData(body, { partial: true });
      if (error) return { error: `${error}.` };
      const endDate = data.end_date !== undefined ? data.end_date : def.end_date;
      if (endDate && endDate < def.start_date) return { error: 'La fecha de fin no puede ser anterior a la de inicio.' };

      const changed = Object.keys(data);
      if (changed.length) {
        await prisma.recurring_expenses.update({ where: { id: def.id }, data: { ...data, updated_at: new Date(), updated_by: scope.userId } });
      }
      const current = { ...def, ...data };
      for (const [key, skip] of [['skip_period', true], ['unskip_period', false]]) {
        if (!args[key]) continue;
        const period = validDay(args[key]);
        if (!period || !recurringSchedule.occurrencesBetween(current, period, period).length) {
          return { error: `${period || args[key]} no es una fecha de pago de "${def.name}". Revisa los períodos con recurring_expenses.` };
        }
        const dueDate = new Date(`${period}T00:00:00.000Z`);
        if (skip) {
          await prisma.recurring_expense_periods.upsert({
            where: { recurring_expense_id_due_date: { recurring_expense_id: def.id, due_date: dueDate } },
            create: { recurring_expense_id: def.id, due_date: dueDate, skipped_at: new Date(), skipped_by: scope.userId },
            update: { skipped_at: new Date(), skipped_by: scope.userId }
          });
        } else {
          await prisma.recurring_expense_periods.updateMany({
            where: { recurring_expense_id: def.id, due_date: dueDate },
            data: { skipped_at: null, skipped_by: null }
          });
        }
        changed.push(key);
      }
      if (!changed.length) return { error: 'No indicaste nada para cambiar.' };
      const [row] = await withRecurringStatus([await prisma.recurring_expenses.findUnique({ where: { id: def.id }, include: { category: { select: { name: true } } } })], bogotaNow().date);
      return {
        ok: true,
        recurring_expense: describeRecurring(row),
        ...(args.active === false && { note: 'Ya no es recurrente: no se avisará más. Los gastos registrados se conservan.' })
      };
    }
  };

  // ==================== Expenses (egresos) ====================

  // Same rule as the app's recurring expenses: full expenses access, not the ":own" partner profiles.
  const canExpenses = (scope) => hasPermission(scope.perms, 'expenses:view') && !hasOwnOnly(scope.perms, 'deposits:view');

  /** Expenses of the user's venues, or of their organizations when the expense has no venue. */
  function expenseScopeWhere(scope, venueId) {
    if (venueId) return { venue_id: venueFilter(scope, venueId) };
    if (scope.venueIds === null) return {};
    return { OR: [{ venue_id: { in: scope.venueIds } }, { venue_id: null, organization_id: { in: scope.orgIds } }] };
  }

  async function findExpense(id, scope) {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) return null;
    return prisma.expenses.findFirst({ where: { AND: [{ id }, expenseScopeWhere(scope)] } });
  }

  async function findRecurring(id, scope) {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) return null;
    return prisma.recurring_expenses.findFirst({ where: { id, venue_id: venueFilter(scope) } });
  }

  const expenseCategories = () => prisma.expense_categories.findMany({
    where: { is_active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' }
  });

  /** A provider of the venue's organization by name (exact, else the only partial match). */
  async function findProvider(name, venue) {
    const providers = await prisma.providers.findMany({
      where: { OR: [{ organization_id: venue.organization || undefined }, { organization_id: null }] },
      select: { id: true, name: true }
    });
    return findByName(providers, name);
  }

  /**
   * Link an expense (data, or the existing one) to a recurring expense and the
   * period it pays: the given one, or the due date closest to the expense date.
   */
  async function linkRecurring(data, recurringId, period, existing = null) {
    if (period) {
      if (!validDay(period)) return 'period debe ser YYYY-MM-DD.';
      const def = await prisma.recurring_expenses.findUnique({ where: { id: recurringId } });
      if (def && !recurringSchedule.occurrencesBetween(def, validDay(period), validDay(period)).length) {
        return `${period} no es una fecha de pago de "${def.name}". Revisa los períodos con recurring_expenses.`;
      }
    }
    Object.assign(data, { recurring_expense_id: recurringId, recurring_period: period ? validDay(period) : null });
    const error = await applyRecurringLink(data, existing);
    if (error) return error;
    if (!data.recurring_period) return 'Ese egreso recurrente no tiene una fecha de pago cerca de la fecha del gasto.';
    return null;
  }

  function describeExpense(e, venueNames, bookingMap) {
    const booking = e.accommodation_id ? bookingMap[e.accommodation_id] : null;
    return {
      id: e.id,
      date: isoDay(e.expense_date),
      amount: money(e.amount),
      category: e.category?.name || null,
      description: e.description,
      provider: e.provider?.name || null,
      venue: venueNames[e.venue_id] || null,
      booking: booking ? { id: booking.id, label: `${booking.date} · ${booking.customer || 'sin cliente'}`, link: booking.link } : (e.accommodation_id ? { id: e.accommodation_id } : null),
      recurring: e.recurring_expense
        ? { id: e.recurring_expense.id, name: e.recurring_expense.name, period: e.recurring_period ? isoDay(e.recurring_period) : null }
        : null,
      notes: e.notes || null,
      link: `/business/expenses/${e.id}/edit`
    };
  }

  const FREQUENCY_LABELS = { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual', bimonthly: 'bimestral', yearly: 'anual' };

  function describeRecurring(r) {
    return {
      id: r.id,
      name: r.name,
      venue: r.venue_data?.name || null,
      category: r.category?.name || null,
      frequency: FREQUENCY_LABELS[r.frequency] || r.frequency,
      due_day: r.due_day,
      expected: r.expected_amount != null ? money(r.expected_amount) : null,
      active: r.is_active,
      status: r.status,
      current_period: r.current_period,
      overdue_periods: r.overdue_periods,
      next_due: r.next_due,
      skipped_periods: r.skipped_periods,
      last_payment: r.last_expense ? { date: isoDay(r.last_expense.expense_date), amount: money(r.last_expense.amount) } : null,
      start_date: isoDay(r.start_date),
      end_date: r.end_date ? isoDay(r.end_date) : null
    };
  }

  // ==================== Booking profit ====================

  const COMMISSION_STATUS = { pending: 'pendiente', paid: 'pagada', estimated: 'estimada (aún no registrada)' };

  /**
   * The booking's profit as the app shows it, for whoever may see it there:
   * analytics viewers or users who see every booking and its payments, never the
   * commission agent who sold it.
   */
  async function bookingProfit(booking, scope) {
    if (!computeBookingProfit || !canViewProfits?.(scope.perms)) return undefined;
    if ((await getAgentAccommodationIds(scope.userId)).has(booking.id)) return undefined;
    const p = (await computeBookingProfit([booking.id], { detail: true })).get(booking.id);
    if (!p) return undefined;
    const c = p.costs.commission;
    return {
      income: money(p.income.total),
      payments: money(p.income.payments),
      deposit_kept: p.income.deposit_kept ? money(p.income.deposit_kept) : null,
      expenses: (p.costs.expenses || []).map(e => ({ id: e.id, description: e.description, category: e.category, amount: money(e.amount), date: e.date ? isoDay(e.date) : null })),
      expenses_total: money(p.costs.expenses_total),
      payment_fees: money(p.costs.gateway_fees),
      commission: c.amount ? `${money(c.amount)} ${COMMISSION_STATUS[c.status] || c.status}${c.agent_name ? ` (${c.agent_name})` : ''}` : 'sin comisión',
      costs_total: money(p.costs.total),
      profit: money(p.profit),
      margin: p.margin != null ? `${p.margin}%` : null,
      projected_profit: p.projected_profit != null ? money(p.projected_profit) : null,
      note: 'Ganancia = pagos verificados + depósito retenido − gastos del alquiler − comisión − comisiones de pago. projected_profit: si se cobra el saldo pendiente.'
    };
  }

  /** An active commission agent of the venue (or its organization) by id or name. */
  async function findCommissionAgent(value, venue) {
    const agents = await prisma.commission_agents.findMany({
      where: {
        is_active: true,
        OR: [{ venue_id: venue.id }, { venue_id: null, organization_id: venue.organization || undefined }]
      },
      select: { id: true, name: true }
    });
    const text = String(value || '').trim();
    const byId = agents.find(a => a.id === text);
    if (byId) return byId;
    // Word by word, without accents: "Víctor Traveleando" finds "Traveleando con Victor".
    const words = plain(text).split(/\s+/).filter(w => w.length >= 3);
    const matches = words.length ? agents.filter(a => words.every(w => plain(a.name).includes(w))) : [];
    if (matches.length === 1) return matches[0];
    const names = agents.map(a => a.name).join(', ') || 'ninguno';
    return {
      error: matches.length
        ? `Hay varios comisionistas que coinciden (${matches.map(a => a.name).join(', ')}): usa el id.`
        : `No encontré ese comisionista. Los de esta cabaña son: ${names}.`
    };
  }

  /** The agent's pending commission for the booking, from their rules (once per booking). */
  /** How the team hears about new bookings of a venue (Notificaciones). */
  async function describeBookingNotices(venue) {
    if (!notifier || !venue.organization) return null;
    const s = await notifier.resolveSettings('booking_created_ai', venue.organization, venue.id);
    if (!s.enabled) return { estado: 'apagado', edit_link: '/business/notifications' };
    return {
      app: s.channels.in_app ? 'sí' : 'no',
      email: s.channels.email ? ([s.email_to_users ? 'destinatarios' : null, s.extra_emails].filter(Boolean).join(', ') || 'sin correos') : 'apagado',
      whatsapp: s.channels.whatsapp ? (s.whatsapp_phones || 'WhatsApp de la cabaña') : 'apagado',
      edit_link: '/business/notifications'
    };
  }

  async function recordCommission(booking, agent, plan, scope) {
    if (!computeCommission) return null;
    const existing = await prisma.commission_payments.findFirst({
      where: { agent_id: agent.id, accommodation_id: booking.id, status: { not: 'cancelled' } }
    });
    if (existing) return { agent: agent.name, amount: money(existing.calculated_amount), note: 'Ya tenía la comisión registrada.' };
    const adults = booking.adults || 0;
    const agreedPrice = Number(booking.agreed_price ?? booking.calculated_price ?? 0);
    const calc = await computeCommission({ agentId: agent.id, planType: plan.plan_type, adults, agreedPrice });
    if (calc.no_rules) return { agent: agent.name, amount: null, note: 'El comisionista no tiene reglas para este tipo de plan: calcula la comisión en la app.' };
    const venue = await prisma.venues.findUnique({ where: { id: booking.venue }, select: { organization: true } });
    await prisma.commission_payments.create({
      data: {
        agent_id: agent.id,
        accommodation_id: booking.id,
        organization_id: venue?.organization || null,
        venue_id: booking.venue,
        adults,
        agreed_price: agreedPrice,
        calculated_amount: calc.total,
        breakdown: calc.breakdown,
        status: 'pending',
        notes: agentNote(scope, 'Comisión registrada al crear el alquiler.'),
        created_by: scope.userId
      }
    });
    return { agent: agent.name, amount: money(calc.total), status: 'pendiente' };
  }

  async function refreshPendingCommission(booking, plan) {
    const pending = await prisma.commission_payments.findFirst({
      where: { agent_id: booking.commission_agent_id, accommodation_id: booking.id, status: 'pending' },
      include: { agent: { select: { name: true } } }
    });
    if (!pending || !computeCommission) return null;
    const adults = booking.adults || 0;
    const agreedPrice = Number(booking.agreed_price ?? booking.calculated_price ?? 0);
    const calc = await computeCommission({ agentId: pending.agent_id, planType: plan.plan_type, adults, agreedPrice });
    if (calc.no_rules) return null;
    await prisma.commission_payments.update({
      where: { id: pending.id },
      data: { adults, agreed_price: agreedPrice, calculated_amount: calc.total, breakdown: calc.breakdown, updated_at: new Date() }
    });
    return { agent: pending.agent.name, amount: money(calc.total), status: 'pendiente (recalculada)' };
  }

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
const plain = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isNone = (v) => v === null || ['', 'ninguno', 'ninguna', 'none', 'null'].includes(plain(v).trim());
/** A row by name, without accents or case: exact match, else the only one containing the text. */
const findByName = (rows, text) => {
  const q = plain(text).trim();
  if (!q) return null;
  const exact = rows.find(r => plain(r.name) === q);
  if (exact) return exact;
  const partial = rows.filter(r => plain(r.name).includes(q));
  return partial.length === 1 ? partial[0] : null;
};
// "19:30", "7:30 pm", "7pm", "12 am" -> "HH:MM"
const validTime = (v) => {
  const m = String(v || '').trim().toLowerCase().replace(/\./g, '').match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] || 0);
  const suffix = (m[3] || '').replace(' ', '');
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (suffix === 'pm' ? 12 : 0);
  } else if (m[2] === undefined) {
    return null;
  }
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : null;
};
/**
 * Booking time and duration as the app stores them: time on 1970-01-01 (UTC)
 * and duration in seconds. An end at or before the start is on the next day.
 */
function scheduleFrom(start, end) {
  if (!start && !end) return { data: {} };
  const from = validTime(start);
  if (!from) return { error: 'start_time debe ser HH:MM en 24 h (ej: 19:30).' };
  const to = end ? validTime(end) : null;
  if (end && !to) return { error: 'end_time debe ser HH:MM en 24 h (ej: 00:00).' };
  const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let span = to ? minutes(to) - minutes(from) : 12 * 60;
  if (span <= 0) span += 24 * 60;
  return { data: { time: new Date(`1970-01-01T${from}:00.000Z`), duration: span * 60 } };
}
function currentSchedule(booking) {
  if (!booking.time) return { start: null, end: null };
  const start = new Date(booking.time).toISOString().slice(11, 16);
  const endMinutes = (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + Math.round((Number(booking.duration) || 43200) / 60)) % (24 * 60);
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  return { start, end };
}
const hoursLabel = (booking) => {
  const { start, end } = currentSchedule(booking);
  return start ? `${start} a ${end}` : null;
};
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
// Who called the tool, for analytics: an external agent's API key or the in-app assistant.
const toolSource = (scope) => (scope.agentKeyName ? 'api' : 'assistant');

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

