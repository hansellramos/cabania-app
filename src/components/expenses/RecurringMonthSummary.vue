<template>
  <div class="mb-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <CButton color="secondary" variant="ghost" size="sm" title="Mes anterior" @click="shift(-1)">
        <CIcon name="cil-chevron-left" />
      </CButton>
      <div class="fw-semibold text-capitalize month-title">{{ monthLabel }}</div>
      <CButton color="secondary" variant="ghost" size="sm" title="Mes siguiente" @click="shift(1)">
        <CIcon name="cil-chevron-right" />
      </CButton>
    </div>

    <div v-if="!summary" class="text-center py-4">
      <CSpinner color="primary" size="sm" />
    </div>
    <template v-else>
      <CRow class="g-3 mb-3">
        <CCol :xs="6" :lg="3">
          <div class="stat">
            <div class="stat-label">Gastos recurrentes</div>
            <div class="stat-value">{{ money(summary.total) }}</div>
            <div class="stat-hint">{{ summary.paid_count + summary.pending_count }} pagos en el mes</div>
          </div>
        </CCol>
        <CCol :xs="6" :lg="3">
          <div class="stat">
            <div class="stat-label">Pagado</div>
            <div class="stat-value text-success">{{ money(summary.paid) }}</div>
            <div class="stat-hint">{{ summary.paid_count }} {{ summary.paid_count === 1 ? 'pago' : 'pagos' }}</div>
          </div>
        </CCol>
        <CCol :xs="6" :lg="3">
          <div class="stat">
            <div class="stat-label">Pendiente</div>
            <div class="stat-value text-warning">{{ money(summary.pending) }}</div>
            <div class="stat-hint">
              {{ summary.pending_count }} {{ summary.pending_count === 1 ? 'pago' : 'pagos' }}
              <template v-if="summary.pending_without_amount"> · {{ summary.pending_without_amount }} sin monto</template>
            </div>
          </div>
        </CCol>
        <CCol :xs="6" :lg="3">
          <div class="stat">
            <div class="stat-label">Ingresos del mes</div>
            <div class="stat-value text-info">{{ money(summary.income) }}</div>
            <div class="stat-hint">Pagos recibidos</div>
          </div>
        </CCol>
      </CRow>

      <CRow class="g-3">
        <CCol :lg="6">
          <CCard class="h-100">
            <CCardBody>
              <div class="fw-semibold mb-3">Balance del mes</div>

              <div class="d-flex justify-content-between small mb-1">
                <span>Ingresos <strong>{{ money(summary.income) }}</strong></span>
                <span>Gastos <strong>{{ money(summary.total) }}</strong></span>
              </div>
              <div class="balance-track" :title="`Los ingresos cubren el ${coverage}% de los gastos`">
                <div class="balance-fill" :class="covered ? 'bg-success' : 'bg-info'" :style="{ width: pct(summary.income, scale) + '%' }"></div>
                <div class="balance-goal" :style="{ left: pct(summary.total, scale) + '%' }"></div>
              </div>
              <div class="d-flex justify-content-between small text-body-secondary mt-1">
                <span>Cubierto: {{ coverage }}%</span>
                <span>Meta: cubrir los gastos</span>
              </div>

              <div class="balance-result mt-3" :class="covered ? 'text-success' : 'text-danger'">
                <template v-if="!summary.total">No hay gastos recurrentes en este mes</template>
                <template v-else-if="covered">Sobran {{ money(summary.balance) }}</template>
                <template v-else>Faltan {{ money(-summary.balance) }} para cubrir los gastos</template>
              </div>

              <div class="fw-semibold mt-4 mb-2 small">Pagado y pendiente</div>
              <div class="split-track">
                <div class="bg-success" :style="{ width: pct(summary.paid, summary.total) + '%' }"></div>
                <div class="bg-warning" :style="{ width: pct(summary.pending, summary.total) + '%' }"></div>
              </div>
              <div class="d-flex justify-content-between small text-body-secondary mt-1">
                <span><span class="dot bg-success"></span>Pagado {{ pct(summary.paid, summary.total) }}%</span>
                <span><span class="dot bg-warning"></span>Pendiente {{ pct(summary.pending, summary.total) }}%</span>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol :lg="6">
          <CCard class="h-100">
            <CCardBody>
              <div class="fw-semibold mb-2">Por categoría</div>
              <highcharts v-if="summary.categories.length" :options="categoryChart" />
              <div v-else class="text-body-secondary small py-4 text-center">Sin gastos en este mes</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const props = defineProps({
  venueId: { type: [String, Number], default: '' },
  // Bump to reload (after the list below registers, skips or edits something).
  refreshKey: { type: Number, default: 0 },
})

const thisMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7)
const month = ref(thisMonth())
const summary = ref(null)

const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
})

const shift = (k) => {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + k, 1))
  month.value = d.toISOString().slice(0, 7)
}

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
const pct = (part, whole) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0)

const covered = computed(() => summary.value && summary.value.income >= summary.value.total)
const coverage = computed(() => (summary.value?.total ? Math.round((summary.value.income / summary.value.total) * 100) : 100))
// The balance bar spans the bigger of income and expenses, so the goal marker always fits.
const scale = computed(() => Math.max(summary.value?.income || 0, summary.value?.total || 0))

const categoryChart = computed(() => {
  const cats = summary.value.categories
  const label = '#94a3b8'
  return {
    chart: { type: 'bar', backgroundColor: 'transparent', height: Math.max(160, cats.length * 44 + 80) },
    title: { text: undefined },
    xAxis: { categories: cats.map(c => c.name), labels: { style: { color: label } }, lineColor: 'transparent' },
    yAxis: { min: 0, title: { text: undefined }, labels: { style: { color: label } }, gridLineColor: 'rgba(148,163,184,0.15)' },
    legend: { itemStyle: { color: label }, itemHoverStyle: { color: label } },
    tooltip: { shared: true, valuePrefix: '$ ', valueDecimals: 0 },
    plotOptions: { series: { stacking: 'normal', borderWidth: 0, borderRadius: 3 } },
    series: [
      { name: 'Pagado', data: cats.map(c => c.paid), color: '#2eb85c' },
      { name: 'Pendiente', data: cats.map(c => c.pending), color: '#f9b115' },
    ],
    credits: { enabled: false },
  }
})

let request = 0
const load = async () => {
  const mine = ++request
  try {
    const params = new URLSearchParams({ month: month.value })
    if (props.venueId) params.append('venue_id', props.venueId)
    const response = await fetch(`/api/recurring-expenses/summary?${params}`, { credentials: 'include' })
    if (response.ok && mine === request) summary.value = await response.json()
  } catch (error) {
    console.error('Error loading the month summary:', error)
  }
}

watch(() => [month.value, props.venueId, props.refreshKey], load, { immediate: true })
</script>

<style scoped>
.month-title { font-size: 1.1rem; }
.stat {
  height: 100%;
  padding: 0.85rem 1rem;
  border: 1px solid var(--cui-border-color);
  border-radius: 0.5rem;
  background: var(--cui-card-bg, var(--cui-body-bg));
}
.stat-label { font-size: 0.8rem; color: var(--cui-secondary-color); }
.stat-value { font-size: 1.3rem; font-weight: 700; line-height: 1.3; }
.stat-hint { font-size: 0.75rem; color: var(--cui-secondary-color); }
.balance-track {
  position: relative;
  height: 1.1rem;
  border-radius: 999px;
  background: var(--cui-tertiary-bg);
}
.balance-fill { height: 100%; border-radius: 999px; transition: width 0.4s; }
.balance-goal {
  position: absolute;
  top: -0.3rem;
  bottom: -0.3rem;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: var(--cui-danger);
}
.balance-result { font-size: 1.15rem; font-weight: 700; }
.split-track {
  display: flex;
  height: 0.7rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--cui-tertiary-bg);
}
.split-track > div { transition: width 0.4s; }
.dot { display: inline-block; width: 0.6rem; height: 0.6rem; margin-right: 0.3rem; border-radius: 50%; }
</style>
