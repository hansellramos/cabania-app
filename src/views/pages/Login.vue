<template>
  <div class="wrapper min-vh-100 d-flex flex-row align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol :md="5">
          <CCard class="p-4">
            <CCardBody>
              <h1 class="text-center mb-1">Cabanero</h1>
              <p class="text-body-secondary text-center mb-4">
                Inicia sesión para acceder al panel
              </p>

              <div v-if="isLoading" class="text-center mb-4">
                <CSpinner color="primary" />
                <p class="mt-2">Verificando sesión...</p>
              </div>

              <div v-else-if="isAuthenticated" class="text-center">
                <p class="text-success mb-3">
                  Bienvenido, {{ user?.display_name || user?.email }}
                </p>
                <CButton color="primary" size="lg" @click="goToDashboard">
                  Ir al Dashboard
                </CButton>
              </div>

              <form v-else @submit.prevent="handleLogin">
                <CAlert v-if="error" color="danger" dismissible @close="error = null">
                  {{ error }}
                </CAlert>

                <CInputGroup class="mb-3">
                  <CInputGroupText>
                    <CIcon icon="cil-envelope-closed" />
                  </CInputGroupText>
                  <CFormInput
                    v-model="email"
                    type="email"
                    placeholder="Correo electrónico"
                    autocomplete="email"
                    required
                    :disabled="submitting"
                  />
                </CInputGroup>

                <CInputGroup class="mb-4">
                  <CInputGroupText>
                    <CIcon icon="cil-lock-locked" />
                  </CInputGroupText>
                  <CFormInput
                    v-model="password"
                    type="password"
                    placeholder="Contraseña"
                    autocomplete="current-password"
                    required
                    :disabled="submitting"
                  />
                </CInputGroup>

                <CButton
                  type="submit"
                  color="primary"
                  class="w-100"
                  :disabled="submitting"
                >
                  <CSpinner v-if="submitting" size="sm" class="me-2" />
                  Iniciar sesión
                </CButton>
              </form>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
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
