<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Detalle de Mantenimiento</strong>
          <div class="d-flex gap-2 flex-wrap">
            <CButton color="warning" size="sm" @click="$router.push(`/business/maintenance/logs/${route.params.id}/edit`)">
              Editar
            </CButton>
            <CButton color="secondary" size="sm" variant="outline" @click="$router.push('/business/maintenance/logs')">
              Volver
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody v-if="log">
          <CRow>
            <CCol :md="6">
              <h6 class="text-muted">Zona</h6>
              <p class="fs-5">{{ log.zone_data?.name || '-' }}</p>
            </CCol>
            <CCol :md="6">
              <h6 class="text-muted">Sede</h6>
              <p class="fs-5">
                <RouterLink
                  v-if="log.venue_data?.id"
                  :to="`/business/venues/${log.venue_data.id}`"
                  class="text-decoration-none"
                >
                  {{ log.venue_data?.name || '-' }}
                </RouterLink>
                <span v-else>{{ log.venue_data?.name || '-' }}</span>
              </p>
            </CCol>
          </CRow>

          <CRow class="mt-3">
            <CCol :md="3">
              <h6 class="text-muted">Fecha</h6>
              <p>{{ formatDate(log.maintenance_date) }}</p>
            </CCol>
            <CCol :md="3">
              <h6 class="text-muted">Hora Entrada</h6>
              <p>{{ log.entry_time || '-' }}</p>
            </CCol>
            <CCol :md="3">
              <h6 class="text-muted">Hora Salida</h6>
              <p>{{ log.exit_time || '-' }}</p>
            </CCol>
            <CCol :md="3">
              <h6 class="text-muted">Costo</h6>
              <p class="fs-5 fw-bold text-primary">{{ formatCurrency(log.cost) }}</p>
            </CCol>
          </CRow>

          <CRow class="mt-3">
            <CCol :md="3">
              <h6 class="text-muted">Estado</h6>
              <CBadge :color="statusBadges[log.status]?.color || 'secondary'" class="px-3 py-2">
                {{ statusBadges[log.status]?.label || log.status }}
              </CBadge>
            </CCol>
            <CCol :md="3">
              <h6 class="text-muted">Prioridad</h6>
              <CBadge :color="priorityBadges[log.priority]?.color || 'secondary'" class="px-3 py-2">
                {{ priorityBadges[log.priority]?.label || log.priority }}
              </CBadge>
            </CCol>
            <CCol :md="6">
              <h6 class="text-muted">Tipo de Zona</h6>
              <p>{{ zoneTypeLabels[log.zone_data?.type] || log.zone_data?.type || '-' }}</p>
            </CCol>
          </CRow>

          <hr />

          <CRow class="mt-3">
            <CCol :md="6">
              <h6 class="text-muted">Proveedor</h6>
              <p class="fs-5">{{ log.provider_data?.name || '-' }}</p>
            </CCol>
            <CCol :md="6" v-if="log.provider_data?.phone">
              <h6 class="text-muted">Telefono del Proveedor</h6>
              <p>{{ log.provider_data.phone }}</p>
            </CCol>
          </CRow>

          <hr />

          <CRow class="mt-3">
            <CCol :xs="12">
              <h6 class="text-muted">Descripcion</h6>
              <p style="white-space: pre-wrap;">{{ log.description || '-' }}</p>
            </CCol>
          </CRow>

          <CRow class="mt-3" v-if="log.work_performed">
            <CCol :xs="12">
              <h6 class="text-muted">Trabajo Realizado</h6>
              <p style="white-space: pre-wrap;">{{ log.work_performed }}</p>
            </CCol>
          </CRow>

          <CRow class="mt-3" v-if="log.pending_items">
            <CCol :xs="12">
              <h6 class="text-muted">Pendientes</h6>
              <p style="white-space: pre-wrap;">{{ log.pending_items }}</p>
            </CCol>
          </CRow>

          <CRow class="mt-3" v-if="log.notes">
            <CCol :xs="12">
              <h6 class="text-muted">Notas</h6>
              <p style="white-space: pre-wrap;">{{ log.notes }}</p>
            </CCol>
          </CRow>

          <hr />

          <!-- Supplies -->
          <CRow class="mt-3">
            <CCol :xs="12">
              <h5 class="mb-3">Insumos Consumidos</h5>
              <CTable v-if="log.supplies && log.supplies.length > 0" hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Item</CTableHeaderCell>
                    <CTableHeaderCell>Cantidad</CTableHeaderCell>
                    <CTableHeaderCell>Unidad</CTableHeaderCell>
                    <CTableHeaderCell>Costo Unit.</CTableHeaderCell>
                    <CTableHeaderCell>Subtotal</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="supply in log.supplies" :key="supply.id">
                    <CTableDataCell>{{ supply.item_name || supply.inventory_item_data?.name || '-' }}</CTableDataCell>
                    <CTableDataCell>{{ supply.quantity }}</CTableDataCell>
                    <CTableDataCell>{{ supply.unit || supply.inventory_item_data?.unit || '-' }}</CTableDataCell>
                    <CTableDataCell>{{ formatCurrency(supply.unit_cost) }}</CTableDataCell>
                    <CTableDataCell>{{ formatCurrency((supply.quantity || 0) * (supply.unit_cost || 0)) }}</CTableDataCell>
                  </CTableRow>
                </CTableBody>
                <CTableFoot>
                  <CTableRow>
                    <CTableDataCell colspan="4" class="text-end">
                      <strong>Total Insumos:</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      <strong>{{ formatCurrency(totalSuppliesCost) }}</strong>
                    </CTableDataCell>
                  </CTableRow>
                </CTableFoot>
              </CTable>
              <div v-else class="text-muted text-center py-3">
                No hay insumos registrados
              </div>
            </CCol>
          </CRow>

          <hr />

          <!-- Images -->
          <CRow class="mt-3">
            <CCol :xs="12">
              <h5 class="mb-3">Imagenes</h5>
              <div v-if="log.images && log.images.length > 0" class="d-flex gap-3 flex-wrap">
                <div
                  v-for="image in log.images"
                  :key="image.id"
                  class="border rounded p-1 cursor-pointer"
                  @click="openImageModal(image)"
                >
                  <img
                    :src="image.image_url"
                    style="width: 120px; height: 120px; object-fit: cover;"
                    class="rounded"
                  />
                </div>
              </div>
              <div v-else class="text-muted text-center py-3">
                No hay imagenes registradas
              </div>
            </CCol>
          </CRow>

          <hr />

          <CRow class="mt-3">
            <CCol :md="6">
              <h6 class="text-muted">Creado</h6>
              <p>{{ log.created_at ? new Date(log.created_at).toLocaleString('es-CO') : '-' }}</p>
            </CCol>
            <CCol :md="6">
              <h6 class="text-muted">Actualizado</h6>
              <p>{{ log.updated_at ? new Date(log.updated_at).toLocaleString('es-CO') : '-' }}</p>
            </CCol>
          </CRow>
        </CCardBody>
        <CCardBody v-else>
          <div class="text-center py-4">
            <CSpinner size="sm" class="me-2" />
            Cargando...
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <!-- Image Preview Modal -->
  <CModal :visible="showImageModal" @close="showImageModal = false" size="xl">
    <CModalHeader>
      <CModalTitle>Imagen</CModalTitle>
    </CModalHeader>
    <CModalBody class="text-center p-4">
      <img v-if="selectedImage" :src="selectedImage.image_url" class="img-fluid rounded" style="max-height: 70vh;" />
    </CModalBody>
  </CModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CTableFoot,
  CBadge, CModal, CModalHeader, CModalTitle, CModalBody, CSpinner
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()
const log = ref(null)
const showImageModal = ref(false)
const selectedImage = ref(null)

const statusBadges = {
  pending: { color: 'warning', label: 'Pendiente' },
  in_progress: { color: 'info', label: 'En Progreso' },
  completed: { color: 'success', label: 'Completado' },
  cancelled: { color: 'secondary', label: 'Cancelado' }
}

const priorityBadges = {
  low: { color: 'secondary', label: 'Baja' },
  medium: { color: 'info', label: 'Media' },
  high: { color: 'warning', label: 'Alta' },
  urgent: { color: 'danger', label: 'Urgente' }
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

const totalSuppliesCost = computed(() => {
  if (!log.value?.supplies) return 0
  return log.value.supplies.reduce((sum, s) => sum + ((s.quantity || 0) * (s.unit_cost || 0)), 0)
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

const openImageModal = (image) => {
  selectedImage.value = image
  showImageModal.value = true
}

const loadLog = async () => {
  try {
    const response = await fetch(`/api/maintenance-logs/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      log.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading maintenance log:', error)
  }
}

onMounted(loadLog)
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
