<template>
  <div class="step-contact">
    <!-- Booking Summary -->
    <div class="booking-summary">
      <div class="summary-row">
        <span class="summary-label">Plan</span>
        <span class="summary-value">{{ summary.planName }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Fecha</span>
        <span class="summary-value">{{ formatDate(summary.checkIn) }}
          <template v-if="summary.checkOut !== summary.checkIn"> &rarr; {{ formatDate(summary.checkOut) }}</template>
        </span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Personas</span>
        <span class="summary-value">{{ summary.adults }} adulto(s){{ summary.children ? `, ${summary.children} niño(s)` : '' }}</span>
      </div>
      <div v-if="summary.estimatedTotal" class="summary-row total">
        <span class="summary-label">Estimado</span>
        <span class="summary-value">{{ formatCurrency(summary.estimatedTotal) }}</span>
      </div>
    </div>

    <!-- Contact Form -->
    <div class="contact-form">
      <div class="field-group">
        <label class="field-label">Tu nombre</label>
        <input
          type="text"
          class="field-input"
          v-model="name"
          placeholder="Nombre completo"
          @input="validate"
        />
      </div>

      <div class="contact-type-toggle">
        <button
          :class="['toggle-btn', { active: contactType === 'whatsapp' }]"
          @click="contactType = 'whatsapp'"
        >
          WhatsApp
        </button>
        <button
          :class="['toggle-btn', { active: contactType === 'instagram' }]"
          @click="contactType = 'instagram'"
        >
          Instagram
        </button>
      </div>

      <div class="field-group">
        <label class="field-label">{{ contactType === 'whatsapp' ? 'Número WhatsApp' : 'Usuario Instagram' }}</label>
        <input
          type="text"
          class="field-input"
          v-model="contactValue"
          :placeholder="contactType === 'whatsapp' ? '+57 300 123 4567' : '@usuario'"
          @input="validate"
        />
      </div>
    </div>

    <p class="contact-hint">Podrás hacer preguntas antes de confirmar tu reserva.</p>

    <button
      class="submit-btn"
      :disabled="!isValid"
      @click="onSubmit"
    >
      Enviar solicitud de reserva
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  summary: { type: Object, required: true },
  initialContact: { type: Object, default: null }
})

const emit = defineEmits(['submit'])

const name = ref(props.initialContact?.name || '')
const contactType = ref(props.initialContact?.contactType || 'whatsapp')
const contactValue = ref(props.initialContact?.contactValue || '')
const isValid = ref(false)

const validate = () => {
  isValid.value = name.value.trim().length >= 2 && contactValue.value.trim().length >= 3
}

// Validate on mount if initial data
if (props.initialContact) validate()

const onSubmit = () => {
  if (!isValid.value) return
  emit('submit', {
    name: name.value.trim(),
    contactType: contactType.value,
    contactValue: contactValue.value.trim()
  })
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.step-contact {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.booking-summary {
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.5));
  border: 1px solid var(--cabania-border, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.2rem 0;
}

.summary-row.total {
  border-top: 1px solid var(--cabania-border, rgba(0, 0, 0, 0.06));
  margin-top: 0.25rem;
  padding-top: 0.4rem;
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cabania-text-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.summary-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cabania-text, #0f172a);
}

.summary-row.total .summary-value {
  font-weight: 800;
  color: #10b981;
  font-size: 0.95rem;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-group {
  display: flex;
  flex-direction: column;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cabania-text-muted, #64748b);
  margin-bottom: 0.2rem;
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

.contact-type-toggle {
  display: flex;
  gap: 0.35rem;
  background: var(--cabania-card-bg, rgba(0, 0, 0, 0.03));
  border-radius: 10px;
  padding: 0.2rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.4rem;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--cabania-text-muted, #64748b);
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.9));
  color: #10b981;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.contact-hint {
  font-size: 0.8rem;
  color: var(--cabania-text-muted, #94a3b8);
  text-align: center;
  margin: 0;
}

.submit-btn {
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

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
