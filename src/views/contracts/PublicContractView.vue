<template>
  <div class="cabania-contract" :data-theme="resolvedTheme" :style="brandingStyles">
    <!-- Theme toggle (hidden in print) -->
    <button class="cabania-theme-toggle" @click="cycleTheme" :title="themeLabel">
      <svg v-if="theme === 'light'" viewBox="0 0 24 24" fill="none" width="18" height="18">
        <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <svg v-else-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" width="18" height="18">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" width="18" height="18">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
        <path d="M12 3a9 9 0 0 1 0 18V3z" fill="currentColor"/>
      </svg>
    </button>

    <!-- Print button (hidden in print) -->
    <button v-if="contract" class="cabania-print-toggle" @click="printContract" title="Imprimir / Guardar PDF">
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Background orbs (hidden in print) -->
    <div class="cabania-glow" aria-hidden="true">
      <div class="cabania-orb cabania-orb--emerald"></div>
      <div class="cabania-orb cabania-orb--sky"></div>
      <div class="cabania-orb cabania-orb--emerald-bottom"></div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="cabania-contract__card cabania-contract__state">
      <div class="cabania-spinner"></div>
      <p>Cargando contrato...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="cabania-contract__card cabania-contract__state">
      <h3>Contrato no encontrado</h3>
      <p class="cabania-muted">{{ error }}</p>
    </div>

    <!-- Contract -->
    <article v-else-if="contract" class="cabania-contract__doc">
      <!-- Header -->
      <header class="cabania-contract__card cabania-contract__header">
        <img
          v-if="contract.venue_branding?.logo_url"
          :src="contract.venue_branding.logo_url"
          alt="Logo"
          class="cabania-contract__logo"
        />
        <h1 class="cabania-contract__title">{{ contract.venue_branding?.name || 'Contrato de Hospedaje' }}</h1>
        <p class="cabania-contract__subtitle">Contrato de Reserva</p>

        <div v-if="contract.status === 'signed'" class="cabania-contract__status cabania-contract__status--signed">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Firmado el {{ formatDateTime(contract.accepted_at) }}
        </div>
        <div v-else class="cabania-contract__status cabania-contract__status--pending">
          Pendiente de firma
        </div>
      </header>

      <!-- Sections -->
      <section
        v-for="(section, idx) in sections"
        :key="idx"
        class="cabania-contract__card cabania-contract__section"
        :class="{ 'cabania-no-print': section.print_hidden }"
      >
        <button
          type="button"
          class="cabania-contract__section-header"
          @click="toggleSection(idx)"
          :aria-expanded="expandedSections[idx] ? 'true' : 'false'"
        >
          <span class="cabania-contract__section-title">{{ section.title }}</span>
          <svg
            class="cabania-contract__chevron"
            :class="{ 'is-open': expandedSections[idx] }"
            viewBox="0 0 24 24"
            fill="none"
            width="16"
            height="16"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div
          class="cabania-contract__section-content"
          :class="{ 'is-expanded': expandedSections[idx] }"
          v-html="renderMarkdown(section.content)"
        ></div>
      </section>

      <!-- Signed block (visible in print as well) -->
      <section
        v-if="contract.status === 'signed'"
        class="cabania-contract__card cabania-contract__signed"
      >
        <h2 class="cabania-contract__section-title cabania-contract__section-title--signed">
          Datos de la firma
        </h2>
        <div class="cabania-contract__signed-grid">
          <div v-if="contract.signature_image_url" class="cabania-contract__signed-block">
            <p class="cabania-muted">Firma</p>
            <img
              :src="contract.signature_image_url"
              alt="Firma"
              class="cabania-contract__signature-img"
            />
          </div>
          <div v-if="contract.signer_photo_sepia_url || contract.signer_photo_url" class="cabania-contract__signed-block">
            <p class="cabania-muted">Foto del firmante</p>
            <img
              :src="contract.signer_photo_sepia_url || contract.signer_photo_url"
              alt="Firmante"
              class="cabania-contract__photo-img"
            />
          </div>
        </div>
        <div class="cabania-contract__meta">
          <p><strong>Fecha:</strong> {{ formatDateTime(contract.accepted_at) }}</p>
          <p v-if="contract.accepted_ip"><strong>IP:</strong> <span class="cabania-mono">{{ contract.accepted_ip }}</span></p>
          <p v-if="contract.pdf_hash"><strong>Hash SHA-256:</strong> <span class="cabania-mono cabania-break">{{ contract.pdf_hash }}</span></p>
        </div>
      </section>

      <!-- Attachments (grayscale + watermark) -->
      <section
        v-if="contract.attachments && contract.attachments.length"
        class="cabania-contract__card"
      >
        <h2 class="cabania-contract__section-title">Documentos adjuntos</h2>
        <div class="cabania-contract__attachments">
          <figure
            v-for="att in contract.attachments"
            :key="att.id"
            class="cabania-contract__attachment"
          >
            <img
              :src="protectedAttachmentUrl(att)"
              :alt="att.description || 'Documento adjunto'"
              loading="lazy"
              @click="lightboxUrl = protectedAttachmentUrl(att)"
            />
          </figure>
        </div>
      </section>

      <!-- Sign CTA (hidden in print) -->
      <div v-if="contract.status !== 'signed'" class="cabania-contract__cta">
        <button class="cabania-btn cabania-btn--gradient" @click="startSigning">
          Firmar y Aceptar Contrato
        </button>
      </div>
    </article>

    <!-- Signing modal -->
    <div v-if="showSignModal" class="cabania-modal-backdrop" @click.self="closeSignModal">
      <div class="cabania-modal">
        <header class="cabania-modal__header">
          <h3>{{ modalTitle }}</h3>
          <button class="cabania-modal__close" @click="closeSignModal" aria-label="Cerrar">&times;</button>
        </header>
        <div class="cabania-modal__body">
          <!-- Step 0: intro -->
          <div v-if="signStep === 0" class="cabania-sign-intro">
            <p class="cabania-muted">Para firmar este contrato vamos a pedirte:</p>
            <ul class="cabania-sign-intro__list">
              <li><span>✍️</span> Tu <strong>firma</strong> digital.</li>
              <li><span>🤳</span> Una <strong>foto tuya</strong> para verificar tu identidad.</li>
              <li><span>🪪</span> Una <strong>foto de tu documento</strong> de identidad.</li>
            </ul>
            <p class="cabania-sign-intro__note">
              Ten tu <strong>documento de identidad a la mano</strong> antes de continuar.
            </p>
          </div>

          <!-- Step 1: signature -->
          <div v-if="signStep === 1">
            <p class="cabania-muted">Dibuja tu firma con el dedo o con el mouse:</p>
            <div class="cabania-signature-area">
              <canvas ref="signatureCanvas" style="touch-action: none;"></canvas>
            </div>
            <button class="cabania-btn cabania-btn--ghost cabania-btn--sm" @click="clearSignature">Limpiar</button>
          </div>

          <!-- Step 2: person photo -->
          <div v-if="signStep === 2">
            <p class="cabania-muted">Toma una foto para verificar tu identidad:</p>
            <div v-if="!capturedPhoto" class="cabania-photo-stage">
              <video ref="videoEl" autoplay playsinline></video>
              <button class="cabania-btn cabania-btn--gradient" @click="capturePhoto">Tomar foto</button>
            </div>
            <div v-else class="cabania-photo-stage">
              <img :src="capturedPhoto" alt="Foto capturada" />
              <button class="cabania-btn cabania-btn--ghost cabania-btn--sm" @click="retakePhoto">Repetir</button>
            </div>
          </div>

          <!-- Step 3: document photo -->
          <div v-if="signStep === 3">
            <p class="cabania-muted">Toma una foto clara de tu documento de identidad:</p>
            <div v-if="!capturedDoc" class="cabania-photo-stage">
              <video ref="videoEl" autoplay playsinline></video>
              <button class="cabania-btn cabania-btn--gradient" @click="captureDoc">Tomar foto</button>
            </div>
            <div v-else class="cabania-photo-stage">
              <img :src="capturedDoc" alt="Documento capturado" />
              <button class="cabania-btn cabania-btn--ghost cabania-btn--sm" @click="retakeDoc">Repetir</button>
            </div>
          </div>
        </div>
        <footer class="cabania-modal__footer">
          <button class="cabania-btn cabania-btn--ghost" @click="closeSignModal">Cancelar</button>
          <button
            v-if="signStep === 0"
            class="cabania-btn cabania-btn--gradient"
            @click="beginSignature"
          >Comenzar</button>
          <button
            v-if="signStep === 1"
            class="cabania-btn cabania-btn--gradient"
            :disabled="!hasSignature"
            @click="goToPhotoStep"
          >Siguiente</button>
          <button
            v-if="signStep === 2"
            class="cabania-btn cabania-btn--gradient"
            :disabled="!capturedPhoto"
            @click="goToDocStep"
          >Siguiente</button>
          <button
            v-if="signStep === 3"
            class="cabania-btn cabania-btn--gradient"
            :disabled="signing || !capturedDoc"
            @click="submitSignature"
          >
            <span v-if="signing" class="cabania-spinner cabania-spinner--sm"></span>
            {{ signing ? 'Procesando...' : 'Confirmar y firmar' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- Image lightbox -->
    <div v-if="lightboxUrl" class="cabania-lightbox" @click="lightboxUrl = null">
      <button class="cabania-lightbox__close" aria-label="Cerrar" @click="lightboxUrl = null">&times;</button>
      <img :src="lightboxUrl" alt="Documento adjunto" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { renderMarkdown } from '@/utils/contractMarkdown'
import { protectedContractImageUrl } from '@/utils/contractImage'

const THEME_KEY = 'coreui-free-vue-admin-template-theme'

const route = useRoute()
const token = computed(() => route.params.token)

const contract = ref(null)
const loading = ref(true)
const error = ref(null)
const sections = ref([])
const expandedSections = ref({})

const showSignModal = ref(false)
const signStep = ref(1)
const hasSignature = ref(false)
const signing = ref(false)
const capturedPhoto = ref(null)
const capturedDoc = ref(null)
const signatureCanvas = ref(null)
const videoEl = ref(null)
let signaturePad = null
let videoStream = null

const lightboxUrl = ref(null)

const venueName = computed(() => contract.value?.venue_branding?.name || '')

const modalTitle = computed(() => ({
  0: 'Antes de firmar',
  1: 'Firma Digital',
  2: 'Foto de Identidad',
  3: 'Foto del Documento',
}[signStep.value] || 'Firmar'))

function protectedAttachmentUrl(att) {
  return protectedContractImageUrl(att.image_url, venueName.value)
}

// Theme
const theme = ref(localStorage.getItem(THEME_KEY) || 'auto')
const prefersDark = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
)
let mqHandler

const resolvedTheme = computed(() => {
  if (theme.value === 'auto') return prefersDark.value ? 'dark' : 'light'
  return theme.value
})

const themeLabel = computed(() => {
  const labels = { light: 'Tema claro', dark: 'Tema oscuro', auto: 'Automático' }
  return labels[theme.value]
})

function cycleTheme() {
  const order = ['light', 'dark', 'auto']
  const idx = order.indexOf(theme.value)
  theme.value = order[(idx + 1) % 3]
  localStorage.setItem(THEME_KEY, theme.value)
}

const brandingStyles = computed(() => {
  const b = contract.value?.venue_branding
  if (!b?.brand_color_primary) return {}
  return {
    '--brand-primary': b.brand_color_primary,
    '--brand-secondary': b.brand_color_secondary || b.brand_color_primary,
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
    if (contract.value.snapshot_html) {
      try {
        sections.value = JSON.parse(contract.value.snapshot_html)
        sections.value.forEach((_, i) => { expandedSections.value[i] = true })
      } catch {
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
  expandedSections.value = { ...expandedSections.value, [idx]: !expandedSections.value[idx] }
}

function formatDateTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function printContract() {
  expandedSections.value = sections.value.reduce((acc, _, i) => {
    acc[i] = true
    return acc
  }, {})
  nextTick(() => window.print())
}

// --- Signing ---
function startSigning() {
  signStep.value = 0
  hasSignature.value = false
  capturedPhoto.value = null
  capturedDoc.value = null
  showSignModal.value = true
}

function beginSignature() {
  signStep.value = 1
  nextTick(() => initSignaturePad())
}

function closeSignModal() {
  showSignModal.value = false
  stopCamera()
}

function initSignaturePad() {
  const canvas = signatureCanvas.value
  if (!canvas) return
  const rect = canvas.parentElement.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = 200

  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'

  let drawing = false
  let lastX = 0, lastY = 0

  function getPos(e) {
    const r = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch ? touch.clientX : e.clientX) - r.left,
      y: (touch ? touch.clientY : e.clientY) - r.top,
    }
  }
  function start(e) { e.preventDefault(); drawing = true; const p = getPos(e); lastX = p.x; lastY = p.y }
  function move(e) {
    if (!drawing) return
    e.preventDefault()
    const p = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastX = p.x; lastY = p.y
    hasSignature.value = true
  }
  function stop() { drawing = false }

  canvas.addEventListener('mousedown', start)
  canvas.addEventListener('mousemove', move)
  canvas.addEventListener('mouseup', stop)
  canvas.addEventListener('mouseleave', stop)
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

async function goToPhotoStep() {
  signStep.value = 2
  await nextTick()
  startCamera()
}

async function goToDocStep() {
  signStep.value = 3
  await nextTick()
  startCamera()
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    })
    videoStream = stream
    if (videoEl.value) videoEl.value.srcObject = stream
  } catch (err) {
    console.error('Camera error:', err)
    alert('No se pudo acceder a la cámara. Otorga permisos e intenta de nuevo.')
  }
}

function capturePhoto() {
  const video = videoEl.value
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  capturedPhoto.value = canvas.toDataURL('image/jpeg', 0.85)
  stopCamera()
}

function retakePhoto() {
  capturedPhoto.value = null
  nextTick(() => startCamera())
}

function captureDoc() {
  const video = videoEl.value
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  capturedDoc.value = canvas.toDataURL('image/jpeg', 0.85)
  stopCamera()
}

function retakeDoc() {
  capturedDoc.value = null
  nextTick(() => startCamera())
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop())
    videoStream = null
  }
}

