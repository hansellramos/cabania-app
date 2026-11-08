<template>
  <div>
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
      <div>
        <h2 class="mb-1">Pagos y balance</h2>
        <p class="text-body-secondary mb-0">Los gastos que se repiten, mes a mes: lo pagado, lo omitido y lo que falta.</p>
      </div>
      <div v-if="venues.length > 1" style="min-width: 220px;">
        <CFormLabel class="small">Sede</CFormLabel>
        <CFormSelect v-model="venueId" size="sm">
          <option value="">Todas las sedes</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
        </CFormSelect>
      </div>
    </div>

    <RecurringMonthSummary v-model:month="month" :venue-id="venueId" :refresh-key="refreshKey" />

    <CCard class="mb-4">
      <CCardHeader class="fw-semibold text-capitalize">Pagos de {{ monthName }}</CCardHeader>
      <CCardBody>
        <RecurringMonthTable :month="month" :venue-id="venueId" :refresh-key="refreshKey" @changed="refreshKey++; panelKey++" />
      </CCardBody>
    </CCard>

    <CCard v-if="isCurrentMonth" class="mb-4">
      <CCardHeader class="fw-semibold">Estado de hoy y configuración</CCardHeader>
      <CCardBody>
        <RecurringExpensesPanel
          :key="panelKey"
          v-model:venue-id="venueId"
          :venues="venues"
          :categories="categories"
          hide-venue-filter
          @loaded="refreshKey++"
        />
      </CCardBody>
    </CCard>
    <div v-else class="text-center mb-4">
      <CButton color="secondary" variant="outline" size="sm" @click="month = thisMonth()">
        Volver al mes actual para crear o editar recurrentes
      </CButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CButton, CCard, CCardBody, CCardHeader, CFormLabel, CFormSelect } from '@coreui/vue'
import RecurringMonthSummary from '@/components/expenses/RecurringMonthSummary.vue'
import RecurringMonthTable from '@/components/expenses/RecurringMonthTable.vue'
import RecurringExpensesPanel from '@/components/expenses/RecurringExpensesPanel.vue'

const route = useRoute()
const router = useRouter()
const thisMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7)

// The month lives in the URL (?month=YYYY-MM), so coming back from registering a
// payment lands on the same month.
const validMonth = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || '')) ? m : null)
const month = ref(validMonth(route.query.month) || thisMonth())
const isCurrentMonth = computed(() => month.value === thisMonth())
const monthName = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
})
watch(month, (m) => {
  router.replace({ query: { ...route.query, month: m === thisMonth() ? undefined : m } })
})

const venueId = ref('')
// refreshKey reloads the summary and the month table; panelKey reloads the
// list below after a skip in the month table.
const refreshKey = ref(0)
const panelKey = ref(0)
const venues = ref([])
const categories = ref([])

const loadList = async (url, target) => {
  try {
    const response = await fetch(url, { credentials: 'include' })
    if (response.ok) target.value = await response.json()
  } catch (error) {
    console.error(`Error loading ${url}:`, error)
  }
}

onMounted(() => {
  loadList('/api/venues', venues)
  loadList('/api/expense-categories', categories)
})
</script>
