<template>
  <CRow>
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>{{ isEditing ? 'Editar Registro de Mantenimiento' : 'Nuevo Registro de Mantenimiento' }}</strong>
          <CButton color="secondary" size="sm" variant="outline" @click="goBack">
            Cancelar
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CForm @submit.prevent="saveLog">
            <CRow class="mb-3">
              <CCol :md="6">
                <CFormLabel>Organizacion *</CFormLabel>
                <template v-if="lockedOrganization">
                  <div class="form-control-plaintext">
                    <CBadge color="secondary" class="fs-6 py-2 px-3">
                      <CIcon name="cil-building" class="me-1" />
                      {{ lockedOrganization.name }}
                    </CBadge>
                  </div>
                </template>
                <template v-else>
                  <CFormSelect v-model="form.organization_id" required>
                    <option value="">Seleccionar...</option>
                    <option v-for="org in organizations" :key="org.id" :value="org.id">
                      {{ org.name }}
                    </option>
                  </CFormSelect>
                </template>
              </CCol>
              <CCol :md="6">
                <CFormLabel>Sede *</CFormLabel>
                <template v-if="lockedVenue">
                  <div class="form-control-plaintext">
                    <RouterLink :to="`/business/venues/${lockedVenue.id}/read`" class="text-decoration-none">
                      <CBadge color="warning" class="fs-6 py-2 px-3">
                        <CIcon name="cil-location-pin" class="me-1" />
                        {{ lockedVenue.name }}
                        <CIcon name="cil-external-link" size="sm" class="ms-1" />
                      </CBadge>
                    </RouterLink>
                  </div>
                </template>
                <template v-else>
                  <CFormSelect v-model="form.venue_id" required>
                    <option value="">Seleccionar...</option>
                    <option v-for="venue in filteredVenues" :key="venue.id" :value="venue.id">
                      {{ venue.name }}
                    </option>
                  </CFormSelect>
                </template>
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="4">
                <CFormLabel>Zona *</CFormLabel>
                <CFormSelect v-model="form.zone_id" required :disabled="!form.venue_id">
                  <option value="">{{ form.venue_id ? 'Seleccionar...' : 'Seleccione sede primero' }}</option>
                  <option v-for="zone in zones" :key="zone.id" :value="zone.id">
                    {{ zone.name }}
                  </option>
                </CFormSelect>
              </CCol>
              <CCol :md="4">
                <CFormLabel>Proveedor</CFormLabel>
                <div class="position-relative">
                  <CFormInput
                    v-model="providerSearch"
                    placeholder="Buscar o crear proveedor..."
                    @input="searchProviders"
                    @focus="showProviderSuggestions = true"
                    @blur="hideProviderSuggestions"
                    autocomplete="off"
                  />
                  <div
                    v-if="showProviderSuggestions && (providerSuggestions.length > 0 || (providerSearch && providerSearch.length >= 2))"
                    class="provider-suggestions"
                  >
                    <div
                      v-for="provider in providerSuggestions"
                      :key="provider.id"
                      class="provider-suggestion"
                      @mousedown="selectProvider(provider)"
                    >
                      {{ provider.name }}
                    </div>
                    <div
                      v-if="providerSearch && providerSearch.length >= 2 && !providerSuggestions.some(p => p.name.toLowerCase() === providerSearch.toLowerCase())"
                      class="provider-suggestion provider-create"
                      @mousedown="createAndSelectProvider"
                    >
                      <CIcon name="cil-plus" class="me-1" />
                      Crear "{{ providerSearch }}"
                    </div>
                  </div>
                </div>
                <div v-if="selectedProvider" class="mt-2">
                  <CBadge color="info">
                    <CIcon name="cil-user" class="me-1" />
                    {{ selectedProvider.name }}
                    <CIcon name="cil-x" size="sm" class="ms-1 cursor-pointer" @click="clearProvider" />
                  </CBadge>
                </div>
              </CCol>
              <CCol :md="4">
                <CFormLabel>Prioridad *</CFormLabel>
                <CFormSelect v-model="form.priority" required>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </CFormSelect>
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="3">
                <CFormLabel>Fecha *</CFormLabel>
                <CFormInput type="date" v-model="form.maintenance_date" required />
              </CCol>
              <CCol :md="3">
                <CFormLabel>Hora Entrada</CFormLabel>
                <CFormInput type="time" v-model="form.entry_time" />
              </CCol>
              <CCol :md="3">
                <CFormLabel>Hora Salida</CFormLabel>
                <CFormInput type="time" v-model="form.exit_time" />
              </CCol>
              <CCol :md="3">
                <CFormLabel>Estado *</CFormLabel>
                <CFormSelect v-model="form.status" required>
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </CFormSelect>
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="4">
                <CFormLabel>Costo</CFormLabel>
                <CFormInput
                  type="number"
                  v-model="form.cost"
                  placeholder="0"
                />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Descripcion *</CFormLabel>
                <CFormTextarea
                  v-model="form.description"
                  rows="3"
                  placeholder="Descripcion del mantenimiento..."
                  required
                />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Trabajo Realizado</CFormLabel>
                <CFormTextarea
                  v-model="form.work_performed"
                  rows="3"
                  placeholder="Detalle del trabajo realizado..."
                />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Pendientes</CFormLabel>
                <CFormTextarea
                  v-model="form.pending_items"
                  rows="2"
                  placeholder="Items pendientes por realizar..."
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

            <div class="d-flex justify-content-end gap-2">
              <CButton color="secondary" variant="outline" @click="goBack">
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" :disabled="saving">
                {{ saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar') }}
              </CButton>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Supplies Section (edit mode only) -->
  <CRow v-if="isEditing">
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Insumos Consumidos</strong>
          <CButton color="primary" size="sm" @click="showSupplyModal = true">
            <CIcon name="cil-plus" class="me-1" /> Agregar Insumo
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div v-if="supplies.length === 0" class="text-center text-muted py-4">
            No hay insumos registrados
          </div>
          <CTable v-else hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Item</CTableHeaderCell>
                <CTableHeaderCell>Cantidad</CTableHeaderCell>
                <CTableHeaderCell>Unidad</CTableHeaderCell>
                <CTableHeaderCell>Costo Unit.</CTableHeaderCell>
                <CTableHeaderCell>Subtotal</CTableHeaderCell>
                <CTableHeaderCell class="text-end">Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="supply in supplies" :key="supply.id">
                <CTableDataCell>{{ supply.item_name || supply.inventory_item_data?.name || '-' }}</CTableDataCell>
                <CTableDataCell>{{ supply.quantity }}</CTableDataCell>
                <CTableDataCell>{{ supply.unit || supply.inventory_item_data?.unit || '-' }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency(supply.unit_cost) }}</CTableDataCell>
                <CTableDataCell>{{ formatCurrency((supply.quantity || 0) * (supply.unit_cost || 0)) }}</CTableDataCell>
                <CTableDataCell class="text-end">
                  <CButton
                    color="danger"
                    size="sm"
                    variant="ghost"
                    @click="deleteSupply(supply)"
                    title="Eliminar"
                  >
                    <CIcon name="cil-trash" />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Images Section (edit mode only) -->
  <CRow v-if="isEditing">
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Imagenes</strong>
          <div class="d-flex gap-2">
            <CButton color="primary" size="sm" @click="triggerImageInput">
              <CIcon name="cil-cloud-upload" class="me-1" /> Subir Imagen
            </CButton>
            <CButton color="info" size="sm" @click="triggerCameraInput">
              <CIcon name="cil-camera" class="me-1" /> Tomar Foto
            </CButton>
          </div>
          <input
            ref="imageInput"
            type="file"
            accept="image/*"
            class="d-none"
            @change="handleImageSelect"
          />
          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="d-none"
            @change="handleImageSelect"
          />
        </CCardHeader>
        <CCardBody>
          <div v-if="images.length === 0" class="text-center text-muted py-4">
            No hay imagenes registradas
          </div>
          <div v-else class="d-flex gap-3 flex-wrap">
            <div
              v-for="image in images"
              :key="image.id"
              class="position-relative"
            >
              <img
                :src="image.image_url"
                class="img-thumbnail"
                style="width: 120px; height: 120px; object-fit: cover; cursor: pointer;"
                @click="openImageModal(image)"
              />
              <CButton
                color="danger"
                size="sm"
                class="position-absolute top-0 end-0 m-1"
                style="padding: 0.1rem 0.3rem;"
                @click.stop="deleteImage(image)"
              >
                <CIcon name="cil-x" />
              </CButton>
            </div>
          </div>
          <div v-if="uploadingImage" class="mt-3 text-center">
            <CSpinner size="sm" class="me-2" />
            Subiendo imagen...
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Supply Modal -->
  <CModal :visible="showSupplyModal" @close="showSupplyModal = false">
    <CModalHeader>
      <CModalTitle>Agregar Insumo</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="addSupply">
        <div class="mb-3">
          <CFormLabel>Item de Inventario *</CFormLabel>
          <CFormSelect v-model="supplyForm.inventory_item_id" required>
            <option value="">Seleccionar...</option>
            <option v-for="item in inventoryItems" :key="item.id" :value="item.id">
              {{ item.name }} (Disponible: {{ item.current_stock }} {{ item.unit || '' }})
            </option>
          </CFormSelect>
        </div>
        <div class="mb-3">
          <CFormLabel>Cantidad *</CFormLabel>
          <CFormInput
            type="number"
            v-model="supplyForm.quantity"
            min="0.01"
            step="0.01"
            required
          />
          <div v-if="selectedInventoryItem" class="small text-muted mt-1">
            Disponible: {{ selectedInventoryItem.current_stock }} {{ selectedInventoryItem.unit || '' }}
          </div>
        </div>
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showSupplyModal = false">
        Cancelar
      </CButton>
      <CButton color="primary" @click="addSupply" :disabled="savingSupply">
        {{ savingSupply ? 'Guardando...' : 'Agregar' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Image Preview Modal -->
  <CModal :visible="showImageModal" @close="showImageModal = false" size="xl">
    <CModalHeader>
      <CModalTitle>Imagen</CModalTitle>
    </CModalHeader>
    <CModalBody class="text-center p-4">
      <img v-if="selectedImage" :src="selectedImage.image_url" class="img-fluid rounded" style="max-height: 70vh;" />
    </CModalBody>
  </CModal>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CForm, CFormLabel, CFormInput, CFormTextarea, CFormSelect,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CBadge, CSpinner
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()

const isEditing = computed(() => route.params.id && route.params.id !== 'new')
const organizations = ref([])
const venues = ref([])
const zones = ref([])
const saving = ref(false)

const form = ref({
  organization_id: '',
  venue_id: '',
  zone_id: '',
  provider_id: '',
  priority: 'medium',
  maintenance_date: new Date().toISOString().split('T')[0],
  entry_time: '',
  exit_time: '',
  status: 'pending',
  cost: '',
  description: '',
  work_performed: '',
  pending_items: '',
  notes: ''
})

// Provider autocomplete
const providerSearch = ref('')
const providerSuggestions = ref([])
const showProviderSuggestions = ref(false)
const selectedProvider = ref(null)

// Supplies
const supplies = ref([])
const showSupplyModal = ref(false)
const savingSupply = ref(false)
const inventoryItems = ref([])
const supplyForm = ref({
  inventory_item_id: '',
  quantity: ''
})

// Images
const images = ref([])
const imageInput = ref(null)
const cameraInput = ref(null)
const uploadingImage = ref(false)
const showImageModal = ref(false)
const selectedImage = ref(null)

const filteredVenues = computed(() => {
  if (!form.value.organization_id) return venues.value
  return venues.value.filter(v => String(v.organization) === String(form.value.organization_id))
})

const lockedVenue = computed(() => {
  if (route.query.venue_id && !isEditing.value) {
    return venues.value.find(v => String(v.id) === String(route.query.venue_id))
  }
  return null
})

const lockedOrganization = computed(() => {
  if (lockedVenue.value && lockedVenue.value.organization) {
    return organizations.value.find(o => String(o.id) === String(lockedVenue.value.organization))
  }
  return null
})

const selectedInventoryItem = computed(() => {
  if (!supplyForm.value.inventory_item_id) return null
  return inventoryItems.value.find(i => String(i.id) === String(supplyForm.value.inventory_item_id))
})

watch(() => form.value.venue_id, (newVenueId) => {
  form.value.zone_id = ''
  if (newVenueId) {
    loadZones()
    loadInventoryItems()
    if (!lockedVenue.value) {
      const venue = venues.value.find(v => String(v.id) === String(newVenueId))
      if (venue && venue.organization && !form.value.organization_id) {
        form.value.organization_id = venue.organization
      }
    }
  } else {
    zones.value = []
    inventoryItems.value = []
  }
})

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const goBack = () => {
  router.push('/business/maintenance/logs')
}

// Provider autocomplete functions
const searchProviders = async () => {
  if (!providerSearch.value || providerSearch.value.length < 2) {
    providerSuggestions.value = []
    return
  }

  try {
    const params = new URLSearchParams({ search: providerSearch.value })
    if (form.value.organization_id) {
      params.append('organization_id', form.value.organization_id)
    }
    const response = await fetch(`/api/providers?${params}`, { credentials: 'include' })
    if (response.ok) {
      providerSuggestions.value = await response.json()
    }
  } catch (error) {
    console.error('Error searching providers:', error)
  }
}

const selectProvider = (provider) => {
  selectedProvider.value = provider
  form.value.provider_id = provider.id
  providerSearch.value = ''
  showProviderSuggestions.value = false
  providerSuggestions.value = []
}

const createAndSelectProvider = async () => {
  if (!providerSearch.value || providerSearch.value.length < 2) return

  try {
    const response = await fetch('/api/providers/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: providerSearch.value,
        organization_id: form.value.organization_id || null
      })
    })

    if (response.ok) {
      const provider = await response.json()
      selectProvider(provider)
    }
  } catch (error) {
    console.error('Error creating provider:', error)
  }
}

