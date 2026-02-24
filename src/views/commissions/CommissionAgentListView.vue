<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Comisionistas</strong>
          <RouterLink to="/business/commissions/agents/create" class="btn btn-primary btn-sm">
            <CIcon name="cil-plus" class="me-1" /> Nuevo Comisionista
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadAgents">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.is_active" size="sm" @change="loadAgents">
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </CFormSelect>
            </CCol>
            <CCol :md="6">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput
                v-model="filters.search"
                size="sm"
                placeholder="Buscar por nombre o proveedor..."
                @input="onSearchInput"
              />
            </CCol>
          </CRow>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('name')"
                >
                  Nombre {{ sortIcon('name') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('provider')"
                >
                  Proveedor {{ sortIcon('provider') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  class="d-mobile-none"
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('venue')"
                >
                  Sede {{ sortIcon('venue') }}
                </CTableHeaderCell>
                <CTableHeaderCell>Reglas</CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('is_active')"
                >
                  Estado {{ sortIcon('is_active') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('payments')"
                >
                  Pagos {{ sortIcon('payments') }}
                </CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="agent in paginatedAgents" :key="agent.id">
                <CTableDataCell>{{ agent.name }}</CTableDataCell>
                <CTableDataCell>{{ agent.provider?.name || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  {{ getVenueName(agent.venue_id) }}
                </CTableDataCell>
                <CTableDataCell>{{ agent.rules?.length || 0 }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="agent.is_active ? 'success' : 'secondary'">
                    {{ agent.is_active ? 'Activo' : 'Inactivo' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ agent._count?.payments || 0 }}</CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <RouterLink
                      :to="`/business/commissions/agents/${agent.id}/edit`"
                      class="btn btn-info btn-sm"
                      title="Editar"
                    >
                      <CIcon name="cil-pencil" />
                    </RouterLink>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(agent)"
                      title="Eliminar"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="sortedAgents.length === 0">
                <CTableDataCell colspan="7" class="text-center text-muted py-4">
                  No hay comisionistas registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ sortedAgents.length }} registros
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
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CFormSelect, CFormInput, CFormLabel
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const router = useRouter()

const agents = ref([])
const venues = ref([])
const loading = ref(false)

const filters = ref({
  venue_id: '',
  is_active: '',
  search: ''
})

const sortKey = ref('name')
const sortOrder = ref('asc')
const perPage = ref(20)
const currentPage = ref(1)

let searchTimeout = null

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

const sortedAgents = computed(() => {
  let result = agents.value

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'provider') {
        va = (a.provider?.name || '').toLowerCase()
        vb = (b.provider?.name || '').toLowerCase()
      } else if (key === 'venue') {
        va = (getVenueName(a.venue_id) || '').toLowerCase()
        vb = (getVenueName(b.venue_id) || '').toLowerCase()
      } else if (key === 'is_active') {
        va = a.is_active ? 1 : 0
        vb = b.is_active ? 1 : 0
      } else if (key === 'payments') {
        va = a._count?.payments || 0
        vb = b._count?.payments || 0
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

const totalPages = computed(() => Math.ceil(sortedAgents.value.length / perPage.value))

const paginatedAgents = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return sortedAgents.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (sortedAgents.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, sortedAgents.value.length)
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

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

const getVenueName = (venueId) => {
  if (!venueId) return '—'
  const venue = venues.value.find((v) => v.id === venueId)
  return venue?.name || '—'
}

const onSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadAgents()
  }, 300)
}

const loadAgents = async () => {
  loading.value = true
  currentPage.value = 1
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.is_active) params.append('is_active', filters.value.is_active)
    if (filters.value.search) params.append('search', filters.value.search)

    const url = `/api/commission-agents${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      agents.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading commission agents:', error)
  } finally {
    loading.value = false
  }
}

const loadVenues = async () => {
  try {
    const response = await fetch('/api/venues', { credentials: 'include' })
    if (response.ok) {
      venues.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

const confirmDelete = async (agent) => {
  const paymentCount = agent._count?.payments || 0
  let message = `¿Está seguro de eliminar al comisionista "${agent.name}"?`
  if (paymentCount > 0) {
    message += `\n\nEste comisionista tiene ${paymentCount} pago(s) registrado(s). Se desactivará en lugar de eliminarse.`
  }

  if (!confirm(message)) return

  try {
    const response = await fetch(`/api/commission-agents/${agent.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      await loadAgents()
    }
  } catch (error) {
    console.error('Error deleting commission agent:', error)
  }
}

onMounted(() => {
  loadAgents()
  loadVenues()
})
</script>
