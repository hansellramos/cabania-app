<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>Pagos en línea (Bold)</strong>
            <div class="small text-muted">
              Cobros enviados por el chat. Se actualiza solo cada 30 segundos.
            </div>
          </div>
          <CButton color="secondary" variant="outline" size="sm" :disabled="loading" @click="loadLinks">
            <CSpinner v-if="loading" size="sm" class="me-1" /> Actualizar
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <CButton
              v-for="tab in tabs"
              :key="tab.value"
              size="sm"
              :color="tab.color"
              :variant="filters.view === tab.value ? undefined : 'outline'"
              @click="filters.view = tab.value"
            >
              {{ tab.label }} <CBadge color="light" text-color="dark" class="ms-1">{{ counts[tab.value] }}</CBadge>
            </CButton>
          </div>

          <CRow class="mb-3 g-2">
            <CCol :md="6">
              <CFormInput v-model="searchQuery" size="sm" placeholder="Buscar por cliente, comisionista, cabaña o link (LNK_...)" />
            </CCol>
            <CCol :md="3">
              <CFormInput v-model="filters.from" type="date" size="sm" title="Creado desde" />
            </CCol>
            <CCol :md="3">
              <CFormInput v-model="filters.to" type="date" size="sm" title="Creado hasta" />
            </CCol>
          </CRow>

          <CAlert v-if="error" color="danger" class="small py-2">{{ error }}</CAlert>

          <CTable hover responsive class="align-middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Creado</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Monto</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Cabaña</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Cliente</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Reserva</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Último evento</CTableHeaderCell>
                <CTableHeaderCell></CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="link in filteredLinks" :key="link.id" style="cursor: pointer" @click="openDetail(link)">
                <CTableDataCell class="small">{{ formatDateTime(link.created_at) }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="statusInfo(link.status).color">{{ statusInfo(link.status).label }}</CBadge>
                  <CBadge v-if="link.needs_review" color="danger" class="ms-1">Revisar</CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ formatCurrency(link.amount) }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none small">{{ link.venue_name || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none small">
                  {{ link.client_name || '—' }}
                  <div v-if="link.agent_name" class="text-muted">vía {{ link.agent_name }}</div>
                </CTableDataCell>
                <CTableDataCell class="d-mobile-none small">
                  <RouterLink v-if="link.accommodation_id" :to="`/business/accommodations/${link.accommodation_id}`" @click.stop>
                    {{ formatDate(link.check_in) !== '—' ? formatDate(link.check_in) : 'Ver reserva' }}
                  </RouterLink>
                  <span v-else-if="link.check_in" class="text-muted">{{ formatDate(link.check_in) }} (sin crear)</span>
                  <span v-else>—</span>
                </CTableDataCell>
                <CTableDataCell class="d-mobile-none small text-muted">
                  <template v-if="link.last_event">
                    {{ eventLabel(link.last_event) }}<br />{{ formatDateTime(link.last_event.created_at) }}
                  </template>
                  <span v-else>—</span>
                </CTableDataCell>
                <CTableDataCell class="text-end">
                  <CButton color="primary" size="sm" variant="ghost" @click.stop="openDetail(link)">Ver</CButton>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="!loading && filteredLinks.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">No hay pagos en esta vista</CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CModal :visible="!!detail" size="lg" @close="closeDetail">
    <CModalHeader close-button>
      <CModalTitle>Pago {{ detail?.bold_link_id }}</CModalTitle>
    </CModalHeader>
    <CModalBody v-if="detail">
      <CRow class="g-3 mb-3">
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Estado</div>
          <CBadge :color="statusInfo(detail.status).color">{{ statusInfo(detail.status).label }}</CBadge>
          <CBadge v-if="detail.needs_review" color="danger" class="ms-1">Revisar</CBadge>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Monto</div>
          <div class="fw-bold">{{ formatCurrency(detail.amount) }}</div>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Método</div>
          <div>{{ detail.bold_payment_method || '—' }}</div>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Transacción Bold</div>
          <div class="small">{{ detail.bold_transaction_id || '—' }}</div>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Cabaña</div>
          <div>{{ detail.venue_name || '—' }}</div>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Cliente</div>
          <div>{{ detail.client_name || '—' }}</div>
          <div v-if="detail.agent_name" class="small text-muted">vía {{ detail.agent_name }}</div>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Reserva</div>
          <RouterLink v-if="detail.accommodation_id" :to="`/business/accommodations/${detail.accommodation_id}`">Ver reserva</RouterLink>
          <div v-else class="text-muted">{{ detail.check_in ? `${formatDate(detail.check_in)} (sin crear)` : '—' }}</div>
        </CCol>
        <CCol :xs="6" :md="3">
          <div class="small text-muted">Vence</div>
          <div class="small">{{ formatDateTime(detail.expiration_date) }}</div>
        </CCol>
      </CRow>

      <div class="small mb-3">
        <a :href="detail.bold_url" target="_blank" rel="noopener">Abrir el link de pago</a>
        <span class="text-muted"> · Para ver comisión y neto, busca la transacción en panel.bold.co</span>
      </div>

      <CAlert v-if="detail.needs_review" color="warning" class="small py-2">
        <template v-if="detail.status === 'PAID'">
          Bold lo reporta pagado pero el pago no quedó registrado aquí. Revisa el historial y concílialo a mano.
        </template>
        <template v-else>
          El link venció sin confirmación. Si en el panel de Bold aparece la venta, concílialo a mano con su ID de transacción.
        </template>
      </CAlert>
      <CAlert v-if="actionMessage" :color="actionMessage.color" class="small py-2">{{ actionMessage.text }}</CAlert>

      <h6 class="mt-3">Historial</h6>
      <ul class="list-unstyled small border-start ps-3">
        <li v-for="event in detail.events" :key="event.id" class="mb-2">
          <div>
            <strong>{{ eventLabel(event) }}</strong>
            <span v-if="event.to_status" class="text-muted">
              · {{ event.from_status ? `${statusInfo(event.from_status).label} → ` : '' }}{{ statusInfo(event.to_status).label }}
            </span>
          </div>
          <div class="text-muted">
            {{ formatDateTime(event.created_at, true) }} · {{ sourceLabel(event.source) }}
            <span v-if="event.actor_name"> · {{ event.actor_name }}</span>
          </div>
          <div v-if="eventDetail(event)" class="text-muted">{{ eventDetail(event) }}</div>
        </li>
        <li v-if="!detail.events.length" class="text-muted">
          Sin eventos registrados (pago anterior al historial).
        </li>
      </ul>

      <div v-if="detail.webhook_payload" class="mt-2">
        <CButton size="sm" color="link" class="p-0" @click="showPayload = !showPayload">
          {{ showPayload ? 'Ocultar' : 'Ver' }} última notificación de Bold
        </CButton>
        <pre v-if="showPayload" class="small bg-body-tertiary p-2 rounded mt-2" style="max-height: 240px; overflow: auto">{{ JSON.stringify(detail.webhook_payload, null, 2) }}</pre>
      </div>

      <div v-if="showReconcile" class="border rounded p-3 mt-3">
        <h6>Conciliar a mano</h6>
        <p class="small text-muted mb-2">
          Solo si la venta aparece aprobada en panel.bold.co. Se registra como si Bold lo hubiera confirmado:
          crea la reserva, el pago verificado, la comisión y el contrato, y avisa en el chat. Queda en el historial a tu nombre.
        </p>
        <CRow class="g-2">
          <CCol :md="6">
            <CFormInput v-model="reconcile.transaction_id" size="sm" placeholder="ID de transacción en Bold (ej. TNJ...)" />
          </CCol>
          <CCol :md="6">
            <CFormSelect v-model="reconcile.payment_method" size="sm">
              <option value="">Método (opcional)</option>
              <option value="QR_BOLD">QR / Bre-B</option>
              <option value="PSE">PSE</option>
              <option value="NEQUI">Nequi</option>
              <option value="CREDIT_CARD">Tarjeta</option>
              <option value="BOTON_BANCOLOMBIA">Botón Bancolombia</option>
            </CFormSelect>
          </CCol>
          <CCol :xs="12">
            <CFormTextarea v-model="reconcile.note" rows="2" size="sm" placeholder="Por qué se concilia a mano (queda en el historial)" />
          </CCol>
        </CRow>
        <div class="d-flex justify-content-end gap-2 mt-2">
          <CButton size="sm" color="secondary" variant="outline" @click="showReconcile = false">Cancelar</CButton>
          <CButton size="sm" color="success" :disabled="busy || !reconcile.transaction_id || reconcile.note.trim().length < 5" @click="markPaid">
            Confirmar pago
          </CButton>
        </div>
      </div>
    </CModalBody>
    <CModalFooter v-if="detail">
      <CButton color="secondary" variant="outline" :disabled="busy" @click="syncNow">
        <CSpinner v-if="busy" size="sm" class="me-1" /> Consultar estado en Bold
      </CButton>
      <CButton v-if="!detail.payment_id && !showReconcile" color="warning" :disabled="busy" @click="showReconcile = true">
        Conciliar a mano
      </CButton>
      <CButton color="primary" @click="closeDetail">Cerrar</CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const links = ref([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const filters = reactive({ view: 'open', from: '', to: '' })
const detail = ref(null)
const busy = ref(false)
const actionMessage = ref(null)
const showPayload = ref(false)
const showReconcile = ref(false)
const reconcile = reactive({ transaction_id: '', payment_method: '', note: '' })
let timer = null

const OPEN = ['ACTIVE', 'PROCESSING']
const STATUS = {
  ACTIVE: { label: 'Esperando pago', color: 'info' },
  PROCESSING: { label: 'En proceso', color: 'warning' },
  PAID: { label: 'Pagado', color: 'success' },
  REJECTED: { label: 'Rechazado', color: 'danger' },
  EXPIRED: { label: 'Vencido', color: 'secondary' },
  CANCELLED: { label: 'Cancelado', color: 'secondary' },
  SANDBOX_IGNORED: { label: 'Prueba ignorada', color: 'dark' }
}
const statusInfo = (status) => STATUS[status] || { label: status || '—', color: 'light' }

const tabs = [
  { value: 'open', label: 'En curso', color: 'warning' },
  { value: 'review', label: 'Requieren revisión', color: 'danger' },
  { value: 'paid', label: 'Pagados', color: 'success' },
  { value: 'closed', label: 'Sin pago', color: 'secondary' },
  { value: 'all', label: 'Todos', color: 'primary' }
]
const inView = (link, view) => ({
  open: OPEN.includes(link.status),
  review: link.needs_review,
  paid: link.status === 'PAID',
  closed: !OPEN.includes(link.status) && link.status !== 'PAID',
  all: true
})[view]
const counts = computed(() => Object.fromEntries(tabs.map(t => [t.value, links.value.filter(l => inView(l, t.value)).length])))

const filteredLinks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return links.value.filter(l => inView(l, filters.view) && (!q || [
    l.client_name, l.agent_name, l.venue_name, l.bold_link_id, l.bold_transaction_id
  ].some(v => v && String(v).toLowerCase().includes(q))))
})