const clearProvider = () => {
  selectedProvider.value = null
  form.value.provider_id = ''
  providerSearch.value = ''
}

const hideProviderSuggestions = () => {
  setTimeout(() => {
    showProviderSuggestions.value = false
  }, 200)
}

// Data loading
const loadOrganizations = async () => {
  try {
    const response = await fetch('/api/organizations', { credentials: 'include' })
    if (response.ok) {
      organizations.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading organizations:', error)
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
  if (!form.value.venue_id) {
    zones.value = []
    return
  }
  try {
    const response = await fetch(`/api/maintenance-zones?venue_id=${form.value.venue_id}`, { credentials: 'include' })
    if (response.ok) {
      zones.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading zones:', error)
  }
}

const loadInventoryItems = async () => {
  if (!form.value.venue_id) {
    inventoryItems.value = []
    return
  }
  try {
    const response = await fetch(`/api/inventory?venue_id=${form.value.venue_id}&type=supply`, { credentials: 'include' })
    if (response.ok) {
      inventoryItems.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading inventory items:', error)
  }
}

const loadLog = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/maintenance-logs/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      const log = await response.json()
      form.value = {
        organization_id: log.organization_id || '',
        venue_id: log.venue_id || '',
        zone_id: log.zone_id || '',
        provider_id: log.provider_id || '',
        priority: log.priority || 'medium',
        maintenance_date: log.maintenance_date ? log.maintenance_date.split('T')[0] : '',
        entry_time: log.entry_time || '',
        exit_time: log.exit_time || '',
        status: log.status || 'pending',
        cost: log.cost || '',
        description: log.description || '',
        work_performed: log.work_performed || '',
        pending_items: log.pending_items || '',
        notes: log.notes || ''
      }
      if (log.provider_data) {
        selectedProvider.value = log.provider_data
      }
      if (log.supplies) {
        supplies.value = log.supplies
      }
      if (log.images) {
        images.value = log.images
      }
    }
  } catch (error) {
    console.error('Error loading maintenance log:', error)
  }
}

const loadSupplies = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/maintenance-logs/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      const log = await response.json()
      supplies.value = log.supplies || []
      images.value = log.images || []
    }
  } catch (error) {
    console.error('Error loading supplies:', error)
  }
}

