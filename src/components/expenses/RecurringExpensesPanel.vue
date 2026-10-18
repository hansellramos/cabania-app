<template>
  <div>
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
      <div style="min-width: 220px;">
        <CFormLabel class="small">Sede</CFormLabel>
        <CFormSelect :model-value="venueId" size="sm" @update:model-value="emit('update:venueId', $event)">
          <option value="">Todas las sedes</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
        </CFormSelect>
      </div>
      <CButton color="primary" size="sm" @click="openCreate">
        <CIcon name="cil-plus" class="me-1" /> Nuevo recurrente
      </CButton>
    </div>
    <div class="small text-body-secondary mb-2">
      Gastos que se repiten (cuidandero, servicios, internet, piscina...). Registra cada periodo con un clic.
    </div>

    <div v-if="loading" class="text-center py-4">
      <CSpinner color="primary" size="sm" />
    </div>
    <CTable v-else hover responsive>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Gasto</CTableHeaderCell>
          <CTableHeaderCell class="d-mobile-none">Sede</CTableHeaderCell>
          <CTableHeaderCell class="d-mobile-none">Frecuencia</CTableHeaderCell>
          <CTableHeaderCell>Monto aprox.</CTableHeaderCell>
          <CTableHeaderCell>Vence</CTableHeaderCell>
          <CTableHeaderCell>Estado</CTableHeaderCell>
          <CTableHeaderCell>Acciones</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        <CTableRow v-for="item in items" :key="item.id">
          <CTableDataCell>
            <div class="fw-semibold">{{ item.name }}</div>
            <div class="d-flex flex-wrap gap-1 mt-1">
              <CBadge v-if="item.category" :color="item.category.color || 'primary'">
                <CIcon v-if="item.category.icon" :name="item.category.icon" class="me-1" />
                {{ item.category.name }}
              </CBadge>
              <span v-if="item.provider" class="small text-body-secondary">{{ item.provider.name }}</span>
              <span v-if="item.payment_method" class="small text-body-secondary">· {{ item.payment_method }}</span>
            </div>
          </CTableDataCell>
          <CTableDataCell class="d-mobile-none">{{ item.venue_data?.name || '—' }}</CTableDataCell>
          <CTableDataCell class="d-mobile-none">
            {{ frequencyLabel(item) }}
          </CTableDataCell>
          <CTableDataCell>{{ item.expected_amount ? formatCurrency(item.expected_amount) : '—' }}</CTableDataCell>
          <CTableDataCell>
            <template v-if="item.current_period">{{ formatDate(item.current_period) }}</template>
            <template v-else-if="item.next_due">{{ formatDate(item.next_due) }}</template>
            <span v-else class="text-body-secondary">—</span>
            <div v-if="item.overdue_periods?.length > 1" class="small text-danger">
              {{ item.overdue_periods.length }} periodos sin registrar
            </div>
          </CTableDataCell>
          <CTableDataCell>
            <CBadge :color="statusColor(item.status)">{{ statusLabel(item.status) }}</CBadge>
            <div v-if="item.status === 'registrado' && item.last_expense" class="small text-body-secondary">
              {{ formatCurrency(item.last_expense.amount) }} el {{ formatDate(item.last_expense.expense_date) }}
            </div>
            <div v-if="item.status === 'omitido' && item.last_due" class="small">
              <a href="javascript:void(0)" @click="undoSkip(item, item.last_due)">Deshacer omisión</a>
            </div>
          </CTableDataCell>
          <CTableDataCell>
            <div class="d-flex gap-1 flex-wrap">
              <CButton
                v-if="item.current_period"
                :color="item.status === 'vencido' ? 'danger' : 'success'"
                size="sm"
                @click="register(item)"
                :title="`Registrar el periodo del ${formatDate(item.current_period)}`"
              >
                Registrar
              </CButton>
              <CButton
                v-if="item.current_period && (item.status === 'vencido' || item.status === 'pendiente')"
                color="secondary"
                size="sm"
                variant="outline"
                @click="confirmSkip(item)"
                title="Omitir este periodo"
              >
                Omitir
              </CButton>
              <CButton color="info" size="sm" @click="openEdit(item)" title="Editar">
                <CIcon name="cil-pencil" />
              </CButton>
              <CButton color="danger" size="sm" variant="ghost" @click="confirmDelete(item)" title="Eliminar">
                <CIcon name="cil-trash" />
              </CButton>
            </div>
          </CTableDataCell>
        </CTableRow>
        <CTableRow v-if="items.length === 0">
          <CTableDataCell colspan="7" class="text-center text-muted py-4">
            No hay gastos recurrentes
          </CTableDataCell>
        </CTableRow>
      </CTableBody>
    </CTable>

    <!-- Create / edit -->
    <CModal teleport size="lg" :visible="showForm" @close="showForm = false">
      <CModalHeader>
        <CModalTitle>{{ editing ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente' }}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CAlert v-if="formError" color="danger" class="py-2">{{ formError }}</CAlert>
        <CRow class="g-3">
          <CCol :md="6">
            <CFormLabel>Nombre *</CFormLabel>
            <CFormInput v-model="form.name" placeholder="Ej: Nómina cuidandero, Internet, Energía" />
          </CCol>
          <CCol :md="6">
            <CFormLabel>Sede *</CFormLabel>
            <CFormSelect v-model="form.venue_id">
              <option value="">Seleccionar...</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Categoría</CFormLabel>
            <CFormSelect v-model="form.category_id" @change="form.subcategory = ''">
              <option value="">Sin categoría</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Subcategoría</CFormLabel>
            <CFormSelect v-model="form.subcategory" :disabled="!subcategoryOptions.length">
              <option value="">{{ subcategoryOptions.length ? 'Seleccionar...' : 'N/A para esta categoría' }}</option>
              <option v-for="sub in subcategoryOptions" :key="sub" :value="sub">{{ sub }}</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Proveedor</CFormLabel>
            <CFormSelect v-model="form.provider_id">
              <option value="">Sin proveedor</option>
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Monto aproximado</CFormLabel>
            <CFormInput type="number" v-model="form.expected_amount" placeholder="0" min="0" />
            <div class="form-text">Se usa para prellenar; al registrar puedes cambiarlo.</div>
          </CCol>
          <CCol :md="4">
            <CFormLabel>Frecuencia *</CFormLabel>
            <CFormSelect v-model="form.frequency" @change="form.due_day = ''">
              <option v-for="f in frequencies" :key="f.value" :value="f.value">{{ f.label }}</option>
            </CFormSelect>
          </CCol>
          <CCol :md="4">
            <CFormLabel>{{ form.frequency === 'weekly' ? 'Día de la semana' : 'Día de pago' }}</CFormLabel>
            <CFormSelect v-if="form.frequency === 'weekly'" v-model="form.due_day">
              <option value="">El de la fecha de inicio</option>
              <option v-for="(name, i) in weekdays" :key="i" :value="i + 1">{{ name }}</option>
            </CFormSelect>
            <div v-else-if="form.frequency === 'biweekly'" class="form-control-plaintext small">
              Días 15 y último del mes
            </div>
            <CFormInput v-else type="number" v-model="form.due_day" min="1" max="31" placeholder="El de la fecha de inicio" />
          </CCol>
          <CCol :md="4">
            <CFormLabel>Medio de pago</CFormLabel>
            <CFormInput v-model="form.payment_method" placeholder="Ej: Transferencia, Nequi" />
          </CCol>
          <CCol :md="4">
            <CFormLabel>Desde *</CFormLabel>
            <CFormInput type="date" v-model="form.start_date" />
            <div class="form-text">Se hace seguimiento desde esta fecha.</div>
          </CCol>
          <CCol :md="4">
            <CFormLabel>Hasta</CFormLabel>
            <CFormInput type="date" v-model="form.end_date" />
          </CCol>
          <CCol :md="4" class="d-flex align-items-center">
            <CFormSwitch v-model="form.is_active" label="Activo" id="recurring-active" />
          </CCol>
          <CCol :md="12">
            <CFormLabel>Descripción</CFormLabel>
            <CFormTextarea v-model="form.description" rows="2" />
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" @click="showForm = false">Cancelar</CButton>
        <CButton color="primary" @click="save" :disabled="saving">
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </CButton>
      </CModalFooter>
    </CModal>

    <!-- Skip -->
    <CModal teleport :visible="!!toSkip" @close="toSkip = null">
      <CModalHeader>
        <CModalTitle>Omitir periodo</CModalTitle>
      </CModalHeader>
      <CModalBody>
        ¿Omitir <strong>{{ toSkip?.name }}</strong> del periodo que vence el {{ formatDate(toSkip?.current_period) }}?
        No se registrará gasto ni se enviarán recordatorios de ese periodo.
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" @click="toSkip = null">Cancelar</CButton>
        <CButton color="warning" @click="skip" :disabled="saving">Omitir</CButton>
      </CModalFooter>
    </CModal>

    <!-- Delete -->
    <CModal teleport :visible="!!toDelete" @close="toDelete = null">
      <CModalHeader>
        <CModalTitle>Confirmar eliminación</CModalTitle>
      </CModalHeader>
      <CModalBody>
        ¿Eliminar el gasto recurrente <strong>{{ toDelete?.name }}</strong>? Los gastos ya registrados se conservan.
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" @click="toDelete = null">Cancelar</CButton>
        <CButton color="danger" @click="remove" :disabled="saving">Eliminar</CButton>
      </CModalFooter>
    </CModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  CRow, CCol, CButton, CBadge, CSpinner, CAlert,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormInput, CFormSelect, CFormTextarea, CFormSwitch
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { todayIso } from '@/utils/dates'
import { RECURRING_STATUS, recurringFrequencyLabel } from '@/utils/recurringExpenses'

const props = defineProps({
  venueId: { type: String, default: '' },
  venues: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:venueId'])

const router = useRouter()

const items = ref([])
const providers = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const toSkip = ref(null)
const toDelete = ref(null)

const frequencies = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'yearly', label: 'Anual' }
]
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Same subcategories as the expense form.
const subcategoryMap = {
  'Servicios': ['Internet/Tv', 'Agua', 'Energía', 'Gas', 'Aseo'],
  'Mantenimiento': ['Piscina', 'Equipos', 'Eléctrico', 'Aires Acondicionados', 'Kiosco']
}

const emptyForm = () => ({
  name: '',
  venue_id: props.venueId || '',
  category_id: '',
  subcategory: '',
  provider_id: '',
  expected_amount: '',
  frequency: 'monthly',
  due_day: '',
  payment_method: '',
  start_date: todayIso(),
  end_date: '',
  is_active: true,
  description: ''
})
const form = ref(emptyForm())

const subcategoryOptions = computed(() => {
  const category = props.categories.find(c => c.id === form.value.category_id)
  return category ? subcategoryMap[category.name] || [] : []
})

const statusLabel = (status) => RECURRING_STATUS[status]?.label || status
const statusColor = (status) => RECURRING_STATUS[status]?.color || 'secondary'
const frequencyLabel = recurringFrequencyLabel

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const load = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (props.venueId) params.append('venue_id', props.venueId)
    const response = await fetch(`/api/recurring-expenses${params.toString() ? '?' + params : ''}`, { credentials: 'include' })
    if (response.ok) items.value = await response.json()
  } catch (error) {
    console.error('Error loading recurring expenses:', error)
  } finally {
    loading.value = false
  }
}

