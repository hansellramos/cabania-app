<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Preferencias</strong>
        </CCardHeader>
        <CCardBody>
          <CFormLabel for="homeView">Vista inicial</CFormLabel>
          <CFormSelect id="homeView" v-model="homeView" style="max-width: 320px" :disabled="savingHome" @change="saveHomeView">
            <option v-for="view in homeViews" :key="view.value" :value="view.value">{{ view.label }}</option>
          </CFormSelect>
          <div class="form-text text-muted">
            Lo primero que ves al entrar a CabanIA.
            <span v-if="homeSaved" class="text-success ms-1">Guardado ✓</span>
            <span v-if="homeError" class="text-danger ms-1">{{ homeError }}</span>
          </div>
        </CCardBody>
      </CCard>
    </CCol>

    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Settings</strong>
        </CCardHeader>
        <CCardBody v-if="user?.is_super_admin">
          <div class="mb-3">
            <CFormCheck
              id="developmentMode"
              v-model="settingsStore.developmentMode"
              label="Development Mode"
            />
            <div class="form-text text-muted">
              Habilita las secciones Theme, Components y Extras en el menú lateral.
            </div>
          </div>
        </CCardBody>
      </CCard>
    </CCol>

    <CCol :xs="12" v-if="user?.is_super_admin">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Sistema</strong>
        </CCardHeader>
        <CCardBody>
          <div class="d-flex gap-2 flex-wrap">
            <RouterLink to="/admin/system-whatsapp">
              <CButton color="success" variant="outline">
                <CIcon name="cil-phone" class="me-1" /> WhatsApp Sistema
              </CButton>
            </RouterLink>
            <RouterLink to="/admin/ai-settings">
              <CButton color="info" variant="outline">
                <CIcon name="cil-bolt" class="me-1" /> Configuración IA
              </CButton>
            </RouterLink>
            <RouterLink to="/admin/ai-usage">
              <CButton color="secondary" variant="outline">
                <CIcon name="cil-chart" class="me-1" /> Uso de IA
              </CButton>
            </RouterLink>
            <RouterLink to="/admin/message-templates">
              <CButton color="warning" variant="outline">
                <CIcon name="cil-speech" class="me-1" /> Templates de Mensajes
              </CButton>
            </RouterLink>
          </div>
        </CCardBody>
      </CCard>
    </CCol>

    <CCol :xs="12" v-if="user?.is_super_admin">
      <CCard class="mb-4 border-warning">
        <CCardHeader class="bg-warning bg-opacity-25">
          <strong>God Mode</strong>
          <CBadge color="warning" class="ms-2">Super Admin</CBadge>
        </CCardHeader>
        <CCardBody>
          <p class="text-muted mb-4">
            Esta sección solo es visible para super administradores. Desde aquí puedes gestionar los permisos de super admin de otros usuarios.
          </p>
          
          <div class="mb-4 p-3 bg-light rounded">
            <CFormCheck 
              id="godModeViewAll"
              :model-value="settingsStore.godModeViewAll"
              @update:model-value="(val) => settingsStore.godModeViewAll = val"
              label="Ver todas las organizaciones"
            />
            <div class="form-text text-muted">
              Cuando está habilitado, podrás ver y gestionar todas las organizaciones del sistema. Si está deshabilitado, solo verás las organizaciones asignadas a tu usuario.
            </div>
          </div>
          
          <hr class="my-4" />
          
          <h6 class="mb-3">Super Admins Actuales</h6>
          
          <div v-if="loadingSuperAdmins" class="text-center py-3">
            <CSpinner size="sm" />
          </div>
          
          <CTable v-else-if="superAdmins && superAdmins.length > 0" hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Usuario</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell class="text-end">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="admin in superAdmins" :key="admin.id">
                <CTableDataCell>
                  <div class="d-flex align-items-center gap-2">
                    <CAvatar :src="admin.avatar_url" size="sm" v-if="admin.avatar_url" />
                    <CAvatar color="secondary" size="sm" v-else>
                      {{ (admin.display_name || admin.email || '?')[0].toUpperCase() }}
                    </CAvatar>
                    {{ admin.display_name || 'Sin nombre' }}
                  </div>
                </CTableDataCell>
                <CTableDataCell>{{ admin.email }}</CTableDataCell>
                <CTableDataCell class="text-end">
                  <CButton 
                    v-if="admin.id !== user.id"
                    color="danger" 
                    variant="ghost"
                    size="sm"
                    @click="revokeSuperAdmin(admin)"
                    :disabled="savingId === admin.id"
                  >
                    <CSpinner size="sm" v-if="savingId === admin.id" />
                    <span v-else>Revocar</span>
                  </CButton>
                  <CBadge v-else color="info">Tú</CBadge>
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
          
          <CAlert color="info" v-else>
            No hay super admins configurados.
          </CAlert>
          
          <hr class="my-4" />
          
          <h6 class="mb-3">Agregar Super Admin</h6>
          <div class="d-flex gap-2 align-items-end">
            <div class="flex-grow-1">
              <CFormLabel>Seleccionar usuario</CFormLabel>
              <CFormSelect v-model="selectedUserId">
                <option value="">Seleccionar...</option>
                <option 
                  v-for="u in availableUsers" 
                  :key="u.id" 
                  :value="u.id"
                >
                  {{ u.display_name || u.email }}
                </option>
              </CFormSelect>
            </div>
            <CButton 
              color="warning" 
              :disabled="!selectedUserId || savingId === selectedUserId"
              @click="grantSuperAdmin"
            >
              <CSpinner size="sm" v-if="savingId === selectedUserId" />
              <span v-else>Otorgar Super Admin</span>
            </CButton>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'
