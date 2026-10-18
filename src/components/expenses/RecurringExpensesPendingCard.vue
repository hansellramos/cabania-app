<template>
  <CCard v-if="items.length" class="mb-4 border-warning">
    <CCardHeader class="d-flex justify-content-between align-items-center">
      <strong>
        <CIcon name="cil-reload" class="me-1" />
        Gastos recurrentes pendientes
      </strong>
      <RouterLink to="/business/expenses?tab=recurrentes" class="small">Ver todos</RouterLink>
    </CCardHeader>
    <CCardBody class="py-2">
      <div
        v-for="item in items.slice(0, 5)"
        :key="item.id"
        class="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 recurring-pending-row"
      >
        <div>
          <div class="fw-semibold">{{ item.name }}</div>
          <div class="small text-body-secondary">
            {{ item.venue_data?.name }}
            · vence {{ formatDate(item.current_period) }}
            <template v-if="item.expected_amount"> · aprox. {{ formatCurrency(item.expected_amount) }}</template>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <CBadge :color="RECURRING_STATUS[item.status]?.color || 'secondary'">
            {{ RECURRING_STATUS[item.status]?.label || item.status }}
          </CBadge>
          <RouterLink
            :to="{ path: '/business/expenses/create', query: { venue_id: item.venue_id, recurring_expense_id: item.id, recurring_period: item.current_period } }"
            class="btn btn-sm btn-success"
          >
            Registrar
          </RouterLink>
        </div>
      </div>
      <div v-if="items.length > 5" class="small text-body-secondary pt-1">
        y {{ items.length - 5 }} más
      </div>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { CCard, CCardHeader, CCardBody, CBadge } from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { useAuth } from '@/composables/useAuth'
import { useSettingsStore } from '@/stores/settings'
import { RECURRING_STATUS } from '@/utils/recurringExpenses'

const { user } = useAuth()
const settingsStore = useSettingsStore()
const items = ref([])

// Same rule as the route guard for the Gastos module.
const canSeeExpenses = () => {
  if (user.value?.is_super_admin) return true
  const perms = user.value?.profile?.permissions || []
  return perms.some(p => p === 'expenses:view' || p.startsWith('expenses:view:'))
}

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

// The signed-in user may still be loading when this mounts.
let loaded = false
const load = async () => {
  if (loaded || !user.value || !canSeeExpenses()) return
  loaded = true
  try {
    const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
    const response = await fetch(`/api/recurring-expenses?pending=true&viewAll=${viewAll}`, { credentials: 'include' })
    if (response.ok) items.value = await response.json()
  } catch (error) {
    console.error('Error loading pending recurring expenses:', error)
  }
}

watch(user, load, { immediate: true })
</script>

<style scoped>
.recurring-pending-row + .recurring-pending-row {
  border-top: 1px solid var(--cui-border-color);
}
</style>
