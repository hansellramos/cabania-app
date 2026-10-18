<template>
  <!-- Only for whoever may see the owner's numbers (the endpoint answers 403 otherwise). -->
  <div v-if="allowed" class="border rounded p-3">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h6 class="mb-0">
        Ganancia
        <CBadge v-if="data?.status === 'cancelled'" color="danger" class="ms-1">Cancelado: lo que se conservó</CBadge>
        <CBadge v-else-if="data?.status === 'no_show'" color="warning" class="ms-1">No asistió: lo que se conservó</CBadge>
      </h6>
      <div class="d-flex align-items-center gap-1">
        <CFormSwitch id="profitProrate" v-model="prorate" label="Incluir gastos fijos prorrateados" class="mb-0" />
        <span
          v-c-tooltip="{ content: prorateHelp, placement: 'left' }"
          class="text-body-secondary"
          style="cursor: help"
        >
          <CIcon icon="cil-info" size="sm" />
        </span>
      </div>
    </div>

    <div v-if="loading && !data" class="text-center py-3"><CSpinner size="sm" /></div>
    <template v-else-if="data">
      <CRow class="g-3 align-items-stretch">
        <CCol :md="5">
          <div class="p-3 border rounded text-center h-100" :class="data.profit >= 0 ? 'border-success' : 'border-danger'">
            <div class="text-muted small mb-1">Ganancia {{ data.costs.fixed ? 'neta' : 'directa' }}</div>
            <p class="fs-3 fw-bold mb-0" :class="data.profit >= 0 ? 'text-success' : 'text-danger'">
              {{ formatCurrency(data.profit) }}
            </p>
            <div class="small text-body-secondary">
              Margen: {{ data.margin === null ? '—' : `${formatPercent(data.margin)}%` }}
            </div>
            <div v-if="data.projected_profit !== null" class="small mt-2">
              Falta cobrar {{ formatCurrency(data.pending_balance) }}: al cobrarlo quedaría en
              <strong>{{ formatCurrency(data.projected_profit) }}</strong>
            </div>
          </div>
        </CCol>
        <CCol :md="7">
          <table class="table table-sm mb-0 profit-breakdown">
            <tbody>
              <tr>
                <td>Pagos verificados</td>
                <td class="text-end text-success text-nowrap">{{ formatCurrency(data.income.payments) }}</td>
              </tr>
              <tr v-if="data.income.deposit_kept">
                <td>Depósito retenido por daños</td>
                <td class="text-end text-success text-nowrap">{{ formatCurrency(data.income.deposit_kept) }}</td>
              </tr>
              <tr>
                <td>
                  Gastos del alquiler
                  <small v-if="data.costs.expenses?.length" class="text-body-secondary">({{ expenseSummary }})</small>
                </td>
                <td class="text-end text-danger text-nowrap">{{ negative(data.costs.expenses_total) }}</td>
              </tr>
              <tr v-if="data.costs.gateway_fees">
                <td>Comisiones de pago (Bold)</td>
                <td class="text-end text-danger text-nowrap">{{ negative(data.costs.gateway_fees) }}</td>
              </tr>
              <tr v-if="data.costs.commission.status !== 'none'">
                <td>
                  Comisión {{ data.costs.commission.agent_name ? `de ${data.costs.commission.agent_name}` : 'del comisionista' }}
                  <CBadge :color="commissionBadge.color" class="ms-1">{{ commissionBadge.label }}</CBadge>
                </td>
                <td class="text-end text-danger text-nowrap">{{ negative(data.costs.commission.amount) }}</td>
              </tr>
              <tr v-if="data.costs.fixed">
                <td>
                  Gastos fijos prorrateados
                  <small class="text-body-secondary">
                    ({{ formatCurrency(data.costs.fixed.pool_total) }} ÷ {{ data.costs.fixed.bookings }} alquileres de {{ formatMonth(data.costs.fixed.month) }})
                  </small>
                </td>
                <td class="text-end text-danger text-nowrap">{{ negative(data.costs.fixed.amount) }}</td>
              </tr>
              <tr v-else-if="prorate">
                <td colspan="2" class="small text-body-secondary">No hay gastos fijos registrados en el mes de este alquiler.</td>
              </tr>
              <tr class="fw-bold">
                <td>Ganancia</td>
                <td class="text-end" :class="data.profit >= 0 ? 'text-success' : 'text-danger'">{{ formatCurrency(data.profit) }}</td>
              </tr>
            </tbody>
          </table>
        </CCol>
      </CRow>
    </template>
    <div v-else-if="error" class="text-danger small">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { CIcon } from '@coreui/icons-vue'

const props = defineProps({
  accommodationId: { type: String, required: true },
  // Changes when payments, expenses or the deposit change, to recompute.
  refreshKey: { type: [String, Number], default: 0 }
})

const prorateHelp = 'Suma la parte de los gastos del mes de la cabaña que no están vinculados a ningún alquiler '
  + '(servicios, mantenimiento, arriendo…), repartidos por partes iguales entre los alquileres no cancelados de ese mes.'

const data = ref(null)
const loading = ref(false)
const error = ref('')
const allowed = ref(true)
const prorate = ref(false)

const commissionBadge = computed(() => ({
  paid: { color: 'success', label: 'Pagada' },
  pending: { color: 'warning', label: 'Por pagar' },
  estimated: { color: 'secondary', label: 'Estimada' }
}[data.value?.costs.commission.status] || { color: 'secondary', label: '' }))

const expenseSummary = computed(() => {
  const byCategory = {}
  for (const e of data.value?.costs.expenses || []) {
    const name = e.category || 'Sin categoría'
    byCategory[name] = (byCategory[name] || 0) + e.amount
  }
  return Object.entries(byCategory).map(([name, amount]) => `${name} ${formatCurrency(amount)}`).join(' · ')
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/accommodations/${props.accommodationId}/profit?prorate=${prorate.value}`, { credentials: 'include' })
    if (res.status === 403) {
      allowed.value = false
      return
    }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo calcular la ganancia')
    data.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount || 0)
}

function negative(amount) {
  return amount ? `-${formatCurrency(amount)}` : formatCurrency(0)
}

function formatPercent(value) {
  return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

function formatMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

watch(() => [props.accommodationId, props.refreshKey, prorate.value], load)
onMounted(load)
</script>

<style scoped>
.profit-breakdown td {
  vertical-align: middle;
}
</style>
