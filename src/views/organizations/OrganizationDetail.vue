<template>
  <CRow>
    <CCol :xs="12" md="10" lg="8" class="mx-auto">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>{{ organization?.name || 'Organización' }}</strong>
        </CCardHeader>
        <CCardBody>
          <template v-if="organization">
            <CNav variant="tabs" class="mb-3">
              <CNavItem>
                <CNavLink href="javascript:void(0)" :active="activeTab === 0" @click="activeTab = 0">
                  Detalles
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink href="javascript:void(0)" :active="activeTab === 1" @click="activeTab = 1">
                  Acceso
                  <CBadge v-if="users.length" color="info" class="ms-1" size="sm">{{ users.length }}</CBadge>
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink href="javascript:void(0)" :active="activeTab === 2" @click="activeTab = 2">
                  Módulos
                </CNavLink>
              </CNavItem>
            </CNav>

            <CTabContent>
              <!-- Tab Detalles -->
              <CTabPane :visible="activeTab === 0">
                <p class="d-none"><strong>ID:</strong> <span class="text-body-secondary">{{ organization.id }}</span></p>
                <p><strong>Nombre:</strong> <span class="text-body-secondary">{{ organization.name }}</span></p>
                <div class="mt-4 d-flex flex-wrap gap-2">
                  <RouterLink :to="`/business/organizations/${organization.id}/edit`">
                    <CButton color="primary" size="sm">Editar</CButton>
                  </RouterLink>
                  <CButton color="danger" size="sm" @click="onDelete">Eliminar</CButton>
                  <RouterLink to="/business/organizations">
                    <CButton color="secondary" size="sm" variant="outline">Volver a la Lista</CButton>
                  </RouterLink>
                </div>
              </CTabPane>

              <!-- Tab Acceso -->
              <CTabPane :visible="activeTab === 1">
                <!-- Invite form -->
                <CCard class="mb-3 border">
                  <CCardBody>
                    <h6 class="mb-3">Invitar persona</h6>
                    <CRow class="g-2 align-items-end">
                      <CCol :xs="12" :sm="6" :md="3">
                        <CFormLabel class="small">Canal</CFormLabel>
                        <CFormSelect v-model="inviteForm.channel" size="sm">
                          <option value="email">Email</option>
                          <option value="whatsapp">WhatsApp</option>
                        </CFormSelect>
                      </CCol>
                      <CCol :xs="12" :sm="6" :md="3">
                        <CFormLabel class="small">{{ inviteForm.channel === 'email' ? 'Email' : 'Teléfono' }}</CFormLabel>
                        <CFormInput
                          v-model="inviteForm.contact"
                          size="sm"
                          :type="inviteForm.channel === 'email' ? 'email' : 'tel'"
                          :placeholder="inviteForm.channel === 'email' ? 'correo@ejemplo.com' : '3001234567'"
                          required
                        />
                      </CCol>
                      <CCol :xs="12" :sm="6" :md="3">
                        <CFormLabel class="small">Perfil</CFormLabel>
                        <CFormSelect v-model="inviteForm.profile_code" size="sm">
                          <option v-for="p in availableProfiles" :key="p.code" :value="p.code">{{ p.name }}</option>
                        </CFormSelect>
                      </CCol>
                      <CCol :xs="12" :sm="6" :md="3">
                        <CButton
                          color="primary"
                          size="sm"
                          class="w-100"
                          :disabled="inviteSending || !inviteForm.contact"
                          @click="sendInvitation"
                        >
                          <CSpinner v-if="inviteSending" size="sm" class="me-1" />
                          Enviar invitación
                        </CButton>
                      </CCol>
                    </CRow>
                    <CFormInput
                      v-model="inviteForm.message"
                      size="sm"
                      class="mt-2"
                      placeholder="Mensaje personalizado (opcional)"
                    />
                  </CCardBody>
                </CCard>

                <!-- Toast -->
                <CAlert v-if="toast.show" :color="toast.color" dismissible class="mb-3" @close="toast.show = false">
                  {{ toast.text }}
                </CAlert>

                <!-- Current users -->
                <h6 class="mb-2">Usuarios con acceso</h6>
                <CListGroup v-if="users.length" flush class="mb-3">
                  <CListGroupItem v-for="u in users" :key="u.id" class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                      <CAvatar v-if="u.avatar_url" :src="u.avatar_url" size="sm" class="me-2" />
                      <CAvatar v-else color="primary" size="sm" class="me-2">
                        {{ (u.display_name || u.email || '?').charAt(0).toUpperCase() }}
                      </CAvatar>
                      <div>
                        <div>{{ u.display_name || u.email }}</div>
                        <small v-if="u.display_name && u.email" class="text-muted">{{ u.email }}</small>
                      </div>
                      <CBadge v-if="u.profile" :color="profileBadgeColor(u.profile.code)" class="ms-2" size="sm">
                        {{ u.profile.name }}
                      </CBadge>
                    </div>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      @click="removeUser(u)"
                      :disabled="removingUserId === u.id"
                      title="Remover acceso"
                    >
                      <CSpinner v-if="removingUserId === u.id" size="sm" />
                      <span v-else>&times;</span>
                    </CButton>
                  </CListGroupItem>
                </CListGroup>
                <div v-else class="text-body-secondary mb-3">No hay usuarios asignados.</div>

                <!-- Pending invitations -->
                <h6 class="mb-2">Invitaciones pendientes</h6>
                <div v-if="loadingInvitations" class="text-center py-2">
                  <CSpinner size="sm" />
                </div>
                <CListGroup v-else-if="pendingInvitations.length" flush>
                  <CListGroupItem v-for="inv in pendingInvitations" :key="inv.id" class="d-flex align-items-center justify-content-between">
                    <div>
                      <div class="small">
                        <strong>{{ inv.channel === 'email' ? inv.email : inv.phone }}</strong>
                        <CBadge color="warning" class="ms-1" size="sm">pendiente</CBadge>
                      </div>
                      <small class="text-muted">
                        Enviada {{ formatDate(inv.created_at) }}
                        &middot; Expira {{ formatDate(inv.expires_at) }}
                      </small>
                    </div>
                    <div class="d-flex gap-1">
                      <CButton
                        color="info"
                        variant="ghost"
                        size="sm"
                        @click="resendInvitation(inv)"
                        :disabled="resendingId === inv.id"
                        title="Reenviar"
                      >
                        <CSpinner v-if="resendingId === inv.id" size="sm" />
                        <span v-else>&#8635;</span>
                      </CButton>
                      <CButton
                        color="danger"
                        variant="ghost"
                        size="sm"
                        @click="cancelInvitation(inv)"
                        :disabled="cancellingId === inv.id"
                        title="Cancelar"
                      >
                        <CSpinner v-if="cancellingId === inv.id" size="sm" />
                        <span v-else>&times;</span>
                      </CButton>
                    </div>
                  </CListGroupItem>
                </CListGroup>
                <div v-else class="text-body-secondary">No hay invitaciones pendientes.</div>
              </CTabPane>

              <!-- Tab Módulos -->
              <CTabPane :visible="activeTab === 2">
                <p class="text-body-secondary small mb-3">
                  Apaga lo que esta organización no usa: desaparece del menú y de las demás pantallas.
                  Los datos no se borran; si lo vuelves a activar, todo sigue ahí.
                  Alquileres, pagos, calendario, contactos, cabañas, egresos y análisis siempre están activos.
                </p>
                <CAlert v-if="modulesToast.show" :color="modulesToast.color" class="mb-3 py-2">
                  {{ modulesToast.text }}
                </CAlert>
                <div v-if="loadingModules" class="text-center py-2">
                  <CSpinner size="sm" />
                </div>
                <template v-else-if="orgModules">
                  <CAlert v-if="!orgModules.can_edit" color="info" class="py-2 small">
                    Solo un administrador de la organización puede activar o desactivar módulos.
                  </CAlert>
                  <CListGroup flush>
                    <CListGroupItem v-for="m in orgModules.modules" :key="m.key" class="d-flex align-items-start justify-content-between gap-3 px-0">
                      <div>
                        <div class="fw-semibold">{{ m.name }}</div>
                        <small class="text-body-secondary">{{ m.description }}</small>
                      </div>
                      <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <CSpinner v-if="savingModule === m.key" size="sm" />
                        <CFormSwitch
                          :id="`module-${m.key}`"
                          size="lg"
                          :model-value="m.enabled"
                          :disabled="!orgModules.can_edit || savingModule !== null"
                          :aria-label="`${m.enabled ? 'Desactivar' : 'Activar'} ${m.name}`"
                          @update:model-value="toggleModule(m, $event)"
                        />
                      </div>
                    </CListGroupItem>
                  </CListGroup>
                </template>
              </CTabPane>
            </CTabContent>
          </template>
          <template v-else>
            <CSpinner color="primary" /> Cargando...
          </template>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrganizationById, deleteOrganization } from '@/services/organizationService'
