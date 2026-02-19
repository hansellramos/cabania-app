<template>
  <div>
    <CRow class="mb-4">
      <CCol :xs="12">
        <CCard>
          <CCardBody>
            <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
              <h4 class="mb-0">Análisis de Hospedajes</h4>
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <div class="position-relative" style="min-width: 200px; max-width: 300px;">
                  <CFormInput
                    v-model="orgSearch"
                    placeholder="Filtrar por organizaciones..."
                    @input="onOrgSearchInput"
                    @focus="showOrgDropdown = true"
                    @blur="hideOrgDropdownWithDelay"
                    autocomplete="off"
                  />
                  <div v-if="showOrgDropdown && filteredOrganizations.length > 0" class="dropdown-menu show position-absolute w-100" style="max-height: 200px; overflow-y: auto; z-index: 1000;">
                    <button
                      v-for="org in filteredOrganizations"
                      :key="org.id"
                      class="dropdown-item"
                      @mousedown.prevent="selectOrganization(org)"
                    >
                      {{ org.name }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="selectedOrganizations.length > 0" class="mt-2 d-flex flex-wrap gap-2">
              <CBadge
                v-for="org in selectedOrganizations"
                :key="org.id"
                color="primary"
                class="d-flex align-items-center gap-1 px-2 py-1"
                style="cursor: pointer;"
                @click="removeOrganization(org)"
              >
                {{ org.name }}
                <span class="ms-1">&times;</span>
              </CBadge>
              <CButton
                v-if="selectedOrganizations.length > 1"
                color="secondary"
                size="sm"
                variant="ghost"
                @click="clearAllOrganizations"
              >
                Limpiar todos
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <div v-if="loading" class="text-center py-5">
      <CSpinner color="primary" />
      <div class="text-body-secondary mt-2">Cargando datos...</div>
    </div>
    <template v-else>

    <CRow class="mb-4 g-3">
      <CCol :xs="4" :lg="2">
        <CCard class="cabania-glass-banner cabania-glass-banner--danger h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animLast12 }}</div>
            <div class="cabania-glass__label small">Últimos 6M</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :xs="4" :lg="2">
        <CCard class="cabania-glass-banner cabania-glass-banner--warning h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animLast3 }}</div>
            <div class="cabania-glass__label small">Últimos 3M</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :xs="4" :lg="2">
        <CCard class="cabania-glass-banner cabania-glass-banner--info h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animPrevMonth }}</div>
            <div class="cabania-glass__label small">Mes Anterior</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :xs="4" :lg="2">
        <CCard class="cabania-glass-banner cabania-glass-banner--primary h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animThisMonth }}</div>
            <div class="cabania-glass__label small">Este Mes</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :xs="4" :lg="2">
        <CCard class="cabania-glass-banner cabania-glass-banner--warning h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animNext3 }}</div>
            <div class="cabania-glass__label small">Próximos 3M</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :xs="4" :lg="2">
        <CCard class="cabania-glass-banner cabania-glass-banner--success h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animNext12 }}</div>
            <div class="cabania-glass__label small">Próximos 6M</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow class="mb-4">
      <CCol :md="6">
        <CCard class="h-100">
          <CCardHeader>Hospedajes - Últimos 6 Meses</CCardHeader>
          <CCardBody>
            <div v-if="accommodationsHistory.venues?.length > 0" style="height: 300px;">
              <highcharts :options="historyChartOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              No hay datos de hospedajes históricos
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :md="6">
        <CCard class="h-100">
          <CCardHeader>Hospedajes - Próximos 6 Meses</CCardHeader>
          <CCardBody>
            <div v-if="accommodationsForecast.venues?.length > 0" style="height: 300px;">
              <highcharts :options="forecastChartOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              No hay datos de hospedajes futuros
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow class="mb-2">
      <CCol :xs="12">
        <div class="d-flex align-items-center gap-2">
          <span class="text-body-secondary">Período de Ingresos:</span>
          <CFormSelect
            v-model="selectedIncomePeriod"
            @change="loadPeriodData"
            style="width: auto; min-width: 180px;"
            size="sm"
          >
            <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </CFormSelect>
        </div>
      </CCol>
    </CRow>

    <CRow class="mb-4 g-3">
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--primary h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">
              {{ animIncomeThisMonth }}
              <span v-if="incomeSummary.percentChange !== 0" class="fs-6 fw-normal ms-2">
                {{ incomeSummary.percentChange >= 0 ? '+' : '' }}{{ incomeSummary.percentChange }}%
              </span>
            </div>
            <div class="cabania-glass__label">Ingresos Este Mes</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--info h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animIncomePrevMonth }}</div>
            <div class="cabania-glass__label">Ingresos Mes Anterior</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--success h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">{{ animIncomeTotal }}</div>
            <div class="cabania-glass__label">Ingresos Totales</div>
            <small class="cabania-glass__label">{{ incomeByVenue.length }} cabañas con ingresos</small>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow>
      <CCol :md="6">
        <CCard class="mb-4">
          <CCardHeader>Hospedajes por Cabaña</CCardHeader>
          <CCardBody>
            <div v-if="accommodationsByVenue.length > 0" style="height: 300px;">
              <highcharts :options="accommodationsPieOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              No hay datos de hospedajes disponibles
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :md="6">
        <CCard class="mb-4 h-100">
          <CCardHeader>Hospedajes por Cabaña (Lista)</CCardHeader>
          <CCardBody class="p-2">
            <div v-if="accommodationsByVenue.length > 0" class="cabania-category-list">
              <div
                v-for="(item, i) in accommodationsByVenue"
                :key="item.venue_id"
                class="cabania-category-row"
              >
                <div class="cabania-category-row__accent" :style="{ backgroundColor: chartColors[i % chartColors.length] }"></div>
                <div class="cabania-category-row__name">{{ item.venue_name }}</div>
                <div class="cabania-category-row__values">
                  <span class="cabania-category-row__total">{{ item.count }}</span>
                  <span class="cabania-category-row__count">hospedajes</span>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              No hay datos de hospedajes disponibles
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'
import { useAnimatedNumber } from '@/composables/useAnimatedNumber'

