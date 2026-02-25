<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Disponibilidad</h4>
      <p class="text-body-secondary mb-4">
        ¿Tienes fechas ya reservadas o bloqueadas? Puedes configurarlas después desde el calendario.
      </p>

      <div class="availability-options">
        <label
          class="avail-option"
          :class="{ selected: option === 'all_available' }"
        >
          <input type="radio" v-model="option" value="all_available" hidden />
          <div class="avail-icon">&#128197;</div>
          <div>
            <strong>Todo disponible</strong>
            <p class="text-body-secondary small mb-0">
              No tengo reservas previas, todas las fechas están disponibles
            </p>
          </div>
        </label>

        <label
          class="avail-option"
          :class="{ selected: option === 'configure_later' }"
        >
          <input type="radio" v-model="option" value="configure_later" hidden />
          <div class="avail-icon">&#9200;</div>
          <div>
            <strong>Configurar después</strong>
            <p class="text-body-secondary small mb-0">
              Prefiero bloquear fechas más adelante desde el calendario
            </p>
          </div>
        </label>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <CButton color="secondary" variant="ghost" @click="$emit('back')">
          Anterior
        </CButton>
        <CButton color="primary" class="onboarding-btn" @click="next">
          Siguiente
        </CButton>
      </div>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  venueId: { type: String, required: true },
})

const emit = defineEmits(['completed', 'back'])

const option = ref('all_available')

function next() {
  emit('completed', { availability: option.value })
}
</script>

<style scoped>
.onboarding-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

.card-title { color: #f1f5f9; }

.availability-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.avail-option {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s;
}

.avail-option:hover {
  border-color: rgba(16, 185, 129, 0.2);
}

.avail-option.selected {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.4);
}

.avail-option strong {
  color: #f1f5f9;
}

.avail-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  border-radius: 10px;
}
</style>
