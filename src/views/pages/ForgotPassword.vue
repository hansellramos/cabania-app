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

      <p class="cabania-login__subtitle">Recuperar acceso</p>

      <p class="cabania-options-desc">Elige cómo quieres acceder a tu cuenta</p>

      <button
        class="cabania-btn cabania-btn--option cabania-btn--disabled"
        disabled
      >
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>
          Reiniciar contraseña
          <small>Próximamente</small>
        </span>
      </button>

      <button
        class="cabania-btn cabania-btn--gradient"
        @click="$router.push('/pages/code-login')"
      >
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
          <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2"/>
          <path d="M2 7l10 6 10-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Iniciar con código
      </button>

      <div class="cabania-back-link">
        <router-link to="/pages/login">Volver al inicio de sesión</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

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
</script>

<style scoped>
/* Reuse Login.vue variables */
.cabania-login {
  --cl-bg: #f1f5f9; --cl-text: #0f172a; --cl-text-secondary: #64748b; --cl-text-muted: #94a3b8;
  --cl-card-bg: rgba(255,255,255,0.65); --cl-card-border: rgba(255,255,255,0.6);
  --cl-card-shadow: 0 25px 50px -12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.03);
  --cl-input-bg: rgba(255,255,255,0.6); --cl-input-border: rgba(0,0,0,0.08);
  --cl-btn-text: white; --cl-btn-border: none; --cl-btn-shadow: 0 4px 16px rgba(16,185,129,0.3);
  --cl-orb-emerald: rgba(16,185,129,0.15); --cl-orb-sky: rgba(14,165,233,0.15);
  --cl-orb-bottom: rgba(16,185,129,0.08); --cl-orb-blur: 120px;
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
  --cl-btn-text: #020617; --cl-btn-border: 1px solid rgba(255,255,255,0.15);
  --cl-btn-shadow: 0 4px 12px rgba(16,185,129,0.15);
  --cl-orb-emerald: rgba(16,185,129,0.2); --cl-orb-sky: rgba(14,165,233,0.2);
  --cl-orb-bottom: rgba(16,185,129,0.1); --cl-orb-blur: 96px;
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
.cabania-login__subtitle { text-align: center; color: var(--cl-text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; }
.cabania-options-desc { text-align: center; color: var(--cl-text-muted); font-size: 0.8rem; margin-bottom: 1.25rem; }
.cabania-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem 1.25rem; border-radius: 0.75rem; border: var(--cl-btn-border); font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
.cabania-btn:hover { opacity: 0.92; transform: translateY(-1px); }
.cabania-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.cabania-btn--gradient { background: linear-gradient(135deg, #10b981, #0ea5e9); color: var(--cl-btn-text); box-shadow: var(--cl-btn-shadow); margin-bottom: 1rem; }
.cabania-btn--option { background: var(--cl-input-bg); color: var(--cl-text); border: 1px solid var(--cl-input-border); margin-bottom: 0.75rem; text-align: left; justify-content: flex-start; }
.cabania-btn--option span { display: flex; flex-direction: column; }
.cabania-btn--option small { color: var(--cl-text-muted); font-size: 0.7rem; font-weight: 400; }
.cabania-btn--disabled { opacity: 0.4; }
.cabania-back-link { text-align: center; margin-top: 0.5rem; }
.cabania-back-link a { color: var(--cl-text-muted); font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
.cabania-back-link a:hover { color: #10b981; }
</style>
