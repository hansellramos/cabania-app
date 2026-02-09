<template>
  <CRow>
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>{{ isEditing ? 'Editar Item de Inventario' : 'Nuevo Item de Inventario' }}</strong>
          <CButton color="secondary" size="sm" variant="outline" @click="goBack">
            Cancelar
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CForm @submit.prevent="saveItem">
            <CRow class="mb-3">
              <CCol :md="6">
                <CFormLabel>Tipo *</CFormLabel>
                <CFormSelect v-model="form.type" required>
                  <option value="">Seleccionar...</option>
                  <option value="supply">Insumo</option>
                  <option value="asset">Activo Fijo</option>
                </CFormSelect>
              </CCol>
            </CRow>

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
              <CCol :md="6">
                <CFormLabel>Categoria</CFormLabel>
                <CFormSelect v-model="form.category_id">
                  <option value="">Seleccionar...</option>
                  <option v-for="cat in filteredCategories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </CFormSelect>
              </CCol>
              <CCol :md="6">
                <CFormLabel>Nombre *</CFormLabel>
                <CFormInput v-model="form.name" required />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Descripcion</CFormLabel>
                <CFormTextarea v-model="form.description" rows="2" placeholder="Descripcion del item..." />
              </CCol>
            </CRow>

            <CRow class="mb-3">
              <CCol :md="4">
                <CFormLabel>Cantidad</CFormLabel>
                <CFormInput type="number" v-model="form.quantity" placeholder="0" />
              </CCol>
              <CCol :md="4">
                <CFormLabel>Unidad</CFormLabel>
                <CFormSelect v-model="form.unit">
                  <option value="">Seleccionar...</option>
                  <option value="unidad">Unidad</option>
                  <option value="litro">Litro</option>
                  <option value="kg">Kg</option>
                  <option value="galón">Galon</option>
                  <option value="bolsa">Bolsa</option>
                  <option value="metro">Metro</option>
                  <option value="caja">Caja</option>
                </CFormSelect>
              </CCol>
            </CRow>

            <!-- Supply-only fields -->
            <template v-if="form.type === 'supply'">
              <CRow class="mb-3">
                <CCol :md="4">
                  <CFormLabel>Stock Minimo</CFormLabel>
                  <CFormInput type="number" v-model="form.minimum_stock" placeholder="0" />
                </CCol>
                <CCol :md="4">
                  <CFormLabel>Costo Unitario</CFormLabel>
                  <CFormInput type="number" v-model="form.unit_cost" placeholder="0" />
                </CCol>
              </CRow>
            </template>

            <!-- Asset-only fields -->
            <template v-if="form.type === 'asset'">
              <CRow class="mb-3">
                <CCol :md="4">
                  <CFormLabel>Condicion</CFormLabel>
                  <CFormSelect v-model="form.condition">
                    <option value="">Seleccionar...</option>
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="malo">Malo</option>
                    <option value="dañado">Dañado</option>
                    <option value="fuera_de_servicio">Fuera de Servicio</option>
                  </CFormSelect>
                </CCol>
                <CCol :md="4">
                  <CFormLabel>Marca</CFormLabel>
                  <CFormInput v-model="form.brand" />
                </CCol>
                <CCol :md="4">
                  <CFormLabel>Modelo</CFormLabel>
                  <CFormInput v-model="form.model_name" />
                </CCol>
              </CRow>
              <CRow class="mb-3">
                <CCol :md="4">
                  <CFormLabel>Numero de Serie</CFormLabel>
                  <CFormInput v-model="form.serial_number" />
                </CCol>
                <CCol :md="4">
                  <CFormLabel>Fecha de Compra</CFormLabel>
                  <CFormInput type="date" v-model="form.purchase_date" />
                </CCol>
                <CCol :md="4">
                  <CFormLabel>Vencimiento Garantia</CFormLabel>
                  <CFormInput type="date" v-model="form.warranty_expiry" />
                </CCol>
              </CRow>
              <CRow class="mb-3">
                <CCol :md="12">
                  <CFormLabel>Notas de Ubicacion</CFormLabel>
                  <CFormTextarea v-model="form.location_notes" rows="2" placeholder="Donde se encuentra el activo..." />
                </CCol>
              </CRow>
            </template>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Notas</CFormLabel>
                <CFormTextarea v-model="form.notes" rows="2" placeholder="Notas adicionales..." />
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
          <div v-else class="d-flex flex-wrap gap-3">
            <div v-for="img in images" :key="img.id" class="position-relative">
              <img
                :src="img.image_url"
                class="img-thumbnail"
                style="max-height: 150px; max-width: 200px;"
              />
              <CButton
                color="danger"
                size="sm"
                class="position-absolute top-0 end-0 m-1"
                @click="deleteImage(img)"
              >
                <CIcon name="cil-x" />
              </CButton>
            </div>
          </div>
          <div v-if="uploadingImage" class="text-center text-muted py-2">
            Subiendo imagen...
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Movements Section (edit mode only) -->
  <CRow v-if="isEditing">
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Movimientos</strong>
          <div class="d-flex gap-2">
            <CButton color="warning" size="sm" @click="showUsageModal = true">
              <CIcon name="cil-minus" class="me-1" /> Registrar Uso
            </CButton>
            <CButton color="info" size="sm" @click="showAdjustModal = true">
              <CIcon name="cil-transfer" class="me-1" /> Ajustar Stock
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          <div v-if="movements.length === 0" class="text-center text-muted py-4">
            No hay movimientos registrados
          </div>
          <CTable v-else hover responsive small>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Fecha</CTableHeaderCell>
                <CTableHeaderCell>Tipo</CTableHeaderCell>
                <CTableHeaderCell>Cantidad</CTableHeaderCell>
                <CTableHeaderCell>Razon</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="movement in movements" :key="movement.id">
                <CTableDataCell>{{ formatDate(movement.created_at) }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="movementTypeColor(movement.type)">
                    {{ movementTypeLabel(movement.type) }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <span :class="movement.quantity_change > 0 ? 'text-success' : 'text-danger'">
                    {{ movement.quantity_change > 0 ? '+' : '' }}{{ movement.quantity_change }}
                  </span>
                </CTableDataCell>
                <CTableDataCell>{{ movement.reason || '-' }}</CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Usage Modal -->
  <CModal :visible="showUsageModal" @close="showUsageModal = false">
    <CModalHeader>
      <CModalTitle>Registrar Uso</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="recordUsage">
        <div class="mb-3">
          <CFormLabel>Cantidad *</CFormLabel>
          <CFormInput
            type="number"
            v-model="usageForm.quantity"
            min="1"
            required
            placeholder="Cantidad utilizada"
          />
        </div>
        <div class="mb-3">
          <CFormLabel>Razon</CFormLabel>
          <CFormTextarea v-model="usageForm.reason" rows="2" placeholder="Motivo del uso..." />
        </div>
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showUsageModal = false">
        Cancelar
      </CButton>
      <CButton color="warning" @click="recordUsage" :disabled="savingMovement">
        {{ savingMovement ? 'Registrando...' : 'Registrar Uso' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Adjust Stock Modal -->
  <CModal :visible="showAdjustModal" @close="showAdjustModal = false">
    <CModalHeader>
      <CModalTitle>Ajustar Stock</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="adjustStock">
        <div class="mb-3">
          <CFormLabel>Cambio de Cantidad *</CFormLabel>
          <CFormInput
            type="number"
            v-model="adjustForm.quantity_change"
            required
            placeholder="Ej: 5 o -3"
          />
          <div class="small text-muted mt-1">
            Use valores positivos para agregar y negativos para reducir
          </div>
        </div>
        <div class="mb-3">
          <CFormLabel>Razon</CFormLabel>
          <CFormTextarea v-model="adjustForm.reason" rows="2" placeholder="Motivo del ajuste..." />
        </div>
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showAdjustModal = false">
        Cancelar
      </CButton>
      <CButton color="info" @click="adjustStock" :disabled="savingMovement">
        {{ savingMovement ? 'Ajustando...' : 'Ajustar Stock' }}
      </CButton>
    </CModalFooter>
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
  CBadge
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()

const isEditing = computed(() => route.params.id && route.params.id !== 'new')
const organizations = ref([])
const venues = ref([])
const categories = ref([])
const images = ref([])
const movements = ref([])
const saving = ref(false)
const savingMovement = ref(false)
const uploadingImage = ref(false)
const imageInput = ref(null)
const cameraInput = ref(null)

const showUsageModal = ref(false)
const showAdjustModal = ref(false)

const form = ref({
  type: '',
  organization_id: '',
  venue_id: '',
  category_id: '',
  name: '',
  description: '',
  quantity: '',
  unit: '',
  notes: '',
  minimum_stock: '',
  unit_cost: '',
  condition: '',
  brand: '',
  model_name: '',
  serial_number: '',
  purchase_date: '',
  warranty_expiry: '',
  location_notes: ''
})

const usageForm = ref({
  quantity: '',
  reason: ''
})

const adjustForm = ref({
  quantity_change: '',
  reason: ''
})

const filteredVenues = computed(() => {
  if (!form.value.organization_id) return venues.value
  return venues.value.filter(v => String(v.organization) === String(form.value.organization_id))
})

const filteredCategories = computed(() => {
  if (!form.value.type) return categories.value
  return categories.value.filter(c => !c.type || c.type === form.value.type)
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

watch(() => form.value.venue_id, (newVenueId) => {
  if (newVenueId && !lockedVenue.value) {
    const venue = venues.value.find(v => String(v.id) === String(newVenueId))
    if (venue && venue.organization && !form.value.organization_id) {
      form.value.organization_id = venue.organization
    }
  }
})

const goBack = () => {
  router.push('/business/inventory')
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const movementTypeLabel = (type) => {
  const labels = {
    consumption_general: 'Consumo',
    adjustment: 'Ajuste',
    purchase: 'Compra',
    transfer: 'Transferencia',
    initial: 'Inicial'
  }
  return labels[type] || type
}

const movementTypeColor = (type) => {
  const colors = {
    consumption_general: 'warning',
    adjustment: 'info',
    purchase: 'success',
    transfer: 'primary',
    initial: 'secondary'
  }
  return colors[type] || 'secondary'
}

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

const loadItem = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/inventory/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      const item = await response.json()
      form.value = {
        type: item.type || '',
        organization_id: item.organization_id || '',
        venue_id: item.venue_id || '',
        category_id: item.category_id || '',
        name: item.name || '',
        description: item.description || '',
        quantity: item.quantity != null ? item.quantity : '',
        unit: item.unit || '',
        notes: item.notes || '',
        minimum_stock: item.minimum_stock != null ? item.minimum_stock : '',
        unit_cost: item.unit_cost != null ? item.unit_cost : '',
        condition: item.condition || '',
        brand: item.brand || '',
        model_name: item.model_name || '',
        serial_number: item.serial_number || '',
        purchase_date: item.purchase_date ? item.purchase_date.split('T')[0] : '',
        warranty_expiry: item.warranty_expiry ? item.warranty_expiry.split('T')[0] : '',
        location_notes: item.location_notes || ''
      }
    }
  } catch (error) {
    console.error('Error loading inventory item:', error)
  }
}

const loadMovements = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/inventory/${route.params.id}/movements`, { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      movements.value = Array.isArray(data) ? data.slice(0, 10) : []
    }
  } catch (error) {
    console.error('Error loading movements:', error)
  }
}

const loadImages = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/inventory/${route.params.id}/images`, { credentials: 'include' })
    if (response.ok) {
      images.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading images:', error)
  }
}

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
  if (!file.type.startsWith('image/')) return

  uploadingImage.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/inventory/${route.params.id}/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (response.ok) {
      await loadImages()
    }
  } catch (error) {
    console.error('Error uploading image:', error)
  } finally {
    uploadingImage.value = false
  }
}

