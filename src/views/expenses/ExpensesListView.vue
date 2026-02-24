<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Gastos</strong>
          <RouterLink :to="newExpenseLink" class="btn btn-primary btn-sm">
            <CIcon name="cil-plus" class="me-1" /> Nuevo Gasto
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadExpenses">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Categoría</CFormLabel>
              <CFormSelect v-model="filters.category_id" size="sm" @change="loadExpenses">
                <option value="">Todas las categorías</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Desde</CFormLabel>
              <CFormInput type="date" v-model="filters.from_date" size="sm" @change="loadExpenses" />
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Hasta</CFormLabel>
              <CFormInput type="date" v-model="filters.to_date" size="sm" @change="loadExpenses" />
            </CCol>
          </CRow>
          <div class="mb-3">
            <CFormInput
              v-model="searchQuery"
              placeholder="Buscar por descripción, referencia o proveedor..."
              size="sm"
            />
          </div>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('expense_date')"
                >
                  Fecha {{ sortIcon('expense_date') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('category')"
                >
                  Categoría {{ sortIcon('category') }}
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
                  @click="toggleSort('amount')"
                >
                  Monto {{ sortIcon('amount') }}
                </CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Descripción</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="expense in paginatedExpenses" :key="expense.id">
                <CTableDataCell>{{ formatDate(expense.expense_date) }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge v-if="expense.category" :color="expense.category.color || 'primary'">
                    <CIcon v-if="expense.category.icon" :name="expense.category.icon" class="me-1" />
                    {{ expense.category.name }}
                  </CBadge>
                  <span v-else class="text-muted">Sin categoría</span>
                </CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  {{ expense.venue_data?.name || '—' }}
                </CTableDataCell>
                <CTableDataCell>{{ formatCurrency(expense.amount) }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  <span class="text-truncate d-inline-block" style="max-width: 200px;">
                    {{ expense.description || '—' }}
                  </span>
                </CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <RouterLink
                      :to="`/business/expenses/${expense.id}/edit`"
                      class="btn btn-info btn-sm"
                      title="Editar"
                    >
                      <CIcon name="cil-pencil" />
                    </RouterLink>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(expense)"
                      title="Eliminar"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredExpenses.length === 0">
                <CTableDataCell colspan="6" class="text-center text-muted py-4">
                  No hay gastos registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
            <CTableFoot v-if="filteredExpenses.length > 0">
              <CTableRow>
                <CTableDataCell colspan="3" class="text-end">
                  <strong>Total:</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <strong>{{ formatCurrency(filteredTotal) }}</strong>
                </CTableDataCell>
                <CTableDataCell colspan="2"></CTableDataCell>
              </CTableRow>
            </CTableFoot>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredExpenses.length }} registros
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
      <CModalTitle>Confirmar eliminación</CModalTitle>
    </CModalHeader>
    <CModalBody>
      ¿Está seguro de eliminar este gasto de {{ formatCurrency(expenseToDelete?.amount) }}?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" @click="showDeleteModal = false">Cancelar</CButton>
      <CButton color="danger" @click="deleteExpense" :disabled="deleting">
        {{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CTableFoot,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormInput, CFormSelect
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const expenses = ref([])
const venues = ref([])
const categories = ref([])
const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const expenseToDelete = ref(null)
const searchQuery = ref('')

const filters = ref({
  venue_id: '',
  category_id: '',
  from_date: '',
  to_date: ''
})

const sortKey = ref('expense_date')
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

const filteredExpenses = computed(() => {
  let result = expenses.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.reference && e.reference.toLowerCase().includes(q)) ||
      (e.supplier && e.supplier.toLowerCase().includes(q))
    )
  }

  if (sortKey.value) {
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      let va, vb
      if (key === 'amount') {
        va = parseFloat(a.amount) || 0
        vb = parseFloat(b.amount) || 0
      } else if (key === 'expense_date') {
        va = a.expense_date ? new Date(a.expense_date).getTime() : 0
        vb = b.expense_date ? new Date(b.expense_date).getTime() : 0
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

const filteredTotal = computed(() => {
  return filteredExpenses.value.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
})

const totalPages = computed(() => Math.ceil(filteredExpenses.value.length / perPage.value))

const paginatedExpenses = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredExpenses.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredExpenses.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredExpenses.value.length)
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

const newExpenseLink = computed(() => {
  if (filters.value.venue_id) {
    return { path: '/business/expenses/create', query: { venue_id: filters.value.venue_id } }
  }
  return '/business/expenses/create'
})

const loadExpenses = async () => {
  loading.value = true
  currentPage.value = 1
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.category_id) params.append('category_id', filters.value.category_id)
    if (filters.value.from_date) params.append('from_date', filters.value.from_date)
    if (filters.value.to_date) params.append('to_date', filters.value.to_date)

    const url = `/api/expenses${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      expenses.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading expenses:', error)
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
    const response = await fetch('/api/expense-categories', { credentials: 'include' })
    if (response.ok) {
      categories.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading categories:', error)
  }
}

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const confirmDelete = (expense) => {
  expenseToDelete.value = expense
  showDeleteModal.value = true
}

const deleteExpense = async () => {
  if (!expenseToDelete.value) return
  deleting.value = true
  try {
    const response = await fetch(`/api/expenses/${expenseToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      showDeleteModal.value = false
      expenseToDelete.value = null
      await loadExpenses()
    }
  } catch (error) {
    console.error('Error deleting expense:', error)
  } finally {
    deleting.value = false
  }
}

const route = useRoute()

onMounted(() => {
  if (route.query.venue_id) {
    filters.value.venue_id = route.query.venue_id
  }
  loadExpenses()
  loadVenues()
  loadCategories()
})
</script>
