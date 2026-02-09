<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Comisionistas</strong>
          <RouterLink to="/business/commissions/agents/create" class="btn btn-primary btn-sm">
            <CIcon name="cil-plus" class="me-1" /> Nuevo Comisionista
          </RouterLink>
        </CCardHeader>
        <CCardBody>
          <CRow class="mb-3 g-2">
            <CCol :md="3">
              <CFormLabel class="small">Sede</CFormLabel>
              <CFormSelect v-model="filters.venue_id" size="sm" @change="loadAgents">
                <option value="">Todas las sedes</option>
                <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                  {{ venue.name }}
                </option>
              </CFormSelect>
            </CCol>
            <CCol :md="3">
              <CFormLabel class="small">Estado</CFormLabel>
              <CFormSelect v-model="filters.is_active" size="sm" @change="loadAgents">
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </CFormSelect>
            </CCol>
            <CCol :md="6">
              <CFormLabel class="small">Buscar</CFormLabel>
              <CFormInput
                v-model="filters.search"
                size="sm"
                placeholder="Buscar por nombre o proveedor..."
                @input="onSearchInput"
              />
            </CCol>
          </CRow>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Proveedor</CTableHeaderCell>
                <CTableHeaderCell class="d-mobile-none">Sede</CTableHeaderCell>
                <CTableHeaderCell>Reglas</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
                <CTableHeaderCell>Pagos</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              <CTableRow v-for="agent in agents" :key="agent.id">
                <CTableDataCell>{{ agent.name }}</CTableDataCell>
                <CTableDataCell>{{ agent.provider?.name || '—' }}</CTableDataCell>
                <CTableDataCell class="d-mobile-none">
                  {{ getVenueName(agent.venue_id) }}
                </CTableDataCell>
                <CTableDataCell>{{ agent.rules?.length || 0 }}</CTableDataCell>
                <CTableDataCell>
                  <CBadge :color="agent.is_active ? 'success' : 'secondary'">
                    {{ agent.is_active ? 'Activo' : 'Inactivo' }}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{{ agent._count?.payments || 0 }}</CTableDataCell>
                <CTableDataCell>
                  <div class="d-flex gap-1">
                    <RouterLink
                      :to="`/business/commissions/agents/${agent.id}/edit`"
                      class="btn btn-info btn-sm"
                      title="Editar"
                    >
                      <CIcon name="cil-pencil" />
                    </RouterLink>
                    <CButton
                      color="danger"
                      size="sm"
                      variant="ghost"
                      @click="confirmDelete(agent)"
                      title="Eliminar"
                    >
                      <CIcon name="cil-trash" />
                    </CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
              <CTableRow v-if="agents.length === 0">
                <CTableDataCell colspan="7" class="text-center text-muted py-4">
                  No hay comisionistas registrados
                </CTableDataCell>
              </CTableRow>
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CButton,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CFormSelect, CFormInput, CFormLabel
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const router = useRouter()

const agents = ref([])
const venues = ref([])
const loading = ref(false)

const filters = ref({
  venue_id: '',
  is_active: '',
  search: ''
})

let searchTimeout = null

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

const getVenueName = (venueId) => {
  if (!venueId) return '—'
  const venue = venues.value.find((v) => v.id === venueId)
  return venue?.name || '—'
}

const onSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadAgents()
  }, 300)
}

const loadAgents = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.venue_id) params.append('venue_id', filters.value.venue_id)
    if (filters.value.is_active) params.append('is_active', filters.value.is_active)
    if (filters.value.search) params.append('search', filters.value.search)

    const url = `/api/commission-agents${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) {
      agents.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading commission agents:', error)
  } finally {
    loading.value = false
  }
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

const confirmDelete = async (agent) => {
  const paymentCount = agent._count?.payments || 0
  let message = `¿Está seguro de eliminar al comisionista "${agent.name}"?`
  if (paymentCount > 0) {
    message += `\n\nEste comisionista tiene ${paymentCount} pago(s) registrado(s). Se desactivará en lugar de eliminarse.`
  }

  if (!confirm(message)) return

  try {
    const response = await fetch(`/api/commission-agents/${agent.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      await loadAgents()
    }
  } catch (error) {
    console.error('Error deleting commission agent:', error)
  }
}

onMounted(() => {
  loadAgents()
  loadVenues()
})
</script>
