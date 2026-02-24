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
        <label class="form-label">Filter by Name:</label>
        <input type="text" v-model="nameInput" @input="onNameInput" class="form-control form-control-sm" placeholder="Search full name" />
        <ul v-if="filteredNames.length" class="list-group position-absolute z-3">
          <li v-for="name in filteredNames" :key="name" class="list-group-item list-group-item-action" @click="selectName(name)">{{ name }}</li>
        </ul>
        <div v-if="selectedNames.length" class="d-flex align-items-center flex-wrap mt-2">
          <div v-for="name in selectedNames" :key="name" class="filter-chip me-2 mb-2">
            {{ name }} <span class="filter-chip-close" @click="removeName(name)">&times;</span>
          </div>
          <CButton size="sm" color="secondary" class="ms-2" @click="clearAllNames">Clear All</CButton>
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
        <CTableBody>
          <CTableRow v-for="contact in paginatedContacts" :key="contact.id">
            <CTableDataCell>
              <RouterLink :to="`/business/contacts/${contact.id}/read`" class="text-decoration-none">
                {{ contact.fullname }}
              </RouterLink>
            </CTableDataCell>
            <CTableDataCell>{{ contact.whatsapp }}</CTableDataCell>
            <CTableDataCell>{{ contact.country }}</CTableDataCell>
            <CTableDataCell>{{ contact.state }}</CTableDataCell>
            <CTableDataCell>{{ contact.city }}</CTableDataCell>
            <CTableDataCell>
              <CButton color="primary" size="sm" @click="onEdit(contact)">Edit</CButton>
              <CButton color="danger" size="sm" class="ms-2" @click="onDelete(contact)">Delete</CButton>
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
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'

const contacts = ref([])
const allContacts = ref([])
const nameInput = ref('')
const filteredNames = ref([])
const selectedNames = ref([])
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

const sortedContacts = computed(() => {
  let result = contacts.value

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

async function loadContacts(names = []) {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  contacts.value = await fetchContacts({ viewAll })
  currentPage.value = 1
}

async function loadAllContacts() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  allContacts.value = await fetchContacts({ viewAll })
}

watch(() => settingsStore.godModeViewAll, () => {
  loadContacts(selectedNames.value)
  loadAllContacts()
})

function onNameInput() {
  if (!nameInput.value) { filteredNames.value = []; return }
  const search = nameInput.value.toLowerCase()
  filteredNames.value = allContacts.value
    .map(c => c.fullname)
    .filter(n => n.toLowerCase().includes(search) && !selectedNames.value.includes(n))
}

function selectName(name) {
  selectedNames.value.push(name)
  nameInput.value = ''
  filteredNames.value = []
  loadContacts(selectedNames.value)
}

function removeName(name) {
  selectedNames.value = selectedNames.value.filter(n => n !== name)
  loadContacts(selectedNames.value)
}

function clearAllNames() {
  selectedNames.value = []
  loadContacts()
}

onMounted(async () => {
  await loadAllContacts()
  await loadContacts()
})

function onEdit(contact) {
  router.push(`/business/contacts/${contact.id}/edit`)
}

async function onDelete(contact) {
  if (confirm(`Are you sure you want to delete "${contact.fullname}"?`)) {
    await deleteContact(contact.id)
    await loadContacts(selectedNames.value)
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
