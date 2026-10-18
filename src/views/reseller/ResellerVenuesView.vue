<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Mis cabañas</strong>
          <span class="small text-body-secondary ms-2">Las tuyas y las que vendes como comisionista</span>
        </CCardHeader>
        <CCardBody>
          <CAlert v-if="errorMessage" color="danger" dismissible @close="errorMessage = ''">{{ errorMessage }}</CAlert>
          <div v-if="loadingVenues" class="text-center py-3"><CSpinner /></div>
          <div v-else-if="venues.length === 0" class="text-center text-muted py-3">
            Aún no tienes cabañas. Pide a cada cabaña que te vincule como comisionista.
          </div>
          <CTable v-else hover responsive class="align-middle mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Cabaña</CTableHeaderCell>
                <CTableHeaderCell>Relación</CTableHeaderCell>
                <CTableHeaderCell>Tu comisión</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="venue in venues" :key="venue.id">
                <CTableDataCell>
                  <div class="fw-semibold">{{ venue.name }}</div>
                  <div v-if="venue.organization_name" class="small text-body-secondary">{{ venue.organization_name }}</div>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="venue.source === 'comisionista' ? 'info' : 'secondary'">
                    {{ venue.source === 'comisionista' ? 'Comisionista' : 'Propia' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell class="small">{{ rulesSummary(venue.agent) }}</CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CCard class="mb-4">
        <CCardHeader><strong>Disponibilidad en todas mis cabañas</strong></CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3" :sm="6">
              <CFormLabel>Tipo de estadía</CFormLabel>
              <CFormSelect v-model="stayType" @change="onStayTypeChange">
                <option value="pasadia">Pasadía</option>
                <option value="hospedaje">Hospedaje</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3" :sm="6">
              <CFormLabel>Fecha de entrada</CFormLabel>
              <CFormInput v-model="checkIn" type="date" :min="today" />
            </CCol>
            <CCol v-if="stayType === 'hospedaje'" :md="2" :sm="6">
              <CFormLabel>Fecha de salida</CFormLabel>
              <CFormInput v-model="checkOut" type="date" :min="checkIn || today" />
            </CCol>
            <CCol :md="stayType === 'hospedaje' ? 1 : 2" :sm="3">
              <CFormLabel>Adultos</CFormLabel>
              <CFormInput v-model.number="adults" type="number" min="1" max="100" />
            </CCol>
            <CCol :md="stayType === 'hospedaje' ? 1 : 2" :sm="3">
              <CFormLabel>Niños</CFormLabel>
              <CFormInput v-model.number="children" type="number" min="0" max="100" />
            </CCol>
            <CCol :md="2" class="d-flex align-items-end">
              <CButton color="primary" :disabled="loading || !canSearch" @click="search">
                <CSpinner v-if="loading" size="sm" class="me-1" /> Buscar
              </CButton>
            </CCol>
          </CRow>

          <div v-if="searched && !loading">
            <div v-if="results.length === 0" class="text-center text-muted py-4">Ninguna de tus cabañas tiene planes activos</div>
            <CRow v-else>
              <CCol v-for="venue in results" :key="venue.id" :md="6" :lg="4" class="mb-4">
                <CCard class="h-100" :class="venue.is_available ? 'border-success' : 'border-danger'">
                  <CCardBody class="d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <h5 class="mb-0">{{ venue.name }}</h5>
                      <CBadge :color="venue.is_available ? 'success' : 'danger'">
                        {{ venue.is_available ? 'Disponible' : 'Ocupado' }}
                      </CBadge>
                    </div>
                    <div class="small text-body-secondary mb-2">
                      {{ venue.organization_name }}
                      <CBadge :color="venue.source === 'comisionista' ? 'info' : 'secondary'" class="ms-1">
                        {{ venue.source === 'comisionista' ? 'Comisionista' : 'Propia' }}
                      </CBadge>
                    </div>
                    <div v-if="venue.agent" class="small mb-2">Comisión: {{ rulesSummary(venue.agent) }}</div>
                    <div v-if="!venue.has_matching_plan" class="small text-warning mb-2">
                      No hay plan compatible para {{ totalGuests }} personas
                    </div>
                    <div class="flex-grow-1">
                      <div v-for="plan in venue.plans" :key="plan.id" class="plan-item p-2 mb-1 rounded" :class="{ 'opacity-50': !plan.is_suitable }">
                        <div class="d-flex justify-content-between">
                          <span class="fw-medium">{{ plan.name }}</span>
                          <span class="fw-semibold text-success">{{ formatCurrency(estimate(plan)) }}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                          <span class="small text-body-secondary">{{ planTypeLabel(plan.plan_type) }}</span>
                          <CButton
                            v-if="venue.is_available && plan.is_suitable"
                            color="primary" size="sm" variant="outline"
                            @click="book(venue, plan)"
                          >
                            Reservar
                          </CButton>
                        </div>
                      </div>
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton, CBadge, CSpinner, CAlert,
  CFormLabel, CFormInput, CFormSelect,
  CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell
} from '@coreui/vue'

const router = useRouter()

const venues = ref([])
const loadingVenues = ref(false)
const errorMessage = ref('')

const stayType = ref('pasadia')
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const checkIn = ref(today)
const checkOut = ref('')
const adults = ref(2)
const children = ref(0)
const loading = ref(false)
const searched = ref(false)
const results = ref([])

const totalGuests = computed(() => (adults.value || 0) + (children.value || 0))
const canSearch = computed(() => {
  if (!checkIn.value) return false
  if (stayType.value === 'hospedaje' && (!checkOut.value || checkOut.value <= checkIn.value)) return false
  return true
})

onMounted(async () => {
  loadingVenues.value = true
  try {
    const res = await fetch('/api/reseller/venues', { credentials: 'include' })
    const data = await res.json().catch(() => [])
    if (!res.ok) throw new Error(data.error || 'No se pudieron cargar tus cabañas')
    venues.value = data
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loadingVenues.value = false
  }
})

function onStayTypeChange() {
  if (stayType.value === 'pasadia') checkOut.value = ''
}

async function search() {
  loading.value = true
  searched.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({
      check_in: checkIn.value,
      adults: String(adults.value || 1),
      children: String(children.value || 0)
    })
    if (stayType.value === 'hospedaje') params.append('check_out', checkOut.value)
    const res = await fetch(`/api/reseller/availability?${params}`, { credentials: 'include' })
    const data = await res.json().catch(() => [])
    if (!res.ok) throw new Error(data.error || 'Error al buscar disponibilidad')
    results.value = data
  } catch (err) {
    errorMessage.value = err.message
    results.value = []
  } finally {
    loading.value = false
  }
}