async function uploadContractAsset(blob, filename) {
  const form = new FormData()
  form.append('file', blob, filename)
  const res = await fetch(`/api/public/contracts/${token.value}/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'No se pudo subir la imagen')
  }
  const data = await res.json()
  if (!data?.imageUrl) throw new Error('Respuesta de upload sin imageUrl')
  return data.imageUrl
}

async function submitSignature() {
  signing.value = true
  try {
    const sigBlob = await new Promise(resolve => signaturePad.canvas.toBlob(resolve, 'image/png'))
    const signatureUrl = await uploadContractAsset(sigBlob, 'signature.png')

    let photoUrl = null, photoSepiaUrl = null
    if (capturedPhoto.value) {
      const photoBlob = await fetch(capturedPhoto.value).then(r => r.blob())
      photoUrl = await uploadContractAsset(photoBlob, 'signer-photo.jpg')
      photoSepiaUrl = photoUrl.replace('/upload/', '/upload/e_sepia/')
    }

    // Subir foto del documento y crear el adjunto ANTES de firmar
    // (tras firmar, el endpoint de adjuntos queda bloqueado).
    if (capturedDoc.value) {
      const docBlob = await fetch(capturedDoc.value).then(r => r.blob())
      const docUrl = await uploadContractAsset(docBlob, 'documento.jpg')
      await fetch(`/api/public/contracts/${token.value}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'document',
          image_url: docUrl,
          description: 'Documento de identidad',
        }),
      })
    }

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
    } else {
      const err = await signRes.json().catch(() => ({}))
      alert(err.error || 'Error al firmar')
    }
  } catch (err) {
    console.error('Error signing:', err)
    alert('Error al firmar el contrato')
  } finally {
    signing.value = false
  }
}

