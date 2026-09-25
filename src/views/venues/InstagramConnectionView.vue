<template>
  <CRow>
    <CCol :xs="12" md="8" lg="6" class="mx-auto">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Instagram - {{ venueName || 'Cargando...' }}</strong>
          <CBadge :color="statusBadgeColor">{{ statusLabel }}</CBadge>
        </CCardHeader>
        <CCardBody>
          <!-- Cargando -->
          <div v-if="loading" class="py-5 text-center">
            <CSpinner color="primary" />
            <p class="mt-3 text-body-secondary">Cargando configuración...</p>
          </div>

          <!-- Sin acceso -->
          <div v-else-if="forbidden" class="py-4 text-center">
            <CIcon icon="cil-lock-locked" size="3xl" class="text-body-secondary mb-3" />
            <p class="text-body-secondary">No tienes permiso para configurar Instagram en esta cabaña.</p>
          </div>

          <div v-else>
            <CAlert v-if="resultMsg" :color="resultMsg.type" class="small py-2 mb-3" dismissible @close="resultMsg = null">
              {{ resultMsg.text }}
            </CAlert>

            <!-- Conectado -->
            <div v-if="isConnected">
              <p class="mb-1">
                Cuenta conectada:
                <a v-if="config.username" :href="`https://instagram.com/${config.username}`" target="_blank" rel="noopener">
                  <strong>@{{ config.username }}</strong>
                </a>
                <strong v-else>{{ config.ig_user_id }}</strong>
              </p>
              <p class="text-body-secondary small mb-3">
                CabanIA responde automáticamente los mensajes directos que reciba esta cuenta.
                <span v-if="expiresLabel">El acceso se renueva solo; vence el {{ expiresLabel }} si no se renueva.</span>
              </p>

              <div v-if="!confirmingDisconnect" class="d-flex gap-2 flex-wrap">
                <CButton color="primary" variant="outline" size="sm" :disabled="connecting || !config.oauth_available" @click="connect">
                  <CSpinner v-if="connecting" size="sm" class="me-1" />
                  Reconectar
                </CButton>
                <CButton color="danger" variant="outline" size="sm" @click="confirmingDisconnect = true">
                  Desconectar
                </CButton>
              </div>
              <div v-else class="border rounded p-2 small">
                <p class="mb-2">¿Desconectar Instagram? CabanIA dejará de recibir y responder los mensajes de esta cuenta.</p>
                <div class="d-flex gap-2">
                  <CButton color="danger" size="sm" :disabled="disconnecting" @click="disconnect">
                    <CSpinner v-if="disconnecting" size="sm" class="me-1" />
                    Sí, desconectar
                  </CButton>
                  <CButton color="secondary" variant="outline" size="sm" @click="confirmingDisconnect = false">Cancelar</CButton>
                </div>
              </div>
            </div>

            <!-- Desconectado o con error -->
            <div v-else>
              <CAlert v-if="config.status === 'error'" color="warning" class="small py-2 mb-3">
                El acceso a
                <strong>{{ config.username ? '@' + config.username : 'la cuenta de Instagram' }}</strong>
                venció o fue revocado, y CabanIA ya no puede responder sus mensajes.
                Vuelve a conectar la cuenta.
              </CAlert>
              <p class="text-body-secondary small mb-3">
                Conecta la cuenta de Instagram de esta cabaña para que CabanIA responda automáticamente
                los mensajes directos de tus clientes. Necesitas una cuenta profesional de Instagram
                (Empresa o Creador).
              </p>
              <CButton color="primary" :disabled="connecting || !config.oauth_available" @click="connect">
                <CSpinner v-if="connecting" size="sm" class="me-1" />
                Conectar con Instagram
              </CButton>
              <p v-if="!config.oauth_available" class="text-body-secondary small mt-2 mb-0">
                La conexión con Instagram todavía no está habilitada en el servidor.
              </p>
            </div>

            <!-- Configuración manual (solo super admin) -->
            <div v-if="config.can_edit_manual" class="mt-4 pt-3 border-top">
              <CButton color="link" size="sm" class="p-0 text-body-secondary" @click="showManual = !showManual">
                {{ showManual ? '▾' : '▸' }} Configuración manual (avanzado)
              </CButton>

              <div v-if="showManual" class="mt-3">
                <p class="text-body-secondary small mb-3">
                  Para cuentas con rol en la app de Meta: pega un token generado desde la consola de desarrolladores.
                </p>

                <div class="mb-3">
                  <label class="form-label small fw-semibold">Instagram Business Account ID</label>
                  <CFormInput v-model="manual.ig_user_id" placeholder="Ej: 17841400000000000" size="sm" />
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-semibold">Access Token</label>
                  <CFormInput v-model="manual.access_token" type="password" placeholder="Token de acceso de Meta" size="sm" />
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-semibold">Verify Token (webhook)</label>
                  <div class="d-flex gap-2">
                    <CFormInput v-model="manual.verify_token" placeholder="Token de verificación" size="sm" />
                    <CButton color="secondary" variant="outline" size="sm" @click="generateVerifyToken" style="white-space: nowrap;">
                      Generar
                    </CButton>
                  </div>
                </div>

                <CAlert color="info" class="small py-2 mb-3">
                  <strong>Webhook URL:</strong><br />
                  <code>{{ webhookUrl }}</code><br />
                  Configura esta URL en Meta Developer Console &rarr; Instagram &rarr; Configure webhooks,
                  y suscribe el campo <code>messages</code>.
                </CAlert>

                <CButton color="primary" size="sm" @click="saveManual" :disabled="saving">
                  <CSpinner v-if="saving" size="sm" class="me-1" />
                  Guardar
                </CButton>

                <CAlert v-if="saveMsg" :color="saveMsg.type" class="mt-3 small py-2">
                  {{ saveMsg.text }}
                </CAlert>
              </div>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <RouterLink :to="`/business/venues/${venueId}`" class="d-inline-block mt-2">
        <CButton color="secondary" size="sm" variant="outline">Volver a la cabaña</CButton>
      </RouterLink>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()
