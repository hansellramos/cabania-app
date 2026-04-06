<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Plantillas de Contrato</strong>
          <div class="d-flex gap-2">
            <CButton color="info" size="sm" variant="outline" @click="showImportModal = true">
              Importar desde PDF/Word
            </CButton>
            <CButton color="success" size="sm" @click="$router.push(`/business/venues/${venueId}/contract-templates/create`)">
              + Nueva Plantilla
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          <div v-if="loading" class="text-center py-4">
            <CSpinner />
          </div>
          <div v-else-if="templates.length === 0" class="text-muted text-center py-4">
            No hay plantillas de contrato. Crea una nueva o importa desde un PDF existente.
          </div>
          <CTable v-else hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Secciones</CTableHeaderCell>
                <CTableHeaderCell>Default</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="t in templates" :key="t.id">
                <CTableDataCell>{{ t.name }}</CTableDataCell>
                <CTableDataCell>{{ t.sections?.length || 0 }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="t.is_default ? 'success' : 'secondary'">{{ t.is_default ? 'Si' : 'No' }}</CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="t.is_active ? 'success' : 'danger'">{{ t.is_active ? 'Activa' : 'Inactiva' }}</CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CButton color="primary" size="sm" class="me-1" @click="editTemplate(t)">Editar</CButton>
                  <CButton color="info" size="sm" class="me-1" @click="previewTemplate(t)">Preview</CButton>
                  <CButton color="danger" size="sm" variant="outline" @click="deleteTemplate(t)">Eliminar</CButton>
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Import Modal -->
  <CModal :visible="showImportModal" @close="closeImportModal" size="xl" backdrop="static">
    <CModalHeader>
      <CModalTitle>Importar Plantilla desde PDF/Word</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <!-- Step 1: Upload -->
      <div v-if="importStep === 1">
        <p class="text-muted mb-3">Sube un contrato existente en PDF o Word. La IA lo analizara y lo convertira en una plantilla con secciones y placeholders automaticos.</p>
        <div
          class="upload-area border-2 border-dashed rounded p-5 text-center"
          :class="{ 'border-primary bg-primary bg-opacity-10': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
          @click="$refs.importFileInput?.click()"
          style="cursor: pointer;"
        >
          <div v-if="importFile">
            <CIcon name="cil-file" size="xl" class="mb-2 text-success" />
            <div class="fw-bold">{{ importFile.name }}</div>
            <div class="small text-muted">{{ (importFile.size / 1024).toFixed(1) }} KB</div>
          </div>
          <div v-else>
            <CIcon name="cil-cloud-upload" size="xl" class="mb-2 text-secondary" />
            <div>Arrastra un archivo PDF o Word aqui</div>
            <div class="small text-muted mt-1">o haz click para seleccionar</div>
          </div>
        </div>
        <input ref="importFileInput" type="file" accept=".pdf,.doc,.docx" class="d-none" @change="handleFileSelect" />
      </div>

      <!-- Step 2: Analyzing -->
      <div v-if="importStep === 2" class="text-center py-5">
        <CSpinner class="mb-3" />
        <h5>Analizando contrato con IA...</h5>
        <p class="text-muted">Extrayendo texto y detectando secciones automaticamente</p>
      </div>

      <!-- Step 3: Preview & Edit -->
      <div v-if="importStep === 3 && importedTemplate">
        <div class="mb-3">
          <CFormLabel>Nombre de la plantilla</CFormLabel>
          <CFormInput v-model="importedTemplate.name" />
        </div>

        <h6 class="mb-3">{{ importedTemplate.sections.length }} secciones detectadas:</h6>

        <div v-for="(section, idx) in importedTemplate.sections" :key="idx" class="mb-3 border rounded">
          <div class="d-flex justify-content-between align-items-center p-3 bg-body-tertiary rounded-top">
            <CFormInput v-model="section.title" class="fw-bold border-0 bg-transparent p-0" style="font-size: 1.1rem;" />
            <CButton color="danger" size="sm" variant="ghost" @click="importedTemplate.sections.splice(idx, 1)">
              <CIcon name="cil-trash" />
            </CButton>
          </div>
          <div class="p-3">
            <CFormTextarea v-model="section.content" rows="6" style="font-family: monospace; font-size: 0.85rem;" />
          </div>
        </div>

        <CButton color="secondary" size="sm" variant="outline" @click="importedTemplate.sections.push({ title: 'Nueva Seccion', content: '', sort_order: importedTemplate.sections.length + 1 })">
          + Agregar seccion
        </CButton>
      </div>

      <!-- Error -->
      <div v-if="importError" class="mt-3">
        <CAlert color="danger">{{ importError }}</CAlert>
      </div>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="closeImportModal">Cancelar</CButton>
      <CButton v-if="importStep === 1" color="primary" :disabled="!importFile" @click="analyzeFile">
        Analizar con IA
      </CButton>
      <CButton v-if="importStep === 3" color="success" :disabled="savingImport" @click="saveImportedTemplate">
        {{ savingImport ? 'Guardando...' : 'Guardar como Plantilla' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Preview Modal -->
  <CModal :visible="showPreviewModal" @close="showPreviewModal = false" size="lg">
    <CModalHeader>
      <CModalTitle>Preview: {{ previewData?.name }}</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <div v-for="(section, idx) in (previewData?.sections || [])" :key="idx" class="mb-4">
        <h5 class="border-bottom pb-2">{{ section.title }}</h5>
        <div class="section-content" v-html="renderMarkdown(section.content)"></div>
      </div>
    </CModalBody>
  </CModal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const venueId = route.params.venueId

const templates = ref([])
const loading = ref(true)

// Import state
const showImportModal = ref(false)
const importStep = ref(1)
const importFile = ref(null)
const importedTemplate = ref(null)
const importError = ref('')
const savingImport = ref(false)
const dragOver = ref(false)

// Preview state
const showPreviewModal = ref(false)
const previewData = ref(null)

async function loadTemplates() {
  loading.value = true
  try {
    const res = await fetch(`/api/venues/${venueId}/contract-templates`, { credentials: 'include' })
    if (res.ok) templates.value = await res.json()
  } catch (e) {
    console.error('Error loading templates:', e)
  } finally {
    loading.value = false
  }
}

function handleFileSelect(e) {
  importFile.value = e.target.files?.[0] || null
}

function handleDrop(e) {
  dragOver.value = false
  importFile.value = e.dataTransfer?.files?.[0] || null
}

async function analyzeFile() {
  if (!importFile.value) return
  importStep.value = 2
  importError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', importFile.value)

    const res = await fetch('/api/contract-templates/import', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al analizar')

    importedTemplate.value = data.template
    importStep.value = 3
  } catch (e) {
    importError.value = e.message
    importStep.value = 1
  }
}

async function saveImportedTemplate() {
  if (!importedTemplate.value) return
  savingImport.value = true

  try {
    const res = await fetch('/api/contract-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        venue_id: venueId,
        name: importedTemplate.value.name,
        is_default: templates.value.length === 0,
        sections: importedTemplate.value.sections,
      }),
    })

    if (res.ok) {
      closeImportModal()
      await loadTemplates()
    }
  } catch (e) {
    importError.value = e.message
  } finally {
    savingImport.value = false
  }
}

function closeImportModal() {
  showImportModal.value = false
  importStep.value = 1
  importFile.value = null
  importedTemplate.value = null
  importError.value = ''
}

function editTemplate(t) {
  router.push(`/business/venues/${venueId}/contract-templates/${t.id}/edit`)
}

function previewTemplate(t) {
  previewData.value = t
  showPreviewModal.value = true
}

async function deleteTemplate(t) {
  if (!confirm(`Eliminar plantilla "${t.name}"?`)) return
  try {
    await fetch(`/api/contract-templates/${t.id}`, { method: 'DELETE', credentials: 'include' })
    await loadTemplates()
  } catch (e) {
    alert(e.message)
  }
}

function renderMarkdown(content) {
  if (!content) return ''
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

onMounted(() => loadTemplates())
</script>

<style scoped>
.upload-area {
  border: 2px dashed #ccc;
  transition: all 0.3s;
}
.upload-area:hover {
  border-color: #321fdb;
}
.section-content {
  line-height: 1.8;
}
</style>
