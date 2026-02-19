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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(CoreuiVue)
app.use(HighchartsVue)
app.provide('icons', icons)
app.component('CIcon', CIcon)
app.mount('#app')
