<template>
  <div class="step-date">
    <div class="date-fields">
      <div class="field-group">
        <label class="field-label">Fecha de llegada</label>
        <input
          type="date"
          class="field-input"
          :min="minDate"
          v-model="checkIn"
          @change="emitUpdate"
        />
      </div>
      <div v-if="showCheckOut" class="field-group">
        <label class="field-label">Fecha de salida</label>
        <input
          type="date"
          class="field-input"
          :min="checkIn || minDate"
          v-model="checkOut"
          @change="emitUpdate"
        />
      </div>
    </div>

    <div class="guest-fields">
      <div class="guest-group">
        <label class="field-label">Adultos</label>
        <div class="stepper">
          <button class="stepper-btn" @click="changeAdults(-1)" :disabled="adults <= 1">-</button>
          <span class="stepper-value">{{ adults }}</span>
          <button class="stepper-btn" @click="changeAdults(1)" :disabled="adults >= 50">+</button>
        </div>
      </div>
      <div class="guest-group">
        <label class="field-label">Niños</label>
        <div class="stepper">
          <button class="stepper-btn" @click="changeChildren(-1)" :disabled="children <= 0">-</button>
          <span class="stepper-value">{{ children }}</span>
          <button class="stepper-btn" @click="changeChildren(1)" :disabled="children >= 50">+</button>
        </div>
      </div>
    </div>

    <button
      class="check-btn"
      :disabled="!isValid"
      @click="$emit('check')"
    >
      Consultar disponibilidad
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  plan: { type: Object, default: null },
  initialData: { type: Object, default: null }
})

const emit = defineEmits(['update', 'check'])

const today = new Date()
const minDate = today.toISOString().split('T')[0]

const checkIn = ref(props.initialData?.checkIn || '')
const checkOut = ref(props.initialData?.checkOut || '')
const adults = ref(props.initialData?.adults || 2)
const children = ref(props.initialData?.children || 0)

const showCheckOut = computed(() => props.plan?.includes_overnight)

const isValid = computed(() => {
  if (!checkIn.value) return false
  if (showCheckOut.value && !checkOut.value) return false
  return true
})

const changeAdults = (delta) => {
  adults.value = Math.max(1, Math.min(50, adults.value + delta))
  emitUpdate()
}

const changeChildren = (delta) => {
  children.value = Math.max(0, Math.min(50, children.value + delta))
  emitUpdate()
}

const emitUpdate = () => {
  emit('update', {
    checkIn: checkIn.value,
    checkOut: showCheckOut.value ? checkOut.value : checkIn.value,
    adults: adults.value,
    children: children.value
  })
}
</script>

<style scoped>
.step-date {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.date-fields {
  display: flex;
  gap: 0.5rem;
}

.field-group {
  flex: 1;
}

.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cabania-text-muted, #64748b);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.field-input {
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 1.5px solid var(--cabania-border, rgba(0, 0, 0, 0.12));
  border-radius: 10px;
  font-size: 0.9rem;
  color: var(--cabania-text, #0f172a);
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.guest-fields {
  display: flex;
  gap: 1rem;
}

.guest-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid var(--cabania-border, rgba(0, 0, 0, 0.12));
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  color: var(--cabania-text, #0f172a);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, background 0.2s;
}

.stepper-btn:hover:not(:disabled) {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.08);
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepper-value {
  min-width: 2rem;
  text-align: center;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--cabania-text, #0f172a);
}

.check-btn {
  width: 100%;
  padding: 0.7rem;
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
}

.check-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
}

.check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
