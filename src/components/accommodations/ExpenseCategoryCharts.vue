<template>
  <div v-if="categories.length" class="expense-charts mb-3">
    <CNav variant="pills" class="mb-2 expense-charts__tabs">
      <CNavItem>
        <CNavLink href="javascript:void(0)" :active="view === 'donut'" @click="view = 'donut'">Dona</CNavLink>
      </CNavItem>
      <CNavItem>
        <CNavLink href="javascript:void(0)" :active="view === 'bars'" @click="view = 'bars'">Barras</CNavLink>
      </CNavItem>
    </CNav>
    <highcharts v-if="view === 'donut'" :key="'donut'" :options="donutOptions" />
    <highcharts v-else :key="'bars'" :options="barOptions" />
  </div>
</template>

<script setup>
// Expenses of one booking by category: a donut that leads with each category's
// share (amount in the tooltip, total in the middle) and bars that lead with the
// amount (share next to it).
import { ref, computed } from 'vue'
import { CNav, CNavItem, CNavLink } from '@coreui/vue'

const props = defineProps({
  expenses: { type: Array, default: () => [] }
})

const view = ref('donut')

const CHART_COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#f43f5e', '#f59e0b', '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899']
// Categories store a hex color or a CoreUI color name.
const NAMED_COLORS = {
  primary: '#6366f1', secondary: '#8b5cf6', success: '#10b981', danger: '#f43f5e', warning: '#f59e0b',
  info: '#0ea5e9', light: '#e2e8f0', dark: '#475569'
}
// A near-white color (e.g. #ebedef) vanishes on the chart: use gray instead.
const isPale = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return false
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16))
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85
}
const chartColor = (color, index) => {
  const hex = (color?.startsWith('#') ? color : NAMED_COLORS[color]) || CHART_COLORS[index % CHART_COLORS.length]
  return isPale(hex) ? '#94a3b8' : hex
}

const labelColor = '#94a3b8'

const money = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

const total = computed(() => categories.value.reduce((sum, c) => sum + c.total, 0))

const categories = computed(() => {
  const byName = new Map()
  for (const expense of props.expenses) {
    const name = expense.category?.name || 'Sin categoría'
    const entry = byName.get(name) || { name, color: expense.category?.color, total: 0 }
    entry.total += Number(expense.amount) || 0
    byName.set(name, entry)
  }
  return [...byName.values()]
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((c, i) => ({ ...c, color: chartColor(c.color, i) }))
})

const share = (value) => (total.value ? (value / total.value) * 100 : 0)
const pct = (value, digits = 1) => `${value.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

const donutOptions = computed(() => ({
  chart: { type: 'pie', backgroundColor: 'transparent', height: 300 },
  title: {
    text: `<span style="font-size:0.75rem;color:${labelColor}">Total</span><br><b>${money(total.value)}</b>`,
    useHTML: true,
    verticalAlign: 'middle',
    floating: true,
    style: { textAlign: 'center' }
  },
  tooltip: {
    formatter() {
      return `<b>${this.point.name}</b><br>${money(this.point.y)} · ${pct(this.point.percentage)}`
    }
  },
  plotOptions: {
    pie: {
      innerSize: '62%',
      borderWidth: 0,
      dataLabels: {
        enabled: true,
        formatter() { return `${this.point.name}: ${pct(this.point.percentage)}` },
        distance: 16,
        style: { color: labelColor, textOutline: 'none', fontWeight: 'normal' }
      }
    }
  },
  series: [{
    name: 'Egresos',
    data: categories.value.map(c => ({ name: c.name, y: c.total, color: c.color }))
  }],
  legend: {
    labelFormatter() { return `${this.name}: ${money(this.y)} · ${pct(this.percentage)}` },
    itemStyle: { color: labelColor, fontWeight: 'normal' }
  },
  // On a phone the labels around the donut get cut: a legend below instead.
  responsive: {
    rules: [{
      condition: { maxWidth: 500 },
      chartOptions: {
        chart: { height: 260 + categories.value.length * 22 },
        title: { verticalAlign: 'top', y: 95 },
        plotOptions: { pie: { showInLegend: true, size: 190, center: ['50%', 95], dataLabels: { enabled: false } } }
      }
    }]
  },
  credits: { enabled: false }
}))

const barOptions = computed(() => ({
  chart: { type: 'bar', backgroundColor: 'transparent', height: Math.max(180, 70 + categories.value.length * 44) },
  title: { text: undefined },
  xAxis: {
    categories: categories.value.map(c => c.name),
    labels: { style: { color: labelColor } }
  },
  // Each bar carries its amount, so no axis labels; room on the right for them.
  yAxis: {
    title: { text: undefined },
    min: 0,
    max: (categories.value[0]?.total || 0) * 1.45,
    labels: { enabled: false },
    gridLineWidth: 0
  },
  tooltip: {
    formatter() {
      return `<b>${this.point.category}</b><br>${money(this.point.y)} · ${pct(share(this.point.y))}`
    }
  },
  plotOptions: {
    bar: {
      borderWidth: 0,
      borderRadius: 4,
      dataLabels: {
        enabled: true,
        inside: false,
        crop: false,
        overflow: 'allow',
        formatter() { return `${money(this.point.y)} · ${pct(share(this.point.y), 0)}` },
        style: { color: labelColor, textOutline: 'none', fontWeight: 'normal' }
      }
    }
  },
  legend: { enabled: false },
  series: [{
    name: 'Egresos',
    data: categories.value.map(c => ({ y: c.total, color: c.color }))
  }],
  credits: { enabled: false }
}))
</script>

<style scoped>
.expense-charts__tabs .nav-link {
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
}
</style>
