<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Depósitos</strong>
          <CButton
            v-if="hasPermission('deposits:create')"
            color="primary"
            size="sm"
            @click="$router.push('/business/deposits/new')"
          >
            <CIcon :icon="cilPlus" class="me-1" /> Nuevo Depósito
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3" :sm="6">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm" @change="loadDeposits">
                <option value="">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="refunded">Devuelto</option>
                <option value="claimed">Cobrado por daños</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3" :sm="6">
              <CFormLabel class="small">Cabaña</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadDeposits">
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
                placeholder="Buscar por cliente o cabaña..."
              />
            </CCol>
          </CRow>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('accommodation_date')"
                >
                  Fecha Hospedaje {{ sortIcon('accommodation_date') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('customer')"
                >
                  Cliente {{ sortIcon('customer') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  class="d-mobile-none"
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('venue')"
                >
                  Cabaña {{ sortIcon('venue') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('amount')"
                >
                  Monto {{ sortIcon('amount') }}
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
              <CTableRow v-for="deposit in paginatedDeposits" :key="deposit.id">
                <CTableDataCell>{{ formatDate(deposit.accommodation_data?.date) }}</CTableDataCell>
                <CTableDataCell>{{ deposit.accommodation_data?.customer_data?.fullname || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">{{ deposit.venue_data?.name || '—' }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency(deposit.amount) }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="getStatusColor(deposit.status)">
                    {{ getStatusLabel(deposit.status) }}
                  </CBadge>
                  <CBadge :color="deposit.verified ? 'success' : 'warning'" class="ms-1">
                    {{ deposit.verified ? 'Verificado' : 'Sin verificar' }}
                  </CBadge>
                  <div v-if="deposit.verified && deposit.verified_by_user" class="small text-muted mt-1 d-mobile-none">
                    por {{ deposit.verified_by_user.name || deposit.verified_by_user.email }}
                    <br />{{ formatDateTime(deposit.verified_at) }}
                  </div>
                </CTableDataCell>
                <CTableDataCell>
                  <CButton
                    v-if="!deposit.verified && hasPermission('deposits:update')"
                    color="success"
                    size="sm"
                    variant="ghost"
                    @click="verifyDeposit(deposit)"
                    title="Verificar depósito"
                  >
                    <CIcon :icon="cilCheckCircle" />
                  </CButton>
                  <CButton
                    v-if="deposit.verified && hasPermission('deposits:update')"
                    color="warning"
                    size="sm"
                    variant="ghost"
                    @click="unverifyDeposit(deposit)"
                    title="Quitar verificación"
                  >
                    <CIcon :icon="cilXCircle" />
                  </CButton>
                  <CButton
                    color="info"
                    size="sm"
                    variant="ghost"
                    @click="$router.push(`/business/deposits/${deposit.id}`)"
                    title="Ver detalles"
                  >
                    <CIcon :icon="cilZoom" />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredDeposits.length === 0">
                <CTableDataCell colspan="6" class="text-center text-muted py-4">
                  No hay depósitos registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
            <CTableFoot v-if="filteredDeposits.length > 0">
              <CTableRow>
                <CTableDataCell colspan="3" class="text-end">
                  <strong>Total:</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <strong>{{ formatCurrency(filteredTotal) }}</strong>
                </CTableDataCell>
                <CTableDataCell colspan="2"></CTableDataCell>
              </CTableRow>
            </CTableFoot>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredDeposits.length }} registros
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
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import { cilZoom, cilPlus, cilCheckCircle, cilXCircle } from '@coreui/icons'

const hasPermission = inject('hasPermission', () => false)

const deposits = ref([])
const venues = ref([])
const searchQuery = ref('')
const filters = ref({
  status: '',
  venue_id: ''
})

const sortKey = ref('accommodation_date')
const sortOrder = ref('desc')
const perPage = ref(20)
const currentPage = ref(1)

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

const filteredDeposits = computed(() => {
  let result = deposits.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(d =>
      (d.accommodation_data?.customer_data?.fullname && d.accommodation_data.customer_data.fullname.toLowerCase().includes(q)) ||
      (d.venue_data?.name && d.venue_data.name.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'amount') {
        va = parseFloat(a.amount) || 0
        vb = parseFloat(b.amount) || 0
      } else if (key === 'accommodation_date') {
        va = a.accommodation_data?.date ? new Date(a.accommodation_data.date).getTime() : 0
        vb = b.accommodation_data?.date ? new Date(b.accommodation_data.date).getTime() : 0
      } else if (key === 'customer') {
        va = (a.accommodation_data?.customer_data?.fullname || '').toLowerCase()
        vb = (b.accommodation_data?.customer_data?.fullname || '').toLowerCase()
      } else if (key === 'venue') {
        va = (a.venue_data?.name || '').toLowerCase()
        vb = (b.venue_data?.name || '').toLowerCase()
      } else if (key === 'status') {
        va = (a.status || '').toLowerCase()
        vb = (b.status || '').toLowerCase()
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

const filteredTotal = computed(() => {
  return filteredDeposits.value.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
})

const totalPages = computed(() => Math.ceil(filteredDeposits.value.length / perPage.value))

const paginatedDeposits = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredDeposits.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredDeposits.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredDeposits.value.length)
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

const loadVenues = async () => {
  try {
    const response = await fetch('/api/venues')
    if (response.ok) {
      venues.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

const loadDeposits = async () => {
  currentPage.value = 1
  try {
    const params = new URLSearchParams()
    if (filters.value.status) params.append('status', filters.value.status)
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)

    const url = `/api/deposits${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url)
    if (response.ok) {
      deposits.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading deposits:', error)
  }
}

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'warning'
    case 'refunded': return 'success'
    case 'claimed': return 'danger'
    default: return 'secondary'
  }
}

const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return 'Pendiente'
    case 'refunded': return 'Devuelto'
    case 'claimed': return 'Cobrado'
    default: return status
  }
}

const formatDateTime = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota'
  })
}

const verifyDeposit = async (deposit) => {
  try {
    const response = await fetch(`/api/deposits/${deposit.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: true })
    })
    if (response.ok) {
      await loadDeposits()
    }
  } catch (error) {
    console.error('Error verifying deposit:', error)
  }
}

const unverifyDeposit = async (deposit) => {
  try {
    const response = await fetch(`/api/deposits/${deposit.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false })
    })
    if (response.ok) {
      await loadDeposits()
    }
  } catch (error) {
    console.error('Error unverifying deposit:', error)
  }
}

onMounted(() => {
  loadVenues()
  loadDeposits()
})
</script>
