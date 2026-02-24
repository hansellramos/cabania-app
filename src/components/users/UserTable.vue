<template>
  <CCard class="mb-4">
    <CCardHeader class="d-flex justify-content-between align-items-center">
      <strong>Usuarios</strong>
      <RouterLink to="/users/create">
        <CButton color="success" size="sm">+ Nuevo Usuario</CButton>
      </RouterLink>
    </CCardHeader>
    <CCardBody>
      <div class="mb-3">
        <label class="form-label">Buscar:</label>
        <input type="text" v-model="searchQuery" class="form-control form-control-sm" placeholder="Buscar por nombre o email" />
      </div>
      <CTable hover responsive>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell scope="col">Avatar</CTableHeaderCell>
            <CTableHeaderCell
              scope="col"
              style="cursor: pointer; user-select: none;"
              @click="toggleSort('display_name')"
            >
              Nombre {{ sortIcon('display_name') }}
            </CTableHeaderCell>
            <CTableHeaderCell
              scope="col"
              style="cursor: pointer; user-select: none;"
              @click="toggleSort('email')"
            >
              Email {{ sortIcon('email') }}
            </CTableHeaderCell>
            <CTableHeaderCell
              scope="col"
              style="cursor: pointer; user-select: none;"
              @click="toggleSort('role')"
            >
              Rol {{ sortIcon('role') }}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col">Estado</CTableHeaderCell>
            <CTableHeaderCell scope="col">Acciones</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="user in paginatedUsers" :key="user.id">
            <CTableDataCell>
              <CAvatar v-if="user.avatar_url" :src="user.avatar_url" size="md" />
              <CAvatar v-else color="secondary" size="md">
                <CIcon icon="cil-user" />
              </CAvatar>
            </CTableDataCell>
            <CTableDataCell>{{ user.display_name || 'Sin nombre' }}</CTableDataCell>
            <CTableDataCell>{{ user.email || 'Sin email' }}</CTableDataCell>
            <CTableDataCell>
              <CBadge :color="getRoleColor(user.role)">{{ user.role || 'user' }}</CBadge>
            </CTableDataCell>
            <CTableDataCell>
              <CBadge :color="user.is_locked ? 'danger' : 'success'">
                {{ user.is_locked ? 'Bloqueado' : 'Activo' }}
              </CBadge>
            </CTableDataCell>
            <CTableDataCell>
              <CButton color="primary" size="sm" @click="onEdit(user)">Editar</CButton>
              <CButton
                v-if="user.is_locked"
                color="success"
                size="sm"
                class="ms-2"
                @click="onUnlock(user)"
              >Desbloquear</CButton>
              <CButton
                v-else
                color="warning"
                size="sm"
                class="ms-2"
                @click="onLock(user)"
              >Bloquear</CButton>
              <CButton color="danger" size="sm" class="ms-2" @click="onDelete(user)">Eliminar</CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>

      <div v-if="totalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-2">
        <div class="small text-muted">
          Mostrando {{ pageStart }}-{{ pageEnd }} de {{ filteredUsers.length }} registros
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
import { ref, onMounted, computed, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { fetchUsers, deleteUser, lockUser, unlockUser } from '@/services/userService'

const users = ref([])
const searchQuery = ref('')
const router = useRouter()

const sortKey = ref('display_name')
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

const filteredUsers = computed(() => {
  let result = users.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(u =>
      (u.display_name && u.display_name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
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

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / perPage.value))

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredUsers.value.slice(start, start + perPage.value)
})

const pageStart = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  return (currentPage.value - 1) * perPage.value + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * perPage.value, filteredUsers.value.length)
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

function getRoleColor(role) {
  switch(role) {
    case 'admin': return 'danger'
    case 'manager': return 'warning'
    case 'user': return 'info'
    default: return 'secondary'
  }
}

async function loadUsers() {
  try {
    users.value = await fetchUsers()
  } catch (error) {
    console.error('Error loading users:', error)
  }
}

onMounted(() => {
  loadUsers()
})

function onEdit(user) {
  router.push(`/users/${user.id}/edit`)
}

async function onLock(user) {
  if (confirm(`¿Estás seguro de que deseas bloquear a "${user.display_name || user.email}"?`)) {
    try {
      await lockUser(user.id)
      await loadUsers()
    } catch (error) {
      alert(error.message)
    }
  }
}

async function onUnlock(user) {
  if (confirm(`¿Estás seguro de que deseas desbloquear a "${user.display_name || user.email}"?`)) {
    try {
      await unlockUser(user.id)
      await loadUsers()
    } catch (error) {
      alert(error.message)
    }
  }
}

async function onDelete(user) {
  if (confirm(`¿Estás seguro de que deseas eliminar a "${user.display_name || user.email}"? Esta acción no se puede deshacer.`)) {
    try {
      await deleteUser(user.id)
      await loadUsers()
    } catch (error) {
      alert(error.message)
    }
  }
}
</script>
