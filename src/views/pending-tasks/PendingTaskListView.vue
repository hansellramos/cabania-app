<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Tareas Pendientes</strong>
          <RouterLink to="/business/pending-tasks/create" class="btn btn-primary btn-sm">
            <CIcon name="cil-plus" class="me-1" /> Nueva Tarea
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
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
              <CFormSelect v-model="filters.zone_id" size="sm" @change="loadTasks" :disabled="!filters.venue_id">
                <option value="">Todas las zonas</option>
                <option v-for="zone in zones" :key="zone.id" :value="zone.id">
                  {{ zone.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.status" size="sm" @change="loadTasks">
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completada</option>
              </CFormSelect>
            </CCol>
            <CCol :md="2">
              <CFormLabel class="small">Prioridad</CFormLabel>
              <CFormSelect v-model="filters.priority" size="sm" @change="loadTasks">
                <option value="">Todas</option>
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput v-model="filters.search" size="sm" placeholder="Buscar..." @input="debouncedSearch" />
            </CCol>
          </CRow>

          <!-- Card view for tasks -->
          <div v-if="tasks.length > 0">
            <div v-for="task in tasks" :key="task.id" class="border rounded p-3 mb-2" :class="taskBorderClass(task)">
              <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <CBadge :color="priorityBadges[task.priority]?.color || 'secondary'" size="sm">
                      {{ priorityBadges[task.priority]?.label || task.priority }}
                    </CBadge>
                    <CBadge :color="statusBadges[task.status]?.color || 'secondary'" size="sm">
                      {{ statusBadges[task.status]?.label || task.status }}
                    </CBadge>
                    <small v-if="task.zone" class="text-muted">
                      <CIcon name="cil-map" size="sm" class="me-1" />{{ task.zone.name }}
                    </small>
                    <small v-if="task.due_date" class="ms-auto" :class="isOverdue(task) ? 'text-danger fw-bold' : 'text-muted'">
                      <CIcon name="cil-calendar" size="sm" class="me-1" />{{ formatDate(task.due_date) }}
                    </small>
                  </div>
                  <h6 class="mb-1" :class="{ 'text-decoration-line-through text-muted': task.status === 'completed' }">
                    {{ task.title }}
                  </h6>
                  <p v-if="task.description" class="text-muted small mb-1 text-truncate" style="max-width: 600px;">
                    {{ task.description }}
                  </p>
                  <div v-if="task.images && task.images.length > 0" class="d-flex gap-1 mt-1">
                    <img
                      v-for="img in task.images.slice(0, 3)"
                      :key="img.id"
                      :src="img.image_url"
                      class="rounded"
                      style="width: 40px; height: 40px; object-fit: cover; cursor: pointer;"
                      @click="openImageModal(img)"
                    />
                    <span v-if="task.images.length > 3" class="small text-muted align-self-center">
                      +{{ task.images.length - 3 }}
                    </span>
                  </div>
                  <div v-if="task.maintenance_log_id" class="mt-1">
                    <RouterLink
                      :to="`/business/maintenance/logs/${task.maintenance_log_id}`"
                      class="small text-info text-decoration-none"
                    >
                      <CIcon name="cil-task" size="sm" class="me-1" />Ver orden de mantenimiento
                    </RouterLink>
                  </div>
                </div>
                <div class="d-flex gap-1 ms-2 flex-shrink-0">
                  <CButton
                    v-if="task.status === 'pending'"
                    color="success"
                    size="sm"
                    variant="ghost"
                    title="Crear orden de mantenimiento"
                    @click="createMaintenance(task)"
                    :disabled="creatingMaintenance === task.id"
                  >
                    <CIcon name="cil-wrench" />
                  </CButton>
                  <CDropdown variant="btn-group">
                    <CDropdownToggle color="secondary" size="sm" variant="ghost" :caret="false">
                      <CIcon name="cil-options" />
                    </CDropdownToggle>
                    <CDropdownMenu>
                      <CDropdownItem
                        v-if="task.status !== 'completed'"
                        @click="updateStatus(task, 'completed')"
                      >
                        <CIcon name="cil-check-circle" class="me-2 text-success" /> Completar
                      </CDropdownItem>
                      <CDropdownItem
                        v-if="task.status === 'completed'"
                        @click="updateStatus(task, 'pending')"
                      >
                        <CIcon name="cil-action-undo" class="me-2 text-warning" /> Reabrir
                      </CDropdownItem>
                      <CDropdownItem @click="$router.push(`/business/pending-tasks/${task.id}/edit`)">
                        <CIcon name="cil-pencil" class="me-2 text-info" /> Editar
                      </CDropdownItem>
                      <CDropdownItem @click="confirmDelete(task)" class="text-danger">
                        <CIcon name="cil-trash" class="me-2" /> Eliminar
                      </CDropdownItem>
                    </CDropdownMenu>
                  </CDropdown>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-muted py-4">
            No hay tareas pendientes
          </div>

          <div v-if="tasks.length > 0" class="mt-3 small text-muted">
            {{ tasks.filter(t => t.status === 'pending').length }} pendientes,
            {{ tasks.filter(t => t.status === 'in_progress').length }} en progreso,
            {{ tasks.filter(t => t.status === 'completed').length }} completadas
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
      ¿Está seguro de eliminar la tarea "{{ taskToDelete?.title }}"?
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" @click="showDeleteModal = false">Cancelar</CButton>
      <CButton color="danger" @click="deleteTask" :disabled="deleting">
        {{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal :visible="showImageModal" @close="showImageModal = false" size="lg">
    <CModalHeader>
      <CModalTitle>Imagen</CModalTitle>
    </CModalHeader>
    <CModalBody class="text-center">
      <img v-if="selectedImage" :src="selectedImage.image_url" class="img-fluid rounded" style="max-height: 70vh;" />
      <p v-if="selectedImage?.description" class="mt-2 text-muted">{{ selectedImage.description }}</p>
    </CModalBody>
  </CModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormLabel, CFormInput, CFormSelect,
  CDropdown, CDropdownToggle, CDropdownMenu, CDropdownItem
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const router = useRouter()

const tasks = ref([])
const venues = ref([])
const zones = ref([])
const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const taskToDelete = ref(null)
const creatingMaintenance = ref(null)
const showImageModal = ref(false)
const selectedImage = ref(null)

let searchTimeout = null

const filters = ref({
  venue_id: '',
  zone_id: '',
  status: '',
  priority: '',
  search: '',
})

const statusBadges = {
  pending: { color: 'warning', label: 'Pendiente' },
  in_progress: { color: 'info', label: 'En Progreso' },
  completed: { color: 'success', label: 'Completada' },
}

const priorityBadges = {
  low: { color: 'secondary', label: 'Baja' },
  medium: { color: 'info', label: 'Media' },
  high: { color: 'warning', label: 'Alta' },
  urgent: { color: 'danger', label: 'Urgente' },
}

const taskBorderClass = (task) => {
  if (task.status === 'completed') return 'border-success bg-light'
  if (isOverdue(task)) return 'border-danger'
  if (task.priority === 'urgent') return 'border-danger'
  if (task.priority === 'high') return 'border-warning'
  return ''
}

const isOverdue = (task) => {
  if (!task.due_date || task.status === 'completed') return false
  return new Date(task.due_date) < new Date(new Date().toDateString())
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadTasks(), 300)
}

const loadTasks = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.zone_id) params.append('zone_id', filters.value.zone_id)
    if (filters.value.status) params.append('status', filters.value.status)
    if (filters.value.priority) params.append('priority', filters.value.priority)
    if (filters.value.search) params.append('search', filters.value.search)

    const url = `/api/pending-tasks${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      tasks.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading tasks:', error)
  } finally {
    loading.value = false
  }
}

const loadVenues = async () => {
  try {
    const response = await fetch('/api/venues', { credentials: 'include' })
    if (response.ok) venues.value = await response.json()
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

const loadZones = async () => {
  if (!filters.value.venue_id) { zones.value = []; return }
  try {
    const response = await fetch(`/api/maintenance-zones?venue_id=${filters.value.venue_id}`, { credentials: 'include' })
    if (response.ok) zones.value = await response.json()
  } catch (error) {
    console.error('Error loading zones:', error)
  }
}

const onVenueChange = () => {
  filters.value.zone_id = ''
  loadZones()
  loadTasks()
}

const updateStatus = async (task, status) => {
  try {
    const response = await fetch(`/api/pending-tasks/${task.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
    if (response.ok) {
      const updated = await response.json()
      const idx = tasks.value.findIndex(t => t.id === task.id)
      if (idx !== -1) tasks.value[idx] = updated
    }
  } catch (error) {
    console.error('Error updating status:', error)
  }
}

const createMaintenance = async (task) => {
  creatingMaintenance.value = task.id
  try {
    const response = await fetch(`/api/pending-tasks/${task.id}/create-maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    if (response.ok) {
      const result = await response.json()
      router.push(`/business/maintenance/logs/${result.log.id}/edit`)
    } else {
      const err = await response.json()
      alert(err.error || 'Error al crear orden de mantenimiento')
    }
  } catch (error) {
    console.error('Error creating maintenance:', error)
    alert('Error al crear orden de mantenimiento')
  } finally {
    creatingMaintenance.value = null
  }
}

const confirmDelete = (task) => {
  taskToDelete.value = task
  showDeleteModal.value = true
}

const deleteTask = async () => {
  if (!taskToDelete.value) return
  deleting.value = true
  try {
    const response = await fetch(`/api/pending-tasks/${taskToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      showDeleteModal.value = false
      taskToDelete.value = null
      await loadTasks()
    }
  } catch (error) {
    console.error('Error deleting task:', error)
  } finally {
    deleting.value = false
  }
}

const openImageModal = (img) => {
  selectedImage.value = img
  showImageModal.value = true
}

onMounted(() => {
  loadVenues()
  loadTasks()
})
</script>