const loadProviders = async (venueId) => {
  const venue = props.venues.find(v => String(v.id) === String(venueId))
  const params = new URLSearchParams()
  if (venue?.organization) params.append('organization_id', venue.organization)
  try {
    const response = await fetch(`/api/providers?${params}`, { credentials: 'include' })
    if (response.ok) providers.value = await response.json()
  } catch (error) {
    console.error('Error loading providers:', error)
  }
}

watch(() => form.value.venue_id, (venueId) => { if (showForm.value) loadProviders(venueId) })
watch(() => props.venueId, load)

const openCreate = () => {
  editing.value = null
  formError.value = ''
  form.value = emptyForm()
  showForm.value = true
  loadProviders(form.value.venue_id)
}

const openEdit = (item) => {
  editing.value = item
  formError.value = ''
  form.value = {
    name: item.name,
    venue_id: item.venue_id || '',
    category_id: item.category_id || '',
    subcategory: item.subcategory || '',
    provider_id: item.provider_id || '',
    expected_amount: item.expected_amount ?? '',
    frequency: item.frequency,
    due_day: item.due_day ?? '',
    payment_method: item.payment_method || '',
    start_date: item.start_date ? item.start_date.split('T')[0] : '',
    end_date: item.end_date ? item.end_date.split('T')[0] : '',
    is_active: item.is_active,
    description: item.description || ''
  }
  showForm.value = true
  loadProviders(form.value.venue_id)
}

