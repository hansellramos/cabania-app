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
        {{ contact.fullname }} <span class="text-muted">{{ contactLabel(contact) }}</span>
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
        <div class="mb-1">
          <CFormLabel for="newCustomerChannel">¿Cómo le escribimos?</CFormLabel>
          <ContactChannelPicker v-model="newCustomer" input-id="newCustomerChannel" required />
        </div>
        <div class="mt-3">
          <CFormLabel for="newCustomerDocument">Documento de identidad</CFormLabel>
          <DocumentInput
            v-model:type="newCustomer.document_type"
            v-model:number="newCustomer.document_number"
            input-id="newCustomerDocument"
          />
          <div class="form-text">Opcional. Si no lo tienes, se lo pedimos al cliente cuando firme el contrato.</div>
        </div>
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
import { CONTACT_CHANNELS, channelError, channelValue, initialChannel } from '@/utils/contactLinks'
import ContactChannelPicker from '@/components/contacts/ContactChannelPicker.vue'
import DocumentInput from '@/components/contacts/DocumentInput.vue'
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
const emptyCustomer = () => ({ fullname: '', whatsapp: '', whatsapp_username: '', instagram: '', facebook: '', contact_channel: 'whatsapp', document_type: 'CC', document_number: '' })
const newCustomer = ref(emptyCustomer())
const createError = ref('')

// One way to reach the guest is enough: the phone or a username on the chosen channel.
const chosenChannel = computed(() => initialChannel(newCustomer.value))
const chosenValue = computed(() => String(newCustomer.value[CONTACT_CHANNELS[chosenChannel.value].field] || '').trim())
const canCreate = computed(() =>
  !!newCustomer.value.fullname.trim() && !!chosenValue.value && !channelError(chosenChannel.value, chosenValue.value)
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
    (c.instagram && c.instagram.toLowerCase().includes(q.replace(/^@/, ''))) ||
    (c.facebook && c.facebook.toLowerCase().includes(q.replace(/^@/, ''))) ||
    (c.user && c.user.email && c.user.email.toLowerCase().includes(q))
  ).slice(0, 10)
})

/** Phone, username or email shown next to the name in the list. */
function contactLabel(contact) {
  return channelValue(initialChannel(contact), contact) || contact.user?.email || ''
}

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
  // What was typed in the search goes to the name, or to the phone or WhatsApp user when it is one.
  const typed = query.value.trim()
  if (/^\+?[\d\s()-]{7,}$/.test(typed)) newCustomer.value = { ...emptyCustomer(), whatsapp: typed }
  else if (typed.startsWith('@')) newCustomer.value = { ...emptyCustomer(), contact_channel: 'whatsapp_user', whatsapp_username: typed }
  else newCustomer.value = { ...emptyCustomer(), fullname: typed }
  createError.value = ''
  showCreateForm.value = true
  showDropdown.value = false
}

function cancelCreate() {
  showCreateForm.value = false
  newCustomer.value = emptyCustomer()
}

async function createCustomer() {
  try {
    createError.value = ''
    const channel = chosenChannel.value
    const payload = {
      fullname: newCustomer.value.fullname,
      contact_channel: channel,
      [CONTACT_CHANNELS[channel].field]: chosenValue.value
    }
    if (newCustomer.value.document_number.trim()) {
      payload.document_type = newCustomer.value.document_type || 'CC'
      payload.document_number = newCustomer.value.document_number
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
