<template>
  <CAlert
    v-if="showBanner"
    :color="isExpired ? 'danger' : 'warning'"
    class="membership-banner mb-0 rounded-0 text-center py-2"
    :dismissible="false"
  >
    <CIcon :icon="isExpired ? 'cil-warning' : 'cil-bell'" class="me-2" />
    <span v-if="isExpired">
      <strong>Tu membresía está vencida</strong> desde el {{ paidUntil }}. Renuévala para recuperar el acceso.
    </span>
    <span v-else-if="daysLeft === 0">
      <strong>Tu membresía vence hoy.</strong> Renuévala para no perder el acceso.
    </span>
    <span v-else-if="daysLeft === 1">
      <strong>Tu membresía vence mañana.</strong> Renuévala para no perder el acceso.
    </span>
    <span v-else>
      Tu membresía vence en <strong>{{ daysLeft }} días</strong> ({{ paidUntil }}).
    </span>
  </CAlert>
</template>

<script setup>
import { computed } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import { useAuth } from '@/composables/useAuth'

const { user } = useAuth()

const subscription = computed(() => user.value?.subscription || null)
const status = computed(() => subscription.value?.membership_status)
const isExpired = computed(() => status.value === 'vencida')
const daysLeft = computed(() => subscription.value?.membership_days_left)

const paidUntil = computed(() => {
  const value = subscription.value?.paid_until
  if (!value) return ''
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
})

// Only the owner pays, so only the owner sees it (≤ 7 days or expired).
const showBanner = computed(() => {
  return subscription.value?.is_owner && (status.value === 'por_vencer' || isExpired.value)
})
</script>

<style scoped>
.membership-banner {
  border-left: none;
  border-right: none;
  border-top: none;
  font-size: 0.875rem;
}
</style>
