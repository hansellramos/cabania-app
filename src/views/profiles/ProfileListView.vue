<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Perfiles</strong>
          <CButton color="primary" size="sm" @click="$router.push('/admin/profiles/new')">
            Crear Perfil
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div class="mb-3">
            <CFormInput
              v-model="searchQuery"
              size="sm"
              placeholder="Buscar por nombre o código..."
            />
          </div>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('code')"
                >
                  Código {{ sortIcon('code') }}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style="cursor: pointer; user-select: none;"
                  @click="toggleSort('name')"
                >
                  Nombre {{ sortIcon('name') }}
                </CTableHeaderCell>
                <CTableHeaderCell>Descripción</CTableHeaderCell>
                <CTableHeaderCell>Permisos</CTableHeaderCell>
                <CTableHeaderCell>Sistema</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="profile in paginatedProfiles" :key="profile.id">
                <CTableDataCell>{{ profile.code }}</CTableDataCell>
                <CTableDataCell>{{ profile.name }}</CTableDataCell>
                <CTableDataCell>{{ profile.description || '—' }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color="info" class="me-1" v-for="perm in (profile.permissions || []).slice(0, 3)" :key="perm">
                    {{ perm }}
                  </CBadge>
                  <span v-if="(profile.permissions || []).length > 3" class="text-muted">
                    +{{ profile.permissions.length - 3 }} más
                  </span>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="profile.is_system ? 'secondary' : 'primary'">
                    {{ profile.is_system ? 'Sí' : 'No' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <CButton
                      color="info"
                      size="sm"
                      variant="ghost"
                      @click="$router.push(`/admin/profiles/${profile.id}`)"
                      title="Ver detalle"
                    >
                      <CIcon :icon="cilZoom" />
                    </CButton>
                    <CButton
                      v-if="!profile.is_system"
                      color="primary"
                      size="sm"
                      variant="ghost"
                      @click="$router.push(`/admin/profiles/${profile.id}/edit`)"
                      title="Editar"
                    >
                      <CIcon :icon="cilPencil" />
                    </CButton>
                    <CButton
                      v-if="!profile.is_system"
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="deleteProfile(profile)"
                      title="Eliminar"
                    >
                      <CIcon :icon="cilTrash" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="filteredProfiles.length === 0">
                <CTableDataCell colspan="6" class="text-center text-muted">
                  No hay perfiles registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>

          <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
            <div class="small text-muted">
              Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredProfiles.length }} registros
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
import { ref, computed, watch, onMounted } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import { cilZoom, cilPencil, cilTrash } from '@coreui/icons'

const profiles = ref([])
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

const filteredProfiles = computed(() => {
  let result = profiles.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q))
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

const totalPages = computed(() => Math.ceil(filteredProfiles.value.length / perPage.value))

const paginatedProfiles = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredProfiles.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredProfiles.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredProfiles.value.length)
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

const loadProfiles = async () => {
  try {
    const response = await fetch('/api/profiles')
    if (response.ok) {
      profiles.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading profiles:', error)
  }
}

const deleteProfile = async (profile) => {
  if (!confirm(`¿Está seguro de eliminar el perfil "${profile.name}"?`)) return

  try {
    const response = await fetch(`/api/profiles/${profile.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      await loadProfiles()
    } else {
      const data = await response.json()
      alert(data.error || 'Error al eliminar perfil')
    }
  } catch (error) {
    console.error('Error deleting profile:', error)
    alert('Error al eliminar perfil')
  }
}

onMounted(loadProfiles)
</script>
