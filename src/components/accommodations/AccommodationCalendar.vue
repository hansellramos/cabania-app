<template>
  <div>
    <div class="d-flex justify-content-between align-items-end mb-3">
      <div class="flex-grow-1 me-3">
        <label for="searchFilter" class="form-label">Search (customer:, organization:, venue:):</label>
        <input id="searchFilter" type="text" v-model="searchQuery" class="form-control" placeholder="e.g. customer:hansel, organization:baluna, venue:casa" />
      </div>
      <CButton color="primary" @click="router.push('/business/accommodations/create')">
        <CIcon :icon="cilPlus" class="me-1" /> Nueva
      </CButton>
    </div>
    <FullCalendar :options="calendarOptions" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useRouter } from 'vue-router'
import { fetchAccommodations } from '@/services/accommodationService'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'
import { CButton } from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'
import { cilPlus } from '@coreui/icons'

const router = useRouter()
const accommodations = ref([])
const searchQuery = ref('')
const settingsStore = useSettingsStore()
const { user } = useAuth()

async function load() {
  const viewAll = user.value?.is_super_admin ? settingsStore.godModeViewAll : false
  accommodations.value = await fetchAccommodations({ viewAll })
}

watch(() => settingsStore.godModeViewAll, () => {
  load()
})

const filteredAccommodations = computed(() => {
  if (!searchQuery.value.trim()) return accommodations.value
  
  const query = searchQuery.value.trim().toLowerCase()
  
  const customerMatch = query.match(/customer:(\S+)/)
  const orgMatch = query.match(/organization:(\S+)/)
  const venueMatch = query.match(/venue:(\S+)/)
  
  return accommodations.value.filter(item => {
    let matches = true
    
    if (customerMatch) {
      const customerSearch = customerMatch[1].toLowerCase()
      const customerName = (item.customer_data?.fullname || item.customer_data?.user_data?.email || '').toLowerCase()
      matches = matches && customerName.includes(customerSearch)
    }
    
    if (orgMatch) {
      const orgSearch = orgMatch[1].toLowerCase()
      const orgName = (item.venue_data?.organization_data?.name || '').toLowerCase()
      matches = matches && orgName.includes(orgSearch)
    }
    
    if (venueMatch) {
      const venueSearch = venueMatch[1].toLowerCase()
      const venueName = (item.venue_data?.name || '').toLowerCase()
      matches = matches && venueName.includes(venueSearch)
    }
    
    if (!customerMatch && !orgMatch && !venueMatch) {
      const customerName = (item.customer_data?.fullname || item.customer_data?.user_data?.email || '').toLowerCase()
      const venueName = (item.venue_data?.name || '').toLowerCase()
      const orgName = (item.venue_data?.organization_data?.name || '').toLowerCase()
      matches = customerName.includes(query) || venueName.includes(query) || orgName.includes(query)
    }
    
    return matches
  })
})

function formatAttendees(adults, children) {
  const a = adults || 0
  const c = children || 0
  const total = a + c
  if (total === 0) return ''
  return `${total}(${a}A/${c}N)`
}

const events = computed(() => {
  return filteredAccommodations.value.map(acc => {
    const dateStr = acc.date ? acc.date.split('T')[0] : null
    if (!dateStr) return null
    
    let startHour = 9, startMin = 0
    if (acc.time && acc.time.includes('T')) {
      const t = new Date(acc.time)
      startHour = t.getUTCHours()
      startMin = t.getUTCMinutes()
    }
    
    const start = new Date(dateStr + 'T00:00:00')
    start.setUTCHours(startHour, startMin, 0)
    
    const durationSec = Number(acc.duration) || 86400
    const end = new Date(start.getTime() + durationSec * 1000)
    
    const isRedacted = acc._redacted === true
    const customerName = isRedacted ? 'Reservado' : (acc.customer_data?.fullname || acc.customer_data?.user_data?.email || 'Sin cliente')
    const venueName = acc.venue_data?.name || 'Sin venue'
    const orgName = isRedacted ? '' : (acc.venue_data?.organization_data?.name || '')
    const attendees = isRedacted ? '' : formatAttendees(acc.adults, acc.children)

    return {
      id: acc.id,
      title: isRedacted
        ? `Reservado - ${venueName}`
        : `${attendees ? attendees + ' ' : ''}${customerName} - ${venueName}${orgName ? ' (' + orgName + ')' : ''}`,
      start: start.toISOString(),
      end: end.toISOString(),
      classNames: isRedacted ? ['fc-event--redacted'] : [getVenueClass(acc.venue)],
      extendedProps: { accommodation: acc, redacted: isRedacted }
    }
  }).filter(Boolean)
})

const venueClassMap = {}
let venueClassIndex = 0
const VENUE_CLASS_COUNT = 8

function getVenueClass(venueId) {
  if (!venueId) return 'fc-event--venue-muted'
  if (!(venueId in venueClassMap)) {
    venueClassMap[venueId] = venueClassIndex % VENUE_CLASS_COUNT
    venueClassIndex++
  }
  return `fc-event--venue-${venueClassMap[venueId]}`
}

function handleEventClick(info) {
  if (info.event.extendedProps?.redacted) return
  const accId = info.event.id
  router.push(`/business/accommodations/${accId}`)
}

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  locale: 'es',
  events: events.value,
  eventClick: handleEventClick,
  height: 'auto',
  eventDisplay: 'block',
  dayMaxEvents: 3
}))

onMounted(load)
</script>

<style>
.fc {
  font-family: inherit;
}
.fc .fc-toolbar-title {
  font-size: 1.25rem;
}
.fc .fc-button {
  font-size: 0.875rem;
}
.fc-event {
  cursor: pointer;
}
.fc-event--redacted {
  background-color: #9e9e9e !important;
  border-color: #757575 !important;
  opacity: 0.7;
  cursor: default;
}
</style>
