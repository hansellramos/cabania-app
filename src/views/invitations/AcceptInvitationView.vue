<template>
  <div class="cabania-login" :data-theme="resolvedTheme">
    <!-- Theme toggle -->
    <button class="cabania-theme-toggle" @click="cycleTheme" :title="themeLabel">
      <svg v-if="theme === 'light'" viewBox="0 0 24 24" fill="none" width="18" height="18">
        <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <svg v-else-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" width="18" height="18">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" width="18" height="18">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
        <path d="M12 3a9 9 0 0 1 0 18V3z" fill="currentColor"/>
      </svg>
    </button>

    <!-- Background glow orbs -->
    <div class="cabania-glow" aria-hidden="true">
      <div class="cabania-orb cabania-orb--emerald"></div>
      <div class="cabania-orb cabania-orb--sky"></div>
      <div class="cabania-orb cabania-orb--emerald-bottom"></div>
    </div>

    <div class="cabania-login__card">
      <!-- Logo -->
      <div class="cabania-login__logo">
        <img src="/logo-inverted.svg" alt="CabanIA" class="cabania-login__logo-icon" />
        <img src="/logo-wordmark.svg" alt="CabanIA" class="cabania-login__logo-wordmark" />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="cabania-login__loading">
        <div class="cabania-spinner"></div>
        <p>Validando invitación...</p>
      </div>

      <!-- Error -->
      <div v-else-if="tokenError" class="accept-error">
        <div class="accept-error__icon">✗</div>
        <p class="accept-error__text">{{ tokenError }}</p>
        <router-link to="/pages/login" class="cabania-btn cabania-btn--passkey" style="text-decoration:none; margin-top:1rem;">
          Ir al inicio de sesión
        </router-link>
      </div>

      <!-- Success -->
      <div v-else-if="accepted" class="cabania-login__welcome">
        <p>¡Bienvenido! Ya tienes acceso a <strong>{{ invitationData?.organization?.name }}</strong></p>
        <button class="cabania-btn cabania-btn--gradient" @click="goToDashboard">
          Ir al Dashboard
        </button>
      </div>

      <!-- Invitation info + forms -->
      <template v-else-if="invitationData">
        <div class="accept-invite-info">
          <p class="accept-invite-info__text">
            Has sido invitado a unirte a
            <strong>{{ invitationData.organization?.name || 'CabanIA' }}</strong>
          </p>
          <span class="accept-invite-info__badge">{{ profileLabel }}</span>
        </div>

        <!-- Mode selector -->
        <div class="accept-mode-tabs">
          <button
            :class="['accept-mode-tab', { active: mode === 'new' }]"
            @click="mode = 'new'"
          >No tengo cuenta</button>
          <button
            :class="['accept-mode-tab', { active: mode === 'existing' }]"
            @click="mode = 'existing'"
          >Ya tengo cuenta</button>
        </div>

        <div v-if="formError" class="cabania-alert">
          {{ formError }}
          <button type="button" class="cabania-alert__close" @click="formError = null">&times;</button>
        </div>

        <!-- New account form -->
        <form v-if="mode === 'new'" @submit.prevent="handleCreateAccount">
          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <input v-model="displayName" type="text" class="cabania-input" placeholder="Nombre completo" required :disabled="submitting" />
          </div>

          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2"/>
                <path d="M2 7l10 6 10-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <input v-model="email" type="email" class="cabania-input" placeholder="Correo electrónico" required :disabled="submitting || !!invitationData.email" />
          </div>

          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <input v-model="password" type="password" class="cabania-input" placeholder="Contraseña" required minlength="6" :disabled="submitting" />
          </div>

          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <input v-model="confirmPassword" type="password" class="cabania-input" placeholder="Confirmar contraseña" required minlength="6" :disabled="submitting" />
          </div>

          <button type="submit" class="cabania-btn cabania-btn--gradient" :disabled="submitting">
            <span v-if="submitting" class="cabania-spinner cabania-spinner--sm"></span>
            Crear cuenta y aceptar
          </button>
        </form>

        <!-- Existing account form (login) -->
        <form v-else @submit.prevent="handleLoginAndAccept">
          <p class="accept-login-hint">Inicia sesión con tu cuenta existente para vincular esta organización.</p>

          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2"/>
                <path d="M2 7l10 6 10-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <input v-model="email" type="email" class="cabania-input" placeholder="Correo electrónico" required :disabled="submitting" />
          </div>

          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <input v-model="password" type="password" class="cabania-input" placeholder="Contraseña" autocomplete="current-password" required :disabled="submitting" />
          </div>

          <button type="submit" class="cabania-btn cabania-btn--gradient" :disabled="submitting">
            <span v-if="submitting" class="cabania-spinner cabania-spinner--sm"></span>
            Iniciar sesión y aceptar
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { resetAuthState } from '@/router'

