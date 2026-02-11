<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Comision</strong>
        </CCardHeader>
        <CCardBody>
          <!-- Loading state -->
          <div v-if="loading" class="text-center py-4">
            <CSpinner color="primary" />
            <div class="mt-2 text-muted">Calculando comision...</div>
          </div>

          <!-- Error state -->
          <CAlert v-else-if="error" color="danger">
            {{ error }}
          </CAlert>

          <!-- No agent assigned / no plan -->
          <CAlert v-else-if="result && result.no_agent" color="info">
            {{ result.message || 'No hay comisionista asignado para esta sede.' }}
            <RouterLink v-if="!result.message?.includes('plan')" to="/business/commissions/agents/create" class="alert-link ms-1">
              Crear comisionista
            </RouterLink>
          </CAlert>

          <!-- No rules configured -->
          <CAlert v-else-if="result && result.no_rules" color="warning">
            {{ result.message || 'El comisionista no tiene reglas de comision configuradas.' }}
            <RouterLink
              v-if="result.agent?.id"
              :to="`/business/commissions/agents/${result.agent.id}/edit`"
              class="alert-link ms-1"
            >
              Editar comisionista
            </RouterLink>
          </CAlert>

          <!-- Already paid state -->
          <template v-else-if="result && result.existing_payment && result.existing_payment.status === 'paid'">
            <CAlert color="success" class="mb-3">
              <strong>Comision pagada</strong>
              <div class="mt-2">
                <div><strong>Monto:</strong> {{ formatCOP(result.existing_payment.calculated_amount) }}</div>
                <div><strong>Fecha de pago:</strong> {{ formatPaymentDate(result.existing_payment.payment_date) }}</div>
                <div v-if="result.existing_payment.payment_method">
                  <strong>Metodo:</strong> {{ result.existing_payment.payment_method }}
                </div>
                <div v-if="result.existing_payment.reference">
                  <strong>Referencia:</strong> {{ result.existing_payment.reference }}
                </div>
                <div v-if="result.existing_payment.expense_id" class="mt-2">
                  <RouterLink
                    :to="`/business/expenses/${result.existing_payment.expense_id}/edit`"
                    class="text-decoration-none"
                  >
                    Ver egreso contable
                  </RouterLink>
                </div>
              </div>
            </CAlert>

            <!-- Still show the breakdown -->
            <div v-if="result.agent" class="mb-3">
              <CBadge color="primary" class="me-2">{{ result.agent.name }}</CBadge>
              <CBadge v-if="result.agent.provider_name" color="info">{{ result.agent.provider_name }}</CBadge>
            </div>

            <CTable hover responsive bordered v-if="result.breakdown && result.breakdown.length > 0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Nivel</CTableHeaderCell>
                  <CTableHeaderCell>Rango Adultos</CTableHeaderCell>
                  <CTableHeaderCell>Adultos en Nivel</CTableHeaderCell>
                  <CTableHeaderCell>% Comision</CTableHeaderCell>
                  <CTableHeaderCell class="text-end">Subtotal</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="(tier, index) in result.breakdown" :key="index">
                  <CTableDataCell>{{ index + 1 }}</CTableDataCell>
                  <CTableDataCell>{{ tier.range_min }} - {{ tier.range_max }}</CTableDataCell>
                  <CTableDataCell>{{ tier.adults_in_tier }}</CTableDataCell>
                  <CTableDataCell>{{ tier.commission_percent }}%</CTableDataCell>
                  <CTableDataCell class="text-end">{{ formatCOP(tier.subtotal) }}</CTableDataCell>
                </CTableRow>
                <CTableRow>
                  <CTableDataCell colspan="4" class="text-end">
                    <strong>Total Comision</strong>
                  </CTableDataCell>
                  <CTableDataCell class="text-end">
                    <strong>{{ formatCOP(result.total_commission) }}</strong>
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>
          </template>

          <!-- Calculation result (no payment yet or pending) -->
          <template v-else-if="result">
            <div v-if="result.agent" class="mb-3">
              <CBadge color="primary" class="me-2">{{ result.agent.name }}</CBadge>
              <CBadge v-if="result.agent.provider_name" color="info">{{ result.agent.provider_name }}</CBadge>
            </div>

            <CTable hover responsive bordered v-if="result.breakdown && result.breakdown.length > 0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Nivel</CTableHeaderCell>
                  <CTableHeaderCell>Rango Adultos</CTableHeaderCell>
                  <CTableHeaderCell>Adultos en Nivel</CTableHeaderCell>
                  <CTableHeaderCell>% Comision</CTableHeaderCell>
                  <CTableHeaderCell class="text-end">Subtotal</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="(tier, index) in result.breakdown" :key="index">
                  <CTableDataCell>{{ index + 1 }}</CTableDataCell>
                  <CTableDataCell>{{ tier.range_min }} - {{ tier.range_max }}</CTableDataCell>
                  <CTableDataCell>{{ tier.adults_in_tier }}</CTableDataCell>
                  <CTableDataCell>{{ tier.commission_percent }}%</CTableDataCell>
                  <CTableDataCell class="text-end">{{ formatCOP(tier.subtotal) }}</CTableDataCell>
                </CTableRow>
                <CTableRow>
                  <CTableDataCell colspan="4" class="text-end">
                    <strong>Total Comision</strong>
                  </CTableDataCell>
                  <CTableDataCell class="text-end">
                    <strong>{{ formatCOP(result.total_commission) }}</strong>
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <!-- Existing payment with pending status -->
            <div v-if="result.existing_payment" class="mt-3">
              <CBadge :color="result.existing_payment.status === 'paid' ? 'success' : 'warning'" class="px-3 py-2">
                {{ result.existing_payment.status === 'paid' ? 'Pagado' : 'Pendiente' }}
              </CBadge>
              <div class="mt-2 small text-muted">
                <div v-if="result.existing_payment.payment_date">
                  <strong>Fecha:</strong> {{ formatPaymentDate(result.existing_payment.payment_date) }}
                </div>
                <div v-if="result.existing_payment.payment_method">
                  <strong>Metodo:</strong> {{ result.existing_payment.payment_method }}
                </div>
                <div v-if="result.existing_payment.reference">
                  <strong>Referencia:</strong> {{ result.existing_payment.reference }}
                </div>
              </div>
            </div>

            <!-- Register payment button -->
            <div v-if="!result.existing_payment" class="mt-3">
              <CButton color="primary" @click="openPaymentModal">
                Registrar Pago
              </CButton>
            </div>
          </template>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Payment Modal -->
  <CModal
    :visible="showPaymentModal"
    @close="showPaymentModal = false"
    backdrop="static"
    size="lg"
  >
    <CModalHeader>
      <CModalTitle>Registrar Pago de Comision</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CAlert v-if="saveError" color="danger" class="mb-3">
        {{ saveError }}
      </CAlert>

      <CForm @submit.prevent="savePayment">
        <div class="mb-3 p-3 border rounded bg-light">
          <div class="small text-muted">Monto de Comision Calculada</div>
          <div class="fs-4 fw-bold text-primary">{{ formatCOP(result?.total_commission) }}</div>
        </div>

        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Fecha de Pago *</CFormLabel>
            <CFormInput type="date" v-model="paymentForm.payment_date" required />
          </CCol>
          <CCol :md="6">
            <CFormLabel>Metodo de Pago *</CFormLabel>
            <CFormSelect v-model="paymentForm.payment_method" required>
              <option value="">Seleccionar...</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Nequi">Nequi</option>
              <option value="Daviplata">Daviplata</option>
            </CFormSelect>
          </CCol>
        </CRow>

        <div class="mb-3">
          <CFormLabel>Referencia</CFormLabel>
          <CFormInput
            v-model="paymentForm.reference"
            placeholder="Ej: Transferencia #12345"
          />
        </div>

        <div class="mb-3">
          <CFormLabel>Comprobante</CFormLabel>
          <div
            v-if="!paymentForm.receipt_url"
            class="receipt-upload-area"
            :class="{ 'is-dragging': isDragging, 'is-uploading': uploading }"
            @paste="handlePaste"
            @drop.prevent="handleDrop"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @click="triggerFileInput"
            tabindex="0"
          >
            <div v-if="uploading" class="text-center">
              <CSpinner size="sm" class="me-2" />
              Subiendo imagen...
            </div>
            <div v-else class="text-center">
              <CIcon name="cil-cloud-upload" size="xl" class="mb-2 text-secondary" />
              <div class="mb-2">Arrastrar imagen aqui o Ctrl+V para pegar</div>
              <div class="d-flex justify-content-center gap-2 flex-wrap">
                <CButton color="primary" size="sm" @click.stop="triggerFileInput">
                  <CIcon name="cil-folder-open" class="me-1" /> Seleccionar archivo
                </CButton>
                <CButton color="info" size="sm" @click.stop="triggerCamera">
                  <CIcon name="cil-camera" class="me-1" /> Tomar Foto
                </CButton>
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="d-none"
              @change="handleFileSelect"
            />
            <input
              ref="cameraInput"
              type="file"
              accept="image/*"
              capture="environment"
              class="d-none"
              @change="handleFileSelect"
            />
          </div>
          <div v-if="uploadError" class="text-danger small mt-2">
            {{ uploadError }}
          </div>
          <div v-if="paymentForm.receipt_url" class="mt-2">
            <div class="position-relative d-inline-block">
              <img
                :src="paymentForm.receipt_url"
                class="img-thumbnail"
                style="max-height: 200px; cursor: pointer;"
              />
              <CButton
                color="danger"
                size="sm"
                class="position-absolute top-0 end-0 m-1"
                @click.stop="paymentForm.receipt_url = ''"
              >
                <CIcon name="cil-x" />
              </CButton>
            </div>
          </div>
        </div>

        <div class="mb-3">
          <CFormLabel>Notas</CFormLabel>
          <CFormInput
            v-model="paymentForm.notes"
            placeholder="Notas adicionales..."
          />
        </div>

        <div class="mb-3">
          <CFormCheck
            v-model="paymentForm.create_expense"
            label="Registrar como egreso contable"
          />
        </div>
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showPaymentModal = false" :disabled="saving">
        Cancelar
      </CButton>
      <CButton color="primary" @click="savePayment" :disabled="saving">
        <CSpinner v-if="saving" size="sm" class="me-2" />
        {{ saving ? 'Guardando...' : 'Guardar Pago' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormLabel, CFormInput, CFormSelect, CFormCheck,
  CSpinner, CAlert
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const props = defineProps({
  accommodation: {
    type: Object,
    required: true
  }
})

const loading = ref(false)
const error = ref('')
const result = ref(null)

const showPaymentModal = ref(false)
const saving = ref(false)
const saveError = ref('')

const fileInput = ref(null)
const cameraInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const uploadError = ref('')

const paymentForm = ref({
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: '',
  reference: '',
  receipt_url: '',
  notes: '',
  create_expense: true
})

const formatCOP = (value) => {
  if (value === null || value === undefined) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value)
}

const formatPaymentDate = (date) => {
  if (!date) return '--'
  return new Date(date).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const calculateCommission = async () => {
  loading.value = true
  error.value = ''
  result.value = null

  try {
    const response = await fetch('/api/commissions/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accommodation_id: props.accommodation.id })
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Error al calcular la comision')
    }

    result.value = await response.json()
  } catch (err) {
    console.error('Error calculating commission:', err)
    error.value = err.message || 'Error al calcular la comision'
  } finally {
    loading.value = false
  }
}

const openPaymentModal = () => {
  saveError.value = ''
  paymentForm.value = {
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    reference: '',
    receipt_url: '',
    notes: '',
    create_expense: true
  }
  showPaymentModal.value = true
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const triggerCamera = () => {
  cameraInput.value?.click()
}

const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) uploadFile(file)
}

const handlePaste = (e) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) uploadFile(file)
      break
    }
  }
}

const handleDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    uploadFile(file)
  }
}

const uploadFile = async (file) => {
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Solo se permiten archivos de imagen'
    return
  }

  uploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/uploads/receipt', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Error al subir imagen')
    }

    const { imageUrl } = await response.json()
    paymentForm.value.receipt_url = imageUrl
  } catch (err) {
    console.error('Upload error:', err)
    uploadError.value = err.message || 'Error al subir imagen'
  } finally {
    uploading.value = false
  }
}

const savePayment = async () => {
  if (!paymentForm.value.payment_method) {
    saveError.value = 'Por favor seleccione un metodo de pago'
    return
  }

  saving.value = true
  saveError.value = ''

  try {
    const venue = props.accommodation.venue || props.accommodation.venue_data
    const payload = {
      agent_id: result.value.agent.id,
      accommodation_id: props.accommodation.id,
      organization_id: venue?.organization || venue?.organization_id || venue?.organization_data?.id || null,
      venue_id: venue?.id || props.accommodation.venue_id || null,
      adults: props.accommodation.adults,
      agreed_price: props.accommodation.agreed_price,
      calculated_amount: result.value.total_commission,
      breakdown: result.value.breakdown,
      status: 'paid',
      payment_date: paymentForm.value.payment_date,
      payment_method: paymentForm.value.payment_method,
      reference: paymentForm.value.reference || null,
      receipt_url: paymentForm.value.receipt_url || null,
      notes: paymentForm.value.notes || null,
      create_expense: paymentForm.value.create_expense
    }

    const response = await fetch('/api/commission-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Error al registrar el pago')
    }

    showPaymentModal.value = false
    await calculateCommission()
  } catch (err) {
    console.error('Error saving commission payment:', err)
    saveError.value = err.message || 'Error al registrar el pago'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  calculateCommission()
})
</script>

<style scoped>
.receipt-upload-area {
  border: 2px dashed var(--cui-border-color);
  border-radius: 0.375rem;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--cui-body-bg);
}

.receipt-upload-area:hover,
.receipt-upload-area:focus {
  border-color: var(--cui-primary);
  background-color: var(--cui-light);
  outline: none;
}

.receipt-upload-area.is-dragging {
  border-color: var(--cui-primary);
  background-color: rgba(var(--cui-primary-rgb), 0.1);
}

.receipt-upload-area.is-uploading {
  cursor: wait;
  pointer-events: none;
  opacity: 0.7;
}
</style>
