<template>
  <CCard class="mb-4">
    <CCardHeader class="d-flex justify-content-between align-items-center">
      <strong>✨ Agentes de IA</strong>
      <CButton color="primary" size="sm" @click="openCreate">Conectar un agente</CButton>
    </CCardHeader>
    <CCardBody>
      <p class="small text-body-secondary">
        Conecta Claude, ChatGPT u otro agente de IA a CabanIA para que consulte tus alquileres, pagos y chats
        (y, si lo permites, cree cotizaciones y alquileres o registre pagos). Cada key actúa con tus permisos.
      </p>

      <div v-if="loading" class="text-center py-3"><CSpinner size="sm" color="primary" /></div>
      <div v-else-if="error" class="text-danger small">{{ error }}</div>
      <p v-else-if="!keys.length" class="text-body-secondary small mb-0">No has conectado ningún agente.</p>

      <CListGroup v-else flush>
        <CListGroupItem v-for="k in keys" :key="k.id" class="d-flex justify-content-between align-items-center px-0">
          <div>
            <strong>{{ k.name }}</strong>
            <CBadge :color="k.can_write ? 'warning' : 'secondary'" class="ms-2">
              {{ k.can_write ? 'Consulta y cambia' : 'Solo consulta' }}
            </CBadge>
            <small class="d-block text-body-secondary">
              <code>{{ k.prefix }}…</code> · Creada {{ formatDate(k.created_at) }}
              <template v-if="k.last_used_at"> · Último uso {{ formatDate(k.last_used_at) }}</template>
              <template v-else> · Sin usar</template>
            </small>
          </div>
          <CButton color="danger" variant="ghost" size="sm" title="Revocar" aria-label="Revocar" @click="revoke(k)">
            <CIcon icon="cil-trash" />
          </CButton>
        </CListGroupItem>
      </CListGroup>
    </CCardBody>
  </CCard>

  <CModal teleport :visible="showModal" size="lg" alignment="center" backdrop="static" @close="closeModal">
    <CModalHeader>
      <CModalTitle>{{ created ? 'Listo: pégale esto a tu agente' : 'Conectar un agente de IA' }}</CModalTitle>
    </CModalHeader>

    <CModalBody v-if="!created">
      <CFormLabel for="agent-key-name">Nombre</CFormLabel>
      <CFormInput
        id="agent-key-name"
        v-model="form.name"
        placeholder="Ej: Claude de mi computador, ChatGPT"
        maxlength="100"
        @keyup.enter="create"
      />
      <CFormCheck
        id="agent-key-write"
        v-model="form.can_write"
        class="mt-3"
        label="Permitir cambios: crear cotizaciones, crear y corregir alquileres, registrar pagos, marcar no asistencia y cancelar alquileres"
      />
      <p class="small text-body-secondary mt-2 mb-0">
        Sin esto el agente solo puede consultar. Los pagos que registre quedan sin verificar hasta que alguien los revise.
      </p>
      <div v-if="createError" class="text-danger small mt-2">{{ createError }}</div>
    </CModalBody>

    <CModalBody v-else>
      <CAlert color="warning" class="small py-2">
        Copia la key ahora: por seguridad no se vuelve a mostrar. Si la pierdes, revócala y crea otra.
      </CAlert>

      <div class="d-flex justify-content-between align-items-center mb-1">
        <strong class="small">Texto para tu agente</strong>
        <CButton color="primary" size="sm" @click="copy(created.prompt, 'prompt')">
          {{ copied === 'prompt' ? '¡Copiado!' : 'Copiar' }}
        </CButton>
      </div>
      <pre class="agent-key-block">{{ created.prompt }}</pre>

      <details class="mt-3">
        <summary class="small fw-semibold">Claude Code o Claude Desktop (MCP)</summary>
        <div class="d-flex justify-content-end mt-2">
          <CButton color="secondary" variant="outline" size="sm" @click="copy(mcpCommand, 'mcp')">
            {{ copied === 'mcp' ? '¡Copiado!' : 'Copiar comando' }}
          </CButton>
        </div>
        <pre class="agent-key-block mt-1">{{ mcpCommand }}</pre>
      </details>

      <details class="mt-2">
        <summary class="small fw-semibold">ChatGPT (GPT personalizado)</summary>
        <ol class="small mt-2 mb-0">
          <li>En tu GPT: Configurar → Acciones → Crear nueva acción → Importar desde URL: <code>{{ openapiUrl }}</code></li>
          <li>Autenticación: Clave de API, tipo <em>Bearer</em>, y pega la key.</li>
        </ol>
      </details>

      <div class="d-flex justify-content-between align-items-center mt-3 mb-1">
        <strong class="small">Solo la key</strong>
        <CButton color="secondary" variant="outline" size="sm" @click="copy(created.key, 'key')">
          {{ copied === 'key' ? '¡Copiada!' : 'Copiar key' }}
        </CButton>
      </div>
      <pre class="agent-key-block">{{ created.key }}</pre>
    </CModalBody>

    <CModalFooter>
      <template v-if="!created">
        <CButton color="secondary" variant="outline" @click="closeModal">Cancelar</CButton>
        <CButton color="primary" :disabled="creating || !form.name.trim()" @click="create">
          <CSpinner v-if="creating" size="sm" class="me-1" />Crear key
        </CButton>
      </template>
      <CButton v-else color="primary" @click="closeModal">Ya la copié</CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const keys = ref([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const form = reactive({ name: '', can_write: false })
const creating = ref(false)
const createError = ref('')
const created = ref(null)
const copied = ref('')

const openapiUrl = computed(() => created.value?.urls?.openapi || `${window.location.origin}/api/agent/openapi.json`)
const mcpCommand = computed(() => created.value
  ? `claude mcp add --transport http cabania ${created.value.urls?.mcp || `${window.location.origin}/api/agent/mcp`} --header "Authorization: Bearer ${created.value.key}"`
  : '')

const formatDate = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/agent-keys', { credentials: 'include' })
    if (!res.ok) throw new Error('No se pudieron cargar las keys')
    keys.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.name = ''
  form.can_write = false
  createError.value = ''
  created.value = null
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  // Forget the key as soon as the window closes.
  created.value = null
  copied.value = ''
}

async function create() {
  if (!form.name.trim() || creating.value) return
  creating.value = true
  createError.value = ''
  try {
    const res = await fetch('/api/agent-keys', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), can_write: form.can_write })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo crear la key')
    created.value = data
    await load()
  } catch (err) {
    createError.value = err.message
  } finally {
    creating.value = false
  }
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = what
    setTimeout(() => { if (copied.value === what) copied.value = '' }, 2000)
  } catch {
    // Clipboard blocked: the text stays visible to copy by hand.
  }
}

async function revoke(k) {
  if (!confirm(`¿Revocar la key "${k.name}"? El agente que la use dejará de tener acceso.`)) return
  const res = await fetch(`/api/agent-keys/${k.id}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) error.value = 'No se pudo revocar la key'
  await load()
}

onMounted(load)
</script>

<style scoped>
.agent-key-block {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.8rem;
  background: var(--cui-tertiary-bg);
  border: 1px solid var(--cui-border-color);
  border-radius: var(--cui-border-radius);
  padding: 0.6rem 0.75rem;
  margin-bottom: 0;
  max-height: 260px;
  overflow-y: auto;
}
</style>
