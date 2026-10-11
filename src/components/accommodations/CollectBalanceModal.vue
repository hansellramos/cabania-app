<template>
  <CModal teleport :visible="visible" size="lg" alignment="center" @close="$emit('close')">
    <CModalHeader>
      <CModalTitle>Cobrar saldo</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <div v-if="loading" class="text-center py-3"><CSpinner size="sm" color="primary" /></div>
      <template v-else>
        <div v-if="!methods.length" class="text-body-secondary small">
          Esta cabaña no tiene métodos de pago activos.
          <RouterLink v-if="venueId" :to="`/business/venues/${venueId}/payment-methods`">Configúralos aquí</RouterLink>
          (por ejemplo, tu llave Bre-B).
        </div>
        <template v-else>
          <CRow class="g-2 mb-3">
            <CCol sm="7">
              <CFormLabel for="collect-method" class="small mb-1">Cómo te paga</CFormLabel>
              <CFormSelect id="collect-method" v-model="methodId" @change="resetResult">
                <option v-for="m in methods" :key="m.id" :value="m.id">{{ methodName(m) }}</option>
              </CFormSelect>
            </CCol>
            <CCol sm="5">
              <CFormLabel for="collect-amount" class="small mb-1">Monto</CFormLabel>
              <CInputGroup>
                <CInputGroupText>$</CInputGroupText>
                <CFormInput id="collect-amount" v-model.number="amount" type="number" min="1000" :max="balance" step="1000" @input="resetResult" />
              </CInputGroup>
              <small v-if="amount !== balance" class="text-body-secondary">Saldo pendiente: {{ money(balance) }}</small>
            </CCol>
          </CRow>

          <div v-if="isBold && !link" class="text-center py-2">
            <p class="small text-body-secondary mb-2">
              Se crea un link de pago de Bold por {{ money(amount) }} (QR Bre-B, Nequi, PSE, tarjeta).
              Cuando el cliente paga, el pago queda registrado solo en este alquiler.
            </p>
            <CButton color="primary" :disabled="creating || !validAmount" @click="createLink">
              <CSpinner v-if="creating" size="sm" class="me-1" />Generar link y QR
            </CButton>
          </div>
          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>

          <CRow v-if="ready" class="g-3">
            <CCol md="5" class="text-center">
              <template v-if="imageSrc">
                <img :src="imageSrc" alt="Código QR de pago" class="collect-qr img-thumbnail" />
                <div class="d-flex justify-content-center gap-2 mt-2">
                  <CButton color="primary" variant="outline" size="sm" @click="copyImage">
                    {{ copied === 'image' ? '¡Copiada!' : 'Copiar imagen' }}
                  </CButton>
                  <CButton color="secondary" variant="ghost" size="sm" :href="imageSrc" :download="imageFileName" target="_blank">
                    Descargar
                  </CButton>
                </div>
                <small v-if="imageError" class="d-block text-danger mt-1">{{ imageError }}</small>
              </template>
              <p v-else class="small text-body-secondary mt-2">
                Este método no tiene imagen de QR. Puedes subir el QR de tu llave en los métodos de pago de la cabaña.
              </p>
            </CCol>
            <CCol md="7">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <strong class="small">Mensaje</strong>
                <CButton color="primary" size="sm" @click="copyMessage">
                  {{ copied === 'message' ? '¡Copiado!' : 'Copiar mensaje' }}
                </CButton>
              </div>
              <CFormTextarea v-model="message" rows="9" class="small" />
              <CButton
                v-if="whatsappLink"
                color="success"
                variant="outline"
                size="sm"
                class="mt-2"
                :href="whatsappLink"
                target="_blank"
              >
                <CIcon icon="cib-whatsapp" class="me-1" />Abrir chat con el mensaje
              </CButton>
              <small class="d-block text-body-secondary mt-2">
                Copia la imagen, pégala en el chat y envía el mensaje.
                <template v-if="link"> El link vence el {{ formatDateTime(link.expires_at) }}.</template>
                <template v-else> Cuando te llegue el pago, regístralo en "Registrar Pago".</template>
              </small>
            </CCol>
          </CRow>
        </template>
      </template>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="$emit('close')">Cerrar</CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import QRCode from 'qrcode'
import { CIcon } from '@coreui/icons-vue'
import { whatsappUrl } from '@/utils/contactLinks'

const props = defineProps({
  visible: { type: Boolean, default: false },
  accommodation: { type: Object, default: null },
  balance: { type: Number, default: 0 }
})
defineEmits(['close'])

const loading = ref(false)
const methods = ref([])
const methodId = ref('')
const amount = ref(0)
const link = ref(null)
const qrDataUrl = ref('')
const creating = ref(false)
const error = ref('')
const imageError = ref('')
const message = ref('')
const copied = ref('')

