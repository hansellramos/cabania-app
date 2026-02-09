<template>
  <CRow>
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>{{ isEditing ? 'Editar Agente de Comisión' : 'Nuevo Agente de Comisión' }}</strong>
          <CButton color="secondary" size="sm" variant="outline" @click="goBack">
            Cancelar
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CForm @submit.prevent="saveAgent">
            <CRow class="mb-3">
              <CCol :md="6">
                <CFormLabel>Nombre *</CFormLabel>
                <CFormInput
                  v-model="form.name"
                  placeholder="Nombre del agente"
                  required
                />
              </CCol>
              <CCol :md="6">
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
            </CRow>
            <CRow class="mb-3">
              <CCol :md="6">
                <CFormLabel>Organización</CFormLabel>
                <CFormSelect v-model="form.organization_id">
                  <option value="">Seleccionar...</option>
                  <option v-for="org in organizations" :key="org.id" :value="org.id">
                    {{ org.name }}
                  </option>
                </CFormSelect>
              </CCol>
              <CCol :md="6">
                <CFormLabel>Sede</CFormLabel>
                <CFormSelect v-model="form.venue_id">
                  <option value="">Seleccionar...</option>
                  <option v-for="venue in filteredVenues" :key="venue.id" :value="venue.id">
                    {{ venue.name }}
                  </option>
                </CFormSelect>
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
            <CRow class="mb-3">
              <CCol :md="12">
                <CFormCheck
                  v-model="form.is_active"
                  :checked="form.is_active"
                  label="Activo"
                />
              </CCol>
            </CRow>

            <hr class="my-4" />

            <h5 class="mb-4">Reglas de Comisión</h5>

            <div v-for="planType in planTypes" :key="planType" class="mb-4">
              <h6 class="mb-3">{{ planTypeLabels[planType] }}</h6>
              <CTable v-if="getRulesForPlan(planType).length > 0" bordered small hover>
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Min Adultos</CTableHeaderCell>
                    <CTableHeaderCell>Max Adultos</CTableHeaderCell>
                    <CTableHeaderCell>% Comisión</CTableHeaderCell>
                    <CTableHeaderCell style="width: 60px;"></CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="(rule, idx) in getRulesForPlan(planType)" :key="idx">
                    <CTableDataCell>
                      <CFormInput
                        type="number"
                        v-model.number="rule.min_adults"
                        min="0"
                        placeholder="0"
                        size="sm"
                      />
                    </CTableDataCell>
                    <CTableDataCell>
                      <CFormInput
                        type="number"
                        v-model.number="rule.max_adults"
                        min="0"
                        placeholder="Ilimitado"
                        size="sm"
                      />
                    </CTableDataCell>
                    <CTableDataCell>
                      <CFormInput
                        type="number"
                        v-model.number="rule.rate_percent"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                        size="sm"
                      />
                    </CTableDataCell>
                    <CTableDataCell class="text-center">
                      <CButton
                        color="danger"
                        size="sm"
                        variant="ghost"
                        @click="removeRule(planType, idx)"
                      >
                        <CIcon name="cil-trash" />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
              <div v-else class="text-muted small mb-2">
                No hay niveles definidos para {{ planTypeLabels[planType] }}.
              </div>
              <div class="d-flex gap-2">
                <CButton color="primary" size="sm" variant="outline" @click="addRule(planType)">
                  <CIcon name="cil-plus" class="me-1" />
                  Agregar Nivel
                </CButton>
                <CButton color="info" size="sm" variant="outline" @click="loadTemplate(planType)">
                  <CIcon name="cil-clipboard" class="me-1" />
                  Cargar Plantilla
                </CButton>
              </div>
            </div>

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
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CForm, CFormLabel, CFormInput, CFormTextarea, CFormSelect, CFormCheck,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()

const isEditing = computed(() => !!route.params.id)
const organizations = ref([])
const venues = ref([])
const saving = ref(false)

const planTypes = ['pasadia', 'pasanoche', 'hospedaje']
const planTypeLabels = {
  pasadia: 'Pasadia',
  pasanoche: 'Pasanoche',
  hospedaje: 'Hospedaje'
}

