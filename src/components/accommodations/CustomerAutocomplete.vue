<template>
  <div style="position:relative">
    <CFormInput
      v-model="query"
      @input="onInput"
      @focus="showDropdown = true"
      @blur="hideDropdownWithDelay"
      placeholder="Type customer name or phone"
    />
    <ul v-if="showDropdown && (filteredContacts.length || query)" class="list-group position-absolute w-100 mt-1" style="z-index:10;max-height:220px;overflow-y:auto;">
      <li v-for="contact in filteredContacts" :key="contact.id" class="list-group-item list-group-item-action" style="cursor:pointer;" @mousedown.prevent="selectContact(contact)">
        {{ contact.fullname }} <span class="text-muted">{{ contact.whatsapp || (contact.whatsapp_username && `@${contact.whatsapp_username}`) || contact.user?.email }}</span>
      </li>
      <li v-if="query && !filteredContacts.length && !showCreateForm" class="list-group-item list-group-item-action text-primary" style="cursor:pointer;" @mousedown.prevent="startCreateCustomer">
        + Crear nuevo cliente "{{ query }}"
      </li>
    </ul>
    
    <CModal teleport :visible="showCreateForm" @close="cancelCreate" alignment="center">
      <CModalHeader>
        <CModalTitle>Crear Nuevo Cliente</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div class="mb-3">
          <CFormLabel>Nombre completo</CFormLabel>
          <CFormInput v-model="newCustomer.fullname" placeholder="Nombre del cliente" required />
        </div>
        <div class="mb-3">
          <CFormLabel>Número de WhatsApp</CFormLabel>
          <CFormInput
            v-model="newCustomer.whatsapp"
            placeholder="Ej: 3001234567"
            type="tel"
            :invalid="!!whatsappError"
            :feedback-invalid="whatsappError"
            @input="cleanWhatsapp"
            @paste="onPasteWhatsapp"
          />
        </div>
        <div class="mb-1">
          <CFormLabel>Usuario de WhatsApp</CFormLabel>
          <CFormInput
            v-model="newCustomer.whatsapp_username"
            placeholder="@usuario"
            autocapitalize="off"
            :invalid="!!usernameError"
            :feedback-invalid="usernameError"
          />
        </div>
        <div class="form-text">Escribe el número o, si el cliente no lo dio, su usuario de WhatsApp.</div>
        <CAlert v-if="createError" color="danger" class="py-2 small mt-3 mb-0">{{ createError }}</CAlert>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" @click="cancelCreate">Cancelar</CButton>
        <CButton color="primary" @click="createCustomer" :disabled="!canCreate">Crear</CButton>
      </CModalFooter>
    </CModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CButton, CFormInput, CFormLabel, CAlert } from '@coreui/vue'
import { cleanWhatsappNumber, cleanWhatsappUsername, whatsappNumberError, whatsappUsernameError, looksLikeWhatsappUsername } from '@/utils/contactLinks'
import { fetchContacts, createContact } from '@/services/contactService'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'

const props = defineProps({
  modelValue: String,
  organizationId: String,
})
const emit = defineEmits(['update:modelValue'])

const query = ref('')
const showDropdown = ref(false)
const contacts = ref([])
const showCreateForm = ref(false)
const emptyCustomer = () => ({ fullname: '', whatsapp: '', whatsapp_username: '' })
const newCustomer = ref(emptyCustomer())
const createError = ref('')

// Number or username: at least one, and each one valid on its own when filled in.
const whatsappError = computed(() => whatsappNumberError(newCustomer.value.whatsapp))
const usernameError = computed(() => whatsappUsernameError(newCustomer.value.whatsapp_username))
const canCreate = computed(() =>
  !!newCustomer.value.fullname.trim()
  && !whatsappError.value && !usernameError.value
  && !!(cleanWhatsappNumber(newCustomer.value.whatsapp) || cleanWhatsappUsername(newCustomer.value.whatsapp_username))
)
const settingsStore = useSettingsStore()
const { user } = useAuth()

const filteredContacts = computed(() => {
  if (!query.value) return contacts.value.slice(0, 10)
  const q = query.value.toLowerCase()
  return contacts.value.filter(c =>
    (c.fullname && c.fullname.toLowerCase().includes(q)) ||
    (c.whatsapp && String(c.whatsapp).includes(q)) ||
    (c.whatsapp_username && c.whatsapp_username.includes(q.replace(/^@/, ''))) ||
    (c.user && c.user.email && c.user.email.toLowerCase().includes(q))
  ).slice(0, 10)
})

function onInput() {
  showDropdown.value = true
}

function selectContact(contact) {
  query.value = contact.fullname
  showDropdown.value = false
  emit('update:modelValue', contact.id)
}

function hideDropdownWithDelay() {
  setTimeout(() => { showDropdown.value = false }, 150)
}

function startCreateCustomer() {
  newCustomer.value = { ...emptyCustomer(), fullname: query.value }
  createError.value = ''
  showCreateForm.value = true
  showDropdown.value = false
}

function cancelCreate() {
  showCreateForm.value = false
  newCustomer.value = emptyCustomer()
}

/** A username typed or pasted in the number field goes to its own field. */
function moveToUsername(text) {
  if (!looksLikeWhatsappUsername(text)) return false
  if (!newCustomer.value.whatsapp_username) newCustomer.value.whatsapp_username = text.trim()
  newCustomer.value.whatsapp = ''
  return true
}

function cleanWhatsapp() {
  if (moveToUsername(newCustomer.value.whatsapp)) return
  let val = newCustomer.value.whatsapp
  val = val.replace(/\s+/g, '')
  val = val.replace(/^\+57/, '')
  val = val.replace(/[^\d]/g, '')
  newCustomer.value.whatsapp = val
}

function onPasteWhatsapp(event) {
  event.preventDefault()
  let pasted = (event.clipboardData || window.clipboardData).getData('text')
  if (moveToUsername(pasted)) return
  pasted = pasted.replace(/[^\d+]/g, '')
  pasted = pasted.replace(/^\+57/, '')
  newCustomer.value.whatsapp = pasted
}

async function createCustomer() {
  try {
    createError.value = ''
    const payload = {
      fullname: newCustomer.value.fullname,
      whatsapp: cleanWhatsappNumber(newCustomer.value.whatsapp),
      whatsapp_username: cleanWhatsappUsername(newCustomer.value.whatsapp_username)
    }
    if (props.organizationId) {
      payload.organizationId = props.organizationId
    }
    const created = await createContact(payload)
    if (created && created.id) {
      contacts.value.push(created)
      query.value = created.fullname
      emit('update:modelValue', created.id)
    }
    showCreateForm.value = false
    newCustomer.value = emptyCustomer()
  } catch (error) {
    console.error('Error creating customer:', error)
    createError.value = error.message || 'No se pudo crear el cliente.'
  }
}

async function loadContacts() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  contacts.value = await fetchContacts({ viewAll })
}

onMounted(async () => {
  await loadContacts()
  if (props.modelValue) {
    const c = contacts.value.find(c => c.id === props.modelValue)
    if (c) query.value = c.fullname
  }
})

watch(() => settingsStore.godModeViewAll, () => {
  loadContacts()
})

watch(() => props.modelValue, val => {
  const c = contacts.value.find(c => c.id === val)
  if (c) query.value = c.fullname
})
</script>
