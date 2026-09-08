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
              <CFormLabel>Plan asociado</CFormLabel>
              <CFormSelect v-model="form.plan_id">
                <option :value="null">— General / por defecto (sin plan específico) —</option>
                <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
              </CFormSelect>
              <div class="form-text">
                Si la asocias a un plan, los contratos de reservas con ese plan usarán esta plantilla automáticamente.
              </div>
            </div>

            <div class="mb-3">
              <CFormCheck v-model="form.is_default" label="Plantilla por defecto del venue (fallback cuando el plan no tiene plantilla)" />
            </div>

            <hr />

            <!-- AI Assistant -->
            <div class="mb-3 p-3 border rounded bg-body-tertiary">
              <div class="d-flex align-items-center gap-2 mb-2">
                <CIcon name="cil-bolt" class="text-warning" />
                <strong>Asistente IA</strong>
              </div>
              <div class="d-flex gap-2">
                <CFormInput
                  v-model="aiPrompt"
                  placeholder="Ej: Genera basándote en la plantilla 'Contrato Pasadía con Comida', Agrega sección de mascotas, Separa las políticas por categorías..."
                  @keyup.enter="generateWithAI"
                />
                <CButton color="warning" :disabled="!aiPrompt || aiGenerating" @click="generateWithAI" style="white-space: nowrap;">
                  {{ aiGenerating ? 'Generando...' : 'Generar' }}
                </CButton>
              </div>
              <div v-if="aiGenerating" class="mt-2 small text-muted d-flex align-items-center">
                <CSpinner size="sm" class="me-2" />
                <span>{{ aiStatus || 'Analizando con IA…' }}</span>
              </div>
              <div v-if="aiError" class="mt-2 text-danger small">{{ aiError }}</div>

              <!-- Preview de cambios propuestos por la IA -->
              <div v-if="aiPreview" class="mt-3 border rounded bg-body">
                <div class="p-2 border-bottom d-flex justify-content-between align-items-center">
                  <strong class="small">Vista previa de los cambios propuestos</strong>
                  <div class="d-flex gap-2">
                    <CButton color="success" size="sm" @click="applyAiPreview">Aplicar cambios</CButton>
                    <CButton color="secondary" size="sm" variant="outline" @click="discardAiPreview">Descartar</CButton>
                  </div>
                </div>
                <div v-if="aiPreview.summary" class="p-2 border-bottom small ai-preview-summary" v-html="renderMarkdown(aiPreview.summary)"></div>
                <div class="p-2">
                  <div v-for="(s, i) in aiPreview.sections" :key="i" class="mb-2">
                    <div class="fw-bold small">#{{ i + 1 }} · {{ s.title }}</div>
                    <div class="small text-body-secondary ai-preview-content" v-html="renderMarkdown(s.content)"></div>
                  </div>
                </div>
              </div>
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

            <!-- Formato / sintaxis -->
            <div class="small text-muted mb-3">
              <CIcon name="cil-lightbulb" size="sm" class="me-1" />
              Formato: <code>**negrita**</code>, <code>*itálica*</code>.
              Listas numeradas: empieza cada línea con <code>1.</code> (se renumeran solas, puedes reordenar sin renumerar).
              Viñetas: empieza con <code>- </code>. Deja una línea en blanco para cerrar una lista.
            </div>

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
                <CFormCheck
                  v-model="section.print_hidden"
                  class="mt-2"
                  :label="'Ocultar esta sección en la versión de impresión / PDF'"
                />
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
import { renderMarkdown } from '@/utils/contractMarkdown'

const route = useRoute()
const router = useRouter()
const venueId = route.params.venueId
const templateId = route.params.templateId
const isEdit = computed(() => !!templateId)

const loading = ref(false)
const saving = ref(false)
const showPlaceholders = ref(false)
const placeholders = ref([])
const aiPrompt = ref('')
const aiGenerating = ref(false)
const aiError = ref('')
const aiPreview = ref(null)
const aiStatus = ref('')

const plans = ref([])

const form = ref({
  name: '',
  plan_id: null,
  is_default: false,
  sections: [{ title: '', content: '', sort_order: 0, print_hidden: false }],
})

const groupedPlaceholders = computed(() => {
  const groups = {}
  placeholders.value.forEach(p => {
    if (!groups[p.category]) groups[p.category] = []
    groups[p.category].push(p)
  })
  return groups
})

async function loadPlans() {
  try {
    const res = await fetch(`/api/venue-plans?venue_id=${venueId}`, { credentials: 'include' })
    if (res.ok) plans.value = await res.json()
  } catch (e) {
    console.error(e)
  }
}

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
        plan_id: data.plan_id ?? null,
        is_default: data.is_default,
        sections: data.sections.map(s => ({ title: s.title, content: s.content, sort_order: s.sort_order, print_hidden: s.print_hidden ?? false })),
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function addSection() {
  form.value.sections.push({ title: '', content: '', sort_order: form.value.sections.length, print_hidden: false })
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

function parseSSEChunk(chunk) {
  const lines = chunk.split('\n')
  let event = 'message'
  let data = ''
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try { return { event, data: JSON.parse(data) } } catch { return null }
}

async function generateWithAI() {
  if (!aiPrompt.value) return
  aiGenerating.value = true
  aiError.value = ''
  aiPreview.value = null
  aiStatus.value = 'Analizando tu solicitud…'

  try {
    const currentSections = form.value.sections.length > 0 && form.value.sections[0].title
      ? form.value.sections.map(s => ({ title: s.title, content: s.content }))
      : null

    const res = await fetch('/api/contract-templates/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        prompt: aiPrompt.value,
        current_sections: currentSections,
        venue_id: venueId,
        template_id: templateId || null,
      }),
    })

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Error al generar')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finished = false
    while (!finished) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop()
      for (const chunk of chunks) {
        const ev = parseSSEChunk(chunk)
        if (!ev) continue
        if (ev.event === 'status') {
          aiStatus.value = ev.data.label
        } else if (ev.event === 'done') {
          const tpl = ev.data.template
          if (tpl) {
            aiPreview.value = {
              name: tpl.name,
              summary: ev.data.summary || tpl.summary || '',
              sections: tpl.sections.map((s, i) => ({
                title: s.title,
                content: s.content,
                sort_order: i,
                print_hidden: s.print_hidden ?? false,
              })),
            }
          }
          finished = true
        } else if (ev.event === 'error') {
          throw new Error(ev.data.error || 'Error al generar')
        }
      }
    }
  } catch (e) {
    aiError.value = e.message
  } finally {
    aiGenerating.value = false
    aiStatus.value = ''
  }
}

function applyAiPreview() {
  if (!aiPreview.value) return
  if (!form.value.name && aiPreview.value.name) {
    form.value.name = aiPreview.value.name
  }
  form.value.sections = aiPreview.value.sections.map((s, i) => ({ ...s, sort_order: i }))
  aiPreview.value = null
  aiPrompt.value = ''
}

function discardAiPreview() {
  aiPreview.value = null
}

async function save() {
  saving.value = true
  try {
    const body = {
      venue_id: venueId,
      plan_id: form.value.plan_id || null,
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
  loadPlans()
  loadPlaceholders()
  loadTemplate()
})
</script>

<style scoped>
.ai-preview-content :deep(ol),
.ai-preview-content :deep(ul) {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
}
.ai-preview-content :deep(ol) { list-style: decimal; }
.ai-preview-content :deep(ul) { list-style: disc; }
.ai-preview-summary :deep(ul) { margin: 0; padding-left: 1.1rem; }
</style>