const route = useRoute()
const router = useRouter()
const { login, fetchUser } = useAuth()

const THEME_KEY = 'coreui-free-vue-admin-template-theme'

// State
const loading = ref(true)
const tokenError = ref(null)
const formError = ref(null)
const invitationData = ref(null)
const accepted = ref(false)
const submitting = ref(false)
const mode = ref('new') // 'new' | 'existing'

// Form fields
const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

// Theme management (same as Login.vue)
const theme = ref(localStorage.getItem(THEME_KEY) || 'auto')
const prefersDark = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true
)

let mqHandler
onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mqHandler = (e) => { prefersDark.value = e.matches }
  mq.addEventListener('change', mqHandler)
  validateToken()
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

const profileLabel = computed(() => {
  const code = invitationData.value?.profile_code
  if (code === 'organization:partner') return 'Aliado'
  if (code === 'organization:view') return 'Solo lectura'
  return 'Miembro'
})

async function validateToken() {
  const token = route.query.token
  if (!token) {
    tokenError.value = 'No se proporcionó un token de invitación'
    loading.value = false
    return
  }

  try {
    const res = await fetch(`/api/invitations/validate/${token}`)
    const data = await res.json()
    if (!res.ok || !data.valid) {
      tokenError.value = data.error || 'Invitación inválida'
    } else {
      invitationData.value = data
      if (data.email) email.value = data.email
    }
  } catch {
    tokenError.value = 'Error al validar la invitación'
  } finally {
    loading.value = false
  }
}

async function handleCreateAccount() {
  formError.value = null
  if (password.value !== confirmPassword.value) {
    formError.value = 'Las contraseñas no coinciden'
    return
  }
  if (password.value.length < 6) {
    formError.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }

  submitting.value = true
  try {
    const token = route.query.token
    const res = await fetch(`/api/invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        display_name: displayName.value,
        email: email.value,
        password: password.value,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      formError.value = data.error || 'Error al crear la cuenta'
    } else {
      resetAuthState()
      await fetchUser()
      accepted.value = true
    }
  } catch {
    formError.value = 'Error de conexión'
  } finally {
    submitting.value = false
  }
}

async function handleLoginAndAccept() {
  formError.value = null
  submitting.value = true
  try {
    const success = await login(email.value, password.value)
    if (!success) {
      formError.value = 'Credenciales incorrectas'
      submitting.value = false
      return
    }

    // Now accept the invitation as existing user
    const token = route.query.token
    const res = await fetch(`/api/invitations/${token}/accept-existing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      formError.value = data.error || 'Error al aceptar la invitación'
    } else {
      await fetchUser()
      accepted.value = true
    }
  } catch {
    formError.value = 'Error de conexión'
  } finally {
    submitting.value = false
  }
}

function goToDashboard() {
  router.push('/')
}
</script>

