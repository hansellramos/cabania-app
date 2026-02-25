<template>
  <!-- Floating bubble button -->
  <button :class="['chat-bubble-btn', { 'is-open': isOpen }]" @click="togglePanel">
    <svg v-if="!isOpen" viewBox="0 0 24 24" fill="none" width="48" height="48" style="margin-top: 4px">
      <!-- Chat bubble outline -->
      <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h13A2.5 2.5 0 0 1 21 4.5v9a2.5 2.5 0 0 1-2.5 2.5H14l-2 3-2-3H5.5A2.5 2.5 0 0 1 3 13.5v-9z" stroke="currentColor" stroke-width="0.8" stroke-linejoin="round"/>
      <!-- CabanIA cabin icon from logo -->
      <g transform="translate(-1.69, 1.98) scale(0.009)" fill="currentColor">
        <polygon points="1522.1,316.1 924.8,911.3 992.7,911.3 1521.6,384.9 2051.3,911.3 2118.3,911.3"/>
        <path d="M1948.8,926.2h56.7l-483.5-482.8l-482.4,482.8h54.7v317.6h-87.5v49.9h1030.8v-47.8h-88.9V926.2z M1541.7,529.1L1890.6,878h-176.7l-172.3-236.5V529.1z M1665.8,878.2h-288.5l144.3-199.5L1665.8,878.2z M1502.7,529.1v111.5l-172.9,237.6h-176L1502.7,529.1z M1267.7,1243.6H1144v-81.9l71.2-73.5V1015 c10.3-3.8,17.7-13.8,17.7-25.5c0-15-12.2-27.1-27.1-27.1c-15,0-27.1,12.2-27.1,27.1c0,11.8,7.6,21.9,18.2,25.6v65.6 L1144,1133V927.2h123.6V1243.6z M1205.8,1000.7c-6.1,0-11.1-5-11.1-11.1c0-6.2,5-11.1,11.1-11.1c6.1,0,11.1,5,11.1,11.1 C1217,995.7,1212,1000.7,1205.8,1000.7z M1727.9,1243h-412.6v-39.2h181.1c4,10.1,13.8,17.2,25.2,17.2 c15,0,27.1-12.2,27.1-27.1c0-15-12.2-27.1-27.1-27.1c-11.7,0-21.7,7.4-25.5,17.8h-180.8v-257h412.6V1243z M1510.6,1193.8c0-6.1,5-11.1,11.1-11.1c6.1,0,11.1,5,11.1,11.1c0,6.2-5,11.1-11.1,11.1 C1515.6,1205,1510.6,1200,1510.6,1193.8z M1900.6,1133.6l-52.8-52.8V1014 c10.3-3.8,17.6-13.8,17.6-25.4c0-15-12.2-27.1-27.1-27.1s-27.1,12.2-27.1,27.1 c0,11.7,7.5,21.8,17.9,25.5v74.3l71.5,73.1v82.5H1776V927.5h124.6V1133.6z M1838.3,999.7c-6.1,0-11.1-5-11.1-11.1c0-6.2,5-11.1,11.1-11.1s11.1,5,11.1,11.1 C1849.4,994.7,1844.4,999.7,1838.3,999.7z"/>
      </g>
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  </button>

  <!-- Panel -->
  <Transition name="chat-panel">
    <div v-if="isOpen" class="chat-panel">
      <!-- Header -->
      <div class="chat-panel-header">
        <div class="header-left">
          <span class="header-name">{{ venue?.name || 'Chat' }}</span>
        </div>
        <div class="header-right">
          <button class="header-close" @click="isOpen = false">&#10005;</button>
        </div>
      </div>

      <!-- Contact Form -->
      <ChatContactForm
        v-if="chatState === 'contact_form'"
        :venue-name="venue?.name"
        @submit="onContactSubmit"
      />

      <!-- Chat Area -->
      <template v-if="chatState === 'chatting' || chatState === 'limit_reached'">
        <ChatMessages
          ref="messagesRef"
          :messages="messages"
          :sending="sending"
          :venue-name="venue?.name"
          :visitor-name="visitor.name"
        />

        <!-- Limit banner -->
        <div v-if="chatState === 'limit_reached'" class="limit-banner">
          <p>Has alcanzado el límite de {{ freeLimit }} mensajes gratuitos.</p>
          <button class="limit-verify-btn" @click="chatState = 'verifying'">
            Verificar mi número para seguir
          </button>
        </div>

        <template v-else>
          <!-- Suggestion chips (before first interaction) -->
          <div v-if="suggestions.length > 0 && messages.length === 0 && !sending" class="suggestion-chips">
            <button
              v-for="chip in suggestions"
              :key="chip"
              class="chip"
              @click="onSendMessage(chip)"
            >
              {{ chip }}
            </button>
          </div>

          <ChatInput
            ref="inputRef"
            :sending="sending"
            @send="onSendMessage"
          />
        </template>
      </template>

      <!-- Verification -->
      <ChatVerification
        v-if="chatState === 'verifying'"
        :initial-phone="visitor.contactType === 'whatsapp' ? visitor.contactValue : ''"
        :conversation-id="conversationId"
        @verified="onVerified"
      />

      <!-- Loading state for restoring conversation -->
      <div v-if="chatState === 'loading'" class="chat-loading">
        <div class="loading-spinner"></div>
        <p>Cargando conversación...</p>
      </div>

      <!-- Footer -->
      <div class="chat-panel-footer">
        <span class="footer-text">Powered by</span>
        <img src="/logo-inverted.svg" alt="CabanIA" class="footer-logo-icon" />
        <img src="/logo-wordmark.svg" alt="CabanIA" class="footer-logo-wordmark" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import ChatContactForm from './ChatContactForm.vue'
