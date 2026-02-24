<template>
  <CRow>
    <CCol :md="6" :lg="6">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Mi Perfil</strong>
        </CCardHeader>
        <CCardBody>
          <div v-if="isLoading" class="text-center py-4">
            <CSpinner color="primary" />
            <p class="mt-2">Cargando...</p>
          </div>
          
          <div v-else-if="!isAuthenticated" class="text-center py-4">
            <CIcon icon="cil-user" size="3xl" class="text-secondary mb-3" />
            <p>No has iniciado sesión</p>
            <CButton color="primary" @click="login">Iniciar Sesión</CButton>
          </div>
          
          <div v-else>
            <div class="text-center mb-4">
              <CAvatar v-if="user.avatar_url" :src="user.avatar_url" size="xl" />
              <CAvatar v-else color="primary" size="xl">
                <span style="font-size: 2rem;">{{ userInitials }}</span>
              </CAvatar>
            </div>
            
            <CListGroup flush>
              <CListGroupItem class="d-flex justify-content-between">
                <span class="text-secondary">Nombre</span>
                <strong>{{ user.display_name || 'Sin nombre' }}</strong>
              </CListGroupItem>
              <CListGroupItem class="d-flex justify-content-between">
                <span class="text-secondary">Email</span>
                <strong>{{ user.email || 'Sin email' }}</strong>
              </CListGroupItem>
              <CListGroupItem class="d-flex justify-content-between">
                <span class="text-secondary">ID de Usuario</span>
                <code>{{ user.id }}</code>
              </CListGroupItem>
              <CListGroupItem v-if="user.role" class="d-flex justify-content-between">
                <span class="text-secondary">Rol</span>
                <CBadge :color="getRoleColor(user.role)">{{ user.role }}</CBadge>
              </CListGroupItem>
              <CListGroupItem v-if="user.created_at" class="d-flex justify-content-between">
                <span class="text-secondary">Miembro desde</span>
                <span>{{ formatDate(user.created_at) }}</span>
              </CListGroupItem>
            </CListGroup>
            
            <!-- Profile and Permissions Accordion -->
            <CAccordion class="mt-4" :active-item-key="1">
              <CAccordionItem :item-key="1">
                <CAccordionHeader>
                  <CIcon icon="cil-shield-alt" class="me-2" />
                  Perfil y Permisos
                </CAccordionHeader>
                <CAccordionBody>
                  <!-- Super Admin Badge -->
                  <div v-if="user.is_super_admin" class="mb-3">
                    <CBadge color="danger" class="px-3 py-2">
                      <CIcon icon="cil-star" class="me-1" />
                      Super Administrador
                    </CBadge>
                    <p class="text-muted small mt-2 mb-0">
                      Tienes acceso completo a todas las funciones del sistema.
                    </p>
                  </div>
                  
                  <!-- Assigned Profile -->
                  <div class="mb-3">
                    <strong class="text-secondary d-block mb-2">Perfil Asignado</strong>
                    <div v-if="user.profile">
                      <CBadge color="primary" class="px-3 py-2">
                        {{ user.profile.name }}
                      </CBadge>
                      <p v-if="user.profile.description" class="text-muted small mt-2 mb-0">
                        {{ user.profile.description }}
                      </p>
                    </div>
                    <div v-else>
                      <span class="text-muted">Sin perfil asignado</span>
                    </div>
                  </div>
                  
                  <!-- Permissions List -->
                  <div v-if="user.permissionDetails && user.permissionDetails.length > 0">
                    <strong class="text-secondary d-block mb-2">Permisos</strong>
                    <CListGroup flush class="border rounded">
                      <CListGroupItem 
                        v-for="perm in user.permissionDetails" 
                        :key="perm.code"
                        class="d-flex justify-content-between align-items-start py-2"
                      >
                        <div>
                          <code class="text-primary">{{ perm.code }}</code>
                          <small v-if="perm.description" class="d-block text-muted">
                            {{ perm.description }}
                          </small>
                        </div>
                        <CIcon icon="cil-check-circle" class="text-success" />
                      </CListGroupItem>
                    </CListGroup>
                  </div>
                  <div v-else-if="!user.is_super_admin && user.profile">
                    <span class="text-muted">Este perfil no tiene permisos específicos asignados.</span>
                  </div>
                  <div v-else-if="!user.is_super_admin">
                    <span class="text-muted">No tienes permisos asignados. Contacta al administrador.</span>
                  </div>
                </CAccordionBody>
              </CAccordionItem>
            </CAccordion>
            
            <div class="mt-4 text-center">
              <CButton color="danger" variant="outline" @click="logout">
                <CIcon icon="cil-account-logout" class="me-2" />
                Cerrar Sesión
              </CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
    
    <CCol v-if="isAuthenticated && !isLoading" :md="6" :lg="6">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Mi Suscripción</strong>
        </CCardHeader>
        <CCardBody>
          <div v-if="user?.subscription">
            <div class="text-center mb-4">
              <CIcon 
                :icon="subscriptionIcon" 
                size="3xl" 
                :class="subscriptionIconColor" 
              />
            </div>
            
            <CListGroup flush>
              <CListGroupItem class="d-flex justify-content-between">
                <span class="text-secondary">Plan</span>
                <strong>{{ user.subscription.name }}</strong>
              </CListGroupItem>
              <CListGroupItem class="d-flex justify-content-between">
                <span class="text-secondary">Estado</span>
                <CBadge :color="user.subscription.is_active ? 'success' : 'danger'">
                  {{ user.subscription.is_active ? 'Activa' : 'Inactiva' }}
                </CBadge>
              </CListGroupItem>
              <CListGroupItem v-if="user.subscription.trial_days_remaining" class="d-flex justify-content-between">
                <span class="text-secondary">Días de prueba</span>
                <CBadge :color="trialBadgeColor">
                  {{ user.subscription.trial_days_remaining }} días restantes
                </CBadge>
              </CListGroupItem>
              <CListGroupItem v-if="user.subscription.is_trial_expired" class="d-flex justify-content-between">
                <span class="text-secondary">Prueba</span>
                <CBadge color="danger">Expirada</CBadge>
              </CListGroupItem>
              <CListGroupItem v-if="user.subscription.trial_expires_at || user.subscription.expires_at" class="d-flex justify-content-between">
                <span class="text-secondary">{{ user.subscription.trial_expires_at ? 'Prueba expira' : 'Expira' }}</span>
                <span>{{ formatDate(user.subscription.trial_expires_at || user.subscription.expires_at) }}</span>
              </CListGroupItem>
              <CListGroupItem class="d-flex justify-content-between">
                <span class="text-secondary">Rol</span>
                <CBadge :color="user.subscription.is_owner ? 'primary' : 'secondary'">
                  {{ user.subscription.is_owner ? 'Propietario' : 'Miembro' }}
                </CBadge>
              </CListGroupItem>
            </CListGroup>
            
            <CAlert v-if="user.subscription.trial_days_remaining && user.subscription.trial_days_remaining <= 7" :color="trialAlertColor" class="mt-4">
              <CIcon icon="cil-bell" class="me-2" />
              <span v-if="user.subscription.trial_days_remaining <= 3">
                <strong>¡Tu prueba está por expirar!</strong> Contacta al administrador para activar tu suscripción.
              </span>
              <span v-else>
                Tu período de prueba expirará pronto. Considera activar una suscripción.
              </span>
            </CAlert>
          </div>
          
          <div v-else class="text-center py-4">
            <CIcon icon="cil-x-circle" size="3xl" class="text-danger mb-3" />
            <p class="text-muted">No tienes una suscripción activa.</p>
            <p class="small text-muted">Contacta al administrador para obtener acceso.</p>
          </div>
        </CCardBody>
      </CCard>

      <!-- Change Password -->
      <CCard class="mb-4">
        <CCardHeader>
          <strong>
            <CIcon :icon="cilLockLocked" class="me-2" />
            Cambiar Contraseña
          </strong>
        </CCardHeader>
        <CCardBody>
          <CAlert v-if="pwMsg.text" :color="pwMsg.color" class="py-2" :dismissible="false">
            {{ pwMsg.text }}
          </CAlert>
          <div class="mb-3">
            <CFormLabel>Contraseña actual</CFormLabel>
            <CFormInput type="password" v-model="pwForm.current" autocomplete="current-password" />
          </div>
          <div class="mb-3">
            <CFormLabel>Nueva contraseña</CFormLabel>
            <div class="input-group">
              <CFormInput
                :type="showNewPw ? 'text' : 'password'"
                v-model="pwForm.newPw"
                autocomplete="new-password"
              />
              <CButton color="secondary" variant="outline" @click="showNewPw = !showNewPw" :title="showNewPw ? 'Ocultar' : 'Mostrar'">
                <CIcon :icon="showNewPw ? cilLockUnlocked : cilLockLocked" />
              </CButton>
            </div>
          </div>
          <div class="mb-3">
            <CFormLabel>Confirmar nueva contraseña</CFormLabel>
            <CFormInput type="password" v-model="pwForm.confirm" autocomplete="new-password" />
            <small v-if="pwForm.confirm && pwForm.newPw !== pwForm.confirm" class="text-danger">
              Las contraseñas no coinciden
            </small>
          </div>

          <!-- Random password generator -->
          <div class="border rounded p-3 mb-3">
            <strong class="d-block mb-2 small text-secondary">Generar contraseña aleatoria</strong>
            <CRow class="align-items-end g-2">
              <CCol :xs="5" :sm="4">
                <CFormLabel class="small mb-1">Caracteres</CFormLabel>
                <CFormInput type="number" v-model.number="pwGen.length" min="8" max="64" size="sm" />
              </CCol>
              <CCol :xs="7" :sm="4">
                <CFormCheck
                  v-model="pwGen.specialChars"
                  label="Caracteres especiales"
                  class="small"
                />
              </CCol>
              <CCol :xs="12" :sm="4">
                <CButton color="info" variant="outline" size="sm" class="w-100" @click="generatePassword">
                  Generar
                </CButton>
              </CCol>
            </CRow>
          </div>

          <CButton
            color="primary"
            class="w-100"
            :disabled="savingPw || !pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm || pwForm.newPw.length < 8"
            @click="handleChangePassword"
          >
            <CSpinner v-if="savingPw" size="sm" class="me-1" />
            Cambiar Contraseña
          </CButton>
          <small v-if="pwForm.newPw && pwForm.newPw.length < 8" class="text-danger d-block mt-1">
            Mínimo 8 caracteres
          </small>
        </CCardBody>
      </CCard>

      <!-- Passkeys Management -->
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>
            <CIcon :icon="cilFingerprint" class="me-2" />
            Passkeys
          </strong>
          <CButton
            v-if="supportsPasskeys"
            color="primary"
            size="sm"
            @click="showRegisterModal = true"
          >
            Registrar Passkey
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div v-if="!supportsPasskeys" class="text-center py-3">
            <p class="text-muted mb-0">Tu navegador no soporta passkeys.</p>
          </div>

          <div v-else-if="loadingPasskeys" class="text-center py-3">
            <CSpinner size="sm" color="primary" />
          </div>

          <div v-else-if="passkeys.length === 0" class="text-center py-3">
            <CIcon :icon="cilFingerprint" size="xl" class="text-secondary mb-2" />
            <p class="text-muted mb-0">No tienes passkeys registradas.</p>
            <p class="small text-muted">Las passkeys te permiten iniciar sesión sin contraseña usando tu huella, rostro o PIN.</p>
          </div>

          <CListGroup v-else flush>
            <CListGroupItem
              v-for="pk in passkeys"
              :key="pk.id"
              class="d-flex justify-content-between align-items-center"
            >
              <div>
                <strong>{{ pk.display_name || 'Passkey' }}</strong>
                <small class="d-block text-muted">
                  Creada {{ formatDate(pk.created_at) }}
                  <template v-if="pk.last_used_at">
                    &middot; Último uso {{ formatDate(pk.last_used_at) }}
                  </template>
                </small>
              </div>
              <CButton
                color="danger"
                variant="ghost"
                size="sm"
                @click="handleDelete(pk)"
              >
                <CIcon icon="cil-trash" />
              </CButton>
            </CListGroupItem>
          </CListGroup>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Register Passkey Modal -->
  <CModal :visible="showRegisterModal" @close="showRegisterModal = false" alignment="center">
    <CModalHeader>
      <CModalTitle>Registrar Passkey</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <p class="text-muted">Dale un nombre a tu passkey para identificarla después.</p>
      <CFormInput
        v-model="passkeyName"
        placeholder="Ej: MacBook Pro, iPhone"
        @keyup.enter="handleRegister"
      />
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showRegisterModal = false">
        Cancelar
      </CButton>
      <CButton color="primary" @click="handleRegister" :disabled="registeringPasskey">
        <CSpinner v-if="registeringPasskey" size="sm" class="me-1" />
        Registrar
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { CIcon } from '@coreui/icons-vue'
import { cilFingerprint, cilLockLocked, cilLockUnlocked } from '@coreui/icons'

