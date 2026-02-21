<template>
  <div>
    <CCard class="mb-4">
      <CCardBody>
        <CRow class="g-3 align-items-end">
          <CCol :xs="6" :md="3" :lg="2">
            <label class="form-label">Periodo</label>
            <CFormSelect v-model="selectedPeriod" @change="loadAllData">
              <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </CFormSelect>
          </CCol>
          <CCol :xs="6" :md="3" :lg="2">
            <label class="form-label">Cabana</label>
            <CFormSelect v-model="selectedVenueId" @change="loadAllData">
              <option value="">Todas las cabanas</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.name }}
              </option>
            </CFormSelect>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>

    <div v-if="loading" class="text-center py-5">
      <CSpinner color="primary" />
      <div class="text-body-secondary mt-2">Cargando datos...</div>
    </div>
    <template v-else>

    <CRow class="mb-4 g-3">
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--primary h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animTotalCalls }}</div>
            <div class="cabania-glass__label">Total Llamadas</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--info h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animTotalTokens }}</div>
            <div class="cabania-glass__label">Total Tokens</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--warning h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animTotalCost }}</div>
            <div class="cabania-glass__label">Costo Estimado</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--success h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animAvgTime }}</div>
            <div class="cabania-glass__label">Tiempo Promedio</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow class="mb-4">
      <CCol :md="6">
        <CCard class="h-100">
          <CCardHeader>Costo Mensual por Cabana</CCardHeader>
          <CCardBody>
            <div v-if="monthlyByVenue.length > 0" style="height: 300px;">
              <highcharts :options="costByVenueChartOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              No hay datos disponibles
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :md="6">
        <CCard class="h-100">
          <CCardHeader>Uso por Feature</CCardHeader>
          <CCardBody>
            <div v-if="summary.byFeature && summary.byFeature.length > 0" style="height: 300px;">
              <highcharts :options="featurePieChartOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              No hay datos de uso por feature
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CCard class="mb-4">
      <CCardHeader>Detalle de Llamadas</CCardHeader>
      <CCardBody class="p-0">
        <div class="table-responsive">
          <table class="table table-hover table-striped mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Feature</th>
                <th>Cabana</th>
                <th>Modelo</th>
                <th class="text-end">Tokens In</th>
                <th class="text-end">Tokens Out</th>
                <th class="text-end">Tiempo</th>
                <th class="text-end">Costo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in detailData" :key="row.id">
                <td class="text-nowrap">{{ formatDate(row.created_at) }}</td>
                <td>
                  <CBadge :color="featureBadgeColors[row.feature] || 'secondary'" shape="rounded-pill">
                    {{ featureLabels[row.feature] || row.feature }}
                  </CBadge>
                </td>
                <td>{{ row.venue_name }}</td>
                <td><small class="text-body-secondary">{{ row.model }}</small></td>
                <td class="text-end">{{ formatNumber(row.input_tokens) }}</td>
                <td class="text-end">{{ formatNumber(row.output_tokens) }}</td>
                <td class="text-end">{{ row.response_time_ms ? row.response_time_ms + ' ms' : '-' }}</td>
                <td class="text-end">{{ formatCost(row.cost_estimate) }}</td>
              </tr>
              <tr v-if="detailData.length === 0">
                <td colspan="8" class="text-center text-body-secondary py-4">No hay registros</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="pagination.totalPages > 1" class="d-flex justify-content-center py-3">
          <CPagination :pages="pagination.totalPages" :active-page="pagination.page" @update:active-page="goToPage" />
        </div>
      </CCardBody>
    </CCard>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'
import { useAnimatedNumber } from '@/composables/useAnimatedNumber'

const settingsStore = useSettingsStore()
const { user } = useAuth()

