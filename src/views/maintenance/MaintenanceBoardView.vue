<template>
  <CRow class="mb-3">
    <CCol :md="4">
      <CFormLabel class="small">Sede</CFormLabel>
      <CFormSelect v-model="selectedVenueId" size="sm" @change="loadDashboard">
        <option value="">Seleccionar sede...</option>
        <option v-for="venue in venues" :key="venue.id" :value="venue.id">
          {{ venue.name }}
        </option>
      </CFormSelect>
    </CCol>
  </CRow>

  <!-- Stat Cards -->
  <CRow class="mb-4" v-if="dashboard">
    <CCol :sm="6" :lg="3">
      <CCard class="mb-4">
        <CCardHeader class="bg-warning text-white">
          <strong>Pendientes</strong>
        </CCardHeader>
        <CCardBody class="text-center">
          <div class="fs-1 fw-bold text-warning">{{ dashboard.pending_count || 0 }}</div>
          <div class="text-muted small">registros pendientes</div>
        </CCardBody>
      </CCard>
    </CCol>
    <CCol :sm="6" :lg="3">
      <CCard class="mb-4">
        <CCardHeader class="bg-info text-white">
          <strong>En Progreso</strong>
        </CCardHeader>
        <CCardBody class="text-center">
          <div class="fs-1 fw-bold text-info">{{ dashboard.in_progress_count || 0 }}</div>
          <div class="text-muted small">en ejecucion</div>
        </CCardBody>
      </CCard>
    </CCol>
    <CCol :sm="6" :lg="3">
      <CCard class="mb-4">
        <CCardHeader class="bg-success text-white">
          <strong>Completados este Mes</strong>
        </CCardHeader>
        <CCardBody class="text-center">
          <div class="fs-1 fw-bold text-success">{{ dashboard.completed_month_count || 0 }}</div>
          <div class="text-muted small">completados</div>
        </CCardBody>
      </CCard>
    </CCol>
    <CCol :sm="6" :lg="3">
      <CCard class="mb-4">
        <CCardHeader class="bg-danger text-white">
          <strong>Stock Bajo</strong>
        </CCardHeader>
        <CCardBody class="text-center">
          <div class="fs-1 fw-bold text-danger">{{ dashboard.low_stock_count || 0 }}</div>
          <div class="text-muted small">insumos bajo minimo</div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Zone Status -->
  <CRow class="mb-4" v-if="dashboard">
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Estado de Zonas</strong>
        </CCardHeader>
        <CCardBody>
          <div v-if="!dashboard.zone_status || dashboard.zone_status.length === 0" class="text-center text-muted py-4">
            No hay zonas registradas para esta sede
          </div>
          <CTable v-else hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Zona</CTableHeaderCell>
                <CTableHeaderCell>Tipo</CTableHeaderCell>
                <CTableHeaderCell>Ultimo Mantenimiento</CTableHeaderCell>
                <CTableHeaderCell>Ultimo Proveedor</CTableHeaderCell>
                <CTableHeaderCell>Dias</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="zone in dashboard.zone_status" :key="zone.id">
                <CTableDataCell>
                  <strong>{{ zone.name }}</strong>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge color="primary">
                    {{ zoneTypeLabels[zone.type] || zone.type || '-' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ formatDate(zone.last_maintenance_date) }}</CTableDataCell>
                <CTableDataCell>{{ zone.last_provider_name || '-' }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge
                    v-if="zone.days_since_last !== null && zone.days_since_last !== undefined"
                    :color="getDaysColor(zone.days_since_last)"
                  >
                    {{ zone.days_since_last }} dias
                  </CBadge>
                  <span v-else class="text-muted">Sin registro</span>
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CRow v-if="dashboard">
    <!-- Recent Activity -->
    <CCol :xs="12" :lg="6">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Actividad Reciente</strong>
        </CCardHeader>
        <CCardBody>
          <div v-if="!dashboard.recent_logs || dashboard.recent_logs.length === 0" class="text-center text-muted py-4">
            No hay actividad reciente
          </div>
          <div v-else class="list-group list-group-flush">
            <div
              v-for="log in dashboard.recent_logs"
              :key="log.id"
              class="list-group-item d-flex justify-content-between align-items-start px-0"
            >
              <div class="me-3" style="min-width: 0;">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <small class="text-muted">{{ formatDate(log.maintenance_date) }}</small>
                  <CBadge :color="statusBadges[log.status]?.color || 'secondary'" size="sm">
                    {{ statusBadges[log.status]?.label || log.status }}
                  </CBadge>
                </div>
                <div class="fw-semibold">{{ log.zone_name || '-' }}</div>
                <div class="text-truncate small text-muted" style="max-width: 300px;">
                  {{ log.description || '-' }}
                </div>
              </div>
              <RouterLink
                :to="`/business/maintenance/logs/${log.id}`"
                class="btn btn-sm btn-outline-secondary flex-shrink-0"
              >
                Ver
              </RouterLink>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </CCol>

    <!-- Low Stock Alerts -->
    <CCol :xs="12" :lg="6">
      <CCard class="mb-4">
        <CCardHeader>
          <strong>Alertas de Stock Bajo</strong>
        </CCardHeader>
        <CCardBody>
          <div v-if="!dashboard.low_stock_items || dashboard.low_stock_items.length === 0" class="text-center text-muted py-4">
            No hay alertas de stock bajo
          </div>
          <div v-else class="list-group list-group-flush">
            <div
              v-for="item in dashboard.low_stock_items"
              :key="item.id"
              class="list-group-item d-flex justify-content-between align-items-center px-0"
            >
              <div>
                <div class="fw-semibold">{{ item.name }}</div>
                <small class="text-muted">{{ item.unit || '' }}</small>
              </div>
              <div class="text-end">
                <div>
                  <CBadge color="danger">{{ item.current_stock }}</CBadge>
                  <span class="text-muted small mx-1">/</span>
                  <CBadge color="secondary">{{ item.minimum_stock }}</CBadge>
                </div>
                <small class="text-muted">actual / minimo</small>
              </div>
            </div>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <div v-if="!selectedVenueId" class="text-center text-muted py-5">
    <CIcon name="cil-building" size="3xl" class="mb-3" />
    <p class="fs-5">Seleccione una sede para ver el tablero de mantenimiento</p>
  </div>

  <div v-if="loading" class="text-center py-5">
    <CSpinner class="me-2" />
    Cargando tablero...
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CFormLabel, CFormSelect, CSpinner
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const venues = ref([])
const selectedVenueId = ref('')
const dashboard = ref(null)
const loading = ref(false)

const statusBadges = {
  pending: { color: 'warning', label: 'Pendiente' },
  in_progress: { color: 'info', label: 'En Progreso' },
  completed: { color: 'success', label: 'Completado' },
  cancelled: { color: 'secondary', label: 'Cancelado' }
}

const zoneTypeLabels = {
  piscina: 'Piscina',
  kiosco: 'Kiosco',
  bbq: 'BBQ/Asador',
  jardin: 'Jardin',
  parqueadero: 'Parqueadero',
  habitaciones: 'Habitaciones',
  area_comun: 'Area Comun',
  cocina: 'Cocina',
  otro: 'Otro'
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getDaysColor = (days) => {
  if (days <= 7) return 'success'
  if (days <= 30) return 'warning'
  return 'danger'
}

const loadVenues = async () => {
  try {
    const response = await fetch('/api/venues', { credentials: 'include' })
    if (response.ok) {
      venues.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

const loadDashboard = async () => {
  if (!selectedVenueId.value) {
    dashboard.value = null
    return
  }

  loading.value = true
  try {
    const response = await fetch(`/api/maintenance-dashboard?venue_id=${selectedVenueId.value}`, { credentials: 'include' })
    if (response.ok) {
      dashboard.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading maintenance dashboard:', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadVenues)
</script>

<style scoped>
</style>
