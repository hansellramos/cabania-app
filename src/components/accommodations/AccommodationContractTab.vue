<template>
  <div>
    <div v-if="loading" class="text-center py-4">
      <CSpinner color="primary" />
    </div>

    <div v-else-if="!contract" class="text-center py-5">
      <p class="text-muted mb-3">Este hospedaje aun no tiene un contrato generado.</p>
      <div v-if="activeTemplates.length" class="mb-3 mx-auto text-start" style="max-width: 380px;">
        <label class="small text-muted d-block mb-1">Plantilla a usar</label>
        <CFormSelect v-model="selectedTemplateId">
          <option v-for="t in activeTemplates" :key="t.id" :value="t.id">{{ templateLabel(t) }}</option>
        </CFormSelect>
        <div class="form-text">Se preseleccionó según el plan de la reserva. Puedes cambiarla.</div>
      </div>
      <div v-else class="text-warning small mb-3">Este venue no tiene plantillas de contrato activas.</div>
      <CButton color="primary" :disabled="creating || !activeTemplates.length" @click="createContract">
        <CIcon name="cil-file" class="me-1" />
        {{ creating ? 'Generando...' : 'Generar contrato' }}
      </CButton>
      <div v-if="createError" class="text-danger small mt-2">{{ createError }}</div>
    </div>

    <template v-else>
      <!-- Status + actions header -->
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <CBadge :color="statusColor" class="px-3 py-2">{{ statusLabel }}</CBadge>
          <span v-if="contract.accepted_at" class="ms-2 small text-muted">
            Firmado el {{ formatDateTime(contract.accepted_at) }}
          </span>
        </div>
        <div v-if="contract.status === 'draft'" class="d-flex gap-2 align-items-center">
          <CFormSelect v-if="activeTemplates.length" v-model="selectedTemplateId" size="sm" style="min-width: 200px;">
            <option v-for="t in activeTemplates" :key="t.id" :value="t.id">{{ templateLabel(t) }}</option>
          </CFormSelect>
          <CButton color="warning" variant="outline" size="sm" :disabled="regenerating" @click="regenerateContract" style="white-space: nowrap;">
            <CIcon name="cil-reload" class="me-1" />
            {{ regenerating ? 'Regenerando...' : 'Regenerar' }}
          </CButton>
        </div>
      </div>

      <!-- Share / access info (only while draft) -->
      <CCard v-if="contract.status === 'draft'" class="mb-3">
        <CCardBody>
          <h6 class="mb-3">Compartir con el cliente</h6>
          <CRow>
            <CCol :md="6">
              <div class="mb-2">
                <label class="small text-muted">Link publico</label>
                <div class="d-flex gap-2">
                  <CFormInput :value="publicUrl" readonly @click="$event.target.select()" />
                  <CButton color="secondary" variant="outline" @click="copyLink">
                    <CIcon name="cil-copy" />
                  </CButton>
                </div>
              </div>
              <div class="mb-2">
                <label class="small text-muted">Codigo de acceso</label>
                <div class="fs-4 fw-bold font-monospace">{{ contract.access_code }}</div>
              </div>
              <div class="d-flex gap-2 mt-3">
                <CButton color="success" @click="shareWhatsApp">
                  <CIcon name="cibWhatsapp" class="me-1" />
                  Compartir por WhatsApp
                </CButton>
              </div>
              <div v-if="copyMsg" class="small text-success mt-2">{{ copyMsg }}</div>
            </CCol>
            <CCol :md="6" class="text-center">
              <label class="small text-muted d-block mb-2">Codigo QR</label>
              <img
                v-if="qrDataUrl"
                :src="qrDataUrl"
                alt="QR code"
                style="max-width: 200px; width: 100%;"
              />
              <div v-else class="text-muted small">Generando...</div>
              <div class="mt-2">
                <CButton v-if="qrDataUrl" color="secondary" variant="outline" size="sm" @click="downloadQR">
                  <CIcon name="cil-cloud-download" class="me-1" />
                  Descargar QR
                </CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <!-- Signed details -->
      <CCard v-if="contract.status === 'signed'" class="mb-3 border-success">
        <CCardBody>
          <h6 class="mb-3">Datos de la firma</h6>
          <CRow>
            <CCol :md="6">
              <div class="mb-2">
                <strong>Fecha y hora:</strong> {{ formatDateTime(contract.accepted_at) }}
              </div>
              <div v-if="contract.accepted_ip" class="mb-2">
                <strong>IP:</strong> <span class="font-monospace">{{ contract.accepted_ip }}</span>
              </div>
              <div v-if="contract.accepted_user_agent" class="mb-2 small">
                <strong>Dispositivo:</strong> <span class="text-muted">{{ contract.accepted_user_agent }}</span>
              </div>
              <div v-if="contract.pdf_hash" class="mb-2">
                <strong>Hash SHA-256:</strong>
                <div class="font-monospace small text-break">{{ contract.pdf_hash }}</div>
              </div>
              <div v-if="contract.pdf_url" class="mt-3">
                <CButton color="primary" :href="contract.pdf_url" target="_blank">
                  <CIcon name="cil-cloud-download" class="me-1" />
                  Descargar PDF
                </CButton>
              </div>
            </CCol>
            <CCol :md="6">
              <div v-if="contract.signature_image_url" class="mb-3">
                <label class="small text-muted d-block">Firma</label>
                <img :src="contract.signature_image_url" alt="Firma" style="max-width: 100%; max-height: 120px; background: white; padding: 4px; border: 1px solid #ccc;" />
              </div>
              <div v-if="contract.signer_photo_sepia_url || contract.signer_photo_url">
                <label class="small text-muted d-block">Foto del firmante</label>
                <img
                  :src="contract.signer_photo_sepia_url || contract.signer_photo_url"
                  alt="Foto firmante"
                  style="max-width: 200px; max-height: 200px; border-radius: 8px;"
                />
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <!-- Contract preview (collapsible sections) -->
      <CCard class="mb-3">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Preview del contrato</strong>
          <CButton size="sm" variant="ghost" @click="toggleAllSections">
            {{ allOpen ? 'Colapsar todo' : 'Expandir todo' }}
          </CButton>
        </CCardHeader>
        <CCardBody>
          <div v-if="parseError" class="text-danger small">{{ parseError }}</div>
          <div v-else-if="sections.length === 0" class="text-muted">
            Sin secciones.
          </div>
          <div v-else>
            <div
              v-for="(section, idx) in sections"
              :key="idx"
              class="mb-2 border rounded"
            >
              <div
                class="p-2 d-flex justify-content-between align-items-center bg-body-tertiary cursor-pointer"
                style="user-select: none;"
                @click="toggleSection(idx)"
              >
                <strong>{{ section.title }}</strong>
                <CIcon :name="expanded[idx] ? 'cil-chevron-top' : 'cil-chevron-bottom'" />
              </div>
              <div v-if="expanded[idx]" class="p-3 contract-section-content" v-html="renderMarkdown(section.content)"></div>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <!-- Attachments -->
      <CCard class="mb-3">
        <CCardBody>
          <h6 class="mb-3">Adjuntos ({{ contract.attachments?.length || 0 }})</h6>

          <!-- Existentes -->
          <div v-if="contract.attachments && contract.attachments.length" class="d-flex flex-wrap gap-3 mb-3">
            <div v-for="att in contract.attachments" :key="att.id" class="attachment-thumb">
              <img
                :src="att.image_url"
                :alt="att.description || att.type"
                :title="att.description || att.type"
                style="cursor: zoom-in;"
                @click="modalImageUrl = att.image_url"
              />
              <button type="button" class="attachment-remove" title="Eliminar" @click="deleteAttachment(att)">&times;</button>
            </div>
          </div>

          <!-- Zona para pegar / subir -->
          <div
            class="attachment-upload-area"
            :class="{ 'is-dragging': dragging, 'is-uploading': uploadingAttachment }"
            tabindex="0"
            @paste="handlePasteAttachment"
            @drop.prevent="handleDropAttachment"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
          >
            <div v-if="uploadingAttachment" class="text-muted small">
              <CSpinner size="sm" class="me-1" /> Subiendo...
            </div>
            <template v-else>
              <div class="text-muted small mb-2">
                Pega una imagen (haz clic aquí y Ctrl/Cmd+V), arrástrala, o:
              </div>
              <div class="d-flex gap-2 justify-content-center">
                <CButton size="sm" color="primary" variant="outline" @click="attachInput?.click()">Seleccionar</CButton>
                <CButton size="sm" color="secondary" variant="outline" @click="pasteAttachmentFromClipboard">Pegar imagen</CButton>
              </div>
            </template>
            <input ref="attachInput" type="file" accept="image/*" class="d-none" @change="handleFileAttachment" />
          </div>
          <div v-if="attachError" class="text-danger small mt-2">{{ attachError }}</div>
        </CCardBody>
      </CCard>
    </template>

    <CModal
      :visible="!!modalImageUrl"
      @close="modalImageUrl = null"
      size="xl"
      :keyboard="true"
      backdrop="true"
    >
      <CModalHeader close-button>
        <CModalTitle>Adjunto</CModalTitle>
      </CModalHeader>
      <CModalBody class="text-center p-4">
        <img :src="modalImageUrl" class="img-fluid rounded" style="max-height: 70vh;" />
      </CModalBody>
      <CModalFooter class="justify-content-center">
        <CButton color="secondary" variant="outline" @click="modalImageUrl = null">Cerrar</CButton>
      </CModalFooter>
    </CModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import QRCode from 'qrcode'