onMounted(() => {
  loadContract()
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mqHandler = (e) => { prefersDark.value = e.matches }
  mq.addEventListener('change', mqHandler)
})

onUnmounted(() => {
  stopCamera()
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  if (mqHandler) mq.removeEventListener('change', mqHandler)
})
</script>

<style scoped>
/* ============================================
   PUBLIC CONTRACT — dual theme + print to B/W
   Mirrors the cabania-login design system.
   ============================================ */

/* --- Light mode (default) --- */
.cabania-contract {
  --cc-bg: #f1f5f9;
  --cc-text: #0f172a;
  --cc-text-secondary: #475569;
  --cc-text-muted: #64748b;
  --cc-card-bg: rgba(255, 255, 255, 0.7);
  --cc-card-border: rgba(255, 255, 255, 0.65);
  --cc-card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03);
  --cc-section-header-bg: rgba(255, 255, 255, 0.5);
  --cc-section-header-hover: rgba(255, 255, 255, 0.75);
  --cc-section-content-bg: transparent;
  --cc-divider: rgba(0, 0, 0, 0.08);
  --cc-orb-emerald: rgba(16, 185, 129, 0.15);
  --cc-orb-sky: rgba(14, 165, 233, 0.15);
  --cc-orb-bottom: rgba(16, 185, 129, 0.08);
  --cc-orb-blur: 120px;
  --cc-btn-text: white;
  --cc-btn-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  --cc-status-pending-bg: rgba(245, 158, 11, 0.12);
  --cc-status-pending-text: #b45309;
  --cc-status-signed-bg: rgba(16, 185, 129, 0.12);
  --cc-status-signed-text: #047857;
  --cc-modal-backdrop: rgba(15, 23, 42, 0.45);
  --cc-toggle-bg: rgba(255, 255, 255, 0.5);
  --cc-toggle-border: rgba(0, 0, 0, 0.08);
  --cc-toggle-hover: rgba(255, 255, 255, 0.8);
  --cc-signature-bg: #ffffff;

  min-height: 100vh;
  background-color: var(--cc-bg);
  color: var(--cc-text);
  position: relative;
  overflow-x: hidden;
  padding: 1.5rem 1rem 3rem;
  transition: background-color 0.3s, color 0.3s;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* --- Dark mode --- */
