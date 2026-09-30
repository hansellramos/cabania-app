<template>
  <CNavItem>
    <CNavLink href="javascript:void(0)" title="Asistente" @click="open = true">
      <span class="assistant-trigger">✨</span>
    </CNavLink>
  </CNavItem>

  <COffcanvas :visible="open" placement="end" class="assistant-panel" @hide="open = false">
    <COffcanvasHeader class="border-bottom">
      <COffcanvasTitle>✨ Asistente</COffcanvasTitle>
      <div class="d-flex gap-2 align-items-center">
        <CButton v-if="messages.length" color="link" size="sm" class="p-0 text-decoration-none" @click="reset">Nueva conversación</CButton>
        <CCloseButton class="text-reset" @click="open = false" />
      </div>
    </COffcanvasHeader>
    <COffcanvasBody class="d-flex flex-column p-0">
      <div ref="scroller" class="flex-grow-1 overflow-auto p-3">
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
            class="d-inline-block px-3 py-2 rounded-3 small text-start assistant-bubble"
            :class="m.role === 'user' ? 'bg-primary text-white' : 'bg-body-tertiary'"
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

      <form class="border-top p-2 d-flex gap-2" @submit.prevent="send()">
        <CFormTextarea
          v-model="draft"
          rows="2"
          placeholder="Escribe tu pregunta…"
          :disabled="thinking"
          @keydown.enter.exact.prevent="send()"
        />
        <CButton type="submit" color="primary" :disabled="thinking || !draft.trim()">Enviar</CButton>
      </form>
    </COffcanvasBody>
  </COffcanvas>
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
.assistant-trigger {
  font-size: 1.15rem;
  line-height: 1;
}
.assistant-panel {
  width: 420px;
  max-width: 100vw;
}
.assistant-bubble {
  max-width: 92%;
}
.assistant-md :deep(p) {
  margin-bottom: 0.4rem;
}
.assistant-md :deep(ul),
.assistant-md :deep(ol) {
  padding-left: 1.1rem;
  margin-bottom: 0.4rem;
}
</style>
