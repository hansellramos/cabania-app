import { createApp } from 'vue'
import { createPinia } from 'pinia'
import CoreuiVue from '@coreui/vue'
import CIcon from '@coreui/icons-vue'
import { iconsSet as icons } from '@/assets/icons'
import Highcharts from 'highcharts'
import Highcharts3DModule from 'highcharts/highcharts-3d'
import HighchartsVue from 'highcharts-vue'

import App from './App.vue'
import router from './router'
import { captureException, routePattern, routeModule } from '@/lib/analytics'

import '@/styles/style.scss'

// Initialize theme early — before any component renders
// Reads from localStorage or defaults to 'auto' (follows system preference)
const THEME_KEY = 'coreui-free-vue-admin-template-theme'
const stored = localStorage.getItem(THEME_KEY)
const theme = stored || 'auto'
if (!stored) localStorage.setItem(THEME_KEY, 'auto')

if (theme === 'auto') {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute('data-coreui-theme', prefersDark ? 'dark' : 'light')
} else {
  document.documentElement.setAttribute('data-coreui-theme', theme)
}

const init3D = Highcharts3DModule.default || Highcharts3DModule
if (typeof init3D === 'function') {
  init3D(Highcharts)
}

// A deploy replaced the chunk this tab was about to preload: reload once.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('cabania-chunk-reload')) return
    sessionStorage.setItem('cabania-chunk-reload', '1')
  } catch (_) {
    return
  }
  event.preventDefault()
  window.location.reload()
})

const app = createApp(App)
// Vue catches component errors before window.onerror sees them, so PostHog's
// automatic exception capture would miss them.
app.config.errorHandler = (err, instance, info) => {
  const route = router.currentRoute.value
  captureException(err, { route_pattern: routePattern(route), module: routeModule(route), vue_info: info })
  console.error(err)
}
app.use(createPinia())
app.use(router)
app.use(CoreuiVue)
app.use(HighchartsVue)
app.provide('icons', icons)
app.component('CIcon', CIcon)
app.mount('#app')
