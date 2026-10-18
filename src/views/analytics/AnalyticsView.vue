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
          <CCol :xs="6" :md="3" :lg="2">
            <label class="form-label">Base contable</label>
            <ToggleButtonGroup v-model="selectedBasis" :options="basisOptions" @update:modelValue="loadAllData" />
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

    <CCard v-if="bookingProfit" class="mb-4">
      <CCardHeader class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <strong>Ganancia por alquiler</strong>
          <small class="text-body-secondary ms-2">
            {{ selectedBasis === 'accrual' ? 'Alquileres con fecha en el período' : 'Alquileres con pagos recibidos en el período' }}
          </small>
        </div>
        <div class="d-flex align-items-center gap-1">
          <CFormSwitch id="analyticsProrate" v-model="prorateFixed" label="Incluir gastos fijos prorrateados" class="mb-0" @update:modelValue="loadBookingProfit" />
          <span v-c-tooltip="{ content: prorateHelp, placement: 'left' }" class="text-body-secondary" style="cursor: help">
            <CIcon icon="cil-info" size="sm" />
          </span>
        </div>
      </CCardHeader>
      <CCardBody>
        <div v-if="bookingProfit.count === 0" class="text-center text-body-secondary py-4">
          No hay alquileres en el período seleccionado
        </div>
        <template v-else>
          <CRow class="g-3 mb-4">
            <CCol :xs="6" :lg="3">
              <div class="p-3 border rounded text-center h-100">
                <div class="text-muted small">Alquileres</div>
                <div class="fs-4 fw-semibold">{{ bookingProfit.count }}</div>
              </div>
            </CCol>
            <CCol :xs="6" :lg="3">
              <div class="p-3 border rounded text-center h-100">
                <div class="text-muted small">Ganancia total</div>
                <div class="fs-4 fw-semibold" :class="bookingProfit.totals.profit >= 0 ? 'text-success' : 'text-danger'">
                  {{ formatCurrency(bookingProfit.totals.profit) }}
                </div>
              </div>
            </CCol>
            <CCol :xs="6" :lg="3">
              <div class="p-3 border rounded text-center h-100">
                <div class="text-muted small">Ganancia promedio por alquiler</div>
                <div class="fs-4 fw-semibold">{{ formatCurrency(bookingProfit.avg_profit) }}</div>
              </div>
            </CCol>
            <CCol :xs="6" :lg="3">
              <div class="p-3 border rounded text-center h-100">
                <div class="text-muted small">Margen</div>
                <div class="fs-4 fw-semibold">{{ formatMargin(bookingProfit.margin) }}</div>
              </div>
            </CCol>
          </CRow>
          <div v-if="bookingProfit.estimated_commissions" class="small text-body-secondary mb-3">
            * {{ bookingProfit.estimated_commissions }} alquiler(es) incluyen la comisión estimada del comisionista (aún no registrada).
          </div>

          <CRow class="g-4 mb-4">
            <CCol :md="6">
              <h6 class="text-muted">Distribución de la ganancia por alquiler</h6>
              <div style="height: 260px;">
                <highcharts :options="profitDistributionOptions" />
              </div>
            </CCol>
            <CCol :md="6">
              <h6 class="text-muted">Por plan</h6>
              <CTable small hover responsive class="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Plan</CTableHeaderCell>
                    <CTableHeaderCell class="text-end">Alquileres</CTableHeaderCell>
                    <CTableHeaderCell class="text-end">Promedio</CTableHeaderCell>
                    <CTableHeaderCell class="text-end">Margen</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="plan in bookingProfit.by_plan" :key="plan.plan_id || 'none'">
                    <CTableDataCell>{{ plan.name }}</CTableDataCell>
                    <CTableDataCell class="text-end">{{ plan.count }}</CTableDataCell>
                    <CTableDataCell class="text-end" :class="plan.avg_profit >= 0 ? '' : 'text-danger'">{{ formatCurrency(plan.avg_profit) }}</CTableDataCell>
                    <CTableDataCell class="text-end">{{ formatMargin(plan.margin) }}</CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            </CCol>
          </CRow>

          <CRow class="g-4">
            <CCol v-for="list in profitRankings" :key="list.title" :md="bookingProfit.bottom.length ? 6 : 12">
              <h6 class="text-muted">{{ list.title }}</h6>
              <CTable small hover responsive class="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Fecha</CTableHeaderCell>
                    <CTableHeaderCell>Alquiler</CTableHeaderCell>
                    <CTableHeaderCell class="text-end">Ganancia</CTableHeaderCell>
                    <CTableHeaderCell class="text-end d-mobile-none">Margen</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="row in list.rows" :key="row.id" style="cursor: pointer" @click="$router.push(`/business/accommodations/${row.id}`)">
                    <CTableDataCell class="text-nowrap">{{ formatDate(row.date) }}</CTableDataCell>
                    <CTableDataCell>
                      {{ row.customer_name || 'Sin cliente' }}
                      <small class="text-body-secondary d-block">
                        {{ [row.venue_name, row.plan_name].filter(Boolean).join(' · ') }}
                        <CBadge v-if="row.status === 'cancelled'" color="danger" class="ms-1">Cancelado</CBadge>
                        <CBadge v-else-if="row.status === 'no_show'" color="warning" class="ms-1">No asistió</CBadge>
                      </small>
                    </CTableDataCell>
                    <CTableDataCell class="text-end text-nowrap" :class="row.profit >= 0 ? 'text-success' : 'text-danger'">
                      {{ formatCurrency(row.profit) }}<span v-if="row.commission_status === 'estimated'">*</span>
                    </CTableDataCell>
                    <CTableDataCell class="text-end d-mobile-none">{{ formatMargin(row.margin) }}</CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
            </CCol>
          </CRow>
        </template>
      </CCardBody>
    </CCard>

    <CRow v-if="incomeDetail.length > 0" class="mb-4">
      <CCol :xs="12">
        <CCard>
          <CCardHeader class="d-flex justify-content-between align-items-center">
            <strong>Detalle de Ingresos por Alquiler</strong>
            <small class="text-muted">{{ incomeDetail.length }} registros</small>
          </CCardHeader>
          <CCardBody class="p-0">
            <CTable hover responsive small class="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell
                    style="cursor: pointer; user-select: none;"
                    @click="toggleIncomeSort('display_date')"
                  >
                    {{ selectedBasis === 'accrual' ? 'Fecha Alquiler' : 'Fecha Ingreso' }}
                    {{ incomeSortIcon('display_date') }}
                  </CTableHeaderCell>
                  <CTableHeaderCell>Cabaña</CTableHeaderCell>
                  <CTableHeaderCell>Tipo</CTableHeaderCell>
                  <CTableHeaderCell
                    class="text-end"
                    style="cursor: pointer; user-select: none;"
                    @click="toggleIncomeSort('amount')"
                  >
                    Monto {{ incomeSortIcon('amount') }}
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="income in paginatedIncomeDetail" :key="income.id">
                  <CTableDataCell>{{ formatDate(income.display_date) }}</CTableDataCell>
                  <CTableDataCell>{{ income.venue_name || '—' }}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color="success">{{ income.type || 'alquiler' }}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell class="text-end">{{ formatCurrency(income.amount) }}</CTableDataCell>
                </CTableRow>
              </CTableBody>
              <CTableFoot>
                <CTableRow>
                  <CTableDataCell colspan="3" class="text-end fw-bold">Total</CTableDataCell>
                  <CTableDataCell class="text-end fw-bold text-success">
                    {{ formatCurrency(incomeTotalFiltered) }}
                  </CTableDataCell>
                </CTableRow>
              </CTableFoot>
            </CTable>
            <div v-if="incomeTotalPages > 1" class="d-flex flex-wrap align-items-center justify-content-between p-3 gap-2">
              <div class="small text-muted">
                Mostrando {{ incomePageStart }}-{{ incomePageEnd }} de {{ sortedIncomeDetail.length }}
              </div>
              <CPagination size="sm" class="mb-0">
                <CPaginationItem :disabled="incomeCurrentPage === 1" @click="incomeCurrentPage = 1">&laquo;</CPaginationItem>
                <CPaginationItem :disabled="incomeCurrentPage === 1" @click="incomeCurrentPage--">&lsaquo;</CPaginationItem>
                <CPaginationItem
                  v-for="page in incomeVisiblePages"
                  :key="page"
                  :active="page === incomeCurrentPage"
                  @click="incomeCurrentPage = page"
                >
                  {{ page }}
                </CPaginationItem>
                <CPaginationItem :disabled="incomeCurrentPage === incomeTotalPages" @click="incomeCurrentPage++">&rsaquo;</CPaginationItem>
                <CPaginationItem :disabled="incomeCurrentPage === incomeTotalPages" @click="incomeCurrentPage = incomeTotalPages">&raquo;</CPaginationItem>
              </CPagination>
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
import ToggleButtonGroup from '@/components/ToggleButtonGroup.vue'

