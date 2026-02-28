<template>
  <div class="cabania-login" :data-theme="resolvedTheme">
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

    <div class="cabania-glow" aria-hidden="true">
      <div class="cabania-orb cabania-orb--emerald"></div>
      <div class="cabania-orb cabania-orb--sky"></div>
      <div class="cabania-orb cabania-orb--emerald-bottom"></div>
    </div>

    <div class="cabania-login__card">
      <div class="cabania-login__logo">
        <img src="/logo-inverted.svg" alt="CabanIA" class="cabania-login__logo-icon" />
        <img src="/logo-wordmark.svg" alt="CabanIA" class="cabania-login__logo-wordmark" />
      </div>

      <!-- Step 1: Enter email -->
      <template v-if="step === 1">
        <p class="cabania-login__subtitle">Iniciar con código</p>
        <p class="cabania-step-desc">Ingresa tu correo electrónico y te enviaremos un código de acceso</p>

        <div v-if="error" class="cabania-alert">
          {{ error }}
          <button type="button" class="cabania-alert__close" @click="error = null">&times;</button>
        </div>

        <form @submit.prevent="handleRequestCode">
          <div class="cabania-input-group">
            <div class="cabania-input-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2"/>
                <path d="M2 7l10 6 10-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <input
              v-model="email"
              type="email"
              class="cabania-input"
              placeholder="Correo electrónico"
              autocomplete="email"
              required
              :disabled="submitting"
              ref="emailInput"
            />
          </div>

          <button
            type="submit"
            class="cabania-btn cabania-btn--gradient"
            :disabled="submitting"
          >
            <span v-if="submitting" class="cabania-spinner cabania-spinner--sm"></span>
            Enviar código
          </button>
        </form>

        <div class="cabania-back-link">
          <router-link to="/pages/login">Volver al inicio de sesión</router-link>
        </div>
      </template>

      <!-- Step 2: Enter code -->
      <template v-if="step === 2">
        <p class="cabania-login__subtitle">Ingresa tu código</p>
        <p class="cabania-step-desc">Enviamos un código de 6 dígitos a <strong>{{ email }}</strong></p>

        <div v-if="error" class="cabania-alert">
          {{ error }}
          <button type="button" class="cabania-alert__close" @click="error = null">&times;</button>
        </div>

        <div v-if="successMsg" class="cabania-success">
          {{ successMsg }}
        </div>

        <form @submit.prevent="handleVerifyCode">
          <div class="cabania-code-input-wrapper">
            <input
              v-for="(_, i) in 6"
              :key="i"
              :ref="el => codeInputs[i] = el"
              type="text"
              inputmode="numeric"
              maxlength="1"
              class="cabania-code-digit"
              :disabled="submitting"
              @input="onCodeInput(i, $event)"
              @keydown="onCodeKeydown(i, $event)"
              @paste="onCodePaste($event)"
            />
          </div>

          <button
            type="submit"
            class="cabania-btn cabania-btn--gradient"
            :disabled="submitting || codeDigits.join('').length < 6"
          >
            <span v-if="submitting" class="cabania-spinner cabania-spinner--sm"></span>
            Verificar
          </button>
        </form>

        <div class="cabania-code-actions">
          <button
            class="cabania-link-btn"
            :disabled="resendCooldown > 0 || submitting"
            @click="handleResend"
          >
            {{ resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código' }}
          </button>
          <button class="cabania-link-btn" @click="goBackToEmail">
            Cambiar correo
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { requestLoginCode, verifyLoginCode, error } = useAuth();

const THEME_KEY = 'coreui-free-vue-admin-template-theme';
const theme = ref(localStorage.getItem(THEME_KEY) || 'auto');
const prefersDark = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true
);

let mqHandler;
onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mqHandler = (e) => { prefersDark.value = e.matches; };
  mq.addEventListener('change', mqHandler);
});
onUnmounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mqHandler) mq.removeEventListener('change', mqHandler);
  if (cooldownTimer) clearInterval(cooldownTimer);
});

const resolvedTheme = computed(() => {
  if (theme.value === 'auto') return prefersDark.value ? 'dark' : 'light';
  return theme.value;
});
const themeLabel = computed(() => {
  const labels = { light: 'Tema claro', dark: 'Tema oscuro', auto: 'Automático' };
  return labels[theme.value];
});
const cycleTheme = () => {
  const order = ['light', 'dark', 'auto'];
  const idx = order.indexOf(theme.value);
  theme.value = order[(idx + 1) % 3];
  localStorage.setItem(THEME_KEY, theme.value);
};

const step = ref(1);
const email = ref('');
const submitting = ref(false);
const successMsg = ref('');
const resendCooldown = ref(0);
let cooldownTimer = null;

// Code input handling
const codeDigits = ref(['', '', '', '', '', '']);
const codeInputs = ref([]);

