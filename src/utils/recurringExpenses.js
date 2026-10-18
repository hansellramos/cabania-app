// Labels for recurring expenses (statuses come from GET /api/recurring-expenses).

export const RECURRING_STATUS = {
  vencido: { label: 'Vencido', color: 'danger' },
  pendiente: { label: 'Pendiente', color: 'warning' },
  registrado: { label: 'Registrado', color: 'success' },
  omitido: { label: 'Omitido', color: 'secondary' },
  programado: { label: 'Programado', color: 'info' },
  finalizado: { label: 'Finalizado', color: 'light' },
  inactivo: { label: 'Inactivo', color: 'light' }
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** "Mensual, día 5", "Semanal, lunes", "Quincenal (15 y fin de mes)". */
export function recurringFrequencyLabel(item) {
  const startDay = item.start_date ? Number(item.start_date.slice(8, 10)) : null
  const day = item.due_day || startDay
  switch (item.frequency) {
    case 'weekly': {
      const weekday = item.due_day || (item.start_date ? (new Date(item.start_date).getUTCDay() || 7) : null)
      return weekday ? `Semanal, ${WEEKDAYS[weekday - 1]}` : 'Semanal'
    }
    case 'biweekly': return 'Quincenal (15 y fin de mes)'
    case 'monthly': return `Mensual, día ${day}`
    case 'bimonthly': return `Bimestral, día ${day}`
    case 'yearly': {
      const month = item.start_date
        ? new Date(item.start_date).toLocaleDateString('es-CO', { month: 'long', timeZone: 'UTC' })
        : ''
      return `Anual, ${day} de ${month}`
    }
    default: return item.frequency
  }
}