const deleteImage = async (img) => {
  try {
    const response = await fetch(`/api/inventory-images/${img.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      await loadImages()
    }
  } catch (error) {
    console.error('Error deleting image:', error)
  }
}

const recordUsage = async () => {
  if (!usageForm.value.quantity) return

  savingMovement.value = true
  try {
    const response = await fetch(`/api/inventory/${route.params.id}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'consumption_general',
        quantity_change: -Math.abs(Number(usageForm.value.quantity)),
        reason: usageForm.value.reason
      })
    })

    if (response.ok) {
      showUsageModal.value = false
      usageForm.value = { quantity: '', reason: '' }
      await Promise.all([loadItem(), loadMovements()])
    }
  } catch (error) {
    console.error('Error recording usage:', error)
  } finally {
    savingMovement.value = false
  }
}

const adjustStock = async () => {
  if (!adjustForm.value.quantity_change) return

  savingMovement.value = true
  try {
    const response = await fetch(`/api/inventory/${route.params.id}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'adjustment',
        quantity_change: Number(adjustForm.value.quantity_change),
        reason: adjustForm.value.reason
      })
    })

    if (response.ok) {
      showAdjustModal.value = false
      adjustForm.value = { quantity_change: '', reason: '' }
      await Promise.all([loadItem(), loadMovements()])
    }
  } catch (error) {
    console.error('Error adjusting stock:', error)
  } finally {
    savingMovement.value = false
  }
}

const saveItem = async () => {
  if (!form.value.name || !form.value.type || !form.value.organization_id || !form.value.venue_id) {
    alert('Por favor complete los campos requeridos')
    return
  }

  saving.value = true
  try {
    const url = isEditing.value
      ? `/api/inventory/${route.params.id}`
      : '/api/inventory'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })

    if (response.ok) {
      router.push('/business/inventory')
    } else {
      const error = await response.json()
      alert(error.error || 'Error al guardar el item')
    }
  } catch (error) {
    console.error('Error saving inventory item:', error)
    alert('Error al guardar el item')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadOrganizations(), loadVenues(), loadCategories()])

  if (route.query.venue_id && !isEditing.value) {
    form.value.venue_id = route.query.venue_id
    const venue = venues.value.find(v => String(v.id) === String(route.query.venue_id))
    if (venue && venue.organization) {
      form.value.organization_id = venue.organization
    }
  }

  if (route.query.category_id && !isEditing.value) {
    form.value.category_id = route.query.category_id
  }

  if (isEditing.value) {
    await loadItem()
    loadMovements()
    loadImages()
  }
})
</script>

<style scoped>
.img-thumbnail {
  object-fit: cover;
}
</style>
