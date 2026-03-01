<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Invitaciones</strong>
          <CButton color="primary" size="sm" @click="openModal">
            <CIcon :icon="cilPlus" class="me-1" /> Invitar usuario
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3">
            <CCol :xs="6" :md="3">
              <CFormSelect v-model="statusFilter" size="sm" @change="loadInvitations">
                <option value="">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="accepted">Aceptadas</option>
                <option value="expired">Expiradas</option>
                <option value="cancelled">Canceladas</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <CSpinner v-if="loading" />

          <div v-else-if="invitations.length === 0" class="text-center text-body-secondary py-4">
            No hay invitaciones registradas
          </div>

          <CTable v-else hover responsive small>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Destinatario</CTableHeaderCell>
                <CTableHeaderCell>Canal</CTableHeaderCell>
                <CTableHeaderCell>Organización</CTableHeaderCell>
                <CTableHeaderCell>Invitado por</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Fecha</CTableHeaderCell>
                <CTableHeaderCell>Expira</CTableHeaderCell>
                <CTableHeaderCell class="text-end">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="inv in invitations" :key="inv.id">
                <CTableDataCell>
                  {{ inv.email || inv.phone }}
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="inv.channel === 'email' ? 'info' : 'success'">
                    <CIcon :icon="inv.channel === 'email' ? cilEnvelopeClosed : cilPhone" class="me-1" size="sm" />
                    {{ inv.channel === 'email' ? 'Email' : 'WhatsApp' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ inv.organization?.name || '-' }}</CTableDataCell>
                <CTableDataCell>{{ inv.inviter?.display_name || inv.inviter?.email || '-' }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="statusColor(inv.status)">
                    {{ statusLabel(inv.status) }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ formatDate(inv.created_at) }}</CTableDataCell>
                <CTableDataCell>{{ formatDate(inv.expires_at) }}</CTableDataCell>
                <CTableDataCell class="text-end">
                  <template v-if="inv.status === 'pending'">
                    <CButton
                      color="primary"
                      size="sm"
                      variant="ghost"
                      title="Reenviar"
                      :disabled="resending === inv.id"
                      @click="resendInvitation(inv)"
                    >
                      <CSpinner v-if="resending === inv.id" size="sm" />
                      <CIcon v-else :icon="cilReload" />
                    </CButton>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      title="Cancelar"
                      @click="cancelInvitation(inv)"
                    >
                      <CIcon :icon="cilX" />
                    </CButton>
                  </template>
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Invite Modal -->
  <CModal :visible="showModal" @close="closeModal" size="lg">
    <CModalHeader>
      <CModalTitle>Invitar usuario</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="sendInvitation">
        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Canal de envío *</CFormLabel>
            <CFormSelect v-model="form.channel" required>
              <option value="email">Correo electrónico</option>
              <option value="whatsapp">WhatsApp</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Organización</CFormLabel>
            <CFormSelect v-model="form.organization_id">
              <option value="">Sin organización</option>
              <option v-for="org in organizations" :key="org.id" :value="org.id">
                {{ org.name }}
              </option>
            </CFormSelect>
          </CCol>
        </CRow>

        <CRow class="mb-3">
          <CCol :md="6" v-if="form.channel === 'email'">
            <CFormLabel>Correo electrónico *</CFormLabel>
            <CFormInput
              v-model="form.email"
              type="email"
              placeholder="propietario@ejemplo.com"
              required
            />
          </CCol>
          <CCol :md="6" v-if="form.channel === 'whatsapp'">
            <CFormLabel>Teléfono (WhatsApp) *</CFormLabel>
            <CFormInput
              v-model="form.phone"
              type="tel"
              placeholder="+573001234567"
              required
            />
          </CCol>
          <CCol :md="6">
            <CFormLabel>Perfil</CFormLabel>
            <CFormSelect v-model="form.profile_code">
              <option value="organization:admin">Administrador</option>
              <option value="organization:view">Solo lectura</option>
              <option value="organization:partner">Aliado (acceso limitado)</option>
            </CFormSelect>
          </CCol>
        </CRow>

        <div class="mb-3">
          <CFormLabel>Mensaje personalizado (opcional)</CFormLabel>
          <CFormTextarea
            v-model="form.message"
            rows="3"
            placeholder="Ej: Te invito a gestionar tu cabaña desde CabanIA..."
          />
        </div>

        <CAlert v-if="formError" color="danger" class="mb-3">
          {{ formError }}
        </CAlert>

        <div class="d-flex justify-content-end gap-2">
          <CButton color="secondary" variant="ghost" @click="closeModal">
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" :disabled="sending">
            <CSpinner v-if="sending" size="sm" class="me-1" />
            Enviar invitación
          </CButton>
        </div>
      </CForm>
    </CModalBody>
  </CModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { cilPlus, cilEnvelopeClosed, cilPhone, cilReload, cilX } from '@coreui/icons'

const invitations = ref([])
const organizations = ref([])
const loading = ref(false)
const statusFilter = ref('')
const showModal = ref(false)
const sending = ref(false)
const resending = ref(null)
const formError = ref('')

const form = ref({
  channel: 'email',
  email: '',
  phone: '',
  organization_id: '',
  role: 'user',
  profile_code: 'organization:admin',
  message: '',
})

function statusColor(status) {
  const colors = { pending: 'warning', accepted: 'success', expired: 'secondary', cancelled: 'danger' }
  return colors[status] || 'secondary'
}

function statusLabel(status) {
  const labels = { pending: 'Pendiente', accepted: 'Aceptada', expired: 'Expirada', cancelled: 'Cancelada' }
  return labels[status] || status
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

async function loadInvitations() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.append('status', statusFilter.value)
    const response = await fetch(`/api/invitations?${params}`, { credentials: 'include' })
    if (response.ok) invitations.value = await response.json()
  } catch (error) {
    console.error('Error loading invitations:', error)
  } finally {
    loading.value = false
  }
}

async function loadOrganizations() {
  try {
    const response = await fetch('/api/organizations', { credentials: 'include' })
    if (response.ok) organizations.value = await response.json()
  } catch (error) {
    console.error('Error loading organizations:', error)
  }
}

function openModal() {
  form.value = { channel: 'email', email: '', phone: '', organization_id: '', role: 'user', profile_code: 'organization:admin', message: '' }
  formError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function sendInvitation() {
  sending.value = true
  formError.value = ''
  try {
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value),
    })
    const data = await response.json()
    if (!response.ok) {
      formError.value = data.error || 'Error al enviar invitación'
      return
    }
    closeModal()
    await loadInvitations()
  } catch (error) {
    formError.value = error.message
  } finally {
    sending.value = false
  }
}

async function resendInvitation(inv) {
  resending.value = inv.id
  try {
    await fetch(`/api/invitations/${inv.id}/resend`, {
      method: 'POST',
      credentials: 'include',
    })
    await loadInvitations()
  } catch (error) {
    console.error('Error resending:', error)
  } finally {
    resending.value = null
  }
}

async function cancelInvitation(inv) {
  if (!confirm('¿Cancelar esta invitación?')) return
  try {
    await fetch(`/api/invitations/${inv.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await loadInvitations()
  } catch (error) {
    console.error('Error cancelling:', error)
  }
}

onMounted(() => {
  loadInvitations()
  loadOrganizations()
})
</script>
