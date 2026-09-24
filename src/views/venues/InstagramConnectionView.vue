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

          <!-- No super admin -->
          <div v-else-if="!isSuperAdmin" class="py-4 text-center">
            <CIcon icon="cil-lock-locked" size="3xl" class="text-body-secondary mb-3" />
            <p class="text-body-secondary">
              Solo un super administrador puede configurar la conexión de Instagram.
            </p>
          </div>

          <div v-else>
            <p class="text-body-secondary small mb-3">
              Conecta la cuenta de Instagram (tipo Empresa) de esta cabaña para que CabanIA
              responda automáticamente los mensajes directos de tus clientes.
            </p>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Instagram Business Account ID</label>
              <CFormInput
                v-model="config.ig_user_id"
                placeholder="Ej: 17841400000000000"
                size="sm"
              />
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Access Token</label>
              <CFormInput
                v-model="config.access_token"
                type="password"
                placeholder="Token de acceso de Meta"
                size="sm"
              />
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Verify Token (webhook)</label>
              <div class="d-flex gap-2">
                <CFormInput
                  v-model="config.verify_token"
                  placeholder="Token de verificación"
                  size="sm"
                />
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

            <div class="d-flex gap-2">
              <CButton color="primary" size="sm" @click="save" :disabled="saving">
                <CSpinner v-if="saving" size="sm" class="me-1" />
                Guardar
              </CButton>
            </div>

            <CAlert v-if="saveMsg" :color="saveMsg.type" class="mt-3 small py-2">
              {{ saveMsg.text }}
            </CAlert>
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
import { useRoute } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const venueId = route.params.id
const { user } = useAuth()
const isSuperAdmin = computed(() => user.value?.is_super_admin === true)

const venueName = ref('')
const loading = ref(true)
const saving = ref(false)
const saveMsg = ref(null)
const status = ref('disconnected')

const config = ref({
  ig_user_id: '',
  page_id: '',
  access_token: '',
  verify_token: ''
})

const webhookUrl = computed(() => {
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base}/api/webhook/instagram`
})

const statusBadgeColor = computed(() => ({
  connected: 'success',
  error: 'danger',
  disconnected: 'secondary'
}[status.value] || 'secondary'))

const statusLabel = computed(() => ({
  connected: 'Conectado',
  error: 'Error',
  disconnected: 'Desconectado'
}[status.value] || status.value))

async function fetchConfig() {
  try {
    const res = await fetch(`/api/venues/${venueId}/instagram/config`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      config.value = {
        ig_user_id: data.ig_user_id || '',
        page_id: data.page_id || '',
        access_token: data.has_token ? '••••••' : '',
        verify_token: data.verify_token || ''
      }
      status.value = data.status || 'disconnected'
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

function generateVerifyToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length))
  config.value.verify_token = token
}

async function save() {
  saving.value = true
  saveMsg.value = null
  try {
    const res = await fetch(`/api/venues/${venueId}/instagram/config`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
    const data = await res.json()
    if (!res.ok) {
      saveMsg.value = { type: 'danger', text: data.error || 'Error al guardar la configuración' }
      return
    }

    // El endpoint intenta suscribir la app a los webhooks de la cuenta.
    if (data.subscription && data.subscription.subscribed === false) {
      status.value = 'error'
      saveMsg.value = {
        type: 'warning',
        text: 'Configuración guardada, pero no se pudo activar el webhook en Instagram: ' +
              (data.subscription.error || 'error desconocido') +
              '. Revisa el token y que la app de Meta esté publicada.'
      }
    } else if (data.subscription && data.subscription.subscribed) {
      status.value = 'connected'
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
  fetchVenueName()
  fetchConfig()
})
</script>
