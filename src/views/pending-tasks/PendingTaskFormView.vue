<template>
  <CRow>
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>{{ isEditing ? 'Editar Tarea' : 'Nueva Tarea Pendiente' }}</strong>
          <CButton color="secondary" size="sm" variant="outline" @click="goBack">
            Cancelar
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CForm @submit.prevent="saveTask">
            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Titulo *</CFormLabel>
                <CFormInput
                  v-model="form.title"
                  placeholder="¿Qué necesita atención?"
                  required
                />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="6">
                <CFormLabel>Organización</CFormLabel>
                <CFormSelect v-model="form.organization_id" @change="onOrganizationChange">
                  <option value="">Seleccionar...</option>
                  <option v-for="org in organizations" :key="org.id" :value="org.id">
                    {{ org.name }}
                  </option>
                </CFormSelect>
              </CCol>
              <CCol :md="6">
                <CFormLabel>Sede *</CFormLabel>
                <CFormSelect v-model="form.venue_id" required @change="onVenueChange">
                  <option value="">Seleccionar...</option>
                  <option v-for="venue in filteredVenues" :key="venue.id" :value="venue.id">
                    {{ venue.name }}
                  </option>
                </CFormSelect>
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="4">
                <CFormLabel>Zona</CFormLabel>
                <CFormSelect v-model="form.zone_id" :disabled="!form.venue_id">
                  <option value="">{{ form.venue_id ? 'Seleccionar...' : 'Seleccione sede primero' }}</option>
                  <option v-for="zone in zones" :key="zone.id" :value="zone.id">
                    {{ zone.name }}
                  </option>
                </CFormSelect>
              </CCol>
              <CCol :md="4">
                <CFormLabel>Prioridad</CFormLabel>
                <CFormSelect v-model="form.priority">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </CFormSelect>
              </CCol>
              <CCol :md="4">
                <CFormLabel>Fecha limite</CFormLabel>
                <CFormInput type="date" v-model="form.due_date" />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Descripción</CFormLabel>
                <CFormTextarea
                  v-model="form.description"
                  rows="3"
                  placeholder="Detalle del problema o lo que requiere atención..."
                />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Notas</CFormLabel>
                <CFormTextarea
                  v-model="form.notes"
                  rows="2"
                  placeholder="Notas adicionales..."
                />
              </CCol>
            </CRow>

            <div v-if="isEditing" class="mb-3">
              <CFormLabel>Estado</CFormLabel>
              <CFormSelect v-model="form.status">
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completada</option>
              </CFormSelect>
            </div>

            <!-- Images section (only for editing) -->
            <div v-if="isEditing" class="mb-3">
              <CFormLabel>Fotos</CFormLabel>
              <div class="d-flex gap-2 mb-2">
                <CButton color="primary" size="sm" @click="$refs.fileInput?.click()">
                  <CIcon name="cil-folder-open" class="me-1" /> Seleccionar archivo
                </CButton>
                <CButton color="info" size="sm" @click="$refs.cameraInput?.click()">
                  <CIcon name="cil-camera" class="me-1" /> Tomar Foto
                </CButton>
              </div>
              <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="uploadImage" />
              <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="d-none" @change="uploadImage" />
              <div v-if="uploading" class="small text-muted">Subiendo imagen...</div>
              <div v-if="images.length > 0" class="d-flex gap-2 flex-wrap mt-2">
                <div v-for="img in images" :key="img.id" class="position-relative">
                  <img :src="img.image_url" class="rounded" style="width: 80px; height: 80px; object-fit: cover;" />
                  <CButton
                    color="danger"
                    size="sm"
                    class="position-absolute top-0 end-0 p-0"
                    style="width: 20px; height: 20px; line-height: 1; font-size: 12px;"
                    @click="deleteImage(img)"
                  >
                    &times;
                  </CButton>
                </div>
              </div>
            </div>

            <hr />
            <div class="d-flex gap-2">
              <CButton type="submit" color="primary" :disabled="saving">
                {{ saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Tarea') }}
              </CButton>
              <CButton color="secondary" variant="outline" @click="goBack">
                Cancelar
              </CButton>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CForm, CFormLabel, CFormInput, CFormSelect, CFormTextarea
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()

const isEditing = computed(() => !!route.params.id)
const saving = ref(false)
const uploading = ref(false)
const organizations = ref([])
const venues = ref([])
const zones = ref([])
const images = ref([])

const form = ref({
  organization_id: '',
  venue_id: '',
  zone_id: '',
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  due_date: '',
  notes: '',
})

const filteredVenues = computed(() => {
  if (!form.value.organization_id) return venues.value
  return venues.value.filter(v => v.organization_id === form.value.organization_id)
})

const onOrganizationChange = () => {
  form.value.venue_id = ''
  form.value.zone_id = ''
  zones.value = []
}

const onVenueChange = () => {
  form.value.zone_id = ''
  loadZones()
}

const loadOrganizations = async () => {
  try {
    const response = await fetch('/api/organizations', { credentials: 'include' })
    if (response.ok) organizations.value = await response.json()
  } catch (error) {
    console.error('Error loading organizations:', error)
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
  if (!form.value.venue_id) { zones.value = []; return }
  try {
    const response = await fetch(`/api/maintenance-zones?venue_id=${form.value.venue_id}`, { credentials: 'include' })
    if (response.ok) zones.value = await response.json()
  } catch (error) {
    console.error('Error loading zones:', error)
  }
}

const loadTask = async () => {
  if (!route.params.id) return
  try {
    const response = await fetch(`/api/pending-tasks/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      const task = await response.json()
      form.value = {
        organization_id: task.organization_id || '',
        venue_id: task.venue_id || '',
        zone_id: task.zone_id || '',
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        status: task.status || 'pending',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        notes: task.notes || '',
      }
      images.value = task.images || []
      if (task.venue_id) await loadZones()
    }
  } catch (error) {
    console.error('Error loading task:', error)
  }
}

const saveTask = async () => {
  if (!form.value.title || !form.value.venue_id) {
    alert('Por favor complete los campos requeridos (titulo y sede)')
    return
  }
  saving.value = true
  try {
    const url = isEditing.value
      ? `/api/pending-tasks/${route.params.id}`
      : '/api/pending-tasks'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value),
    })

    if (response.ok) {
      router.push('/business/pending-tasks')
    } else {
      const err = await response.json()
      alert(err.error || 'Error al guardar la tarea')
    }
  } catch (error) {
    console.error('Error saving task:', error)
    alert('Error al guardar la tarea')
  } finally {
    saving.value = false
  }
}

const uploadImage = async (event) => {
  const file = event.target.files[0]
  if (!file || !route.params.id) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`/api/pending-tasks/${route.params.id}/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (response.ok) {
      const img = await response.json()
      images.value.push(img)
    }
  } catch (error) {
    console.error('Error uploading image:', error)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

const deleteImage = async (img) => {
  try {
    const response = await fetch(`/api/pending-task-images/${img.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      images.value = images.value.filter(i => i.id !== img.id)
    }
  } catch (error) {
    console.error('Error deleting image:', error)
  }
}

const goBack = () => {
  router.push('/business/pending-tasks')
}

onMounted(async () => {
  await Promise.all([loadOrganizations(), loadVenues()])
  if (route.query.venue_id) {
    form.value.venue_id = route.query.venue_id
    await loadZones()
    if (route.query.zone_id) form.value.zone_id = route.query.zone_id
  }
  if (isEditing.value) await loadTask()
})
</script>