function onCodeInput(index, event) {
  const value = event.target.value.replace(/\D/g, '');
  codeDigits.value[index] = value;
  event.target.value = value;
  if (value && index < 5) {
    codeInputs.value[index + 1]?.focus();
  }
}

function onCodeKeydown(index, event) {
  if (event.key === 'Backspace' && !codeDigits.value[index] && index > 0) {
    codeInputs.value[index - 1]?.focus();
  }
}

function onCodePaste(event) {
  event.preventDefault();
  const pasted = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
  for (let i = 0; i < 6; i++) {
    codeDigits.value[i] = pasted[i] || '';
    if (codeInputs.value[i]) codeInputs.value[i].value = pasted[i] || '';
  }
  const focusIdx = Math.min(pasted.length, 5);
  codeInputs.value[focusIdx]?.focus();
}

function startCooldown() {
  resendCooldown.value = 60;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}

async function handleRequestCode() {
  submitting.value = true;
  error.value = null;
  const success = await requestLoginCode(email.value);
  submitting.value = false;
  if (success) {
    step.value = 2;
    startCooldown();
    await nextTick();
    codeInputs.value[0]?.focus();
  }
}

async function handleVerifyCode() {
  const code = codeDigits.value.join('');
  if (code.length < 6) return;
  submitting.value = true;
  error.value = null;
  const success = await verifyLoginCode(email.value, code);
  submitting.value = false;
  if (success) {
    router.push('/');
  }
}

async function handleResend() {
  submitting.value = true;
  error.value = null;
  successMsg.value = '';
  const success = await requestLoginCode(email.value);
  submitting.value = false;
  if (success) {
    successMsg.value = 'Código reenviado';
    startCooldown();
    // Clear code inputs
    for (let i = 0; i < 6; i++) {
      codeDigits.value[i] = '';
      if (codeInputs.value[i]) codeInputs.value[i].value = '';
    }
    codeInputs.value[0]?.focus();
    setTimeout(() => { successMsg.value = ''; }, 3000);
  }
}

function goBackToEmail() {
  step.value = 1;
  error.value = null;
  successMsg.value = '';
  for (let i = 0; i < 6; i++) {
    codeDigits.value[i] = '';
    if (codeInputs.value[i]) codeInputs.value[i].value = '';
  }
}
</script>

