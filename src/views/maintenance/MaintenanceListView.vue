<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Registros de Mantenimiento</strong>
          <RouterLink :to="newLogLink" class="btn btn-primary btn-sm">
            <CIcon name="cil-plus" class="me-1" /> Nuevo Registro
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="2">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="onVenueChange">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Zona</CFormLabel>
              <CFormSelect v-model="filters.zone_id" size="sm" @change="loadLogs" :disabled="!filters.venue_id">
                <option value="">Todas las zonas</option>
                <option v-for="zone in zones" :key="zone.id" :value="zone.id">
                  {{ zone.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Proveedor</CFormLabel>
              <CFormSelect v-model="filters.provider_id" size="sm" @change="loadLogs">
                <option value="">Todos</option>
                <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                  {{ provider.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm" @change="loadLogs">
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Desde</CFormLabel>
              <CFormInput type="date" v-model="filters.from_date" size="sm" @change="loadLogs" />
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Hasta</CFormLabel>
              <CFormInput type="date" v-model="filters.to_date" size="sm" @change="loadLogs" />
            </CCol>
          </CRow>
          <div class="mb-3">
            <CFormInput
              v-model="searchQuery"
              size="sm"
              placeholder="Buscar por descripción..."
            />
          </div>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('maintenance_date')"
                >
                  Fecha {{ sortIcon('maintenance_date') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('zone')"
                >
                  Zona {{ sortIcon('zone') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('provider')"
                >
                  Proveedor {{ sortIcon('provider') }}
                </CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Descripcion</CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('status')"
                >
                  Estado {{ sortIcon('status') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('priority')"
                >
                  Prioridad {{ sortIcon('priority') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('cost')"
                >
                  Costo {{ sortIcon('cost') }}
                </CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="log in paginatedLogs" :key="log.id">
                <CTableDataCell>{{ formatDate(log.maintenance_date) }}</CTableDataCell>
                <CTableDataCell>{{ log.zone_data?.name || '-' }}</CTableDataCell>
                <CTableDataCell>{{ log.provider_data?.name || '-' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  <span class="text-truncate d-inline-block" style="max-width: 200px;">
                    {{ log.description || '-' }}
                  </span>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="statusBadges[log.status]?.color || 'secondary'">
                    {{ statusBadges[log.status]?.label || log.status }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="priorityBadges[log.priority]?.color || 'secondary'">
                    {{ priorityBadges[log.priority]?.label || log.priority }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ formatCurrency(log.cost) }}</CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <RouterLink
                      :to="`/business/maintenance/logs/${log.id}`"
                      class="btn btn-secondary btn-sm"
                      title="Ver"
                    >
                      <CIcon name="cil-search" />
                    </RouterLink>
                    <RouterLink
                      :to="`/business/maintenance/logs/${log.id}/edit`"
                      class="btn btn-info btn-sm"
                      title="Editar"
                    >
                      <CIcon name="cil-pencil" />
                    </RouterLink>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(log)"
                      title="Eliminar"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredLogs.length === 0">
                <CTableDataCell colspan="8" class="text-center text-muted py-4">
                  No hay registros de mantenimiento
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
            <CTableFoot v-if="filteredLogs.length > 0">
              <CTableRow>
                <CTableDataCell colspan="6" class="text-end">
                  <strong>Total:</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <strong>{{ formatCurrency(filteredTotal) }}</strong>
                </CTableDataCell>
                <CTableDataCell></CTableDataCell>
              </CTableRow>
            </CTableFoot>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredLogs.length }} registros
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

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminacion</CModalTitle>
    </CModalHeader>
    <CModalBody>
      Esta seguro de eliminar este registro de mantenimiento?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" @click="showDeleteModal = false">Cancelar</CButton>
      <CButton color="danger" @click="deleteLog" :disabled="deleting">
        {{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CTableFoot,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormInput, CFormSelect
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()

const logs = ref([])
const venues = ref([])
const zones = ref([])
const providers = ref([])
const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const logToDelete = ref(null)
const searchQuery = ref('')

const filters = ref({
  venue_id: '',
  zone_id: '',
  provider_id: '',
  status: '',
  from_date: '',
  to_date: ''
})

const sortKey = ref('maintenance_date')
const sortOrder = ref('desc')
const perPage = ref(20)
const currentPage = ref(1)

const statusBadges = {
  pending: { color: 'warning', label: 'Pendiente' },
  in_progress: { color: 'info', label: 'En Progreso' },
  completed: { color: 'success', label: 'Completado' },
  cancelled: { color: 'secondary', label: 'Cancelado' }
}

const priorityBadges = {
  low: { color: 'secondary', label: 'Baja' },
  medium: { color: 'info', label: 'Media' },
  high: { color: 'warning', label: 'Alta' },
  urgent: { color: 'danger', label: 'Urgente' }
}

const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }

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

const filteredLogs = computed(() => {
  let result = logs.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(l =>
      (l.description && l.description.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'maintenance_date') {
        va = a.maintenance_date ? new Date(a.maintenance_date).getTime() : 0
        vb = b.maintenance_date ? new Date(b.maintenance_date).getTime() : 0
      } else if (key === 'cost') {
        va = parseFloat(a.cost) || 0
        vb = parseFloat(b.cost) || 0
      } else if (key === 'zone') {
        va = (a.zone_data?.name || '').toLowerCase()
        vb = (b.zone_data?.name || '').toLowerCase()
      } else if (key === 'provider') {
        va = (a.provider_data?.name || '').toLowerCase()
        vb = (b.provider_data?.name || '').toLowerCase()
      } else if (key === 'priority') {
        va = priorityOrder[a.priority] || 0
        vb = priorityOrder[b.priority] || 0
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

const filteredTotal = computed(() => {
  return filteredLogs.value.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0)
})

const totalPages = computed(() => Math.ceil(filteredLogs.value.length / perPage.value))

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredLogs.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredLogs.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredLogs.value.length)
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

const newLogLink = computed(() => {
  if (filters.value.venue_id) {
    return { path: '/business/maintenance/logs/create', query: { venue_id: filters.value.venue_id } }
  }
  return '/business/maintenance/logs/create'
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const loadLogs = async () => {
  loading.value = true
  currentPage.value = 1
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.zone_id) params.append('zone_id', filters.value.zone_id)
    if (filters.value.provider_id) params.append('provider_id', filters.value.provider_id)
    if (filters.value.status) params.append('status', filters.value.status)
    if (filters.value.from_date) params.append('from_date', filters.value.from_date)
    if (filters.value.to_date) params.append('to_date', filters.value.to_date)

    const url = `/api/maintenance-logs${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      logs.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading maintenance logs:', error)
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

const loadZones = async () => {
  if (!filters.value.venue_id) {
    zones.value = []
    return
  }
  try {
    const response = await fetch(`/api/maintenance-zones?venue_id=${filters.value.venue_id}`, { credentials: 'include' })
    if (response.ok) {
      zones.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading zones:', error)
  }
}

const loadProviders = async () => {
  try {
    const response = await fetch('/api/providers', { credentials: 'include' })
    if (response.ok) {
      providers.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading providers:', error)
  }
}

const onVenueChange = () => {
  filters.value.zone_id = ''
  loadZones()
  loadLogs()
}

const confirmDelete = (log) => {
  logToDelete.value = log
  showDeleteModal.value = true
}

const deleteLog = async () => {
  if (!logToDelete.value) return
  deleting.value = true
  try {
    const response = await fetch(`/api/maintenance-logs/${logToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      showDeleteModal.value = false
      logToDelete.value = null
      await loadLogs()
    }
  } catch (error) {
    console.error('Error deleting maintenance log:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  if (route.query.venue_id) {
    filters.value.venue_id = route.query.venue_id
  }
  loadVenues()
  loadProviders()
  loadLogs()
  if (filters.value.venue_id) {
    loadZones()
  }
})
</script>
