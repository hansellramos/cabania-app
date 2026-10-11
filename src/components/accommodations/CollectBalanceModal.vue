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
            <CCol sm="6">
              <CFormLabel for="collect-method" class="small mb-1">Cómo te paga</CFormLabel>
              <CFormSelect id="collect-method" v-model="methodId">
                <option v-for="m in methods" :key="m.id" :value="m.id">{{ methodName(m) }}</option>
              </CFormSelect>
            </CCol>
            <CCol sm="6">
              <CFormLabel for="collect-choice" class="small mb-1">Del alquiler</CFormLabel>
              <CFormSelect id="collect-choice" v-model="choice">
                <option value="balance">El saldo: {{ money(balance) }}</option>
                <option value="other">Otro valor</option>
              </CFormSelect>
              <CInputGroup v-if="choice === 'other'" size="sm" class="mt-1">
                <CInputGroupText>$</CInputGroupText>
                <CFormInput id="collect-amount" v-model.number="otherAmount" type="number" min="0" :max="balance" step="1000" aria-label="Monto del alquiler" />
              </CInputGroup>
              <small v-if="choice === 'other' && otherAmount > balance" class="text-danger">Supera el saldo ({{ money(balance) }})</small>
              <CFormCheck
                v-if="depositAvailable"
                id="collect-include-deposit"
                v-model="includeDeposit"
                class="mt-2"
                :label="`Incluir depósito de garantía (${money(depositAmount)})`"
              />
              <div v-if="depositPart" class="small mt-1">Total a cobrar: <strong>{{ money(amount) }}</strong></div>
            </CCol>
          </CRow>

          <div v-if="isBold && !link" class="text-center py-2">
            <p class="small text-body-secondary mb-2">
              Se crea un link de pago de Bold por {{ money(amount) }} (QR Bre-B, Nequi, PSE, tarjeta).
              Cuando el cliente paga, el pago queda registrado solo en este alquiler.
            </p>
            <CButton color="primary" :disabled="creating || !validAmount" @click="createLink()">
              <CSpinner v-if="creating" size="sm" class="me-1" />Generar link y QR
            </CButton>
          </div>
          <div v-if="error" class="text-danger small mt-2">{{ error }}</div>

          <CRow v-if="ready" class="g-3">
            <CCol md="5" class="text-center">
              <CButtonGroup v-if="isBold && link?.qr_available" size="sm" class="mb-2" role="group" aria-label="Tipo de QR">
                <CButton color="primary" :variant="boldMode === 'link' ? undefined : 'outline'" @click="setBoldMode('link')">Link de pago</CButton>
                <CButton color="primary" :variant="boldMode === 'qr' ? undefined : 'outline'" :disabled="creating" @click="setBoldMode('qr')">
                  <CSpinner v-if="creating && boldMode === 'qr'" size="sm" class="me-1" />QR Bre-B
                </CButton>
              </CButtonGroup>
              <small v-if="isBold && boldMode === 'qr' && breBQr" class="d-block mb-2" :class="qrSecondsLeft > 0 ? 'text-body-secondary' : 'text-danger'">
                <template v-if="qrSecondsLeft > 0">Vence en {{ countdown }}: se escanea desde la app de cualquier banco.</template>
                <template v-else>
                  Este QR venció.
                  <CButton color="link" size="sm" class="p-0 align-baseline" @click="createLink('qr')">Generar otro</CButton>
                </template>
              </small>
              <template v-if="imageSrc">
                <img :src="imageSrc" alt="Código QR de pago" class="collect-qr img-thumbnail" />
                <div class="d-flex justify-content-center gap-2 mt-2">
                  <CButton color="primary" variant="outline" size="sm" @click="copyQr">
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
                <template v-else> Cuando te llegue el pago, regístralo{{ depositPart ? ' (el depósito queda separado)' : '' }}:</template>
              </small>
              <CButton v-if="!link" color="primary" variant="ghost" size="sm" class="px-0" @click="registerPayment">
                Registrar el pago recibido
              </CButton>
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
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { CIcon } from '@coreui/icons-vue'
import { whatsappUrl } from '@/utils/contactLinks'
import { copyImage } from '@/utils/clipboardImage'

const props = defineProps({
  visible: { type: Boolean, default: false },
  accommodation: { type: Object, default: null },
  balance: { type: Number, default: 0 },
  // The booking already has its security deposit registered.
  hasDeposit: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])
const router = useRouter()

const loading = ref(false)
const methods = ref([])
const methodId = ref('')
// What is collected: the balance (or another amount) plus, usually, the security deposit.
const choice = ref('balance')
const otherAmount = ref(0)
const includeDeposit = ref(false)
const depositAmount = ref(0)
const link = ref(null)
const qrDataUrl = ref('')
const creating = ref(false)
const error = ref('')
const imageError = ref('')
const message = ref('')
const copied = ref('')
// Bold: 'link' is a QR of the checkout page; 'qr' is Bold's QR Bre-B (10 minutes).
const boldMode = ref('link')
const breBQr = ref(null)
const now = ref(Date.now())
let timer = null

