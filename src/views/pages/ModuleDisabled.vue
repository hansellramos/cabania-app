<template>
  <CRow class="justify-content-center">
    <CCol :md="8" :lg="6">
      <CCard class="text-center mt-4">
        <CCardBody class="p-5">
          <div class="mb-4">
            <CIcon icon="cil-puzzle" size="4xl" class="text-body-secondary" />
          </div>
          <h3 class="mb-3">{{ info ? `${info.name} está desactivado` : 'Módulo desactivado' }}</h3>
          <p v-if="info" class="text-body-secondary mb-2">{{ info.description }}</p>
          <p class="text-body-secondary mb-4">
            Tu organización no usa este módulo. Un administrador puede activarlo en
            <strong>Organizaciones &rsaquo; Módulos</strong>.
          </p>
          <div class="d-flex gap-2 justify-content-center flex-wrap">
            <RouterLink to="/next">
              <CButton color="primary">Ir a Próximos</CButton>
            </RouterLink>
            <RouterLink to="/business/organizations">
              <CButton color="secondary" variant="outline">Ver organizaciones</CButton>
            </RouterLink>
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { moduleInfo } from '@/utils/modules'

const route = useRoute()
const info = computed(() => moduleInfo(route.query.module))
</script>
