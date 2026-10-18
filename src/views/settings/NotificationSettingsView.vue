<template>
  <CRow>
    <CCol :xs="12" :xl="10" class="mx-auto">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Notificaciones</strong>
          <div class="small text-body-secondary">
            Qué avisos recibe tu equipo, por dónde y quiénes. Lo que configures para la organización aplica a todas
            sus cabañas, salvo las que personalices.
          </div>
        </CCardHeader>
        <CCardBody>
          <CRow class="g-3 align-items-end mb-2">
            <CCol v-if="organizations.length > 1" :md="5">
              <CFormLabel class="small mb-1">Organización</CFormLabel>
              <CFormSelect v-model="organizationId" @update:model-value="venueId = ''; $nextTick(load)">
                <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
              </CFormSelect>
            </CCol>
            <CCol :md="5">
              <CFormLabel class="small mb-1">Aplicar a</CFormLabel>
              <CFormSelect v-model="venueId" data-testid="scope-select" @update:model-value="$nextTick(load)">
                <option value="">Toda la organización</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">Solo {{ venue.name }}</option>
              </CFormSelect>
            </CCol>
          </CRow>
          <CAlert v-if="error" color="danger" class="small py-2">{{ error }}</CAlert>
          <div v-if="loading" class="text-center py-5"><CSpinner color="primary" /></div>
        </CCardBody>
      </CCard>

      <template v-if="!loading && types.length">
        <CCard v-for="type in types" :key="type.code" class="mb-3" :data-testid="`type-${type.code}`">
          <CCardBody>
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div>
                <h6 class="mb-1">
                  {{ type.label }}
                  <CBadge v-if="type.pending" color="secondary" class="ms-1 fw-normal">Próximamente</CBadge>
                </h6>
                <div class="small text-body-secondary">{{ type.description }}</div>
                <div class="small mt-1">
                  <CBadge :color="sourceBadge(drafts[type.code].source).color" class="fw-normal">
                    {{ sourceBadge(drafts[type.code].source).label }}
                  </CBadge>
                  <span v-if="drafts[type.code].source === 'legacy'" class="text-body-secondary ms-1">
                    Se configuró en la cabaña antes de este centro; al guardar queda como la configuración de esta cabaña.
                  </span>
                </div>
              </div>
              <CFormSwitch
                :id="`enabled-${type.code}`"
                v-model="drafts[type.code].enabled"
                :disabled="readOnly(type.code)"
                label="Activo"
              />
            </div>

            <div v-if="venueId && readOnly(type.code)" class="mt-3 small">
              Esta cabaña usa la configuración de la organización
              <span class="text-body-secondary">({{ summary(type.code) }})</span>.
              <CButton color="link" size="sm" class="p-0 ms-1" @click="customize(type.code)">Personalizar para esta cabaña</CButton>
            </div>

            <template v-else-if="drafts[type.code].enabled">
              <CRow class="mt-3 g-3">
                <CCol :md="4">
                  <div class="small fw-semibold mb-1">Canales</div>
                  <CFormCheck :id="`in_app-${type.code}`" v-model="drafts[type.code].channels.in_app" label="En la app (campana)" />
                  <CFormCheck :id="`email-${type.code}`" v-model="drafts[type.code].channels.email" label="Correo" />
                  <CFormCheck
                    :id="`whatsapp-${type.code}`"
                    v-model="drafts[type.code].channels.whatsapp"
                    label="WhatsApp"
                  />
                  <div v-if="drafts[type.code].channels.whatsapp && !whatsappAvailable" class="form-text text-warning">
                    El WhatsApp del sistema no está disponible ahora: los avisos por WhatsApp no saldrán.
                  </div>
                </CCol>
                <CCol :md="8">
                  <div class="small fw-semibold mb-1">Quiénes</div>
                  <CFormCheck
                    :id="`default-recipients-${type.code}`"
                    :model-value="drafts[type.code].recipient_user_ids === null"
                    :label="type.default_recipients === 'members' ? 'Todo el equipo de la organización' : 'Los administradores de la organización'"
                    @update:model-value="toggleDefaultRecipients(type.code, $event)"
                  />
                  <div v-if="drafts[type.code].recipient_user_ids !== null" class="ms-4 mt-1 recipients">
                    <div v-for="member in members" :key="member.id" class="form-check">
                      <input
                        :id="`member-${type.code}-${member.id}`"
                        class="form-check-input"
                        type="checkbox"
                        :checked="drafts[type.code].recipient_user_ids.includes(member.id)"
                        @change="toggleMember(type.code, member.id, $event.target.checked)"
                      />
                      <label class="form-check-label" :for="`member-${type.code}-${member.id}`">
                        {{ member.name }}
                        <span class="text-body-secondary small">{{ member.email }}</span>
                        <CBadge v-if="member.is_admin" color="info" class="ms-1 fw-normal">Admin</CBadge>
                      </label>
                    </div>
                    <div v-if="!members.length" class="small text-body-secondary">La organización no tiene usuarios.</div>
                  </div>

                  <div v-if="drafts[type.code].channels.email" class="mt-3">
                    <div class="small fw-semibold mb-1">Correo</div>
                    <CFormCheck
                      :id="`email-users-${type.code}`"
                      v-model="drafts[type.code].email_to_users"
                      label="Al correo de cada persona seleccionada"
                    />
                    <CFormInput
                      v-model="drafts[type.code].extra_emails"
                      size="sm"
                      class="mt-1"
                      placeholder="Otros correos del equipo: correo@ejemplo.com, otro@ejemplo.com"
                    />
                  </div>

                  <div v-if="drafts[type.code].channels.whatsapp" class="mt-3">
                    <div class="small fw-semibold mb-1">WhatsApp</div>
                    <CFormInput
                      v-model="drafts[type.code].whatsapp_phones"
                      size="sm"
                      placeholder="Ej: 573001234567, 573109876543"
                    />
                    <div class="form-text">
                      Se envía desde el número del sistema de CabanIA. Vacío = el WhatsApp de la cabaña.
                    </div>
                  </div>
                </CCol>
              </CRow>
              <div v-if="type.code === 'booking_reminder'" class="form-text mt-2">
                Cuántos días antes se avisa se define en cada plan (Cabañas → Planes). Los recordatorios son para el equipo:
                al cliente no se le envía nada.
              </div>
            </template>

            <div v-if="!readOnly(type.code)" class="d-flex justify-content-end gap-2 mt-3">
              <CButton
                v-if="venueId && ['venue', 'legacy'].includes(drafts[type.code].source)"
                color="secondary"
                variant="ghost"
                size="sm"
                @click="reset(type.code)"
              >
                Volver a la de la organización
              </CButton>
              <CButton
                v-if="venueId && pendingCustomize[type.code]"
                color="secondary"
                variant="ghost"
                size="sm"
                @click="cancelCustomize(type.code)"
              >
                Cancelar
              </CButton>
              <CButton color="primary" size="sm" :disabled="saving[type.code]" @click="save(type.code)">
                <CSpinner v-if="saving[type.code]" size="sm" class="me-1" />Guardar
              </CButton>
            </div>
            <div v-if="savedAt[type.code]" class="text-success small text-end mt-1">Guardado</div>
          </CCardBody>
        </CCard>
      </template>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const organizations = ref([])