const form = ref({
  name: '',
  provider_id: '',
  organization_id: '',
  venue_id: '',
  notes: '',
  is_active: true
})

const rules = ref([])

// --- Provider autocomplete ---
const providerSearch = ref('')
const providerSuggestions = ref([])
const showProviderSuggestions = ref(false)
const selectedProvider = ref(null)

const filteredVenues = computed(() => {
  if (!form.value.organization_id) return venues.value
  return venues.value.filter(v => String(v.organization) === String(form.value.organization_id))
})

const goBack = () => {
  router.push('/commissions')
}

// --- Provider methods (same pattern as ExpenseFormView) ---
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

// --- Rules management ---
const getRulesForPlan = (planType) => {
  return rules.value.filter(r => r.plan_type === planType)
}

const addRule = (planType) => {
  rules.value.push({
    plan_type: planType,
    min_adults: null,
    max_adults: null,
    rate_percent: null,
    sort_order: getRulesForPlan(planType).length + 1
  })
}

const removeRule = (planType, idx) => {
  const planRules = getRulesForPlan(planType)
  const ruleToRemove = planRules[idx]
  const globalIdx = rules.value.indexOf(ruleToRemove)
  if (globalIdx !== -1) {
    rules.value.splice(globalIdx, 1)
  }
}

const loadTemplate = (planType) => {
  // Remove existing rules for this plan type
  rules.value = rules.value.filter(r => r.plan_type !== planType)

  // Add default 3-tier template
  rules.value.push(
    { plan_type: planType, min_adults: 1, max_adults: 15, rate_percent: 10, sort_order: 1 },
    { plan_type: planType, min_adults: 16, max_adults: 25, rate_percent: 15, sort_order: 2 },
    { plan_type: planType, min_adults: 26, max_adults: null, rate_percent: 20, sort_order: 3 }
  )
}

// --- Data loading ---
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

const loadAgent = async () => {
  if (!isEditing.value) return

  try {
    const response = await fetch(`/api/commission-agents/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      const agent = await response.json()
      form.value = {
        name: agent.name || '',
        provider_id: agent.provider_id || '',
        organization_id: agent.organization_id || '',
        venue_id: agent.venue_id || '',
        notes: agent.notes || '',
        is_active: agent.is_active !== undefined ? agent.is_active : true
      }
      if (agent.provider) {
        selectedProvider.value = agent.provider
      }
      if (agent.rules && Array.isArray(agent.rules)) {
        rules.value = agent.rules.map(r => ({
          plan_type: r.plan_type,
          min_adults: r.min_adults,
          max_adults: r.max_adults,
          rate_percent: r.rate_percent,
          sort_order: r.sort_order
        }))
      }
    }
  } catch (error) {
    console.error('Error loading commission agent:', error)
  }
}

// --- Save ---
const saveAgent = async () => {
  if (!form.value.name) {
    alert('Por favor complete los campos requeridos')
    return
  }

  saving.value = true
  try {
    // Recalculate sort_order per plan_type before saving
    const sortedRules = []
    for (const planType of planTypes) {
      const planRules = rules.value.filter(r => r.plan_type === planType)
      planRules.forEach((r, i) => {
        sortedRules.push({
          plan_type: r.plan_type,
          min_adults: r.min_adults,
          max_adults: r.max_adults || null,
          rate_percent: r.rate_percent,
          sort_order: i + 1
        })
      })
    }

    const body = {
      ...form.value,
      provider_id: form.value.provider_id || null,
      organization_id: form.value.organization_id || null,
      venue_id: form.value.venue_id || null,
      rules: sortedRules
    }

    const url = isEditing.value
      ? `/api/commission-agents/${route.params.id}`
      : '/api/commission-agents'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    if (response.ok) {
      router.push('/commissions')
    } else {
      const error = await response.json()
      alert(error.error || 'Error al guardar el agente de comisión')
    }
  } catch (error) {
    console.error('Error saving commission agent:', error)
    alert('Error al guardar el agente de comisión')
  } finally {
    saving.value = false
  }
}

watch(() => form.value.organization_id, () => {
  if (!isEditing.value) {
    form.value.venue_id = ''
  }
})

onMounted(async () => {
  await Promise.all([loadOrganizations(), loadVenues()])
  await loadAgent()
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