const settingsStore = useSettingsStore()

const basisOptions = [
  { value: 'cash', label: 'Caja' },
  { value: 'accrual', label: 'Devengo' },
]
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
const selectedBasis = ref('cash')

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
const incomeDetail = ref([])

const loading = ref(false)
const loadingTrend = ref(false)
const loadingCategories = ref(false)
const loadingIncomeDetail = ref(false)

// Profit per booking (null when the user may not see it)
const bookingProfit = ref(null)
const prorateFixed = ref(false)
const prorateHelp = 'Suma a cada alquiler una parte de los gastos del mes de su cabaña que no están vinculados a ningún alquiler '
  + '(servicios, mantenimiento, arriendo…), repartidos por partes iguales entre los alquileres no cancelados de ese mes.'

// Income detail sorting & pagination
const incomeSortKey = ref('display_date')
const incomeSortOrder = ref('desc')
const incomeCurrentPage = ref(1)
const incomePerPage = 20

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

const profitDistributionOptions = computed(() => ({
  chart: { type: 'column', backgroundColor: 'transparent', height: 260 },
  title: { text: undefined },
  xAxis: {
    categories: (bookingProfit.value?.distribution || []).map(b => b.label),
    labels: { style: { color: labelColor } }
  },
  yAxis: {
    title: { text: undefined },
    allowDecimals: false,
    min: 0,
    labels: { style: { color: labelColor } },
    gridLineColor: gridColor
  },
  tooltip: { pointFormat: '<b>{point.y}</b> alquiler(es)' },
  plotOptions: { column: { borderWidth: 0, borderRadius: 4, pointPadding: 0.05, groupPadding: 0.1 } },
  legend: { enabled: false },
  series: [{
    name: 'Alquileres',
    data: (bookingProfit.value?.distribution || []).map(b => ({
      y: b.count,
      color: b.to === 0 ? '#f43f5e' : '#10b981'
    }))
  }],
  credits: { enabled: false }
}))