const venueId = computed(() => props.accommodation?.venue_data?.id || props.accommodation?.venue || null)
const method = computed(() => methods.value.find(m => m.id === methodId.value) || null)
const isBold = computed(() => method.value?.method_type === 'bold')
const depositAvailable = computed(() => !props.hasDeposit && depositAmount.value > 0)
const depositPart = computed(() => (depositAvailable.value && includeDeposit.value ? depositAmount.value : 0))
const rentalPart = computed(() => (choice.value === 'balance' ? props.balance : Math.round(Number(otherAmount.value) || 0)))
const amount = computed(() => rentalPart.value + depositPart.value)
const validAmount = computed(() => amount.value >= 1000 && rentalPart.value >= 0 && rentalPart.value <= props.balance)
const ready = computed(() => !!method.value && (isBold.value ? !!link.value : validAmount.value))
const imageSrc = computed(() => {
  if (!isBold.value) return method.value?.qr_image_url || ''
  return boldMode.value === 'qr' ? breBQr.value?.qr_image_url || '' : qrDataUrl.value
})
const qrSecondsLeft = computed(() => breBQr.value
  ? Math.max(0, Math.floor((new Date(breBQr.value.qr_expires_at).getTime() - now.value) / 1000))
  : 0)
const countdown = computed(() => `${Math.floor(qrSecondsLeft.value / 60)}:${String(qrSecondsLeft.value % 60).padStart(2, '0')}`)
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
  const balancePart = amount.value - depositPart.value
  const where = `tu alquiler en ${venue}${date ? ` del ${date}` : ''}`
  const hello = `¡Hola${name ? `, ${name}` : ''}! 👋`
  let intro
  if (depositPart.value && balancePart > 0) {
    intro = `${hello} Te comparto cómo pagar ${where}:\n`
      + `• ${balancePart < props.balance ? 'Abono al saldo' : 'Saldo'}: ${money(balancePart)}\n`
      + `• Depósito de garantía (se devuelve después de tu estadía): ${money(depositPart.value)}\n`
      + `Total: *${money(amount.value)}*`
  } else if (depositPart.value) {
    intro = `${hello} Te comparto cómo pagar el depósito de garantía de ${where} (se devuelve después de tu estadía): *${money(amount.value)}*.`
  } else {
    intro = `${hello} Te comparto cómo pagar ${balancePart < props.balance ? 'un abono al saldo' : 'el saldo'} de ${where}: *${money(amount.value)}*.`
  }
  if (m.method_type === 'bold' && boldMode.value === 'qr' && breBQr.value) {
    const until = new Date(breBQr.value.qr_expires_at)
      .toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' })
    return `${intro}\n\n📲 Escanea el código QR desde la app de tu banco (Bre-B). Vence a las ${until}.`
      + `\n\nSi se te pasa la hora, también puedes pagar aquí: ${link.value.url}\n\n¡Gracias!`
  }
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
  breBQr.value = null
  boldMode.value = 'link'
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
    if (!props.hasDeposit) {
      const calc = await fetch(`/api/accommodations/${props.accommodation.id}/deposit-calculation`, { credentials: 'include' })
      depositAmount.value = calc.ok ? Math.round(Number((await calc.json()).calculated_amount) || 0) : 0
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createLink(format) {
  creating.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/accommodations/${props.accommodation.id}/payment-link`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount.value,
        include_deposit: depositPart.value > 0,
        deposit_amount: depositPart.value || undefined,
        format
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo crear el cobro')
    if (format === 'qr') {
      breBQr.value = data
      boldMode.value = 'qr'
    } else {
      qrDataUrl.value = await QRCode.toDataURL(data.url, { width: 480, margin: 2, errorCorrectionLevel: 'M' })
    }
    link.value = data
    message.value = buildMessage()
  } catch (err) {
    error.value = err.message
  } finally {
    creating.value = false
  }
}

function setBoldMode(mode) {
  if (mode === 'qr' && (!breBQr.value || qrSecondsLeft.value <= 0)) {
    createLink('qr')
    return
  }
  boldMode.value = mode
  message.value = buildMessage()
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

async function copyQr() {
  imageError.value = ''
  if (await copyImage(imageSrc.value)) flash('image')
  else imageError.value = 'Tu navegador no deja copiar la imagen: usa Descargar.'
}

watch(() => props.visible, (open) => {
  clearInterval(timer)
  if (!open) return
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  depositAmount.value = 0
  link.value = null
  qrDataUrl.value = ''
  message.value = ''
  load().then(() => {
    choice.value = 'balance'
    otherAmount.value = props.balance
    includeDeposit.value = depositAvailable.value
    resetResult()
  })
})
watch([methodId, choice, otherAmount, includeDeposit], resetResult)

/** Open the payment form with this collection already filled in. */
function registerPayment() {
  const m = method.value
  const query = { accommodation_id: props.accommodation.id, amount: String(amount.value) }
  if (depositPart.value) query.deposit = String(depositPart.value)
  // The payment form's method list.
  const FORM_METHOD = { breb: 'Bre-B', nequi: 'Nequi', daviplata: 'Daviplata', bancolombia: 'Transferencia bancaria', davivienda: 'Transferencia bancaria', pse: 'PSE' }
  if (m) query.method = FORM_METHOD[m.method_type] || 'Otro'
  emit('close')
  router.push({ path: '/business/payments/new', query })
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.collect-qr {
  width: 100%;
  max-width: 260px;
}
</style>