const save = async () => {
  formError.value = ''
  if (!form.value.name || !form.value.venue_id || !form.value.start_date) {
    formError.value = 'Complete nombre, sede y fecha de inicio'
    return
  }
  saving.value = true
  try {
    const response = await fetch(editing.value ? `/api/recurring-expenses/${editing.value.id}` : '/api/recurring-expenses', {
      method: editing.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })
    if (response.ok) {
      showForm.value = false
      await load()
    } else {
      formError.value = (await response.json()).error || 'Error al guardar'
    }
  } catch (error) {
    console.error('Error saving recurring expense:', error)
    formError.value = 'Error al guardar'
  } finally {
    saving.value = false
  }
}

// Opens the expense form prefilled for the period; the amount stays editable.
const register = (item) => {
  router.push({
    path: '/business/expenses/create',
    query: { venue_id: item.venue_id, recurring_expense_id: item.id, recurring_period: item.current_period }
  })
}

const confirmSkip = (item) => { toSkip.value = item }

const skip = async () => {
  saving.value = true
  try {
    const response = await fetch(`/api/recurring-expenses/${toSkip.value.id}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ period: toSkip.value.current_period })
    })
    if (response.ok) {
      toSkip.value = null
      await load()
    }
  } catch (error) {
    console.error('Error skipping period:', error)
  } finally {
    saving.value = false
  }
}

const undoSkip = async (item, period) => {
  try {
    const response = await fetch(`/api/recurring-expenses/${item.id}/skip/${period}`, { method: 'DELETE', credentials: 'include' })
    if (response.ok) await load()
  } catch (error) {
    console.error('Error undoing skip:', error)
  }
}

const confirmDelete = (item) => { toDelete.value = item }

const remove = async () => {
  saving.value = true
  try {
    const response = await fetch(`/api/recurring-expenses/${toDelete.value.id}`, { method: 'DELETE', credentials: 'include' })
    if (response.ok) {
      toDelete.value = null
      await load()
    }
  } catch (error) {
    console.error('Error deleting recurring expense:', error)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