import { renderMarkdown } from '@/utils/contractMarkdown'

const props = defineProps({
  accommodationId: { type: String, required: true },
  accommodation: { type: Object, default: null },
})

const loading = ref(true)
const contract = ref(null)
const creating = ref(false)
const regenerating = ref(false)
const createError = ref('')
const qrDataUrl = ref('')
const copyMsg = ref('')
const expanded = ref({})
const parseError = ref('')
const attachInput = ref(null)
const dragging = ref(false)
const uploadingAttachment = ref(false)
const attachError = ref('')
const modalImageUrl = ref(null)
const templates = ref([])
const selectedTemplateId = ref(null)

const activeTemplates = computed(() => templates.value.filter(t => t.is_active))

function templateLabel(t) {
  return t.name + (t.plan_name ? ` — ${t.plan_name}` : '')
}

function autoSelectTemplate() {
  const list = activeTemplates.value
  const planId = props.accommodation?.plan_id
  const pick =
    (contract.value?.template_id && list.find(t => t.id === contract.value.template_id)) ||
    (planId && list.find(t => t.plan_id === planId)) ||
    list.find(t => t.is_default) ||
    list[0]
  selectedTemplateId.value = pick?.id || null
}

async function loadTemplates() {
  const venueId = props.accommodation?.venue
  if (!venueId) return
  try {
    const res = await fetch(`/api/venues/${venueId}/contract-templates`, { credentials: 'include' })
    if (res.ok) {
      templates.value = await res.json()
      autoSelectTemplate()
    }
  } catch (e) {
    console.error('Error loading templates:', e)
  }
}

