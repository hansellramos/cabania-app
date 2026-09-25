<template>
  <CDropdown variant="nav-item" placement="bottom-end" :auto-close="true" @show="loadNotifications">
    <CDropdownToggle :caret="false" class="position-relative" title="Notificaciones">
      <CIcon icon="cil-bell" size="lg" />
      <CBadge
        v-if="unread > 0"
        color="danger"
        shape="rounded-pill"
        class="position-absolute top-0 start-100 translate-middle"
        style="font-size: 0.65rem"
      >
        {{ unread > 99 ? '99+' : unread }}
      </CBadge>
    </CDropdownToggle>
    <CDropdownMenu class="pt-0" style="width: 360px; max-width: 90vw">
      <CDropdownHeader class="bg-body-secondary fw-semibold d-flex justify-content-between align-items-center">
        <span>Notificaciones</span>
        <CButton v-if="unread > 0" color="link" size="sm" class="p-0 small text-decoration-none fw-normal" @click.stop="markAllRead">
          Marcar todo como leído
        </CButton>
      </CDropdownHeader>
      <div style="max-height: 420px; overflow-y: auto">
        <CDropdownItem
          v-for="item in items"
          :key="item.id"
          class="notification-item py-2"
          :class="{ unread: !item.read_at }"
          @click="openNotification(item)"
        >
          <div class="d-flex justify-content-between align-items-baseline gap-2">
            <span class="small text-body-emphasis" :class="item.read_at ? 'fw-normal' : 'fw-semibold'">
              <span v-if="!item.read_at" class="unread-dot" aria-label="Sin leer"></span>{{ item.title }}
            </span>
            <span class="small text-body-secondary text-nowrap">{{ timeAgo(item.created_at) }}</span>
          </div>
          <div class="small text-body-secondary notification-body">{{ item.body }}</div>
        </CDropdownItem>
        <div v-if="!items.length" class="text-center text-muted small py-4 px-3">
          No tienes notificaciones.
        </div>
      </div>
    </CDropdownMenu>
  </CDropdown>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const items = ref([])
const unread = ref(0)
let timer = null

async function loadNotifications() {
  try {
    const response = await fetch('/api/notifications?limit=20', { credentials: 'include' })
    if (!response.ok) return
    const data = await response.json()
    items.value = data.items
    unread.value = data.unread
  } catch {
    // A failed poll is retried on the next one.
  }
}

async function openNotification(item) {
  if (!item.read_at) {
    item.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
    fetch(`/api/notifications/${item.id}/read`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }
  if (item.link) router.push(item.link)
}

async function markAllRead() {
  await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }).catch(() => {})
  const now = new Date().toISOString()
  items.value.forEach(i => { if (!i.read_at) i.read_at = now })
  unread.value = 0
}

function timeAgo(date) {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days < 7
    ? `hace ${days} d`
    : new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

onMounted(() => {
  loadNotifications()
  timer = setInterval(loadNotifications, 60000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.notification-item {
  cursor: pointer;
  white-space: normal;
  border-bottom: 1px solid var(--cui-border-color-translucent);
  border-left: 3px solid transparent;
}
.notification-item:last-child {
  border-bottom: 0;
}
.notification-item.unread {
  border-left-color: var(--cui-primary);
  background-color: rgba(var(--cui-primary-rgb), 0.08);
}
.notification-item:hover,
.notification-item:focus {
  background-color: var(--cui-tertiary-bg);
}
.unread-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background-color: var(--cui-primary);
  vertical-align: middle;
}
.notification-body {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