const { user, isLoading, isAuthenticated, login, logout, supportsPasskeys, registerPasskey, getPasskeys, deletePasskey } = useAuth()

// --- Change password ---
const pwForm = ref({ current: '', newPw: '', confirm: '' })
const savingPw = ref(false)
const showNewPw = ref(false)
const pwMsg = ref({ text: '', color: 'success' })
const pwGen = ref({ length: 16, specialChars: true })

const generatePassword = () => {
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'
  const special = '!@#$%&*_+-='
  let chars = lower + upper + digits
  if (pwGen.value.specialChars) chars += special
  const len = Math.max(8, Math.min(64, pwGen.value.length || 16))
  let result = ''
  const array = new Uint32Array(len)
  crypto.getRandomValues(array)
  for (let i = 0; i < len; i++) {
    result += chars[array[i] % chars.length]
  }
  pwForm.value.newPw = result
  pwForm.value.confirm = result
  showNewPw.value = true
}

const handleChangePassword = async () => {
  if (pwForm.value.newPw !== pwForm.value.confirm) return
  savingPw.value = true
  pwMsg.value = { text: '', color: 'success' }
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        currentPassword: pwForm.value.current,
        newPassword: pwForm.value.newPw,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al cambiar contraseña')
    pwMsg.value = { text: 'Contraseña actualizada exitosamente', color: 'success' }
    pwForm.value = { current: '', newPw: '', confirm: '' }
    showNewPw.value = false
  } catch (err) {
    pwMsg.value = { text: err.message, color: 'danger' }
  } finally {
    savingPw.value = false
  }
}

