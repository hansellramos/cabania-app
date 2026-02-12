<template>
  <div class="cabania-login">
    <!-- Background glow orbs -->
    <div class="cabania-glow" aria-hidden="true">
      <div class="cabania-orb cabania-orb--emerald"></div>
      <div class="cabania-orb cabania-orb--sky"></div>
      <div class="cabania-orb cabania-orb--emerald-bottom"></div>
    </div>

    <div class="cabania-login__card">
      <!-- Logo -->
      <div class="cabania-login__logo">
        <span class="cabania-login__logo-icon">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M4 20V10.5L12 4l8 6.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span class="cabania-login__logo-text">CabanIA</span>
      </div>

      <p class="cabania-login__subtitle">
        Inicia sesión para acceder al panel
      </p>

      <div v-if="isLoading" class="cabania-login__loading">
        <div class="cabania-spinner"></div>
        <p>Verificando sesión...</p>
      </div>

      <div v-else-if="isAuthenticated" class="cabania-login__welcome">
        <p>Bienvenido, {{ user?.display_name || user?.email }}</p>
        <button class="cabania-btn cabania-btn--gradient" @click="goToDashboard">
          Ir al Dashboard
        </button>
      </div>

      <form v-else @submit.prevent="handleLogin">
        <div v-if="error" class="cabania-alert">
          {{ error }}
          <button type="button" class="cabania-alert__close" @click="error = null">&times;</button>
        </div>

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
          />
        </div>

        <div class="cabania-input-group">
          <div class="cabania-input-icon">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <input
            v-model="password"
            type="password"
            class="cabania-input"
            placeholder="Contraseña"
            autocomplete="current-password"
            required
            :disabled="submitting"
          />
        </div>

        <button
          type="submit"
          class="cabania-btn cabania-btn--gradient"
          :disabled="submitting"
        >
          <span v-if="submitting" class="cabania-spinner cabania-spinner--sm"></span>
          Iniciar sesión
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { user, isAuthenticated, isLoading, login, error } = useAuth();

const email = ref('');
const password = ref('');
const submitting = ref(false);

const goToDashboard = () => {
  router.push('/');
};

const handleLogin = async () => {
  submitting.value = true;
  const success = await login(email.value, password.value);
  submitting.value = false;
  if (success) {
    router.push('/');
  }
};
</script>

<style scoped>
.cabania-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--cabania-bg);
  color: var(--cabania-text);
  position: relative;
  overflow: hidden;
  padding: 1rem;
}

/* Background glow orbs */
.cabania-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.cabania-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(96px);
}

.cabania-orb--emerald {
  top: -10rem;
  left: -10%;
  width: 520px;
  height: 520px;
  background: var(--cabania-emerald-glow);
}

.cabania-orb--sky {
  top: -10rem;
  right: -10%;
  width: 520px;
  height: 520px;
  background: var(--cabania-sky-glow);
}

.cabania-orb--emerald-bottom {
  bottom: -14rem;
  left: 25%;
  width: 620px;
  height: 620px;
  background: var(--cabania-emerald-glow-subtle);
}

/* Card */
.cabania-login__card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  border-radius: var(--cabania-radius-xl);
  border: 1px solid var(--cabania-border);
  background: var(--cabania-card-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: var(--cabania-shadow);
}

/* Logo */
.cabania-login__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.cabania-login__logo-icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--cabania-radius);
  border: 1px solid var(--cabania-border);
  background: var(--cabania-gradient);
  box-shadow: var(--cabania-shadow-md);
  color: white;
}

.cabania-login__logo-text {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.cabania-login__subtitle {
  text-align: center;
  color: var(--cabania-text-muted);
  font-size: 0.875rem;
  margin-bottom: 2rem;
}

/* Loading */
.cabania-login__loading {
  text-align: center;
  color: var(--cabania-text-muted);
}

.cabania-login__loading p {
  margin-top: 0.75rem;
  font-size: 0.875rem;
}

/* Welcome */
.cabania-login__welcome {
  text-align: center;
}

.cabania-login__welcome p {
  color: var(--cabania-emerald);
  margin-bottom: 1rem;
  font-weight: 600;
}

/* Inputs */
.cabania-input-group {
  position: relative;
  margin-bottom: 1rem;
}

.cabania-input-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--cabania-text-dim);
  display: flex;
  align-items: center;
}

.cabania-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  border-radius: var(--cabania-radius);
  border: 1px solid var(--cabania-border);
  background: var(--cabania-input-bg);
  color: var(--cabania-text);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.cabania-input::placeholder {
  color: var(--cabania-text-dim);
}

.cabania-input:focus {
  border-color: var(--cabania-focus-border);
}

.cabania-input:disabled {
  opacity: 0.5;
}

/* Buttons */
.cabania-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1.25rem;
  border-radius: var(--cabania-radius);
  border: 1px solid var(--cabania-border);
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  transition: opacity 0.2s;
}

.cabania-btn:hover {
  opacity: 0.92;
}

.cabania-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cabania-btn--gradient {
  background: var(--cabania-gradient);
  color: var(--cabania-bg);
  box-shadow: var(--cabania-shadow-md);
}

/* Alert */
.cabania-alert {
  position: relative;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border-radius: var(--cabania-radius);
  border: 1px solid var(--cabania-danger-border);
  background: var(--cabania-danger-bg);
  color: var(--cabania-danger-text);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.cabania-alert__close {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--cabania-danger-text);
  font-size: 1.25rem;
  cursor: pointer;
  line-height: 1;
}

/* Spinner */
.cabania-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--cabania-border-subtle);
  border-top-color: var(--cabania-emerald);
  border-radius: 9999px;
  animation: cabania-spin 0.6s linear infinite;
  margin: 0 auto;
}

.cabania-spinner--sm {
  width: 1rem;
  height: 1rem;
  border-width: 2px;
  border-top-color: var(--cabania-bg);
  margin: 0;
}

@keyframes cabania-spin {
  to { transform: rotate(360deg); }
}
</style>
