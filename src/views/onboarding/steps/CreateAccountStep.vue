<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Crear tu cuenta</h4>
      <p class="text-body-secondary mb-4">Ingresa tus datos para comenzar</p>

      <CForm @submit.prevent="createAccount">
        <div class="mb-3">
          <CFormLabel>Nombre completo *</CFormLabel>
          <CFormInput
            v-model="form.display_name"
            placeholder="Tu nombre"
            required
          />
        </div>

        <div class="mb-3">
          <CFormLabel>Correo electrónico *</CFormLabel>
          <CFormInput
            v-model="form.email"
            type="email"
            placeholder="tu@correo.com"
            required
            :disabled="!!invitationData?.email"
          />
        </div>

        <div class="mb-3">
          <CFormLabel>Contraseña *</CFormLabel>
          <CFormInput
            v-model="form.password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            required
            minlength="6"
          />
        </div>

        <div class="mb-3">
          <CFormLabel>Confirmar contraseña *</CFormLabel>
          <CFormInput
            v-model="form.confirmPassword"
            type="password"
            placeholder="Repite la contraseña"
            required
          />
        </div>

        <CAlert v-if="error" color="danger" class="mb-3">{{ error }}</CAlert>

        <CButton type="submit" color="primary" class="w-100 onboarding-btn" :disabled="submitting">
          <CSpinner v-if="submitting" size="sm" class="me-2" />
          Crear cuenta y continuar
        </CButton>
      </CForm>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  token: { type: String, required: true },
  invitationData: { type: Object, default: null },
})

const emit = defineEmits(['completed'])

const form = ref({
  display_name: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const error = ref('')
const submitting = ref(false)

onMounted(() => {
  if (props.invitationData?.email) {
    form.value.email = props.invitationData.email
  }
})

async function createAccount() {
  error.value = ''

  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  submitting.value = true
  try {
    const response = await fetch(`/api/invitations/${props.token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        display_name: form.value.display_name,
        email: form.value.email,
        password: form.value.password,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      error.value = data.error || 'Error creando cuenta'
      return
    }
    emit('completed', { userId: data.user.id, email: data.user.email })
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
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

.card-title {
  color: #f1f5f9;
}

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 12px;
  font-weight: 600;
  border-radius: 10px;
}

.onboarding-btn:hover {
  opacity: 0.9;
}
</style>
