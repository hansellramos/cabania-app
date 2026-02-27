<template>
  <div>
    <div class="mb-3">
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <label for="dateFilter" class="form-label">Filtrar por Fecha:</label>
          <input id="dateFilter" type="date" v-model="dateInput" class="form-control form-control-sm" @change="addDate" />
          <div v-if="selectedDates.length" class="d-flex align-items-center flex-wrap mt-2">
            <div v-for="date in selectedDates" :key="date" class="filter-chip me-2 mb-2">
              {{ date }}
              <span class="filter-chip-close" @click="removeDate(date)">&times;</span>
            </div>
          </div>
          <CButton v-if="selectedDates.length" size="sm" color="secondary" class="mt-2" @click="clearAllDates">Limpiar</CButton>
        </div>
        <div class="col-12 col-md-6">
          <label for="searchFilter" class="form-label">Buscar (cliente:, organización:, cabaña:):</label>
          <input id="searchFilter" type="text" v-model="searchQuery" class="form-control form-control-sm" placeholder="ej: cliente:juan, cabaña:casa" />
        </div>
      </div>
    </div>
    <CButton color="primary" class="mb-3" @click="$router.push('/business/accommodations/create')">Nuevo Hospedaje</CButton>
    <CTable responsive hover>
      <thead>
        <tr>
          <th style="cursor: pointer; user-select: none;" @click="toggleSort('venue')">
            Cabaña {{ sortIcon('venue') }}
          </th>
          <th class="d-mobile-none">Organización</th>
          <th style="cursor: pointer; user-select: none;" @click="toggleSort('date')">
            Fecha {{ sortIcon('date') }}
          </th>
          <th class="d-mobile-none">Duración</th>
          <th class="d-mobile-none">Check In</th>
          <th class="d-mobile-none">Check Out</th>
          <th style="cursor: pointer; user-select: none;" @click="toggleSort('customer')">
            Cliente {{ sortIcon('customer') }}
          </th>
          <th class="d-mobile-none" style="cursor: pointer; user-select: none;" @click="toggleSort('price')">
            Valor {{ sortIcon('price') }}
          </th>
          <th class="d-mobile-none">Abonado</th>
          <th style="cursor: pointer; user-select: none;" @click="toggleSort('balance')">
            Saldo {{ sortIcon('balance') }}
          </th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in paginatedAccommodations" :key="item.id">
          <td>
            <router-link v-if="item.venue_data?.id" :to="`/business/venues/${item.venue_data.id}/read`" class="text-decoration-none">
              {{ item.venue_data.name }}
            </router-link>
            <span v-else>—</span>
          </td>
          <td class="d-mobile-none">
            <router-link v-if="item.venue_data?.organization_data?.id" :to="`/business/organizations/${item.venue_data.organization_data.id}/read`" class="text-decoration-none">
              {{ item.venue_data.organization_data.name }}
            </router-link>
            <span v-else>—</span>
          </td>
          <td>{{ formatDate(item.date) }}</td>
          <td class="d-mobile-none">{{ formatDuration(item.duration) }}</td>
          <td class="d-mobile-none">{{ formatTime(item.time) }}</td>
          <td class="d-mobile-none">{{ calcCheckout(item.time, item.duration, item.date) }}</td>
          <td>
            <router-link v-if="item.customer_data?.id" :to="`/business/contacts/${item.customer_data.id}/read`" class="text-decoration-none">
              {{ item.customer_data.fullname || item.customer_data.user_data?.email }}
            </router-link>
            <span v-else>—</span>
          </td>
          <td class="d-mobile-none">
            <template v-if="getAgreedPrice(item) > 0">
              <span class="fw-bold">${{ formatCurrency(getAgreedPrice(item)) }}</span>
              <template v-if="pricesDiffer(item)">
                <br>
                <small v-if="hasDiscount(item)" class="text-success">
                  <s class="text-muted">${{ formatCurrency(item.calculated_price) }}</s>
                  (-{{ getDiscountPercent(item) }}%)
                </small>
              </template>
            </template>
            <span v-else>—</span>
          </td>
          <td class="d-mobile-none">
            <span v-if="item.total_paid > 0" class="text-success fw-bold">${{ formatCurrency(item.total_paid) }}</span>
            <span v-else class="text-muted">$0</span>
          </td>
          <td>
            <template v-if="getAgreedPrice(item) > 0">
              <span v-if="item.pending_balance > 0" class="text-danger fw-bold">${{ formatCurrency(item.pending_balance) }}</span>
              <span v-else-if="item.pending_balance === 0" :class="['badge', colorMode === 'dark' ? 'border border-success text-success' : 'bg-success text-white']">Pagado</span>
              <span v-else class="text-warning">${{ formatCurrency(item.pending_balance) }}</span>
            </template>
            <span v-else>—</span>
          </td>
          <td>
            <div class="d-flex gap-1 flex-nowrap">
              <CButton size="sm" color="info" variant="ghost" @click="$router.push(`/business/accommodations/${item.id}`)" title="Ver">
                <CIcon icon="cil-zoom-in" />
              </CButton>
              <CButton size="sm" color="warning" variant="ghost" @click="$router.push(`/business/accommodations/${item.id}/edit`)" title="Editar">
                <CIcon icon="cil-pencil" />
              </CButton>
              <CButton size="sm" color="danger" variant="ghost" @click="onDelete(item)" title="Eliminar">
                <CIcon icon="cil-trash" />
              </CButton>
            </div>
          </td>
        </tr>
      </tbody>
    </CTable>

    <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
      <div class="small text-muted">
        Mostrando {{ pageStart }}-{{ pageEnd }} de {{ sortedAccommodations.length }} registros
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { fetchAccommodations, deleteAccommodation } from '@/services/accommodationService'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'
import { CIcon } from '@coreui/icons-vue'
import { useColorModes } from '@coreui/vue'

