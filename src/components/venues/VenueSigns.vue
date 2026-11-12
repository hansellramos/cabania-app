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

    <!-- Logo and brand colors: the signs and the public page use them -->
    <CCard class="mb-3">
      <CCardBody class="py-2">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md">
            <strong class="small d-block">Logo y colores de la cabaña</strong>
            <small class="text-body-secondary">Los avisos y la página pública usan este logo y este degradado.</small>
          </div>
          <div class="col-auto d-flex align-items-center gap-2">
            <img v-if="brand.logo_url" :src="brand.logo_url" alt="Logo de la cabaña" class="brand-logo" />
            <CButton color="primary" variant="outline" size="sm" :disabled="busy === 'logo'" @click="logoInput?.click()">
              <CSpinner v-if="busy === 'logo'" size="sm" class="me-1" />{{ brand.logo_url ? 'Cambiar logo' : 'Subir logo' }}
            </CButton>
            <CButton v-if="brand.logo_url" color="danger" variant="ghost" size="sm" @click="brand.logo_url = ''">Quitar</CButton>
            <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" class="d-none" @change="uploadLogo" />
          </div>
          <div class="col-auto d-flex align-items-center gap-1">
            <input v-model="brand.primary" type="color" class="form-control form-control-color form-control-sm" title="Color principal" aria-label="Color principal" />
            <input v-model="brand.secondary" type="color" class="form-control form-control-color form-control-sm" title="Color secundario" aria-label="Color secundario" />
            <div class="brand-swatch rounded" :style="{ background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})` }" />
          </div>
          <div class="col-auto">
            <CButton color="primary" size="sm" :disabled="busy === 'brand' || !brandChanged" @click="saveBrand">
              {{ brandSaved ? 'Guardado' : 'Guardar' }}
            </CButton>
          </div>
        </div>
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
            <small v-if="sign.links?.length" class="text-body-secondary mb-2">
              <template v-if="sign.kind !== 'wifi' && sign.kind !== 'directory'">{{ SIGN_KINDS[sign.kind].label }} {{ sign.main_scans.total }} · </template>
              <template v-for="(link, i) in sign.links" :key="link.id">{{ i ? ' · ' : '' }}{{ link.title || EXTRA_QR_LABELS[link.kind] }} {{ link.scans.total }}</template>
            </small>

            <small v-if="sign.short_url" class="mb-2 text-truncate">
              <a :href="sign.short_url" target="_blank" rel="noopener">{{ sign.short_url.replace(/^https?:\/\//, '') }}</a>
              <CButton color="link" size="sm" class="p-0 ms-1 align-baseline" @click="copyLink(sign)">{{ copiedId === sign.id ? 'Copiado' : 'Copiar' }}</CButton>
            </small>

            <div class="mt-auto d-flex flex-wrap gap-1">
              <CButton color="primary" size="sm" :disabled="!hasArt(sign)" @click="print(sign)">
                <CIcon icon="cilPrint" size="sm" class="me-1" />Imprimir
              </CButton>
              <CButton color="primary" variant="outline" size="sm" :disabled="!hasArt(sign)" @click="download(sign)">
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
    <CModal teleport scrollable :visible="formOpen" size="lg" alignment="center" @close="formOpen = false">
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
                  :disabled="!!form.id && form.kind !== kind && (FIXED_KINDS.includes(form.kind) || FIXED_KINDS.includes(kind))"
                  @click="pickKind(kind)"
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
            <div v-if="form.kind === 'directory'" class="mb-3">
              <CFormLabel class="d-block">Filas del directorio <span class="text-body-secondary fw-normal">(hasta 6)</span></CFormLabel>
              <div v-for="(row, i) in form.links" :key="row.key" class="directory-row rounded p-2 mb-2">
                <div class="d-flex gap-1 mb-1">
                  <CFormInput v-model="row.title" size="sm" maxlength="60" :placeholder="`Título, ej: ${ROW_EXAMPLES[i % ROW_EXAMPLES.length]}`" />
                  <CButton color="secondary" variant="ghost" size="sm" :disabled="i === 0" title="Subir" @click="moveRow(i, -1)">↑</CButton>
                  <CButton color="secondary" variant="ghost" size="sm" :disabled="i === form.links.length - 1" title="Bajar" @click="moveRow(i, 1)">↓</CButton>
                  <CButton color="danger" variant="ghost" size="sm" title="Quitar fila" @click="form.links.splice(i, 1)">✕</CButton>
                </div>
                <CFormInput v-model="row.subtitle" size="sm" maxlength="120" class="mb-1" placeholder="Línea debajo (opcional), ej: Todos los días de 7 a.m. a 9 p.m." />
                <div class="d-flex gap-1">
                  <CFormSelect v-model="row.kind" size="sm" style="max-width: 11rem;" aria-label="Qué hace el QR">
                    <option v-for="(meta, kind) in DIRECTORY_ROW_KINDS" :key="kind" :value="kind">{{ meta.label }}</option>
                  </CFormSelect>
                  <CFormInput
                    v-if="row.kind === 'whatsapp' || row.kind === 'call'"
                    v-model="row.phone"
                    size="sm"
                    inputmode="tel"
                    maxlength="20"
                    :placeholder="venueInfo.whatsapp_display ? `Teléfono (vacío = ${venueInfo.whatsapp_display})` : 'Teléfono'"
                  />
                  <CFormInput v-else-if="row.kind === 'url'" v-model="row.target" size="sm" type="url" placeholder="https://" />
                </div>
                <CFormInput
                  v-if="row.kind === 'whatsapp'"
                  v-model="row.target"
                  size="sm"
                  class="mt-1"
                  :placeholder="row.phone ? `Primer mensaje (opcional): Hola, te escribo desde ${venueInfo.name || 'la cabaña'}.` : 'Primer mensaje (opcional)'"
                />
                <div v-if="rowProblem(row)" class="small text-warning mt-1">{{ rowProblem(row) }}</div>
              </div>
              <CButton color="primary" variant="outline" size="sm" :disabled="form.links.length >= 6" @click="addRow">+ Agregar fila</CButton>
              <div class="form-text">Cada fila lleva su QR, con su título y teléfono al lado. Los escaneos de cada fila se cuentan aparte.</div>
            </div>
            <div v-else class="mb-3">
              <CFormLabel class="d-block">QR pequeños <span class="text-body-secondary fw-normal">(opcional, hasta 2)</span></CFormLabel>
              <div class="d-flex flex-wrap gap-1">
                <CButton
                  v-for="(label, kind) in EXTRA_QR_LABELS"
                  :key="kind"
                  type="button"
                  size="sm"
                  :color="SIGN_KINDS[kind].color"
                  :variant="hasExtra(kind) ? undefined : 'outline'"
                  :aria-pressed="hasExtra(kind)"
                  :disabled="!hasExtra(kind) && (form.links.length >= 2 || kind === form.kind)"
                  @click="toggleExtra(kind)"
                >
                  <CIcon :icon="SIGN_KINDS[kind].icon" size="sm" class="me-1" />{{ label }}
                </CButton>
              </div>
              <div class="form-text">Van debajo del QR grande, cada uno con su nombre, y sus escaneos se cuentan aparte.</div>
              <div v-for="link in form.links.filter(l => l.kind === 'url')" :key="'u' + link.kind" class="mt-2">
                <CFormInput v-model="link.target" type="url" size="sm" placeholder="https:// (dirección del QR pequeño)" />
              </div>
              <div v-if="extraProblem" class="small text-warning mt-1">{{ extraProblem }}</div>
            </div>
            <div v-if="venueInfo.ai_available" class="ai-box rounded p-2 mb-3">
              <CFormLabel for="signIdea" class="small fw-semibold mb-1">
                <CIcon icon="cilLightbulb" size="sm" class="me-1" />Escribir con IA
              </CFormLabel>
              <div class="d-flex gap-1">
                <CFormInput
                  id="signIdea"
                  v-model="aiIdea"
                  size="sm"
                  maxlength="500"
                  placeholder="Ej: domicilios al 300 123 4567, de 8 a.m. a 9 p.m."
                  @keydown.enter.prevent="suggest"
                />
                <CButton color="primary" size="sm" class="text-nowrap" :disabled="busy === 'ai'" @click="suggest">
                  <CSpinner v-if="busy === 'ai'" size="sm" class="me-1" />{{ form.headline ? 'Otra idea' : 'Sugerir' }}
                </CButton>
              </div>
              <div class="form-text">Escribe qué quieres decir (o déjalo vacío) y la IA propone el texto grande y el adicional.</div>
              <div v-if="aiError" class="small text-danger mt-1">{{ aiError }}</div>
            </div>
            <div class="mb-3">
              <CFormLabel for="signHeadline">Texto grande</CFormLabel>
              <CFormInput id="signHeadline" v-model="form.headline" maxlength="80" :placeholder="SIGN_KINDS[form.kind].headline" />
            </div>
            <div class="mb-3">
              <CFormLabel for="signBody">Texto adicional <span class="text-body-secondary fw-normal">(opcional)</span></CFormLabel>
              <CFormTextarea id="signBody" v-model="form.body" rows="2" maxlength="300" placeholder="Ej: Domicilios 300 123 4567&#10;Todos los días de 8 a.m. a 9 p.m." />
              <div class="form-text">Va debajo del QR. Cada renglón que escribas sale en su propia línea.</div>
            </div>
            <div class="mb-3">
              <CFormLabel class="d-block">Fondo</CFormLabel>
              <CButtonGroup size="sm" role="group" aria-label="Fondo del aviso">
                <CButton
                  v-for="(meta, style) in SIGN_STYLES"
                  :key="style"
                  type="button"
                  color="primary"
                  :variant="form.style === style ? undefined : 'outline'"
                  :aria-pressed="form.style === style"
                  @click="form.style = style"
                >{{ meta.label }}</CButton>
              </CButtonGroup>
              <div v-if="!venueInfo.logo_url || !venueInfo.colors?.primary" class="form-text">
                {{ brandHint }}
              </div>
            </div>
            <div class="mb-1">
              <CFormLabel for="signSize">Tamaño</CFormLabel>
              <CFormSelect id="signSize" v-model="form.size">
                <option v-for="(meta, size) in SIGN_SIZES" :key="size" :value="size" :disabled="form.kind === 'directory' && size === 'banner_3x1'">{{ meta.label }}</option>
              </CFormSelect>
            </div>
            <CFormCheck
              id="signPoweredBy"
              v-model="form.powered_by"
              class="mt-3"
              label="Mostrar “Powered by CabanIA.app” abajo"
            />
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
    <CModal teleport scrollable :visible="!!scansFor" alignment="center" @close="scansFor = null">
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
          <p v-if="scans.per_qr?.length > 1" class="small mb-2">
            <template v-for="(qr, i) in scans.per_qr" :key="qr.id || 'main'">
              {{ i ? ' · ' : '' }}{{ qr.main ? `QR grande (${SIGN_KINDS[qr.kind].label})` : (qr.title || EXTRA_QR_LABELS[qr.kind]) }}: <strong>{{ qr.scans }}</strong>
            </template>
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
  CAlert, CBadge, CButton, CButtonGroup, CCard, CCardBody, CCol, CForm, CFormCheck, CFormInput, CFormLabel, CFormSelect, CFormTextarea,
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { DIRECTORY_ROW_KINDS, EXTRA_QR_LABELS, SIGN_KINDS, SIGN_SIZES, SIGN_STYLES, signSvg, printSign, downloadSign, logoDataUrl } from '@/utils/signArtwork'
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

const logo = ref(null)

/** What every sign of the venue shares: name, colors, logo, contact data. */
const venueArt = (wifiFallback = {}) => ({
  venueName: venueInfo.value.name || '',
  colors: venueInfo.value.colors,
  logo: logo.value,
  whatsapp: venueInfo.value.whatsapp_display,
  instagram: venueInfo.value.instagram_handle,
  wifi: { ssid: venueInfo.value.wifi_ssid || wifiFallback.ssid, password: venueInfo.value.wifi_password || wifiFallback.password },
})

const extrasOf = (sign) => (sign.links || []).map(l => ({ kind: l.kind, qrText: l.qr_text, shortUrl: l.short_url, title: l.title, subtitle: l.subtitle, phone: l.phone }))
// A directory has no main QR: it is drawn from its rows.
const hasArt = (sign) => !!sign.qr_text || (sign.kind === 'directory' && !!sign.links?.length)
const artwork = (sign) => signSvg({ ...venueArt(), sign, qrText: sign.qr_text, shortUrl: sign.short_url, extras: extrasOf(sign) })

/** The sign scaled to its box for the screen (the printed file keeps its size in mm). */
const fit = (svg) => String(svg || '').replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' width="100%" height="100%"')

async function renderPreviews() {
  for (const sign of signs.value) previews[sign.id] = hasArt(sign) ? await artwork(sign) : ''
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api('GET', '/signs')
    if (data.venue.logo_url !== venueInfo.value.logo_url) logo.value = await logoDataUrl(data.venue.logo_url)
    venueInfo.value = data.venue
    signs.value = data.signs
    resetBrand()
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
  if (sign.kind === 'directory') {
    const bad = (sign.links || []).find(l => !l.destination)
    return bad ? `La fila "${bad.title}" no lleva a ningún lado: ${rowProblem(bad) || 'revisa su teléfono o dirección.'}` : ''
  }
  if (sign.destination) return ''
  if (sign.kind === 'public_page') return 'La página pública está apagada: el QR lleva al inicio de CabanIA hasta que la publiques (Editar cabaña).'
  if (sign.kind === 'whatsapp') return 'La cabaña no tiene número de WhatsApp: agrégalo en Editar cabaña.'
  if (sign.kind === 'instagram') return 'La cabaña no tiene Instagram: agrégalo en Editar cabaña.'
  return 'Revisa la dirección del aviso.'
}

/** What an extra QR lacks to lead somewhere, or ''. */
function linkProblem(kind, info = venueInfo.value) {
  if (kind === 'whatsapp' && !info.has_whatsapp) return 'La cabaña no tiene número de WhatsApp: el QR pequeño de WhatsApp no funcionará hasta que lo agregues en Editar cabaña.'
  if (kind === 'instagram' && !info.has_instagram) return 'La cabaña no tiene Instagram: el QR pequeño de Instagram no funcionará hasta que lo agregues en Editar cabaña.'
  if (kind === 'public_page' && !info.is_public) return 'La página pública está apagada: el QR pequeño de reservas no funcionará hasta que la publiques.'
  return ''
}
const extraProblem = computed(() => form.value.links.map(l => linkProblem(l.kind)).find(Boolean) || '')
const hasExtra = (kind) => form.value.links.some(l => l.kind === kind)
function toggleExtra(kind) {
  const links = form.value.links
  const i = links.findIndex(l => l.kind === kind)
  if (i >= 0) links.splice(i, 1)
  else if (links.length < 2) links.push({ kind, target: '' })
}

// Logo and brand colors
const DEFAULT_COLORS = { primary: '#10b981', secondary: '#0ea5e9' }
const brand = reactive({ logo_url: '', primary: DEFAULT_COLORS.primary, secondary: DEFAULT_COLORS.secondary })
const brandSaved = ref(false)
const logoInput = ref(null)
const brandChanged = computed(() => {
  const v = venueInfo.value
  return (brand.logo_url || '') !== (v.logo_url || '')
    || brand.primary !== (v.colors?.primary || DEFAULT_COLORS.primary)
    || brand.secondary !== (v.colors?.secondary || DEFAULT_COLORS.secondary)
})
function resetBrand() {
  brand.logo_url = venueInfo.value.logo_url || ''
  brand.primary = venueInfo.value.colors?.primary || DEFAULT_COLORS.primary
  brand.secondary = venueInfo.value.colors?.secondary || DEFAULT_COLORS.secondary
}
async function uploadLogo(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { error.value = 'El logo no puede pesar más de 5 MB.'; return }
  busy.value = 'logo'
  error.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    body.append('type', 'venue')
    const res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.imageUrl) throw new Error(data.error || 'No se pudo subir el logo')
    brand.logo_url = data.imageUrl
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = null
  }
}
async function saveBrand() {
  busy.value = 'brand'
  error.value = ''
  try {
    const res = await fetch(`/api/venues/${props.venueId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: brand.logo_url || null, brand_color_primary: brand.primary, brand_color_secondary: brand.secondary }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar el logo y los colores')
    await load()
    brandSaved.value = true
    setTimeout(() => { brandSaved.value = false }, 2000)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = null
  }
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
// Signs whose kind cannot change once created: the WiFi card and the directory.
const FIXED_KINDS = ['wifi', 'directory']
const ROW_EXAMPLES = ['Domicilios tienda', 'Almuerzos', 'Comidas rápidas', 'Lavandería', 'Transporte', 'Administración']
let rowKey = 0
const newRow = () => ({ key: ++rowKey, kind: 'whatsapp', title: '', subtitle: '', phone: '', target: '' })
function addRow() {
  if (form.value.links.length < 6) form.value.links.push(newRow())
}
function moveRow(i, step) {
  const rows = form.value.links
  const [row] = rows.splice(i, 1)
  rows.splice(i + step, 0, row)
}
function pickKind(kind) {
  form.value.kind = kind
  if (kind === 'directory') {
    // The directory is portrait, and starts with one row to fill in.
    if (form.value.size === 'banner_3x1') form.value.size = 'letter'
    if (!form.value.links.length || form.value.links.some(l => !('title' in l))) form.value.links = [newRow()]
  } else if (form.value.links.some(l => 'title' in l)) {
    form.value.links = []
  }
}
/** What a directory row lacks to lead somewhere, or ''. */
function rowProblem(row) {
  if ((row.kind === 'whatsapp' || row.kind === 'call') && !String(row.phone || '').replace(/\D/g, '') && !venueInfo.value.has_whatsapp) {
    return 'Escribe el teléfono (la cabaña no tiene WhatsApp para usar el suyo).'
  }
  if (row.kind === 'url' && !/^https?:\/\/\S+$/i.test(row.target || '')) return 'Escribe una dirección que empiece por https://'
  return row.kind === 'public_page' || row.kind === 'instagram' ? linkProblem(row.kind) : ''
}

const emptyForm = () => ({ id: null, name: '', kind: 'public_page', headline: '', body: '', target: '', size: 'letter', style: 'gradient', powered_by: true, links: [] })
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
  directory: 'Un aviso vertical con varias filas, cada una con su QR, título y teléfono: domicilios, almuerzos, servicios…',
}[form.value.kind]))

function openForm(sign) {
  form.value = sign
    ? { id: sign.id, name: sign.name, kind: sign.kind, headline: sign.headline || '', body: sign.body || '', target: sign.target || '', size: sign.size, style: sign.style || 'gradient', powered_by: sign.powered_by !== false, links: (sign.links || []).map(l => sign.kind === 'directory'
        ? { key: ++rowKey, id: l.id, kind: l.kind, target: l.target || '', title: l.title || '', subtitle: l.subtitle || '', phone: l.phone || '' }
        : { id: l.id, kind: l.kind, target: l.target || '' }) }
    : emptyForm()
  formError.value = ''
  aiIdea.value = ''
  aiError.value = ''
  formOpen.value = true
}

const brandHint = computed(() => {
  const missing = [!venueInfo.value.logo_url && 'el logo', !venueInfo.value.colors?.primary && 'los colores de marca'].filter(Boolean)
  return `Sube ${missing.join(' y ')} de la cabaña en la pestaña de avisos para que salgan aquí.`
})

// AI copy
const aiIdea = ref('')
const aiError = ref('')
async function suggest() {
  busy.value = 'ai'
  aiError.value = ''
  try {
    const f = form.value
    const copy = await api('POST', '/signs/suggest', { kind: f.kind, size: f.size, idea: aiIdea.value, headline: f.headline, body: f.body })
    f.headline = copy.headline
    f.body = copy.body
    if (!f.name.trim()) f.name = copy.headline.slice(0, 100)
  } catch (e) {
    aiError.value = e.message
  } finally {
    busy.value = null
  }
}

watch(form, async (f) => {
  const saved = f.id && signs.value.find(s => s.id === f.id)
  const sample = f.kind === 'wifi'
    ? (venueInfo.value.wifi_ssid ? `WIFI:T:WPA;S:${venueInfo.value.wifi_ssid};;` : 'WIFI:T:nopass;S:red;;')
    : (saved?.qr_text || `${window.location.origin}/q/ejemplo`)
  const shortUrl = f.kind === 'wifi' ? null : (saved?.short_url || `${window.location.origin}/q/ejemplo`)
  formPreview.value = await signSvg({
    ...venueArt({ ssid: 'Nombre de la red', password: '' }),
    sign: f,
    qrText: sample,
    shortUrl,
    extras: f.links.map((l, i) => {
      const savedLink = saved?.links?.find(s => s.id === l.id || (f.kind !== 'directory' && s.kind === l.kind))
      const url = savedLink?.short_url || `${window.location.origin}/q/ejemplo${i}${l.kind.slice(0, 2)}`
      return { kind: l.kind, qrText: url, shortUrl: url, title: l.title || ROW_EXAMPLES[i % ROW_EXAMPLES.length], subtitle: l.subtitle, phone: l.phone }
    }),
  })
}, { deep: true })

async function saveForm() {
  busy.value = 'form'
  formError.value = ''
  try {
    const { id, ...body } = form.value
    // A small QR to the same place as the big one is redundant.
    body.links = body.links
      .filter(l => body.kind === 'directory' || l.kind !== body.kind || l.kind === 'url')
      .map(({ key, ...l }) => l)
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
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 12px;
  aspect-ratio: 4 / 3;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}
.brand-logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--cui-border-color);
}
.brand-swatch {
  width: 44px;
  height: 28px;
}
.directory-row {
  border: 1px solid var(--cui-border-color);
  background: var(--cui-tertiary-bg);
}
.ai-box {
  background: var(--cui-tertiary-bg);
}
.sign-preview.banner {
  aspect-ratio: 3 / 1.4;
}
.sign-preview :deep(svg) {
  display: block;
  overflow: hidden;
  max-width: 100%;
  max-height: 100%;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2));
}
</style>