const organizationId = ref('')
const venues = ref([])
const venueId = ref(route.query.venue_id || '')
const types = ref([])
const members = ref([])
const whatsappAvailable = ref(false)
const drafts = reactive({})
const original = reactive({})
const saving = reactive({})
const savedAt = reactive({})
const pendingCustomize = reactive({})

const clone = (value) => JSON.parse(JSON.stringify(value))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (organizationId.value) params.set('organization_id', organizationId.value)
    if (venueId.value) params.set('venue_id', venueId.value)
    const response = await fetch(`/api/notification-settings?${params}`, { credentials: 'include' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar la configuración')
    organizations.value = data.organizations
    organizationId.value = data.organization_id
    venues.value = data.venues
    types.value = data.types
    members.value = data.members
    whatsappAvailable.value = data.whatsapp_available
    for (const type of data.types) {
      drafts[type.code] = clone(data.settings[type.code])
      original[type.code] = clone(data.settings[type.code])
      pendingCustomize[type.code] = false
      savedAt[type.code] = null
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/** In a venue, a type that follows the organization is read-only until customized. */
function readOnly(code) {
  return !!venueId.value && ['organization', 'default'].includes(drafts[code]?.source) && !pendingCustomize[code]
}

function sourceBadge(source) {
  if (source === 'venue') return { color: 'primary', label: 'Personalizado para esta cabaña' }
  if (source === 'legacy') return { color: 'warning', label: 'Configuración anterior de la cabaña' }
  if (source === 'organization') return { color: 'success', label: venueId.value ? 'Configuración de la organización' : 'Configurado' }
  return { color: 'secondary', label: 'Por defecto' }
}

function summary(code) {
  const s = drafts[code]
  if (!s.enabled) return 'apagado'
  const labels = { in_app: 'app', email: 'correo', whatsapp: 'WhatsApp' }
  const channels = Object.entries(s.channels).filter(([, on]) => on).map(([c]) => labels[c] || c)
  return channels.length ? channels.join(', ') : 'sin canales'
}

function customize(code) {
  pendingCustomize[code] = true
}

function cancelCustomize(code) {
  drafts[code] = clone(original[code])
  pendingCustomize[code] = false
}

function toggleDefaultRecipients(code, useDefault) {
  if (useDefault) {
    drafts[code].recipient_user_ids = null
    return
  }
  // Start from who gets it today.
  const type = types.value.find(t => t.code === code)
  drafts[code].recipient_user_ids = members.value
    .filter(m => type.default_recipients === 'members' || m.is_admin)
    .map(m => m.id)
}

function toggleMember(code, userId, checked) {
  const list = drafts[code].recipient_user_ids
  const index = list.indexOf(userId)
  if (checked && index === -1) list.push(userId)
  if (!checked && index !== -1) list.splice(index, 1)
}

async function save(code) {
  saving[code] = true
  error.value = ''
  try {
    const response = await fetch('/api/notification-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        organization_id: organizationId.value,
        venue_id: venueId.value || null,
        type: code,
        ...drafts[code]
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar')
    drafts[code] = clone(data.settings)
    original[code] = clone(data.settings)
    pendingCustomize[code] = false
    savedAt[code] = Date.now()
    setTimeout(() => { savedAt[code] = null }, 3000)
  } catch (err) {
    error.value = err.message
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    saving[code] = false
  }
}

async function reset(code) {
  saving[code] = true
  try {
    const params = new URLSearchParams({ organization_id: organizationId.value, venue_id: venueId.value, type: code })
    const response = await fetch(`/api/notification-settings?${params}`, { method: 'DELETE', credentials: 'include' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo restablecer')
    drafts[code] = clone(data.settings)
    original[code] = clone(data.settings)
    pendingCustomize[code] = false
  } catch (err) {
    error.value = err.message
  } finally {
    saving[code] = false
  }
}

onMounted(load)
</script>

<style scoped>
.recipients {
  max-height: 220px;
  overflow-y: auto;
}
</style>
