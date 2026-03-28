<template>
  <CForm @submit.prevent="handleSubmit">
    <div class="mb-4">
      <CFormLabel for="contactOrganization">Organización *</CFormLabel>
      <CFormSelect 
        id="contactOrganization" 
        v-model="form.organizationId" 
        required
        :disabled="isEdit"
      >
        <option value="">Selecciona una organización</option>
        <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
      </CFormSelect>
      <div v-if="!form.organizationId && !isEdit" class="form-text text-warning">
        Debes seleccionar una organización para continuar
      </div>
    </div>
    
    <fieldset :disabled="!form.organizationId && !isEdit">
      <div class="mb-3">
        <CFormLabel for="contactFullname">Nombre Completo *</CFormLabel>
        <CFormInput id="contactFullname" v-model="form.fullname" type="text" placeholder="Ingresa el nombre completo" required />
      </div>
      <div class="mb-3">
        <CFormLabel for="contactWhatsapp">WhatsApp</CFormLabel>
        <CFormInput id="contactWhatsapp" v-model="form.whatsapp" type="text" placeholder="Ingresa el número de WhatsApp" />
      </div>
      <div class="mb-3">
        <CFormLabel for="contactCountry">País</CFormLabel>
        <CFormSelect id="contactCountry" v-model="form.country">
          <option value="">Selecciona un país</option>
          <option v-for="country in countries" :key="country.iso" :value="country.iso">{{ country.name }}</option>
        </CFormSelect>
      </div>
      <div class="mb-3">
        <CFormLabel for="contactState">Departamento</CFormLabel>
        <CFormSelect id="contactState" v-model="form.state" :disabled="!form.country">
          <option value="">Selecciona un departamento</option>
          <option v-if="form.country && states.length === 0" disabled>No hay departamentos</option>
          <option v-for="state in states" :key="state.iso" :value="state.name">{{ state.name }}</option>
        </CFormSelect>
      </div>
      <div class="mb-3">
        <CFormLabel for="contactCity">Ciudad</CFormLabel>
        <CFormInput id="contactCity" v-model="form.city" type="text" placeholder="Ingresa la ciudad" />
      </div>
      <div v-if="isEdit" class="mb-3">
        <CFormLabel>Usuario Vinculado</CFormLabel>
        <div v-if="linkedUser" class="border rounded p-3 bg-body-tertiary d-flex align-items-center justify-content-between">
          <div>
            <strong>{{ linkedUser.display_name || linkedUser.email }}</strong>
            <small class="text-muted ms-2">{{ linkedUser.email }}</small>
          </div>
          <CButton color="danger" size="sm" variant="outline" @click="unlinkUser">
            Desvincular
          </CButton>
        </div>
        <div v-else>
          <div class="input-group">
            <CFormInput
              v-model="userSearch"
              placeholder="Buscar usuario por nombre o email..."
              @input="searchUsers"
            />
          </div>
          <div v-if="userResults.length > 0" class="list-group mt-1" style="max-height: 200px; overflow-y: auto;">
            <button
              v-for="u in userResults"
              :key="u.id"
              type="button"
              class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
              @click="linkUser(u)"
            >
              <div>
                <strong>{{ u.display_name || 'Sin nombre' }}</strong>
                <small class="text-muted ms-2">{{ u.email }}</small>
              </div>
              <CBadge color="primary">Vincular</CBadge>
            </button>
          </div>
          <div v-else-if="userSearch && !searchingUsers" class="text-muted small mt-1">
            No se encontraron usuarios disponibles
          </div>
        </div>
      </div>

      <CButton type="submit" color="primary" class="me-2" :disabled="!form.organizationId && !isEdit">{{ isEdit ? 'Actualizar' : 'Crear' }}</CButton>
      <CButton color="secondary" variant="outline" @click="onCancel">Cancelar</CButton>
    </fieldset>
  </CForm>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'
import { fetchCountries, fetchStatesByCountry } from '@/services/contactService'
import { fetchOrganizations } from '@/services/organizationService'

const props = defineProps({
  modelValue: { type: Object, required: true },
  isEdit: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

const form = ref({ ...props.modelValue })
watch(() => props.modelValue, val => {
  if (val) form.value = { ...val }
}, { deep: true, immediate: true })

const organizations = ref([])
const countries = ref([])
const states = ref([])

// User linking
const linkedUser = ref(null)
const userSearch = ref('')
const userResults = ref([])
const searchingUsers = ref(false)
let userSearchTimeout = null

async function loadLinkedUser() {
  if (!form.value.user) return
  try {
    const res = await fetch(`/api/users/${form.value.user}`, { credentials: 'include' })
    if (res.ok) linkedUser.value = await res.json()
  } catch (e) {
    console.error('Error loading linked user:', e)
  }
}

async function searchUsers() {
  clearTimeout(userSearchTimeout)
  const query = userSearch.value.trim()
  if (query.length < 2) {
    userResults.value = []
    return
  }
  userSearchTimeout = setTimeout(async () => {
    searchingUsers.value = true
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (res.ok) {
        const all = await res.json()
        const q = query.toLowerCase()
        userResults.value = all.filter(u =>
          (u.display_name && u.display_name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
        ).slice(0, 10)
      }
    } catch (e) {
      console.error('Error searching users:', e)
    } finally {
      searchingUsers.value = false
    }
  }, 300)
}

async function linkUser(user) {
  try {
    const res = await fetch(`/api/contacts/${form.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user: user.id })
    })
    if (res.ok) {
      linkedUser.value = user
      form.value.user = user.id
      userSearch.value = ''
      userResults.value = []
    }
  } catch (e) {
    console.error('Error linking user:', e)
  }
}

async function unlinkUser() {
  try {
    const res = await fetch(`/api/contacts/${form.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user: null })
    })
    if (res.ok) {
      linkedUser.value = null
      form.value.user = null
    }
  } catch (e) {
    console.error('Error unlinking user:', e)
  }
}

onMounted(async () => {
  organizations.value = await fetchOrganizations()
  countries.value = await fetchCountries()
  if (form.value.country) {
    states.value = await fetchStatesByCountry(form.value.country)
  }
  if (props.isEdit && form.value.user) {
    await loadLinkedUser()
  }
})

watch(() => form.value.country, async (newCountry) => {
  form.value.state = ''
  try {
    const iso = newCountry?.trim().toUpperCase()
    states.value = iso ? await fetchStatesByCountry(iso) : []
  } catch (e) {
    console.error('Error loading states:', e)
    states.value = []
  }
})

function handleSubmit() { emit('submit', { ...form.value }) }
function onCancel() { emit('cancel') }
</script>
