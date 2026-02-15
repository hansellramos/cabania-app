<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Tu propiedad</h4>
      <p class="text-body-secondary mb-4">Registra los datos básicos de tu cabaña o propiedad</p>

      <CForm @submit.prevent="saveProperty">
        <div class="mb-3">
          <CFormLabel>Nombre de la propiedad *</CFormLabel>
          <CFormInput
            v-model="form.name"
            placeholder="Ej: Cabaña El Refugio"
            required
          />
        </div>

        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Tipo *</CFormLabel>
            <CFormSelect v-model="form.type" required>
              <option value="">Seleccionar...</option>
              <option value="cabin">Cabaña</option>
              <option value="farm">Finca</option>
              <option value="plot">Parcela</option>
              <option value="apartment">Apartamento</option>
              <option value="glamping">Glamping</option>
              <option value="house">Casa</option>
              <option value="other">Otro</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6">
            <CFormLabel>Capacidad (personas)</CFormLabel>
            <CFormInput
              v-model.number="form.max_capacity"
              type="number"
              min="1"
              placeholder="Ej: 10"
            />
          </CCol>
        </CRow>

        <div class="mb-3">
          <CFormLabel>Dirección / Ubicación</CFormLabel>
          <CFormInput
            v-model="form.address"
            placeholder="Ej: Vereda El Carmen, Carmen de Apicalá, Tolima"
          />
        </div>

        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Ciudad</CFormLabel>
            <CFormInput v-model="form.city" placeholder="Ej: Carmen de Apicalá" />
          </CCol>
          <CCol :md="6">
            <CFormLabel>Departamento</CFormLabel>
            <CFormInput v-model="form.department" placeholder="Ej: Tolima" />
          </CCol>
        </CRow>

        <div class="mb-3">
          <CFormLabel>WhatsApp de la propiedad</CFormLabel>
          <CFormInput
            v-model="form.whatsapp"
            placeholder="+573001234567"
          />
        </div>

        <!-- Photo upload -->
        <div class="mb-3">
          <CFormLabel>Fotos de la propiedad (hasta 3)</CFormLabel>
          <div class="photo-grid">
            <div
              v-for="(photo, index) in photos"
              :key="index"
              class="photo-item"
            >
              <img :src="photo" alt="Foto" />
              <button type="button" class="photo-remove" @click="removePhoto(index)">&times;</button>
            </div>
            <label v-if="photos.length < 3" class="photo-add">
              <input
                type="file"
                accept="image/*"
                hidden
                @change="handlePhotoUpload"
                :disabled="uploading"
              />
              <CSpinner v-if="uploading" size="sm" />
              <span v-else>+</span>
            </label>
          </div>
        </div>

        <CAlert v-if="error" color="danger" class="mb-3">{{ error }}</CAlert>

        <div class="d-flex justify-content-between">
          <CButton color="secondary" variant="ghost" @click="$emit('back')">
            Anterior
          </CButton>
          <CButton type="submit" color="primary" class="onboarding-btn" :disabled="submitting">
            <CSpinner v-if="submitting" size="sm" class="me-2" />
            Siguiente
          </CButton>
        </div>
      </CForm>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  savedData: { type: Object, default: null },
})

const emit = defineEmits(['completed', 'back'])

const form = ref({
  name: '',
  type: '',
  max_capacity: null,
  address: '',
  city: '',
  department: '',
  whatsapp: '',
})

const photos = ref([])
const uploading = ref(false)
const submitting = ref(false)
const error = ref('')

onMounted(() => {
  if (props.savedData) {
    if (props.savedData.form) Object.assign(form.value, props.savedData.form)
    if (props.savedData.photos) photos.value = [...props.savedData.photos]
  }
})

async function handlePhotoUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/uploads/receipt', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (response.ok) {
      const data = await response.json()
      photos.value.push(data.url)
    }
  } catch (e) {
    console.error('Upload error:', e)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

function removePhoto(index) {
  photos.value.splice(index, 1)
}

async function saveProperty() {
  if (!form.value.name) {
    error.value = 'El nombre es requerido'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    // Create venue
    const response = await fetch('/api/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.value.name,
        address: form.value.address,
        city: form.value.city,
        department: form.value.department,
        whatsapp: form.value.whatsapp ? parseFloat(form.value.whatsapp.replace(/\D/g, '')) : null,
      }),
    })
    const venue = await response.json()
    if (!response.ok) {
      error.value = venue.error || 'Error creando propiedad'
      return
    }

    // Upload venue images
    for (let i = 0; i < photos.value.length; i++) {
      await fetch(`/api/venues/${venue.id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          image_url: photos.value[i],
          is_cover: i === 0,
          sort_order: i,
        }),
      }).catch(() => {})
    }

    emit('completed', {
      venueId: venue.id,
      form: { ...form.value },
      photos: [...photos.value],
    })
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.onboarding-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
}

.card-title {
  color: #f1f5f9;
}

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  border-radius: 10px;
}

.photo-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.photo-item {
  width: 100px;
  height: 100px;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-add {
  width: 100px;
  height: 100px;
  border-radius: 10px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  font-size: 28px;
  transition: border-color 0.2s;
}

.photo-add:hover {
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
}
</style>