function estimate(plan) {
  return (adults.value || 0) * (parseFloat(plan.adult_price) || 0) + (children.value || 0) * (parseFloat(plan.child_price) || 0)
}

// Opens the regular booking form prefilled. For a venue where the user is the
// linked agent, the booking is created in the venue's account and assigned to them.
function book(venue, plan) {
  const nights = stayType.value === 'hospedaje'
    ? Math.round((Date.parse(checkOut.value) - Date.parse(checkIn.value)) / 86400000)
    : 0
  router.push({
    path: '/business/accommodations/create',
    query: {
      venue: venue.id,
      plan_id: plan.id,
      date: checkIn.value,
      adults: adults.value || 0,
      children: children.value || 0,
      duration: nights > 0 ? nights * 86400 : 43200
    }
  })
}

const PLAN_LABELS = { pasadia: 'Pasadía', pasanoche: 'Pasanoche', hospedaje: 'Hospedaje' }
function planTypeLabel(type) {
  return PLAN_LABELS[type] || type
}

function rulesSummary(agent) {
  if (!agent) return '—'
  if (!agent.rules?.length) return 'Sin reglas de comisión'
  return agent.rules.map(r => {
    const range = r.max_adults ? `${r.min_adults}-${r.max_adults}` : `${r.min_adults}+`
    return `${planTypeLabel(r.plan_type)} ${range} adultos: ${Number(r.rate_percent)}%`
  }).join(' · ')
}

function formatCurrency(value) {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num)
}
</script>

<style scoped>
.plan-item {
  border: 1px solid var(--cui-border-color);
}
</style>
