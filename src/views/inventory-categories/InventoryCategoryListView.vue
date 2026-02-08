<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Categorias de Inventario</strong>
          <CButton color="primary" size="sm" @click="showFormModal = true">
            <CIcon name="cil-plus" class="me-1" /> Nueva Categoria
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div v-if="categories.length === 0" class="text-center text-muted py-4">
            No hay categorias de inventario registradas
          </div>
          <div v-else>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Icono</CTableHeaderCell>
                  <CTableHeaderCell>Nombre</CTableHeaderCell>
                  <CTableHeaderCell>Tipo</CTableHeaderCell>
                  <CTableHeaderCell>Descripcion</CTableHeaderCell>
                  <CTableHeaderCell>Estado</CTableHeaderCell>
                  <CTableHeaderCell class="text-end">Acciones</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="category in categories" :key="category.id">
                  <CTableDataCell>
                    <CBadge v-if="category.icon" :color="category.color || 'primary'">
                      <CIcon :name="category.icon" />
                    </CBadge>
                    <span v-else class="text-muted">-</span>
                  </CTableDataCell>
                  <CTableDataCell>
                    <strong>{{ category.name }}</strong>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="typeColor(category.type)">
                      {{ typeLabel(category.type) }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{{ category.description || '-' }}</CTableDataCell>
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
                      @click="editCategory(category)"
                      title="Editar"
                    >
                      <CIcon name="cil-pencil" />
                    </CButton>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(category)"
                      title="Eliminar"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CModal :visible="showFormModal" @close="closeFormModal" size="lg">
    <CModalHeader>
      <CModalTitle>{{ editingCategory ? 'Editar Categoria de Inventario' : 'Nueva Categoria de Inventario' }}</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="saveCategory">
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
              <option value="success">Exito</option>
              <option value="danger">Peligro</option>
              <option value="warning">Advertencia</option>
              <option value="info">Informacion</option>
              <option value="dark">Oscuro</option>
            </CFormSelect>
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="12">
            <CFormLabel>Descripcion</CFormLabel>
            <CFormTextarea v-model="form.description" rows="2" />
          </CCol>
        </CRow>
        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Icono (CoreUI)</CFormLabel>
            <div class="input-group">
              <CFormInput
                v-model="form.icon"
                placeholder="ej: cil-basket, cil-laptop, etc."
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
          <CCol :md="6">
            <CFormLabel>Tipo</CFormLabel>
            <CFormSelect v-model="form.type">
              <option value="">Ambos</option>
              <option value="supply">Insumos</option>
              <option value="asset">Activos</option>
            </CFormSelect>
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
      <CButton color="primary" @click="saveCategory" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal :visible="showDeleteModal" @close="showDeleteModal = false">
    <CModalHeader>
      <CModalTitle>Confirmar eliminacion</CModalTitle>
    </CModalHeader>
    <CModalBody>
      Esta seguro de eliminar la categoria de inventario "{{ deletingCategory?.name }}"?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showDeleteModal = false">
        Cancelar
      </CButton>
      <CButton color="danger" @click="deleteCategory" :disabled="deleting">
        {{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormLabel, CFormInput, CFormTextarea, CFormSelect, CFormCheck
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const categories = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const editingCategory = ref(null)
const deletingCategory = ref(null)

const form = ref({
  name: '',
  description: '',
  icon: '',
  color: 'primary',
  type: '',
  is_active: true
})

const typeLabel = (type) => {
  if (type === 'supply') return 'Insumo'
  if (type === 'asset') return 'Activo'
  return 'Ambos'
}

const typeColor = (type) => {
  if (type === 'supply') return 'info'
  if (type === 'asset') return 'warning'
  return 'secondary'
}

const loadCategories = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/inventory-categories', { credentials: 'include' })
    if (response.ok) {
      categories.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading inventory categories:', error)
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
    type: '',
    is_active: true
  }
  editingCategory.value = null
}

const closeFormModal = () => {
  showFormModal.value = false
  resetForm()
}

const editCategory = (category) => {
  editingCategory.value = category
  form.value = {
    name: category.name || '',
    description: category.description || '',
    icon: category.icon || '',
    color: category.color || 'primary',
    type: category.type || '',
    is_active: category.is_active !== false
  }
  showFormModal.value = true
}

const saveCategory = async () => {
  if (!form.value.name) return

  saving.value = true
  try {
    const url = editingCategory.value
      ? `/api/inventory-categories/${editingCategory.value.id}`
      : '/api/inventory-categories'
    const method = editingCategory.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })

    if (response.ok) {
      await loadCategories()
      closeFormModal()
    }
  } catch (error) {
    console.error('Error saving inventory category:', error)
  } finally {
    saving.value = false
  }
}

const confirmDelete = (category) => {
  deletingCategory.value = category
  showDeleteModal.value = true
}

const deleteCategory = async () => {
  if (!deletingCategory.value) return

  deleting.value = true
  try {
    const response = await fetch(`/api/inventory-categories/${deletingCategory.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    if (response.ok) {
      await loadCategories()
      showDeleteModal.value = false
      deletingCategory.value = null
    }
  } catch (error) {
    console.error('Error deleting inventory category:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(loadCategories)
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
