<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Inventario</strong>
          <RouterLink :to="newItemLink" class="btn btn-primary btn-sm">
            <CIcon name="cil-plus" class="me-1" /> Nuevo Item
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadItems">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Categoria</CFormLabel>
              <CFormSelect v-model="filters.category_id" size="sm" @change="loadItems">
                <option value="">Todas las categorias</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="6">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput
                v-model="filters.search"
                size="sm"
                placeholder="Buscar por nombre..."
                @input="loadItems"
              />
            </CCol>
          </CRow>

          <CNav variant="tabs" class="mb-3">
            <CNavItem>
              <CNavLink
                :active="activeTab === 'supply'"
                href="#"
                @click.prevent="activeTab = 'supply'; currentPage = 1"
              >
                Insumos
                <CBadge color="info" class="ms-1">{{ supplyItems.length }}</CBadge>
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                :active="activeTab === 'asset'"
                href="#"
                @click.prevent="activeTab = 'asset'; currentPage = 1"
              >
                Activos Fijos
                <CBadge color="warning" class="ms-1">{{ assetItems.length }}</CBadge>
              </CNavLink>
            </CNavItem>
          </CNav>

          <CTabContent>
            <!-- Tab Insumos -->
            <CTabPane :visible="activeTab === 'supply'">
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
                      @click="toggleSort('category')"
                    >
                      Categoria {{ sortIcon('category') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell
                      class="d-mobile-none"
                      style="cursor: pointer; user-select: none;"
                      @click="toggleSort('venue')"
                    >
                      Sede {{ sortIcon('venue') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell
                      style="cursor: pointer; user-select: none;"
                      @click="toggleSort('quantity')"
                    >
                      Cantidad {{ sortIcon('quantity') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell>Stock Min.</CTableHeaderCell>
                    <CTableHeaderCell
                      style="cursor: pointer; user-select: none;"
                      @click="toggleSort('unit_cost')"
                    >
                      Costo Unit. {{ sortIcon('unit_cost') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell>Acciones</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="item in paginatedItems" :key="item.id">
                    <CTableDataCell>
                      <strong>{{ item.name }}</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge v-if="item.category" :color="item.category.color || 'primary'">
                        {{ item.category.name }}
                      </CBadge>
                      <span v-else class="text-muted">-</span>
                    </CTableDataCell>
                    <CTableDataCell class="d-mobile-none">
                      {{ item.venue_data?.name || '-' }}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge
                        v-if="item.quantity <= (item.minimum_stock || 0)"
                        color="danger"
                      >
                        {{ item.quantity }} {{ item.unit || '' }}
                      </CBadge>
                      <span v-else>{{ item.quantity }} {{ item.unit || '' }}</span>
                    </CTableDataCell>
                    <CTableDataCell>{{ item.minimum_stock != null ? item.minimum_stock : '-' }}</CTableDataCell>
                    <CTableDataCell>{{ formatCurrency(item.unit_cost) }}</CTableDataCell>
                    <CTableDataCell>
                      <div class="d-flex gap-1">
                        <RouterLink
                          :to="`/business/inventory/${item.id}/edit`"
                          class="btn btn-info btn-sm"
                          title="Editar"
                        >
                          <CIcon name="cil-pencil" />
                        </RouterLink>
                        <CButton
                          color="danger"
                          size="sm"
                          variant="ghost"
                          @click="confirmDelete(item)"
                          title="Eliminar"
                        >
                          <CIcon name="cil-trash" />
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                  <CTableRow v-if="activeFilteredItems.length === 0">
                    <CTableDataCell colspan="7" class="text-center text-muted py-4">
                      No hay insumos registrados
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            </CTabPane>

            <!-- Tab Activos Fijos -->
            <CTabPane :visible="activeTab === 'asset'">
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
                      @click="toggleSort('category')"
                    >
                      Categoria {{ sortIcon('category') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell
                      class="d-mobile-none"
                      style="cursor: pointer; user-select: none;"
                      @click="toggleSort('venue')"
                    >
                      Sede {{ sortIcon('venue') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell
                      style="cursor: pointer; user-select: none;"
                      @click="toggleSort('quantity')"
                    >
                      Cantidad {{ sortIcon('quantity') }}
                    </CTableHeaderCell>
                    <CTableHeaderCell>Condicion</CTableHeaderCell>
                    <CTableHeaderCell class="d-mobile-none">Ubicacion</CTableHeaderCell>
                    <CTableHeaderCell>Acciones</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="item in paginatedItems" :key="item.id">
                    <CTableDataCell>
                      <strong>{{ item.name }}</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge v-if="item.category" :color="item.category.color || 'primary'">
                        {{ item.category.name }}
                      </CBadge>
                      <span v-else class="text-muted">-</span>
                    </CTableDataCell>
                    <CTableDataCell class="d-mobile-none">
                      {{ item.venue_data?.name || '-' }}
                    </CTableDataCell>
                    <CTableDataCell>{{ item.quantity }}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge :color="conditionColor(item.condition)">
                        {{ conditionLabel[item.condition] || '-' }}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell class="d-mobile-none">
                      {{ item.location_notes || '-' }}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div class="d-flex gap-1">
                        <RouterLink
                          :to="`/business/inventory/${item.id}/edit`"
                          class="btn btn-info btn-sm"
                          title="Editar"
                        >
                          <CIcon name="cil-pencil" />
                        </RouterLink>
                        <CButton
                          color="danger"
                          size="sm"
                          variant="ghost"
                          @click="confirmDelete(item)"
                          title="Eliminar"
                        >
                          <CIcon name="cil-trash" />
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                  <CTableRow v-if="activeFilteredItems.length === 0">
                    <CTableDataCell colspan="7" class="text-center text-muted py-4">
                      No hay activos fijos registrados
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            </CTabPane>
          </CTabContent>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ activeFilteredItems.length }} registros
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
      Esta seguro de eliminar el item "{{ itemToDelete?.name }}"?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" @click="showDeleteModal = false">Cancelar</CButton>
      <CButton color="danger" @click="deleteItem" :disabled="deleting">
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
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormInput, CFormSelect,
  CNav, CNavItem, CNavLink, CTabContent, CTabPane
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const items = ref([])
const venues = ref([])
const categories = ref([])
const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const itemToDelete = ref(null)
const activeTab = ref('supply')

const filters = ref({
  venue_id: '',
  category_id: '',
  search: ''
})

const sortKey = ref('name')
const sortOrder = ref('asc')
const perPage = ref(20)
const currentPage = ref(1)

const conditionLabel = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  dañado: 'Dañado',
  fuera_de_servicio: 'Fuera de Servicio'
}

const conditionColor = (condition) => {
  const colors = {
    bueno: 'success',
    regular: 'warning',
    malo: 'danger',
    dañado: 'danger',
    fuera_de_servicio: 'dark'
  }
  return colors[condition] || 'secondary'
}

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

const supplyItems = computed(() => items.value.filter(item => item.type === 'supply'))
const assetItems = computed(() => items.value.filter(item => item.type === 'asset'))

const activeFilteredItems = computed(() => {
  let result = activeTab.value === 'supply' ? supplyItems.value : assetItems.value

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'quantity' || key === 'unit_cost') {
        va = parseFloat(a[key]) || 0
        vb = parseFloat(b[key]) || 0
      } else if (key === 'category') {
        va = (a.category?.name || '').toLowerCase()
        vb = (b.category?.name || '').toLowerCase()
      } else if (key === 'venue') {
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

const totalPages = computed(() => Math.ceil(activeFilteredItems.value.length / perPage.value))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return activeFilteredItems.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (activeFilteredItems.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, activeFilteredItems.value.length)
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

const newItemLink = computed(() => {
  const query = {}
  if (filters.value.venue_id) query.venue_id = filters.value.venue_id
  if (filters.value.category_id) query.category_id = filters.value.category_id
  if (Object.keys(query).length > 0) {
    return { path: '/business/inventory/create', query }
  }
  return '/business/inventory/create'
})

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const loadItems = async () => {
  loading.value = true
  currentPage.value = 1
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.category_id) params.append('category_id', filters.value.category_id)
    if (filters.value.search) params.append('search', filters.value.search)

    const url = `/api/inventory${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      items.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading inventory items:', error)
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

const loadCategories = async () => {
  try {
    const response = await fetch('/api/inventory-categories', { credentials: 'include' })
    if (response.ok) {
      categories.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading categories:', error)
  }
}

const confirmDelete = (item) => {
  itemToDelete.value = item
  showDeleteModal.value = true
}

const deleteItem = async () => {
  if (!itemToDelete.value) return
  deleting.value = true
  try {
    const response = await fetch(`/api/inventory/${itemToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      showDeleteModal.value = false
      itemToDelete.value = null
      await loadItems()
    }
  } catch (error) {
    console.error('Error deleting inventory item:', error)
  } finally {
    deleting.value = false
  }
}

const route = useRoute()

onMounted(() => {
  if (route.query.venue_id) {
    filters.value.venue_id = route.query.venue_id
  }
  loadItems()
  loadVenues()
  loadCategories()
})
</script>
