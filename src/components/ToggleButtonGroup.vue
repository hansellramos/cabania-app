<template>
  <CButtonGroup :size="size">
    <CButton
      v-for="opt in options"
      :key="opt.value"
      :color="modelValue === opt.value ? 'primary' : 'secondary'"
      :variant="modelValue === opt.value ? undefined : 'outline'"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </CButton>
  </CButtonGroup>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  size: {
    type: String,
    default: 'sm',
  },
})

defineEmits(['update:modelValue'])
</script>
