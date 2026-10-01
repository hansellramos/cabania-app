// The business runs on Colombia time. new Date().toISOString() is UTC, which is
// already tomorrow from 7 p.m. in Colombia, so "today" must not come from it.
export const TIMEZONE = 'America/Bogota'

/** Today in Colombia as YYYY-MM-DD. */
export function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}