.cabania-contract[data-theme="dark"] {
  --cc-bg: #020617;
  --cc-text: #f1f5f9;
  --cc-text-secondary: #cbd5e1;
  --cc-text-muted: #94a3b8;
  --cc-card-bg: rgba(255, 255, 255, 0.06);
  --cc-card-border: rgba(255, 255, 255, 0.15);
  --cc-card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
  --cc-section-header-bg: rgba(255, 255, 255, 0.04);
  --cc-section-header-hover: rgba(255, 255, 255, 0.08);
  --cc-section-content-bg: transparent;
  --cc-divider: rgba(255, 255, 255, 0.12);
  --cc-orb-emerald: rgba(16, 185, 129, 0.2);
  --cc-orb-sky: rgba(14, 165, 233, 0.2);
  --cc-orb-bottom: rgba(16, 185, 129, 0.1);
  --cc-orb-blur: 96px;
  --cc-btn-text: #020617;
  --cc-btn-shadow: 0 4px 12px rgba(16, 185, 129, 0.18);
  --cc-status-pending-bg: rgba(245, 158, 11, 0.15);
  --cc-status-pending-text: #fbbf24;
  --cc-status-signed-bg: rgba(16, 185, 129, 0.15);
  --cc-status-signed-text: #34d399;
  --cc-modal-backdrop: rgba(2, 6, 23, 0.75);
  --cc-toggle-bg: rgba(255, 255, 255, 0.05);
  --cc-toggle-border: rgba(255, 255, 255, 0.15);
  --cc-toggle-hover: rgba(255, 255, 255, 0.1);
  --cc-signature-bg: #f8fafc;
}

