<template>
  <!-- Overlay backdrop (mobile) -->
  <Transition name="fade">
    <div v-if="isOpen" class="booking-backdrop" @click="close"></div>
  </Transition>

  <!-- Panel -->
  <Transition name="booking-panel">
    <div v-if="isOpen" class="booking-panel">
      <!-- Header -->
      <div class="booking-panel-header">
        <button class="header-back" v-if="step > 0 && step < 4" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="header-title">{{ stepTitle }}</span>
        <button class="header-close" @click="close">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        </button>
      </div>

      <!-- Step dots -->
      <div class="step-dots">
        <span v-for="i in 4" :key="i" :class="['step-dot', { active: step >= i - 1, current: step === i - 1 }]"></span>
      </div>

      <!-- Step content -->
      <div class="booking-panel-body">
        <BookingStepPlan
          v-if="step === 0"
          :plans="plans"
          :selected="selectedPlan"
          @select="onPlanSelect"
        />
        <BookingStepDate
          v-if="step === 1"
          :plan="selectedPlan"
          :initial-data="dateData"
          @update="onDateUpdate"
          @check="onCheckAvailability"
        />
        <BookingStepResult
          v-if="step === 2"
          :loading="checking"
          :result="availResult"
          :error-msg="availError"
          @continue="step = 3"
          @back="step = 1"
          @pick-alt-date="onPickAltDate"
        />
        <BookingStepContact
          v-if="step === 3"
          :summary="bookingSummary"
          :initial-contact="contactData"
          @submit="onContactSubmit"
        />
      </div>

      <!-- Footer -->
      <div class="booking-panel-footer">
        <span class="footer-text">Powered by</span>
        <img src="/logo-inverted.svg" alt="CabanIA" class="footer-logo-icon" />
        <img src="/logo-wordmark.svg" alt="CabanIA" class="footer-logo-wordmark" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import BookingStepPlan from './BookingStepPlan.vue'
import BookingStepDate from './BookingStepDate.vue'
import BookingStepResult from './BookingStepResult.vue'
import BookingStepContact from './BookingStepContact.vue'

const props = defineProps({
  venueId: { type: String, required: true },
  plans: { type: Array, required: true }
})

const emit = defineEmits(['chat-handoff'])

const isOpen = ref(false)
const step = ref(0)

const selectedPlan = ref(null)
const dateData = ref(null)
const availResult = ref(null)
const availError = ref('')
const checking = ref(false)
const contactData = ref(null)

const stepTitle = computed(() => {
  const titles = ['Elige un plan', 'Fecha y personas', 'Disponibilidad', 'Tus datos']
  return titles[step.value] || ''
})

const bookingSummary = computed(() => {
  const plan = selectedPlan.value
  const dates = dateData.value || {}
  const match = availResult.value?.suitable_plans?.find(sp => sp.id === plan?.id)
  return {
    planName: plan?.name || '',
    checkIn: dates.checkIn || '',
    checkOut: dates.checkOut || dates.checkIn || '',
    adults: dates.adults || 1,
    children: dates.children || 0,
    estimatedTotal: match?.estimated_total || null
  }
})

const open = (plan) => {
  isOpen.value = true
  if (plan) {
    selectedPlan.value = plan
    step.value = 1
  } else {
    step.value = 0
  }
}

const close = () => {
  isOpen.value = false
}

const goBack = () => {
  if (step.value > 0) step.value--
}

const onPlanSelect = (plan) => {
  selectedPlan.value = plan
  step.value = 1
}

const onDateUpdate = (data) => {
  dateData.value = data
}

const onCheckAvailability = async () => {
  if (!dateData.value?.checkIn) return
  checking.value = true
  availResult.value = null
  availError.value = ''
  step.value = 2

  try {
    const body = {
      check_in: dateData.value.checkIn,
      check_out: dateData.value.checkOut || dateData.value.checkIn,
      adults: dateData.value.adults,
      children: dateData.value.children,
      plan_id: selectedPlan.value?.id
    }
    const res = await fetch(`/api/public/venues/${props.venueId}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      availError.value = err.error || 'Error al consultar disponibilidad'
      return
    }
    availResult.value = await res.json()
  } catch {
    availError.value = 'Error de conexión. Intenta de nuevo.'
  } finally {
    checking.value = false
  }
}

const onPickAltDate = (dateStr) => {
  dateData.value = { ...dateData.value, checkIn: dateStr, checkOut: dateStr }
  step.value = 1
}

const onContactSubmit = (contact) => {
  contactData.value = contact
  const summary = bookingSummary.value
  emit('chat-handoff', {
    name: contact.name,
    contactType: contact.contactType,
    contactValue: contact.contactValue,
    plan: selectedPlan.value,
    checkIn: summary.checkIn,
    checkOut: summary.checkOut,
    adults: summary.adults,
    children: summary.children,
    estimatedTotal: summary.estimatedTotal
  })
  close()
}

defineExpose({ open, close })
</script>

<style scoped>
.booking-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 10001;
}

.booking-panel {
  position: fixed;
  bottom: 5.5rem;
  right: 1.5rem;
  width: 380px;
  max-width: calc(100vw - 2rem);
  max-height: 75vh;
  background: var(--cabania-surface-bg, rgba(255, 255, 255, 0.92));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--cabania-border, rgba(0, 0, 0, 0.08));
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.1) inset;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10002;
}

/* Header */
.booking-panel-header {
  padding: 0.6rem 0.75rem;
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  border-bottom: 1px solid var(--cabania-border-subtle, rgba(0, 0, 0, 0.05));
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.header-back {
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  color: var(--cabania-text-muted, #64748b);
  display: flex;
  align-items: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.header-back:hover {
  background: var(--cabania-hover-bg, rgba(0, 0, 0, 0.04));
}

.header-title {
  flex: 1;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--cabania-text, #0f172a);
}

.header-close {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--cabania-text-muted, #64748b);
  display: flex;
  align-items: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.header-close:hover {
  background: var(--cabania-hover-bg, rgba(0, 0, 0, 0.04));
}

/* Step dots */
.step-dots {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 0 0.25rem;
  flex-shrink: 0;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cabania-border, rgba(0, 0, 0, 0.12));
  transition: all 0.3s;
}

.step-dot.active {
  background: rgba(16, 185, 129, 0.4);
}

.step-dot.current {
  background: #10b981;
  transform: scale(1.3);
}

/* Body */
.booking-panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Footer */
.booking-panel-footer {
  padding: 0.4rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-top: 1px solid var(--cabania-border-subtle, rgba(0, 0, 0, 0.05));
  flex-shrink: 0;
}

.footer-text {
  font-size: 0.7rem;
  color: var(--cabania-text-muted, #94a3b8);
}

.footer-logo-icon {
  height: 14px;
  width: 14px;
  border-radius: 0.2rem;
  object-fit: contain;
  opacity: 0.6;
}

.footer-logo-wordmark {
  height: 12px;
  width: auto;
  opacity: 0.5;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.booking-panel-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.booking-panel-leave-active {
  transition: all 0.2s ease-in;
}
.booking-panel-enter-from {
  opacity: 0;
  transform: translateY(1rem) scale(0.95);
}
.booking-panel-leave-to {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.98);
}

/* Mobile */
@media (max-width: 640px) {
  .booking-panel {
    bottom: 0;
    right: 0;
    left: 0;
    width: auto;
    max-height: 85vh;
    border-radius: 1.25rem 1.25rem 0 0;
  }
}
</style>