const settingsStore = useSettingsStore()
const { user } = useAuth()

const loading = ref(false)
const organizations = ref([])
const selectedOrganizations = ref([])
const orgSearch = ref('')
const showOrgDropdown = ref(false)

const incomeSummary = ref({
  currentMonth: { total: 0, count: 0 },
  previousMonth: { total: 0, count: 0 },
  percentChange: 0
})
const incomeByVenue = ref([])
const accommodationsHistory = ref({ months: [], venues: [] })
const accommodationsForecast = ref({ months: [], venues: [] })

// Period filter options
const periodOptions = [
  { value: 'next_12_months', label: 'Próximos 12 meses' },
  { value: 'next_3_months', label: 'Próximos 3 meses' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'last_6_months', label: 'Últimos 6 meses' },
  { value: 'last_12_months', label: 'Últimos 12 meses' }
]

// Period filter for income and accommodations by venue sections
const selectedIncomePeriod = ref('last_6_months')
const accommodationsByVenue = ref([])

const filteredOrganizations = computed(() => {
  if (!orgSearch.value) {
    return organizations.value.filter(o => !selectedOrganizations.value.find(s => s.id === o.id))
  }
  const q = orgSearch.value.toLowerCase()
  return organizations.value.filter(o => 
    o.name?.toLowerCase().includes(q) && 
    !selectedOrganizations.value.find(s => s.id === o.id)
  )
})

const totalIncomeByVenue = computed(() => {
  const total = incomeByVenue.value.reduce((sum, item) => sum + Number(item.total || 0), 0)
  return formatCurrency(total)
})

const totalAccommodationsNext12 = computed(() => {
  if (!accommodationsForecast.value.venues) return 0
  return accommodationsForecast.value.venues.reduce((sum, venue) =>
    sum + venue.counts.reduce((s, c) => s + c, 0), 0)
})

const totalAccommodationsThisMonth = computed(() => {
  if (!accommodationsForecast.value.venues) return 0
  return accommodationsForecast.value.venues.reduce((sum, venue) =>
    sum + (venue.counts[0] || 0), 0)
})

const totalAccommodationsNext3 = computed(() => {
  if (!accommodationsForecast.value.venues) return 0
  return accommodationsForecast.value.venues.reduce((sum, venue) =>
    sum + venue.counts.slice(0, 3).reduce((s, c) => s + c, 0), 0)
})

