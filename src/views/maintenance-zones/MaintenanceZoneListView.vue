<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Zonas de Mantenimiento</strong>
          <CButton color="primary" size="sm" @click="showFormModal = true">
            <CIcon name="cil-plus" class="me-1" /> Nueva Zona
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="4">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadZones">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
          </CRow>

          <div class="mb-3">
            <CFormInput
              v-model="searchQuery"
              size="sm"
              placeholder="Buscar por nombre o descripción..."
            />
          </div>
          <div v-if="filteredZones.length === 0" class="text-center text-muted py-4">
            No hay zonas de mantenimiento registradas
          </div>
          <div v-else>
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
                    @click="toggleSort('type')"
                  >
                    Tipo {{ sortIcon('type') }}
                  </CTableHeaderCell>
                  <CTableHeaderCell
                    style="cursor: pointer; user-select: none;"
                    @click="toggleSort('venue')"
                  >
                    Sede {{ sortIcon('venue') }}
                  </CTableHeaderCell>
                  <CTableHeaderCell class="d-mobile-none">Descripcion</CTableHeaderCell>
                  <CTableHeaderCell
                    style="cursor: pointer; user-select: none;"
                    @click="toggleSort('is_active')"
                  >
                    Estado {{ sortIcon('is_active') }}
                  </CTableHeaderCell>
                  <CTableHeaderCell class="text-end">Acciones</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="zone in paginatedZones" :key="zone.id">
                  <CTableDataCell>
                    <strong>{{ zone.name }}</strong>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color="primary">
                      {{ zoneTypeLabels[zone.type] || zone.type || '-' }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{{ zone.venue_data?.name || '-' }}</CTableDataCell>
                  <CTableDataCell class="d-mobile-none">
                    <span class="text-truncate d-inline-block" style="max-width: 200px;">
                      {{ zone.description || '-' }}
                    </span>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="zone.is_active ? 'success' : 'secondary'">
                      {{ zone.is_active ? 'Activo' : 'Inactivo' }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell class="text-end">
                    <CButton
                      color="primary"
                      size="sm"
                      variant="ghost"
                      @click="editZone(zone)"
                      title="Editar"
                    >
                      <CIcon name="cil-pencil" />
                    </CButton>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(zone)"
                      title="Eliminar"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
              <div class="small text-muted">
                Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredZones.length }} registros
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
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CModal :visible="showFormModal" @close="closeFormModal" size="lg">
    <CModalHeader>
      <CModalTitle>{{ editingZone ? 'Editar Zona' : 'Nueva Zona' }}</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="saveZone">
        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Sede *</CFormLabel>
            <CFormSelect v-model="form.venue_id" required>
              <option value="">Seleccionar...</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.name }}
              </option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Nombre *</CFormLabel>
            <CFormInput v-model="form.name" required />
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Tipo *</CFormLabel>
            <CFormSelect v-model="form.type" required>
              <option value="">Seleccionar...</option>
              <option value="piscina">Piscina</option>
              <option value="kiosco">Kiosco</option>
              <option value="bbq">BBQ/Asador</option>
              <option value="jardin">Jardin</option>
              <option value="parqueadero">Parqueadero</option>
              <option value="habitaciones">Habitaciones</option>
              <option value="area_comun">Area Comun</option>
              <option value="cocina">Cocina</option>
              <option value="otro">Otro</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Estado</CFormLabel>
            <CFormCheck
              v-model="form.is_active"
              label="Activo"
            />
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="12">
            <CFormLabel>Descripcion</CFormLabel>
            <CFormTextarea v-model="form.description" rows="2" />
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="12">
            <CFormLabel>Notas</CFormLabel>
            <CFormTextarea v-model="form.notes" rows="2" />
          </CCol>
        </CRow>
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="closeFormModal">
        Cancelar
      </CButton>
      <CButton color="primary" @click="saveZone" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminacion</CModalTitle>
    </CModalHeader>
    <CModalBody>
      Esta seguro de eliminar la zona "{{ deletingZone?.name }}"?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showDeleteModal = false">
        Cancelar
      </CButton>
      <CButton color="danger" @click="deleteZone" :disabled="deleting">
        {{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormLabel, CFormInput, CFormTextarea, CFormSelect, CFormCheck,
  CPagination, CPaginationItem
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const zones = ref([])
const searchQuery = ref('')
const sortKey = ref('name')
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

const filteredZones = computed(() => {
  let result = zones.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(z =>
      (z.name && z.name.toLowerCase().includes(q)) ||
      (z.description && z.description.toLowerCase().includes(q)) ||
      (z.venue_data?.name && z.venue_data.name.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'venue') {
        va = (a.venue_data?.name || '').toLowerCase()
        vb = (b.venue_data?.name || '').toLowerCase()
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

const totalPages = computed(() => Math.ceil(filteredZones.value.length / perPage.value))

const paginatedZones = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredZones.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredZones.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredZones.value.length)
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
const venues = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const editingZone = ref(null)
const deletingZone = ref(null)

const filters = ref({
  venue_id: ''
})

const zoneTypeLabels = {
  piscina: 'Piscina',
  kiosco: 'Kiosco',
  bbq: 'BBQ/Asador',
  jardin: 'Jardin',
  parqueadero: 'Parqueadero',
  habitaciones: 'Habitaciones',
  area_comun: 'Area Comun',
  cocina: 'Cocina',
  otro: 'Otro'
}

const form = ref({
  venue_id: '',
  name: '',
  type: '',
  description: '',
  notes: '',
  is_active: true
})

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
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    const url = `/api/maintenance-zones${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      zones.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading maintenance zones:', error)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.value = {
    venue_id: '',
    name: '',
    type: '',
    description: '',
    notes: '',
    is_active: true
  }
  editingZone.value = null
}

const closeFormModal = () => {
  showFormModal.value = false
  resetForm()
}

const editZone = (zone) => {
  editingZone.value = zone
  form.value = {
    venue_id: zone.venue_id || '',
    name: zone.name || '',
    type: zone.type || '',
    description: zone.description || '',
    notes: zone.notes || '',
    is_active: zone.is_active !== false
  }
  showFormModal.value = true
}

const saveZone = async () => {
  if (!form.value.name || !form.value.venue_id) return

  saving.value = true
  try {
    const url = editingZone.value
      ? `/api/maintenance-zones/${editingZone.value.id}`
      : '/api/maintenance-zones'
    const method = editingZone.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })

    if (response.ok) {
      await loadZones()
      closeFormModal()
    }
  } catch (error) {
    console.error('Error saving maintenance zone:', error)
  } finally {
    saving.value = false
  }
}

const confirmDelete = (zone) => {
  deletingZone.value = zone
  showDeleteModal.value = true
}

const deleteZone = async () => {
  if (!deletingZone.value) return

  deleting.value = true
  try {
    const response = await fetch(`/api/maintenance-zones/${deletingZone.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    if (response.ok) {
      await loadZones()
      showDeleteModal.value = false
      deletingZone.value = null
    }
  } catch (error) {
    console.error('Error deleting maintenance zone:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadVenues()
  loadZones()
})
</script>

<style scoped>
</style>
