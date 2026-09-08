<script setup>
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { user, stopImpersonating } = useAuth()

const isImpersonating = computed(() => user.value?.is_impersonating)
const originalUser = computed(() => user.value?.impersonation?.originalUser)
const currentName = computed(() => user.value?.display_name || user.value?.email || 'usuario')

async function handleStop() {
  await stopImpersonating()
  window.location.reload()
}
</script>

<template>
  <div v-if="isImpersonating" class="impersonation-banner d-flex align-items-center justify-content-center gap-2 px-3 py-2">
    <CIcon icon="cil-user" />
    <span>
      Impersonando a <strong>{{ currentName }}</strong>
      <template v-if="originalUser"> &mdash; sesion original: {{ originalUser.display_name || originalUser.email }}</template>
    </span>
    <CButton color="light" size="sm" class="ms-2" @click="handleStop">
      Volver a mi cuenta
    </CButton>
  </div>
</template>

<style scoped>
.impersonation-banner {
  background-color: #e55353;
  color: white;
  font-size: 0.875rem;
  z-index: 1030;
}
</style>