const profitRankings = computed(() => {
  if (!bookingProfit.value) return []
  const lists = [{ title: bookingProfit.value.bottom.length ? 'Más rentables' : 'Alquileres por ganancia', rows: bookingProfit.value.top }]
  if (bookingProfit.value.bottom.length) lists.push({ title: 'Menos rentables', rows: bookingProfit.value.bottom })
  return lists
})

function formatMargin(margin) {
  if (margin === null || margin === undefined) return '—'
  return `${Number(margin).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`
}

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { timeZone: 'UTC' })
}

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
  params.append('basis', selectedBasis.value)

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

function toggleIncomeSort(key) {
  if (incomeSortKey.value === key) {
    incomeSortOrder.value = incomeSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    incomeSortKey.value = key
    incomeSortOrder.value = 'desc'
  }
  incomeCurrentPage.value = 1
}

function incomeSortIcon(key) {
  if (incomeSortKey.value !== key) return ''
  return incomeSortOrder.value === 'asc' ? '▲' : '▼'
}

const sortedIncomeDetail = computed(() => {
  const items = incomeDetail.value.map(i => ({
    ...i,
    display_date: selectedBasis.value === 'accrual' ? i.accrual_date : i.date
  }))
  const key = incomeSortKey.value
  const dir = incomeSortOrder.value === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    let va, vb
    if (key === 'display_date') {
      va = new Date(a.display_date || 0).getTime()
      vb = new Date(b.display_date || 0).getTime()
    } else if (key === 'amount') {
      va = a.amount || 0
      vb = b.amount || 0
    } else {
      va = (a[key] || '').toString()
      vb = (b[key] || '').toString()
    }
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return 0
  })
})

const incomeTotalFiltered = computed(() =>
  sortedIncomeDetail.value.reduce((sum, i) => sum + (i.amount || 0), 0)
)

const incomeTotalPages = computed(() => Math.ceil(sortedIncomeDetail.value.length / incomePerPage))

const paginatedIncomeDetail = computed(() => {
  const start = (incomeCurrentPage.value - 1) * incomePerPage
  return sortedIncomeDetail.value.slice(start, start + incomePerPage)
})

const incomePageStart = computed(() => {
  if (sortedIncomeDetail.value.length === 0) return 0
  return (incomeCurrentPage.value - 1) * incomePerPage + 1
})

const incomePageEnd = computed(() =>
  Math.min(incomeCurrentPage.value * incomePerPage, sortedIncomeDetail.value.length)
)

const incomeVisiblePages = computed(() => {
  const pages = []
  const total = incomeTotalPages.value
  const current = incomeCurrentPage.value
  let start = Math.max(1, current - 2)
  let end = Math.min(total, current + 2)
  if (end - start < 4) {
    if (start === 1) end = Math.min(total, start + 4)
    else start = Math.max(1, end - 4)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

async function loadIncomeDetail() {
  loadingIncomeDetail.value = true
  incomeCurrentPage.value = 1
  try {
    const response = await fetch(`/api/analytics/income-detail?${getQueryParams()}`, { credentials: 'include' })
    if (response.ok) {
      incomeDetail.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading income detail:', error)
  } finally {
    loadingIncomeDetail.value = false
  }
}

async function loadBookingProfit() {
  try {
    const response = await fetch(`/api/analytics/booking-profit?${getQueryParams()}&prorate=${prorateFixed.value}`, { credentials: 'include' })
    bookingProfit.value = response.ok ? await response.json() : null
  } catch (error) {
    console.error('Error loading booking profit:', error)
  }
}

async function loadAllData() {
  loading.value = true
  try {
    await Promise.all([
      loadSummary(),
      loadMonthlyTrend(),
      loadExpensesByCategory(),
      loadIncomeDetail(),
      loadBookingProfit()
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
