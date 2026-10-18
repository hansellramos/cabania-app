import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { MODULES, MODULE_KEYS, isModuleEnabled } from '@/utils/modules'

/**
 * Módulos opcionales de la organización (inventario, contratos, depósitos...).
 * isEnabled('inventory') → encendido en alguna organización del usuario;
 * isEnabled('contracts', orgId) → encendido en esa organización.
 */
export function useModules() {
  const { user } = useAuth()
  const enabledModules = computed(() =>
    MODULE_KEYS.filter((key) => isModuleEnabled(user.value, key)),
  )
  return {
    modules: MODULES,
    enabledModules,
    isEnabled: (key, organizationId = null) => isModuleEnabled(user.value, key, organizationId),
  }
}
