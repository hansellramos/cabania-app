import { ref, computed, onMounted } from 'vue';
import { resetAuthState } from '@/router';

const user = ref(null);
const isLoading = ref(true);
const error = ref(null);

async function fetchUser() {
  try {
    isLoading.value = true;
    error.value = null;

    const response = await fetch('/api/auth/user', {
      credentials: 'include',
    });

    if (response.status === 401) {
      user.value = null;
      return null;
    }

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    const userData = await response.json();
    user.value = userData;
    return userData;
  } catch (err) {
    error.value = err.message;
    user.value = null;
    return null;
  } finally {
    isLoading.value = false;
  }
}

async function login(email, password) {
  try {
    error.value = null;
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al iniciar sesión');
    }

    // Reset router auth cache so navigation guard re-checks
    resetAuthState();
    // Fetch user data after successful login
    await fetchUser();
    return true;
  } catch (err) {
    error.value = err.message;
    return false;
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (_) {
    // ignore
  }
  user.value = null;
  resetAuthState();
  window.location.href = '/#/pages/login';
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value);

  onMounted(() => {
    if (user.value === null && isLoading.value) {
      fetchUser();
    }
  });

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    logout,
    fetchUser,
  };
}

export function isUnauthorizedError(error) {
  return /^401: .*Unauthorized/.test(error?.message || '');
}

export function redirectToLogin(delay = 500) {
  setTimeout(() => {
    window.location.href = '/#/pages/login';
  }, delay);
}
