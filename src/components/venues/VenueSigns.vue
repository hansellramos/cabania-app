<template>
  <div>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h6 class="mb-0">Avisos con código QR</h6>
        <small class="text-body-secondary">Imprime avisos para la vía, la entrada o las mesas y mira cuántas personas los escanean.</small>
      </div>
      <CButton color="primary" size="sm" @click="openForm()">
        <CIcon icon="cilPlus" size="sm" class="me-1" />Nuevo aviso
      </CButton>
    </div>

    <CAlert v-if="error" color="danger" class="py-2 small">{{ error }}</CAlert>

    <!-- WiFi network: the WiFi sign and the AI assistant use it -->
    <CCard class="mb-3">
      <CCardBody class="py-2">
        <CForm class="row g-2 align-items-end" @submit.prevent="saveWifi">
          <div class="col-12 col-md-auto">
            <strong class="small d-block mb-1"><CIcon icon="cilWifiSignal4" size="sm" class="me-1" />Red WiFi de la cabaña</strong>
          </div>
          <div class="col-6 col-md">
            <CFormInput v-model="wifi.ssid" size="sm" placeholder="Nombre de la red" aria-label="Nombre de la red WiFi" maxlength="100" />
          </div>
          <div class="col-6 col-md">
            <CFormInput v-model="wifi.password" size="sm" placeholder="Clave (vacía si es abierta)" aria-label="Clave del WiFi" maxlength="100" autocomplete="off" />
          </div>
          <div class="col-12 col-md-auto">
            <CButton type="submit" color="primary" variant="outline" size="sm" :disabled="busy === 'wifi' || !wifiChanged">
              {{ wifiSaved ? 'Guardado' : 'Guardar' }}
            </CButton>
          </div>
        </CForm>
      </CCardBody>
    </CCard>

    <div v-if="loading" class="text-center py-4"><CSpinner size="sm" color="primary" /></div>
    <div v-else-if="!signs.length" class="text-center text-body-secondary py-4">
      Todavía no hay avisos. Crea el primero: un pasacalles para la vía, un aviso de mesa o la tarjeta del WiFi.
    </div>

    <CRow v-else class="g-3">
      <CCol v-for="sign in signs" :key="sign.id" :xs="12" :md="6" :xl="4">
        <CCard class="h-100">
          <div class="sign-preview" :class="{ banner: sign.size === 'banner_3x1' }" v-html="fit(previews[sign.id])" />
          <CCardBody class="d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
              <strong>{{ sign.name }}</strong>
              <CBadge :color="SIGN_KINDS[sign.kind].color">{{ SIGN_KINDS[sign.kind].label }}</CBadge>
            </div>
            <small class="text-body-secondary mb-2">{{ SIGN_SIZES[sign.size].label }}</small>

            <CAlert v-if="problem(sign)" color="warning" class="py-1 px-2 small mb-2">{{ problem(sign) }}</CAlert>

            <div v-if="sign.kind !== 'wifi'" class="d-flex gap-3 small mb-2">
              <div><div class="fs-5 fw-semibold">{{ sign.scans.total }}</div><span class="text-body-secondary">escaneos</span></div>
              <div><div class="fs-5 fw-semibold">{{ sign.scans.last7 }}</div><span class="text-body-secondary">últimos 7 días</span></div>
              <div><div class="fs-5 fw-semibold">{{ sign.scans.last30 }}</div><span class="text-body-secondary">últimos 30 días</span></div>
            </div>
            <small v-else class="text-body-secondary mb-2">El QR del WiFi conecta directo a la red, así que no se pueden contar los escaneos.</small>

            <small v-if="sign.short_url" class="mb-2 text-truncate">
              <a :href="sign.short_url" target="_blank" rel="noopener">{{ sign.short_url.replace(/^https?:\/\//, '') }}</a>
              <CButton color="link" size="sm" class="p-0 ms-1 align-baseline" @click="copyLink(sign)">{{ copiedId === sign.id ? 'Copiado' : 'Copiar' }}</CButton>
            </small>

            <div class="mt-auto d-flex flex-wrap gap-1">
              <CButton color="primary" size="sm" :disabled="!sign.qr_text" @click="print(sign)">
                <CIcon icon="cilPrint" size="sm" class="me-1" />Imprimir
              </CButton>
              <CButton color="primary" variant="outline" size="sm" :disabled="!sign.qr_text" @click="download(sign)">
                <CIcon icon="cilCloudDownload" size="sm" class="me-1" />Archivo
              </CButton>
              <CButton v-if="sign.kind !== 'wifi'" color="secondary" variant="outline" size="sm" @click="openScans(sign)">Escaneos</CButton>
              <CButton color="secondary" variant="ghost" size="sm" @click="openForm(sign)">Editar</CButton>
              <CButton color="danger" variant="ghost" size="sm" :disabled="busy === sign.id" @click="remove(sign)">
                {{ confirmDelete === sign.id ? '¿Eliminar?' : 'Eliminar' }}
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <!-- Create / edit -->
    <CModal :visible="formOpen" size="lg" alignment="center" @close="formOpen = false">
      <CModalHeader><CModalTitle>{{ form.id ? 'Editar aviso' : 'Nuevo aviso' }}</CModalTitle></CModalHeader>
      <CModalBody>
        <CRow class="g-3">
          <CCol :md="6">
            <div class="mb-3">
              <CFormLabel for="signName">Nombre (solo para ti)</CFormLabel>
              <CFormInput id="signName" v-model="form.name" maxlength="100" placeholder="Ej: Pasacalles vía principal" />
            </div>
            <div class="mb-3">
              <CFormLabel class="d-block">¿A dónde lleva el QR?</CFormLabel>
              <div class="d-flex flex-wrap gap-1">
                <CButton
                  v-for="(meta, kind) in SIGN_KINDS"
                  :key="kind"
                  type="button"
                  size="sm"
                  :color="meta.color"
                  :variant="form.kind === kind ? undefined : 'outline'"
                  :aria-pressed="form.kind === kind"
                  :disabled="!!form.id && (form.kind === 'wifi') !== (kind === 'wifi')"
                  @click="form.kind = kind"
                >
                  <CIcon :icon="meta.icon" size="sm" class="me-1" />{{ meta.label }}
                </CButton>
              </div>
              <div class="form-text">{{ kindHelp }}</div>
            </div>
            <div v-if="form.kind === 'whatsapp'" class="mb-3">
              <CFormLabel for="signTarget">Primer mensaje</CFormLabel>
              <CFormTextarea id="signTarget" v-model="form.target" rows="2" :placeholder="`Hola, vi su aviso de ${venueInfo.name || 'la cabaña'} y quiero información.`" />
            </div>
            <div v-if="form.kind === 'url'" class="mb-3">
              <CFormLabel for="signUrl">Dirección</CFormLabel>
              <CFormInput id="signUrl" v-model="form.target" type="url" placeholder="https://" />
            </div>
            <div class="mb-3">
              <CFormLabel for="signHeadline">Texto grande</CFormLabel>
              <CFormInput id="signHeadline" v-model="form.headline" maxlength="80" :placeholder="SIGN_KINDS[form.kind].headline" />
            </div>
            <div class="mb-1">
              <CFormLabel for="signSize">Tamaño</CFormLabel>
              <CFormSelect id="signSize" v-model="form.size">
                <option v-for="(meta, size) in SIGN_SIZES" :key="size" :value="size">{{ meta.label }}</option>
              </CFormSelect>
            </div>
          </CCol>
          <CCol :md="6">
            <CFormLabel class="d-block">Vista previa</CFormLabel>
            <div class="sign-preview border rounded" :class="{ banner: form.size === 'banner_3x1' }" v-html="fit(formPreview)" />
            <div class="form-text">El QR de la vista previa es de ejemplo hasta que guardes el aviso.</div>
          </CCol>
        </CRow>
        <CAlert v-if="formError" color="danger" class="py-2 small mt-3 mb-0">{{ formError }}</CAlert>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" @click="formOpen = false">Cancelar</CButton>
        <CButton color="primary" :disabled="busy === 'form' || !form.name.trim()" @click="saveForm">
          {{ form.id ? 'Guardar' : 'Crear aviso' }}
        </CButton>
      </CModalFooter>
    </CModal>

    <!-- Scans -->
    <CModal :visible="!!scansFor" alignment="center" @close="scansFor = null">
      <CModalHeader><CModalTitle>Escaneos · {{ scansFor?.name }}</CModalTitle></CModalHeader>
      <CModalBody>
        <div v-if="!scans" class="text-center py-3"><CSpinner size="sm" color="primary" /></div>
        <template v-else>
          <p class="mb-2">
            <strong>{{ scansTotal }}</strong> escaneos en los últimos {{ scans.days }} días
            <span v-if="scansTotal" class="text-body-secondary">
              · {{ deviceSummary }}
            </span>
          </p>
          <CTable v-if="scans.per_day.length" small class="mb-0">
            <CTableHead>
              <CTableRow><CTableHeaderCell>Día</CTableHeaderCell><CTableHeaderCell class="text-end">Escaneos</CTableHeaderCell></CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="row in [...scans.per_day].reverse()" :key="row.day">
                <CTableDataCell>{{ formatDay(row.day) }}</CTableDataCell>
                <CTableDataCell class="text-end">{{ row.scans }}</CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
          <p v-else class="text-body-secondary mb-0">Nadie lo ha escaneado todavía.</p>
        </template>
      </CModalBody>
    </CModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCol, CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { SIGN_KINDS, SIGN_SIZES, signSvg, printSign, downloadSign } from '@/utils/signArtwork'
import { copyText } from '@/utils/contactLinks'

const props = defineProps({
  venueId: { type: String, required: true },
})

const signs = ref([])
const venueInfo = ref({})
const previews = reactive({})
const loading = ref(true)
const error = ref('')
const busy = ref(null)
const copiedId = ref(null)
const confirmDelete = ref(null)

async function api(method, path, body) {
  const res = await fetch(`/api/venues/${props.venueId}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción')
  return data
}

const artwork = (sign) => signSvg({
  sign,
  venueName: venueInfo.value.name || '',
  qrText: sign.qr_text,
  shortUrl: sign.short_url,
  wifi: { ssid: venueInfo.value.wifi_ssid, password: venueInfo.value.wifi_password },
})

/** The sign scaled to its box for the screen (the printed file keeps its size in mm). */
const fit = (svg) => String(svg || '').replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%" height="100%"')

async function renderPreviews() {
  for (const sign of signs.value) previews[sign.id] = sign.qr_text ? await artwork(sign) : ''
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api('GET', '/signs')
    venueInfo.value = data.venue
    signs.value = data.signs
    wifi.ssid = data.venue.wifi_ssid || ''
    wifi.password = data.venue.wifi_password || ''
    await renderPreviews()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

/** Why a sign's QR does not lead anywhere yet, or ''. */
function problem(sign) {
  if (sign.kind === 'wifi') return venueInfo.value.wifi_ssid ? '' : 'Escribe arriba el nombre de la red WiFi para generar el QR.'
  if (sign.destination) return ''
  if (sign.kind === 'public_page') return 'La página pública está apagada: el QR lleva al inicio de CabanIA hasta que la publiques (Editar cabaña).'
  if (sign.kind === 'whatsapp') return 'La cabaña no tiene número de WhatsApp: agrégalo en Editar cabaña.'
  if (sign.kind === 'instagram') return 'La cabaña no tiene Instagram: agrégalo en Editar cabaña.'
  return 'Revisa la dirección del aviso.'
}

// WiFi network
const wifi = reactive({ ssid: '', password: '' })
const wifiSaved = ref(false)
const wifiChanged = computed(() => wifi.ssid.trim() !== (venueInfo.value.wifi_ssid || '') || wifi.password !== (venueInfo.value.wifi_password || ''))
async function saveWifi() {
  busy.value = 'wifi'
  error.value = ''
  try {
    const res = await fetch(`/api/venues/${props.venueId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wifi_ssid: wifi.ssid.trim() || null, wifi_password: wifi.password || null }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar el WiFi')
    await load()
    wifiSaved.value = true
    setTimeout(() => { wifiSaved.value = false }, 2000)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = null
  }
}

// Create / edit
const emptyForm = () => ({ id: null, name: '', kind: 'public_page', headline: '', target: '', size: 'letter' })
const form = ref(emptyForm())
const formOpen = ref(false)
const formError = ref('')
const formPreview = ref('')

const kindHelp = computed(() => ({
  public_page: 'Abre la página pública de la cabaña, con planes, precios y disponibilidad.',
  whatsapp: 'Abre un chat de WhatsApp con la cabaña y el primer mensaje escrito.',
  instagram: 'Abre el perfil de Instagram de la cabaña.',
  url: 'Abre cualquier enlace, por ejemplo un video o un formulario.',
  wifi: 'El celular se conecta solo a la red. El nombre de la red y la clave se imprimen debajo.',
}[form.value.kind]))

function openForm(sign) {
  form.value = sign
    ? { id: sign.id, name: sign.name, kind: sign.kind, headline: sign.headline || '', target: sign.target || '', size: sign.size }
    : emptyForm()
  formError.value = ''
  formOpen.value = true
}

watch(form, async (f) => {
  const saved = f.id && signs.value.find(s => s.id === f.id)
  const sample = f.kind === 'wifi'
    ? (venueInfo.value.wifi_ssid ? `WIFI:T:WPA;S:${venueInfo.value.wifi_ssid};;` : 'WIFI:T:nopass;S:red;;')
    : (saved?.qr_text || `${window.location.origin}/q/ejemplo`)
  const shortUrl = f.kind === 'wifi' ? null : (saved?.short_url || `${window.location.origin}/q/ejemplo`)
  formPreview.value = await signSvg({
    sign: f,
    venueName: venueInfo.value.name || '',
    qrText: sample,
    shortUrl,
    wifi: { ssid: venueInfo.value.wifi_ssid || 'Nombre de la red', password: venueInfo.value.wifi_password || '' },
  })
}, { deep: true })

async function saveForm() {
  busy.value = 'form'
  formError.value = ''
  try {
    const { id, ...body } = form.value
    if (id) await api('PUT', `/signs/${id}`, body)
    else await api('POST', '/signs', body)
    formOpen.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    busy.value = null
  }
}

async function remove(sign) {
  if (confirmDelete.value !== sign.id) {
    confirmDelete.value = sign.id
    setTimeout(() => { if (confirmDelete.value === sign.id) confirmDelete.value = null }, 4000)
    return
  }
  busy.value = sign.id
  try {
    await api('DELETE', `/signs/${sign.id}`)
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = null
    confirmDelete.value = null
  }
}

// Print / download
const fileName = (sign) => `aviso-${(sign.name || 'qr').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.svg`
async function print(sign) {
  if (!printSign(await artwork(sign), sign.size, sign.name)) error.value = 'El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para CabanIA.'
}
async function download(sign) {
  downloadSign(await artwork(sign), fileName(sign))
}
async function copyLink(sign) {
  if (!(await copyText(sign.short_url))) return
  copiedId.value = sign.id
  setTimeout(() => { copiedId.value = null }, 2000)
}

// Scans
const scansFor = ref(null)
const scans = ref(null)
async function openScans(sign) {
  scansFor.value = sign
  scans.value = null
  try {
    scans.value = await api('GET', `/signs/${sign.id}/scans?days=30`)
  } catch (e) {
    scansFor.value = null
    error.value = e.message
  }
}
const scansTotal = computed(() => (scans.value?.per_day || []).reduce((sum, r) => sum + r.scans, 0))
const deviceSummary = computed(() => {
  const names = { ios: 'iPhone', android: 'Android', other: 'otros' }
  return (scans.value?.per_device || []).map(d => `${d.scans} ${names[d.device] || d.device}`).join(', ')
})
const formatDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

onMounted(load)
</script>

<style scoped>
.sign-preview {
  background: var(--cui-tertiary-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  aspect-ratio: 4 / 3;
}
.sign-preview.banner {
  aspect-ratio: 3 / 1.4;
}
.sign-preview :deep(svg) {
  display: block;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2));
}
</style>
