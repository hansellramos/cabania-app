<template>
  <div>
    <div v-if="loading" class="text-center py-4">
      <CSpinner color="primary" />
    </div>

    <div v-else-if="!contract" class="text-center py-5">
      <p class="text-muted mb-3">Este hospedaje aun no tiene un contrato generado.</p>
      <CButton color="primary" :disabled="creating" @click="createContract">
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
        <div v-if="contract.status === 'draft'" class="d-flex gap-2">
          <CButton color="warning" variant="outline" size="sm" :disabled="regenerating" @click="regenerateContract">
            <CIcon name="cil-reload" class="me-1" />
            {{ regenerating ? 'Regenerando...' : 'Regenerar snapshot' }}
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

      <!-- Attachments -->
      <CCard v-if="contract.attachments && contract.attachments.length > 0" class="mb-3">
        <CCardBody>
          <h6 class="mb-3">Adjuntos ({{ contract.attachments.length }})</h6>
          <div class="d-flex flex-wrap gap-2">
            <a
              v-for="att in contract.attachments"
              :key="att.id"
              :href="att.image_url"
              target="_blank"
            >
              <img
                :src="att.image_url"
                :alt="att.description || att.type"
                style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;"
                :title="att.description || att.type"
              />
            </a>
          </div>
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
              <div v-if="expanded[idx]" class="p-3" style="white-space: pre-wrap;">{{ section.content }}</div>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import QRCode from 'qrcode'

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
      body: JSON.stringify({})
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
  if (!confirm('¿Regenerar el snapshot del contrato? Se perderan los datos actuales del borrador.')) return
  regenerating.value = true
  try {
    const delRes = await fetch(`/api/accommodations/${props.accommodationId}/contract`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (!delRes.ok && delRes.status !== 404) {
      const err = await delRes.json().catch(() => ({}))
      alert(err.error || 'No se pudo regenerar')
      return
    }
    contract.value = null
    await createContract()
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
  const phone = props.accommodation?.customer_data?.phone || ''
  const cleanPhone = String(phone).replace(/[^0-9]/g, '')
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

watch(() => contract.value?.qr_token, () => {
  generateQR()
})

onMounted(() => {
  loadContract()
})
</script>

<style scoped>
.cursor-pointer { cursor: pointer; }
</style>
