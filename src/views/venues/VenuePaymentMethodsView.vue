<template>
  <CRow>
    <CCol :xs="12" :lg="10" :xl="8" class="mx-auto">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <div>
            <strong>Metodos de Pago</strong>
            <span v-if="venue" class="text-muted ms-2">- {{ venue.name }}</span>
          </div>
          <div class="d-flex gap-2">
            <CButton color="success" size="sm" @click="openForm()">+ Agregar Metodo</CButton>
            <RouterLink :to="`/business/venues/${$route.params.id}`">
              <CButton color="secondary" size="sm" variant="outline">Volver</CButton>
            </RouterLink>
          </div>
        </CCardHeader>
        <CCardBody>
          <CSpinner v-if="loading" color="primary" />
          <div v-else-if="methods.length === 0" class="text-center text-muted py-4">
            No hay metodos de pago configurados. Agrega uno para que tus clientes puedan pagar por WhatsApp.
          </div>
          <div v-else>
            <div
              v-for="(method, index) in methods"
              :key="method.id"
              class="payment-method-card"
              :class="{ 'opacity-50': !method.is_active }"
            >
              <div class="d-flex align-items-center gap-3">
                <div class="drag-handle text-muted" style="cursor: grab;">
                  <CIcon icon="cil-menu" />
                </div>
                <div v-if="method.qr_image_url" class="qr-thumb">
                  <img
                    :src="method.qr_image_url"
                    alt="QR"
                    class="img-thumbnail"
                    style="width: 50px; height: 50px; object-fit: cover; cursor: pointer;"
                    @click="previewImage = method.qr_image_url"
                  />
                </div>
                <div class="flex-grow-1">
                  <div class="fw-semibold">
                    {{ method.label }}
                    <CBadge :color="method.is_active ? 'success' : 'secondary'" class="ms-1" size="sm">
                      {{ method.is_active ? 'Activo' : 'Inactivo' }}
                    </CBadge>
                  </div>
                  <small class="text-muted">
                    {{ getTypeLabel(method.method_type) }}
                    <span v-if="method.account_info"> | {{ method.account_info }}</span>
                    <span v-if="method.holder_name"> | {{ method.holder_name }}</span>
                  </small>
                </div>
                <div class="d-flex gap-1">
                  <CButton color="primary" size="sm" variant="ghost" @click="openForm(method)" title="Editar">
                    <CIcon icon="cil-pencil" />
                  </CButton>
                  <CButton color="danger" size="sm" variant="ghost" @click="deleteMethod(method)" title="Eliminar">
                    <CIcon icon="cil-trash" />
                  </CButton>
                </div>
              </div>
              <div v-if="method.instructions" class="mt-1 small text-muted ps-5">
                {{ method.instructions }}
              </div>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Form Modal -->
  <CModal :visible="showForm" @close="showForm = false" size="lg">
    <CModalHeader>
      <CModalTitle>{{ editingMethod ? 'Editar' : 'Agregar' }} Metodo de Pago</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CForm @submit.prevent="saveMethod">
        <div class="mb-3">
          <CFormLabel>Tipo</CFormLabel>
          <CFormSelect v-model="form.method_type">
            <option value="">Selecciona un tipo...</option>
            <option v-for="cat in catalog" :key="cat.type" :value="cat.type">
              {{ cat.label }}
            </option>
          </CFormSelect>
        </div>
        <div class="mb-3">
          <CFormLabel>Nombre Visible</CFormLabel>
          <CFormInput v-model="form.label" placeholder="Ej: Nequi, Bancolombia Ahorros" required />
        </div>
        <div class="mb-3">
          <CFormLabel>Numero / Cuenta / Llave</CFormLabel>
          <CFormInput v-model="form.account_info" placeholder="Ej: 300-123-4567, @casabaluna" />
        </div>
        <div class="mb-3">
          <CFormLabel>Titular de la Cuenta</CFormLabel>
          <CFormInput v-model="form.holder_name" placeholder="Ej: Juan Perez" />
        </div>
        <div class="mb-3">
          <CFormLabel>Instrucciones Adicionales</CFormLabel>
          <CFormTextarea v-model="form.instructions" rows="2" placeholder="Instrucciones para el cliente al pagar..." />
        </div>
        <div class="mb-3">
          <CFormLabel>Imagen QR</CFormLabel>
          <CFormInput type="file" accept="image/*" @change="onFileChange" />
          <div v-if="form.qr_image_url && !form.qr_file" class="mt-2">
            <img :src="form.qr_image_url" class="img-thumbnail" style="max-width: 150px;" />
            <CButton color="danger" size="sm" variant="ghost" class="ms-2" @click="form.qr_image_url = null">
              Quitar
            </CButton>
          </div>
          <div v-if="form.qr_file" class="mt-2 text-success small">
            Nuevo archivo seleccionado: {{ form.qr_file.name }}
          </div>
        </div>
        <CFormCheck
          v-model="form.is_active"
          label="Activo"
          class="mb-3"
        />
      </CForm>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showForm = false">Cancelar</CButton>
      <CButton color="primary" @click="saveMethod" :disabled="saving">
        <CSpinner v-if="saving" size="sm" class="me-1" />
        {{ editingMethod ? 'Actualizar' : 'Crear' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Image Preview Modal -->
  <CModal :visible="!!previewImage" @close="previewImage = null" size="lg" alignment="center">
    <CModalBody class="text-center p-0">
      <img v-if="previewImage" :src="previewImage" class="img-fluid" alt="QR" />
    </CModalBody>
  </CModal>

  <CToaster placement="top-end">
    <CToast v-if="toast.visible" :color="toast.color" class="text-white" :autohide="true" :delay="3000" @close="toast.visible = false">
      <CToastBody>{{ toast.message }}</CToastBody>
    </CToast>
  </CToaster>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton, CSpinner, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CForm, CFormLabel, CFormInput, CFormSelect, CFormTextarea, CFormCheck,
  CToaster, CToast, CToastBody
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { getVenueById } from '@/services/venueService'
import { useBreadcrumbStore } from '@/stores/breadcrumb.js'

const route = useRoute()
const breadcrumbStore = useBreadcrumbStore()
const venueId = route.params.id

const venue = ref(null)
const methods = ref([])
const catalog = ref([])
const loading = ref(true)
const saving = ref(false)
const showForm = ref(false)
const editingMethod = ref(null)
const previewImage = ref(null)

const form = ref({
  method_type: '',
  label: '',
  account_info: '',
  holder_name: '',
  instructions: '',
  qr_image_url: null,
  qr_file: null,
  is_active: true
})

const toast = ref({ visible: false, message: '', color: 'success' })
const showToast = (message, color = 'success') => {
  toast.value = { visible: true, message, color }
}

const getTypeLabel = (type) => {
  const found = catalog.value.find(c => c.type === type)
  return found?.label || type
}

const loadData = async () => {
  loading.value = true
  try {
    const [v, m, c] = await Promise.all([
      getVenueById(venueId),
      fetch(`/api/venues/${venueId}/payment-methods`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/venues/${venueId}/payment-methods/catalog`, { credentials: 'include' }).then(r => r.json())
    ])
    venue.value = v
    methods.value = m
    catalog.value = c
    if (v?.name) breadcrumbStore.setTitle(`Metodos de Pago - ${v.name}`)
  } catch (error) {
    console.error('Error loading data:', error)
    showToast('Error al cargar datos', 'danger')
  } finally {
    loading.value = false
  }
}

const openForm = (method = null) => {
  editingMethod.value = method
  if (method) {
    form.value = {
      method_type: method.method_type,
      label: method.label,
      account_info: method.account_info || '',
      holder_name: method.holder_name || '',
      instructions: method.instructions || '',
      qr_image_url: method.qr_image_url || null,
      qr_file: null,
      is_active: method.is_active
    }
  } else {
    form.value = {
      method_type: '',
      label: '',
      account_info: '',
      holder_name: '',
      instructions: '',
      qr_image_url: null,
      qr_file: null,
      is_active: true
    }
  }
  showForm.value = true
}

const onFileChange = (e) => {
  form.value.qr_file = e.target.files[0] || null
}

const saveMethod = async () => {
  if (!form.value.method_type || !form.value.label) {
    showToast('Tipo y nombre son requeridos', 'warning')
    return
  }
  saving.value = true
  try {
    const formData = new FormData()
    formData.append('method_type', form.value.method_type)
    formData.append('label', form.value.label)
    formData.append('account_info', form.value.account_info)
    formData.append('holder_name', form.value.holder_name)
    formData.append('instructions', form.value.instructions)
    formData.append('is_active', form.value.is_active)
    if (form.value.qr_file) {
      formData.append('qr_image', form.value.qr_file)
    } else if (form.value.qr_image_url) {
      formData.append('qr_image_url', form.value.qr_image_url)
    } else {
      formData.append('qr_image_url', '')
    }

    const url = editingMethod.value
      ? `/api/venues/${venueId}/payment-methods/${editingMethod.value.id}`
      : `/api/venues/${venueId}/payment-methods`
    const method = editingMethod.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      credentials: 'include',
      body: formData
    })

    if (response.ok) {
      showToast(editingMethod.value ? 'Metodo actualizado' : 'Metodo creado')
      showForm.value = false
      loadData()
    } else {
      const data = await response.json()
      showToast(data.error || 'Error al guardar', 'danger')
    }
  } catch (error) {
    showToast('Error al guardar', 'danger')
  } finally {
    saving.value = false
  }
}

const deleteMethod = async (method) => {
  if (!confirm(`Eliminar "${method.label}"?`)) return
  try {
    const response = await fetch(`/api/venues/${venueId}/payment-methods/${method.id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      showToast('Metodo eliminado')
      loadData()
    } else {
      showToast('Error al eliminar', 'danger')
    }
  } catch (error) {
    showToast('Error al eliminar', 'danger')
  }
}

onMounted(loadData)
</script>

<style scoped>
.payment-method-card {
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  transition: background-color 0.2s;
}
.payment-method-card:hover {
  background-color: #f8f9fa;
}
</style>
