<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>{{ isEdit ? 'Editar' : 'Crear' }} Contacto</strong>
        </CCardHeader>
        <CCardBody>
          <CAlert v-if="saveError" color="danger" class="py-2 small">{{ saveError }}</CAlert>
          <ContactForm
            v-model="form"
            :isEdit="isEdit"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ContactForm from '@/components/contacts/ContactForm.vue'
import { getContactById, createContact, updateContact } from '@/services/contactService'

const route = useRoute()
const router = useRouter()
let form = ref({ fullname: '', whatsapp: '', whatsapp_username: '', instagram: '', facebook: '', contact_channel: null, city: '', state: '', country: '', organizationId: '' })
const isEdit = computed(() => !!route.params.id)
const saveError = ref('')

onMounted(async () => {
  if (isEdit.value) {
    const contact = await getContactById(route.params.id)
    if (contact) form.value = { ...contact }
  }
})

async function handleSubmit(data) {
  const contactData = { ...data }
  delete contactData.users
  
  saveError.value = ''
  try {
    if (isEdit.value) {
      delete contactData.organizationId
      await updateContact(route.params.id, contactData)
    } else {
      await createContact(contactData)
    }
    router.push('/business/contacts')
  } catch (err) {
    saveError.value = err.message
  }
}

function handleCancel() {
  router.push('/business/contacts')
}
</script>
