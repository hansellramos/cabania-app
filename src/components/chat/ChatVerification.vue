<template>
  <div class="verification-view">
    <div v-if="step === 'confirm'" class="verify-step">
      <h4>Verificación requerida</h4>
      <p>Has alcanzado el límite de mensajes gratuitos. Confirma tu número para seguir chateando.</p>
      <div class="phone-field">
        <label>Número de WhatsApp</label>
        <input
          v-model="phone"
          type="tel"
          placeholder="3001234567"
          class="field-input"
        />
      </div>
      <button
        class="verify-btn"
        :disabled="!phone.trim() || requesting"
        @click="requestCode"
      >
        {{ requesting ? 'Enviando...' : 'Enviar código de verificación' }}
      </button>
      <p v-if="requestError" class="error-text">{{ requestError }}</p>
    </div>

    <div v-else-if="step === 'code'" class="verify-step">
      <h4>Ingresa el código</h4>
      <p>Se envió un código de 6 dígitos al <strong>{{ phone }}</strong></p>
      <div class="code-input-group">
        <input
          v-for="i in 6"
          :key="i"
          ref="codeInputs"
          v-model="codeDigits[i - 1]"
          type="text"
          maxlength="1"
          inputmode="numeric"
          class="code-digit"
          @input="onDigitInput(i - 1)"
          @keydown.backspace="onBackspace(i - 1, $event)"
          @paste.prevent="onPaste"
        />
      </div>
      <button class="paste-btn" @click="pasteFromClipboard">
        Pegar código
      </button>
      <div class="code-actions">
        <button
          class="verify-btn"
          :disabled="fullCode.length < 6 || confirming"
          @click="confirmCode"
        >
          {{ confirming ? 'Verificando...' : 'Verificar' }}
        </button>
      </div>
      <p v-if="codeError" class="error-text">{{ codeError }}</p>
      <p v-if="expiresIn > 0" class="timer-text">
        Código expira en {{ Math.floor(expiresIn / 60) }}:{{ String(expiresIn % 60).padStart(2, '0') }}
      </p>
      <button class="link-btn" @click="step = 'confirm'">Cambiar número o reenviar código</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  initialPhone: { type: String, default: '' },
  conversationId: { type: String, required: true }
})

const emit = defineEmits(['verified', 'cancel'])

const step = ref('confirm')
const phone = ref(props.initialPhone)
const requesting = ref(false)
const requestError = ref('')
const confirming = ref(false)
const codeError = ref('')
const codeDigits = ref(['', '', '', '', '', ''])
const codeInputs = ref([])
const expiresIn = ref(0)
let timerInterval = null

const fullCode = computed(() => codeDigits.value.join(''))

const requestCode = async () => {
  if (!phone.value.trim()) return
  requesting.value = true
  requestError.value = ''

  try {
    const res = await fetch('/api/public/chat/verify/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: props.conversationId,
        phone: phone.value.trim()
      })
    })
    const data = await res.json()
    if (!res.ok) {
      requestError.value = data.error || 'Error al solicitar código'
      return
    }
    if (data.code) {
      const digits = data.code.split('')
      codeDigits.value = digits
    }
    step.value = 'code'
    expiresIn.value = 600
    startTimer()
  } catch (err) {
    requestError.value = 'Error de conexión'
  } finally {
    requesting.value = false
  }
}

const confirmCode = async () => {
  if (fullCode.value.length < 6) return
  confirming.value = true
  codeError.value = ''

  try {
    const res = await fetch('/api/public/chat/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: props.conversationId,
        code: fullCode.value
      })
    })
    const data = await res.json()
    if (!res.ok) {
      codeError.value = data.error || 'Error al verificar'
      if (data.attempts_remaining !== undefined) {
        codeError.value += ` (${data.attempts_remaining} intentos restantes)`
      }
      return
    }
    emit('verified')
  } catch (err) {
    codeError.value = 'Error de conexión'
  } finally {
    confirming.value = false
  }
}

const onDigitInput = (idx) => {
  const val = codeDigits.value[idx]
  if (val && idx < 5 && codeInputs.value[idx + 1]) {
    codeInputs.value[idx + 1].focus()
  }
}

const onBackspace = (idx, event) => {
  if (!codeDigits.value[idx] && idx > 0) {
    codeInputs.value[idx - 1].focus()
  }
}

const onPaste = (event) => {
  const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
  if (text.length > 0) {
    codeDigits.value = text.padEnd(6, '').split('').slice(0, 6)
  }
}

const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    const digits = text.replace(/\D/g, '').slice(0, 6)
    if (digits.length > 0) {
      codeDigits.value = digits.padEnd(6, '').split('').slice(0, 6)
    }
  } catch (err) {
    // Clipboard API may not be available
  }
}

const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (expiresIn.value > 0) {
      expiresIn.value--
    } else {
      clearInterval(timerInterval)
    }
  }, 1000)
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<style scoped>
.verification-view {
  padding: 1.25rem;
}

.verify-step h4 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--cabania-text, #0f172a);
}

.verify-step p {
  font-size: 0.85rem;
  color: var(--cabania-text-secondary, #475569);
  margin: 0 0 0.75rem;
}

.phone-field {
  margin-bottom: 0.85rem;
}

.phone-field label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--cabania-text-secondary, #475569);
  margin-bottom: 0.3rem;
}

.field-input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--cabania-border, rgba(0,0,0,0.08));
  border-radius: 0.5rem;
  font-size: 0.9rem;
  background: var(--cabania-input-bg, rgba(255,255,255,0.6));
  color: var(--cabania-text, #0f172a);
  outline: none;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--cabania-focus-border, rgba(14,165,233,0.4));
  box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
}

.code-input-group {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.code-digit {
  width: 2.5rem;
  height: 2.8rem;
  text-align: center;
  font-size: 1.25rem;
  font-weight: 700;
  border: 1.5px solid var(--cabania-border, rgba(0,0,0,0.08));
  border-radius: 0.5rem;
  background: var(--cabania-input-bg, rgba(255,255,255,0.6));
  color: var(--cabania-text, #0f172a);
  outline: none;
}

.code-digit:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
}

.paste-btn {
  display: block;
  margin: 0 auto 0.75rem;
  border: 1px solid var(--cabania-border, rgba(0,0,0,0.08));
  background: transparent;
  color: var(--cabania-text-secondary, #475569);
  padding: 0.35rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s;
}

.paste-btn:hover {
  background: var(--cabania-hover-bg, rgba(0,0,0,0.03));
}

.code-actions {
  margin-bottom: 0.5rem;
}

.verify-btn {
  width: 100%;
  padding: 0.6rem;
  border: none;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.verify-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  color: #ef4444;
  font-size: 0.8rem;
  text-align: center;
}

.timer-text {
  text-align: center;
  font-size: 0.8rem;
  color: var(--cabania-text-muted, #64748b);
}

.link-btn {
  display: block;
  margin: 0.25rem auto 0;
  background: none;
  border: none;
  color: #0284c7;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
}
</style>
