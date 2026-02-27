<template>
  <CRow>
    <CCol :xs="12" md="8" lg="6" class="mx-auto">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>WhatsApp del Sistema</strong>
          <CBadge :color="statusBadgeColor[status] || 'secondary'">{{ statusLabels[status] || status }}</CBadge>
        </CCardHeader>
        <CCardBody class="text-center">
          <div v-if="loading" class="py-5">
            <CSpinner color="primary" />
            <p class="mt-3 text-body-secondary">Cargando estado...</p>
          </div>

          <!-- Unavailable -->
          <div v-else-if="status === 'unavailable'">
            <div class="py-4">
              <CIcon icon="cil-warning" size="3xl" class="text-warning mb-3" />
              <h5>No disponible</h5>
              <p class="text-body-secondary">
                El WhatsApp del sistema solo está disponible en el servidor local.
              </p>
            </div>
          </div>

          <!-- Disconnected -->
          <div v-else-if="status === 'disconnected' || status === 'not_configured'">
            <div class="py-4">
              <CIcon icon="cib-whatsapp" size="3xl" class="text-success mb-3" />
              <h5>Conectar WhatsApp del Sistema</h5>
              <p class="text-body-secondary">
                Este número se usa para enviar notificaciones de escalamiento a los propietarios
                y recibir comandos de reanudación.
              </p>
              <p class="text-body-secondary small">
                <strong>Importante:</strong> Usa un número diferente al de los venues.
              </p>
              <CButton color="success" @click="connect" :disabled="connecting">
                <CSpinner v-if="connecting" size="sm" class="me-2" />
                Iniciar conexión
              </CButton>
            </div>
          </div>

          <!-- QR Pending -->
          <div v-else-if="status === 'qr_pending'">
            <div class="py-3">
              <h5 class="mb-3">Escanea el código QR</h5>
              <p class="text-body-secondary mb-3">
                Abre WhatsApp en tu celular &rarr; Dispositivos vinculados &rarr; Vincular un dispositivo
              </p>
              <div v-if="qrCode" class="qr-container mx-auto mb-3">
                <canvas ref="qrCanvas"></canvas>
              </div>
              <div v-else class="py-4">
                <CSpinner color="success" />
                <p class="mt-2 text-body-secondary">Generando código QR...</p>
              </div>
              <CButton color="secondary" variant="outline" size="sm" @click="disconnect">
                Cancelar
              </CButton>
            </div>
          </div>

          <!-- Connected -->
          <div v-else-if="status === 'connected'">
            <div class="py-4">
              <div class="bg-success-subtle rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                <CIcon icon="cib-whatsapp" size="xl" class="text-success" />
              </div>
              <h5 class="text-success">Conectado</h5>
              <p class="text-body-secondary mb-1">
                Número: <strong>{{ phoneNumber || 'Desconocido' }}</strong>
              </p>
              <p v-if="lastConnected" class="text-body-secondary small">
                Conectado desde: {{ formatDate(lastConnected) }}
              </p>
              <p class="text-body-secondary mt-3 mb-4">
                El sistema enviará notificaciones de escalamiento por este número.
              </p>
              <CButton color="danger" variant="outline" @click="disconnect" :disabled="disconnecting">
                <CSpinner v-if="disconnecting" size="sm" class="me-2" />
                Desconectar
              </CButton>
            </div>
          </div>

          <CAlert v-if="error" color="danger" class="mt-3 text-start">
            {{ error }}
          </CAlert>
        </CCardBody>
      </CCard>

      <!-- Info card -->
      <CCard class="mb-4">
        <CCardHeader><strong>¿Cómo funciona?</strong></CCardHeader>
        <CCardBody>
          <ul class="text-body-secondary small mb-0">
            <li class="mb-2">Cuando CabanIA escala una conversación, envía una notificación al propietario del venue por este número.</li>
            <li class="mb-2">El propietario puede responder "ya puedes seguir" para reactivar CabanIA en las conversaciones escaladas.</li>
            <li class="mb-2">Si no se responde, CabanIA se reactiva automáticamente a la hora configurada (por defecto 3:00 AM).</li>
            <li>Configura el teléfono de notificación en la sección WhatsApp de cada venue.</li>
          </ul>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import QRCode from 'qrcode'

const loading = ref(true)
const connecting = ref(false)
const disconnecting = ref(false)
const status = ref('not_configured')
const qrCode = ref(null)
const phoneNumber = ref(null)
const lastConnected = ref(null)
const error = ref(null)
const qrCanvas = ref(null)

let pollInterval = null

const statusBadgeColor = {
  disconnected: 'secondary',
  not_configured: 'secondary',
  qr_pending: 'warning',
  connected: 'success',
  unavailable: 'dark'
}

const statusLabels = {
  disconnected: 'Desconectado',
  not_configured: 'No configurado',
  qr_pending: 'Esperando QR',
  connected: 'Conectado',
  unavailable: 'No disponible'
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/admin/system-whatsapp/status', { credentials: 'include' })
    if (!res.ok) throw new Error('Error al obtener estado')
    const data = await res.json()
    status.value = data.status || 'not_configured'
    qrCode.value = data.qr_code || null
    phoneNumber.value = data.phone_number || null
    lastConnected.value = data.last_connected || null

    if (data.qr_code) {
      await nextTick()
      renderQR(data.qr_code)
    }

    if (data.status === 'connected' || data.status === 'disconnected') {
      stopPolling()
    }
  } catch (err) {
    console.error('[system-wa-ui]', err)
  } finally {
    loading.value = false
  }
}

function renderQR(data) {
  if (qrCanvas.value && data) {
    QRCode.toCanvas(qrCanvas.value, data, { width: 280, margin: 2 }, (err) => {
      if (err) console.error('QR render error:', err)
    })
  }
}

function startPolling() {
  stopPolling()
  pollInterval = setInterval(fetchStatus, 3000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

async function connect() {
  error.value = null
  connecting.value = true
  try {
    const res = await fetch('/api/admin/system-whatsapp/connect', {
      method: 'POST',
      credentials: 'include'
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al conectar')
    }
    status.value = 'qr_pending'
    startPolling()
  } catch (err) {
    error.value = err.message
  } finally {
    connecting.value = false
  }
}

async function disconnect() {
  error.value = null
  disconnecting.value = true
  try {
    const res = await fetch('/api/admin/system-whatsapp/disconnect', {
      method: 'POST',
      credentials: 'include'
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al desconectar')
    }
    status.value = 'disconnected'
    qrCode.value = null
    phoneNumber.value = null
    stopPolling()
  } catch (err) {
    error.value = err.message
  } finally {
    disconnecting.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

onMounted(async () => {
  await fetchStatus()
  if (status.value === 'qr_pending') {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.qr-container {
  max-width: 300px;
  background: white;
  border-radius: 12px;
  padding: 10px;
  display: inline-block;
}
.qr-container canvas {
  display: block;
  margin: 0 auto;
}
</style>