const EVENTS = {
  created: 'Link creado',
  status_changed: 'Cambio de estado',
  webhook_received: 'Notificación de Bold',
  paid: 'Pago confirmado',
  recorded: 'Reserva y pago registrados',
  record_failed: 'Error al registrar',
  checked: 'Consulta manual a Bold',
  unpaid_notified: 'Aviso al chat (sin pago)',
  sandbox_ignored: 'Pago de prueba ignorado'
}
const eventLabel = (event) => EVENTS[event.type] || event.type
const sourceLabel = (source) => ({
  poll: 'revisión automática', webhook: 'webhook de Bold', manual: 'manual', chat: 'chat', system: 'sistema'
})[source] || source
const eventDetail = (event) => {
  const d = event.detail || {}
  const parts = []
  if (d.transaction_id) parts.push(`Transacción ${d.transaction_id}`)
  if (d.payment_method) parts.push(d.payment_method)
  if (d.bold_status) parts.push(`Bold dice: ${statusInfo(d.bold_status).label}`)
  if (d.type) parts.push(d.type)
  if (d.note) parts.push(`Nota: ${d.note}`)
  if (d.error) parts.push(`Error: ${d.error}`)
  if (d.reason) parts.push({ QR_EXPIRED: 'QR vencido', EXPIRED: 'Link vencido', REJECTED: 'Rechazado', CANCELLED: 'Cancelado' }[d.reason] || d.reason)
  if (d.commission && !d.commission.no_rules) parts.push(`Comisión ${formatCurrency(d.commission.total)}`)
  return parts.join(' · ')
}

