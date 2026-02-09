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
          </CRow>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Fecha</CTableHeaderCell>
                <CTableHeaderCell>Comisionista</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Evento</CTableHeaderCell>
                <CTableHeaderCell>Adultos</CTableHeaderCell>
                <CTableHeaderCell>Precio Evento</CTableHeaderCell>
                <CTableHeaderCell>Comisi&oacute;n</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="payment in payments" :key="payment.id">
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
              <CTableRow v-if="payments.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">
                  No hay pagos de comisiones registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
            <CTableFoot v-if="payments.length > 0">
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
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminaci&oacute;n</CModalTitle>
    </CModalHeader>
    <CModalBody>
      &iquest;Est&aacute; seguro de eliminar este pago de comisi&oacute;n de {{ formatCurrency(paymentToDelete?.calculated_amount) }}?
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
import { ref, computed, onMounted } from 'vue'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CTableFoot,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormSelect
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const payments = ref([])
const venues = ref([])
const agents = ref([])
const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const paymentToDelete = ref(null)

const filters = ref({
  venue_id: '',
  status: '',
  agent_id: ''
})

const totalPending = computed(() => {
  return payments.value
    .filter((p) => p.status === 'Pendiente')
    .reduce((sum, p) => sum + (parseFloat(p.calculated_amount) || 0), 0)
})

const totalPaid = computed(() => {
  return payments.value
    .filter((p) => p.status === 'Pagado')
    .reduce((sum, p) => sum + (parseFloat(p.calculated_amount) || 0), 0)
})

const loadPayments = async () => {
  loading.value = true
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