const venueId = computed(() => props.accommodation?.venue_data?.id || props.accommodation?.venue || null)
const method = computed(() => methods.value.find(m => m.id === methodId.value) || null)
const isBold = computed(() => method.value?.method_type === 'bold')
const validAmount = computed(() => amount.value >= 1000 && amount.value <= props.balance)
const ready = computed(() => !!method.value && (isBold.value ? !!link.value : validAmount.value))
const imageSrc = computed(() => isBold.value ? qrDataUrl.value : method.value?.qr_image_url || '')
const imageFileName = computed(() => `qr-pago-${(props.accommodation?.venue_data?.name || 'cabania').toLowerCase().replace(/\s+/g, '-')}.png`)
const whatsappLink = computed(() => whatsappUrl(props.accommodation?.customer_data?.whatsapp, message.value))

const money = (v) => `$${Math.round(Number(v) || 0).toLocaleString('es-CO')}`
const formatDateTime = (d) => new Date(d).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' })
const bookingDate = () => props.accommodation?.date
  ? new Date(props.accommodation.date).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
  : ''

function methodName(m) {
  if (m.method_type === 'bold') return 'Link de pago Bold (QR, Nequi, PSE, tarjeta)'
  if (m.method_type === 'breb') return `Llave Bre-B${m.account_info ? `: ${m.account_info}` : ''}`
  return m.account_info ? `${m.label}: ${m.account_info}` : m.label
}

function buildMessage() {
  const m = method.value
  if (!m) return ''
  const name = String(props.accommodation?.customer_data?.fullname || '').trim().split(/\s+/)[0]
  const venue = props.accommodation?.venue_data?.name || 'la cabaña'
  const date = bookingDate()
  const what = amount.value < props.balance ? 'un abono al saldo' : 'el saldo'
  const intro = `¡Hola${name ? `, ${name}` : ''}! 👋 Te comparto cómo pagar ${what} de tu alquiler en ${venue}${date ? ` del ${date}` : ''}: *${money(amount.value)}*.`
  if (m.method_type === 'bold') {
    return `${intro}\n\n👉 Paga aquí: ${link.value.url}\n\nPuedes pagar con QR Bre-B, Nequi, PSE, Botón Bancolombia o tarjeta. `
      + 'Si estás en un computador, escanea el código QR con tu celular. ¡Gracias!'
  }
  const lines = [intro, '']
  if (m.method_type === 'breb') {
    lines.push(`Transfiere desde la app de tu banco a la llave Bre-B: *${m.account_info || ''}*`)
    if (m.qr_image_url) lines.push('o escanea el código QR.')
  } else {
    lines.push(`${m.label}${m.account_info ? `: *${m.account_info}*` : ''}`)
  }
  if (m.holder_name) lines.push(`A nombre de: ${m.holder_name}`)
  if (m.instructions) lines.push('', m.instructions)
  lines.push('', 'Cuando hagas el pago, envíanos el comprobante por aquí. ¡Gracias!')
  return lines.join('\n')
}

function resetResult() {
  link.value = null
  qrDataUrl.value = ''
  error.value = ''
  imageError.value = ''
  message.value = ready.value ? buildMessage() : ''
}

async function load() {
  if (!venueId.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/venues/${venueId.value}/payment-methods`, { credentials: 'include' })
    if (!res.ok) throw new Error('No se pudieron cargar los métodos de pago')
    const all = (await res.json()).filter(m => m.is_active && m.method_type !== 'cash')
    // Bre-B first: it is what most guests use for a transfer.
    const order = (m) => (m.method_type === 'breb' ? 0 : m.method_type === 'bold' ? 1 : 2)
    methods.value = all.sort((a, b) => order(a) - order(b))
    methodId.value = methods.value[0]?.id || ''
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createLink() {
  creating.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/accommodations/${props.accommodation.id}/payment-link`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount.value })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo crear el link de pago')
    qrDataUrl.value = await QRCode.toDataURL(data.url, { width: 480, margin: 2, errorCorrectionLevel: 'M' })
    link.value = data
    message.value = buildMessage()
  } catch (err) {
    error.value = err.message
  } finally {
    creating.value = false
  }
}

function flash(what) {
  copied.value = what
  setTimeout(() => { if (copied.value === what) copied.value = '' }, 2000)
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(message.value)
    flash('message')
  } catch {
    // Clipboard blocked: the text stays in the box to copy by hand.
  }
}

/** The image as PNG, the only image type browsers can put on the clipboard. */
async function pngBlob(src) {
  const blob = await (await fetch(src)).blob()
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}

async function copyImage() {
  imageError.value = ''
  try {
    // The promise goes straight into the ClipboardItem so Safari keeps the click gesture.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob(imageSrc.value) })])
    flash('image')
  } catch {
    imageError.value = 'Tu navegador no deja copiar la imagen: usa Descargar.'
  }
}

watch(() => props.visible, (open) => {
  if (!open) return
  amount.value = Math.max(0, Math.round(props.balance))
  link.value = null
  qrDataUrl.value = ''
  message.value = ''
  load().then(resetResult)
})
watch(methodId, resetResult)
</script>

<style scoped>
.collect-qr {
  width: 100%;
  max-width: 260px;
}
</style>
