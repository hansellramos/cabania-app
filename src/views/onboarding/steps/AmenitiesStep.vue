<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Amenidades</h4>
      <p class="text-body-secondary mb-4">Selecciona las amenidades que ofrece tu propiedad</p>

      <CSpinner v-if="loadingAmenities" />

      <template v-else>
        <div v-for="(items, category) in groupedAmenities" :key="category" class="mb-4">
          <h6 class="amenity-category">{{ category || 'General' }}</h6>
          <div class="amenity-grid">
            <label
              v-for="amenity in items"
              :key="amenity.id"
              class="amenity-item"
              :class="{ selected: selectedIds.has(amenity.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedIds.has(amenity.id)"
                @change="toggleAmenity(amenity)"
                hidden
              />
              <CIcon v-if="amenity.icon" :name="amenity.icon" class="me-1" />
              <span>{{ amenity.name }}</span>
            </label>
          </div>

          <!-- Detail forms for selected amenities -->
          <div
            v-for="amenity in items.filter(a => selectedIds.has(a.id))"
            :key="'detail-' + amenity.id"
            class="amenity-detail mt-2"
          >
            <div class="detail-label">{{ amenity.name }} — detalle</div>
            <CFormInput
              v-model="details[amenity.id]"
              :placeholder="getDetailPlaceholder(amenity)"
              size="sm"
            />
          </div>
        </div>

        <CAlert v-if="error" color="danger" class="mb-3">{{ error }}</CAlert>

        <div class="d-flex justify-content-between mt-4">
          <CButton color="secondary" variant="ghost" @click="$emit('back')">
            Anterior
          </CButton>
          <CButton color="primary" class="onboarding-btn" :disabled="submitting" @click="saveAmenities">
            <CSpinner v-if="submitting" size="sm" class="me-2" />
            Siguiente
          </CButton>
        </div>
      </template>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const props = defineProps({
  venueId: { type: String, required: true },
  savedData: { type: Object, default: null },
})

const emit = defineEmits(['completed', 'back'])

const amenities = ref([])
const selectedIds = reactive(new Set())
const details = reactive({})
const loadingAmenities = ref(true)
const submitting = ref(false)
const error = ref('')

const groupedAmenities = computed(() => {
  const groups = {}
  for (const a of amenities.value) {
    const cat = a.category || 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(a)
  }
  return groups
})

function getDetailPlaceholder(amenity) {
  const name = amenity.name.toLowerCase()
  if (name.includes('piscina')) return 'Ej: Grande, climatizada'
  if (name.includes('kiosco') || name.includes('quiosco')) return 'Ej: Con BBQ, 20 personas'
  if (name.includes('jacuzzi')) return 'Ej: 4 personas'
  if (name.includes('parqueadero') || name.includes('parking')) return 'Ej: 5 vehículos'
  if (name.includes('wifi')) return 'Ej: Incluido, 50 Mbps'
  return 'Detalles adicionales'
}

function toggleAmenity(amenity) {
  if (selectedIds.has(amenity.id)) {
    selectedIds.delete(amenity.id)
    delete details[amenity.id]
  } else {
    selectedIds.add(amenity.id)
  }
}

async function saveAmenities() {
  submitting.value = true
  error.value = ''
  try {
    const amenityList = [...selectedIds].map(id => ({
      amenity_id: id,
      notes: details[id] || null,
    }))

    await fetch(`/api/venues/${props.venueId}/amenities`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amenities: amenityList }),
    })

    emit('completed', {
      selectedIds: [...selectedIds],
      details: { ...details },
    })
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const response = await fetch('/api/onboarding/amenities', { credentials: 'include' })
    if (response.ok) amenities.value = await response.json()
  } catch (e) {
    console.error('Error loading amenities:', e)
  } finally {
    loadingAmenities.value = false
  }

  // Restore saved selections
  if (props.savedData) {
    if (props.savedData.selectedIds) {
      props.savedData.selectedIds.forEach(id => selectedIds.add(id))
    }
    if (props.savedData.details) {
      Object.assign(details, props.savedData.details)
    }
  }
})
</script>

<style scoped>
.onboarding-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

.card-title { color: #f1f5f9; }

.amenity-category {
  color: #94a3b8;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.amenity-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.amenity-item {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: #cbd5e1;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.amenity-item:hover {
  border-color: rgba(16, 185, 129, 0.3);
}

.amenity-item.selected {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
}

.amenity-detail {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.detail-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 4px;
}

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  border-radius: 10px;
}
</style>
