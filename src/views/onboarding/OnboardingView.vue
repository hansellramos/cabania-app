<template>
  <div class="onboarding-wrapper">
    <ThemeToggle />

    <!-- Background glow orbs -->
    <div class="onboarding-glow" aria-hidden="true">
      <div class="onboarding-orb onboarding-orb--emerald"></div>
      <div class="onboarding-orb onboarding-orb--sky"></div>
      <div class="onboarding-orb onboarding-orb--emerald-bottom"></div>
    </div>

    <div class="onboarding-container">
      <!-- Logo -->
      <div class="text-center mb-4">
        <div class="onboarding-logo">
          <img src="/logo-inverted.svg" alt="CabanIA" class="onboarding-logo-icon" />
          <img src="/logo-wordmark.svg" alt="CabanIA" class="onboarding-logo-wordmark" />
        </div>
        <h2 class="onboarding-title">Bienvenido a CabanIA</h2>
        <p class="onboarding-subtitle" v-if="currentStep <= 6">Configura tu propiedad paso a paso</p>
      </div>

      <!-- Progress Bar -->
      <div class="step-progress mb-4" v-if="currentStep <= 7">
        <div
          v-for="s in 7"
          :key="s"
          class="step-dot"
          :class="{
            active: s === currentStep,
            completed: s < currentStep,
          }"
        >
          <span class="step-number">{{ s }}</span>
          <span class="step-label">{{ stepLabels[s - 1] }}</span>
        </div>
      </div>

      <!-- Error state -->
      <CAlert v-if="tokenError" color="danger" class="text-center">
        {{ tokenError }}
        <div class="mt-3">
          <CButton color="light" @click="goToLogin">Ir al login</CButton>
        </div>
      </CAlert>

      <!-- Loading -->
      <div v-else-if="initialLoading" class="text-center py-5">
        <CSpinner color="primary" />
        <p class="mt-3 text-body-secondary">Validando invitación...</p>
      </div>

      <!-- Steps -->
      <template v-else>
        <CreateAccountStep
          v-if="currentStep === 1"
          :token="token"
          :invitation-data="invitationData"
          @completed="onStepCompleted"
        />
        <PropertyInfoStep
          v-if="currentStep === 2"
          :saved-data="getStepData(2)"
          @completed="onStepCompleted"
          @back="goBack"
        />
        <ChatPreviewStep
          v-if="currentStep === 3"
          :venue-id="venueId"
          @completed="onStepCompleted"
          @back="goBack"
        />
        <AmenitiesStep
          v-if="currentStep === 4"
          :venue-id="venueId"
          :saved-data="getStepData(4)"
          @completed="onStepCompleted"
          @back="goBack"
        />
        <CreatePlanStep
          v-if="currentStep === 5"
          :venue-id="venueId"
          :saved-data="getStepData(5)"
          @completed="onStepCompleted"
          @back="goBack"
        />
        <AvailabilityStep
          v-if="currentStep === 6"
          :venue-id="venueId"
          @completed="onStepCompleted"
          @back="goBack"
        />
        <TourStep
          v-if="currentStep === 7"
          @completed="finishOnboarding"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import CreateAccountStep from './steps/CreateAccountStep.vue'
import PropertyInfoStep from './steps/PropertyInfoStep.vue'
import AmenitiesStep from './steps/AmenitiesStep.vue'
import CreatePlanStep from './steps/CreatePlanStep.vue'
import ChatPreviewStep from './steps/ChatPreviewStep.vue'
import AvailabilityStep from './steps/AvailabilityStep.vue'
import TourStep from './steps/TourStep.vue'

const route = useRoute()
const router = useRouter()

const token = computed(() => route.query.token || '')
const currentStep = ref(1)
const progressData = ref({})
const invitationData = ref(null)
const tokenError = ref('')
const initialLoading = ref(true)
const venueId = ref(null)

