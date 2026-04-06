/**
 * Contract template renderer — replaces placeholders with accommodation data
 */

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Format a number as COP currency
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date in Spanish
 */
function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Format time from a Date or time string
 */
function formatTime(time) {
  if (!time) return '—';
  const d = new Date(time);
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

/**
 * Build placeholder values from accommodation + related data
 */
function buildPlaceholders({ accommodation, customer, venue, organization, plan, commissionAgent, payments, deposit }) {
  const agreedPrice = parseFloat(accommodation.agreed_price) || parseFloat(accommodation.calculated_price) || 0;
  const totalPaid = (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  return {
    // Customer
    customer_name: customer?.fullname || '—',
    customer_id: customer?.whatsapp || '—',
    customer_phone: customer?.whatsapp || '—',
    customer_email: customer?.email || '—',

    // Accommodation
    accommodation_date: formatDate(accommodation.date),
    check_in: `${formatDate(accommodation.date)}, ${formatTime(accommodation.time)}`,
    check_out: accommodation.time && accommodation.duration
      ? (() => {
          const startMs = new Date(accommodation.time).getTime();
          const durationSec = parseFloat(accommodation.duration) || 0;
          const endMs = startMs + durationSec * 1000;
          return `${formatDate(accommodation.date)}, ${formatTime(new Date(endMs))}`;
        })()
      : '—',
    duration: accommodation.duration
      ? `${Math.round(parseFloat(accommodation.duration) / 3600)} hora(s)`
      : '—',
    adults: String(accommodation.adults || 0),
    children: String(accommodation.children || 0),
    total_guests: String((accommodation.adults || 0) + (accommodation.children || 0)),

    // Amounts
    total_amount: formatCurrency(agreedPrice),
    paid_amount: formatCurrency(totalPaid),
    balance_amount: formatCurrency(agreedPrice - totalPaid),
    deposit_amount: formatCurrency(deposit?.amount || venue?.deposit_base_amount || 0),

    // Venue
    venue_name: venue?.name || '—',
    venue_address: venue?.address || '—',
    venue_city: [venue?.city, venue?.department].filter(Boolean).join(', ') || '—',

    // Organization
    organization_name: organization?.name || '—',

    // Plan
    plan_name: plan?.name || '—',

    // Commission agent
    commission_agent_name: commissionAgent?.name || commissionAgent?.provider?.name || '—',
    commission_agent_phone: commissionAgent?.provider?.phone || '—',
    commission_agent_instagram: commissionAgent?.provider?.instagram || '—',
  };
}

/**
 * Replace placeholders in content string
 */
function replacePlaceholders(content, values) {
  return content.replace(PLACEHOLDER_REGEX, (match, key) => {
    return values[key] !== undefined ? values[key] : match;
  });
}

/**
 * Render a full contract from template sections + accommodation data
 * Returns HTML string
 */
function renderContract(sections, data) {
  const values = buildPlaceholders(data);

  const renderedSections = sections.map(section => ({
    title: replacePlaceholders(section.title, values),
    content: replacePlaceholders(section.content, values),
    sort_order: section.sort_order,
  }));

  return { renderedSections, placeholderValues: values };
}

/**
 * Get list of available placeholders with descriptions
 */
function getAvailablePlaceholders() {
  return [
    { key: 'customer_name', label: 'Nombre del cliente', category: 'Cliente' },
    { key: 'customer_id', label: 'Documento del cliente', category: 'Cliente' },
    { key: 'customer_phone', label: 'Teléfono del cliente', category: 'Cliente' },
    { key: 'customer_email', label: 'Email del cliente', category: 'Cliente' },
    { key: 'accommodation_date', label: 'Fecha del hospedaje', category: 'Hospedaje' },
    { key: 'check_in', label: 'Fecha y hora de entrada', category: 'Hospedaje' },
    { key: 'check_out', label: 'Fecha y hora de salida', category: 'Hospedaje' },
    { key: 'duration', label: 'Duración', category: 'Hospedaje' },
    { key: 'adults', label: 'Adultos', category: 'Hospedaje' },
    { key: 'children', label: 'Niños', category: 'Hospedaje' },
    { key: 'total_guests', label: 'Total asistentes', category: 'Hospedaje' },
    { key: 'total_amount', label: 'Valor total', category: 'Montos' },
    { key: 'paid_amount', label: 'Total abonado', category: 'Montos' },
    { key: 'balance_amount', label: 'Saldo pendiente', category: 'Montos' },
    { key: 'deposit_amount', label: 'Monto del depósito', category: 'Montos' },
    { key: 'venue_name', label: 'Nombre de la cabaña', category: 'Venue' },
    { key: 'venue_address', label: 'Dirección', category: 'Venue' },
    { key: 'venue_city', label: 'Ciudad', category: 'Venue' },
    { key: 'organization_name', label: 'Organización', category: 'Venue' },
    { key: 'plan_name', label: 'Nombre del plan', category: 'Venue' },
    { key: 'commission_agent_name', label: 'Nombre del comisionista', category: 'Comisionista' },
    { key: 'commission_agent_phone', label: 'Teléfono del comisionista', category: 'Comisionista' },
    { key: 'commission_agent_instagram', label: 'Instagram del comisionista', category: 'Comisionista' },
  ];
}

module.exports = {
  renderContract,
  replacePlaceholders,
  buildPlaceholders,
  getAvailablePlaceholders,
  formatCurrency,
  formatDate,
  formatTime,
};
