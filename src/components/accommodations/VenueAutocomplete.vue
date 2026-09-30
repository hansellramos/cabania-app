<template>
  <div class="venue-picker">
    <!-- Keeps the form's "required" check working in every mode -->
    <input class="venue-picker__validator" :value="modelValue || ''" required tabindex="-1" aria-hidden="true" />

    <!-- Selected: the venue, with an arrow to change it -->
    <div v-if="selected && !changing" class="venue-picker__selected">
      <span class="venue-picker__name">
        {{ selected.name }}
        <span v-if="selected.organization_data" class="text-body-secondary small">· {{ selected.organization_data.name }}</span>
      </span>
      <CButton
        color="secondary"
        variant="ghost"
        size="sm"
        title="Cambiar cabaña"
        aria-label="Cambiar cabaña"
        @click="startChange"
      >
        <CIcon icon="cil-chevron-bottom" />
      </CButton>
    </div>

    <!-- A few venues: one click each -->
    <CButtonGroup v-else-if="venues.length && venues.length <= BUTTONS_UP_TO" class="venue-picker__buttons" role="group">
      <CButton
        v-for="venue in venues"
        :key="venue.id"
        color="primary"
        :variant="venue.id === modelValue ? undefined : 'outline'"
        @click="selectVenue(venue)"
      >{{ venue.name }}</CButton>
    </CButtonGroup>

    <!-- Many venues: search -->
    <div v-else class="position-relative">
      <CFormInput
        ref="searchInput"
        v-model="query"
        placeholder="Escribe el nombre de la cabaña"
        @focus="showDropdown = true"
        @input="showDropdown = true"
        @blur="hideDropdownWithDelay"
      />
      <ul v-if="showDropdown && filteredVenues.length" class="list-group position-absolute w-100 mt-1" style="max-height:220px;overflow-y:auto;">
        <li
          v-for="venue in filteredVenues"
          :key="venue.id"
          class="list-group-item list-group-item-action"
          style="cursor:pointer;"
          @mousedown.prevent="selectVenue(venue)"
        >
          {{ venue.name }} <span v-if="venue.organization_data" class="text-body-secondary">- {{ venue.organization_data.name }}</span>
        </li>
      </ul>
      <div v-else-if="showDropdown && query && !filteredVenues.length" class="text-body-secondary small mt-1">No hay cabañas con ese nombre</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { fetchVenues } from '@/services/venueService'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'

// With this many venues or fewer they show as buttons (one click); more, a search.
const BUTTONS_UP_TO = 3

const settingsStore = useSettingsStore()
const { user } = useAuth()

const props = defineProps({
  modelValue: String,
})
const emit = defineEmits(['update:modelValue', 'venue-selected'])

const query = ref('')
const showDropdown = ref(false)
const venues = ref([])
const changing = ref(false)
const searchInput = ref(null)

const selected = computed(() => venues.value.find(v => v.id === props.modelValue) || null)

const filteredVenues = computed(() => {
  if (!query.value) return venues.value
  const q = query.value.toLowerCase()
  return venues.value.filter(v => v.name && v.name.toLowerCase().includes(q))
})

function selectVenue(venue) {
  query.value = ''
  showDropdown.value = false
  changing.value = false
  emit('update:modelValue', venue.id)
  emit('venue-selected', venue)
}

// The arrow: back to the buttons, or to the search with the list open.
async function startChange() {
  changing.value = true
  if (venues.value.length > BUTTONS_UP_TO) {
    showDropdown.value = true
    await nextTick()
    searchInput.value?.$el?.focus?.()
  }
}

function hideDropdownWithDelay() {
  setTimeout(() => {
    showDropdown.value = false
    // Leaving the search without picking: keep the current venue.
    if (selected.value) changing.value = false
  }, 150)
}

async function loadVenues() {
  const viewAll = user.value?.is_super_admin && settingsStore.godModeViewAll
  venues.value = await fetchVenues({ viewAll })
}

onMounted(async () => {
  await loadVenues()
  if (selected.value) {
    emit('venue-selected', selected.value)
  } else if (!props.modelValue && venues.value.length === 1) {
    // Most accounts have a single venue: pick it right away.
    selectVenue(venues.value[0])
  }
})

watch(() => props.modelValue, () => {
  if (selected.value) emit('venue-selected', selected.value)
})
</script>

<style scoped>
.venue-picker {
  position: relative;
}
.venue-picker__validator {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  width: 1px;
  height: 1px;
}
.venue-picker__selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 38px;
  padding: 0.25rem 0.25rem 0.25rem 0.75rem;
  border: 1px solid var(--cui-border-color);
  border-radius: var(--cui-border-radius);
  background-color: var(--cui-body-bg);
}
.venue-picker__name {
  font-weight: 500;
}
.venue-picker__buttons {
  flex-wrap: wrap;
}
</style>