// Supply management
const addSupply = async () => {
  if (!supplyForm.value.inventory_item_id || !supplyForm.value.quantity) return

  savingSupply.value = true
  try {
    const response = await fetch(`/api/maintenance-logs/${route.params.id}/supplies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(supplyForm.value)
    })

    if (response.ok) {
      showSupplyModal.value = false
      supplyForm.value = { inventory_item_id: '', quantity: '' }
      await loadSupplies()
    } else {
      const err = await response.json()
      alert(err.error || 'Error al agregar insumo')
    }
  } catch (error) {
    console.error('Error adding supply:', error)
  } finally {
    savingSupply.value = false
  }
}

const deleteSupply = async (supply) => {
  if (!confirm('Eliminar este insumo?')) return
  try {
    const response = await fetch(`/api/maintenance-supplies/${supply.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      await loadSupplies()
    }
  } catch (error) {
    console.error('Error deleting supply:', error)
  }
}

// Image management
const triggerImageInput = () => {
  imageInput.value?.click()
}

const triggerCameraInput = () => {
  cameraInput.value?.click()
}

const handleImageSelect = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  await uploadImage(file)
  e.target.value = ''
}

const uploadImage = async (file) => {
  if (!file.type.startsWith('image/')) {
    alert('Solo se permiten archivos de imagen')
    return
  }

  uploadingImage.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/maintenance-logs/${route.params.id}/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (response.ok) {
      await loadSupplies()
    } else {
      const err = await response.json()
      throw new Error(err.error || 'Error al subir imagen')
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    alert(error.message || 'Error al subir imagen')
  } finally {
    uploadingImage.value = false
  }
}

