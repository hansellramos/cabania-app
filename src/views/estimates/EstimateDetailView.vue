<template>
  <CRow>
    <CCol :xs="12" :lg="8" class="mx-auto">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Detalle de Cotización</strong>
          <CBadge v-if="estimate && estimate.status" :color="getStatusColor(estimate.status)">
            {{ getStatusLabel(estimate.status) }}
          </CBadge>
        </CCardHeader>
        <CCardBody>
          <template v-if="estimate">
            <CRow>
              <CCol :md="6">
                <p><strong>Cliente:</strong> <span class="text-body-secondary">{{ estimate.customer_name || '—' }}</span></p>
              </CCol>
              <CCol :md="6">
                <p>
                  <strong>Contacto:</strong>
                  <span class="text-body-secondary">
                    <CIcon :icon="estimate.contact_type === 'whatsapp' ? cilPhone : cilUser" class="me-1" size="sm" />
                    {{ estimate.contact_value || '—' }}
                    <CBadge color="light" text-color="dark" class="ms-1">{{ estimate.contact_type }}</CBadge>
                  </span>
                </p>
              </CCol>
            </CRow>

            <CRow>
              <CCol :md="6">
                <p><strong>Cabaña:</strong> <span class="text-body-secondary">{{ estimate.venue?.name || '—' }}</span></p>
              </CCol>
              <CCol :md="6">
                <p><strong>Plan:</strong> <span class="text-body-secondary">{{ estimate.plan?.name || '—' }}</span></p>
              </CCol>
            </CRow>

            <CRow>
              <CCol :md="3">
                <p><strong>Check-in:</strong> <span class="text-body-secondary">{{ formatDate(estimate.check_in) }}</span></p>
              </CCol>
              <CCol :md="3">
                <p><strong>Check-out:</strong> <span class="text-body-secondary">{{ formatDate(estimate.check_out) }}</span></p>
              </CCol>
              <CCol :md="3">
                <p><strong>Adultos:</strong> <span class="text-body-secondary">{{ estimate.adults ?? 0 }}</span></p>
              </CCol>
              <CCol :md="3">
                <p><strong>Niños:</strong> <span class="text-body-secondary">{{ estimate.children ?? 0 }}</span></p>
              </CCol>
            </CRow>

            <CRow>
              <CCol :md="6">
                <div class="p-3 border rounded text-center">
                  <h6 class="text-muted mb-2">Valor Cotizado</h6>
                  <p class="fs-4 fw-bold text-primary mb-0">{{ formatCurrency(agreedPrice) }}</p>
                  <small v-if="hasDiscount" class="text-success">
                    <s class="text-muted">{{ formatCurrency(estimate.calculated_price) }}</s>
                    (-{{ discountPercent }}%)
                  </small>
                  <p v-if="hasDiscount && estimate.discount_note" class="text-muted small mt-1 mb-0">
                    {{ estimate.discount_note }}
                  </p>
                </div>
              </CCol>
              <CCol :md="6">
                <p><strong>Precio Calculado:</strong> <span class="text-body-secondary">{{ formatCurrency(estimate.calculated_price) }}</span></p>
                <p v-if="hasDiscount"><strong>Valor Pactado:</strong> <span class="text-success">{{ formatCurrency(estimate.agreed_price) }}</span></p>
                <p v-if="hasDiscount && estimate.discount_note"><strong>Nota Descuento:</strong> <span class="text-body-secondary">{{ estimate.discount_note }}</span></p>
              </CCol>
            </CRow>

            <div v-if="estimate.notes" class="mb-3">
              <p><strong>Notas:</strong></p>
              <p class="text-body-secondary" style="white-space: pre-wrap;">{{ estimate.notes }}</p>
            </div>

            <div class="mt-4 d-flex flex-wrap gap-2">
              <RouterLink :to="`/business/estimates/${estimate.id}/edit`">
                <CButton color="primary" size="sm">
                  <CIcon :icon="cilPencil" class="me-1" /> Editar
                </CButton>
              </RouterLink>
              <CButton
                v-if="estimate.status === 'pending' || estimate.status === 'confirmed'"
                color="success"
                size="sm"
                @click="convertToAccommodation"
              >
                <CIcon :icon="cilCheckCircle" class="me-1" /> Convertir a Hospedaje
              </CButton>
              <RouterLink to="/business/estimates">
                <CButton color="secondary" size="sm" variant="outline">Volver a la Lista</CButton>
              </RouterLink>
            </div>
          </template>
          <template v-else>
            <CSpinner color="primary" /> Cargando...
          </template>
        </CCardBody>
      </CCard>

      <CCard v-if="estimate && estimate.conversation_id" class="mb-4">
        <CCardHeader>
          <strong>Conversación Relacionada</strong>
        </CCardHeader>
        <CCardBody>
          <p class="text-muted mb-0">
            Esta cotización fue creada desde una conversación de chat.
            <RouterLink v-if="estimate.venue_id" :to="{ path: `/venues/${estimate.venue_id}/chat`, query: { conversation_id: estimate.conversation_id, estimate_id: estimate.id } }">Ver conversación</RouterLink>
          </p>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { cilPencil, cilCheckCircle, cilPhone, cilUser } from '@coreui/icons'
import { getEstimateById, convertEstimate } from '@/services/estimateService'
import { useBreadcrumbStore } from '@/stores/breadcrumb.js'

const route = useRoute()
const router = useRouter()
const breadcrumbStore = useBreadcrumbStore()
const estimate = ref(null)

const toast = ref({
  visible: false,
  message: '',
  color: 'success'
})

const showToast = (message, color = 'success') => {
  toast.value = { visible: true, message, color }
}

const loadEstimate = async () => {
  try {
    const data = await getEstimateById(route.params.id)
    estimate.value = data
    if (data.customer_name) {
      breadcrumbStore.setTitle(`Cotización ${data.customer_name}`)
    }
  } catch (error) {
    console.error('Error loading estimate:', error)
    showToast('Error al cargar cotización', 'danger')
  }
}

const convertToAccommodation = async () => {
  if (!confirm('¿Convertir esta cotización en un hospedaje?')) return
  try {
    const result = await convertEstimate(route.params.id)
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

const agreedPrice = computed(() => {
  if (!estimate.value) return 0
  return parseFloat(estimate.value.agreed_price) || parseFloat(estimate.value.calculated_price) || 0
})

const hasDiscount = computed(() => {
  if (!estimate.value) return false
  const calc = parseFloat(estimate.value.calculated_price) || 0
  const agreed = parseFloat(estimate.value.agreed_price) || 0
  return agreed > 0 && calc > 0 && agreed < calc
})

const discountPercent = computed(() => {
  if (!estimate.value) return 0
  const calc = parseFloat(estimate.value.calculated_price) || 0
  const agreed = parseFloat(estimate.value.agreed_price) || 0
  if (calc === 0) return 0
  return Math.round(((calc - agreed) / calc) * 100)
})

onMounted(() => {
  loadEstimate()
})
</script>
