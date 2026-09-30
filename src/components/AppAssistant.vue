<template>
  <Teleport to="body">
    <!-- Floating bubble, bottom right (like the air-school chat) -->
    <button
      v-show="!open"
      type="button"
      class="assistant-bubble-btn"
      title="Asistente"
      aria-label="Abrir el asistente"
      @click="open = true"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
    </button>

    <!-- Chat window: anchored bottom right on desktop, full screen on phones -->
    <section v-if="open" class="assistant-window" role="dialog" aria-label="Asistente">
      <header class="assistant-header">
        <strong>✨ Asistente</strong>
        <div class="d-flex gap-2 align-items-center">
          <CButton v-if="messages.length" color="link" size="sm" class="p-0 text-decoration-none text-white" @click="reset">Nueva conversación</CButton>
          <button type="button" class="assistant-close" aria-label="Cerrar" @click="open = false">&times;</button>
        </div>
      </header>

      <div ref="scroller" class="assistant-body">
        <div v-if="!messages.length" class="text-body-secondary small">
          <p class="mb-2">
            Pregúntame por tus alquileres, pagos, chats o comisiones, y te llevo a la pantalla que necesites.
          </p>
          <div class="d-flex flex-wrap gap-2">
            <CButton
              v-for="s in suggestions"
              :key="s"
              color="secondary"
              variant="outline"
              size="sm"
              class="text-start"
              @click="send(s)"
            >{{ s }}</CButton>
          </div>
        </div>

        <div v-for="(m, i) in messages" :key="i" class="mb-3" :class="m.role === 'user' ? 'text-end' : ''">
          <div
            class="d-inline-block px-3 py-2 rounded-3 small text-start assistant-msg"
            :class="m.role === 'user' ? 'assistant-msg--user' : 'bg-body-tertiary'"
          >
            <div v-if="m.role === 'user'" style="white-space: pre-line">{{ m.content }}</div>
            <div v-else class="assistant-md" v-html="renderMarkdown(m.content)"></div>
            <div v-if="m.actions?.length" class="d-flex flex-wrap gap-2 mt-2">
              <CButton
                v-for="a in m.actions"
                :key="a.path"
                color="primary"
                size="sm"
                variant="outline"
                @click="go(a.path)"
              >{{ a.label }} →</CButton>
            </div>
          </div>
        </div>
        <div v-if="thinking" class="small text-body-secondary">
          <CSpinner size="sm" class="me-2" />Pensando…
        </div>
        <div v-if="error" class="small text-danger">{{ error }}</div>
      </div>

      <form class="assistant-input" @submit.prevent="send()">
        <CFormTextarea
          v-model="draft"
          rows="2"
          placeholder="Escribe tu pregunta…"
          :disabled="thinking"
          @keydown.enter.exact.prevent="send()"
        />
        <CButton type="submit" color="primary" :disabled="thinking || !draft.trim()">Enviar</CButton>
      </form>
    </section>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { renderMarkdown } from '@/utils/contractMarkdown'

const route = useRoute()
const router = useRouter()
const STORAGE_KEY = 'cabania.assistant.messages'

const open = ref(false)
const draft = ref('')
const thinking = ref(false)
const error = ref('')
const scroller = ref(null)
const messages = ref(loadMessages())

const suggestions = [
  '¿Qué alquileres tengo este fin de semana?',
  '¿Qué reservas próximas tienen saldo pendiente?',
  '¿Cuánto he recibido este mes?',
  '¿Qué chats están esperando respuesta?',
  '¿Cuánto les debo a los comisionistas?',
  '¿Qué contratos faltan por firmar?'
]

// The conversation survives page changes and reloads in this tab only.
function loadMessages() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}
watch(messages, (value) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value.slice(-40)))
  } catch {
    // Storage unavailable: the chat still works for this page.
  }
}, { deep: true })

function scrollDown() {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}
watch(open, (value) => { if (value) scrollDown() })

function go(path) {
  router.push(path)
  // Full screen on phones: close it so the opened screen is visible.
  if (window.matchMedia('(max-width: 575.98px)').matches) open.value = false
}

function reset() {
  messages.value = []
  error.value = ''
}

async function send(text) {
  const content = String(text ?? draft.value).trim()
  if (!content || thinking.value) return
  draft.value = ''
  error.value = ''
  messages.value.push({ role: 'user', content })
  thinking.value = true
  scrollDown()
  try {
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.value.map(m => ({ role: m.role, content: m.content })),
        context: { path: route.fullPath }
      })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'El asistente no respondió')
    messages.value.push({ role: 'assistant', content: data.reply, actions: data.actions || [] })
    // When the user asked to see something, the assistant takes them there.
    const toOpen = (data.actions || []).find(a => a.open)
    if (toOpen) go(toOpen.path)
  } catch (err) {
    error.value = err.message
  } finally {
    thinking.value = false
    scrollDown()
  }
}
</script>

<style scoped>
.assistant-bubble-btn {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--cabania-gradient, var(--cui-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  z-index: 1045;
  transition: transform 0.2s;
}
.assistant-bubble-btn:hover {
  transform: scale(1.08);
}
.assistant-window {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  width: 400px;
  height: min(600px, calc(100vh - 2.5rem));
  display: flex;
  flex-direction: column;
  background: var(--cui-body-bg);
  color: var(--cui-body-color);
  border: 1px solid var(--cui-border-color);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  z-index: 1046;
}
.assistant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.9rem;
  background: var(--cabania-gradient, var(--cui-primary));
  color: #fff;
}
.assistant-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}
.assistant-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.9rem;
}
.assistant-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-top: 1px solid var(--cui-border-color);
}
.assistant-input :deep(textarea) {
  font-size: 16px; /* no iOS zoom on focus */
  resize: none;
}
.assistant-msg {
  max-width: 92%;
}
.assistant-msg--user {
  background: var(--cui-primary);
  color: #fff;
}
.assistant-md :deep(p) {
  margin-bottom: 0.4rem;
}
.assistant-md :deep(ul),
.assistant-md :deep(ol) {
  padding-left: 1.1rem;
  margin-bottom: 0.4rem;
}
/* Phones: full screen, like the air-school chat */
@media (max-width: 575.98px) {
  .assistant-window {
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
    border: none;
  }
  .assistant-bubble-btn {
    right: 0.9rem;
    bottom: 0.9rem;
    width: 52px;
    height: 52px;
  }
}
</style>