const venueId = route.params.id

const venueName = ref('')
const loading = ref(true)
const forbidden = ref(false)
const connecting = ref(false)
const disconnecting = ref(false)
const confirmingDisconnect = ref(false)
const showManual = ref(false)
const saving = ref(false)
const saveMsg = ref(null)
const resultMsg = ref(null)

const config = ref({
  status: 'disconnected',
  username: null,
  ig_user_id: '',
  token_expires_at: null,
  has_token: false,
  oauth_available: false,
  can_edit_manual: false
})

const manual = ref({
  ig_user_id: '',
  page_id: '',
  access_token: '',
  verify_token: ''
})

// Mensajes para el resultado del flujo de Instagram (?ig=connected|error&reason=...)
const OAUTH_ERRORS = {
  denied: 'Cancelaste la conexión en Instagram. No se conectó ninguna cuenta.',
  missing_permissions: 'Para responder mensajes, CabanIA necesita el permiso de administrar mensajes. Vuelve a conectar y acepta todos los permisos.',
  already_connected: 'Esa cuenta de Instagram ya está conectada a otra cabaña.',
  subscribe_failed: 'La cuenta se conectó, pero Instagram no activó la recepción de mensajes. Intenta reconectar en unos minutos.',
  invalid_state: 'La conexión expiró o no es válida. Vuelve a intentarlo.',
  forbidden: 'No tienes permiso para conectar Instagram en esta cabaña.',
  no_code: 'Instagram no devolvió la autorización. Vuelve a intentarlo.',
  exchange_failed: 'No se pudo completar la conexión con Instagram. Vuelve a intentarlo.'
}

const isConnected = computed(() => config.value.status === 'connected' && config.value.has_token)