<style scoped>
/* Reuse all Login.vue styles */
.cabania-login {
  --cl-bg: #f1f5f9;
  --cl-text: #0f172a;
  --cl-text-secondary: #64748b;
  --cl-text-muted: #94a3b8;
  --cl-card-bg: rgba(255, 255, 255, 0.65);
  --cl-card-border: rgba(255, 255, 255, 0.6);
  --cl-card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03);
  --cl-input-bg: rgba(255, 255, 255, 0.6);
  --cl-input-border: rgba(0, 0, 0, 0.08);
  --cl-focus-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
  --cl-btn-text: white;
  --cl-btn-border: none;
  --cl-btn-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  --cl-orb-emerald: rgba(16, 185, 129, 0.15);
  --cl-orb-sky: rgba(14, 165, 233, 0.15);
  --cl-orb-bottom: rgba(16, 185, 129, 0.08);
  --cl-orb-blur: 120px;
  --cl-welcome: #059669;
  --cl-spinner-track: rgba(0, 0, 0, 0.08);
  --cl-spinner-sm-color: white;
  --cl-alert-border: rgba(239, 68, 68, 0.2);
  --cl-alert-bg: rgba(239, 68, 68, 0.06);
  --cl-alert-text: #dc2626;
  --cl-toggle-bg: rgba(255, 255, 255, 0.5);
  --cl-toggle-border: rgba(0, 0, 0, 0.08);
  --cl-toggle-hover: rgba(255, 255, 255, 0.8);

  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--cl-bg);
  color: var(--cl-text);
  position: relative;
  overflow: hidden;
  padding: 1rem;
  transition: background-color 0.3s, color 0.3s;
}

.cabania-login[data-theme="dark"] {
  --cl-bg: #020617;
  --cl-text: #f1f5f9;
  --cl-text-secondary: #94a3b8;
  --cl-text-muted: #64748b;
  --cl-card-bg: rgba(255, 255, 255, 0.05);
  --cl-card-border: rgba(255, 255, 255, 0.15);
  --cl-card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  --cl-input-bg: rgba(2, 6, 23, 0.4);
  --cl-input-border: rgba(255, 255, 255, 0.15);
  --cl-focus-shadow: none;
  --cl-btn-text: #020617;
  --cl-btn-border: 1px solid rgba(255, 255, 255, 0.15);
  --cl-btn-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  --cl-orb-emerald: rgba(16, 185, 129, 0.2);
  --cl-orb-sky: rgba(14, 165, 233, 0.2);
  --cl-orb-bottom: rgba(16, 185, 129, 0.1);
  --cl-orb-blur: 96px;
  --cl-welcome: #10b981;
  --cl-spinner-track: rgba(255, 255, 255, 0.1);
  --cl-spinner-sm-color: #020617;
  --cl-alert-border: rgba(239, 68, 68, 0.3);
  --cl-alert-bg: rgba(239, 68, 68, 0.1);
  --cl-alert-text: #fca5a5;
  --cl-toggle-bg: rgba(255, 255, 255, 0.05);
  --cl-toggle-border: rgba(255, 255, 255, 0.15);
  --cl-toggle-hover: rgba(255, 255, 255, 0.1);
}

.cabania-theme-toggle {
  position: absolute; top: 1.25rem; right: 1.25rem; z-index: 20;
  display: grid; place-items: center; width: 2.5rem; height: 2.5rem;
  border-radius: 0.75rem; border: 1px solid var(--cl-toggle-border);
  background: var(--cl-toggle-bg); backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px); color: var(--cl-text-secondary);
  cursor: pointer; transition: background 0.2s, color 0.2s;
}
.cabania-theme-toggle:hover { background: var(--cl-toggle-hover); color: var(--cl-text); }

