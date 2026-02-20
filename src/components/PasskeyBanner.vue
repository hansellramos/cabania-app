<template>
  <CAlert
    v-if="showBanner"
    color="info"
    class="passkey-banner mb-0 rounded-0 text-center py-2"
    :dismissible="false"
  >
    <div class="d-flex align-items-center justify-content-center gap-2 flex-wrap">
      <span>
        <CIcon :icon="cilFingerprint" class="me-1" />
        Activa tu <strong>passkey</strong> para iniciar sesión más rápido
      </span>
      <CButton color="light" size="sm" @click="handleRegister" :disabled="registering">
        <CSpinner v-if="registering" size="sm" class="me-1" />
        Activar
      </CButton>
      <CButton color="link" size="sm" class="text-decoration-none" @click="dismiss">
        Ahora no
      </CButton>
    </div>
  </CAlert>
</template>

<script setup>
import { ref, computed } from 'vue'
import { CIcon } from '@coreui/icons-vue'
import { cilFingerprint } from '@coreui/icons'
import { useAuth } from '@/composables/useAuth'

const DISMISS_KEY = 'cabania-passkey-banner-dismissed'

const { user, supportsPasskeys, registerPasskey } = useAuth()
const dismissed = ref(localStorage.getItem(DISMISS_KEY) === 'true')
const registering = ref(false)

const showBanner = computed(() => {
  return (
    supportsPasskeys.value &&
    user.value &&
    !user.value.has_passkeys &&
    !dismissed.value
  )
})

const dismiss = () => {
  dismissed.value = true
  localStorage.setItem(DISMISS_KEY, 'true')
}

const handleRegister = async () => {
  registering.value = true
  const success = await registerPasskey('Mi dispositivo')
  registering.value = false
  if (success) {
    dismiss()
  }
}
</script>

<style scoped>
.passkey-banner {
  border-left: none;
  border-right: none;
  border-top: none;
  font-size: 0.875rem;
}
</style>
