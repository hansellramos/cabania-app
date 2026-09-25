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

        <!-- Payment card: QR (computer, or when asked) + pay button + plain link fallback -->
        <div v-if="msg.payment && msg.payment.paid" class="pay-card">
          <p class="pay-paid">✅ Pagado</p>
        </div>
        <div v-else-if="msg.payment" class="pay-card">
          <template v-if="msg.payment.qr_image_url">
            <template v-if="!qrExpired(msg.payment)">
              <img :src="msg.payment.qr_image_url" class="pay-qr" alt="Código QR para pagar con Bre-B" />
              <p class="pay-hint">Escanéalo con la app de tu banco (Bre-B).</p>
              <a :href="msg.payment.qr_download_url" class="pay-download" download>Descargar QR</a>
            </template>
            <p v-else class="pay-hint">El QR venció. Pídeme uno nuevo si quieres pagar con Bre-B.</p>
          </template>
          <a :href="msg.payment.url" class="pay-button" target="_blank" rel="noopener">
            {{ msg.payment.button_text || 'Pagar' }}
          </a>
          <p class="pay-fallback">
            Si el botón no abre, copia este enlace en tu navegador para pagar de forma segura con Bold:
            <span class="pay-url">{{ msg.payment.url }}</span>
          </p>
          <p v-if="msg.payment.merchant" class="pay-fallback">
            El cobro aparece a nombre de {{ msg.payment.merchant }}.
          </p>
        </div>
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

const qrExpired = (payment) =>
  !!payment.qr_expires_at && new Date(payment.qr_expires_at).getTime() < Date.now()

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

/* Payment card */
.pay-card {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.45rem;
}

.pay-qr {
  width: 180px;
  max-width: 100%;
  align-self: center;
  border-radius: 8px;
  background: #fff;
  padding: 6px;
}

.pay-hint {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--cabania-text-secondary, #475569);
}

.pay-download {
  align-self: center;
  font-size: 0.8rem;
  color: #0d9488;
  text-decoration: underline;
}

.pay-button {
  display: block;
  text-align: center;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #1AA15F, #2B6FDF);
  color: #fff !important;
  font-weight: 600;
  text-decoration: none;
}

.pay-button:hover { filter: brightness(1.05); }

.pay-paid {
  margin: 0;
  text-align: center;
  font-weight: 600;
  color: #10b981;
}

.pay-fallback {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--cabania-text-muted, #64748b);
}

.pay-url {
  display: block;
  word-break: break-all;
  user-select: all;
}

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
