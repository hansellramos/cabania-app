<template>
  <CForm @submit.prevent="handleSubmit">
    <div class="mb-3">
      <CFormLabel for="userEmail">Email</CFormLabel>
      <CFormInput
        id="userEmail"
        v-model="form.email"
        type="email"
        placeholder="Ingresa el email"
        required
      />
    </div>
    <div class="mb-3">
      <CFormLabel for="userDisplayName">Nombre</CFormLabel>
      <CFormInput
        id="userDisplayName"
        v-model="form.display_name"
        type="text"
        placeholder="Ingresa el nombre"
      />
    </div>
    <div class="mb-3">
      <CFormLabel for="userAvatarUrl">URL del Avatar</CFormLabel>
      <CFormInput
        id="userAvatarUrl"
        v-model="form.avatar_url"
        type="url"
        placeholder="https://ejemplo.com/avatar.jpg"
      />
    </div>
    <div class="mb-3">
      <CFormLabel for="userRole">Rol</CFormLabel>
      <CFormSelect id="userRole" v-model="form.role">
        <option value="user">Usuario</option>
        <option value="manager">Manager</option>
        <option value="admin">Administrador</option>
      </CFormSelect>
    </div>
    <div class="mb-3">
      <CFormLabel for="userProfile">Perfil de Permisos</CFormLabel>
      <CFormSelect id="userProfile" v-model="form.profile_id">
        <option value="">-- Seleccionar perfil --</option>
        <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
          {{ profile.name }}
        </option>
      </CFormSelect>
      <div class="form-text">El perfil determina qué acciones puede realizar el usuario</div>
    </div>
    <div class="mb-3">
      <CFormLabel>Organizaciones Asignadas</CFormLabel>
      <div class="border rounded p-3" style="max-height: 200px; overflow-y: auto;">
        <div v-for="org in organizations" :key="org.id" class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            :id="'org-' + org.id"
            :value="org.id"
            v-model="form.organization_ids"
          />
          <label class="form-check-label" :for="'org-' + org.id">
            {{ org.name }}
          </label>
        </div>
        <div v-if="organizations.length === 0" class="text-muted">
          No hay organizaciones disponibles
        </div>
      </div>
      <div class="form-text">El usuario solo podrá ver datos de las organizaciones seleccionadas</div>
    </div>

    <!-- Linked Contact (only in edit mode) -->
    <div v-if="isEdit" class="mb-3">
      <CFormLabel>Contacto Vinculado</CFormLabel>
      <div v-if="form.linked_contact" class="border rounded p-3 bg-body-tertiary">
        <div class="d-flex align-items-center justify-content-between">
          <div>
            <strong>{{ form.linked_contact.fullname || 'Sin nombre' }}</strong>
            <br />
            <small class="text-muted">
              WhatsApp: {{ form.linked_contact.whatsapp || 'No registrado' }}
            </small>
          </div>
          <CButton color="danger" size="sm" variant="outline" @click="unlinkContact">
            Desvincular
          </CButton>
        </div>
      </div>
      <div v-else>
        <div class="input-group">
          <CFormInput
            v-model="contactSearch"
            placeholder="Buscar contacto por nombre o WhatsApp..."
            @input="searchContacts"
          />
        </div>
        <div v-if="contactResults.length > 0" class="list-group mt-1" style="max-height: 200px; overflow-y: auto;">
          <button
            v-for="c in contactResults"
            :key="c.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            @click="linkContact(c)"
          >
            <div>
              <strong>{{ c.fullname || 'Sin nombre' }}</strong>
              <small class="text-muted ms-2">{{ c.whatsapp || '' }}</small>
            </div>
            <CBadge color="primary">Vincular</CBadge>
          </button>
        </div>
        <div v-else-if="contactSearch && !searchingContacts" class="text-muted small mt-1">
          No se encontraron contactos disponibles
        </div>
      </div>
    </div>

    <div class="d-flex gap-2 flex-wrap">
      <CButton type="submit" color="primary">{{ isEdit ? 'Actualizar' : 'Crear' }}</CButton>
      <CButton color="secondary" variant="outline" @click="onCancel">Cancelar</CButton>
      <CButton v-if="isEdit" color="warning" variant="outline" @click="openTempKeyModal">
        Resetear Clave
      </CButton>
    </div>

    <!-- Modal: Resetear clave temporal -->
    <CModal :visible="showTempKeyModal" @close="closeTempKeyModal" alignment="center" size="lg">
      <CModalHeader>
        <CModalTitle>Resetear Clave</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <!-- Step 1: Generate key -->
        <div v-if="!tempKeyData">
          <p class="text-muted mb-3">
            Se generará una clave temporal para <strong>{{ form.display_name || form.email }}</strong>.
            <template v-if="form.linked_contact?.whatsapp">
              Podrás enviarla por WhatsApp al contacto
              <strong>{{ form.linked_contact.fullname }}</strong>
              ({{ form.linked_contact.whatsapp }}).
            </template>
          </p>
          <div class="d-grid">
            <CButton color="primary" :disabled="generatingKey" @click="generateTempKey">
              <CSpinner v-if="generatingKey" size="sm" class="me-2" />
              {{ generatingKey ? 'Generando...' : 'Generar clave temporal' }}
            </CButton>
          </div>
        </div>

        <!-- Step 2: Preview & Send -->
        <div v-else>
          <div class="mb-3">
            <CFormLabel>Clave generada</CFormLabel>
            <div class="d-flex align-items-center gap-2">
              <code class="fs-5 px-3 py-2 bg-body-tertiary border rounded">{{ tempKeyData.tempKey }}</code>
              <small class="text-muted">Ya fue guardada como password del usuario</small>
            </div>
          </div>

          <div class="mb-3">
            <CFormLabel>Mensaje a enviar</CFormLabel>
            <CFormTextarea
              v-model="tempKeyMessage"
              rows="8"
              style="white-space: pre-wrap;"
            />
          </div>

          <div v-if="!form.linked_contact?.whatsapp" class="mb-3">
            <CAlert color="info" class="mb-0 py-2">
              Este usuario no tiene contacto con WhatsApp vinculado. Copia el mensaje y envíalo manualmente.
            </CAlert>
          </div>

          <div v-if="tempKeyResult" class="mb-3">
            <CAlert :color="tempKeyResult.success ? 'success' : 'danger'" class="mb-0 py-2">
              {{ tempKeyResult.message }}
            </CAlert>
          </div>
        </div>
      </CModalBody>
      <CModalFooter v-if="tempKeyData">
        <CButton color="secondary" variant="outline" @click="closeTempKeyModal">Cerrar</CButton>
        <CButton
          v-if="form.linked_contact?.whatsapp"
          color="success"
          @click="openWhatsApp(tempKeyMessage)"
        >
          <CIcon icon="cib-whatsapp" class="me-1" />
          Enviar por WhatsApp
        </CButton>
      </CModalFooter>
    </CModal>
  </CForm>
