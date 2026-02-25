<template>
  <button class="theme-toggle" @click="cycleTheme" :title="themeLabel">
    <!-- Sun icon (light) -->
    <svg v-if="theme === 'light'" viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <!-- Moon icon (dark) -->
    <svg v-else-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <!-- Auto/contrast icon -->
    <svg v-else viewBox="0 0 24 24" fill="none" width="18" height="18">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
      <path d="M12 3a9 9 0 0 1 0 18V3z" fill="currentColor"/>
    </svg>
  </button>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const THEME_KEY = 'coreui-free-vue-admin-template-theme'

const theme = ref(localStorage.getItem(THEME_KEY) || 'auto')

const themeLabel = computed(() => {
  const labels = { light: 'Tema claro', dark: 'Tema oscuro', auto: 'Automático' }
  return labels[theme.value]
})

const cycleTheme = () => {
  const order = ['light', 'dark', 'auto']
  const idx = order.indexOf(theme.value)
  theme.value = order[(idx + 1) % 3]
  localStorage.setItem(THEME_KEY, theme.value)
}

defineExpose({ theme })
</script>

<style scoped>
.theme-toggle {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 20;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #94a3b8;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}
</style>
