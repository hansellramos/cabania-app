<template>
  <div class="onboarding-wrapper" :data-theme="resolvedTheme">
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
        <LocationStep
          v-if="currentStep === 2"
          :saved-data="getStepData(2)"
          @completed="onStepCompleted"
          @back="goBack"
        />
        <PropertyInfoStep
          v-if="currentStep === 3"
          :saved-data="getStepData(3)"
          :location-data="locationData"
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
          :suggestions="planSuggestions"
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

    <!-- Floating chat bubble (appears after venue is created) -->
    <ChatBubbleWidget
      v-if="venueId"
      ref="chatRef"
      :venue-id="venueId"
      :venue="venueData"
      :suggestions="chatSuggestions"
      skip-contact-form
      @panel-toggled="onChatToggled"
    />

    <!-- Engagement banner (appears after venue creation) -->
    <Transition name="engage-banner">
      <div v-if="showEngageBanner" class="engage-banner" @click="openChatFromBanner">
        <div class="engage-pulse"></div>
        <div class="engage-content">
          <strong>Tu IA ya sabe de tu propiedad</strong>
          <span>Toca para verla en acci&oacute;n</span>
        </div>
        <button class="engage-close" @click.stop="showEngageBanner = false">&times;</button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ChatBubbleWidget from '@/components/chat/ChatBubbleWidget.vue'
import CreateAccountStep from './steps/CreateAccountStep.vue'
import LocationStep from './steps/LocationStep.vue'
import PropertyInfoStep from './steps/PropertyInfoStep.vue'
import AmenitiesStep from './steps/AmenitiesStep.vue'
import CreatePlanStep from './steps/CreatePlanStep.vue'
import AvailabilityStep from './steps/AvailabilityStep.vue'
import TourStep from './steps/TourStep.vue'

const route = useRoute()
const router = useRouter()

