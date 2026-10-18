// Catálogo único de módulos opcionales, compartido con el backend (server/modules.json).
// Sin dependencias de Vue ni de useAuth para poder usarlo también desde el router.
import MODULES from '../../server/modules.json'

export { MODULES }
export const MODULE_KEYS = MODULES.map((m) => m.key)

export function moduleInfo(key) {
  return MODULES.find((m) => m.key === key) || null
}

/**
 * ¿Está encendido el módulo para este usuario? Sin organización, basta con que
 * esté encendido en alguna de sus organizaciones (así lo calcula /api/auth/user).
 * Con organización (p. ej. la de la cabaña de un alquiler), se mira esa.
 * Los super admin ven todo. Si el usuario aún no carga, se asume encendido.
 */
export function isModuleEnabled(user, key, organizationId = null) {
  if (!user || user.is_super_admin || !user.modules) return true
  const byOrg = user.modules.disabled_by_organization || {}
  if (organizationId && byOrg[organizationId]) {
    return !byOrg[organizationId].includes(key)
  }
  return (user.modules.enabled || MODULE_KEYS).includes(key)
}