const stepLabels = ['Cuenta', 'Propiedad', 'Prueba IA', 'Amenidades', 'Plan', 'Disponibilidad', 'Tour']

function getStepData(step) {
  return progressData.value[`step${step}`] || null
}

async function onStepCompleted(data) {
  // Save step data to progress
  if (data?.venueId) venueId.value = data.venueId

  const step = currentStep.value
  progressData.value[`step${step}`] = data

  // Save progress to backend
  try {
    await fetch('/api/onboarding/step', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ step, data }),
    })
  } catch (e) {
    console.error('Error saving progress:', e)
  }

  currentStep.value = step + 1
}

function goBack() {
  if (currentStep.value > 2) {
    currentStep.value--
  }
}

async function finishOnboarding() {
  try {
    await fetch('/api/onboarding/complete', {
      method: 'POST',
      credentials: 'include',
    })
  } catch (e) {
    console.error('Error completing onboarding:', e)
  }
  router.push('/dashboard')
}

function goToLogin() {
  router.push('/pages/login')
}

onMounted(async () => {
  // If user has a token, validate it
  if (token.value) {
    try {
      const response = await fetch(`/api/invitations/validate/${token.value}`)
      const data = await response.json()
      if (!response.ok || !data.valid) {
        tokenError.value = data.error || 'Token inválido'
        initialLoading.value = false
        return
      }
      invitationData.value = data
      currentStep.value = 1
      initialLoading.value = false
    } catch (e) {
      tokenError.value = 'Error validando invitación'
      initialLoading.value = false
    }
    return
  }

  // No token — check if user is authenticated and has onboarding progress
  try {
    const response = await fetch('/api/onboarding/progress', { credentials: 'include' })
    if (response.ok) {
      const progress = await response.json()
      progressData.value = progress.data || {}
      currentStep.value = progress.current_step || 2
      // Recover venueId from saved data
      if (progressData.value.step2?.venueId) {
        venueId.value = progressData.value.step2.venueId
      }
      if (progress.completed_at) {
        router.push('/dashboard')
        return
      }
    } else {
      // Not authenticated and no token
      tokenError.value = 'Necesitas una invitación para registrarte'
    }
  } catch (e) {
    tokenError.value = 'Error cargando progreso'
  }
  initialLoading.value = false
})
</script>

<style scoped>
.onboarding-wrapper {
  min-height: 100vh;
  background-color: #020617;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  position: relative;
  overflow: hidden;
}

.onboarding-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.onboarding-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(96px);
}

.onboarding-orb--emerald {
  top: -10rem;
  left: -10%;
  width: 520px;
  height: 520px;
  background: rgba(16, 185, 129, 0.2);
}

.onboarding-orb--sky {
  top: -10rem;
  right: -10%;
  width: 520px;
  height: 520px;
  background: rgba(14, 165, 233, 0.2);
}

.onboarding-orb--emerald-bottom {
  bottom: -14rem;
  left: 25%;
  width: 620px;
  height: 620px;
  background: rgba(16, 185, 129, 0.1);
}

.onboarding-container {
  width: 100%;
  max-width: 640px;
  position: relative;
  z-index: 10;
}

.onboarding-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 12px;
}

.onboarding-logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  object-fit: contain;
}

.onboarding-logo-wordmark {
  height: 1.4rem;
  width: auto;
  object-fit: contain;
}

.onboarding-title {
  color: #f1f5f9;
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0;
}

.onboarding-subtitle {
  color: #94a3b8;
  font-size: 0.95rem;
  margin: 4px 0 0;
}

.step-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.step-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  max-width: 80px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  color: #64748b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s;
}

.step-dot.active .step-number {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  border-color: transparent;
}

.step-dot.completed .step-number {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.step-label {
  font-size: 0.65rem;
  color: #475569;
  text-align: center;
}

.step-dot.active .step-label {
  color: #f1f5f9;
}

.step-dot.completed .step-label {
  color: #10b981;
}
</style>
