<template>
  <div class="step-result">
    <!-- Loading -->
    <div v-if="loading" class="result-loading">
      <div class="loading-spinner"></div>
      <p>Consultando disponibilidad...</p>
    </div>

    <!-- Available -->
    <div v-else-if="result?.is_available" class="result-card available">
      <div class="result-icon">&#10003;</div>
      <h4 class="result-title">Disponible</h4>
      <p class="result-dates">
        {{ formatDate(result.check_in) }}
        <template v-if="result.check_out !== result.check_in">
          &rarr; {{ formatDate(result.check_out) }}
        </template>
      </p>
      <div v-if="result.suitable_plans?.length" class="result-plans">
        <div v-for="sp in result.suitable_plans" :key="sp.id" class="result-plan-row">
          <span class="result-plan-name">{{ sp.name }}</span>
          <span class="result-plan-total">{{ formatCurrency(sp.estimated_total) }}</span>
        </div>
      </div>
      <p v-else class="result-no-plans">
        No hay planes disponibles para {{ result.total_guests }} persona(s).
      </p>
      <button class="continue-btn" @click="$emit('continue')">Continuar</button>
    </div>

    <!-- Not available -->
    <div v-else-if="result" class="result-card unavailable">
      <div class="result-icon unavailable-icon">&#10007;</div>
      <h4 class="result-title">No disponible</h4>
      <p class="result-dates">
        {{ formatDate(result.check_in) }}
        <template v-if="result.check_out !== result.check_in">
          &rarr; {{ formatDate(result.check_out) }}
        </template>
      </p>
      <div v-if="result.next_available_dates?.length" class="alt-dates">
        <p class="alt-dates-label">Fechas cercanas disponibles:</p>
        <div class="alt-date-chips">
          <button
            v-for="d in result.next_available_dates"
            :key="d.date"
            class="alt-date-chip"
            @click="$emit('pick-alt-date', d.date)"
          >
            {{ formatShortDate(d.date) }}
            <small>{{ d.day_of_week }}</small>
          </button>
        </div>
      </div>
      <button class="retry-btn" @click="$emit('back')">Cambiar fechas</button>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="result-card error-card">
      <p class="error-text">{{ errorMsg }}</p>
      <button class="retry-btn" @click="$emit('back')">Intentar de nuevo</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: { type: Boolean, default: false },
  result: { type: Object, default: null },
  errorMsg: { type: String, default: '' }
})

defineEmits(['continue', 'back', 'pick-alt-date'])

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

const formatShortDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.step-result {
  padding: 0.75rem;
}

.result-loading {
  text-align: center;
  padding: 2rem 0;
  color: var(--cabania-text-muted, #64748b);
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-card {
  border-radius: 14px;
  padding: 1rem;
  text-align: center;
}

.result-card.available {
  background: rgba(16, 185, 129, 0.06);
  border: 1.5px solid rgba(16, 185, 129, 0.2);
}

.result-card.unavailable {
  background: rgba(245, 158, 11, 0.06);
  border: 1.5px solid rgba(245, 158, 11, 0.2);
}

.result-card.error-card {
  background: rgba(239, 68, 68, 0.06);
  border: 1.5px solid rgba(239, 68, 68, 0.2);
}

.result-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.result-icon.unavailable-icon {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}

.result-title {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--cabania-text, #0f172a);
}

.result-dates {
  font-size: 0.9rem;
  color: var(--cabania-text-muted, #64748b);
  margin: 0 0 0.75rem;
}

.result-plans {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.result-plan-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  border-radius: 8px;
}

.result-plan-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--cabania-text, #0f172a);
}

.result-plan-total {
  font-weight: 800;
  font-size: 0.95rem;
  color: #10b981;
}

.result-no-plans {
  font-size: 0.85rem;
  color: var(--cabania-text-muted, #64748b);
  margin: 0 0 0.75rem;
}

.alt-dates {
  margin: 0.75rem 0;
}

.alt-dates-label {
  font-size: 0.8rem;
  color: var(--cabania-text-muted, #64748b);
  margin: 0 0 0.4rem;
}

.alt-date-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: center;
}

.alt-date-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.35rem 0.65rem;
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.75));
  border: 1.5px solid var(--cabania-border, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cabania-text, #0f172a);
  transition: border-color 0.2s, transform 0.15s;
}

.alt-date-chip small {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--cabania-text-muted, #94a3b8);
  text-transform: capitalize;
}

.alt-date-chip:hover {
  border-color: #10b981;
  transform: translateY(-1px);
}

.continue-btn {
  width: 100%;
  padding: 0.65rem;
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
}

.continue-btn:hover {
  transform: translateY(-1px);
}

.retry-btn {
  width: 100%;
  padding: 0.55rem;
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  border: 1.5px solid var(--cabania-border, rgba(0, 0, 0, 0.12));
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--cabania-text, #0f172a);
  cursor: pointer;
  transition: border-color 0.2s;
}

.retry-btn:hover {
  border-color: #10b981;
}

.error-text {
  color: #dc2626;
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}
</style>