const periodOptions = [
  { value: 'last_12_months', label: 'Ultimos 12 meses' },
  { value: 'last_6_months', label: 'Ultimos 6 meses' },
  { value: 'last_3_months', label: 'Ultimos 3 meses' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este ano' }
]

const featureLabels = {
  message_generation: 'Mensajes',
  chat: 'Chat',
  payment_receipt_extraction: 'Recibo Pago',
  expense_receipt_analysis: 'Recibo Gasto'
}
const featureBadgeColors = {
  message_generation: 'success',
  chat: 'info',
  payment_receipt_extraction: 'warning',
  expense_receipt_analysis: 'danger'
}

const selectedPeriod = ref('last_6_months')
const selectedVenueId = ref('')
const venues = ref([])

const summary = ref({ totalCalls: 0, totalTokens: 0, totalCost: 0, avgResponseTime: 0, byFeature: [] })
const monthlyByVenue = ref([])
const detailData = ref([])
const pagination = ref({ page: 1, limit: 50, total: 0, totalPages: 0 })

const loading = ref(false)

const animTotalCalls = useAnimatedNumber(computed(() => summary.value.totalCalls), { formatter: formatNumber })
const animTotalTokens = useAnimatedNumber(computed(() => summary.value.totalTokens), { formatter: formatNumber })
// Cost uses x10000 scale for animation (useAnimatedNumber rounds to int)
const animTotalCost = useAnimatedNumber(computed(() => Math.round(summary.value.totalCost * 10000)), { formatter: (n) => '$' + (n / 10000).toFixed(4) })
const animAvgTime = useAnimatedNumber(computed(() => summary.value.avgResponseTime), { formatter: (n) => n + ' ms' })

const chartColors = [
  '#10b981', '#0ea5e9', '#6366f1', '#f43f5e', '#f59e0b',
  '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'
]
const labelColor = '#94a3b8'
const gridColor = 'rgba(148, 163, 184, 0.15)'

const costByVenueChartOptions = computed(() => {
  // Build stacked series: one series per venue
  const venueSet = new Map()
  for (const month of monthlyByVenue.value) {
    for (const v of month.venues) {
      if (!venueSet.has(v.venue_name)) venueSet.set(v.venue_name, [])
    }
  }
  // Fill data arrays
  for (const [name] of venueSet) {
    const data = monthlyByVenue.value.map(month => {
      const found = month.venues.find(v => v.venue_name === name)
      return found ? Math.round(found.cost * 10000) / 10000 : 0
    })
    venueSet.set(name, data)
  }
  const series = []
  let colorIdx = 0
  for (const [name, data] of venueSet) {
    series.push({ name, data, color: chartColors[colorIdx % chartColors.length] })
    colorIdx++
  }

  return {
    chart: {
      type: 'column',
      options3d: { enabled: true, alpha: 15, beta: 15, depth: 50 },
      backgroundColor: 'transparent',
      height: 300
    },
    title: { text: undefined },
    xAxis: {
      categories: monthlyByVenue.value.map(m => m.monthName),
      labels: { style: { color: labelColor } }
    },
    yAxis: {
      title: { text: undefined },
      min: 0,
      labels: { style: { color: labelColor }, formatter() { return '$' + this.value } },
      gridLineColor: gridColor
    },
    plotOptions: { column: { stacking: 'normal', depth: 25, borderWidth: 0 } },
    series,
    credits: { enabled: false },
    legend: { enabled: true, itemStyle: { color: labelColor } }
  }
})

const featurePieChartOptions = computed(() => ({
  chart: {
    type: 'pie',
    options3d: { enabled: true, alpha: 45, beta: 0 },
    backgroundColor: 'transparent',
    height: 300
  },
  title: { text: undefined },
  plotOptions: {
    pie: {
      innerSize: '50%',
      depth: 35,
      borderWidth: 0,
      dataLabels: {
        enabled: true,
        format: '{point.name}: {point.percentage:.1f}%',
        style: { color: labelColor, textOutline: 'none' }
      }
    }
  },
  series: [{
    data: (summary.value.byFeature || []).map((item, i) => ({
      name: featureLabels[item.feature] || item.feature,
      y: item.count,
      color: chartColors[i % chartColors.length]
    }))
  }],
  credits: { enabled: false }
}))

function formatNumber(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0)
}

function formatCost(amount) {
  return '$' + (amount || 0).toFixed(4)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getQueryParams() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  const params = new URLSearchParams()
  params.append('period', selectedPeriod.value)
  if (selectedVenueId.value) params.append('venue_id', selectedVenueId.value)
  params.append('viewAll', viewAll.toString())
  return params.toString()
}

async function loadVenues() {
  try {
    const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
    const response = await fetch(`/api/venues?viewAll=${viewAll}`, { credentials: 'include' })
    if (response.ok) venues.value = await response.json()
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

async function loadSummary() {
  try {
    const response = await fetch(`/api/analytics/ai-usage?${getQueryParams()}`, { credentials: 'include' })
    if (response.ok) summary.value = await response.json()
  } catch (error) {
    console.error('Error loading AI usage summary:', error)
  }
}

async function loadMonthlyByVenue() {
  try {
    const response = await fetch(`/api/analytics/ai-usage-by-venue?${getQueryParams()}`, { credentials: 'include' })
    if (response.ok) monthlyByVenue.value = await response.json()
  } catch (error) {
    console.error('Error loading AI usage by venue:', error)
  }
}

async function loadDetail(page = 1) {
  try {
    const params = getQueryParams() + `&page=${page}&limit=50`
    const response = await fetch(`/api/analytics/ai-usage-detail?${params}`, { credentials: 'include' })
    if (response.ok) {
      const result = await response.json()
      detailData.value = result.data
      pagination.value = result.pagination
    }
  } catch (error) {
    console.error('Error loading AI usage detail:', error)
  }
}

function goToPage(page) {
  loadDetail(page)
}

async function loadAllData() {
  loading.value = true
  try {
    await Promise.all([loadSummary(), loadMonthlyByVenue(), loadDetail(1)])
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadVenues()
  await loadAllData()
})
</script>
