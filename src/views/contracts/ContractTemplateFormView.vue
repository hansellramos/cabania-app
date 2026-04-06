<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>{{ isEdit ? 'Editar' : 'Nueva' }} Plantilla de Contrato</strong>
          <CButton color="secondary" size="sm" variant="outline" @click="$router.back()">Volver</CButton>
        </CCardHeader>
        <CCardBody>
          <div v-if="loading" class="text-center py-4"><CSpinner /></div>
          <form v-else @submit.prevent="save">
            <div class="mb-3">
              <CFormLabel>Nombre de la plantilla *</CFormLabel>
              <CFormInput v-model="form.name" required placeholder="Ej: Contrato Pasadia" />
            </div>

            <div class="mb-3">
              <CFormCheck v-model="form.is_default" label="Plantilla por defecto para este venue" />
            </div>

            <hr />

            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0">Secciones ({{ form.sections.length }})</h5>
              <div class="d-flex gap-2">
                <CButton color="info" size="sm" variant="outline" @click="showPlaceholders = !showPlaceholders">
                  {{ showPlaceholders ? 'Ocultar' : 'Ver' }} Placeholders
                </CButton>
                <CButton color="success" size="sm" @click="addSection">+ Seccion</CButton>
              </div>
            </div>

            <!-- Placeholders reference -->
            <CCollapse :visible="showPlaceholders">
              <CCard class="mb-3 border-info">
                <CCardBody class="py-2">
                  <div class="row">
                    <div v-for="(group, cat) in groupedPlaceholders" :key="cat" class="col-md-4 col-sm-6 mb-2">
                      <strong class="small">{{ cat }}</strong>
                      <div v-for="p in group" :key="p.key" class="small">
                        <code class="text-primary cursor-pointer" @click="copyPlaceholder(p.key)" v-text="placeholderTag(p.key)"></code>
                        <span class="text-muted ms-1">{{ p.label }}</span>
                      </div>
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            </CCollapse>

            <!-- Sections -->
            <div v-for="(section, idx) in form.sections" :key="idx" class="mb-3 border rounded">
              <div class="d-flex justify-content-between align-items-center p-3 bg-body-tertiary rounded-top">
                <div class="d-flex align-items-center gap-2 flex-grow-1">
                  <span class="text-muted small">#{{ idx + 1 }}</span>
                  <CFormInput v-model="section.title" placeholder="Titulo de la seccion" class="fw-bold border-0 bg-transparent p-0" style="font-size: 1.05rem;" />
                </div>
                <div class="d-flex gap-1">
                  <CButton v-if="idx > 0" color="secondary" size="sm" variant="ghost" @click="moveSection(idx, -1)">&#9650;</CButton>
                  <CButton v-if="idx < form.sections.length - 1" color="secondary" size="sm" variant="ghost" @click="moveSection(idx, 1)">&#9660;</CButton>
                  <CButton color="danger" size="sm" variant="ghost" @click="form.sections.splice(idx, 1)">
                    <CIcon name="cil-trash" />
                  </CButton>
                </div>
              </div>
              <div class="p-3">
                <CFormTextarea v-model="section.content" rows="6" placeholder="Contenido con {{placeholders}}..." style="font-family: monospace; font-size: 0.85rem;" />
              </div>
            </div>

            <div class="d-flex gap-2 mt-4">
              <CButton type="submit" color="primary" :disabled="saving">
                {{ saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear') }}
              </CButton>
              <CButton color="secondary" variant="outline" @click="$router.back()">Cancelar</CButton>
            </div>
          </form>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const venueId = route.params.venueId
const templateId = route.params.templateId
const isEdit = computed(() => !!templateId)

const loading = ref(false)
const saving = ref(false)
const showPlaceholders = ref(false)
const placeholders = ref([])

const form = ref({
  name: '',
  is_default: false,
  sections: [{ title: '', content: '', sort_order: 0 }],
})

const groupedPlaceholders = computed(() => {
  const groups = {}
  placeholders.value.forEach(p => {
    if (!groups[p.category]) groups[p.category] = []
    groups[p.category].push(p)
  })
  return groups
})

async function loadPlaceholders() {
  try {
    const res = await fetch('/api/contract-placeholders', { credentials: 'include' })
    if (res.ok) placeholders.value = await res.json()
  } catch (e) {
    console.error(e)
  }
}

async function loadTemplate() {
  if (!templateId) return
  loading.value = true
  try {
    const res = await fetch(`/api/contract-templates/${templateId}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      form.value = {
        name: data.name,
        is_default: data.is_default,
        sections: data.sections.map(s => ({ title: s.title, content: s.content, sort_order: s.sort_order })),
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function addSection() {
  form.value.sections.push({ title: '', content: '', sort_order: form.value.sections.length })
}

function moveSection(idx, dir) {
  const arr = form.value.sections
  const target = idx + dir
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

function placeholderTag(key) {
  return `{{${key}}}`
}

function copyPlaceholder(key) {
  navigator.clipboard.writeText(`{{${key}}}`)
}

async function save() {
  saving.value = true
  try {
    const body = {
      venue_id: venueId,
      name: form.value.name,
      is_default: form.value.is_default,
      sections: form.value.sections.map((s, i) => ({ ...s, sort_order: i })),
    }

    const url = isEdit.value ? `/api/contract-templates/${templateId}` : '/api/contract-templates'
    const method = isEdit.value ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push(`/business/venues/${venueId}/contract-templates`)
    }
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadPlaceholders()
  loadTemplate()
})
</script>