const formatDate = (date) => date
  ? new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : '—'
const formatDateTime = (date, seconds = false) => date
  ? new Date(date).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    ...(seconds && { second: '2-digit' }), timeZone: 'America/Bogota'
  })
  : '—'
const formatCurrency = (amount) => amount === null || amount === undefined
  ? '—'
  : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)

async function loadLinks() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const response = await fetch(`/api/bold/links?${params}`)
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Error ${response.status}`)
    links.value = await response.json()
    error.value = ''
  } catch (err) {
    error.value = `No se pudieron cargar los pagos: ${err.message}`
  } finally {
    loading.value = false
  }
}

async function loadDetail(id) {
  const response = await fetch(`/api/bold/links/${id}`)
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Error ${response.status}`)
  detail.value = await response.json()
}

async function openDetail(link) {
  actionMessage.value = null
  showPayload.value = false
  showReconcile.value = false
  Object.assign(reconcile, { transaction_id: link.bold_transaction_id || '', payment_method: link.bold_payment_method || '', note: '' })
  try {
    await loadDetail(link.id)
  } catch (err) {
    error.value = `No se pudo abrir el pago: ${err.message}`
  }
}

function closeDetail() {
  detail.value = null
}

async function syncNow() {
  busy.value = true
  actionMessage.value = null
  try {
    const response = await fetch(`/api/bold/links/${detail.value.id}/sync`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    actionMessage.value = { color: 'info', text: `Bold dice: ${statusInfo(data.bold.status).label}${data.bold.transaction_id ? ` (transacción ${data.bold.transaction_id})` : ''}.` }
    await Promise.all([loadDetail(detail.value.id), loadLinks()])
  } catch (err) {
    actionMessage.value = { color: 'danger', text: err.message }
  } finally {
    busy.value = false
  }
}

async function markPaid() {
  busy.value = true
  actionMessage.value = null
  try {
    const response = await fetch(`/api/bold/links/${detail.value.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reconcile)
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    showReconcile.value = false
    actionMessage.value = { color: 'success', text: 'Pago conciliado: se registraron la reserva, el pago y el aviso en el chat.' }
    await Promise.all([loadDetail(detail.value.id), loadLinks()])
  } catch (err) {
    actionMessage.value = { color: 'danger', text: err.message }
  } finally {
    busy.value = false
  }
}

watch(() => [filters.from, filters.to], loadLinks)

onMounted(() => {
  loadLinks()
  timer = setInterval(() => {
    if (!busy.value) loadLinks()
  }, 30000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>
