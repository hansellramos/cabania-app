<template>
  <CCard class="onboarding-card">
    <CCardBody class="p-4">
      <h4 class="card-title mb-1">Prueba el potencial desde ahora</h4>
      <p class="text-body-secondary mb-3">Escribe como si fueras un cliente preguntando por tu propiedad</p>

      <!-- Chat area -->
      <div class="chat-area" ref="chatArea">
        <div v-if="messages.length === 0 && !sending" class="text-center py-4">
          <div class="chat-empty-icon mb-2">💬</div>
          <p class="text-body-secondary small mb-0">Envía un mensaje para ver cómo responde CabanIA</p>
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          :class="['chat-msg', msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--bot']"
        >
          <div :class="['chat-bubble', msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--bot']">
            {{ msg.content }}
          </div>
        </div>
        <div v-if="sending" class="chat-msg chat-msg--bot">
          <div class="chat-bubble chat-bubble--bot">
            <CSpinner size="sm" /> <span class="ms-2">Escribiendo...</span>
          </div>
        </div>
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

      <!-- Input -->
      <div class="chat-input mb-3">
        <CFormInput
          v-model="newMessage"
          placeholder="Escribe un mensaje..."
          @keyup.enter="sendMessage"
          :disabled="sending || !providerId"
        />
        <CButton
          color="primary"
          class="chat-send-btn"
          @click="sendMessage"
          :disabled="sending || !newMessage.trim() || !providerId"
        >
          <span v-if="sending">...</span>
          <span v-else>➤</span>
        </CButton>
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  venueId: { type: String, required: true },
})

const emit = defineEmits(['completed', 'back'])

const messages = ref([])
const newMessage = ref('')
const sending = ref(false)
const error = ref('')
const providerId = ref('')
const conversationId = ref(null)
const hasInteracted = ref(false)
const showNext = ref(false)
const chatArea = ref(null)

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

function scrollToBottom() {
  nextTick(() => {
    if (chatArea.value) {
      chatArea.value.scrollTop = chatArea.value.scrollHeight
    }
  })
}

function sendChip(text) {
  newMessage.value = text
  sendMessage()
}

async function sendMessage() {
  if (!newMessage.value.trim() || !providerId.value || sending.value) return

  const userMsg = newMessage.value.trim()
  messages.value.push({ role: 'user', content: userMsg })
  newMessage.value = ''
  sending.value = true
  error.value = ''
  scrollToBottom()

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
    scrollToBottom()
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

.chat-area {
  max-height: 320px;
  min-height: 160px;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.chat-empty-icon {
  font-size: 32px;
}

.chat-msg {
  display: flex;
  margin-bottom: 8px;
}

.chat-msg--user {
  justify-content: flex-end;
}

.chat-msg--bot {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  padding: 8px 14px;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
}

.chat-bubble--user {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.chat-bubble--bot {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border-bottom-left-radius: 4px;
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

.chat-input {
  display: flex;
  gap: 8px;
}

.chat-send-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  border-radius: 10px;
  padding: 0 16px;
  font-size: 1.1rem;
}
</style>
