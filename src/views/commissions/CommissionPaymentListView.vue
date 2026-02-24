<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Pagos de Comisiones</strong>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadPayments">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm" @change="loadPayments">
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Comisionista</CFormLabel>
              <CFormSelect v-model="filters.agent_id" size="sm" @change="loadPayments">
                <option value="">Todos los comisionistas</option>
                <option v-for="agent in agents" :key="agent.id" :value="agent.id">
                  {{ agent.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput
                v-model="searchQuery"
                size="sm"
                placeholder="Buscar por comisionista..."
              />
            </CCol>
          </CRow>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('payment_date')"
                >
                  Fecha {{ sortIcon('payment_date') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('agent')"
                >
                  Comisionista {{ sortIcon('agent') }}
                </CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Evento</CTableHeaderCell>
                <CTableHeaderCell>Adultos</CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('agreed_price')"
                >
                  Precio Evento {{ sortIcon('agreed_price') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('calculated_amount')"
                >
                  Comisión {{ sortIcon('calculated_amount') }}
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
              <CTableRow v-for="payment in paginatedPayments" :key="payment.id">
                <CTableDataCell>{{ formatDate(payment.payment_date || payment.created_at) }}</CTableDataCell>
                <CTableDataCell>{{ payment.agent?.name || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  {{ formatDate(payment.accommodation_data?.date) }} — {{ payment.venue_data?.name || '—' }}
                </CTableDataCell>
                <CTableDataCell>{{ payment.adults }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency(payment.agreed_price) }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency(payment.calculated_amount) }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="payment.status === 'Pagado' ? 'success' : 'warning'">
                    {{ payment.status }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CButton
                    v-if="payment.status === 'Pendiente'"
                    color="danger"
                    size="sm"
                    variant="ghost"
                    @click="confirmDelete(payment)"
                    title="Eliminar"
                  >
                    <CIcon name="cil-trash" />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredPayments.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">
                  No hay pagos de comisiones registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
            <CTableFoot v-if="filteredPayments.length > 0">
              <CTableRow>
                <CTableDataCell colspan="5" class="text-end">
                  <strong>Total Pendiente:</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <strong class="text-warning">{{ formatCurrency(totalPending) }}</strong>
                </CTableDataCell>
                <CTableDataCell colspan="2"></CTableDataCell>
              </CTableRow>
              <CTableRow>
                <CTableDataCell colspan="5" class="text-end">
                  <strong>Total Pagado:</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <strong class="text-success">{{ formatCurrency(totalPaid) }}</strong>
                </CTableDataCell>
                <CTableDataCell colspan="2"></CTableDataCell>
              </CTableRow>
            </CTableFoot>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredPayments.length }} registros
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

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminación</CModalTitle>
    </CModalHeader>
    <CModalBody>
      ¿Está seguro de eliminar este pago de comisión de {{ formatCurrency(paymentToDelete?.calculated_amount) }}?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" @click="showDeleteModal = false">Cancelar</CButton>
      <CButton color="danger" @click="deletePayment" :disabled="deleting">
        {{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CTableFoot,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormSelect, CFormInput
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const payments = ref([])
const venues = ref([])
const agents = ref([])
const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const paymentToDelete = ref(null)
const searchQuery = ref('')

const filters = ref({
  venue_id: '',
  status: '',
  agent_id: ''
})

const sortKey = ref('payment_date')
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

const filteredPayments = computed(() => {
  let result = payments.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      (p.agent?.name && p.agent.name.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'payment_date') {
        va = new Date(a.payment_date || a.created_at).getTime()
        vb = new Date(b.payment_date || b.created_at).getTime()
      } else if (key === 'agent') {
        va = (a.agent?.name || '').toLowerCase()
        vb = (b.agent?.name || '').toLowerCase()
      } else if (key === 'agreed_price' || key === 'calculated_amount') {
        va = parseFloat(a[key]) || 0
        vb = parseFloat(b[key]) || 0
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

const totalPending = computed(() => {
  return filteredPayments.value
    .filter((p) => p.status === 'Pendiente')
    .reduce((sum, p) => sum + (parseFloat(p.calculated_amount) || 0), 0)
})

const totalPaid = computed(() => {
  return filteredPayments.value
    .filter((p) => p.status === 'Pagado')
    .reduce((sum, p) => sum + (parseFloat(p.calculated_amount) || 0), 0)
})

const totalPages = computed(() => Math.ceil(filteredPayments.value.length / perPage.value))

const paginatedPayments = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredPayments.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredPayments.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredPayments.value.length)
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

const loadPayments = async () => {
  loading.value = true
  currentPage.value = 1
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.status) params.append('status', filters.value.status)
    if (filters.value.agent_id) params.append('agent_id', filters.value.agent_id)

    const url = `/api/commission-payments${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      payments.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading commission payments:', error)
  } finally {
    loading.value = false
  }
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

const loadAgents = async () => {
  try {
    const response = await fetch('/api/agents', { credentials: 'include' })
    if (response.ok) {
      agents.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading agents:', error)
  }
}

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO')
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount)
}

const confirmDelete = (payment) => {
  paymentToDelete.value = payment
  showDeleteModal.value = true
}

const deletePayment = async () => {
  if (!paymentToDelete.value) return
  deleting.value = true
  try {
    const response = await fetch(`/api/commission-payments/${paymentToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      showDeleteModal.value = false
      paymentToDelete.value = null
      await loadPayments()
    }
  } catch (error) {
    console.error('Error deleting commission payment:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadPayments()
  loadVenues()
  loadAgents()
})
</script>
