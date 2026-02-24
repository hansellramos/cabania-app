<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Pagos</strong>
          <CButton color="primary" size="sm" @click="$router.push('/business/payments/new')">
            Registrar Pago
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="2">
              <CFormLabel class="small">Base contable</CFormLabel>
              <ToggleButtonGroup v-model="filters.basis" :options="basisOptions" />
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Método de pago</CFormLabel>
              <CFormSelect v-model="filters.method" size="sm">
                <option value="">Todos</option>
                <option v-for="m in availableMethods" :key="m" :value="m">{{ m }}</option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm">
                <option value="">Todos</option>
                <option value="verified">Verificado</option>
                <option value="pending">Pendiente</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Desde</CFormLabel>
              <CFormInput type="date" v-model="filters.from_date" size="sm" />
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Hasta</CFormLabel>
              <CFormInput type="date" v-model="filters.to_date" size="sm" />
            </CCol>
          </CRow>
          <div class="mb-3">
            <CFormInput
              v-model="searchQuery"
              placeholder="Buscar por referencia, método o notas..."
              size="sm"
            />
          </div>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('payment_date')"
                >
                  {{ filters.basis === 'accrual' ? 'Fecha Hospedaje' : 'Fecha Pago' }} {{ sortIcon('payment_date') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('amount')"
                >
                  Monto {{ sortIcon('amount') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  class="d-mobile-none"
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('payment_method')"
                >
                  Método {{ sortIcon('payment_method') }}
                </CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Referencia</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Reserva</CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('verified')"
                >
                  Estado {{ sortIcon('verified') }}
                </CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Comprobante</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="payment in paginatedPayments" :key="payment.id">
                <CTableDataCell>{{ formatDate(filters.basis === 'accrual' ? (payment.accommodation_data?.date || payment.payment_date) : payment.payment_date) }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency(payment.amount) }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">{{ payment.payment_method || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">{{ payment.reference || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  <template v-if="payment.accommodation_data">
                    <RouterLink :to="`/business/accommodations/${payment.accommodation}`" class="text-decoration-none">
                      {{ formatAccommodation(payment.accommodation_data) }}
                    </RouterLink>
                  </template>
                  <span v-else>—</span>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="payment.verified ? 'success' : 'warning'">
                    {{ payment.verified ? 'Verificado' : 'Pendiente' }}
                  </CBadge>
                  <div v-if="payment.verified && payment.verified_by_user" class="small text-muted mt-1 d-mobile-none">
                    por {{ payment.verified_by_user.name || payment.verified_by_user.email }}
                    <br />{{ formatDateTime(payment.verified_at) }}
                  </div>
                </CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  <CButton v-if="payment.receipt_url" color="info" size="sm" variant="outline" @click="openReceipt(payment)">
                    <CIcon :icon="cilImage" /> Ver
                  </CButton>
                  <span v-else class="text-muted">—</span>
                </CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <CButton
                      v-if="!payment.verified"
                      color="success"
                      size="sm"
                      variant="ghost"
                      @click="verifyPayment(payment)"
                      title="Verificar pago"
                    >
                      <CIcon :icon="cilCheckAlt" />
                    </CButton>
                    <CButton
                      v-else
                      color="warning"
                      size="sm"
                      variant="ghost"
                      @click="unverifyPayment(payment)"
                      title="Quitar verificación"
                    >
                      <CIcon :icon="cilX" />
                    </CButton>
                    <CButton
                      v-if="!payment.verified"
                      color="info"
                      size="sm"
                      variant="ghost"
                      @click="$router.push(`/business/payments/${payment.id}/edit`)"
                      title="Editar"
                    >
                      <CIcon :icon="cilPencil" />
                    </CButton>
                    <CButton
                      v-if="!payment.verified"
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(payment)"
                      title="Eliminar"
                    >
                      <CIcon :icon="cilTrash" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredPayments.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">
                  No hay pagos registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
            <CTableFoot v-if="filteredPayments.length > 0">
              <CTableRow>
                <CTableDataCell class="text-end">
                  <strong>Total:</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <strong>{{ formatCurrency(filteredTotal) }}</strong>
                </CTableDataCell>
                <CTableDataCell :colspan="6"></CTableDataCell>
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

  <CModal
    :visible="showReceiptModal"
    @close="showReceiptModal = false"
    size="xl"
    :keyboard="true"
    backdrop="true"
  >
    <CModalHeader close-button>
      <CModalTitle>Comprobante de Pago</CModalTitle>
    </CModalHeader>
    <CModalBody class="p-4">
      <div v-if="selectedPayment" class="mb-3 p-3 border rounded">
        <CRow>
          <CCol :md="4">
            <div class="small text-muted">Monto</div>
            <div class="fw-bold">{{ formatCurrency(selectedPayment.amount) }}</div>
          </CCol>
          <CCol :md="4">
            <div class="small text-muted">Método</div>
            <div>{{ selectedPayment.payment_method || '—' }}</div>
          </CCol>
          <CCol :md="4">
            <div class="small text-muted">Fecha</div>
            <div>{{ formatDate(selectedPayment.payment_date) }}</div>
          </CCol>
        </CRow>
        <CRow class="mt-2" v-if="selectedPayment.reference">
          <CCol>
            <div class="small text-muted">Referencia</div>
            <div>{{ selectedPayment.reference }}</div>
          </CCol>
        </CRow>
      </div>
      <div class="text-center">
        <img
          v-if="!receiptLoadError"
          :src="selectedReceiptUrl"
          class="img-fluid rounded"
          style="max-height: 60vh;"
          @error="receiptLoadError = true"
        />
        <div v-else class="text-muted py-5">
          <CIcon :icon="cilImage" size="3xl" class="mb-3" />
          <p>No se pudo cargar la imagen</p>
        </div>
      </div>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showReceiptModal = false">
        Cerrar
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminación</CModalTitle>
    </CModalHeader>
    <CModalBody>
      ¿Está seguro de eliminar este pago de {{ formatCurrency(paymentToDelete?.amount) }}?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" @click="showDeleteModal = false">Cancelar</CButton>
      <CButton color="danger" @click="deletePayment">Eliminar</CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { cilCheckAlt, cilX, cilPencil, cilTrash, cilImage } from '@coreui/icons'
import ToggleButtonGroup from '@/components/ToggleButtonGroup.vue'

const router = useRouter()

const basisOptions = [
  { value: 'cash', label: 'Caja' },
  { value: 'accrual', label: 'Devengo' },
]
const payments = ref([])
const searchQuery = ref('')
const showDeleteModal = ref(false)
const paymentToDelete = ref(null)
const showReceiptModal = ref(false)
const selectedPayment = ref(null)
const selectedReceiptUrl = ref('')
const receiptLoadError = ref(false)

const filters = reactive({
  basis: 'cash',
  method: '',
  status: '',
  from_date: '',
  to_date: '',
})

const sortKey = ref('payment_date')
const sortOrder = ref('desc')
const perPage = ref(20)
const currentPage = ref(1)

const availableMethods = computed(() => {
  const methods = new Set()
  payments.value.forEach(p => {
    if (p.payment_method) methods.add(p.payment_method)
  })
  return [...methods].sort()
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

const filteredPayments = computed(() => {
  let result = payments.value

  if (filters.method) {
    result = result.filter(p => p.payment_method === filters.method)
  }
  if (filters.status) {
    result = result.filter(p =>
      filters.status === 'verified' ? p.verified : !p.verified
    )
  }
  if (filters.from_date) {
    const from = new Date(filters.from_date)
    result = result.filter(p => {
      const d = filters.basis === 'accrual' ? (p.accommodation_data?.date || p.payment_date) : p.payment_date
      return new Date(d) >= from
    })
  }
  if (filters.to_date) {
    const to = new Date(filters.to_date + 'T23:59:59')
    result = result.filter(p => {
      const d = filters.basis === 'accrual' ? (p.accommodation_data?.date || p.payment_date) : p.payment_date
      return new Date(d) <= to
    })
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      (p.reference && p.reference.toLowerCase().includes(q)) ||
      (p.payment_method && p.payment_method.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va = a[key]
      let vb = b[key]
      if (key === 'amount') {
        va = parseFloat(va) || 0
        vb = parseFloat(vb) || 0
      } else if (key === 'payment_date') {
        if (filters.basis === 'accrual') {
          va = a.accommodation_data?.date || a.payment_date
          vb = b.accommodation_data?.date || b.payment_date
        }
        va = va ? new Date(va).getTime() : 0
        vb = vb ? new Date(vb).getTime() : 0
      } else if (key === 'verified') {
        va = va ? 1 : 0
        vb = vb ? 1 : 0
      } else {
        va = (va || '').toString().toLowerCase()
        vb = (vb || '').toString().toLowerCase()
      }
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }

  return result
})

const filteredTotal = computed(() => {
  return filteredPayments.value.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
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

watch([filters, searchQuery], () => { currentPage.value = 1 }, { deep: true })

const loadPayments = async () => {
  try {
    const response = await fetch('/api/payments')
    if (response.ok) {
      payments.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading payments:', error)
  }
}

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const formatDateTime = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota'
  })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const formatAccommodation = (acc) => {
  if (!acc) return '—'
  const date = acc.date ? new Date(acc.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : ''
  return date || 'Reserva'
}

const verifyPayment = async (payment) => {
  try {
    const response = await fetch(`/api/payments/${payment.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: true })
    })
    if (response.ok) {
      await loadPayments()
    }
  } catch (error) {
    console.error('Error verifying payment:', error)
  }
}

const unverifyPayment = async (payment) => {
  try {
    const response = await fetch(`/api/payments/${payment.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false })
    })
    if (response.ok) {
      await loadPayments()
    }
  } catch (error) {
    console.error('Error unverifying payment:', error)
  }
}

const openReceipt = (payment) => {
  selectedPayment.value = payment
  selectedReceiptUrl.value = payment.receipt_url
  receiptLoadError.value = false
  showReceiptModal.value = true
}

const confirmDelete = (payment) => {
  paymentToDelete.value = payment
  showDeleteModal.value = true
}

const deletePayment = async () => {
  if (!paymentToDelete.value) return
  try {
    const response = await fetch(`/api/payments/${paymentToDelete.value.id}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      showDeleteModal.value = false
      paymentToDelete.value = null
      await loadPayments()
    }
  } catch (error) {
    console.error('Error deleting payment:', error)
  }
}

onMounted(() => {
  loadPayments()
})
</script>