const deleteImage = async (image) => {
  if (!confirm('Eliminar esta imagen?')) return
  try {
    const response = await fetch(`/api/maintenance-images/${image.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      await loadSupplies()
    }
  } catch (error) {
    console.error('Error deleting image:', error)
  }
}

const openImageModal = (image) => {
  selectedImage.value = image
  showImageModal.value = true
}

// Save
const saveLog = async () => {
  if (!form.value.description || !form.value.venue_id || !form.value.zone_id) {
    alert('Por favor complete los campos requeridos')
    return
  }

  saving.value = true
  try {
    const url = isEditing.value
      ? `/api/maintenance-logs/${route.params.id}`
      : '/api/maintenance-logs'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })

    if (response.ok) {
      router.push('/business/maintenance/logs')
    } else {
      const error = await response.json()
      alert(error.error || 'Error al guardar el registro')
    }
  } catch (error) {
    console.error('Error saving maintenance log:', error)
    alert('Error al guardar el registro')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadOrganizations(), loadVenues()])

  if (route.query.venue_id && !isEditing.value) {
    form.value.venue_id = route.query.venue_id
    const venue = venues.value.find(v => String(v.id) === String(route.query.venue_id))
    if (venue && venue.organization) {
      form.value.organization_id = venue.organization
    }
  }

  if (isEditing.value) {
    await loadLog()
  }
})
</script>

<style scoped>
.provider-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: var(--cui-body-bg);
  border: 1px solid var(--cui-border-color);
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.provider-suggestion {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.provider-suggestion:hover {
  background-color: var(--cui-light);
}

.provider-suggestion.provider-create {
  border-top: 1px solid var(--cui-border-color);
  color: var(--cui-primary);
  font-weight: 500;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