import { fetchUsersByOrganization, removeUserFromOrganization } from '@/services/userOrganizationService'
import { useAuth } from '@/composables/useAuth'
import { resetAuthState } from '@/router'

const route = useRoute()
const router = useRouter()
const organization = ref(null)
const users = ref([])
const activeTab = ref(0)

// Invitation form
const inviteForm = reactive({
  channel: 'whatsapp',
  contact: '',
  profile_code: 'organization:partner',
  message: '',
})
const inviteSending = ref(false)
const availableProfiles = ref([
  { code: 'organization:partner', name: 'Aliado (acceso limitado)' },
  { code: 'organization:view', name: 'Solo lectura' },
  { code: 'organization:admin', name: 'Administrador' },
])

// Invitations state
const pendingInvitations = ref([])
const loadingInvitations = ref(false)
const resendingId = ref(null)
const cancellingId = ref(null)
const removingUserId = ref(null)

// Toast
const toast = reactive({ show: false, text: '', color: 'success' })

// Módulos
const { fetchUser } = useAuth()
const orgModules = ref(null)
const loadingModules = ref(false)
const savingModule = ref(null)
const modulesToast = reactive({ show: false, text: '', color: 'success' })

function showModulesToast(text, color = 'success') {
  modulesToast.text = text
  modulesToast.color = color
  modulesToast.show = true
  setTimeout(() => { modulesToast.show = false }, 4000)
}