<style scoped>
.cabania-login {
  --cl-bg: #f1f5f9; --cl-text: #0f172a; --cl-text-secondary: #64748b; --cl-text-muted: #94a3b8;
  --cl-card-bg: rgba(255,255,255,0.65); --cl-card-border: rgba(255,255,255,0.6);
  --cl-card-shadow: 0 25px 50px -12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.03);
  --cl-input-bg: rgba(255,255,255,0.6); --cl-input-border: rgba(0,0,0,0.08);
  --cl-focus-shadow: 0 0 0 3px rgba(14,165,233,0.1);
  --cl-btn-text: white; --cl-btn-border: none; --cl-btn-shadow: 0 4px 16px rgba(16,185,129,0.3);
  --cl-orb-emerald: rgba(16,185,129,0.15); --cl-orb-sky: rgba(14,165,233,0.15);
  --cl-orb-bottom: rgba(16,185,129,0.08); --cl-orb-blur: 120px;
  --cl-spinner-track: rgba(0,0,0,0.08); --cl-spinner-sm-color: white;
  --cl-alert-border: rgba(239,68,68,0.2); --cl-alert-bg: rgba(239,68,68,0.06); --cl-alert-text: #dc2626;
  --cl-toggle-bg: rgba(255,255,255,0.5); --cl-toggle-border: rgba(0,0,0,0.08);
  --cl-toggle-hover: rgba(255,255,255,0.8);
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background-color: var(--cl-bg); color: var(--cl-text); position: relative; overflow: hidden; padding: 1rem;
  transition: background-color 0.3s, color 0.3s;
}
.cabania-login[data-theme="dark"] {
  --cl-bg: #020617; --cl-text: #f1f5f9; --cl-text-secondary: #94a3b8; --cl-text-muted: #64748b;
  --cl-card-bg: rgba(255,255,255,0.05); --cl-card-border: rgba(255,255,255,0.15);
  --cl-card-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
  --cl-input-bg: rgba(2,6,23,0.4); --cl-input-border: rgba(255,255,255,0.15);
  --cl-focus-shadow: none;
  --cl-btn-text: #020617; --cl-btn-border: 1px solid rgba(255,255,255,0.15);
  --cl-btn-shadow: 0 4px 12px rgba(16,185,129,0.15);
  --cl-orb-emerald: rgba(16,185,129,0.2); --cl-orb-sky: rgba(14,165,233,0.2);
  --cl-orb-bottom: rgba(16,185,129,0.1); --cl-orb-blur: 96px;
  --cl-spinner-track: rgba(255,255,255,0.1); --cl-spinner-sm-color: #020617;
  --cl-alert-border: rgba(239,68,68,0.3); --cl-alert-bg: rgba(239,68,68,0.1); --cl-alert-text: #fca5a5;
  --cl-toggle-bg: rgba(255,255,255,0.05); --cl-toggle-border: rgba(255,255,255,0.15);
  --cl-toggle-hover: rgba(255,255,255,0.1);
}
.cabania-theme-toggle { position: absolute; top: 1.25rem; right: 1.25rem; z-index: 20; display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; border: 1px solid var(--cl-toggle-border); background: var(--cl-toggle-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: var(--cl-text-secondary); cursor: pointer; transition: background 0.2s, color 0.2s; }
.cabania-theme-toggle:hover { background: var(--cl-toggle-hover); color: var(--cl-text); }
.cabania-glow { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.cabania-orb { position: absolute; border-radius: 9999px; filter: blur(var(--cl-orb-blur)); transition: opacity 0.5s; }
.cabania-orb--emerald { top: -10rem; left: -10%; width: 520px; height: 520px; background: var(--cl-orb-emerald); }
.cabania-orb--sky { top: -10rem; right: -10%; width: 520px; height: 520px; background: var(--cl-orb-sky); }
.cabania-orb--emerald-bottom { bottom: -14rem; left: 25%; width: 620px; height: 620px; background: var(--cl-orb-bottom); }
.cabania-login__card { position: relative; z-index: 10; width: 100%; max-width: 420px; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid var(--cl-card-border); background: var(--cl-card-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: var(--cl-card-shadow); transition: background 0.3s, border-color 0.3s, box-shadow 0.3s; }
.cabania-login__logo { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.cabania-login__logo-icon { width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; object-fit: contain; }
.cabania-login__logo-wordmark { height: 1.4rem; width: auto; object-fit: contain; }
.cabania-login__subtitle { text-align: center; color: var(--cl-text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem; }
.cabania-step-desc { text-align: center; color: var(--cl-text-muted); font-size: 0.8rem; margin-bottom: 1.5rem; line-height: 1.4; }
.cabania-step-desc strong { color: var(--cl-text); }
.cabania-input-group { position: relative; margin-bottom: 1rem; }
.cabania-input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--cl-text-muted); display: flex; align-items: center; }
.cabania-input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border-radius: 0.75rem; border: 1px solid var(--cl-input-border); background: var(--cl-input-bg); color: var(--cl-text); font-size: 0.875rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
.cabania-input::placeholder { color: var(--cl-text-muted); }
.cabania-input:focus { border-color: rgba(14,165,233,0.5); box-shadow: var(--cl-focus-shadow); }
.cabania-input:disabled { opacity: 0.5; }
.cabania-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem 1.25rem; border-radius: 0.75rem; border: var(--cl-btn-border); font-size: 0.875rem; font-weight: 800; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
.cabania-btn:hover { opacity: 0.92; transform: translateY(-1px); }
.cabania-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.cabania-btn--gradient { background: linear-gradient(135deg, #10b981, #0ea5e9); color: var(--cl-btn-text); box-shadow: var(--cl-btn-shadow); }
.cabania-alert { position: relative; padding: 0.75rem 2.5rem 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid var(--cl-alert-border); background: var(--cl-alert-bg); color: var(--cl-alert-text); font-size: 0.875rem; margin-bottom: 1rem; }
.cabania-alert__close { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--cl-alert-text); font-size: 1.25rem; cursor: pointer; line-height: 1; }
.cabania-success { padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); color: #10b981; font-size: 0.875rem; margin-bottom: 1rem; text-align: center; }
.cabania-spinner { width: 2rem; height: 2rem; border: 3px solid var(--cl-spinner-track); border-top-color: #10b981; border-radius: 9999px; animation: cabania-spin 0.6s linear infinite; margin: 0 auto; }
.cabania-spinner--sm { width: 1rem; height: 1rem; border-width: 2px; border-top-color: var(--cl-spinner-sm-color); margin: 0; }
@keyframes cabania-spin { to { transform: rotate(360deg); } }

/* Code digit inputs */
.cabania-code-input-wrapper { display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1.5rem; }
.cabania-code-digit {
  width: 3rem; height: 3.5rem; text-align: center; font-size: 1.5rem; font-weight: 700;
  border-radius: 0.75rem; border: 1px solid var(--cl-input-border); background: var(--cl-input-bg);
  color: var(--cl-text); outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
}
.cabania-code-digit:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
.cabania-code-digit:disabled { opacity: 0.5; }

.cabania-code-actions { display: flex; justify-content: space-between; margin-top: 1rem; }
.cabania-link-btn { background: none; border: none; color: var(--cl-text-muted); font-size: 0.8rem; cursor: pointer; transition: color 0.2s; padding: 0; }
.cabania-link-btn:hover:not(:disabled) { color: #10b981; }
.cabania-link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cabania-back-link { text-align: center; margin-top: 1rem; }
.cabania-back-link a { color: var(--cl-text-muted); font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
.cabania-back-link a:hover { color: #10b981; }
</style>