import ChatMessages from './ChatMessages.vue'
import ChatInput from './ChatInput.vue'
import ChatVerification from './ChatVerification.vue'

const props = defineProps({
  venue: { type: Object, default: null },
  venueId: { type: String, required: true },
  skipContactForm: { type: Boolean, default: false },
  suggestions: { type: Array, default: () => [] }
})

const isOpen = ref(false)
const chatState = ref('contact_form') // contact_form | loading | chatting | limit_reached | verifying
const messages = ref([])
const sending = ref(false)
const conversationId = ref(null)
const freeLimit = ref(20)
const messageCount = ref(0)
const messagesRef = ref(null)
const inputRef = ref(null)

const visitor = reactive({
  name: '',
  contactType: 'whatsapp',
  contactValue: '',
  verified: false
})

const STORAGE_KEY = `cabania-chat-${props.venueId}`

// --- localStorage helpers ---
const loadStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // Migrate from legacy sessionStorage
    const legacy = sessionStorage.getItem(`public-chat-${props.venueId}`)
    if (legacy) {
      sessionStorage.removeItem(`public-chat-${props.venueId}`)
      return { conversationId: legacy }
    }
  } catch {}
  return null
}

const saveStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      conversationId: conversationId.value,
      visitor: { name: visitor.name, contactType: visitor.contactType, contactValue: visitor.contactValue },
      messageCount: messageCount.value,
      verified: visitor.verified,
      lastActivity: new Date().toISOString()
    }))
  } catch {}
}

// --- Restore conversation ---
const restoreConversation = async (convId) => {
  chatState.value = 'loading'
  try {
    const res = await fetch(`/api/public/chat/conversation/${convId}`)
    if (!res.ok) {
      chatState.value = props.skipContactForm ? 'chatting' : 'contact_form'
      return
    }
    const data = await res.json()
    conversationId.value = data.id
    messages.value = data.messages.map(m => ({ role: m.role, content: m.content }))
    messageCount.value = data.message_count
    freeLimit.value = data.free_limit
    visitor.verified = data.is_verified

    if (data.name) visitor.name = data.name

    if (!visitor.verified && messageCount.value >= freeLimit.value) {
      chatState.value = 'limit_reached'
    } else {
      chatState.value = 'chatting'
    }
    saveStorage()
  } catch {
    chatState.value = props.skipContactForm ? 'chatting' : 'contact_form'
  }
}

// --- Event handlers ---
const onContactSubmit = (data) => {
  visitor.name = data.name
  visitor.contactType = data.contactType
  visitor.contactValue = data.contactValue
  chatState.value = 'chatting'
  saveStorage()
  nextTick(() => inputRef.value?.focus())
}