const { colorMode } = useColorModes('coreui-free-vue-admin-template-theme')

const accommodations = ref([])
const dateInput = ref('')
const selectedDates = ref([])
const searchQuery = ref('')
const settingsStore = useSettingsStore()
const { user } = useAuth()

const sortKey = ref('date')
const sortOrder = ref('desc')
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

async function load() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  accommodations.value = await fetchAccommodations({ viewAll })
  currentPage.value = 1
}

watch(() => settingsStore.godModeViewAll, () => {
  load()
})

const filteredAccommodations = computed(() => {
  if (!searchQuery.value.trim()) return accommodations.value

  const query = searchQuery.value.trim().toLowerCase()

  const customerMatch = query.match(/customer:(\S+)/)
  const orgMatch = query.match(/organization:(\S+)/)
  const venueMatch = query.match(/venue:(\S+)/)

  return accommodations.value.filter(item => {
    let matches = true

    if (customerMatch) {
      const customerSearch = customerMatch[1].toLowerCase()
      const customerName = (item.customer_data?.fullname || item.customer_data?.user_data?.email || '').toLowerCase()
      matches = matches && customerName.includes(customerSearch)
    }

    if (orgMatch) {
      const orgSearch = orgMatch[1].toLowerCase()
      const orgName = (item.venue_data?.organization_data?.name || '').toLowerCase()
      matches = matches && orgName.includes(orgSearch)
    }

    if (venueMatch) {
      const venueSearch = venueMatch[1].toLowerCase()
      const venueName = (item.venue_data?.name || '').toLowerCase()
      matches = matches && venueName.includes(venueSearch)
    }

    if (!customerMatch && !orgMatch && !venueMatch) {
      const customerName = (item.customer_data?.fullname || item.customer_data?.user_data?.email || '').toLowerCase()
      const venueName = (item.venue_data?.name || '').toLowerCase()
      const orgName = (item.venue_data?.organization_data?.name || '').toLowerCase()
      matches = customerName.includes(query) || venueName.includes(query) || orgName.includes(query)
    }

    return matches
  })
})