const totalAccommodationsLast12 = computed(() => {
  if (!accommodationsHistory.value.venues) return 0
  return accommodationsHistory.value.venues.reduce((sum, venue) =>
    sum + venue.counts.reduce((s, c) => s + c, 0), 0)
})

const totalAccommodationsLast3 = computed(() => {
  if (!accommodationsHistory.value.venues) return 0
  return accommodationsHistory.value.venues.reduce((sum, venue) =>
    sum + venue.counts.slice(-3).reduce((s, c) => s + c, 0), 0)
})

const totalAccommodationsPreviousMonth = computed(() => {
  if (!accommodationsHistory.value.venues) return 0
  return accommodationsHistory.value.venues.reduce((sum, venue) =>
    sum + (venue.counts[venue.counts.length - 2] || 0), 0)
})

// Animated display values
const animLast12 = useAnimatedNumber(totalAccommodationsLast12)
const animLast3 = useAnimatedNumber(totalAccommodationsLast3)
const animPrevMonth = useAnimatedNumber(totalAccommodationsPreviousMonth)
const animThisMonth = useAnimatedNumber(totalAccommodationsThisMonth)
const animNext3 = useAnimatedNumber(totalAccommodationsNext3)
const animNext12 = useAnimatedNumber(totalAccommodationsNext12)

const rawIncomeThisMonth = computed(() => incomeSummary.value.currentMonth.total || 0)
const rawIncomePrevMonth = computed(() => incomeSummary.value.previousMonth.total || 0)
const rawIncomeTotal = computed(() => incomeByVenue.value.reduce((sum, item) => sum + Number(item.total || 0), 0))

const animIncomeThisMonth = useAnimatedNumber(rawIncomeThisMonth, { formatter: formatCurrency })
const animIncomePrevMonth = useAnimatedNumber(rawIncomePrevMonth, { formatter: formatCurrency })
const animIncomeTotal = useAnimatedNumber(rawIncomeTotal, { formatter: formatCurrency })

const chartColors = [
  '#10b981', '#0ea5e9', '#6366f1', '#f43f5e', '#f59e0b',
  '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899'
]

const labelColor = '#94a3b8'
const gridColor = 'rgba(148, 163, 184, 0.15)'

const historyChartOptions = computed(() => ({
  chart: {
    type: 'column',
    options3d: { enabled: true, alpha: 15, beta: 15, depth: 50 },
    backgroundColor: 'transparent',
    height: 300
  },
  title: { text: undefined },
  xAxis: {
    categories: accommodationsHistory.value.months || [],
    labels: { style: { color: labelColor } }
  },
  yAxis: {
    title: { text: undefined },
    labels: { style: { color: labelColor } },
    gridLineColor: gridColor,
    allowDecimals: false
  },
  plotOptions: {
    column: { stacking: 'normal', depth: 25, borderWidth: 0 }
  },
  series: (accommodationsHistory.value.venues || []).map((venue, i) => ({
    name: venue.venue_name,
    data: venue.counts,
    color: chartColors[i % chartColors.length]
  })),
  credits: { enabled: false },
  legend: { enabled: true, itemStyle: { color: labelColor } }
}))

const forecastChartOptions = computed(() => ({
  chart: {
    type: 'column',
    options3d: { enabled: true, alpha: 15, beta: 15, depth: 50 },
    backgroundColor: 'transparent',
    height: 300
  },
  title: { text: undefined },
  xAxis: {
    categories: accommodationsForecast.value.months || [],
    labels: { style: { color: labelColor } }
  },
  yAxis: {
    title: { text: undefined },
    labels: { style: { color: labelColor } },
    gridLineColor: gridColor,
    allowDecimals: false
  },
  plotOptions: {
    column: { stacking: 'normal', depth: 25, borderWidth: 0 }
  },
  series: (accommodationsForecast.value.venues || []).map((venue, i) => ({
    name: venue.venue_name,
    data: venue.counts,
    color: chartColors[i % chartColors.length]
  })),
  credits: { enabled: false },
  legend: { enabled: true, itemStyle: { color: labelColor } }
}))

