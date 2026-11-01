<template>
  <div>
    <p class="text-body-secondary small mb-3">
      Envía los ingresos (pagos verificados) y egresos de esta organización a AirBudget en cuanto se crean,
      editan o borran. No se envían datos de los huéspedes (nombres, teléfonos ni correos).
    </p>

    <CAlert v-if="toast.show" :color="toast.color" class="mb-3 py-2">{{ toast.text }}</CAlert>

    <div v-if="loading" class="text-center py-2"><CSpinner size="sm" /></div>
    <CAlert v-else-if="forbidden" color="info" class="py-2 small">
      Solo un administrador de la organización puede ver o cambiar esta integración.
    </CAlert>
    <template v-else-if="state">
      <CAlert v-if="!state.encryption_ready" color="warning" class="py-2 small">
        Falta <code>SECRETS_ENCRYPTION_KEY</code> en el servidor: no se puede guardar el secreto.
      </CAlert>
      <CAlert v-if="integration && !integration.enabled && integration.disabled_reason" color="warning" class="py-2 small">
        Se desactivó sola: {{ integration.disabled_reason }}. Revisa AirBudget y vuelve a activarla.
      </CAlert>

      <!-- Configuración -->
      <CForm class="mb-3" @submit.prevent="save">
        <CRow class="g-2">
          <CCol :xs="12" :md="7">
            <CFormLabel class="small" for="airbudget-url">URL del webhook</CFormLabel>
            <CFormInput id="airbudget-url" v-model="form.webhook_url" size="sm" type="url" placeholder="https://…" autocomplete="off" />
          </CCol>
          <CCol :xs="12" :md="5">
            <CFormLabel class="small" for="airbudget-secret">Secreto</CFormLabel>
            <CFormInput
              id="airbudget-secret"
              v-model="form.secret"
              size="sm"
              type="password"
              autocomplete="new-password"
              :placeholder="integration?.has_secret ? 'Guardado (escribe uno nuevo para cambiarlo)' : 'whsec_…'"
            />
          </CCol>
        </CRow>
        <small class="text-body-secondary d-block mt-1">El secreto se guarda cifrado y no se vuelve a mostrar.</small>
        <div class="d-flex flex-wrap align-items-center gap-3 mt-2">
          <CButton type="submit" color="primary" size="sm" :disabled="busy !== null || !canSave">
            <CSpinner v-if="busy === 'save'" size="sm" class="me-1" />Guardar
          </CButton>
          <CFormSwitch
            id="airbudget-enabled"
            :model-value="!!integration?.enabled"
            :disabled="!integration || busy !== null"
            :label="integration?.enabled ? 'Activa' : 'Inactiva'"
            @update:model-value="setEnabled"
          />
        </div>
      </CForm>

      <!-- Acciones -->
      <div class="d-flex flex-wrap align-items-end gap-2 mb-3">
        <CButton color="secondary" variant="outline" size="sm" :disabled="!integration || busy !== null" @click="ping">
          <CSpinner v-if="busy === 'ping'" size="sm" class="me-1" />Probar conexión
        </CButton>
        <div class="d-flex align-items-end gap-2 ms-md-auto">
          <div>
            <CFormLabel class="small mb-1" for="airbudget-since">Enviar desde</CFormLabel>
            <CFormInput id="airbudget-since" v-model="since" size="sm" type="date" />
          </div>
          <CButton color="secondary" variant="outline" size="sm" :disabled="!integration?.enabled || !since || busy !== null" @click="backfill">
            <CSpinner v-if="busy === 'backfill'" size="sm" class="me-1" />Enviar
          </CButton>
        </div>
      </div>

      <!-- Registro -->
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h6 class="mb-0">Últimos envíos</h6>
        <CButton color="link" size="sm" class="p-0" :disabled="busy !== null" @click="load">Actualizar</CButton>
      </div>
      <div v-if="!state.deliveries.length" class="text-body-secondary small">Todavía no hay envíos.</div>
      <CTable v-else small responsive hover class="small align-middle mb-0">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Fecha</CTableHeaderCell>
            <CTableHeaderCell>Evento</CTableHeaderCell>
            <CTableHeaderCell>Movimiento</CTableHeaderCell>
            <CTableHeaderCell>Estado</CTableHeaderCell>
            <CTableHeaderCell class="text-end">HTTP</CTableHeaderCell>
            <CTableHeaderCell class="text-end">Intentos</CTableHeaderCell>
            <CTableHeaderCell />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="d in state.deliveries" :key="d.id">
            <CTableDataCell class="text-nowrap">{{ formatDateTime(d.created_at) }}</CTableDataCell>
            <CTableDataCell class="text-nowrap">{{ TYPE_LABELS[d.type] || d.type }}</CTableDataCell>
            <CTableDataCell>
              <template v-if="d.kind">
                <CBadge :color="d.kind === 'income' ? 'success' : 'danger'" class="me-1">{{ d.kind === 'income' ? 'Ingreso' : 'Egreso' }}</CBadge>
                <span v-if="d.concept">{{ d.concept }}</span>
                <span v-if="d.amount != null" class="text-body-secondary"> · {{ formatMoney(d.amount) }}</span>
              </template>
              <span v-else class="text-body-secondary">—</span>
              <div v-if="d.last_error && d.status !== 'delivered'" class="text-danger text-break">{{ d.last_error }}</div>
              <div v-if="d.next_attempt_at" class="text-body-secondary">Próximo intento: {{ formatDateTime(d.next_attempt_at) }}</div>
            </CTableDataCell>
            <CTableDataCell><CBadge :color="STATUS[d.status]?.color || 'secondary'">{{ STATUS[d.status]?.label || d.status }}</CBadge></CTableDataCell>
            <CTableDataCell class="text-end">{{ d.last_status_code ?? '—' }}</CTableDataCell>
            <CTableDataCell class="text-end">{{ d.attempts }}</CTableDataCell>
            <CTableDataCell class="text-end">
              <CButton
                v-if="d.status === 'failed' && d.type !== 'ping'"
                color="primary"
                variant="ghost"
                size="sm"
                :disabled="busy !== null || !integration?.enabled"
                @click="retry(d)"
              >
                <CSpinner v-if="busy === d.id" size="sm" />
                <span v-else>Reintentar</span>
              </CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
    </template>
  </div>
