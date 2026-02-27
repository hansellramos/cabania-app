<template>
  <div class="chat-messages" ref="container">
    <div v-if="messages.length === 0" class="chat-empty">
      <p>👋 ¡Hola, <strong>{{ visitorName }}</strong>!</p>
      <p class="text-muted">Pregúntame lo que quieras sobre <strong>{{ venueName }}</strong>.</p>
    </div>
    <div
      v-for="(msg, idx) in messages"
      :key="idx"
      :class="['msg-row', msg.role === 'user' ? 'msg-user' : 'msg-bot']"
    >
      <div :class="['msg-bubble', msg.role === 'user' ? 'bubble-user' : 'bubble-bot']">
        <div class="msg-text" v-html="formatMessage(msg.content)"></div>
      </div>
    </div>
    <div v-if="sending" class="msg-row msg-bot">
      <div class="msg-bubble bubble-bot typing">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  sending: Boolean,
  venueName: String,
  visitorName: { type: String, default: '' }
})

const container = ref(null)

const formatMessage = (text) => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

const scrollToBottom = async () => {
  await nextTick()
  if (container.value) {
    container.value.scrollTop = container.value.scrollHeight
  }
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.sending, scrollToBottom)
onMounted(scrollToBottom)

defineExpose({ scrollToBottom })
</script>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  min-height: 0;
}

.chat-empty {
  text-align: center;
  padding: 2rem 0.5rem;
  color: var(--cabania-text-secondary, #475569);
  font-size: 0.9rem;
}

.chat-empty p {
  margin: 0.2rem 0;
}

.chat-empty .text-muted {
  color: var(--cabania-text-muted, #64748b);
  font-size: 0.85rem;
}

.msg-row {
  display: flex;
  margin-bottom: 0.6rem;
}

.msg-user { justify-content: flex-end; }
.msg-bot { justify-content: flex-start; }

.msg-bubble {
  max-width: 85%;
  padding: 0.55rem 0.85rem;
  border-radius: 14px;
  font-size: 0.88rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.bubble-user {
  background: #10b981;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble-bot {
  background: var(--cabania-card-bg, rgba(255,255,255,0.65));
  color: var(--cabania-text, #1e293b);
  border: 1px solid var(--cabania-border, rgba(0,0,0,0.08));
  border-bottom-left-radius: 4px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.msg-text { word-break: break-word; }

/* Typing indicator */
.typing {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 0.7rem 1rem;
}

.dot {
  width: 7px;
  height: 7px;
  background: #94a3b8;
  border-radius: 50%;
  animation: dotPulse 1.2s infinite ease-in-out;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>
