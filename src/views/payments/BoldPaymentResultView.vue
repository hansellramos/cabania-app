<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div class="text-center p-4" style="max-width: 480px;">
      <div v-if="loading" class="py-5">
        <CSpinner color="primary" />
        <p class="mt-3 text-muted">Consultando estado del pago...</p>
      </div>

      <div v-else-if="status === 'PAID'" class="py-4">
        <div class="rounded-circle bg-success d-inline-flex align-items-center justify-content-center mb-3" style="width: 80px; height: 80px;">
          <CIcon name="cil-check-circle" size="3xl" class="text-white" />
        </div>
        <h2 class="text-success mb-2">Pago Exitoso</h2>
        <p class="fs-4 fw-bold mb-1">{{ formatCurrency(amount) }}</p>
        <p v-if="description" class="text-muted">{{ description }}</p>
        <CBadge v-if="isSandbox" color="warning" class="mt-2">Modo de prueba (Sandbox)</CBadge>
        <p class="mt-4 text-muted small">Tu pago ha sido procesado correctamente. El administrador será notificado.</p>
      </div>

      <div v-else-if="status === 'ACTIVE' || status === 'PROCESSING'" class="py-4">
        <CSpinner color="warning" class="mb-3" />
        <h2 class="text-warning mb-2">Pago en Proceso</h2>
        <p v-if="amount" class="fs-4 fw-bold mb-1">{{ formatCurrency(amount) }}</p>
        <p class="text-muted">Tu pago está siendo procesado. Esto puede tomar unos minutos.</p>
        <CBadge v-if="isSandbox" color="warning" class="mt-2">Modo de prueba (Sandbox)</CBadge>
        <CButton color="primary" variant="outline" class="mt-3" @click="checkStatus">
          Verificar estado
        </CButton>
      </div>

      <div v-else-if="status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED'" class="py-4">
        <div class="rounded-circle bg-danger d-inline-flex align-items-center justify-content-center mb-3" style="width: 80px; height: 80px;">
          <CIcon name="cil-x-circle" size="3xl" class="text-white" />
        </div>
        <h2 class="text-danger mb-2">Pago No Completado</h2>
        <p class="text-muted">
          {{ status === 'EXPIRED' ? 'El enlace de pago ha expirado.' : 'El pago no pudo ser procesado.' }}
        </p>
        <CBadge v-if="isSandbox" color="warning" class="mt-2">Modo de prueba (Sandbox)</CBadge>
        <p class="mt-3 text-muted small">Si tienes dudas, contacta al administrador.</p>
      </div>

      <div v-else class="py-4">
        <div class="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center mb-3" style="width: 80px; height: 80px;">
          <CIcon name="cil-warning" size="3xl" class="text-white" />
        </div>
        <h2 class="text-secondary mb-2">Estado Desconocido</h2>
        <p class="text-muted">No se pudo obtener la información del pago.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { CSpinner, CBadge, CButton } from '@coreui/vue'

const route = useRoute()

const loading = ref(true)
const status = ref('')
const amount = ref(null)
const isSandbox = ref(false)
const description = ref('')

function formatCurrency(val) {
  if (val === null || val === undefined) return ''
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val)
}

function getBoldOrderId() {
  // Bold adds query params before the hash in hash-router URLs
  // Check route.query first, then fallback to window.location.search
  if (route.query['bold-order-id']) return route.query['bold-order-id']
  const params = new URLSearchParams(window.location.search)
  return params.get('bold-order-id')
}

async function checkStatus() {
  const boldOrderId = getBoldOrderId()
  if (!boldOrderId) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const res = await fetch(`/api/bold/payment-status/${boldOrderId}`)
    if (res.ok) {
      const data = await res.json()
      status.value = data.status
      amount.value = data.amount
      isSandbox.value = data.is_sandbox
      description.value = data.description || ''
    } else {
      status.value = 'unknown'
    }
  } catch (error) {
    console.error('Error checking payment status:', error)
    status.value = 'unknown'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  checkStatus()
})
</script>