</template>

<script setup>
// Integración con AirBudget (server/services/airbudgetSync.js): URL y secreto del
// webhook, activar/desactivar, probar, enviar desde una fecha y registro de envíos.
import { ref, reactive, computed, onMounted } from 'vue'

const props = defineProps({
  organizationId: { type: String, required: true }
})

const TYPE_LABELS = { 'movement.upserted': 'Crear / actualizar', 'movement.deleted': 'Borrar', ping: 'Prueba' }
const STATUS = {
  pending: { label: 'Pendiente', color: 'warning' },
  delivered: { label: 'Entregado', color: 'success' },
  failed: { label: 'Fallido', color: 'danger' }
}

const state = ref(null)
const loading = ref(false)
const forbidden = ref(false)
const busy = ref(null)
const since = ref('')
const form = reactive({ webhook_url: '', secret: '' })
const toast = reactive({ show: false, text: '', color: 'success' })

const integration = computed(() => state.value?.integration || null)
const canSave = computed(() => !!form.webhook_url && (!!form.secret || !!integration.value?.has_secret))

const base = () => `/api/organizations/${props.organizationId}/airbudget`

function showToast(text, color = 'success') {
  toast.text = text
  toast.color = color
  toast.show = true
  setTimeout(() => { toast.show = false }, 5000)
}

function apply(data) {
  state.value = data
  form.webhook_url = data.integration?.webhook_url || form.webhook_url
}

async function call(method, path = '', body) {
  const res = await fetch(`${base()}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error de conexión'), { status: res.status })
  return data
}

async function load() {
  loading.value = !state.value
  try {
    apply(await call('GET'))
  } catch (err) {
    if (err.status === 403) forbidden.value = true
    else showToast(err.message, 'danger')
  } finally {
    loading.value = false
  }
}

async function run(key, fn) {
  busy.value = key
  try { await fn() } catch (err) { showToast(err.message, 'danger') } finally { busy.value = null }
}

const save = () => run('save', async () => {
  const body = { webhook_url: form.webhook_url }
  if (form.secret) body.secret = form.secret
  apply(await call('PUT', '', body))
  form.secret = ''
  showToast('Integración guardada')
})

const setEnabled = (enabled) => run('enabled', async () => {
  apply(await call('PUT', '', { enabled }))
  showToast(enabled ? 'Integración activada' : 'Integración desactivada')
})

const ping = () => run('ping', async () => {
  const data = await call('POST', '/ping')
  apply(data)
  if (data.ok) showToast(`Conexión correcta (HTTP ${data.status_code})`)
  else showToast(`Falló la prueba: ${data.error}`, 'danger')
})

const backfill = () => run('backfill', async () => {
  const data = await call('POST', '/backfill', { since: since.value })
  apply(data)
  showToast(`Se encolaron ${data.queued} movimientos (${data.incomes} ingresos y ${data.expenses} egresos)`)
})

const retry = (d) => run(d.id, async () => {
  apply(await call('POST', `/deliveries/${d.id}/retry`))
  showToast('Se volverá a enviar en unos segundos')
})

function formatDateTime(value) {
  return new Date(value).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatMoney(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

onMounted(load)
</script>
