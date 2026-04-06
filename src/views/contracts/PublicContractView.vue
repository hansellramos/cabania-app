<template>
  <div class="public-contract" :style="brandingStyles">
    <div v-if="loading" class="text-center py-5">
      <CSpinner />
      <p class="mt-3 text-muted">Cargando contrato...</p>
    </div>

    <div v-else-if="error" class="text-center py-5">
      <h4>Contrato no encontrado</h4>
      <p class="text-muted">{{ error }}</p>
    </div>

    <div v-else-if="contract" class="contract-container">
      <!-- Header with venue branding -->
      <div class="contract-header text-center py-4">
        <img v-if="contract.venue_branding?.logo_url" :src="contract.venue_branding.logo_url" alt="Logo" style="max-height: 80px;" class="mb-3" />
        <h2 class="mb-1">{{ contract.venue_branding?.name || 'Contrato de Hospedaje' }}</h2>
        <p class="text-muted">Contrato de Reserva</p>
      </div>

      <!-- Contract sections -->
      <div class="contract-body px-3 px-md-5 pb-4">
        <div v-for="(section, idx) in sections" :key="idx" class="contract-section mb-4">
          <div
            class="section-header d-flex justify-content-between align-items-center p-3 rounded cursor-pointer"
            :class="{ 'bg-light': !expandedSections[idx], 'bg-primary bg-opacity-10': expandedSections[idx] }"
            @click="toggleSection(idx)"
          >
            <h5 class="mb-0">{{ section.title }}</h5>
            <CIcon :icon="expandedSections[idx] ? 'cil-chevron-top' : 'cil-chevron-bottom'" />
          </div>
          <div v-if="expandedSections[idx]" class="section-content p-3 border rounded-bottom" v-html="renderMarkdown(section.content)"></div>
        </div>

        <!-- Signature section -->
        <div v-if="contract.status === 'signed'" class="signed-section mt-4 p-4 border rounded bg-success bg-opacity-10">
          <h5 class="text-success">Contrato Firmado</h5>
          <div class="d-flex flex-wrap gap-4 mt-3">
            <div v-if="contract.signature_image_url">
              <p class="text-muted small mb-1">Firma</p>
              <img :src="contract.signature_image_url" alt="Firma" class="border rounded" style="max-width: 300px; max-height: 150px;" />
            </div>
            <div v-if="contract.signer_photo_sepia_url">
              <p class="text-muted small mb-1">Foto de identidad</p>
              <img :src="contract.signer_photo_sepia_url" alt="Firmante" class="border rounded" style="max-width: 150px; max-height: 150px; object-fit: cover;" />
            </div>
          </div>
          <div class="mt-3 small text-muted">
            <p class="mb-1">Firmado: {{ formatDateTime(contract.accepted_at) }}</p>
            <p class="mb-1" v-if="contract.pdf_hash">Hash SHA-256: <code>{{ contract.pdf_hash }}</code></p>
          </div>
        </div>

        <!-- Sign button -->
        <div v-else-if="contract.status !== 'signed'" class="text-center mt-4">
          <CButton color="primary" size="lg" @click="startSigning" class="px-5">
            Firmar y Aceptar Contrato
          </CButton>
        </div>
      </div>

      <!-- Signing modal -->
      <CModal :visible="showSignModal" @close="showSignModal = false" size="lg" backdrop="static">
        <CModalHeader>
          <CModalTitle>{{ signStep === 1 ? 'Firma Digital' : 'Foto de Identidad' }}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <!-- Step 1: Signature -->
          <div v-if="signStep === 1">
            <p class="text-muted mb-3">Dibuja tu firma con el dedo o mouse:</p>
            <div class="signature-area border rounded bg-white" ref="signatureContainer">
              <canvas ref="signatureCanvas" class="w-100" style="height: 200px; touch-action: none;"></canvas>
            </div>
            <div class="d-flex gap-2 mt-2">
              <CButton color="secondary" size="sm" variant="outline" @click="clearSignature">Limpiar</CButton>
            </div>
          </div>

          <!-- Step 2: Photo -->
          <div v-if="signStep === 2">
            <p class="text-muted mb-3">Toma una foto para verificar tu identidad:</p>
            <div v-if="!capturedPhoto" class="text-center">
              <video ref="videoEl" autoplay playsinline class="border rounded w-100" style="max-height: 300px; object-fit: cover;"></video>
              <CButton color="primary" class="mt-2" @click="capturePhoto">Tomar Foto</CButton>
            </div>
            <div v-else class="text-center">
              <img :src="capturedPhoto" class="border rounded" style="max-height: 300px;" />
              <div class="mt-2">
                <CButton color="secondary" size="sm" variant="outline" @click="retakePhoto">Repetir</CButton>
              </div>
            </div>
            <canvas ref="photoCanvas" class="d-none"></canvas>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" @click="showSignModal = false">Cancelar</CButton>
          <CButton v-if="signStep === 1" color="primary" @click="nextSignStep" :disabled="!hasSignature">
            Siguiente
          </CButton>
          <CButton v-if="signStep === 2" color="success" @click="submitSignature" :disabled="signing">
            {{ signing ? 'Procesando...' : 'Confirmar y Firmar' }}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const token = computed(() => route.params.token)

const contract = ref(null)
const loading = ref(true)
const error = ref(null)
const sections = ref([])
const expandedSections = ref({})

// Signing
const showSignModal = ref(false)
const signStep = ref(1)
const hasSignature = ref(false)
const signing = ref(false)
const capturedPhoto = ref(null)
let signaturePad = null
let videoStream = null