/* --- Top-right controls --- */
.cabania-theme-toggle,
.cabania-print-toggle {
  position: fixed;
  top: 1rem;
  z-index: 20;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--cc-toggle-border);
  background: var(--cc-toggle-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--cc-text-secondary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.cabania-theme-toggle { right: 1rem; }
.cabania-print-toggle { right: 3.75rem; }
.cabania-theme-toggle:hover,
.cabania-print-toggle:hover {
  background: var(--cc-toggle-hover);
  color: var(--cc-text);
}

/* --- Background orbs --- */
.cabania-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
.cabania-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(var(--cc-orb-blur));
  transition: opacity 0.5s;
}
.cabania-orb--emerald { top: -10rem; left: -10%; width: 520px; height: 520px; background: var(--cc-orb-emerald); }
.cabania-orb--sky { top: -10rem; right: -10%; width: 520px; height: 520px; background: var(--cc-orb-sky); }
.cabania-orb--emerald-bottom { bottom: -14rem; left: 25%; width: 620px; height: 620px; background: var(--cc-orb-bottom); }

/* --- Document container --- */
.cabania-contract__doc {
  position: relative;
  z-index: 1;
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* --- Card base (glass) --- */
.cabania-contract__card {
  border-radius: 1.25rem;
  border: 1px solid var(--cc-card-border);
  background: var(--cc-card-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: var(--cc-card-shadow);
  transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
}

.cabania-contract__state {
  max-width: 460px;
  margin: 4rem auto 0;
  padding: 2.5rem;
  text-align: center;
  position: relative;
  z-index: 1;
}
.cabania-contract__state h3 { margin: 1rem 0 0.5rem; font-size: 1.25rem; }

/* --- Header --- */
.cabania-contract__header {
  padding: 2rem 1.75rem;
  text-align: center;
  background: linear-gradient(135deg,
    var(--brand-primary, #10b981) 0%,
    var(--brand-secondary, #0ea5e9) 100%);
  color: white;
  border: none;
}
.cabania-contract__logo {
  max-height: 64px;
  width: auto;
  margin-bottom: 0.75rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}
.cabania-contract__title {
  font-size: 1.65rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  letter-spacing: -0.01em;
}
.cabania-contract__subtitle {
  font-size: 0.9rem;
  opacity: 0.9;
  margin: 0 0 1rem;
}
.cabania-contract__status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.18);
  color: white;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* --- Section card --- */
.cabania-contract__section { overflow: hidden; }
.cabania-contract__section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--cc-section-header-bg);
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--cc-text);
  font: inherit;
  transition: background 0.2s;
}
.cabania-contract__section-header:hover { background: var(--cc-section-header-hover); }
.cabania-contract__section-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0;
}
.cabania-contract__chevron { transition: transform 0.2s; flex-shrink: 0; }
.cabania-contract__chevron.is-open { transform: rotate(180deg); }
.cabania-contract__section-content {
  display: none;
  padding: 1.25rem;
  background: var(--cc-section-content-bg);
  border-top: 1px solid var(--cc-divider);
  line-height: 1.7;
  font-size: 0.95rem;
  color: var(--cc-text);
}
.cabania-contract__section-content.is-expanded { display: block; }
.cabania-contract__section-content :deep(strong) { color: var(--cc-text); }
.cabania-contract__section-content :deep(ol),
.cabania-contract__section-content :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.cabania-contract__section-content :deep(ol) { list-style: decimal; }
.cabania-contract__section-content :deep(ul) { list-style: disc; }
.cabania-contract__section-content :deep(li) { margin-bottom: 0.4rem; }
.cabania-contract__section-content :deep(li::marker) { color: var(--cc-text); font-weight: 600; }

