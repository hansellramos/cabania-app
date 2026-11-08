<template>
  <CInputGroup>
    <CFormSelect
      :model-value="type || 'CC'"
      class="document-type"
      aria-label="Tipo de documento"
      @update:model-value="emit('update:type', $event)"
    >
      <option v-for="(label, code) in DOCUMENT_TYPES" :key="code" :value="code" :title="label">{{ code }}</option>
    </CFormSelect>
    <CFormInput
      :id="inputId"
      :model-value="number || ''"
      :inputmode="documentAllowsLetters(type) ? 'text' : 'numeric'"
      :placeholder="`${DOCUMENT_TYPES[type || 'CC']} (opcional)`"
      aria-label="Número de documento"
      @update:model-value="emit('update:number', $event)"
    />
  </CInputGroup>
</template>

<script setup>
import { CInputGroup, CFormSelect, CFormInput } from '@coreui/vue'
import { DOCUMENT_TYPES, documentAllowsLetters } from '@/utils/documentTypes'

defineProps({
  type: { type: String, default: 'CC' },
  number: { type: String, default: '' },
  inputId: { type: String, default: undefined },
})
const emit = defineEmits(['update:type', 'update:number'])
</script>

<style scoped>
.document-type { flex: 0 0 6rem; }
</style>