// --- Passkeys ---
const passkeys = ref([])
const loadingPasskeys = ref(false)
const showRegisterModal = ref(false)
const passkeyName = ref('')
const registeringPasskey = ref(false)

const loadPasskeys = async () => {
  loadingPasskeys.value = true
  passkeys.value = await getPasskeys()
  loadingPasskeys.value = false
}

const handleRegister = async () => {
  registeringPasskey.value = true
  const success = await registerPasskey(passkeyName.value || 'Passkey')
  registeringPasskey.value = false
  if (success) {
    showRegisterModal.value = false
    passkeyName.value = ''
    await loadPasskeys()
  }
}

const handleDelete = async (pk) => {
  if (!confirm(`¿Eliminar la passkey "${pk.display_name || 'Passkey'}"?`)) return
  await deletePasskey(pk.id)
  await loadPasskeys()
}

onMounted(() => {
  if (supportsPasskeys.value) {
    loadPasskeys()
  }
})

const userInitials = computed(() => {
  if (!user.value) return '?'
  const name = user.value.display_name || user.value.email || ''
  return name.charAt(0).toUpperCase()
})

const subscriptionIcon = computed(() => {
  if (!user.value?.subscription) return 'cil-x-circle'
  if (user.value.subscription.is_trial_expired) return 'cil-clock'
  if (user.value.subscription.trial_expires_at) return 'cil-clock'
  return 'cil-check-circle'
})

const subscriptionIconColor = computed(() => {
  if (!user.value?.subscription) return 'text-danger'
  if (user.value.subscription.is_trial_expired) return 'text-danger'
  if (!user.value.subscription.is_active) return 'text-danger'
  if (user.value.subscription.trial_days_remaining <= 3) return 'text-warning'
  return 'text-success'
})

const trialBadgeColor = computed(() => {
  const days = user.value?.subscription?.trial_days_remaining || 0
  if (days <= 3) return 'danger'
  if (days <= 7) return 'warning'
  return 'info'
})

const trialAlertColor = computed(() => {
  const days = user.value?.subscription?.trial_days_remaining || 0
  if (days <= 3) return 'danger'
  return 'warning'
})

function getRoleColor(role) {
  const colors = {
    admin: 'danger',
    manager: 'warning',
    user: 'info'
  }
  return colors[role] || 'secondary'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota'
  })
}
</script>
