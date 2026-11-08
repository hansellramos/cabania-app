<template>
  <div>
    <h2 class="mb-1">Pagos y balance</h2>
    <p class="text-body-secondary mb-4">
      Los gastos que se repiten cada mes o cada semana: lo vencido y lo próximo a vencer sale primero.
    </p>
    <RecurringMonthSummary :venue-id="venueId" :refresh-key="refreshKey" />
    <CCard class="mb-4">
      <CCardBody>
        <RecurringExpensesPanel
          v-model:venue-id="venueId"
          :venues="venues"
          :categories="categories"
          @loaded="refreshKey++"
        />
      </CCardBody>
    </CCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { CCard, CCardBody } from '@coreui/vue'
import RecurringMonthSummary from '@/components/expenses/RecurringMonthSummary.vue'
import RecurringExpensesPanel from '@/components/expenses/RecurringExpensesPanel.vue'

const venueId = ref('')
const refreshKey = ref(0)
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