import { revalidateAuth } from '@/router'

const settingsStore = useSettingsStore()
const { user } = useAuth()

const homeViews = [
  { value: '/dashboard', label: 'Análisis de Hospedajes' },
  { value: '/next', label: 'Próximos alquileres' },
  { value: '/availability', label: 'Disponibilidad' },
  { value: '/analytics', label: 'Análisis Financiero' }
]
const homeView = ref('/dashboard')
const savingHome = ref(false)
const homeSaved = ref(false)
const homeError = ref('')

watch(user, (u) => {
  if (u?.preferences?.home_view) homeView.value = u.preferences.home_view
}, { immediate: true })

async function saveHomeView() {
  savingHome.value = true
  homeSaved.value = false
  homeError.value = ''
  try {
    const response = await fetch('/api/auth/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home_view: homeView.value })
    })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'No se pudo guardar')
    // The router keeps the signed-in user cached: refresh it so the next login lands there.
    await revalidateAuth()
    homeSaved.value = true
  } catch (err) {
    homeError.value = err.message
  } finally {
    savingHome.value = false
  }
}

const superAdmins = ref([])
const allUsers = ref([])
const loadingSuperAdmins = ref(false)
const savingId = ref(null)
const selectedUserId = ref('')

const availableUsers = computed(() => {
  const superAdminIds = (superAdmins.value || []).map(a => a.id)
  return (allUsers.value || []).filter(u => !superAdminIds.includes(u.id))
})

async function loadSuperAdmins() {
  if (!user.value?.is_super_admin) return
  
  loadingSuperAdmins.value = true
  try {
    const [adminsRes, usersRes] = await Promise.all([
      fetch('/api/users/super-admins', { credentials: 'include' }),
      fetch('/api/users', { credentials: 'include' })
    ])
    
    if (adminsRes.ok) {
      const adminsData = await adminsRes.json()
      superAdmins.value = Array.isArray(adminsData) ? adminsData : []
    }
    if (usersRes.ok) {
      const usersData = await usersRes.json()
      allUsers.value = Array.isArray(usersData) ? usersData : []
    }
  } catch (error) {
    console.error('Error loading super admins:', error)
  } finally {
    loadingSuperAdmins.value = false
  }
}

watch(() => user.value?.is_super_admin, (isSuperAdmin) => {
  if (isSuperAdmin && (!superAdmins.value || superAdmins.value.length === 0)) {
    loadSuperAdmins()
  }
}, { immediate: true })

async function revokeSuperAdmin(admin) {
  if (!confirm(`¿Estás seguro de revocar el permiso de super admin a ${admin.display_name || admin.email}?`)) {
    return
  }
  
  savingId.value = admin.id
  try {
    const res = await fetch(`/api/users/${admin.id}/super-admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_super_admin: false })
    })
    
    if (res.ok) {
      await loadSuperAdmins()
    } else {
      const data = await res.json()
      alert(data.error || 'Error al revocar permiso')
    }
  } catch (error) {
    alert('Error al revocar permiso')
  } finally {
    savingId.value = null
  }
}

async function grantSuperAdmin() {
  if (!selectedUserId.value) return
  
  const targetUser = allUsers.value.find(u => u.id === selectedUserId.value)
  if (!confirm(`¿Estás seguro de otorgar permiso de super admin a ${targetUser?.display_name || targetUser?.email}?`)) {
    return
  }
  
  savingId.value = selectedUserId.value
  try {
    const res = await fetch(`/api/users/${selectedUserId.value}/super-admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_super_admin: true })
    })
    
    if (res.ok) {
      selectedUserId.value = ''
      await loadSuperAdmins()
    } else {
      const data = await res.json()
      alert(data.error || 'Error al otorgar permiso')
    }
  } catch (error) {
    alert('Error al otorgar permiso')
  } finally {
    savingId.value = null
  }
}

</script>
