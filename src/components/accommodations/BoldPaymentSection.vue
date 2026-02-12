<template>
  <div class="mb-3">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="mb-0">
        <CBadge color="dark" class="me-2">Bold</CBadge>
        Enlaces de Pago Online
      </h6>
      <CButton
        v-if="pendingBalance > 0"
        color="info"
        size="sm"
        @click="openCreateModal"
      >
        Crear Enlace de Pago
      </CButton>
    </div>

    <div v-if="links.length > 0">
      <div v-for="link in links" :key="link.id" class="border rounded p-2 mb-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <strong>{{ formatCurrency(link.amount) }}</strong>
          <CBadge :color="statusColor(link.status)" class="ms-2" size="sm">
            {{ statusLabel(link.status) }}
          </CBadge>
          <CBadge v-if="link.is_sandbox" color="warning" class="ms-1" size="sm">Sandbox</CBadge>
          <CBadge v-if="link.payment_id" color="success" class="ms-1" size="sm">Pago registrado</CBadge>
          <div class="small text-muted mt-1">
            {{ formatDate(link.created_at) }}
            <span v-if="link.description" class="ms-1">— {{ link.description }}</span>
          </div>
        </div>
        <div class="d-flex gap-1 flex-shrink-0">
          <CButton
            v-if="link.status === 'ACTIVE' && whatsapp"
            color="success"
            size="sm"
            variant="ghost"
            title="Enviar por WhatsApp"
            @click="sendWhatsApp(link)"
          >
            <CIcon icon="cib-whatsapp" />
          </CButton>
          <CButton
            v-if="link.status === 'ACTIVE'"
            color="secondary"
            size="sm"
            variant="ghost"
            title="Copiar enlace"
            @click="copyLink(link)"
          >
            <CIcon name="cil-copy" />
          </CButton>
          <CButton
            v-if="!link.payment_id"
            color="info"
            size="sm"
            variant="ghost"
            title="Actualizar estado"
            :disabled="refreshing === link.bold_link_id"
            @click="refreshStatus(link)"
          >
            <CIcon name="cil-reload" />
          </CButton>
        </div>
      </div>
    </div>
    <div v-else-if="!loading" class="text-muted small">
      No hay enlaces de pago Bold creados
    </div>
    <div v-if="copySuccess" class="small text-success mt-1">Enlace copiado al portapapeles</div>
  </div>

  <CModal :visible="showCreateModal" @close="showCreateModal = false" backdrop="static">
    <CModalHeader>
      <CModalTitle>Crear Enlace de Pago Bold</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <div class="alert alert-info mb-3">
        <strong>Saldo pendiente:</strong> {{ formatCurrency(pendingBalance) }}
      </div>
      <div class="mb-3">
        <CFormLabel>Monto *</CFormLabel>
        <CFormInput
          type="number"
          v-model="createForm.amount"
          :max="pendingBalance"
          min="1000"
          required
        />
        <div class="small text-muted mt-1">Puede ser un abono parcial o el total</div>
      </div>
      <div class="mb-3">
        <CFormLabel>Descripción</CFormLabel>
        <CFormInput
          v-model="createForm.description"
          placeholder="Ej: Abono reserva cabaña"
        />
      </div>
      <div class="mb-3">
        <CFormLabel>Email del pagador</CFormLabel>
        <CFormInput
          type="email"
          v-model="createForm.payer_email"
          placeholder="opcional"
        />
      </div>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showCreateModal = false">
        Cancelar
      </CButton>
      <CButton color="info" @click="createLink" :disabled="creating">
        {{ creating ? 'Creando...' : 'Crear Enlace' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import {
  CBadge, CButton, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormInput
} from '@coreui/vue'

const props = defineProps({
  accommodationId: { type: String, required: true },
  accommodation: { type: Object, default: null },
  pendingBalance: { type: Number, default: 0 }
})

const emit = defineEmits(['payment-created'])

const links = ref([])
const loading = ref(false)
const creating = ref(false)
const refreshing = ref(null)
const showCreateModal = ref(false)
const copySuccess = ref(false)

const createForm = ref({
  amount: '',
  description: '',
  payer_email: ''
})

const whatsapp = computed(() => props.accommodation?.customer_data?.whatsapp || null)

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusColor(status) {
  const colors = {
    ACTIVE: 'info',
    PROCESSING: 'warning',
    PAID: 'success',
    REJECTED: 'danger',
    CANCELLED: 'secondary',
    EXPIRED: 'secondary'
  }
  return colors[status] || 'secondary'
}

function statusLabel(status) {
  const labels = {
    ACTIVE: 'Activo',
    PROCESSING: 'Procesando',
    PAID: 'Pagado',
    REJECTED: 'Rechazado',
    CANCELLED: 'Cancelado',
    EXPIRED: 'Expirado'
  }
  return labels[status] || status
}

async function loadLinks() {
  loading.value = true
  try {
    const res = await fetch(`/api/bold/links?accommodation_id=${props.accommodationId}`, { credentials: 'include' })
    if (res.ok) links.value = await res.json()
  } catch (error) {
    console.error('Error loading Bold links:', error)
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  createForm.value = {
    amount: Math.round(props.pendingBalance),
    description: '',
    payer_email: ''
  }
  showCreateModal.value = true
}

async function createLink() {
  if (!createForm.value.amount || createForm.value.amount <= 0) {
    alert('Ingrese un monto válido')
    return
  }
  creating.value = true
  try {
    const res = await fetch('/api/bold/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        accommodation_id: props.accommodationId,
        amount: createForm.value.amount,
        description: createForm.value.description || undefined,
        payer_email: createForm.value.payer_email || undefined
      })
    })

    if (res.ok) {
      showCreateModal.value = false
      await loadLinks()
    } else {
      const err = await res.json()
      alert(err.error || 'Error al crear enlace de pago')
    }
  } catch (error) {
    console.error('Error creating Bold link:', error)
    alert('Error al crear enlace de pago')
  } finally {
    creating.value = false
  }
}

function sendWhatsApp(link) {
  const phone = whatsapp.value
  if (!phone) return
  const text = `Hola! Aquí tienes el enlace para tu pago de ${formatCurrency(link.amount)}:\n${link.bold_url}\nGracias!`
  window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(text)}`, '_blank')
}

async function copyLink(link) {
  try {
    await navigator.clipboard.writeText(link.bold_url)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  } catch {
    prompt('Copia este enlace:', link.bold_url)
  }
}

async function refreshStatus(link) {
  refreshing.value = link.bold_link_id
  try {
    const res = await fetch(`/api/bold/links/${link.bold_link_id}/status`, { credentials: 'include' })
    if (res.ok) {
      const updated = await res.json()
      const idx = links.value.findIndex(l => l.bold_link_id === link.bold_link_id)
      if (idx !== -1) links.value[idx] = updated

      if (updated.payment_id && !link.payment_id) {
        emit('payment-created')
      }
    }
  } catch (error) {
    console.error('Error refreshing status:', error)
  } finally {
    refreshing.value = null
  }
}

onMounted(() => {
  loadLinks()
})
</script>
