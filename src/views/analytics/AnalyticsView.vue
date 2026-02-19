<template>
  <div>
    <CCard class="mb-4">
      <CCardBody>
        <CRow class="g-3 align-items-end">
          <CCol :xs="6" :md="3" :lg="2">
            <label class="form-label">Período</label>
            <CFormSelect v-model="selectedPeriod" @change="loadAllData">
              <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </CFormSelect>
          </CCol>
          <CCol :xs="6" :md="3" :lg="2">
            <label class="form-label">Cabaña</label>
            <CFormSelect v-model="selectedVenueId" @change="loadAllData">
              <option value="">Todas las cabañas</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.name }}
              </option>
            </CFormSelect>
          </CCol>
          <CCol :xs="6" :md="3" :lg="2">
            <label class="form-label">Organización</label>
            <CFormSelect v-model="selectedOrganizationId" @change="loadAllData">
              <option value="">Todas las organizaciones</option>
              <option v-for="org in organizations" :key="org.id" :value="org.id">
                {{ org.name }}
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
        <CCard class="cabania-glass-banner cabania-glass-banner--success h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">
              {{ animIncome }}
            </div>
            <div class="cabania-glass__label">Ingresos</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--danger h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">
              {{ animExpenses }}
            </div>
            <div class="cabania-glass__label">Egresos</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--warning h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">
              {{ animDeposits }}
            </div>
            <div class="cabania-glass__label">Depósitos Retenidos</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :lg="3">
        <CCard class="cabania-glass-banner cabania-glass-banner--primary h-100">
          <CCardBody class="pb-3 text-end">
            <div class="fs-4 fw-semibold">
              {{ animProfit }}
            </div>
            <div class="cabania-glass__label">Utilidad</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow class="mb-4">
      <CCol :md="6">
        <CCard class="h-100">
          <CCardHeader>Tendencia Mensual de Ingresos vs Egresos</CCardHeader>
          <CCardBody>
            <div v-if="monthlyTrend.length > 0" style="height: 300px;">
              <highcharts :options="trendChartOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              <CSpinner v-if="loadingTrend" />
              <span v-else>No hay datos de tendencia disponibles</span>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :md="6">
        <CCard class="h-100">
          <CCardHeader>Egresos por Categoría</CCardHeader>
          <CCardBody>
            <div v-if="expensesByCategory.length > 0" style="height: 300px;">
              <highcharts :options="doughnutChartOptions" />
            </div>
            <div v-else class="text-center text-body-secondary py-5">
              <CSpinner v-if="loadingCategories" />
              <span v-else>No hay datos de egresos por categoría</span>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CRow v-if="expensesByCategory.length > 0">
      <CCol :md="6">
        <CCard class="mb-4 h-100">
          <CCardHeader>Egresos por Categoría</CCardHeader>
          <CCardBody>
            <div style="height: 300px;">
              <highcharts :options="expensesCategoryBarOptions" />
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :md="6">
        <CCard class="mb-4 h-100">
          <CCardHeader>Detalle de Egresos por Categoría</CCardHeader>
          <CCardBody class="p-2">
            <div class="cabania-category-list">
              <div
                v-for="(category, i) in expensesByCategory"
                :key="category.id"
                class="cabania-category-row"
              >
                <div class="cabania-category-row__accent" :style="{ backgroundColor: getChartColor(category.color, i) }"></div>
                <div class="cabania-category-row__name">
                  <CIcon v-if="category.icon" :icon="category.icon" class="me-2" />
                  {{ category.name }}
                </div>
                <div class="cabania-category-row__values">
                  <span class="cabania-category-row__total">{{ formatCurrency(category.total) }}</span>
                  <span class="cabania-category-row__count">{{ category.count }} mov.</span>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
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
  { value: 'last_12_months', label: 'Últimos 12 meses' },
  { value: 'last_6_months', label: 'Últimos 6 meses' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'this_year', label: 'Este año' }
]

const selectedPeriod = ref('last_6_months')
const selectedVenueId = ref('')
const selectedOrganizationId = ref('')

const venues = ref([])
const organizations = ref([])
const summary = ref({
  income: 0,
  expenses: 0,
  depositsHeld: 0,
  depositsClaimed: 0,
  profit: 0,
  period: { from: '', to: '' }
})
const monthlyTrend = ref([])
const expensesByCategory = ref([])

const loading = ref(false)
const loadingTrend = ref(false)
const loadingCategories = ref(false)

const animIncome = useAnimatedNumber(computed(() => summary.value.income), { formatter: formatCurrency })
const animExpenses = useAnimatedNumber(computed(() => summary.value.expenses), { formatter: formatCurrency })
const animDeposits = useAnimatedNumber(computed(() => summary.value.depositsHeld), { formatter: formatCurrency })
const animProfit = useAnimatedNumber(computed(() => summary.value.profit), { formatter: formatCurrency })

