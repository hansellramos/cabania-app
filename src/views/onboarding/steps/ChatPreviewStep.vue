<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Prueba el potencial desde ahora</h4>
      <p class="text-body-secondary mb-3">Escribe como si fueras un cliente preguntando por tu propiedad</p>

      <!-- Chat messages (reusable component) -->
      <div class="chat-wrapper">
        <ChatMessages
          ref="messagesRef"
          :messages="messages"
          :sending="sending"
          venue-name="tu propiedad"
          visitor-name=""
        />
      </div>

      <!-- Suggestion chips -->
      <div v-if="!hasInteracted && !sending" class="suggestion-chips mb-3">
        <button
          v-for="chip in suggestions"
          :key="chip"
          class="chip"
          @click="sendChip(chip)"
        >
          {{ chip }}
        </button>
      </div>

      <!-- Chat input (reusable component) -->
      <div class="chat-input-wrapper mb-3">
        <ChatInput
          ref="inputRef"
          :sending="sending"
          :disabled="!providerId"
          placeholder="Escribe un mensaje..."
          @send="onSendMessage"
        />
      </div>

      <CAlert v-if="error" color="danger" class="mb-3 small">{{ error }}</CAlert>

      <div class="d-flex justify-content-between">
        <CButton color="secondary" variant="ghost" @click="$emit('back')">
          Anterior
        </CButton>
        <CButton
          v-if="showNext"
          color="primary"
          class="onboarding-btn"
          @click="goNext"
        >
          {{ hasInteracted ? 'Siguiente' : 'Saltar por ahora' }}
        </CButton>
      </div>
    </CCardBody>
  </CCard>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'

const props = defineProps({
  venueId: { type: String, required: true },
})

const emit = defineEmits(['completed', 'back'])

const messages = ref([])
const sending = ref(false)
const error = ref('')
const providerId = ref('')
const conversationId = ref(null)
const hasInteracted = ref(false)
const showNext = ref(false)
const messagesRef = ref(null)
const inputRef = ref(null)

let skipTimer = null

const suggestions = [
  '¿Dónde queda la cabaña?',
  '¿Cuántas personas caben?',
  '¿Tienen piscina?',
  '¿Cuánto cuesta por noche?',
]

onMounted(async () => {
  await loadDefaultProvider()
  skipTimer = setTimeout(() => {
    showNext.value = true
  }, 30000)
})

onUnmounted(() => {
  if (skipTimer) clearTimeout(skipTimer)
})

async function loadDefaultProvider() {
  try {
    const response = await fetch('/api/llm-providers', { credentials: 'include' })
    if (response.ok) {
      const providers = await response.json()
      const active = providers.filter(p => p.is_active)
      const def = active.find(p => p.is_default) || active[0]
      if (def) providerId.value = def.id
    }
  } catch (e) {
    console.error('Error loading providers:', e)
  }
}

function sendChip(text) {
  onSendMessage(text)
}

async function onSendMessage(text) {
  if (!text.trim() || !providerId.value || sending.value) return

  const userMsg = text.trim()
  messages.value.push({ role: 'user', content: userMsg })
  sending.value = true
  error.value = ''

  try {
    const response = await fetch(`/api/chat/${props.venueId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message: userMsg,
        provider_id: providerId.value,
        conversation_id: conversationId.value,
        contact_type: 'web',
        contact_value: 'onboarding-preview',
      }),
    })

    const result = await response.json()
    if (response.ok) {
      if (result.conversation_id) conversationId.value = result.conversation_id
      let content = result.response || result.message || ''
      content = content.replace(/\n<!-- \{.*?\} -->/g, '')
      messages.value.push({ role: 'assistant', content })

      if (!hasInteracted.value) {
        hasInteracted.value = true
        showNext.value = true
        if (skipTimer) clearTimeout(skipTimer)
      }
    } else {
      error.value = result.error || 'Error al enviar mensaje'
      messages.value.pop()
    }
  } catch (e) {
    error.value = 'Error de conexión'
    messages.value.pop()
  } finally {
    sending.value = false
  }
}

function goNext() {
  emit('completed', { conversationId: conversationId.value })
}
</script>

<style scoped>
.onboarding-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

.card-title { color: #f1f5f9; }

.onboarding-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  border-radius: 10px;
}

.chat-wrapper {
  max-height: 320px;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.chat-wrapper :deep(.chat-messages) {
  flex: 1;
  min-height: 0;
}

.chat-wrapper :deep(.chat-empty) {
  color: #94a3b8;
}

.chat-wrapper :deep(.bubble-bot) {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border-color: rgba(255, 255, 255, 0.06);
}

.chat-input-wrapper {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-input-wrapper :deep(.chat-input-bar) {
  border-top: none;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0;
}

.chat-input-wrapper :deep(.chat-input-field) {
  color: #e2e8f0;
}

.chat-input-wrapper :deep(.chat-input-field::placeholder) {
  color: #64748b;
}

.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.chip:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: #10b981;
}
</style>
