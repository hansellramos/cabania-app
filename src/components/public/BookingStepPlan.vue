<template>
  <div class="step-plan">
    <p class="step-hint">Selecciona un plan para continuar</p>
    <div class="plan-list">
      <button
        v-for="plan in plans"
        :key="plan.id"
        :class="['plan-option', { selected: selected?.id === plan.id }]"
        @click="$emit('select', plan)"
      >
        <div class="plan-option-header">
          <span class="plan-option-name">{{ plan.name }}</span>
          <span class="plan-option-badge">{{ planTypeLabel(plan.plan_type) }}</span>
        </div>
        <div class="plan-option-prices">
          <span v-if="plan.adult_price" class="plan-option-price">
            {{ formatCurrency(plan.adult_price) }} <small>/adulto</small>
          </span>
          <span v-if="plan.child_price" class="plan-option-price child">
            {{ formatCurrency(plan.child_price) }} <small>/niño</small>
          </span>
        </div>
        <div v-if="plan.check_in_time || plan.check_out_time" class="plan-option-schedule">
          <span v-if="plan.check_in_time">Entrada {{ plan.check_in_time }}</span>
          <span v-if="plan.check_in_time && plan.check_out_time"> · </span>
          <span v-if="plan.check_out_time">Salida {{ plan.check_out_time }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  plans: { type: Array, required: true },
  selected: { type: Object, default: null }
})

defineEmits(['select'])

const planTypeLabel = (type) => {
  const labels = { day: 'Pasadía', pasadia: 'Pasadía', overnight: 'Hospedaje', hospedaje: 'Hospedaje', event: 'Evento', evento: 'Evento', camping: 'Camping' }
  return labels[type] || type
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}
</script>

<style scoped>
.step-plan {
  padding: 0.75rem;
}

.step-hint {
  font-size: 0.85rem;
  color: var(--cabania-text-muted, #64748b);
  margin: 0 0 0.75rem;
  text-align: center;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plan-option {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem;
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  border: 2px solid var(--cabania-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

.plan-option:hover {
  border-color: rgba(16, 185, 129, 0.3);
  transform: translateY(-1px);
}

.plan-option.selected {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.plan-option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.plan-option-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--cabania-text, #0f172a);
}

.plan-option-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(14, 165, 233, 0.15);
  color: #0369a1;
  white-space: nowrap;
}

.plan-option-prices {
  display: flex;
  gap: 0.75rem;
}

.plan-option-price {
  font-weight: 800;
  font-size: 0.95rem;
  color: #10b981;
}

.plan-option-price small {
  font-weight: 500;
  font-size: 0.75rem;
  color: var(--cabania-text-muted, #94a3b8);
}

.plan-option-price.child {
  color: #0ea5e9;
}

.plan-option-schedule {
  font-size: 0.8rem;
  color: var(--cabania-text-muted, #64748b);
}

/* Dark mode */
:global([data-theme="dark"]) .plan-option-badge {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.25);
  color: #7dd3fc;
}
</style>
