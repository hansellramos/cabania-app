<template>
  <div class="wizard-stepper">
    <div
      v-for="s in totalSteps"
      :key="s"
      class="wizard-step"
      :class="{
        active: s === currentStep,
        completed: s < currentStep,
        clickable: allowNavigation && s < currentStep,
      }"
      @click="onStepClick(s)"
    >
      <span class="wizard-step-number">{{ s }}</span>
      <span class="wizard-step-label">{{ labels[s - 1] || `Paso ${s}` }}</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  currentStep: { type: Number, required: true },
  totalSteps: { type: Number, required: true },
  labels: { type: Array, default: () => [] },
  allowNavigation: { type: Boolean, default: false },
})

const emit = defineEmits(['go-to-step'])

function onStepClick(step) {
  if (props.allowNavigation && step < props.currentStep) {
    emit('go-to-step', step)
  }
}
</script>

<style scoped>
.wizard-stepper {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.wizard-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  max-width: 80px;
}

.wizard-step.clickable {
  cursor: pointer;
}

.wizard-step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--wizard-step-bg, rgba(0, 0, 0, 0.05));
  color: var(--wizard-step-text, #475569);
  border: 1px solid var(--wizard-step-border, rgba(0, 0, 0, 0.08));
  transition: all 0.3s;
}

.wizard-step.active .wizard-step-number {
  background: var(--wizard-active-bg, linear-gradient(135deg, #10b981, #0ea5e9));
  color: #fff;
  border-color: transparent;
}

.wizard-step.completed .wizard-step-number {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.wizard-step-label {
  font-size: 0.65rem;
  color: var(--wizard-step-text, #475569);
  text-align: center;
}

.wizard-step.active .wizard-step-label {
  color: var(--wizard-active-text, #0f172a);
}

.wizard-step.completed .wizard-step-label {
  color: #10b981;
}
</style>