.cabania-glow { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.cabania-orb { position: absolute; border-radius: 9999px; filter: blur(var(--cl-orb-blur)); }
.cabania-orb--emerald { top: -10rem; left: -10%; width: 520px; height: 520px; background: var(--cl-orb-emerald); }
.cabania-orb--sky { top: -10rem; right: -10%; width: 520px; height: 520px; background: var(--cl-orb-sky); }
.cabania-orb--emerald-bottom { bottom: -14rem; left: 25%; width: 620px; height: 620px; background: var(--cl-orb-bottom); }

.cabania-login__card {
  position: relative; z-index: 10; width: 100%; max-width: 420px;
  padding: 2.5rem; border-radius: 1.5rem;
  border: 1px solid var(--cl-card-border); background: var(--cl-card-bg);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  box-shadow: var(--cl-card-shadow); transition: background 0.3s, border-color 0.3s;
}

.cabania-login__logo { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.cabania-login__logo-icon { width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; object-fit: contain; }
.cabania-login__logo-wordmark { height: 1.4rem; width: auto; object-fit: contain; }

.cabania-login__loading { text-align: center; color: var(--cl-text-secondary); }
.cabania-login__loading p { margin-top: 0.75rem; font-size: 0.875rem; }

.cabania-login__welcome { text-align: center; }
.cabania-login__welcome p { color: var(--cl-welcome); margin-bottom: 1rem; font-weight: 600; }

.cabania-input-group { position: relative; margin-bottom: 1rem; }
.cabania-input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--cl-text-muted); display: flex; align-items: center; }
.cabania-input {
  width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border-radius: 0.75rem;
  border: 1px solid var(--cl-input-border); background: var(--cl-input-bg);
  color: var(--cl-text); font-size: 0.875rem; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
}
.cabania-input::placeholder { color: var(--cl-text-muted); }
.cabania-input:focus { border-color: rgba(14, 165, 233, 0.5); box-shadow: var(--cl-focus-shadow); }
.cabania-input:disabled { opacity: 0.5; }

.cabania-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; padding: 0.75rem 1.25rem; border-radius: 0.75rem;
  border: var(--cl-btn-border); font-size: 0.875rem; font-weight: 800;
  cursor: pointer; transition: opacity 0.2s, transform 0.1s;
}
.cabania-btn:hover { opacity: 0.92; transform: translateY(-1px); }
.cabania-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.cabania-btn--gradient { background: linear-gradient(135deg, #10b981, #0ea5e9); color: var(--cl-btn-text); box-shadow: var(--cl-btn-shadow); }
.cabania-btn--passkey { background: var(--cl-input-bg); color: var(--cl-text); border: 1px solid var(--cl-input-border); }

.cabania-alert {
  position: relative; padding: 0.75rem 2.5rem 0.75rem 1rem; border-radius: 0.75rem;
  border: 1px solid var(--cl-alert-border); background: var(--cl-alert-bg);
  color: var(--cl-alert-text); font-size: 0.875rem; margin-bottom: 1rem;
}
.cabania-alert__close {
  position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: var(--cl-alert-text); font-size: 1.25rem; cursor: pointer;
}

.cabania-spinner {
  width: 2rem; height: 2rem; border: 3px solid var(--cl-spinner-track);
  border-top-color: #10b981; border-radius: 9999px;
  animation: cabania-spin 0.6s linear infinite; margin: 0 auto;
}
.cabania-spinner--sm { width: 1rem; height: 1rem; border-width: 2px; border-top-color: var(--cl-spinner-sm-color); margin: 0; }
@keyframes cabania-spin { to { transform: rotate(360deg); } }

/* Accept invitation specific styles */
.accept-invite-info {
  text-align: center;
  margin-bottom: 1.5rem;
}

.accept-invite-info__text {
  color: var(--cl-text-secondary);
  font-size: 0.9375rem;
  line-height: 1.5;
  margin: 0 0 0.75rem;
}

.accept-invite-info__text strong {
  color: var(--cl-text);
}

.accept-invite-info__badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(14, 165, 233, 0.15));
  color: #10b981;
  font-size: 0.8rem;
  font-weight: 600;
}

.accept-mode-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.accept-mode-tab {
  flex: 1;
  padding: 0.625rem 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid var(--cl-input-border);
  background: transparent;
  color: var(--cl-text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.accept-mode-tab:hover {
  border-color: rgba(14, 165, 233, 0.3);
  color: var(--cl-text);
}

.accept-mode-tab.active {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(14, 165, 233, 0.1));
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
}

.accept-login-hint {
  color: var(--cl-text-secondary);
  font-size: 0.8125rem;
  text-align: center;
  margin: 0 0 1.25rem;
  line-height: 1.4;
}

.accept-error {
  text-align: center;
}

.accept-error__icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 0.75rem;
  border-radius: 9999px;
  background: var(--cl-alert-bg);
  border: 1px solid var(--cl-alert-border);
  color: var(--cl-alert-text);
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  font-weight: 700;
}

.accept-error__text {
  color: var(--cl-alert-text);
  font-size: 0.875rem;
  margin: 0;
}
</style>
