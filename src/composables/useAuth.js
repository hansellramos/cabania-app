import { ref, computed, onMounted } from 'vue';
import { resetAuthState } from '@/router';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

const user = ref(null);
const isLoading = ref(true);
const error = ref(null);
const supportsPasskeys = ref(false);

// Check WebAuthn support on load
if (typeof window !== 'undefined') {
  supportsPasskeys.value = browserSupportsWebAuthn();
}

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

async function loginWithPasskey() {
  try {
    error.value = null;

    // 1. Get challenge from server
    const optionsRes = await fetch('/api/auth/passkey/login/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!optionsRes.ok) {
      const data = await optionsRes.json();
      throw new Error(data.message || 'Error al obtener opciones de passkey');
    }
    const optionsJSON = await optionsRes.json();

    // 2. Start WebAuthn authentication (browser prompt)
    const authResponse = await startAuthentication({ optionsJSON });

    // 3. Send assertion to server
    const verifyRes = await fetch('/api/auth/passkey/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(authResponse),
    });
    if (!verifyRes.ok) {
      const data = await verifyRes.json();
      throw new Error(data.message || 'Error al autenticar con passkey');
    }

    // 4. Fetch user data
    resetAuthState();
    await fetchUser();
    return true;
  } catch (err) {
    // User cancelled the WebAuthn prompt
    if (err.name === 'NotAllowedError') {
      error.value = 'Autenticación cancelada';
    } else {
      error.value = err.message;
    }
    return false;
  }
}

async function registerPasskey(displayName = 'Passkey') {
  try {
    error.value = null;

    // 1. Get registration options from server
    const optionsRes = await fetch('/api/auth/passkey/register/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName }),
    });
    if (!optionsRes.ok) {
      const data = await optionsRes.json();
      throw new Error(data.message || 'Error al obtener opciones de registro');
    }
    const optionsJSON = await optionsRes.json();

    // 2. Start WebAuthn registration (browser prompt)
    const regResponse = await startRegistration({ optionsJSON });

    // 3. Send attestation to server
    const verifyRes = await fetch('/api/auth/passkey/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(regResponse),
    });
    if (!verifyRes.ok) {
      const data = await verifyRes.json();
      throw new Error(data.message || 'Error al registrar passkey');
    }

    // 4. Refresh user data (updates has_passkeys)
    await fetchUser();
    return true;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      error.value = 'Registro cancelado';
    } else if (err.name === 'InvalidStateError') {
      error.value = 'Este dispositivo ya tiene una passkey registrada';
    } else {
      error.value = err.message;
    }
    return false;
  }
}

async function getPasskeys() {
  try {
    const response = await fetch('/api/auth/passkeys', { credentials: 'include' });
    if (!response.ok) throw new Error('Error al listar passkeys');
    return await response.json();
  } catch (err) {
    error.value = err.message;
    return [];
  }
}

async function deletePasskey(id) {
  try {
    error.value = null;
    const response = await fetch(`/api/auth/passkeys/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al eliminar passkey');
    }
    await fetchUser();
    return true;
  } catch (err) {
    error.value = err.message;
    return false;
  }
}

async function requestLoginCode(email) {
  try {
    error.value = null;
    const response = await fetch('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Error al solicitar código');
    }
    return true;
  } catch (err) {
    error.value = err.message;
    return false;
  }
}

async function verifyLoginCode(email, code) {
  try {
    error.value = null;
    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Código inválido');
    }
    resetAuthState();
    await fetchUser();
    return true;
  } catch (err) {
    error.value = err.message;
    return false;
  }
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
    supportsPasskeys,
    login,
    loginWithPasskey,
    logout,
    fetchUser,
    registerPasskey,
    getPasskeys,
    deletePasskey,
    requestLoginCode,
    verifyLoginCode,
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
