<template>
  <CCard class="mb-4">
    <CCardHeader class="d-flex justify-content-between align-items-center">
      <strong>Contacts</strong>
      <RouterLink to="/business/contacts/create">
        <CButton color="success" size="sm">+ New Contact</CButton>
      </RouterLink>
    </CCardHeader>
    <CCardBody>
      <div class="mb-3">
        <label class="form-label">Buscar:</label>
        <input
          type="search"
          v-model="search"
          class="form-control form-control-sm"
          placeholder="Nombre, teléfono, documento, correo o Instagram"
          autocomplete="off"
        />
        <div v-if="search.trim()" class="small text-body-secondary mt-1">
          {{ filteredContacts.length }} {{ filteredContacts.length === 1 ? 'contacto' : 'contactos' }}
        </div>
      </div>
      <CTable hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell
              scope="col"
              style="cursor: pointer; user-select: none;"
              @click="toggleSort('fullname')"
            >
              Full Name {{ sortIcon('fullname') }}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col">WhatsApp</CTableHeaderCell>
            <CTableHeaderCell scope="col">Documento</CTableHeaderCell>
            <CTableHeaderCell
              scope="col"
              style="cursor: pointer; user-select: none;"
              @click="toggleSort('country')"
            >
              Country {{ sortIcon('country') }}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col">State</CTableHeaderCell>
            <CTableHeaderCell
              scope="col"
              style="cursor: pointer; user-select: none;"
              @click="toggleSort('city')"
            >
              City {{ sortIcon('city') }}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col">Actions</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody class="ph-no-capture">
          <CTableRow v-for="contact in paginatedContacts" :key="contact.id">
            <CTableDataCell>
              <RouterLink :to="`/business/contacts/${contact.id}/read`" class="text-decoration-none">
                {{ contact.fullname }}
              </RouterLink>
            </CTableDataCell>
            <CTableDataCell>{{ channelValue(initialChannel(contact), contact) }}</CTableDataCell>
            <CTableDataCell class="text-nowrap">
              <template v-if="contact.document_number">{{ contact.document_type }} {{ formatDocumentNumber(contact.document_type, contact.document_number) }}</template>
            </CTableDataCell>
            <CTableDataCell>{{ contact.country }}</CTableDataCell>
            <CTableDataCell>{{ contact.state }}</CTableDataCell>
            <CTableDataCell>{{ contact.city }}</CTableDataCell>
            <CTableDataCell>
              <CButton color="primary" size="sm" @click="onEdit(contact)">Edit</CButton>
              <CButton color="danger" size="sm" class="ms-2" @click="onDelete(contact)">Delete</CButton>
            </CTableDataCell>
          </CTableRow>
          <CTableRow v-if="!paginatedContacts.length">
            <CTableDataCell colspan="8" class="text-center text-muted py-4">
              {{ search.trim() ? 'Ningún contacto coincide con la búsqueda' : 'No hay contactos' }}
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>

      <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
        <div class="small text-muted">
          Mostrando {{ pageStart }}-{{ pageEnd }} de {{ sortedContacts.length }} registros
        </div>
        <CPagination size="sm" class="mb-0">
          <CPaginationItem :disabled="currentPage === 1" @click="currentPage = 1">&laquo;</CPaginationItem>
          <CPaginationItem :disabled="currentPage === 1" @click="currentPage--">&lsaquo;</CPaginationItem>
          <CPaginationItem
            v-for="page in visiblePages"
            :key="page"
            :active="page === currentPage"
            @click="currentPage = page"
          >
            {{ page }}
          </CPaginationItem>
          <CPaginationItem :disabled="currentPage === totalPages" @click="currentPage++">&rsaquo;</CPaginationItem>
          <CPaginationItem :disabled="currentPage === totalPages" @click="currentPage = totalPages">&raquo;</CPaginationItem>
        </CPagination>
      </div>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { fetchContacts, deleteContact } from '@/services/contactService'
import { channelValue, initialChannel } from '@/utils/contactLinks'
import { formatDocumentNumber } from '@/utils/documentTypes'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'

const contacts = ref([])
const search = ref('')
const router = useRouter()
const settingsStore = useSettingsStore()
const { user } = useAuth()

const sortKey = ref('fullname')
const sortOrder = ref('asc')
const perPage = ref(20)
const currentPage = ref(1)

function toggleSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return ''
  return sortOrder.value === 'asc' ? '▲' : '▼'
}

// Matches every word typed, ignoring accents and case, against the name,
// phone, document, email and social handles.
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const filteredContacts = computed(() => {
  const words = normalize(search.value).split(/\s+/).filter(Boolean)
  if (!words.length) return contacts.value
  return contacts.value.filter(c => {
    const text = normalize([c.fullname, c.whatsapp, c.whatsapp_username, c.instagram, c.facebook, c.email, c.document_number, c.city].join(' '))
    const digits = text.replace(/\D/g, '')
    return words.every(word => {
      const wordDigits = word.replace(/[\s.+-]/g, '')
      return text.includes(word.replace(/^@/, '')) || (/^\d+$/.test(wordDigits) && digits.includes(wordDigits))
    })
  })
})

watch(search, () => { currentPage.value = 1 })

const sortedContacts = computed(() => {
  let result = filteredContacts.value

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va = (a[key] || '').toString().toLowerCase()
      let vb = (b[key] || '').toString().toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }

  return result
})

const totalPages = computed(() => Math.ceil(sortedContacts.value.length / perPage.value))

const paginatedContacts = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return sortedContacts.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (sortedContacts.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, sortedContacts.value.length)
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  let start = Math.max(1, current - 2)
  let end = Math.min(total, current + 2)
  if (end - start < 4) {
    if (start === 1) end = Math.min(total, start + 4)
    else start = Math.max(1, end - 4)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

async function loadContacts() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  contacts.value = await fetchContacts({ viewAll })
  currentPage.value = 1
}

watch(() => settingsStore.godModeViewAll, () => loadContacts())

onMounted(loadContacts)

function onEdit(contact) {
  router.push(`/business/contacts/${contact.id}/edit`)
}

async function onDelete(contact) {
  if (confirm(`Are you sure you want to delete "${contact.fullname}"?`)) {
    await deleteContact(contact.id)
    await loadContacts()
  }
}
</script>

<style scoped>
.filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background-color: #e9ecef;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}
.filter-chip-close {
  cursor: pointer;
  margin-left: 0.25rem;
}
</style>
