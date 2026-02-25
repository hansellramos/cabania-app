<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Crea tu primer plan</h4>
      <p class="text-body-secondary mb-4">Define un plan de alojamiento para tus huespedes</p>

      <CForm @submit.prevent="savePlan">
        <div class="mb-3" style="position: relative">
          <CFormLabel>Nombre del plan *</CFormLabel>
          <CFormInput
            v-model="form.name"
            placeholder="Ej: Plan Fin de Semana"
            required
            @focus="focusedField = 'name'"
            @blur="onBlur"
          />
          <AiFieldSuggestions
            :visible="focusedField === 'name'"
            :suggestions="suggestions?.name"
            @select="(val) => { form.name = val; focusedField = null }"
          />
        </div>

        <CRow class="mb-3">
          <CCol :md="6">
            <CFormLabel>Tipo de plan *</CFormLabel>
            <CFormSelect v-model="form.plan_type" required>
              <option value="">Seleccionar...</option>
              <option value="day">Pasadia</option>
              <option value="overnight">Noche</option>
              <option value="weekend">Fin de semana</option>
              <option value="week">Semana</option>
              <option value="custom">Personalizado</option>
            </CFormSelect>
          </CCol>
          <CCol :md="6" style="position: relative">
            <CFormLabel>Capacidad maxima</CFormLabel>
            <CFormInput
              v-model.number="form.max_capacity"
              type="number"
              min="1"
              placeholder="Ej: 10"
              @focus="focusedField = 'max_capacity'"
              @blur="onBlur"
            />
            <AiFieldSuggestions
              :visible="focusedField === 'max_capacity'"
              :suggestions="suggestions?.max_capacity"
              @select="(val) => { form.max_capacity = val; focusedField = null }"
            />
          </CCol>
        </CRow>

        <CRow class="mb-3">
          <CCol :md="6" style="position: relative">
            <CFormLabel>Precio por adulto *</CFormLabel>
            <CFormInput
              v-model.number="form.adult_price"
              type="number"
              min="0"
              placeholder="Ej: 80000"
              required
              @focus="focusedField = 'adult_price'"
              @blur="onBlur"
            />
            <AiFieldSuggestions
              :visible="focusedField === 'adult_price'"
              :suggestions="suggestions?.adult_price"
              @select="(val) => { form.adult_price = val; focusedField = null }"
            />
          </CCol>
          <CCol :md="6" style="position: relative">
            <CFormLabel>Precio por nino</CFormLabel>
            <CFormInput
              v-model.number="form.child_price"
              type="number"
              min="0"
              placeholder="Ej: 50000"
              @focus="focusedField = 'child_price'"
              @blur="onBlur"
            />
            <AiFieldSuggestions
              :visible="focusedField === 'child_price'"
              :suggestions="suggestions?.child_price"
              @select="(val) => { form.child_price = val; focusedField = null }"
            />
          </CCol>
        </CRow>

        <CRow class="mb-3">
          <CCol :md="6" style="position: relative">
            <CFormLabel>Hora check-in</CFormLabel>
            <CFormInput
              v-model="form.check_in_time"
              type="time"
              @focus="focusedField = 'check_in_time'"
              @blur="onBlur"
            />
            <AiFieldSuggestions
              :visible="focusedField === 'check_in_time'"
              :suggestions="suggestions?.check_in_time"
              @select="(val) => { form.check_in_time = val; focusedField = null }"
            />
          </CCol>
          <CCol :md="6" style="position: relative">
            <CFormLabel>Hora check-out</CFormLabel>
            <CFormInput
              v-model="form.check_out_time"
              type="time"
              @focus="focusedField = 'check_out_time'"
              @blur="onBlur"
            />
            <AiFieldSuggestions
              :visible="focusedField === 'check_out_time'"
              :suggestions="suggestions?.check_out_time"
              @select="(val) => { form.check_out_time = val; focusedField = null }"
            />
          </CCol>
        </CRow>

        <div class="mb-3">
          <CFormLabel>Descripcion</CFormLabel>
          <CFormTextarea
            v-model="form.description"
            rows="2"
            placeholder="Que incluye este plan?"
          />
        </div>

        <div class="mb-3 d-flex gap-3">
          <CFormCheck
            v-model="form.includes_food"
            label="Incluye alimentacion"
          />
          <CFormCheck
            v-model="form.includes_overnight"
            label="Incluye pernocta"
          />
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
import AiFieldSuggestions from '@/components/onboarding/AiFieldSuggestions.vue'

const props = defineProps({
  venueId: { type: String, required: true },
  savedData: { type: Object, default: null },
  suggestions: { type: Object, default: null },
})

const emit = defineEmits(['completed', 'back'])

const focusedField = ref(null)

function onBlur() {
  // Delay to allow mousedown on chip to fire first
  setTimeout(() => {
    focusedField.value = null
  }, 200)
}

const form = ref({
  name: '',
  plan_type: '',
  max_capacity: null,
  adult_price: null,
  child_price: 0,
  check_in_time: '',
  check_out_time: '',
  description: '',
  includes_food: false,
  includes_overnight: false,
})

const submitting = ref(false)
const error = ref('')

onMounted(() => {
  if (props.savedData?.form) {
    Object.assign(form.value, props.savedData.form)
  }
})

async function savePlan() {
  if (!form.value.name || !form.value.plan_type || !form.value.adult_price) {
    error.value = 'Nombre, tipo y precio por adulto son requeridos'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const response = await fetch(`/api/venues/${props.venueId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...form.value,
        venue_id: props.venueId,
        child_price: form.value.child_price || 0,
        min_guests: 1,
      }),
    })
    const plan = await response.json()
    if (!response.ok) {
      error.value = plan.error || 'Error creando plan'
      return
    }

    emit('completed', { planId: plan.id, form: { ...form.value } })
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
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

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  border-radius: 10px;
}
</style>
