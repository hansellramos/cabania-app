<template>
  <div class="chat-contact-form">
    <div class="form-header">
      <h4>Antes de empezar</h4>
      <p>Ingresa tu nombre y un medio de contacto para poder atenderte mejor.</p>
    </div>
    <form @submit.prevent="handleSubmit">
      <div class="form-field">
        <label>Nombre *</label>
        <input
          v-model="name"
          type="text"
          placeholder="Tu nombre"
          required
          class="field-input"
        />
      </div>
      <div class="form-field">
        <label>Medio de contacto *</label>
        <div class="contact-toggle">
          <button
            type="button"
            :class="['toggle-btn', { active: contactType === 'whatsapp' }]"
            @click="contactType = 'whatsapp'"
          >
            WhatsApp
          </button>
          <button
            type="button"
            :class="['toggle-btn', { active: contactType === 'instagram' }]"
            @click="contactType = 'instagram'"
          >
            Instagram
          </button>
        </div>
        <input
          v-model="contactValue"
          :type="contactType === 'whatsapp' ? 'tel' : 'text'"
          :placeholder="contactType === 'whatsapp' ? 'Ej: 3001234567' : 'Ej: @tuusuario'"
          required
          class="field-input"
        />
      </div>
      <button type="submit" class="submit-btn" :disabled="!isValid">
        Iniciar chat
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({ venueName: String })
const emit = defineEmits(['submit'])

const name = ref('')
const contactType = ref('whatsapp')
const contactValue = ref('')

const isValid = computed(() => {
  return name.value.trim().length > 0 && contactValue.value.trim().length > 0
})

const handleSubmit = () => {
  if (!isValid.value) return
  emit('submit', {
    name: name.value.trim(),
    contactType: contactType.value,
    contactValue: contactValue.value.trim()
  })
}
</script>

<style scoped>
.chat-contact-form {
  padding: 1.25rem;
}

.form-header h4 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--cabania-text, #0f172a);
}

.form-header p {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--cabania-text-muted, #64748b);
}

.form-field {
  margin-bottom: 0.85rem;
}

.form-field label {
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
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--cabania-focus-border, rgba(14,165,233,0.4));
  box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
}

.contact-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.toggle-btn {
  flex: 1;
  padding: 0.4rem;
  border: 1.5px solid var(--cabania-border, rgba(0,0,0,0.08));
  border-radius: 0.5rem;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--cabania-text-muted, #64748b);
  transition: all 0.2s;
}

.toggle-btn.active {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.3);
  color: #059669;
}

.submit-btn {
  width: 100%;
  padding: 0.65rem;
  border: none;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