const onSendMessage = async (text) => {
  if (!text.trim() || sending.value) return

  messages.value.push({ role: 'user', content: text })
  sending.value = true

  try {
    const body = {
      message: text,
      conversation_id: conversationId.value,
      source: 'web',
      contact_type: visitor.contactType || 'web',
      contact_value: visitor.contactValue || 'onboarding',
      visitor_name: visitor.name,
      visitor_phone: visitor.contactType === 'whatsapp' ? visitor.contactValue : undefined
    }

    const res = await fetch(`/api/chat/${props.venueId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    const result = await res.json()

    if (res.status === 403 && result.error === 'free_limit_reached') {
      messageCount.value = result.message_count
      freeLimit.value = result.free_limit
      chatState.value = 'limit_reached'
      messages.value.pop()
      saveStorage()
      return
    }

    if (res.ok) {
      if (result.conversation_id) {
        conversationId.value = result.conversation_id
      }

      let content = result.message || result.response || ''
      content = content.replace(/\n<!-- \{.*?\} -->/g, '')
      messages.value.push({ role: 'assistant', content })

      if (result.message_count !== undefined) {
        messageCount.value = result.message_count
      }
      if (result.free_limit !== undefined) {
        freeLimit.value = result.free_limit
      }
      if (result.is_verified) {
        visitor.verified = true
      }

      saveStorage()
    } else {
      messages.value.push({ role: 'assistant', content: 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.' })
    }
  } catch (err) {
    console.error('Chat send error:', err)
    messages.value.push({ role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' })
  } finally {
    sending.value = false
  }
}

const onVerified = () => {
  visitor.verified = true
  chatState.value = 'chatting'
  saveStorage()
  nextTick(() => inputRef.value?.focus())
}

// --- Public method: askQuestion (called from plan "Preguntar disponibilidad") ---
const askQuestion = (text) => {
  isOpen.value = true
  if (chatState.value === 'contact_form') {
    pendingQuestion.value = text
    return
  }
  setTimeout(() => {
    inputRef.value?.setMessage(text)
    onSendMessage(text)
  }, 150)
}
const pendingQuestion = ref('')

// Watch for transition from contact_form to chatting to send pending question
watch(chatState, (newState) => {
  if (newState === 'chatting' && pendingQuestion.value) {
    const q = pendingQuestion.value
    pendingQuestion.value = ''
    nextTick(() => onSendMessage(q))
  }
})

const emit = defineEmits(['panel-toggled'])

const togglePanel = () => {
  isOpen.value = !isOpen.value
  emit('panel-toggled', isOpen.value)
}

// --- Public method: startBookingChat (called after booking wizard completes) ---
const startBookingChat = (context) => {
  visitor.name = context.name
  visitor.contactType = context.contactType
  visitor.contactValue = context.contactValue

  if (chatState.value === 'contact_form') {
    chatState.value = 'chatting'
  }
  saveStorage()

  const checkOut = context.checkOut && context.checkOut !== context.checkIn ? ` al ${context.checkOut}` : ''
  const childrenText = context.children ? `, ${context.children} niño(s)` : ''
  const totalText = context.estimatedTotal
    ? ` (estimado: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(context.estimatedTotal)})`
    : ''
  const msg = `Hola, quisiera reservar el plan "${context.plan.name}" para el ${context.checkIn}${checkOut}, ${context.adults} adulto(s)${childrenText}${totalText}. Mi nombre es ${context.name}.`

  isOpen.value = true
  setTimeout(() => onSendMessage(msg), 200)
}

const open = () => {
  isOpen.value = true
}

defineExpose({ askQuestion, startBookingChat, open })

// --- Init ---
onMounted(() => {
  // If skipContactForm, go directly to chatting state
  if (props.skipContactForm) {
    chatState.value = 'chatting'
  }

  const stored = loadStorage()
  if (stored) {
    if (stored.visitor) {
      visitor.name = stored.visitor.name || ''
      visitor.contactType = stored.visitor.contactType || 'whatsapp'
      visitor.contactValue = stored.visitor.contactValue || ''
    }
    visitor.verified = stored.verified || false
    messageCount.value = stored.messageCount || 0

    if (stored.conversationId) {
      conversationId.value = stored.conversationId
    }

    if (stored.visitor?.name || props.skipContactForm) {
      chatState.value = 'chatting'
    }
  }
})

// Lazy-load conversation when panel opens for the first time with a stored conversationId
const hasRestored = ref(false)
watch(isOpen, async (open) => {
  document.body.classList.toggle('chat-panel-open', open)
  if (open && !hasRestored.value && conversationId.value) {
    hasRestored.value = true
    await restoreConversation(conversationId.value)
  }
})

onUnmounted(() => {
  document.body.classList.remove('chat-panel-open')
})
</script>

<style scoped>
/* Bubble button */
.chat-bubble-btn {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
  z-index: 10003;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.chat-bubble-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
}

.chat-bubble-btn.is-open {
  background: #64748b;
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
}

/* Panel */
.chat-panel {
  position: fixed;
  bottom: 5.5rem;
  right: 1.5rem;
  width: 380px;
  max-width: calc(100vw - 2rem);
  max-height: 70vh;
  background: var(--cabania-surface-bg, rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--cabania-border, rgba(0, 0, 0, 0.08));
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.1) inset;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10004;
}

/* Panel header */
.chat-panel-header {
  padding: 0.6rem 0.85rem;
  background: var(--cabania-card-bg, rgba(255, 255, 255, 0.65));
  border-bottom: 1px solid var(--cabania-border-subtle, rgba(0, 0, 0, 0.05));
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--cabania-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.header-close {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--cabania-text-muted, #64748b);
  padding: 0.25rem;
  line-height: 1;
  border-radius: 50%;
  transition: background 0.2s;
}

.header-close:hover {
  background: var(--cabania-hover-bg, rgba(0, 0, 0, 0.03));
}

/* Panel footer */
.chat-panel-footer {
  padding: 0.4rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-top: 1px solid var(--cabania-border-subtle, rgba(0, 0, 0, 0.05));
  flex-shrink: 0;
}

.footer-text {
  font-size: 0.7rem;
  color: var(--cabania-text-muted, #94a3b8);
}

.footer-logo-icon {
  height: 14px;
  width: 14px;
  border-radius: 0.2rem;
  object-fit: contain;
  opacity: 0.6;
}

.footer-logo-wordmark {
  height: 12px;
  width: auto;
  opacity: 0.5;
}

/* Limit banner */
.limit-banner {
  padding: 0.85rem 1rem;
  background: rgba(245, 158, 11, 0.08);
  border-top: 1px solid rgba(245, 158, 11, 0.2);
  text-align: center;
  flex-shrink: 0;
}

.limit-banner p {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #92400e;
}

.limit-verify-btn {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.limit-verify-btn:hover {
  opacity: 0.9;
}

/* Loading */
.chat-loading {
  padding: 2rem;
  text-align: center;
  color: var(--cabania-text-muted, #64748b);
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Panel transitions */
.chat-panel-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-panel-leave-active {
  transition: all 0.2s ease-in;
}

.chat-panel-enter-from {
  opacity: 0;
  transform: translateY(1rem) scale(0.95);
}

.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.98);
}

/* Suggestion chips */
.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0.5rem 0.85rem;
  border-top: 1px solid var(--cabania-border-subtle, rgba(0, 0, 0, 0.05));
}

.chip {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #059669;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.3;
}

.chip:hover {
  background: rgba(16, 185, 129, 0.18);
  border-color: #10b981;
}

/* Mobile */
@media (max-width: 640px) {
  .chat-bubble-btn {
    bottom: 1rem;
    right: 1rem;
    width: 50px;
    height: 50px;
    font-size: 1.3rem;
  }

  .chat-panel {
    bottom: 4.5rem;
    right: 0.75rem;
    left: 0.75rem;
    width: auto;
    max-height: 75vh;
    border-radius: 1rem;
  }
}

/* Hide page header on mobile when chat is open */
@media (max-width: 640px) {
  :global(body.chat-panel-open .public-header) {
    display: none;
  }
}
</style>
