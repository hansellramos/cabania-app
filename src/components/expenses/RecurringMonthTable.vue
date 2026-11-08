<template>
  <div>
    <div v-if="loading && !rows.length" class="text-center py-4">
      <CSpinner color="primary" size="sm" />
    </div>
    <CTable v-else hover responsive class="mb-0">
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Vence</CTableHeaderCell>
          <CTableHeaderCell>Gasto</CTableHeaderCell>
          <CTableHeaderCell class="d-mobile-none">Sede</CTableHeaderCell>
          <CTableHeaderCell>Monto</CTableHeaderCell>
          <CTableHeaderCell>Estado</CTableHeaderCell>
          <CTableHeaderCell>Acciones</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        <CTableRow v-for="row in rows" :key="row.recurring_expense_id + row.due">
          <CTableDataCell class="text-nowrap">{{ formatDate(row.due) }}</CTableDataCell>
          <CTableDataCell>
            <div class="fw-semibold">{{ row.name }}</div>
            <div v-if="row.category" class="small text-body-secondary">{{ row.category.name }}</div>
          </CTableDataCell>
          <CTableDataCell class="d-mobile-none">{{ row.venue_name || '—' }}</CTableDataCell>
          <CTableDataCell>
            <template v-if="row.status === 'pagado'">{{ money(row.paid_amount) }}</template>
            <span v-else-if="row.expected_amount !== null" class="text-body-secondary">aprox. {{ money(row.expected_amount) }}</span>
            <span v-else class="text-body-secondary">—</span>
          </CTableDataCell>
          <CTableDataCell>
            <CBadge :color="STATUS[row.status].color">{{ STATUS[row.status].label }}</CBadge>
            <div v-for="payment in row.payments" :key="payment.id" class="small text-body-secondary">
              {{ money(payment.amount) }} el {{ formatDate(payment.date) }}<template v-if="payment.payment_method"> · {{ payment.payment_method }}</template>
            </div>
          </CTableDataCell>
          <CTableDataCell>
            <div class="d-flex gap-1 flex-wrap">
              <template v-if="row.status === 'atrasado' || row.status === 'por_pagar'">
                <CButton :color="row.status === 'atrasado' ? 'danger' : 'success'" size="sm" @click="register(row)">Registrar</CButton>
                <CButton color="secondary" variant="outline" size="sm" :disabled="busy" @click="skip(row)">Omitir</CButton>
              </template>
              <CButton v-else-if="row.status === 'omitido'" color="secondary" variant="ghost" size="sm" :disabled="busy" @click="unskip(row)">
                Deshacer omisión
              </CButton>
              <RouterLink
                v-for="payment in row.payments"
                :key="payment.id"
                :to="{ path: `/business/expenses/${payment.id}/edit`, query: { return_to: route.fullPath } }"
                class="btn btn-sm btn-outline-info"
                title="Ver o editar el pago"
              >
                <CIcon name="cil-pencil" />
              </RouterLink>
            </div>
          </CTableDataCell>
        </CTableRow>
        <CTableRow v-if="!rows.length">
          <CTableDataCell colspan="6" class="text-center text-muted py-4">
            No hay gastos recurrentes en este mes
          </CTableDataCell>
        </CTableRow>
      </CTableBody>
    </CTable>
    <CAlert v-if="error" color="danger" class="py-2 small mt-2 mb-0">{{ error }}</CAlert>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  CAlert, CBadge, CButton, CSpinner,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const props = defineProps({
  month: { type: String, required: true },
  venueId: { type: [String, Number], default: '' },
  refreshKey: { type: Number, default: 0 },
})
// `changed` after a skip or an undo, so the page refreshes the summary.
const emit = defineEmits(['changed'])

const STATUS = {
  pagado: { label: 'Pagado', color: 'success' },
  omitido: { label: 'Omitido', color: 'secondary' },
  atrasado: { label: 'Atrasado', color: 'danger' },
  por_pagar: { label: 'Por pagar', color: 'warning' },
}

const route = useRoute()
const router = useRouter()
const rows = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })

let request = 0
const load = async () => {
  const mine = ++request
  loading.value = true
  try {
    const params = new URLSearchParams({ month: props.month })
    if (props.venueId) params.append('venue_id', props.venueId)
    const response = await fetch(`/api/recurring-expenses/month?${params}`, { credentials: 'include' })
    if (response.ok && mine === request) rows.value = (await response.json()).rows
  } catch (err) {
    console.error('Error loading the month table:', err)
  } finally {
    if (mine === request) loading.value = false
  }
}

const register = (row) => {
  router.push({
    path: '/business/expenses/create',
    query: { venue_id: row.venue_id, recurring_expense_id: row.recurring_expense_id, recurring_period: row.due, return_to: route.fullPath },
  })
}

const act = async (url, options) => {
  busy.value = true
  error.value = ''
  try {
    const response = await fetch(url, { credentials: 'include', ...options })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      error.value = data.error || 'No se pudo guardar el cambio'
      return
    }
    await load()
    emit('changed')
  } finally {
    busy.value = false
  }
}

const skip = (row) => act(`/api/recurring-expenses/${row.recurring_expense_id}/skip`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ period: row.due }),
})

const unskip = (row) => act(`/api/recurring-expenses/${row.recurring_expense_id}/skip/${row.due}`, { method: 'DELETE' })

watch(() => [props.month, props.venueId, props.refreshKey], load, { immediate: true })
</script>