const brandingStyles = computed(() => {
  const b = contract.value?.venue_branding
  if (!b?.brand_color_primary) return {}
  return {
    '--contract-primary': b.brand_color_primary,
    '--contract-secondary': b.brand_color_secondary || b.brand_color_primary,
  }
})

async function loadContract() {
  try {
    loading.value = true
    const res = await fetch(`/api/public/contracts/${token.value}`)
    if (!res.ok) {
      error.value = 'Contrato no encontrado'
      return
    }
    contract.value = await res.json()

    // Parse snapshot_html (JSON array of sections)
    if (contract.value.snapshot_html) {
      try {
        sections.value = JSON.parse(contract.value.snapshot_html)
        // Expand all sections by default
        sections.value.forEach((_, i) => { expandedSections.value[i] = true })
      } catch (e) {
        sections.value = []
      }
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function toggleSection(idx) {
  expandedSections.value[idx] = !expandedSections.value[idx]
}

function renderMarkdown(content) {
  if (!content) return ''
  // Basic markdown: **bold**, *italic*, newlines
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

function formatDateTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// --- Signing flow ---
function startSigning() {
  signStep.value = 1
  hasSignature.value = false
  capturedPhoto.value = null
  showSignModal.value = true
  nextTick(() => initSignaturePad())
}

function initSignaturePad() {
  const canvas = document.querySelector('.signature-area canvas')
  if (!canvas) return
  const container = canvas.parentElement
  canvas.width = container.clientWidth
  canvas.height = 200

  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'

  let drawing = false
  let lastX = 0, lastY = 0

  function getPos(e) {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch ? touch.clientX : e.clientX) - rect.left,
      y: (touch ? touch.clientY : e.clientY) - rect.top,
    }
  }

  function start(e) {
    e.preventDefault()
    drawing = true
    const pos = getPos(e)
    lastX = pos.x
    lastY = pos.y
  }

  function move(e) {
    if (!drawing) return
    e.preventDefault()
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastX = pos.x
    lastY = pos.y
    hasSignature.value = true
  }

  function stop() { drawing = false }

  canvas.addEventListener('mousedown', start)
  canvas.addEventListener('mousemove', move)
  canvas.addEventListener('mouseup', stop)
  canvas.addEventListener('touchstart', start, { passive: false })
  canvas.addEventListener('touchmove', move, { passive: false })
  canvas.addEventListener('touchend', stop)

  signaturePad = { canvas, ctx }
}

function clearSignature() {
  if (!signaturePad) return
  const { canvas, ctx } = signaturePad
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasSignature.value = false
}

async function nextSignStep() {
  signStep.value = 2
  await nextTick()
  startCamera()
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
    videoStream = stream
    const video = document.querySelector('video')
    if (video) video.srcObject = stream
  } catch (err) {
    console.error('Camera error:', err)
  }
}

function capturePhoto() {
  const video = document.querySelector('video')
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  capturedPhoto.value = canvas.toDataURL('image/jpeg', 0.8)
  stopCamera()
}

function retakePhoto() {
  capturedPhoto.value = null
  nextTick(() => startCamera())
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop())
    videoStream = null
  }
}

async function submitSignature() {
  signing.value = true
  try {
    // Upload signature
    const signatureBlob = await new Promise(resolve => signaturePad.canvas.toBlob(resolve, 'image/png'))
    const sigFormData = new FormData()
    sigFormData.append('file', signatureBlob, 'signature.png')
    const sigRes = await fetch('/api/uploads/receipt', { method: 'POST', credentials: 'include', body: sigFormData })
    const { imageUrl: signatureUrl } = await sigRes.json()

    // Upload photo (if captured)
    let photoUrl = null, photoSepiaUrl = null
    if (capturedPhoto.value) {
      const photoBlob = await fetch(capturedPhoto.value).then(r => r.blob())
      const photoFormData = new FormData()
      photoFormData.append('file', photoBlob, 'signer-photo.jpg')
      const photoRes = await fetch('/api/uploads/receipt', { method: 'POST', credentials: 'include', body: photoFormData })
      const { imageUrl: uploadedPhotoUrl } = await photoRes.json()
      photoUrl = uploadedPhotoUrl
      // Add sepia transformation for Cloudinary
      photoSepiaUrl = uploadedPhotoUrl.replace('/upload/', '/upload/e_sepia/')
    }

    // Sign contract
    const signRes = await fetch(`/api/public/contracts/${token.value}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature_image_url: signatureUrl,
        signer_photo_url: photoUrl,
        signer_photo_sepia_url: photoSepiaUrl,
      }),
    })

    if (signRes.ok) {
      showSignModal.value = false
      await loadContract()
    }
  } catch (err) {
    console.error('Error signing:', err)
    alert('Error al firmar el contrato')
  } finally {
    signing.value = false
  }
}

onMounted(() => loadContract())
onUnmounted(() => stopCamera())
</script>

<style scoped>
.public-contract {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.contract-header {
  background: linear-gradient(135deg, var(--contract-primary, #321fdb) 0%, var(--contract-secondary, #1b2e4b) 100%);
  color: white;
}

.contract-container {
  max-width: 900px;
  margin: 0 auto;
}

.section-header {
  cursor: pointer;
  transition: background-color 0.2s;
}

.section-header:hover {
  opacity: 0.9;
}

.section-content {
  border-top: none;
  line-height: 1.8;
}

.signature-area {
  touch-action: none;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
