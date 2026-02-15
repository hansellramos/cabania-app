<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4 text-center">
      <div class="tour-icon mb-3">&#127881;</div>
      <h4 class="card-title mb-2">¡Todo listo!</h4>
      <p class="text-body-secondary mb-4">
        Tu propiedad está configurada. Aquí un resumen de lo que puedes hacer:
      </p>

      <div class="tour-features">
        <div class="tour-feature">
          <div class="feature-icon">&#128197;</div>
          <div>
            <strong>Calendario de disponibilidad</strong>
            <p class="small text-body-secondary mb-0">
              Gestiona tus fechas disponibles y bloqueadas
            </p>
          </div>
        </div>

        <div class="tour-feature">
          <div class="feature-icon">&#127968;</div>
          <div>
            <strong>Hospedajes y reservas</strong>
            <p class="small text-body-secondary mb-0">
              Registra y administra tus reservas de forma centralizada
            </p>
          </div>
        </div>

        <div class="tour-feature">
          <div class="feature-icon">&#128176;</div>
          <div>
            <strong>Ingresos y análisis</strong>
            <p class="small text-body-secondary mb-0">
              Visualiza tus ingresos, egresos y utilidad en tiempo real
            </p>
          </div>
        </div>

        <div class="tour-feature">
          <div class="feature-icon">&#129302;</div>
          <div>
            <strong>Próximamente: IA</strong>
            <p class="small text-body-secondary mb-0">
              CabanIA responderá mensajes de WhatsApp, Instagram y Facebook por ti
            </p>
          </div>
        </div>
      </div>

      <CButton color="primary" class="onboarding-btn mt-4" size="lg" @click="$emit('completed')">
        Ir al Dashboard
      </CButton>
    </CCardBody>
  </CCard>
</template>

<script setup>
defineEmits(['completed'])
</script>

<style scoped>
.onboarding-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border-radius: 16px;
}

.card-title { color: #f1f5f9; }

.tour-icon {
  font-size: 48px;
}

.tour-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
}

.tour-feature {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tour-feature strong {
  color: #f1f5f9;
}

.feature-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 14px 40px;
  font-weight: 600;
  border-radius: 12px;
}

.onboarding-btn:hover {
  opacity: 0.9;
}
</style>