</template>

<script setup>
import { ref, watch, onMounted, defineProps, defineEmits } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'

const settingsStore = useSettingsStore()
const { user } = useAuth()

const props = defineProps({
  modelValue: { type: Object, required: true },
  isEdit: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const form = ref({ ...props.modelValue, profile_id: '', organization_ids: [] })
const profiles = ref([])
const organizations = ref([])

// Contact linking
const contactSearch = ref('')
const contactResults = ref([])
const searchingContacts = ref(false)
let searchTimeout = null

async function searchContacts() {
  clearTimeout(searchTimeout)
  const query = contactSearch.value.trim()
  if (query.length < 2) {
    contactResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    searchingContacts.value = true
    try {
      const res = await fetch(`/api/contacts?viewAll=true`, { credentials: 'include' })
      if (res.ok) {
        const all = await res.json()
        const q = query.toLowerCase()
        contactResults.value = all.filter(c =>
          !c.user &&
          ((c.fullname && c.fullname.toLowerCase().includes(q)) ||
           (c.whatsapp && String(c.whatsapp).includes(q)))
        ).slice(0, 10)
      }
    } catch (e) {
      console.error('Error searching contacts:', e)
    } finally {
      searchingContacts.value = false
    }
  }, 300)
}

async function linkContact(contact) {
  try {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user: form.value.id })
    })
    if (res.ok) {
      form.value.linked_contact = contact
      contactSearch.value = ''
      contactResults.value = []
    }
  } catch (e) {
    console.error('Error linking contact:', e)
  }
}

async function unlinkContact() {
  if (!form.value.linked_contact) return
  try {
    const res = await fetch(`/api/contacts/${form.value.linked_contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user: null })
    })
    if (res.ok) {
      form.value.linked_contact = null
    }
  } catch (e) {
    console.error('Error unlinking contact:', e)
  }
}

// Temp key modal state
const showTempKeyModal = ref(false)
const generatingKey = ref(false)
const tempKeyData = ref(null)
const tempKeyMessage = ref('')
const tempKeyResult = ref(null)

watch(() => props.modelValue, val => {
  if (val) {
    form.value = {
      ...val,
      profile_id: val.profile_id || '',
      organization_ids: val.organization_ids || []
    }
  }
}, { deep: true, immediate: true })

async function loadProfiles() {
  try {
    const res = await fetch('/api/profiles')
    if (res.ok) {
      profiles.value = await res.json()
    }
  } catch (error) {
    console.error('Error loading profiles:', error)
  }
}

async function loadOrganizations() {
  try {
    const viewAll = user.value?.is_super_admin && settingsStore.godModeViewAll
    const url = viewAll ? '/api/organizations?viewAll=true' : '/api/organizations'
    const res = await fetch(url, { credentials: 'include' })
    if (res.ok) {
      organizations.value = await res.json()
    }
  } catch (error) {
    console.error('Error loading organizations:', error)
  }
}

function handleSubmit() {
  emit('submit', { ...form.value })
}

function onCancel() {
  emit('cancel')
}

function openTempKeyModal() {
  tempKeyData.value = null
  tempKeyMessage.value = ''
  tempKeyResult.value = null
  showTempKeyModal.value = true
}

function closeTempKeyModal() {
  showTempKeyModal.value = false
}

async function generateTempKey() {
  generatingKey.value = true
  tempKeyResult.value = null
  try {
    const res = await fetch(`/api/users/${form.value.id}/generate-temp-key`, {
      method: 'POST',
      credentials: 'include'
    })
    const data = await res.json()
    if (!res.ok) {
      tempKeyResult.value = { success: false, message: data.error || 'Error al generar clave' }
      return
    }
    tempKeyData.value = data
    const contactName = form.linked_contact?.fullname || form.value.display_name || ''
    tempKeyMessage.value = `*Cabania - Clave de acceso*\n\nHola ${contactName},\n\nTu cuenta *${form.value.email}* ya está lista.\n\nTu clave temporal es: *${data.tempKey}*\n\nIngresa aquí: https://app.cabania.info/#/pages/login\n\nPor favor cambia tu clave lo antes posible.\n\nSi tienes alguna duda, contacta a tu administrador.`
  } catch (error) {
    tempKeyResult.value = { success: false, message: error.message }
  } finally {
    generatingKey.value = false
  }
}

function openWhatsApp(text) {
  const phone = `57${form.value.linked_contact.whatsapp}`
  const encodedText = encodeURIComponent(text)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
  window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank')
}

onMounted(() => {
  loadProfiles()
  loadOrganizations()
})
</script>
