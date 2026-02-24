<template>
  <div class="chat-input-bar">
    <input
      ref="inputEl"
      v-model="text"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled || sending"
      class="chat-input-field"
      @keyup.enter="handleSend"
    />
    <button
      class="chat-send-btn"
      :disabled="disabled || sending || !text.trim()"
      @click="handleSend"
    >
      <span v-if="sending" class="send-dots">...</span>
      <span v-else>➤</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: Boolean,
  sending: Boolean,
  placeholder: { type: String, default: 'Escribe tu pregunta...' }
})

const emit = defineEmits(['send'])
const text = ref('')
const inputEl = ref(null)

const handleSend = () => {
  if (!text.value.trim() || props.disabled || props.sending) return
  emit('send', text.value.trim())
  text.value = ''
}

const focus = () => {
  inputEl.value?.focus()
}

const setMessage = (msg) => {
  text.value = msg
}

defineExpose({ focus, setMessage })
</script>

<style scoped>
.chat-input-bar {
  display: flex;
  border-top: 1px solid var(--cabania-border-subtle, rgba(0,0,0,0.05));
  background: var(--cabania-card-bg, rgba(255,255,255,0.65));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 0 0 1.5rem 1.5rem;
  overflow: hidden;
}

.chat-input-field {
  flex: 1;
  border: none;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  outline: none;
  background: transparent;
  color: var(--cabania-text, #0f172a);
}

.chat-input-field::placeholder {
  color: var(--cabania-text-dim, #94a3b8);
}

.chat-send-btn {
  border: none;
  background: #10b981;
  color: #fff;
  padding: 0 1rem;
  font-size: 1.15rem;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
}

.chat-send-btn:hover:not(:disabled) {
  background: #059669;
}

.chat-send-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .chat-input-bar {
    border-radius: 0 0 1rem 1rem;
  }
}
</style>