const accommodationsPieOptions = computed(() => ({
  chart: {
    type: 'pie',
    options3d: { enabled: true, alpha: 45, beta: 0 },
    backgroundColor: 'transparent',
    height: 300
  },
  title: { text: undefined },
  plotOptions: {
    pie: {
      depth: 35,
      borderWidth: 0,
      dataLabels: { enabled: true, format: '{point.name}: {point.y}', style: { color: labelColor, textOutline: 'none' } }
    }
  },
  series: [{
    data: accommodationsByVenue.value.map((item, i) => ({
      name: item.venue_name,
      y: item.count,
      color: chartColors[i % chartColors.length]
    }))
  }],
  credits: { enabled: false }
}))

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0)
}

function onOrgSearchInput() {
  showOrgDropdown.value = true
}

function hideOrgDropdownWithDelay() {
  setTimeout(() => { showOrgDropdown.value = false }, 150)
}

function selectOrganization(org) {
  selectedOrganizations.value.push(org)
  orgSearch.value = ''
  showOrgDropdown.value = false
  loadAllAnalytics()
}

function removeOrganization(org) {
  selectedOrganizations.value = selectedOrganizations.value.filter(o => o.id !== org.id)
  loadAllAnalytics()
}

function clearAllOrganizations() {
  selectedOrganizations.value = []
  loadAllAnalytics()
}

function getAnalyticsParams() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  const params = new URLSearchParams()
  params.append('viewAll', viewAll.toString())
  if (selectedOrganizations.value.length > 0) {
    params.append('organizations', selectedOrganizations.value.map(o => o.id).join(','))
  }
  return params.toString()
}

async function loadOrganizations() {
  try {
    const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
    const response = await fetch(`/api/organizations?viewAll=${viewAll}`, { credentials: 'include' })
    if (response.ok) {
      organizations.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading organizations:', error)
  }
}

async function loadIncomeSummary() {
  try {
    const response = await fetch(`/api/analytics/income-summary?${getAnalyticsParams()}`, { credentials: 'include' })
    if (response.ok) {
      incomeSummary.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading income summary:', error)
  }
}

async function loadIncomeByVenue() {
  try {
    const params = new URLSearchParams(getAnalyticsParams())
    params.append('period', selectedIncomePeriod.value)
    const response = await fetch(`/api/analytics/income-by-venue?${params.toString()}`, { credentials: 'include' })
    if (response.ok) {
      incomeByVenue.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading income by venue:', error)
  }
}

async function loadAccommodationsHistory() {
  try {
    const response = await fetch(`/api/analytics/accommodations-history?months=6&${getAnalyticsParams()}`, { credentials: 'include' })
    if (response.ok) {
      accommodationsHistory.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading accommodations history:', error)
  }
}

async function loadAccommodationsForecast() {
  try {
    const response = await fetch(`/api/analytics/accommodations-forecast?months=6&${getAnalyticsParams()}`, { credentials: 'include' })
    if (response.ok) {
      accommodationsForecast.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading accommodations forecast:', error)
  }
}

async function loadAccommodationsByVenue() {
  try {
    const params = new URLSearchParams(getAnalyticsParams())
    params.append('period', selectedIncomePeriod.value)
    const response = await fetch(`/api/analytics/accommodations-by-venue?${params.toString()}`, { credentials: 'include' })
    if (response.ok) {
      accommodationsByVenue.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading accommodations by venue:', error)
  }
}

async function loadPeriodData() {
  loading.value = true
  try {
    await Promise.all([
      loadIncomeByVenue(),
      loadAccommodationsByVenue()
    ])
  } finally {
    loading.value = false
  }
}

async function loadAllAnalytics() {
  loading.value = true
  try {
    await Promise.all([
      loadIncomeSummary(),
      loadIncomeByVenue(),
      loadAccommodationsHistory(),
      loadAccommodationsForecast(),
      loadAccommodationsByVenue()
    ])
  } finally {
    loading.value = false
  }
}

watch(() => settingsStore.godModeViewAll, () => {
  loadOrganizations()
  loadAllAnalytics()
})

onMounted(async () => {
  await loadOrganizations()
  await loadAllAnalytics()
})
</script>
