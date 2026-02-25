<template>
  <Transition name="ai-slide">
    <div v-if="visible && suggestions?.length" class="ai-suggestions" @mousedown.prevent>
      <div class="ai-suggestions-header">
        <span class="ai-sparkle">&#9733;</span>
        <span>Sugerencias de CabanIA</span>
      </div>
      <div class="ai-chips">
        <button
          v-for="(s, i) in suggestions"
          :key="i"
          type="button"
          class="ai-chip"
          @mousedown.prevent="$emit('select', s.value)"
        >
          {{ s.label || s.value }}
          <small v-if="s.count" class="ai-chip-count">({{ s.count }})</small>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  suggestions: { type: Array, default: () => [] },
  visible: { type: Boolean, default: false },
})

defineEmits(['select', 'dismiss'])
</script>

<style scoped>
.ai-suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 100;
  margin-top: 4px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.ai-suggestions-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #10b981;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ai-sparkle {
  font-size: 0.85rem;
}

.ai-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-chip {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #059669;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.ai-chip:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.4);
}

.ai-chip-count {
  opacity: 0.6;
  font-size: 0.7rem;
  margin-left: 2px;
}

/* Transition */
.ai-slide-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.ai-slide-leave-active {
  transition: all 0.15s ease-in;
}
.ai-slide-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.ai-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