const chartColors = [
  '#10b981', '#0ea5e9', '#6366f1', '#f43f5e', '#f59e0b',
  '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899',
  '#059669', '#0284c7', '#4f46e5', '#e11d48', '#d97706'
]

// Mapeo de colores Bootstrap/CoreUI a hexadecimales
const bootstrapColors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  danger: '#f43f5e',
  warning: '#f59e0b',
  info: '#0ea5e9',
  light: '#e2e8f0',
  dark: '#475569',
  indigo: '#6366f1',
  pink: '#ec4899',
  teal: '#14b8a6'
}

const getChartColor = (color, index) => {
  if (!color) return chartColors[index % chartColors.length]
  if (color.startsWith('#')) return color
  return bootstrapColors[color] || chartColors[index % chartColors.length]
}

const labelColor = '#94a3b8'
const gridColor = 'rgba(148, 163, 184, 0.15)'

const trendChartOptions = computed(() => ({
  chart: {
    type: 'column',
    options3d: { enabled: true, alpha: 15, beta: 15, depth: 50 },
    backgroundColor: 'transparent',
    height: 300
  },
  title: { text: undefined },
  xAxis: {
    categories: monthlyTrend.value.map(item => item.monthName),
    labels: { style: { color: labelColor } }
  },
  yAxis: {
    title: { text: undefined },
    min: 0,
    labels: { style: { color: labelColor } },
    gridLineColor: gridColor
  },
  plotOptions: { column: { depth: 25, borderWidth: 0, grouping: true } },
  series: [
    { name: 'Ingresos', data: monthlyTrend.value.map(item => item.income), color: '#10b981' },
    { name: 'Egresos', data: monthlyTrend.value.map(item => item.expenses), color: '#f43f5e' }
  ],
  credits: { enabled: false },
  legend: { enabled: true, itemStyle: { color: labelColor } }
}))

const doughnutChartOptions = computed(() => ({
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
      dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.1f}%', style: { color: labelColor, textOutline: 'none' } }
    }
  },
  series: [{
    data: expensesByCategory.value.map((item, i) => ({
      name: item.name,
      y: item.total,
      color: getChartColor(item.color, i)
    }))
  }],
  credits: { enabled: false }
}))

const expensesCategoryBarOptions = computed(() => ({
  chart: {
    type: 'bar',
    options3d: { enabled: true, alpha: 15, beta: 15, depth: 50 },
    backgroundColor: 'transparent',
    height: 300
  },
  title: { text: undefined },
  xAxis: {
    categories: expensesByCategory.value.map(item => item.name),
    labels: { style: { color: labelColor } }
  },
  yAxis: {
    title: { text: undefined },
    min: 0,
    labels: { style: { color: labelColor } },
    gridLineColor: gridColor
  },
  plotOptions: { bar: { depth: 25, borderWidth: 0 } },
  legend: { enabled: false },
  series: [{
    name: 'Total',
    data: expensesByCategory.value.map((item, i) => ({
      y: item.total,
      color: getChartColor(item.color, i)
    }))
  }],
  credits: { enabled: false }
}))

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount || 0)
}

function getQueryParams() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  const params = new URLSearchParams()

  params.append('period', selectedPeriod.value)
  if (selectedVenueId.value) {
    params.append('venue_id', selectedVenueId.value)
  }
  if (selectedOrganizationId.value) {
    params.append('organization_id', selectedOrganizationId.value)
  }
  params.append('viewAll', viewAll.toString())

  return params.toString()
}

async function loadVenues() {
  try {
    const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
    const response = await fetch(`/api/venues?viewAll=${viewAll}`, { credentials: 'include' })
    if (response.ok) {
      venues.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading venues:', error)
  }
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

async function loadSummary() {
  try {
    const response = await fetch(`/api/analytics/summary?${getQueryParams()}`, { credentials: 'include' })
    if (response.ok) {
      summary.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading summary:', error)
  }
}

async function loadMonthlyTrend() {
  loadingTrend.value = true
  try {
    const response = await fetch(`/api/analytics/monthly-trend?${getQueryParams()}`, { credentials: 'include' })
    if (response.ok) {
      monthlyTrend.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading monthly trend:', error)
  } finally {
    loadingTrend.value = false
  }
}

async function loadExpensesByCategory() {
  loadingCategories.value = true
  try {
    const response = await fetch(`/api/analytics/expenses-by-category?${getQueryParams()}`, { credentials: 'include' })
    if (response.ok) {
      expensesByCategory.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading expenses by category:', error)
  } finally {
    loadingCategories.value = false
  }
}

async function loadAllData() {
  loading.value = true
  try {
    await Promise.all([
      loadSummary(),
      loadMonthlyTrend(),
      loadExpensesByCategory()
    ])
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadVenues(),
    loadOrganizations()
  ])
  await loadAllData()
})
</script>