const publicUrl = computed(() => {
  if (!contract.value?.qr_token) return ''
  return `${window.location.origin}/#/contract/${contract.value.qr_token}`
})

const sections = computed(() => {
  if (!contract.value?.snapshot_html) return []
  try {
    parseError.value = ''
    const parsed = JSON.parse(contract.value.snapshot_html)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    parseError.value = 'No se pudo parsear el contenido del contrato.'
    return []
  }
})

const allOpen = computed(() => {
  return sections.value.length > 0 && sections.value.every((_, i) => expanded.value[i])
})

const statusColor = computed(() => {
  if (contract.value?.status === 'signed') return 'success'
  return 'warning'
})

const statusLabel = computed(() => {
  if (contract.value?.status === 'signed') return 'Firmado'
  return 'Borrador'
})

function toggleSection(idx) {
  expanded.value = { ...expanded.value, [idx]: !expanded.value[idx] }
}

function toggleAllSections() {
  const target = !allOpen.value
  const next = {}
  sections.value.forEach((_, i) => { next[i] = target })
  expanded.value = next
}

async function loadContract() {
  loading.value = true
  try {
    const res = await fetch(`/api/accommodations/${props.accommodationId}/contract`, {
      credentials: 'include'
    })
    if (res.ok) {
      const data = await res.json()
      contract.value = data || null
      autoSelectTemplate()
    } else {
      contract.value = null
    }
  } catch (e) {
    console.error('Error loading contract:', e)
    contract.value = null
  } finally {
    loading.value = false
  }
}

async function createContract() {
  creating.value = true
  createError.value = ''
  try {
    const res = await fetch(`/api/accommodations/${props.accommodationId}/contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ template_id: selectedTemplateId.value || null })
    })
    if (res.ok) {
      contract.value = await res.json()
    } else {
      const err = await res.json().catch(() => ({}))
      createError.value = err.error || 'Error al generar el contrato'
    }
  } catch (e) {
    console.error('Error creating contract:', e)
    createError.value = 'Error al generar el contrato'
  } finally {
    creating.value = false
  }
}

async function regenerateContract() {
  if (!confirm('¿Regenerar el contrato con la plantilla actual? Se actualizará el contenido; los adjuntos, el link y el código se conservan.')) return
  regenerating.value = true
  try {
    const res = await fetch(`/api/accommodations/${props.accommodationId}/contract/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ template_id: selectedTemplateId.value || null })
    })
    if (res.ok) {
      contract.value = await res.json()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'No se pudo regenerar')
    }
  } catch (e) {
    console.error('Error regenerating contract:', e)
    alert('Error al regenerar el contrato')
  } finally {
    regenerating.value = false
  }
}

