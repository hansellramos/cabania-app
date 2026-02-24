<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Cotizaciones</strong>
          <RouterLink to="/business/estimates/create">
            <CButton color="success" size="sm">+ Nueva Cotización</CButton>
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3" :sm="6">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm" @change="loadEstimates">
                <option value="">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="converted">Convertida</option>
                <option value="cancelled">Cancelada</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3" :sm="6">
              <CFormLabel class="small">Cabaña</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadEstimates">
                <option value="">Todas las cabañas</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="6">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput
                v-model="searchQuery"
                size="sm"
                placeholder="Buscar por cliente o contacto..."
              />
            </CCol>
          </CRow>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('check_in')"
                >
                  Fecha {{ sortIcon('check_in') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('customer_name')"
                >
                  Cliente {{ sortIcon('customer_name') }}
                </CTableHeaderCell>
                <CTableHeaderCell>Contacto</CTableHeaderCell>
                <CTableHeaderCell
                  class="d-mobile-none"
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('venue')"
                >
                  Cabaña {{ sortIcon('venue') }}
                </CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Plan</CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('calculated_price')"
                >
                  Precio {{ sortIcon('calculated_price') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('status')"
                >
                  Estado {{ sortIcon('status') }}
                </CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="estimate in paginatedEstimates" :key="estimate.id">
                <CTableDataCell>{{ formatDate(estimate.check_in) }}</CTableDataCell>
                <CTableDataCell>{{ estimate.customer_name || '—' }}</CTableDataCell>
                <CTableDataCell>
                  <CIcon :icon="estimate.contact_type === 'whatsapp' ? cilPhone : cilUser" class="me-1" size="sm" />
                  {{ estimate.contact_value || '—' }}
                </CTableDataCell>
                <CTableDataCell class="d-mobile-none">{{ estimate.venue?.name || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">{{ estimate.plan?.name || '—' }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency(estimate.calculated_price) }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="getStatusColor(estimate.status)">
                    {{ getStatusLabel(estimate.status) }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CButton
                    color="info"
                    size="sm"
                    variant="ghost"
                    @click="$router.push(`/business/estimates/${estimate.id}`)"
                    title="Ver detalles"
                  >
                    <CIcon :icon="cilZoom" />
                  </CButton>
                  <CButton
                    color="primary"
                    size="sm"
                    variant="ghost"
                    @click="$router.push(`/business/estimates/${estimate.id}/edit`)"
                    title="Editar"
                  >
                    <CIcon :icon="cilPencil" />
                  </CButton>
                  <CButton
                    v-if="estimate.status === 'pending' || estimate.status === 'confirmed'"
                    color="success"
                    size="sm"
                    variant="ghost"
                    @click="convertToAccommodation(estimate)"
                    title="Convertir a hospedaje"
                  >
                    <CIcon :icon="cilCheckCircle" />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredEstimates.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">
                  No hay cotizaciones registradas
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredEstimates.length }} registros
            </div>
            <CPagination size="sm" class="mb-0">
              <CPaginationItem :disabled="currentPage === 1" @click="currentPage = 1">&laquo;</CPaginationItem>
              <CPaginationItem :disabled="currentPage === 1" @click="currentPage--">&lsaquo;</CPaginationItem>
              <CPaginationItem
                v-for="page in visiblePages"
                :key="page"
                :active="page === currentPage"
                @click="currentPage = page"
              >
                {{ page }}
              </CPaginationItem>
              <CPaginationItem :disabled="currentPage === totalPages" @click="currentPage++">&rsaquo;</CPaginationItem>
              <CPaginationItem :disabled="currentPage === totalPages" @click="currentPage = totalPages">&raquo;</CPaginationItem>
            </CPagination>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CToaster placement="top-end">
    <CToast v-if="toast.visible" :color="toast.color" class="text-white" :autohide="true" :delay="3000" @close="toast.visible = false">
      <CToastBody>{{ toast.message }}</CToastBody>
    </CToast>
  </CToaster>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { cilZoom, cilPencil, cilCheckCircle, cilPhone, cilUser } from '@coreui/icons'
import { getEstimates, convertEstimate } from '@/services/estimateService'

const router = useRouter()
const estimates = ref([])
const venues = ref([])
const searchQuery = ref('')
const filters = ref({
  status: '',
  venue_id: ''
})

const sortKey = ref('check_in')
const sortOrder = ref('desc')
const perPage = ref(20)
const currentPage = ref(1)

const toast = ref({
  visible: false,
  message: '',
  color: 'success'
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return ''
  return sortOrder.value === 'asc' ? '▲' : '▼'
}

const filteredEstimates = computed(() => {
  let result = estimates.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      (e.customer_name && e.customer_name.toLowerCase().includes(q)) ||
      (e.contact_value && e.contact_value.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'check_in') {
        va = a.check_in ? new Date(a.check_in).getTime() : 0
        vb = b.check_in ? new Date(b.check_in).getTime() : 0
      } else if (key === 'calculated_price') {
        va = parseFloat(a.calculated_price) || 0
        vb = parseFloat(b.calculated_price) || 0
      } else if (key === 'venue') {
        va = (a.venue?.name || '').toLowerCase()
        vb = (b.venue?.name || '').toLowerCase()
      } else {
        va = (a[key] || '').toString().toLowerCase()
        vb = (b[key] || '').toString().toLowerCase()
      }
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }

  return result
})

const totalPages = computed(() => Math.ceil(filteredEstimates.value.length / perPage.value))

const paginatedEstimates = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredEstimates.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredEstimates.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredEstimates.value.length)
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  let start = Math.max(1, current - 2)
  let end = Math.min(total, current + 2)
  if (end - start < 4) {
    if (start === 1) end = Math.min(total, start + 4)
    else start = Math.max(1, end - 4)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

watch(searchQuery, () => { currentPage.value = 1 })

const showToast = (message, color = 'success') => {
  toast.value = { visible: true, message, color }
}

const loadVenues = async () => {
  try {
    const response = await fetch('/api/venues', { credentials: 'include' })
    if (response.ok) {
      venues.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

const loadEstimates = async () => {
  currentPage.value = 1
  try {
    estimates.value = await getEstimates({
      status: filters.value.status,
      venue_id: filters.value.venue_id
    })
  } catch (error) {
    console.error('Error loading estimates:', error)
    showToast('Error al cargar cotizaciones', 'danger')
  }
}

const convertToAccommodation = async (estimate) => {
  if (!confirm(`¿Convertir la cotización de ${estimate.customer_name || 'cliente'} en un hospedaje?`)) {
    return
  }

  try {
    const result = await convertEstimate(estimate.id)
    showToast('Cotización convertida a hospedaje exitosamente')
    router.push(`/business/accommodations/${result.accommodation_id}`)
  } catch (error) {
    showToast(error.message, 'danger')
  }
}

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'warning'
    case 'confirmed': return 'info'
    case 'converted': return 'success'
    case 'cancelled': return 'danger'
    default: return 'secondary'
  }
}

const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return 'Pendiente'
    case 'confirmed': return 'Confirmada'
    case 'converted': return 'Convertida'
    case 'cancelled': return 'Cancelada'
    default: return status
  }
}

onMounted(() => {
  loadVenues()
  loadEstimates()
})
</script>