/* --- Attachments --- */
.cabania-contract__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.cabania-contract__attachment {
  margin: 0;
}
.cabania-contract__attachment img {
  width: 220px;
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid var(--cc-divider);
  cursor: zoom-in;
  transition: transform 0.15s;
}
.cabania-contract__attachment img:hover {
  transform: scale(1.02);
}

/* --- Lightbox --- */
.cabania-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  cursor: zoom-out;
}
.cabania-lightbox img {
  max-width: 95vw;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.cabania-lightbox__close {
  position: absolute;
  top: 1rem;
  right: 1.25rem;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}
.cabania-lightbox__close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* --- Signing intro --- */
.cabania-sign-intro__list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.cabania-sign-intro__list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1rem;
}
.cabania-sign-intro__list li span { font-size: 1.4rem; }
.cabania-sign-intro__note {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.4);
  font-size: 0.95rem;
}

/* --- Signed block --- */
.cabania-contract__signed { padding: 1.5rem 1.75rem; }
.cabania-contract__section-title--signed { color: var(--cc-status-signed-text); margin: 0 0 1rem; }
.cabania-contract__signed-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 1rem;
}
.cabania-contract__signed-block p {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cabania-contract__signature-img {
  background: var(--cc-signature-bg);
  border: 1px solid var(--cc-divider);
  border-radius: 0.5rem;
  padding: 0.5rem;
  max-width: 320px;
  max-height: 150px;
}
.cabania-contract__photo-img {
  max-width: 150px;
  max-height: 150px;
  border-radius: 0.5rem;
  object-fit: cover;
  border: 1px solid var(--cc-divider);
}
.cabania-contract__meta p {
  margin: 0.35rem 0;
  font-size: 0.85rem;
  color: var(--cc-text-secondary);
}

/* --- CTA --- */
.cabania-contract__cta {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

/* --- Buttons --- */
.cabania-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 2rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s, background 0.2s;
}
.cabania-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.cabania-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cabania-btn--gradient {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: var(--cc-btn-text);
  box-shadow: var(--cc-btn-shadow);
}
.cabania-btn--ghost {
  background: transparent;
  border-color: var(--cc-divider);
  color: var(--cc-text);
}
.cabania-btn--ghost:hover:not(:disabled) { background: var(--cc-section-header-hover); }
.cabania-btn--sm { padding: 0.5rem 1rem; font-size: 0.825rem; }

/* --- Modal --- */
.cabania-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--cc-modal-backdrop);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 100;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.cabania-modal {
  width: 100%;
  max-width: 560px;
  background: var(--cc-card-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--cc-card-border);
  border-radius: 1.25rem;
  box-shadow: var(--cc-card-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.cabania-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--cc-divider);
}
.cabania-modal__header h3 { margin: 0; font-size: 1.1rem; }
.cabania-modal__close {
  background: none;
  border: none;
  color: var(--cc-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  transition: background 0.2s;
}
.cabania-modal__close:hover { background: var(--cc-section-header-hover); }
.cabania-modal__body { padding: 1.25rem 1.5rem; overflow-y: auto; }
.cabania-modal__body p { margin: 0 0 0.75rem; }
.cabania-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--cc-divider);
}