// Watch data-coreui-theme on <html> (set by ThemeToggle via useColorModes)
const resolvedTheme = ref(document.documentElement.getAttribute('data-coreui-theme') || 'light')
let themeObserver
onMounted(() => {
  themeObserver = new MutationObserver(() => {
    resolvedTheme.value = document.documentElement.getAttribute('data-coreui-theme') || 'light'
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-coreui-theme'] })
})
onUnmounted(() => {
  themeObserver?.disconnect()
})

const token = computed(() => route.query.token || '')
const currentStep = ref(1)
const progressData = ref({})
const invitationData = ref(null)
const tokenError = ref('')
const initialLoading = ref(true)
const venueId = ref(null)
const venueData = ref(null)
const chatRef = ref(null)
const showEngageBanner = ref(false)
const locationData = ref(null)
const planSuggestions = ref(null)

const stepLabels = ['Cuenta', 'Ubicacion', 'Propiedad', 'Amenidades', 'Plan', 'Disponibilidad', 'Tour']

const chatSuggestions = [
  '¿Dónde queda la cabaña?',
  '¿Cuántas personas caben?',
  '¿Tienen piscina?',
  '¿Cuánto cuesta por noche?',
]

function getStepData(step) {
  return progressData.value[`step${step}`] || null
}

async function onStepCompleted(data) {
  const step = currentStep.value

  // Step 2 (Location): save location data and fetch suggestions in background
  if (step === 2 && data?.location) {
    locationData.value = data.location
    // Fetch plan suggestions non-blocking
    fetchPlanSuggestions(data.location.city, data.location.department)
  }

  // Step 3 (Property): save venue info
  if (data?.venueId) {
    venueId.value = data.venueId
    venueData.value = { name: data.form?.name || 'tu propiedad' }
  }

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

  // After venue creation (step 3), show engagement banner
  if (step === 3 && venueId.value) {
    setTimeout(() => {
      showEngageBanner.value = true
    }, 800)
  }
}

async function fetchPlanSuggestions(city, department) {
  try {
    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (department) params.set('department', department)
    const res = await fetch(`/api/onboarding/suggestions?${params}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      planSuggestions.value = data.suggestions || null
    }
  } catch (e) {
    console.error('Error fetching suggestions:', e)
  }
}

function openChatFromBanner() {
  showEngageBanner.value = false
  chatRef.value?.open()
}

function onChatToggled(open) {
  if (open) showEngageBanner.value = false
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
      // Recover location data from step 2
      if (progressData.value.step2?.location) {
        locationData.value = progressData.value.step2.location
        // Re-fetch suggestions if we have location
        fetchPlanSuggestions(locationData.value.city, locationData.value.department)
      }
      // Recover venueId and venue name from step 3 (or step 2 for old progress data)
      const venueStep = progressData.value.step3?.venueId
        ? progressData.value.step3
        : progressData.value.step2?.venueId
          ? progressData.value.step2
          : null
      if (venueStep) {
        venueId.value = venueStep.venueId
        venueData.value = { name: venueStep.form?.name || 'tu propiedad' }
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
/* ── Light theme (default) ── */
.onboarding-wrapper {
  --ob-bg: #f1f5f9;
  --ob-text: #0f172a;
  --ob-text-secondary: #64748b;
  --ob-text-muted: #94a3b8;
  --ob-orb-emerald: rgba(16, 185, 129, 0.15);
  --ob-orb-sky: rgba(14, 165, 233, 0.15);
  --ob-orb-bottom: rgba(16, 185, 129, 0.08);
  --ob-orb-blur: 120px;
  --ob-step-bg: rgba(0, 0, 0, 0.05);
  --ob-step-border: rgba(0, 0, 0, 0.08);
  --ob-step-text: #475569;
  --ob-engage-strong: #0f172a;
  --ob-engage-span: #64748b;
  --ob-engage-close: #94a3b8;
  --ob-engage-close-hover: #0f172a;

  min-height: 100vh;
  background-color: var(--ob-bg);
  color: var(--ob-text);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  position: relative;
  overflow: hidden;
}

/* ── Dark theme ── */
.onboarding-wrapper[data-theme="dark"] {
  --ob-bg: #020617;
  --ob-text: #f1f5f9;
  --ob-text-secondary: #94a3b8;
  --ob-text-muted: #64748b;
  --ob-orb-emerald: rgba(16, 185, 129, 0.2);
  --ob-orb-sky: rgba(14, 165, 233, 0.2);
  --ob-orb-bottom: rgba(16, 185, 129, 0.1);
  --ob-orb-blur: 96px;
  --ob-step-bg: rgba(255, 255, 255, 0.06);
  --ob-step-border: rgba(255, 255, 255, 0.08);
  --ob-step-text: #64748b;
  --ob-engage-strong: #f1f5f9;
  --ob-engage-span: #94a3b8;
  --ob-engage-close: #64748b;
  --ob-engage-close-hover: #f1f5f9;
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
  filter: blur(var(--ob-orb-blur));
}

.onboarding-orb--emerald {
  top: -10rem;
  left: -10%;
  width: 520px;
  height: 520px;
  background: var(--ob-orb-emerald);
}

.onboarding-orb--sky {
  top: -10rem;
  right: -10%;
  width: 520px;
  height: 520px;
  background: var(--ob-orb-sky);
}

.onboarding-orb--emerald-bottom {
  bottom: -14rem;
  left: 25%;
  width: 620px;
  height: 620px;
  background: var(--ob-orb-bottom);
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
  color: var(--ob-text);
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0;
}

.onboarding-subtitle {
  color: var(--ob-text-secondary);
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
  background: var(--ob-step-bg);
  color: var(--ob-step-text);
  border: 1px solid var(--ob-step-border);
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
  color: var(--ob-step-text);
  text-align: center;
}

.step-dot.active .step-label {
  color: var(--ob-text);
}

.step-dot.completed .step-label {
  color: #10b981;
}

/* Engagement banner */
.engage-banner {
  position: fixed;
  bottom: 5.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(14, 165, 233, 0.15));
  border: 1px solid rgba(16, 185, 129, 0.3);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 14px;
  cursor: pointer;
  z-index: 10002;
  box-shadow: 0 8px 32px rgba(16, 185, 129, 0.2);
  max-width: 300px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.engage-banner:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(16, 185, 129, 0.3);
}

.engage-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
  animation: engagePulse 2s ease-in-out infinite;
}

@keyframes engagePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
}

.engage-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.engage-content strong {
  color: var(--ob-engage-strong);
  font-size: 0.85rem;
  line-height: 1.3;
}

.engage-content span {
  color: var(--ob-engage-span);
  font-size: 0.75rem;
}

.engage-close {
  background: none;
  border: none;
  color: var(--ob-engage-close);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 4px;
  transition: color 0.2s;
}

.engage-close:hover {
  color: var(--ob-engage-close-hover);
}

/* Engage banner transition */
.engage-banner-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.engage-banner-leave-active {
  transition: all 0.25s ease-in;
}

.engage-banner-enter-from {
  opacity: 0;
  transform: translateY(1rem) scale(0.9);
}

.engage-banner-leave-to {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.95);
}

@media (max-width: 640px) {
  .engage-banner {
    bottom: 4.5rem;
    right: 0.75rem;
    left: 0.75rem;
    max-width: none;
  }
}
</style>

<!-- Unscoped: override step card styles based on theme -->
<style>
/* Light theme cards */
.onboarding-wrapper .onboarding-card {
  background: rgba(255, 255, 255, 0.65) !important;
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(24px) !important;
  -webkit-backdrop-filter: blur(24px) !important;
  border-radius: 1.5rem !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08) !important;
}

.onboarding-wrapper .onboarding-card .card-title {
  color: #0f172a !important;
}

.onboarding-wrapper .onboarding-card .text-body-secondary {
  color: #64748b !important;
}

/* Dark theme cards */
.onboarding-wrapper[data-theme="dark"] .onboarding-card {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4) !important;
}

.onboarding-wrapper[data-theme="dark"] .onboarding-card .card-title {
  color: #f1f5f9 !important;
}

.onboarding-wrapper[data-theme="dark"] .onboarding-card .text-body-secondary {
  color: #94a3b8 !important;
}

/* Light theme form controls */
.onboarding-wrapper .form-label,
.onboarding-wrapper .onboarding-card label {
  color: #334155 !important;
}

.onboarding-wrapper .form-control,
.onboarding-wrapper .form-select {
  background: rgba(255, 255, 255, 0.6) !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
  color: #0f172a !important;
}

/* Dark theme form controls */
.onboarding-wrapper[data-theme="dark"] .form-label,
.onboarding-wrapper[data-theme="dark"] .onboarding-card label {
  color: #cbd5e1 !important;
}

.onboarding-wrapper[data-theme="dark"] .form-control,
.onboarding-wrapper[data-theme="dark"] .form-select {
  background: rgba(2, 6, 23, 0.4) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #f1f5f9 !important;
}

/* Light theme: ThemeToggle overrides */
.onboarding-wrapper .theme-toggle {
  background: rgba(0, 0, 0, 0.05) !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
  color: #64748b !important;
}
.onboarding-wrapper .theme-toggle:hover {
  background: rgba(0, 0, 0, 0.1) !important;
  color: #0f172a !important;
}

/* Dark theme: ThemeToggle keeps its own defaults */
.onboarding-wrapper[data-theme="dark"] .theme-toggle {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #94a3b8 !important;
}
.onboarding-wrapper[data-theme="dark"] .theme-toggle:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #f1f5f9 !important;
}

/* Light theme: logo uses normal versions */
.onboarding-wrapper .onboarding-logo-icon {
  content: url('/logo.svg');
}
.onboarding-wrapper .onboarding-logo-wordmark {
  filter: none;
}

/* Dark theme: logo uses inverted versions */
.onboarding-wrapper[data-theme="dark"] .onboarding-logo-icon {
  content: url('/logo-inverted.svg');
}

/* Light: step card secondary elements */
.onboarding-wrapper .tour-feature strong,
.onboarding-wrapper .feature-icon {
  color: #0f172a !important;
}
.onboarding-wrapper[data-theme="dark"] .tour-feature strong,
.onboarding-wrapper[data-theme="dark"] .feature-icon {
  color: #f1f5f9 !important;
}

/* Light: photo-add dashed border */
.onboarding-wrapper .photo-add {
  border-color: rgba(0, 0, 0, 0.15) !important;
  color: #94a3b8 !important;
}
.onboarding-wrapper[data-theme="dark"] .photo-add {
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #64748b !important;
}

/* Light: photo-item border */
.onboarding-wrapper .photo-item {
  border-color: rgba(0, 0, 0, 0.1) !important;
}
.onboarding-wrapper[data-theme="dark"] .photo-item {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* Light: tour feature cards */
.onboarding-wrapper .tour-feature {
  background: rgba(0, 0, 0, 0.03) !important;
  border-color: rgba(0, 0, 0, 0.06) !important;
}
.onboarding-wrapper[data-theme="dark"] .tour-feature {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
}

/* AI Field Suggestions - light */
.onboarding-wrapper .ai-suggestions {
  background: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(16, 185, 129, 0.2) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
}

.onboarding-wrapper .ai-chip {
  background: rgba(16, 185, 129, 0.08) !important;
  border-color: rgba(16, 185, 129, 0.2) !important;
  color: #059669 !important;
}

/* AI Field Suggestions - dark */
.onboarding-wrapper[data-theme="dark"] .ai-suggestions {
  background: rgba(2, 6, 23, 0.9) !important;
  border-color: rgba(16, 185, 129, 0.25) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
}

.onboarding-wrapper[data-theme="dark"] .ai-suggestions-header {
  color: #34d399 !important;
}

.onboarding-wrapper[data-theme="dark"] .ai-chip {
  background: rgba(16, 185, 129, 0.15) !important;
  border-color: rgba(16, 185, 129, 0.3) !important;
  color: #34d399 !important;
}

/* Location step - map border */
.onboarding-wrapper .map-wrapper {
  border-color: rgba(0, 0, 0, 0.1) !important;
}
.onboarding-wrapper[data-theme="dark"] .map-wrapper {
  border-color: rgba(255, 255, 255, 0.15) !important;
}

/* Location step - zone chips */
.onboarding-wrapper .zone-chip {
  background: rgba(16, 185, 129, 0.08) !important;
  border-color: rgba(16, 185, 129, 0.2) !important;
  color: #059669 !important;
}
.onboarding-wrapper[data-theme="dark"] .zone-chip {
  background: rgba(16, 185, 129, 0.15) !important;
  border-color: rgba(16, 185, 129, 0.3) !important;
  color: #34d399 !important;
}

/* GPS button light theme */
.onboarding-wrapper .gps-btn {
  background: linear-gradient(135deg, #10b981, #059669) !important;
  color: #fff !important;
}

/* Location summary */
.onboarding-wrapper .location-summary {
  background: rgba(16, 185, 129, 0.06) !important;
  border-color: rgba(16, 185, 129, 0.15) !important;
}
.onboarding-wrapper .location-summary strong {
  color: #0f172a !important;
}
.onboarding-wrapper .location-summary span {
  color: #64748b !important;
}
.onboarding-wrapper[data-theme="dark"] .location-summary {
  background: rgba(16, 185, 129, 0.1) !important;
  border-color: rgba(16, 185, 129, 0.25) !important;
}
.onboarding-wrapper[data-theme="dark"] .location-summary strong {
  color: #f1f5f9 !important;
}
.onboarding-wrapper[data-theme="dark"] .location-summary span {
  color: #94a3b8 !important;
}

/* Details accordion - light */
.onboarding-wrapper .details-accordion .accordion-item {
  background: transparent !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
}
.onboarding-wrapper .details-accordion .accordion-button {
  background: rgba(0, 0, 0, 0.03) !important;
  color: #475569 !important;
  font-size: 0.85rem;
  padding: 8px 14px;
  box-shadow: none !important;
}
.onboarding-wrapper .details-accordion .accordion-button::after {
  filter: none;
}
.onboarding-wrapper .details-accordion .accordion-body {
  background: transparent !important;
  padding: 12px 14px;
}

/* Details accordion - dark */
.onboarding-wrapper[data-theme="dark"] .details-accordion .accordion-item {
  border-color: rgba(255, 255, 255, 0.1) !important;
}
.onboarding-wrapper[data-theme="dark"] .details-accordion .accordion-button {
  background: rgba(255, 255, 255, 0.04) !important;
  color: #94a3b8 !important;
}
.onboarding-wrapper[data-theme="dark"] .details-accordion .accordion-button::after {
  filter: invert(1) brightness(0.7);
}
</style>
