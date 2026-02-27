<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Categorías de Gasto</strong>
          <CButton color="primary" size="sm" @click="showFormModal = true">
            <CIcon name="cil-plus" class="me-1" /> Nueva Categoría
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div class="mb-3">
            <CFormInput
              v-model="searchQuery"
              size="sm"
              placeholder="Buscar por nombre o descripción..."
            />
          </div>
          <div v-if="filteredCategories.length === 0" class="text-center text-muted py-4">
            No hay categorías de gasto registradas
          </div>
          <div v-else>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Icono</CTableHeaderCell>
                  <CTableHeaderCell
                    style="cursor: pointer; user-select: none;"
                    @click="toggleSort('name')"
                  >
                    Nombre {{ sortIcon('name') }}
                  </CTableHeaderCell>
                  <CTableHeaderCell>Descripción</CTableHeaderCell>
                  <CTableHeaderCell>Color</CTableHeaderCell>
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
                <CTableRow v-for="category in paginatedCategories" :key="category.id">
                  <CTableDataCell>
                    <CBadge v-if="category.icon" :color="category.color || 'primary'">
                      <CIcon :name="category.icon" />
                    </CBadge>
                    <span v-else class="text-muted">-</span>
                  </CTableDataCell>
                  <CTableDataCell>
                    <strong>{{ category.name }}</strong>
                    <div v-if="category.is_system" class="small text-muted">(Sistema)</div>
                  </CTableDataCell>
                  <CTableDataCell>{{ category.description || '-' }}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="category.color || 'primary'">
                      {{ colorLabel(category.color) }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="category.is_active ? 'success' : 'secondary'">
                      {{ category.is_active ? 'Activo' : 'Inactivo' }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell class="text-end">
                    <CButton 
                      color="primary" 
                      size="sm" 
                      variant="ghost" 
                      @click="editExpenseCategory(category)"
                      :disabled="category.is_system"
                      :title="category.is_system ? 'No se puede editar categorías del sistema' : 'Editar'"
                    >
                      <CIcon name="cil-pencil" />
                    </CButton>
                    <CButton 
                      color="danger" 
                      size="sm" 
                      variant="ghost" 
                      @click="confirmDelete(category)"
                      :disabled="category.is_system"
                      :title="category.is_system ? 'No se puede eliminar categorías del sistema' : 'Eliminar'"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
              <div class="small text-muted">
                Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredCategories.length }} registros
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
      <CModalTitle>{{ editingExpenseCategory ? 'Editar Categoría de Gasto' : 'Nueva Categoría de Gasto' }}</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="saveExpenseCategory">
        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Nombre *</CFormLabel>
            <CFormInput v-model="form.name" required />
          </CCol>
          <CCol :md="6">
            <CFormLabel>Color</CFormLabel>
            <CFormSelect v-model="form.color">
              <option value="primary">Primario</option>
              <option value="secondary">Secundario</option>
              <option value="success">Éxito</option>
              <option value="danger">Peligro</option>
              <option value="warning">Advertencia</option>
              <option value="info">Información</option>
              <option value="dark">Oscuro</option>
            </CFormSelect>
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="12">
            <CFormLabel>Descripción</CFormLabel>
            <CFormTextarea v-model="form.description" rows="2" />
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Icono (CoreUI)</CFormLabel>
            <div class="input-group">
              <CFormInput 
                v-model="form.icon" 
                placeholder="ej: cil-wallet, cil-cash, etc." 
              />
              <CButton 
                v-if="form.icon" 
                color="secondary" 
                variant="outline" 
                type="button"
                @click="form.icon = ''"
              >
                <CIcon name="cil-x" />
              </CButton>
            </div>
            <div class="small text-muted mt-1">
              Ver iconos en <a href="https://coreui.io/icons/" target="_blank">coreui.io/icons</a>
            </div>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Vista Previa del Icono</CFormLabel>
            <div class="pt-2">
              <CBadge v-if="form.icon" :color="form.color || 'primary'" class="p-2">
                <CIcon :name="form.icon" size="lg" />
              </CBadge>
              <span v-else class="text-muted">Sin icono seleccionado</span>
            </div>
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="12">
            <CFormCheck 
              v-model="form.is_active" 
              label="Activo" 
            />
          </CCol>
        </CRow>
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="closeFormModal">
        Cancelar
      </CButton>
      <CButton color="primary" @click="saveExpenseCategory" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminación</CModalTitle>
    </CModalHeader>
    <CModalBody>
      ¿Está seguro de eliminar la categoría de gasto "{{ deletingExpenseCategory?.name }}"?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showDeleteModal = false">
        Cancelar
      </CButton>
      <CButton color="danger" @click="deleteExpenseCategory" :disabled="deleting">
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

const expenseCategories = ref([])
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

const filteredCategories = computed(() => {
  let result = expenseCategories.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    )
  }

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

const totalPages = computed(() => Math.ceil(filteredCategories.value.length / perPage.value))

const paginatedCategories = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredCategories.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredCategories.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredCategories.value.length)
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
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const editingExpenseCategory = ref(null)
const deletingExpenseCategory = ref(null)

const colorLabels = {
  primary: 'Primario',
  secondary: 'Secundario',
  success: 'Éxito',
  danger: 'Peligro',
  warning: 'Advertencia',
  info: 'Información',
  dark: 'Oscuro'
}

const form = ref({
  name: '',
  description: '',
  icon: '',
  color: 'primary',
  is_active: true
})

const colorLabel = (color) => {
  return colorLabels[color] || color
}

const loadExpenseCategories = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/expense-categories', { credentials: 'include' })
    if (response.ok) {
      expenseCategories.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading expense categories:', error)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    icon: '',
    color: 'primary',
    is_active: true
  }
  editingExpenseCategory.value = null
}

const closeFormModal = () => {
  showFormModal.value = false
  resetForm()
}

const editExpenseCategory = (category) => {
  editingExpenseCategory.value = category
  form.value = {
    name: category.name || '',
    description: category.description || '',
    icon: category.icon || '',
    color: category.color || 'primary',
    is_active: category.is_active !== false
  }
  showFormModal.value = true
}

const saveExpenseCategory = async () => {
  if (!form.value.name) return
  
  saving.value = true
  try {
    const url = editingExpenseCategory.value 
      ? `/api/expense-categories/${editingExpenseCategory.value.id}`
      : '/api/expense-categories'
    const method = editingExpenseCategory.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })
    
    if (response.ok) {
      await loadExpenseCategories()
      closeFormModal()
    }
  } catch (error) {
    console.error('Error saving expense category:', error)
  } finally {
    saving.value = false
  }
}

const confirmDelete = (category) => {
  deletingExpenseCategory.value = category
  showDeleteModal.value = true
}

const deleteExpenseCategory = async () => {
  if (!deletingExpenseCategory.value) return
  
  deleting.value = true
  try {
    const response = await fetch(`/api/expense-categories/${deletingExpenseCategory.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    if (response.ok) {
      await loadExpenseCategories()
      showDeleteModal.value = false
      deletingExpenseCategory.value = null
    }
  } catch (error) {
    console.error('Error deleting expense category:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(loadExpenseCategories)
</script>

<style scoped>
.input-group {
  display: flex;
  gap: 0;
}

.input-group > :not(:last-child) {
  border-radius: 0.375rem 0 0 0.375rem;
}

.input-group > :last-child {
  border-radius: 0 0.375rem 0.375rem 0;
  border-left: 0;
}
</style>