const webhookUrl = computed(() => {
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base}/api/webhook/instagram`
})

const expiresLabel = computed(() => {
  if (!config.value.token_expires_at) return ''
  return new Date(config.value.token_expires_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
})

const statusBadgeColor = computed(() => ({
  connected: 'success',
  error: 'danger',
  disconnected: 'secondary'
}[config.value.status] || 'secondary'))

const statusLabel = computed(() => ({
  connected: 'Conectado',
  error: 'Error',
  disconnected: 'Desconectado'
}[config.value.status] || config.value.status))

function readOAuthResult() {
  const { ig, reason } = route.query
  if (!ig) return
  if (ig === 'connected') {
    resultMsg.value = { type: 'success', text: 'Instagram quedó conectado. CabanIA ya responde los mensajes directos de esta cuenta.' }
  } else {
    resultMsg.value = { type: 'danger', text: OAUTH_ERRORS[reason] || OAUTH_ERRORS.exchange_failed }
  }
  // Quitar los parámetros para que el mensaje no reaparezca al recargar.
  router.replace({ path: route.path })
}

async function fetchConfig() {
  try {
    const res = await fetch(`/api/venues/${venueId}/instagram/config`, { credentials: 'include' })
    if (res.status === 403) {
      forbidden.value = true
      return
    }
    if (res.ok) {
      const data = await res.json()
      config.value = { ...config.value, ...data }
      if (data.can_edit_manual) {
        manual.value = {
          ig_user_id: data.ig_user_id || '',
          page_id: data.page_id || '',
          access_token: data.has_token ? '••••••' : '',
          verify_token: data.verify_token || ''
        }
      }
    }
  } catch (err) {
    console.error('[instagram-ui] Error al cargar configuración:', err)
  } finally {
    loading.value = false
  }
}

async function fetchVenueName() {
  try {
    const res = await fetch(`/api/venues/${venueId}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      venueName.value = data.name || ''
    }
  } catch (err) {
    console.error('[instagram-ui] Error al cargar la cabaña:', err)
  }
}

async function connect() {
  connecting.value = true
  resultMsg.value = null
  try {
    const res = await fetch(`/api/venues/${venueId}/instagram/oauth/start`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok || !data.url) {
      resultMsg.value = { type: 'danger', text: data.error || 'No se pudo iniciar la conexión con Instagram' }
      connecting.value = false
      return
    }
    // Instagram pide autorización y vuelve a /api/instagram/oauth/callback.
    window.location.href = data.url
  } catch (err) {
    resultMsg.value = { type: 'danger', text: 'No se pudo iniciar la conexión con Instagram' }
    connecting.value = false
  }
}

async function disconnect() {
  disconnecting.value = true
  try {
    const res = await fetch(`/api/venues/${venueId}/instagram/disconnect`, {
      method: 'POST',
      credentials: 'include'
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      resultMsg.value = { type: 'danger', text: data.error || 'No se pudo desconectar Instagram' }
      return
    }
    resultMsg.value = { type: 'success', text: 'Instagram quedó desconectado.' }
    confirmingDisconnect.value = false
    await fetchConfig()
  } catch (err) {
    resultMsg.value = { type: 'danger', text: 'No se pudo desconectar Instagram' }
  } finally {
    disconnecting.value = false
  }
}

function generateVerifyToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length))
  manual.value.verify_token = token
}

async function saveManual() {
  saving.value = true
  saveMsg.value = null
  try {
    const res = await fetch(`/api/venues/${venueId}/instagram/config`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manual.value)
    })
    const data = await res.json()
    if (!res.ok) {
      saveMsg.value = { type: 'danger', text: data.error || 'Error al guardar la configuración' }
      return
    }

    // El endpoint intenta suscribir la app a los webhooks de la cuenta.
    if (data.subscription && data.subscription.subscribed === false) {
      saveMsg.value = {
        type: 'warning',
        text: 'Configuración guardada, pero no se pudo activar el webhook en Instagram: ' +
              (data.subscription.error || 'error desconocido') +
              '. Revisa el token y que la app de Meta esté publicada.'
      }
    } else if (data.subscription && data.subscription.subscribed) {
      saveMsg.value = { type: 'success', text: 'Instagram conectado. El webhook quedó activo.' }
    } else {
      saveMsg.value = { type: 'success', text: 'Configuración guardada.' }
    }

    await fetchConfig()
  } catch (err) {
    saveMsg.value = { type: 'danger', text: 'Error al guardar la configuración' }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  readOAuthResult()
  fetchVenueName()
  fetchConfig()
})
</script>
