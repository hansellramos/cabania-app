<template>
  <div>
    <div class="d-flex flex-wrap gap-2 mb-2">
      <CButtonGroup role="group" size="sm" aria-label="Tipo de dato">
        <CButton
          v-for="k in KINDS"
          :key="k.value"
          type="button"
          color="primary"
          :variant="kind === k.value ? undefined : 'outline'"
          :aria-pressed="kind === k.value"
          @click="setKind(k.value)"
        >
          <CIcon :icon="k.icon" size="sm" class="me-1" />{{ k.label }}
        </CButton>
      </CButtonGroup>
      <CButtonGroup role="group" size="sm" aria-label="Medio">
        <CButton
          v-for="c in channelsOfKind"
          :key="c"
          type="button"
          :color="CONTACT_CHANNELS[c].color"
          :variant="channel === c ? undefined : 'outline'"
          :aria-pressed="channel === c"
          @click="setChannel(c)"
        >
          <CIcon :icon="CONTACT_CHANNELS[c].icon" size="sm" class="me-1" />{{ CONTACT_CHANNELS[c].label }}
        </CButton>
      </CButtonGroup>
    </div>
    <CFormInput
      :id="inputId"
      :model-value="value"
      :type="kind === 'phone' ? 'tel' : 'text'"
      :inputmode="kind === 'phone' ? 'tel' : 'text'"
      autocapitalize="off"
      autocomplete="off"
      :placeholder="placeholder"
      :required="required"
      :invalid="!!error"
      :feedback-invalid="error"
      @update:model-value="onInput"
    />
  </div>
</template>

<script setup>
// How to reach a guest: first by phone or by username, then the channel. The value
// goes to the contact field of that channel (phone → whatsapp, WhatsApp user →
// whatsapp_username, instagram, facebook) and the choice to contact_channel.
import { computed } from 'vue'
import { CButton, CButtonGroup, CFormInput } from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { CONTACT_CHANNELS, channelError, initialChannel, looksLikeWhatsappUsername } from '@/utils/contactLinks'

const props = defineProps({
  modelValue: { type: Object, required: true },
  required: { type: Boolean, default: false },
  inputId: { type: String, default: undefined },
})
const emit = defineEmits(['update:modelValue'])

const KINDS = [
  { value: 'phone', label: 'Teléfono', icon: 'cilPhone' },
  { value: 'user', label: 'Usuario', icon: 'cilAt' },
]
const PLACEHOLDERS = {
  phone: 'Ej: 3001234567',
  whatsapp_user: '@usuario de WhatsApp',
  instagram: '@usuario o enlace del perfil de Instagram',
  facebook: 'Usuario o enlace del perfil de Facebook',
}

const channel = computed(() => initialChannel(props.modelValue))
const kind = computed(() => CONTACT_CHANNELS[channel.value].kind)
const field = computed(() => CONTACT_CHANNELS[channel.value].field)
const channelsOfKind = computed(() => Object.keys(CONTACT_CHANNELS).filter(c => CONTACT_CHANNELS[c].kind === kind.value))
const value = computed(() => props.modelValue[field.value] ?? '')
const placeholder = computed(() => PLACEHOLDERS[kind.value === 'phone' ? 'phone' : channel.value])
const error = computed(() => channelError(channel.value, value.value))

function update(changes) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}

// Values the contact had when the form opened: those never move to another field.
const saved = { ...props.modelValue }

/** Switch channel; a username just typed for one network follows to the new one if that one is empty. */
function setChannel(next) {
  const nextField = CONTACT_CHANNELS[next].field
  const changes = { contact_channel: next }
  const typed = value.value && value.value !== (saved[field.value] ?? '')
  if (CONTACT_CHANNELS[next].kind === kind.value && nextField !== field.value && typed && !props.modelValue[nextField]) {
    changes[nextField] = value.value
    changes[field.value] = saved[field.value] ?? ''
  }
  update(changes)
}

function setKind(next) {
  if (next === kind.value) return
  setChannel(next === 'phone' ? 'whatsapp' : 'whatsapp_user')
}

function onInput(text) {
  // A username typed in the phone field: switch to WhatsApp user and keep the text.
  if (kind.value === 'phone' && looksLikeWhatsappUsername(text)) {
    update({ contact_channel: 'whatsapp_user', whatsapp: '', whatsapp_username: props.modelValue.whatsapp_username || text.trim() })
    return
  }
  update({ [field.value]: text, contact_channel: channel.value })
}
</script>