async function loadModules() {
  loadingModules.value = true
  try {
    const res = await fetch(`/api/organizations/${route.params.id}/modules`, { credentials: 'include' })
    if (res.ok) orgModules.value = await res.json()
  } catch { /* ignore */ }
  finally { loadingModules.value = false }
}

async function toggleModule(m, enabled) {
  savingModule.value = m.key
  try {
    const res = await fetch(`/api/organizations/${route.params.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ modules: { [m.key]: enabled } }),
    })
    const data = await res.json()
    if (!res.ok) {
      showModulesToast(data.error || 'Error al guardar', 'danger')
      return
    }
    orgModules.value = data
    showModulesToast(`${m.name} ${enabled ? 'activado' : 'desactivado'}`)
    // El menú y las rutas leen los módulos del usuario: se recargan.
    resetAuthState()
    await fetchUser()
  } catch {
    showModulesToast('Error de conexión', 'danger')
  } finally {
    savingModule.value = null
  }
}

function showToast(text, color = 'success') {
  toast.text = text
  toast.color = color
  toast.show = true
  setTimeout(() => { toast.show = false }, 4000)
}

function profileBadgeColor(code) {
  if (code === 'organization:admin') return 'primary'
  if (code === 'organization:partner') return 'info'
  if (code === 'organization:view') return 'secondary'
  return 'light'
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const onDelete = async () => {
  if (confirm(`¿Estás seguro de eliminar la organización "${organization.value.name}"?`)) {
    await deleteOrganization(organization.value.id)
    router.push('/business/organizations')
  }
}

async function loadUsers() {
  users.value = await fetchUsersByOrganization(route.params.id)
}

async function loadInvitations() {
  loadingInvitations.value = true
  try {
    const res = await fetch(`/api/invitations?organization_id=${route.params.id}&status=pending`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      pendingInvitations.value = Array.isArray(data) ? data : (data.invitations || [])
    }
  } catch { /* ignore */ }
  finally { loadingInvitations.value = false }
}

async function sendInvitation() {
  inviteSending.value = true
  try {
    const body = {
      channel: inviteForm.channel,
      organization_id: route.params.id,
      profile_code: inviteForm.profile_code,
      message: inviteForm.message || undefined,
    }
    if (inviteForm.channel === 'email') {
      body.email = inviteForm.contact
    } else {
      body.phone = inviteForm.contact
    }

    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      showToast('Invitación enviada')
      inviteForm.contact = ''
      inviteForm.message = ''
      await loadInvitations()
    } else {
      showToast(data.error || 'Error al enviar', 'danger')
    }
  } catch {
    showToast('Error de conexión', 'danger')
  } finally {
    inviteSending.value = false
  }
}

async function resendInvitation(inv) {
  resendingId.value = inv.id
  try {
    const res = await fetch(`/api/invitations/${inv.id}/resend`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      showToast('Invitación reenviada')
      await loadInvitations()
    } else {
      const data = await res.json()
      showToast(data.error || 'Error al reenviar', 'danger')
    }
  } catch {
    showToast('Error de conexión', 'danger')
  } finally {
    resendingId.value = null
  }
}

async function cancelInvitation(inv) {
  if (!confirm('¿Cancelar esta invitación?')) return
  cancellingId.value = inv.id
  try {
    const res = await fetch(`/api/invitations/${inv.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      showToast('Invitación cancelada')
      await loadInvitations()
    } else {
      const data = await res.json()
      showToast(data.error || 'Error al cancelar', 'danger')
    }
  } catch {
    showToast('Error de conexión', 'danger')
  } finally {
    cancellingId.value = null
  }
}

async function removeUser(u) {
  if (!confirm(`¿Remover el acceso de ${u.display_name || u.email} a esta organización?`)) return
  removingUserId.value = u.id
  try {
    await removeUserFromOrganization(route.params.id, u.id)
    showToast('Acceso removido')
    await loadUsers()
  } catch (err) {
    showToast(err.message || 'Error al remover', 'danger')
  } finally {
    removingUserId.value = null
  }
}

onMounted(async () => {
  organization.value = await getOrganizationById(route.params.id)
  await Promise.all([loadUsers(), loadInvitations(), loadModules()])
})
</script>
