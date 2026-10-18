<template>
  <CRow>
    <CCol :xs="12">
      <CRow class="mb-3 g-3">
        <CCol :sm="6" :lg="3">
          <CCard class="h-100"><CCardBody>
            <div class="small text-body-secondary">Ingreso mensual (tarifas)</div>
            <div class="fs-4 fw-semibold">{{ formatCurrency(totals.monthly) }}</div>
          </CCardBody></CCard>
        </CCol>
        <CCol :sm="6" :lg="3">
          <CCard class="h-100"><CCardBody>
            <div class="small text-body-secondary">Al día</div>
            <div class="fs-4 fw-semibold text-success">{{ totals.al_dia }}</div>
          </CCardBody></CCard>
        </CCol>
        <CCol :sm="6" :lg="3">
          <CCard class="h-100"><CCardBody>
            <div class="small text-body-secondary">Por vencer (≤ 7 días)</div>
            <div class="fs-4 fw-semibold text-warning">{{ totals.por_vencer }}</div>
          </CCardBody></CCard>
        </CCol>
        <CCol :sm="6" :lg="3">
          <CCard class="h-100"><CCardBody>
            <div class="small text-body-secondary">Vencidas</div>
            <div class="fs-4 fw-semibold text-danger">{{ totals.vencida }}</div>
          </CCardBody></CCard>
        </CCol>
      </CRow>

      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Membresías</strong>
          <CButton color="primary" size="sm" @click="openCreate">
            <CIcon name="cil-plus" class="me-1" /> Nueva membresía
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
              <CFormLabel class="small">Tipo</CFormLabel>
              <CFormSelect v-model="filters.type" size="sm">
                <option value="">Todos</option>
                <option value="cabana">Cabaña</option>
                <option value="revendedor">Revendedor</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm">
                <option value="">Todos</option>
                <option value="al_dia">Al día</option>
                <option value="por_vencer">Por vencer</option>
                <option value="vencida">Vencida</option>
                <option value="sin_control">Sin fecha de pago</option>
              </CFormSelect>
            </CCol>
            <CCol :md="6">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput v-model="filters.search" size="sm" placeholder="Cliente o correo del dueño..." />
            </CCol>
          </CRow>

          <CAlert v-if="errorMessage" color="danger" dismissible @close="errorMessage = ''">{{ errorMessage }}</CAlert>

          <div v-if="loading" class="text-center py-4"><CSpinner /></div>
          <CTable v-else hover responsive class="align-middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Cliente</CTableHeaderCell>
                <CTableHeaderCell>Tipo</CTableHeaderCell>
                <CTableHeaderCell class="text-end">Tarifa mensual</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Pagada hasta</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Orgs / Cabañas</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Dueño</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="m in filteredMemberships" :key="m.id">
                <CTableDataCell>
                  <div class="fw-semibold">{{ m.name }}</div>
                  <div v-if="!m.is_active" class="small text-danger">Desactivada</div>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="m.client_type === 'revendedor' ? 'info' : 'secondary'">
                    {{ m.client_type === 'revendedor' ? 'Revendedor' : 'Cabaña' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell class="text-end">{{ m.monthly_price != null ? formatCurrency(m.monthly_price) : '—' }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="statusColor(m.status)">{{ statusLabel(m) }}</CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ m.paid_until ? formatDate(m.paid_until) : '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">{{ m.organizations_count }} / {{ m.venues_count }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  <template v-if="m.owner">
                    <div>{{ m.owner.display_name || m.owner.email }}</div>
                    <div v-if="m.owner.display_name" class="small text-body-secondary">{{ m.owner.email }}</div>
                  </template>
                  <span v-else class="text-body-secondary">—</span>
                </CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <CButton color="success" size="sm" title="Registrar pago" @click="openPayment(m)">
                      <CIcon name="cil-dollar" />
                    </CButton>
                    <CButton color="info" size="sm" variant="outline" title="Historial de pagos" @click="openHistory(m)">
                      <CIcon name="cil-list" />
                    </CButton>
                    <CButton color="secondary" size="sm" variant="outline" title="Editar" @click="openEdit(m)">
                      <CIcon name="cil-pencil" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredMemberships.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">No hay membresías</CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Create / edit -->
  <CModal teleport :visible="showForm" @close="showForm = false">
    <CModalHeader><CModalTitle>{{ form.id ? 'Editar membresía' : 'Nueva membresía' }}</CModalTitle></CModalHeader>
    <CModalBody>
      <CAlert v-if="formError" color="danger">{{ formError }}</CAlert>
      <div class="mb-3">
        <CFormLabel>Cliente</CFormLabel>
        <CFormInput v-model="form.name" placeholder="Ej: Casa Baluna" />
      </div>
      <CRow class="g-2 mb-3">
        <CCol :sm="6">
          <CFormLabel>Tipo</CFormLabel>
          <CFormSelect v-model="form.client_type">
            <option value="cabana">Cabaña</option>
            <option value="revendedor">Revendedor</option>
          </CFormSelect>
        </CCol>
        <CCol :sm="6">
          <CFormLabel>Tarifa mensual (COP)</CFormLabel>
          <CFormInput v-model="form.monthly_price" type="number" min="0" step="1000" />
        </CCol>
      </CRow>
      <div v-if="!form.id" class="mb-3">
        <CFormLabel>Correo del dueño</CFormLabel>
        <CFormInput v-model="form.owner_email" type="email" placeholder="usuario@correo.com" />
        <div class="form-text">Debe ser un usuario ya registrado en CabanIA.</div>
      </div>
      <div class="mb-3">
        <CFormLabel>Pagada hasta</CFormLabel>
        <CFormInput v-model="form.paid_until" type="date" />
        <div class="form-text">Déjalo vacío para no controlar vencimiento (la membresía no vence). Normalmente se actualiza al registrar pagos.</div>
      </div>
      <CFormCheck v-if="form.id" v-model="form.is_active" label="Activa" />
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showForm = false">Cancelar</CButton>
      <CButton color="primary" :disabled="saving" @click="saveForm">
        <CSpinner v-if="saving" size="sm" class="me-1" /> Guardar
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Register payment -->
  <CModal teleport :visible="showPayment" @close="showPayment = false">
    <CModalHeader><CModalTitle>Registrar pago · {{ selected?.name }}</CModalTitle></CModalHeader>
    <CModalBody>
      <CAlert v-if="formError" color="danger">{{ formError }}</CAlert>
      <CRow class="g-2 mb-3">
        <CCol :sm="6">
          <CFormLabel>Fecha de pago</CFormLabel>
          <CFormInput v-model="payment.payment_date" type="date" />
        </CCol>
        <CCol :sm="6">
          <CFormLabel>Meses que cubre</CFormLabel>
          <CFormInput v-model.number="payment.months" type="number" min="1" max="36" @input="syncAmount" />
        </CCol>
      </CRow>
      <CRow class="g-2 mb-3">
        <CCol :sm="6">
          <CFormLabel>Monto (COP)</CFormLabel>
          <CFormInput v-model="payment.amount" type="number" min="0" step="1000" />
        </CCol>
        <CCol :sm="6">
          <CFormLabel>Método</CFormLabel>
          <CFormSelect v-model="payment.method">
            <option value="Transferencia">Transferencia</option>
            <option value="Nequi">Nequi</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Otro">Otro</option>
          </CFormSelect>
        </CCol>
      </CRow>
      <div class="mb-3">
        <CFormLabel>Nota</CFormLabel>
        <CFormTextarea v-model="payment.note" rows="2" />
      </div>
      <div class="small bg-body-tertiary rounded p-2">
        Pagada hasta: <strong>{{ selected?.paid_until ? formatDate(selected.paid_until) : 'sin fecha' }}</strong>
        → <strong>{{ previewPaidUntil ? formatDate(previewPaidUntil) : '—' }}</strong>
      </div>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showPayment = false">Cancelar</CButton>
      <CButton color="success" :disabled="saving" @click="savePayment">
        <CSpinner v-if="saving" size="sm" class="me-1" /> Registrar pago
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Payment history -->
  <CModal teleport size="lg" :visible="showHistory" @close="showHistory = false">
    <CModalHeader><CModalTitle>Pagos · {{ selected?.name }}</CModalTitle></CModalHeader>
    <CModalBody>
      <div v-if="historyLoading" class="text-center py-3"><CSpinner /></div>
      <CTable v-else small responsive class="align-middle">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Fecha</CTableHeaderCell>
            <CTableHeaderCell class="text-end">Monto</CTableHeaderCell>
            <CTableHeaderCell>Meses</CTableHeaderCell>
            <CTableHeaderCell>Método</CTableHeaderCell>
            <CTableHeaderCell>Cubre hasta</CTableHeaderCell>
            <CTableHeaderCell>Nota</CTableHeaderCell>
            <CTableHeaderCell></CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="(p, i) in history" :key="p.id">
            <CTableDataCell>{{ formatDate(p.payment_date) }}</CTableDataCell>
            <CTableDataCell class="text-end">{{ formatCurrency(p.amount) }}</CTableDataCell>
            <CTableDataCell>{{ p.months }}</CTableDataCell>
            <CTableDataCell>{{ p.method || '—' }}</CTableDataCell>
            <CTableDataCell>{{ formatDate(p.paid_until_after) }}</CTableDataCell>
            <CTableDataCell class="small">{{ p.note || '' }}</CTableDataCell>
            <CTableDataCell>
              <CButton v-if="i === latestIndex" color="danger" size="sm" variant="ghost" title="Anular último pago" @click="undoPayment(p)">
                <CIcon name="cil-trash" />
              </CButton>
            </CTableDataCell>
          </CTableRow>
          <CTableRow v-if="history.length === 0">
            <CTableDataCell colspan="7" class="text-center text-muted py-3">Sin pagos registrados</CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
    </CModalBody>
  </CModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton, CBadge, CSpinner, CAlert,
  CFormLabel, CFormInput, CFormSelect, CFormTextarea, CFormCheck,
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const memberships = ref([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref({ type: '', status: '', search: '' })

const showForm = ref(false)
const showPayment = ref(false)
const showHistory = ref(false)
const saving = ref(false)
const formError = ref('')
const form = ref({})
const payment = ref({})
const selected = ref(null)
const history = ref([])
const historyLoading = ref(false)

const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error de servidor')
  return data
}

async function loadMemberships() {
  loading.value = true
  try {
    memberships.value = await api('/api/admin/memberships')
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadMemberships)

const filteredMemberships = computed(() => {
  const q = filters.value.search.trim().toLowerCase()
  return memberships.value.filter(m => {
    if (filters.value.type && m.client_type !== filters.value.type) return false
    if (filters.value.status && m.status !== filters.value.status) return false
    if (q) {
      const haystack = [m.name, m.owner?.email, m.owner?.display_name].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
})

const totals = computed(() => {
  const t = { monthly: 0, al_dia: 0, por_vencer: 0, vencida: 0 }
  for (const m of memberships.value) {
    if (m.is_active && m.status !== 'vencida') t.monthly += Number(m.monthly_price) || 0
    if (t[m.status] !== undefined) t[m.status]++
  }
  return t
})

// Same rule as the server: from max(paid_until, payment date), clamped to month end.
function addMonths(dateStr, months) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const target = new Date(Date.UTC(y, mo - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

const previewPaidUntil = computed(() => {
  const date = payment.value.payment_date
  const months = parseInt(payment.value.months, 10)
  if (!date || !months) return null
  const current = selected.value?.paid_until
  return addMonths(current && current > date ? current : date, months)
})

const latestIndex = computed(() => {
  if (!history.value.length) return -1
  let idx = 0
  history.value.forEach((p, i) => { if (p.created_at > history.value[idx].created_at) idx = i })
  return idx
})

function openCreate() {
  formError.value = ''
  form.value = { name: '', client_type: 'cabana', monthly_price: '', owner_email: '', paid_until: '' }
  showForm.value = true
}

function openEdit(m) {
  formError.value = ''
  form.value = {
    id: m.id, name: m.name, client_type: m.client_type || 'cabana',
    monthly_price: m.monthly_price ?? '', paid_until: m.paid_until || '', is_active: m.is_active
  }
  showForm.value = true
}

async function saveForm() {
  if (!form.value.name) { formError.value = 'El nombre es requerido'; return }
  saving.value = true
  formError.value = ''
  try {
    const { id, ...body } = form.value
    const saved = id
      ? await api(`/api/admin/memberships/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/api/admin/memberships', { method: 'POST', body: JSON.stringify(body) })
    replaceMembership(saved)
    showForm.value = false
  } catch (err) {
    formError.value = err.message
  } finally {
    saving.value = false
  }
}

function openPayment(m) {
  formError.value = ''
  selected.value = m
  payment.value = {
    payment_date: todayStr(), months: 1, amount: m.monthly_price ?? '', method: 'Transferencia', note: ''
  }
  showPayment.value = true
}

function syncAmount() {
  const price = Number(selected.value?.monthly_price)
  if (price && payment.value.months > 0) payment.value.amount = price * payment.value.months
}

async function savePayment() {
  saving.value = true
  formError.value = ''
  try {
    const result = await api(`/api/admin/memberships/${selected.value.id}/payments`, {
      method: 'POST', body: JSON.stringify(payment.value)
    })
    replaceMembership(result.membership)
    showPayment.value = false
  } catch (err) {
    formError.value = err.message
  } finally {
    saving.value = false
  }
}

async function openHistory(m) {
  selected.value = m
  showHistory.value = true
  historyLoading.value = true
  try {
    history.value = await api(`/api/admin/memberships/${m.id}/payments`)
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    historyLoading.value = false
  }
}

async function undoPayment(p) {
  if (!confirm('¿Anular este pago? La fecha "pagada hasta" vuelve a la anterior.')) return
  try {
    const updated = await api(`/api/admin/memberships/${selected.value.id}/payments/${p.id}`, { method: 'DELETE' })
    replaceMembership(updated)
    history.value = history.value.filter(h => h.id !== p.id)
  } catch (err) {
    errorMessage.value = err.message
  }
}

function replaceMembership(m) {
  if (!m) return
  const idx = memberships.value.findIndex(x => x.id === m.id)
  if (idx >= 0) memberships.value.splice(idx, 1, m)
  else memberships.value.unshift(m)
  if (selected.value?.id === m.id) selected.value = m
}

function statusColor(status) {
  return { al_dia: 'success', por_vencer: 'warning', vencida: 'danger' }[status] || 'secondary'
}

function statusLabel(m) {
  if (m.status === 'al_dia') return 'Al día'
  if (m.status === 'por_vencer') return m.days_left === 0 ? 'Vence hoy' : `Vence en ${m.days_left} d`
  if (m.status === 'vencida') return `Vencida hace ${-m.days_left} d`
  return 'Sin fecha'
}

function formatDate(value) {
  if (!value) return ''
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(value) {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num)
}
</script>