/* --- Signature canvas + photo stage --- */
.cabania-signature-area {
  width: 100%;
  background: var(--cc-signature-bg);
  border: 1px solid var(--cc-divider);
  border-radius: 0.75rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}
.cabania-signature-area canvas { display: block; width: 100%; height: 200px; }
.cabania-photo-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.cabania-photo-stage video,
.cabania-photo-stage img {
  width: 100%;
  max-width: 360px;
  max-height: 280px;
  border-radius: 0.75rem;
  object-fit: cover;
  background: black;
}

/* --- Spinner --- */
.cabania-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--cc-divider);
  border-top-color: #10b981;
  border-radius: 9999px;
  animation: cabania-spin 0.6s linear infinite;
  margin: 0 auto;
}
.cabania-spinner--sm {
  width: 1rem;
  height: 1rem;
  border-width: 2px;
  border-top-color: var(--cc-btn-text);
  margin: 0;
}
@keyframes cabania-spin { to { transform: rotate(360deg); } }

/* --- Utility --- */
.cabania-muted { color: var(--cc-text-muted); font-size: 0.85rem; }
.cabania-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
.cabania-break { word-break: break-all; }

/* ============================================
   PRINT — force black on white, expand all
   ============================================ */
@media print {
  /* Secciones marcadas como "no imprimir" */
  .cabania-no-print { display: none !important; }

  /* Reset all the glass/gradient stuff */
  .cabania-contract,
  .cabania-contract[data-theme="dark"] {
    --cc-bg: white;
    --cc-text: black;
    --cc-text-secondary: black;
    --cc-text-muted: #333;
    --cc-card-bg: white;
    --cc-card-border: transparent;
    --cc-card-shadow: none;
    --cc-section-header-bg: white;
    --cc-section-content-bg: white;
    --cc-divider: #444;
    --cc-status-pending-bg: transparent;
    --cc-status-pending-text: black;
    --cc-status-signed-bg: transparent;
    --cc-status-signed-text: black;
    background: white !important;
    color: black !important;
    padding: 0;
  }

  /* Hide all chrome */
  .cabania-theme-toggle,
  .cabania-print-toggle,
  .cabania-glow,
  .cabania-modal-backdrop,
  .cabania-contract__cta {
    display: none !important;
  }

  /* Flatten cards */
  .cabania-contract__card,
  .cabania-modal {
    background: white !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid #444 !important;
    box-shadow: none !important;
    border-radius: 6px !important;
    page-break-inside: avoid;
    color: black !important;
  }

  /* Header in B/W */
  .cabania-contract__header {
    background: white !important;
    color: black !important;
    border-bottom: 2px solid black !important;
    padding: 1rem !important;
  }
  .cabania-contract__title { color: black !important; }
  .cabania-contract__subtitle { color: #333 !important; }
  .cabania-contract__status {
    background: white !important;
    color: black !important;
    border: 1px solid black !important;
  }
  .cabania-contract__logo {
    filter: grayscale(100%) !important;
  }

  /* Always expand all sections */
  .cabania-contract__section-content { display: block !important; }
  .cabania-contract__chevron { display: none !important; }
  .cabania-contract__section-header {
    background: white !important;
    color: black !important;
    cursor: default;
    border-bottom: 1px solid #444;
  }
  .cabania-contract__section-content {
    color: black !important;
  }
  .cabania-contract__section-content :deep(strong),
  .cabania-contract__section-content :deep(em) {
    color: black !important;
  }

  /* Signed block */
  .cabania-contract__section-title--signed { color: black !important; }
  .cabania-contract__signature-img,
  .cabania-contract__photo-img {
    filter: grayscale(100%) !important;
    border-color: #444 !important;
    background: white !important;
  }
  .cabania-contract__meta p { color: black !important; }

  .cabania-muted { color: #333 !important; }

  /* Page setup */
  @page {
    margin: 1.5cm 1.2cm;
    size: A4;
  }
}
</style>
