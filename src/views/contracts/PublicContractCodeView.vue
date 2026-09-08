<template>
  <div class="d-flex align-items-center justify-content-center min-vh-100 bg-light">
    <CCard style="max-width: 400px; width: 100%;" class="mx-3">
      <CCardBody class="text-center p-4">
        <img src="/favicon.ico" alt="CabanIA" style="height: 40px;" class="mb-3" />
        <h5 class="mb-3">Acceso al Contrato</h5>
        <p class="text-muted mb-4">Ingresa el codigo de acceso de 6 digitos que te compartieron</p>
        <CFormInput
          v-model="code"
          type="text"
          maxlength="6"
          placeholder="000000"
          class="text-center fs-3 mb-3"
          @keyup.enter="validate"
        />
        <div v-if="error" class="text-danger small mb-3">{{ error }}</div>
        <CButton color="primary" class="w-100" @click="validate" :disabled="code.length < 6 || validating">
          {{ validating ? 'Verificando...' : 'Acceder' }}
        </CButton>
      </CCardBody>
    </CCard>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const code = ref('')
const error = ref('')
const validating = ref(false)

async function validate() {
  if (code.value.length < 6) return
  validating.value = true
  error.value = ''
  try {
    const res = await fetch('/api/public/contracts/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accommodation_id: route.params.accommodationId, code: code.value }),
    })
    if (!res.ok) {
      error.value = 'Codigo incorrecto'
      return
    }
    const { qr_token } = await res.json()
    router.push(`/contract/${qr_token}`)
  } catch (err) {
    error.value = 'Error de conexion'
  } finally {
    validating.value = false
  }
}
</script>
