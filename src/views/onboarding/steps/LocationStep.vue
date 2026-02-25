<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Donde esta tu propiedad?</h4>
      <p class="text-body-secondary mb-4">Mueve el mapa para ubicar el pin o usa tu GPS</p>

      <!-- GPS button -->
      <div class="mb-3">
        <CButton
          color="success"
          class="gps-btn w-100"
          :disabled="locating"
          @click="useMyLocation"
        >
          <CSpinner v-if="locating" size="sm" class="me-2" />
          <CIcon v-else :icon="cilLocationPin" class="me-2" />
          {{ locating ? 'Localizando...' : 'Usar mi ubicacion' }}
        </CButton>
      </div>

      <!-- Map container with centered pin -->
      <div class="map-wrapper mb-3">
        <div ref="mapContainer" class="map-container"></div>
        <!-- Fixed center pin overlay -->
        <div class="center-pin" aria-hidden="true">
          <svg width="32" height="44" viewBox="0 0 32 44" fill="none">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28C32 7.163 24.837 0 16 0z" fill="#10b981"/>
            <circle cx="16" cy="16" r="6" fill="#fff"/>
          </svg>
          <div class="pin-shadow"></div>
        </div>
      </div>

      <!-- Location summary (shows after geocoding) -->
      <div v-if="form.address || form.city" class="location-summary mb-3">
        <div class="summary-icon">&#128205;</div>
        <div class="summary-text">
          <strong>{{ form.address || form.city }}</strong>
          <span v-if="form.city || form.department">{{ [form.city, form.department].filter(Boolean).join(', ') }}</span>
        </div>
      </div>

      <!-- Nearby zones -->
      <div v-if="nearbyZones.length" class="mb-3">
        <CFormLabel class="d-flex align-items-center gap-1">
          <small>Zonas cercanas</small>
        </CFormLabel>
        <div class="zone-chips">
          <button
            v-for="zone in nearbyZones"
            :key="zone.city"
            type="button"
            class="zone-chip"
            @click="searchZone(zone.city)"
          >
            {{ zone.city }} ({{ zone.venue_count }})
          </button>
        </div>
      </div>

      <!-- Direccion field (outside accordion) -->
      <div class="mb-3">
        <CFormLabel>Direccion</CFormLabel>
        <CFormInput
          v-model="form.address"
          placeholder="Ej: Vereda El Carmen, Carmen de Apicala"
          @input="form.location_source = 'manual'"
        />
      </div>

      <div class="mb-3">
        <CFormLabel>Referencia de direccion</CFormLabel>
        <CFormInput
          v-model="form.address_reference"
          placeholder="Ej: 50 metros despues de la ferreteria, entrada a la izquierda"
        />
        <div class="form-text">Ayuda a tus huespedes a encontrar la propiedad</div>
      </div>

      <!-- Accordion: Ver mas detalles -->
      <CAccordion class="mb-3 details-accordion">
        <CAccordionItem>
          <CAccordionHeader>Ver mas detalles</CAccordionHeader>
          <CAccordionBody>
            <CRow class="mb-2">
              <CCol :xs="6">
                <CFormLabel class="mb-1"><small>Latitud</small></CFormLabel>
                <CFormInput
                  :model-value="form.latitude != null ? form.latitude.toFixed(6) : ''"
                  size="sm"
                  readonly
                  placeholder="—"
                />
              </CCol>
              <CCol :xs="6">
                <CFormLabel class="mb-1"><small>Longitud</small></CFormLabel>
                <CFormInput
                  :model-value="form.longitude != null ? form.longitude.toFixed(6) : ''"
                  size="sm"
                  readonly
                  placeholder="—"
                />
              </CCol>
            </CRow>
            <CRow class="mb-2">
              <CCol :xs="6">
                <CFormLabel class="mb-1"><small>Ciudad</small></CFormLabel>
                <CFormInput
                  v-model="form.city"
                  size="sm"
                  placeholder="Ej: Carmen de Apicala"
                  @input="form.location_source = 'manual'"
                />
              </CCol>
              <CCol :xs="6">
                <CFormLabel class="mb-1"><small>Departamento</small></CFormLabel>
                <CFormInput
                  v-model="form.department"
                  size="sm"
                  placeholder="Ej: Tolima"
                  @input="form.location_source = 'manual'"
                />
              </CCol>
            </CRow>
          </CAccordionBody>
        </CAccordionItem>
      </CAccordion>

      <CAlert v-if="gpsError" color="warning" class="mb-3" dismissible @close="gpsError = ''">
        {{ gpsError }}
      </CAlert>

      <div class="d-flex justify-content-between">
        <CButton color="secondary" variant="ghost" @click="$emit('back')">
          Anterior
        </CButton>
        <CButton
          color="primary"
          class="onboarding-btn"
          :disabled="!form.latitude || !form.longitude"
          @click="next"
        >
          Siguiente
        </CButton>
      </div>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import { cilLocationPin } from '@coreui/icons'