async function generateQR() {
  if (!publicUrl.value) {
    qrDataUrl.value = ''
    return
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(publicUrl.value, {
      width: 400,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    })
  } catch (e) {
    console.error('Error generating QR:', e)
    qrDataUrl.value = ''
  }
}

function downloadQR() {
  if (!qrDataUrl.value) return
  const a = document.createElement('a')
  a.href = qrDataUrl.value
  a.download = `contrato-qr-${props.accommodationId.slice(0, 8)}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(publicUrl.value)
    copyMsg.value = 'Link copiado al portapapeles'
    setTimeout(() => { copyMsg.value = '' }, 2500)
  } catch (e) {
    copyMsg.value = 'No se pudo copiar (copialo manualmente)'
  }
}

function shareWhatsApp() {
  const customerName = props.accommodation?.customer_data?.fullname || 'cliente'
  const venueName = props.accommodation?.venue_data?.name || 'la cabaña'
  const message =
    `Hola ${customerName}, te comparto el contrato de tu reserva en ${venueName}.\n\n` +
    `Link: ${publicUrl.value}\n` +
    `Codigo de acceso: ${contract.value.access_code}`
  const whatsapp = props.accommodation?.customer_data?.whatsapp || props.accommodation?.customer_data?.phone || ''
  const digits = String(whatsapp).replace(/[^0-9]/g, '')
  const cleanPhone = digits ? (digits.startsWith('57') ? digits : `57${digits}`) : ''
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

async function uploadAttachmentFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    attachError.value = 'El archivo no es una imagen'
    return
  }
  uploadingAttachment.value = true
  attachError.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const upRes = await fetch('/api/uploads/receipt', { method: 'POST', credentials: 'include', body: fd })
    if (!upRes.ok) throw new Error('Error al subir la imagen')
    const { imageUrl } = await upRes.json()

    const attRes = await fetch(`/api/accommodations/${props.accommodationId}/contract/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'document', image_url: imageUrl }),
    })
    if (!attRes.ok) {
      const e = await attRes.json().catch(() => ({}))
      throw new Error(e.error || 'Error al adjuntar')
    }
    await loadContract()
  } catch (e) {
    attachError.value = e.message
  } finally {
    uploadingAttachment.value = false
  }
}

function handleFileAttachment(e) {
  const file = e.target.files?.[0]
  if (file) uploadAttachmentFile(file)
  e.target.value = ''
}

function handleDropAttachment(e) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) uploadAttachmentFile(file)
}

function handlePasteAttachment(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) uploadAttachmentFile(file)
      break
    }
  }
}

async function pasteAttachmentFromClipboard() {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const t = item.types.find((x) => x.startsWith('image/'))
      if (t) {
        const blob = await item.getType(t)
        uploadAttachmentFile(new File([blob], 'pegado.png', { type: t }))
        return
      }
    }
    attachError.value = 'No hay imagen en el portapapeles'
  } catch {
    attachError.value = 'No se pudo leer el portapapeles. Haz clic en el área y usa Ctrl/Cmd+V.'
  }
}

async function deleteAttachment(att) {
  if (!confirm('¿Eliminar este adjunto?')) return
  try {
    const res = await fetch(`/api/accommodations/${props.accommodationId}/contract/attachments/${att.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || 'No se pudo eliminar')
    }
    await loadContract()
  } catch (e) {
    alert(e.message)
  }
}

watch(() => contract.value?.qr_token, () => {
  generateQR()
})

watch(() => props.accommodation?.venue, (v) => {
  if (v) loadTemplates()
})

onMounted(() => {
  loadTemplates()
  loadContract()
})
</script>

<style scoped>
.cursor-pointer { cursor: pointer; }
.contract-section-content :deep(ol),
.contract-section-content :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.contract-section-content :deep(ol) { list-style: decimal; }
.contract-section-content :deep(ul) { list-style: disc; }
.contract-section-content :deep(li) { margin-bottom: 0.4rem; }

.attachment-thumb {
  position: relative;
  width: 100px;
  height: 100px;
}
.attachment-thumb img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--cui-border-color, #ccc);
}
.attachment-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: #e55353;
  color: #fff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.attachment-upload-area {
  border: 2px dashed var(--cui-border-color, #ccc);
  border-radius: 8px;
  padding: 1.25rem;
  text-align: center;
  transition: all 0.2s;
  outline: none;
}
.attachment-upload-area:focus,
.attachment-upload-area.is-dragging {
  border-color: #321fdb;
  background: rgba(50, 31, 219, 0.05);
}
.attachment-upload-area.is-uploading {
  opacity: 0.7;
}
</style>