const sortedAccommodations = computed(() => {
  let result = filteredAccommodations.value

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'date') {
        va = a.date ? new Date(a.date).getTime() : 0
        vb = b.date ? new Date(b.date).getTime() : 0
      } else if (key === 'venue') {
        va = (a.venue_data?.name || '').toLowerCase()
        vb = (b.venue_data?.name || '').toLowerCase()
      } else if (key === 'customer') {
        va = (a.customer_data?.fullname || '').toLowerCase()
        vb = (b.customer_data?.fullname || '').toLowerCase()
      } else if (key === 'price') {
        va = getAgreedPrice(a)
        vb = getAgreedPrice(b)
      } else if (key === 'balance') {
        va = Number(a.pending_balance) || 0
        vb = Number(b.pending_balance) || 0
      } else {
        va = (a[key] || '').toString().toLowerCase()
        vb = (b[key] || '').toString().toLowerCase()
      }
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }

  return result
})

const totalPages = computed(() => Math.ceil(sortedAccommodations.value.length / perPage.value))

const paginatedAccommodations = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return sortedAccommodations.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (sortedAccommodations.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, sortedAccommodations.value.length)
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

watch(searchQuery, () => { currentPage.value = 1 })

function addDate() {
  if (dateInput.value && !selectedDates.value.includes(dateInput.value)) {
    selectedDates.value.push(dateInput.value)
  }
  dateInput.value = ''
  load()
}

function removeDate(date) {
  selectedDates.value = selectedDates.value.filter(d => d !== date)
  load()
}

function clearAllDates() {
  selectedDates.value = []
  load()
}

async function onDelete(item) {
  if (confirm('Are you sure you want to delete this accommodation?')) {
    await deleteAccommodation(item.id)
    await load()
  }
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const s = Number(seconds)
  if (s % 86400 === 0) return (s / 86400) + 'D'
  if (s % 3600 === 0) return (s / 3600) + 'H'
  if (s >= 3600) {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    return (d ? d + 'D ' : '') + (h ? h + 'H' : '')
  }
  return s + 's'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day}/${month}/${year}`
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  if (timeStr.includes('T')) {
    const d = new Date(timeStr)
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const mins = String(d.getUTCMinutes()).padStart(2, '0')
    return `${hours}:${mins}`
  }
  return timeStr.slice(0, 5)
}

function calcCheckout(timeStr, duration, dateStr) {
  if (!timeStr || !duration || !dateStr) return '—'

  const dateObj = new Date(dateStr)
  const year = dateObj.getUTCFullYear()
  const month = dateObj.getUTCMonth()
  const day = dateObj.getUTCDate()

  let hours = 0, minutes = 0
  if (timeStr.includes('T')) {
    const timeDate = new Date(timeStr)
    hours = timeDate.getUTCHours()
    minutes = timeDate.getUTCMinutes()
  } else {
    const [h, m] = timeStr.split(':').map(Number)
    hours = h
    minutes = m
  }

  const startMs = Date.UTC(year, month, day, hours, minutes)
  const endMs = startMs + Number(duration) * 1000
  const end = new Date(endMs)

  const endYear = end.getUTCFullYear()
  const endMonth = String(end.getUTCMonth() + 1).padStart(2, '0')
  const endDay = String(end.getUTCDate()).padStart(2, '0')
  const endHours = String(end.getUTCHours()).padStart(2, '0')
  const endMins = String(end.getUTCMinutes()).padStart(2, '0')

  return `${endDay}/${endMonth}/${endYear} ${endHours}:${endMins}`
}

function formatCurrency(value) {
  if (value == null) return '0'
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function getAgreedPrice(item) {
  return Number(item.agreed_price) || Number(item.calculated_price) || 0
}

function pricesDiffer(item) {
  if (item.calculated_price === null || item.agreed_price === null) return false
  return Number(item.calculated_price) !== Number(item.agreed_price)
}

function hasDiscount(item) {
  if (item.calculated_price === null || item.agreed_price === null) return false
  return Number(item.agreed_price) < Number(item.calculated_price)
}

function getDiscountPercent(item) {
  if (item.calculated_price === null || item.agreed_price === null) return 0
  const diff = Number(item.calculated_price) - Number(item.agreed_price)
  return Math.round((diff / Number(item.calculated_price)) * 100)
}

onMounted(load)
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