import mapboxgl from 'mapbox-gl'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

const props = defineProps({
  savedData: { type: Object, default: null },
})

const emit = defineEmits(['completed', 'back'])

const mapContainer = ref(null)
const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
let map = null
let geocoderControl = null
let reverseGeocodeTimeout = null
let skipReverseGeocode = false

const locating = ref(false)
const gpsError = ref('')
const nearbyZones = ref([])

const form = ref({
  latitude: null,
  longitude: null,
  address: '',
  address_reference: '',
  city: '',
  department: '',
  suburb: '',
  location_source: '',
})

// Reverse geocode helper
async function reverseGeocode(lng, lat) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=es&types=address,poi,place&limit=1`,
    )
    const data = await response.json()
    if (data.features && data.features.length > 0) {
      const result = data.features[0]

      if (result.address && result.text) {
        form.value.address = `${result.address} ${result.text}`
      } else if (result.text) {
        form.value.address = result.text
      } else if (result.place_name) {
        form.value.address = result.place_name
      }

      form.value.suburb = ''
      form.value.city = ''
      form.value.department = ''

      if (result.context) {
        result.context.forEach((ctx) => {
          const id = ctx.id
          if (id.startsWith('locality') || id.startsWith('neighborhood')) {
            form.value.suburb = ctx.text
          } else if (id.startsWith('place')) {
            form.value.city = ctx.text
          } else if (id.startsWith('region')) {
            form.value.department = ctx.text
          }
        })
      }
    }
  } catch (error) {
    console.error('Error in reverse geocoding:', error)
  }
}

function parseGeocoderResult(result) {
  form.value.suburb = ''
  form.value.city = ''
  form.value.department = ''

  if (result.address && result.text) {
    form.value.address = `${result.address} ${result.text}`
  } else if (result.text) {
    form.value.address = result.text
  } else if (result.place_name) {
    form.value.address = result.place_name
  }

  if (result.context) {
    result.context.forEach((ctx) => {
      const id = ctx.id
      if (id.startsWith('locality') || id.startsWith('neighborhood')) {
        form.value.suburb = ctx.text
      } else if (id.startsWith('place')) {
        form.value.city = ctx.text
      } else if (id.startsWith('region')) {
        form.value.department = ctx.text
      }
    })
  }
}

async function useMyLocation() {
  if (!navigator.geolocation) {
    gpsError.value = 'Tu navegador no soporta geolocalizacion'
    return
  }
  locating.value = true
  gpsError.value = ''
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })
    const { latitude, longitude } = pos.coords
    form.value.latitude = latitude
    form.value.longitude = longitude
    form.value.location_source = 'gps'

    if (map) {
      skipReverseGeocode = true
      map.flyTo({ center: [longitude, latitude], zoom: 14 })
    }
    await reverseGeocode(longitude, latitude)
  } catch (err) {
    if (err.code === 1) {
      gpsError.value = 'Permiso de ubicacion denegado. Busca tu direccion en el mapa.'
    } else {
      gpsError.value = 'No pudimos obtener tu ubicacion. Intenta buscar en el mapa.'
    }
  } finally {
    locating.value = false
  }
}

function searchZone(cityName) {
  if (geocoderControl) {
    geocoderControl.setInput(cityName)
    geocoderControl.query(cityName)
  }
}

async function fetchNearbyZones(department) {
  if (!department) return
  try {
    const res = await fetch(
      `/api/onboarding/nearby-zones?department=${encodeURIComponent(department)}`,
      { credentials: 'include' },
    )
    if (res.ok) {
      const data = await res.json()
      nearbyZones.value = data.zones || []
    }
  } catch (e) {
    console.error('Error fetching nearby zones:', e)
  }
}

// Watch department changes to fetch zones
let deptWatchTimeout = null
watch(
  () => form.value.department,
  (dept) => {
    if (deptWatchTimeout) clearTimeout(deptWatchTimeout)
    deptWatchTimeout = setTimeout(() => fetchNearbyZones(dept), 500)
  },
)

function next() {
  emit('completed', {
    location: {
      latitude: form.value.latitude,
      longitude: form.value.longitude,
      address: form.value.address,
      address_reference: form.value.address_reference,
      city: form.value.city,
      department: form.value.department,
      suburb: form.value.suburb,
      location_source: form.value.location_source,
    },
  })
}

onMounted(() => {
  // Restore saved data
  if (props.savedData?.location) {
    Object.assign(form.value, props.savedData.location)
  }

  mapboxgl.accessToken = token

  const initialCenter =
    form.value.longitude && form.value.latitude
      ? [form.value.longitude, form.value.latitude]
      : [-74.0, 4.6] // Colombia center

  const initialZoom = form.value.latitude ? 14 : 5

  map = new mapboxgl.Map({
    style: 'mapbox://styles/mapbox/streets-v11',
    container: mapContainer.value,
    center: initialCenter,
    zoom: initialZoom,
  })

  // Zoom controls
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

  // Geocoder
  geocoderControl = new MapboxGeocoder({
    accessToken: token,
    mapboxgl,
    placeholder: 'Buscar direccion...',
    language: 'es',
    countries: 'co',
  })
  map.addControl(geocoderControl)

  // Pin stays at center — on moveend update lat/lng and reverse geocode
  map.on('moveend', () => {
    if (skipReverseGeocode) {
      skipReverseGeocode = false
      return
    }

    const center = map.getCenter()
    form.value.latitude = center.lat
    form.value.longitude = center.lng
    if (!form.value.location_source) form.value.location_source = 'manual'

    if (reverseGeocodeTimeout) clearTimeout(reverseGeocodeTimeout)
    reverseGeocodeTimeout = setTimeout(() => {
      reverseGeocode(center.lng, center.lat)
    }, 800)
  })

  // Geocoder result → fill fields, skip reverse geocode
  geocoderControl.on('result', (ev) => {
    const [lng, lat] = ev.result.center
    skipReverseGeocode = true
    form.value.latitude = lat
    form.value.longitude = lng
    if (!form.value.location_source) form.value.location_source = 'manual'
    parseGeocoderResult(ev.result)
  })

  // Fetch zones if we already have a department
  if (form.value.department) {
    fetchNearbyZones(form.value.department)
  }
})

onUnmounted(() => {
  if (reverseGeocodeTimeout) clearTimeout(reverseGeocodeTimeout)
  if (deptWatchTimeout) clearTimeout(deptWatchTimeout)
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.onboarding-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

.card-title {
  color: #f1f5f9;
}

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  border-radius: 10px;
}

.gps-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  padding: 10px 20px;
  font-weight: 600;
  border-radius: 10px;
  color: #fff;
}

.gps-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
}

.gps-btn:disabled {
  opacity: 0.7;
}

.map-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.map-container {
  width: 100%;
  height: 280px;
}

/* Fixed center pin - always in the middle of the map */
.center-pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  z-index: 10;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pin-shadow {
  width: 12px;
  height: 4px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 50%;
  margin-top: -2px;
}

/* Location summary card */
.location-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
}

.summary-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.summary-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.summary-text strong {
  font-size: 0.85rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-text span {
  font-size: 0.75rem;
  opacity: 0.7;
}

.zone-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.zone-chip {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #10b981;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.zone-chip:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.4);
}
</style>
