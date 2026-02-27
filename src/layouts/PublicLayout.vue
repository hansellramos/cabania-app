<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'

const THEME_KEY = 'coreui-free-vue-admin-template-theme'

const theme = ref(localStorage.getItem(THEME_KEY) || 'auto')
const prefersDark = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
)

let mqHandler
onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mqHandler = (e) => { prefersDark.value = e.matches }
  mq.addEventListener('change', mqHandler)
})
onUnmounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  if (mqHandler) mq.removeEventListener('change', mqHandler)
})

const resolvedTheme = computed(() => {
  if (theme.value === 'auto') return prefersDark.value ? 'dark' : 'light'
  return theme.value
})

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

// Venue colors injected from PublicVenueView
const venueColors = inject('venueColors', ref({ primary: null, secondary: null }))

const layoutStyle = computed(() => ({
  '--venue-color-primary': venueColors.value?.primary || '#10b981',
  '--venue-color-secondary': venueColors.value?.secondary || '#0ea5e9',
}))
</script>

<template>
  <div class="public-layout" :data-theme="resolvedTheme" :style="layoutStyle">
    <!-- Background glow orbs -->
    <div class="public-glow" aria-hidden="true">
      <div class="public-orb public-orb--primary"></div>
      <div class="public-orb public-orb--secondary"></div>
      <div class="public-orb public-orb--bottom"></div>
    </div>

    <header class="public-header">
      <div class="header-container">
        <div id="public-header-left" class="header-left">
          <!-- PublicVenueView teleports venue name here -->
        </div>
        <div class="header-right">
          <button class="theme-toggle" @click="cycleTheme" :title="themeLabel">
            <!-- Sun icon (light) -->
            <svg v-if="theme === 'light'" viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <!-- Moon icon (dark) -->
            <svg v-else-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <!-- Auto/contrast icon -->
            <svg v-else viewBox="0 0 24 24" fill="none" width="16" height="16">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
              <path d="M12 3a9 9 0 0 1 0 18V3z" fill="currentColor"/>
            </svg>
          </button>
          <!-- CabanIA brand removed from header; shown in footer and widget footers -->
        </div>
      </div>
    </header>
    <main class="public-main">
      <router-view />
    </main>
    <footer class="public-footer">
      <div class="footer-inner">
        <span class="footer-text">Powered by</span>
        <img src="/logo-inverted.svg" alt="CabanIA" class="footer-logo-icon" />
        <img src="/logo-wordmark.svg" alt="CabanIA" class="footer-logo-wordmark" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* --- Light mode (default) --- */
.public-layout {
  --pl-bg: #f8fafc;
  --pl-text: #0f172a;
  --pl-text-secondary: #64748b;
  --pl-text-muted: #94a3b8;
  --pl-header-bg: rgba(255, 255, 255, 0.55);
  --pl-header-border: rgba(255, 255, 255, 0.3);
  --pl-footer-border: rgba(0, 0, 0, 0.06);
  --pl-toggle-bg: rgba(255, 255, 255, 0.5);
  --pl-toggle-border: rgba(0, 0, 0, 0.08);
  --pl-toggle-hover: rgba(255, 255, 255, 0.8);
  --pl-orb-opacity: 0.15;
  --pl-orb-blur: 120px;

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--pl-bg);
  color: var(--pl-text);
  position: relative;
  overflow-x: hidden;
  transition: background 0.3s, color 0.3s;
}

/* --- Dark mode --- */
.public-layout[data-theme="dark"] {
  --pl-bg: #020617;
  --pl-text: #f1f5f9;
  --pl-text-secondary: #94a3b8;
  --pl-text-muted: #64748b;
  --pl-header-bg: rgba(2, 6, 23, 0.65);
  --pl-header-border: rgba(255, 255, 255, 0.08);
  --pl-footer-border: rgba(255, 255, 255, 0.08);
  --pl-toggle-bg: rgba(255, 255, 255, 0.05);
  --pl-toggle-border: rgba(255, 255, 255, 0.15);
  --pl-toggle-hover: rgba(255, 255, 255, 0.1);
  --pl-orb-opacity: 0.2;
  --pl-orb-blur: 96px;
}

/* --- Background glow orbs --- */
.public-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.public-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(var(--pl-orb-blur));
  transition: opacity 0.5s;
}

.public-orb--primary {
  top: -10rem;
  left: -10%;
  width: 520px;
  height: 520px;
  background: var(--venue-color-primary, #10b981);
  opacity: var(--pl-orb-opacity);
}

.public-orb--secondary {
  top: -10rem;
  right: -10%;
  width: 520px;
  height: 520px;
  background: var(--venue-color-secondary, #0ea5e9);
  opacity: var(--pl-orb-opacity);
}

.public-orb--bottom {
  bottom: -14rem;
  left: 25%;
  width: 620px;
  height: 620px;
  background: var(--venue-color-primary, #10b981);
  opacity: calc(var(--pl-orb-opacity) * 0.6);
}

/* --- Header --- */
.public-header {
  background: var(--pl-header-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--pl-header-border);
  padding: 0.6rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* Theme toggle */
.theme-toggle {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  border: 1px solid var(--pl-toggle-border);
  background: var(--pl-toggle-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--pl-text-secondary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.theme-toggle:hover {
  background: var(--pl-toggle-hover);
  color: var(--pl-text);
}

.public-main {
  flex: 1;
  position: relative;
  z-index: 1;
}

.public-footer {
  padding: 1.5rem 0;
  border-top: 1px solid var(--pl-footer-border);
  color: var(--pl-text-muted);
  position: relative;
  z-index: 1;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.footer-text {
  font-size: 0.7rem;
  color: var(--pl-text-muted);
}

.footer-logo-icon {
  height: 14px;
  width: 14px;
  border-radius: 0.2rem;
  object-fit: contain;
  opacity: 0.6;
}

.footer-logo-wordmark {
  height: 12px;
  width: auto;
  opacity: 0.5;
}

.public-layout[data-theme="dark"] .footer-logo-wordmark {
  filter: brightness(0) invert(1);
  opacity: 0.4;
}
</style>
