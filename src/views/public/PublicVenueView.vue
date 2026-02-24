<template>
  <div v-if="loading" class="text-center py-5">
    <div class="loading-spinner"></div>
    <p class="mt-3 text-muted">Cargando información...</p>
  </div>

  <div v-else-if="error" class="text-center py-5">
    <h2 class="text-muted mb-3">No encontrado</h2>
    <p class="text-muted">La página que buscas no existe o no está disponible.</p>
  </div>

  <div v-else class="public-venue">
    <!-- Teleport venue logo + name into page header -->
    <Teleport to="#public-header-left">
      <img v-if="venue.logo_url" :src="venue.logo_url" alt="" class="venue-header-logo" />
      <svg v-else viewBox="0 0 24 24" fill="none" width="22" height="22" class="venue-header-icon">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="page-header-venue">{{ venue.name }}</span>
    </Teleport>
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-gallery" v-if="images.length > 0"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div class="hero-cover">
          <transition :name="slideDirection" mode="out-in">
            <img :src="activeImage" :alt="venue.name" class="cover-img" :key="activeImageIdx" />
          </transition>
          <!-- Carousel arrows -->
          <template v-if="images.length > 1">
            <button class="carousel-arrow carousel-arrow--left" @click="prevImage" aria-label="Anterior">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="carousel-arrow carousel-arrow--right" @click="nextImage" aria-label="Siguiente">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="carousel-dots">
              <button
                v-for="(img, idx) in images"
                :key="img.id"
                :class="['carousel-dot', { active: activeImageIdx === idx }]"
                @click="goToImage(idx)"
                :aria-label="`Foto ${idx + 1}`"
              />
            </div>
          </template>
        </div>
        <div class="hero-thumbnails" v-if="images.length > 1">
          <button
            v-for="(img, idx) in images"
            :key="img.id"
            :class="['thumb-btn', { active: activeImageIdx === idx }]"
            @click="goToImage(idx)"
          >
            <img :src="img.image_url" :alt="`Foto ${idx + 1}`" />
          </button>
        </div>
      </div>
      <div class="hero-info container-narrow">
        <div class="hero-title-row">
          <h1 class="venue-name">{{ venue.name }}</h1>
          <button class="hero-cta" @click="openChat">Reserva aquí</button>
        </div>
        <p class="venue-location" v-if="venue.city || venue.department">
          📍 {{ [venue.city, venue.department].filter(Boolean).join(', ') }}
        </p>
        <div class="amenity-badges" v-if="amenities.length > 0">
          <span v-for="a in amenities" :key="a.id" class="amenity-badge">
            ✓ {{ a.name }}
          </span>
        </div>
      </div>
    </section>

    <!-- Info Section -->
    <section class="info-section container-narrow" v-if="venue.venue_info || venue.delivery_info || venue.latitude">
      <div class="info-grid">
        <div class="info-card" v-if="venue.venue_info">
          <h3>Sobre nosotros</h3>
          <p class="info-text">{{ venue.venue_info }}</p>
        </div>
        <div class="info-card" v-if="venue.delivery_info">
          <h3>Cómo llegar</h3>
          <p class="info-text">{{ venue.delivery_info }}</p>
        </div>
      </div>

      <!-- Map -->
      <div class="map-container" v-if="venue.latitude && venue.longitude" ref="mapContainer">
        <div id="public-venue-map" class="venue-map"></div>
      </div>

      <!-- Navigation links -->
      <div class="nav-links" v-if="venue.waze_link || venue.google_maps_link || venue.whatsapp || venue.instagram">
        <a v-if="venue.waze_link" :href="venue.waze_link" target="_blank" rel="noopener" class="nav-link-btn waze">
          🗺️ Waze
        </a>
        <a v-if="venue.google_maps_link" :href="venue.google_maps_link" target="_blank" rel="noopener" class="nav-link-btn gmaps">
          📍 Google Maps
        </a>
        <a v-if="venue.whatsapp" :href="`https://wa.me/${venue.whatsapp.replace(/[^0-9]/g, '')}`" target="_blank" rel="noopener" class="nav-link-btn whatsapp">
          💬 WhatsApp
        </a>
        <a v-if="venue.instagram" :href="instagramUrl" target="_blank" rel="noopener" class="nav-link-btn instagram">
          📸 Instagram
        </a>
      </div>
    </section>

    <!-- Plans Section -->
    <section class="plans-section container-narrow" v-if="plans.length > 0">
      <h2 class="section-title">Nuestros Planes</h2>
      <div class="plans-grid">
        <div v-for="plan in plans" :key="plan.id" class="plan-card">
          <div class="plan-header">
            <h3 class="plan-name">{{ plan.name }}</h3>
            <span class="plan-type-badge">{{ planTypeLabel(plan.plan_type) }}</span>
          </div>
          <p v-if="plan.description" class="plan-description">{{ plan.description }}</p>
          <div class="plan-details">
            <div class="plan-prices">
              <div v-if="plan.adult_price" class="price-item">
                <span class="price-label">Adulto</span>
                <span class="price-value">{{ formatCurrency(plan.adult_price) }}</span>
              </div>
              <div v-if="plan.child_price" class="price-item">
                <span class="price-label">Niño</span>
                <span class="price-value">{{ formatCurrency(plan.child_price) }}</span>
              </div>
            </div>
            <div v-if="plan.check_in_time || plan.check_out_time" class="plan-schedule">
              <span v-if="plan.check_in_time">🕐 Entrada: {{ plan.check_in_time }}</span>
              <span v-if="plan.check_out_time">🕐 Salida: {{ plan.check_out_time }}</span>
            </div>
            <div v-if="plan.includes_food && plan.food_description" class="plan-food">
              🍽️ {{ plan.food_description }}
            </div>
            <div v-if="plan.amenities && plan.amenities.length > 0" class="plan-amenities">
              <span v-for="pa in plan.amenities" :key="pa.id" class="plan-amenity-tag">
                {{ pa.name }}{{ pa.quantity > 1 ? ` x${pa.quantity}` : '' }}
              </span>
            </div>
          </div>
          <button class="plan-cta" @click="askAboutPlan(plan)">
            Preguntar disponibilidad
          </button>
        </div>
      </div>
    </section>

    <!-- Booking Panel Widget -->
    <BookingPanelWidget
      v-if="venue.id"
      ref="bookingPanel"
      :venue-id="venue.id"
      :plans="plans"
      @chat-handoff="onBookingChatHandoff"
    />

    <!-- Chat Widget (floating bubble) -->
    <ChatBubbleWidget
      v-if="venue.id"
      ref="chatWidget"
      :venue="venue"
      :venue-id="venue.id"
    />
  </div>
</template>

<script setup>
import { ref, computed, provide, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import ChatBubbleWidget from '@/components/public/ChatBubbleWidget.vue'
import BookingPanelWidget from '@/components/public/BookingPanelWidget.vue'

const route = useRoute()

const loading = ref(true)
const error = ref(false)
const venue = ref({})
const images = ref([])
const amenities = ref([])
const plans = ref([])
const activeImageIdx = ref(0)

// Provide venue brand colors to parent layout (for orbs)
const venueColors = computed(() => ({
  primary: venue.value.brand_color_primary || null,
  secondary: venue.value.brand_color_secondary || null,
}))
provide('venueColors', venueColors)

const chatWidget = ref(null)
const bookingPanel = ref(null)
const slideDirection = ref('slide-left')
let touchStartX = 0
let autoplayTimer = null

const startAutoplay = () => {
  stopAutoplay()
  if (images.value.length > 1) {
    autoplayTimer = setInterval(() => nextImage(), 5000)
  }
}

const stopAutoplay = () => {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

const resetAutoplay = () => {
  startAutoplay()
}

const prevImage = () => {
  slideDirection.value = 'slide-right'
  activeImageIdx.value = (activeImageIdx.value - 1 + images.value.length) % images.value.length
  resetAutoplay()
}

const nextImage = () => {
  slideDirection.value = 'slide-left'
  activeImageIdx.value = (activeImageIdx.value + 1) % images.value.length
}

const goToImage = (idx) => {
  slideDirection.value = idx > activeImageIdx.value ? 'slide-left' : 'slide-right'
  activeImageIdx.value = idx
  resetAutoplay()
}

const onTouchStart = (e) => {
  touchStartX = e.changedTouches[0].clientX
}

const onTouchEnd = (e) => {
  const diff = touchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 50) {
    if (diff > 0) nextImage()
    else prevImage()
  }
  resetAutoplay()
}

onUnmounted(() => stopAutoplay())

const instagramUrl = computed(() => {
  const ig = venue.value.instagram || ''
  if (ig.startsWith('http')) return ig
  return `https://instagram.com/${ig.replace('@', '')}`
})

const activeImage = computed(() => {
  if (images.value.length === 0) return ''
  return images.value[activeImageIdx.value]?.image_url || ''
})

const loadVenue = async () => {
  try {
    const slug = route.params.slug
    const response = await fetch(`/api/public/venues/${slug}`)
    if (!response.ok) {
      error.value = true
      return
    }
    const data = await response.json()
    venue.value = data.venue
    images.value = data.images || []
    amenities.value = data.amenities || []
    plans.value = data.plans || []

    // Set cover image as default
    const coverIdx = images.value.findIndex(i => i.is_cover)
    if (coverIdx >= 0) activeImageIdx.value = coverIdx
    startAutoplay()

  } catch (err) {
    console.error('Error loading venue:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

const planTypeLabel = (type) => {
  const labels = { day: 'Pasadía', pasadia: 'Pasadía', overnight: 'Hospedaje', hospedaje: 'Hospedaje', event: 'Evento', evento: 'Evento', camping: 'Camping' }
  return labels[type] || type
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}

const openChat = () => {
  bookingPanel.value?.open()
}

const askAboutPlan = (plan) => {
  bookingPanel.value?.open(plan)
}

const onBookingChatHandoff = (context) => {
  chatWidget.value?.startBookingChat(context)
}

// Initialize map
const initMap = () => {
  if (!venue.value.latitude || !venue.value.longitude) return
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  if (!mapboxToken || typeof mapboxgl === 'undefined') return

  const map = new mapboxgl.Map({
    container: 'public-venue-map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [parseFloat(venue.value.longitude), parseFloat(venue.value.latitude)],
    zoom: 14,
    accessToken: mapboxToken,
    interactive: true
  })

  new mapboxgl.Marker({ color: '#10b981' })
    .setLngLat([parseFloat(venue.value.longitude), parseFloat(venue.value.latitude)])
    .setPopup(new mapboxgl.Popup().setHTML(`<strong>${venue.value.name}</strong>`))
    .addTo(map)
}

onMounted(async () => {
  await loadVenue()
  if (!error.value && venue.value.latitude) {
    // Load Mapbox dynamically
    if (!document.getElementById('mapbox-css')) {
      const link = document.createElement('link')
      link.id = 'mapbox-css'
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.css'
      document.head.appendChild(link)

      const script = document.createElement('script')
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.1.0/mapbox-gl.js'
      script.onload = () => nextTick(initMap)
      document.head.appendChild(script)
    } else {
      nextTick(initMap)
    }
  }
})
</script>

<style scoped>
.public-venue {
  max-width: 100%;
}

:global(.venue-header-logo) {
  height: 28px;
  width: 28px;
  border-radius: 0.4rem;
  object-fit: cover;
  margin-right: 0.5rem;
}

:global(.venue-header-icon) {
  color: var(--venue-color-primary, #10b981);
  margin-right: 0.4rem;
  flex-shrink: 0;
}

:global(.page-header-venue) {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--pl-text, #0f172a);
}

.container-narrow {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Hero */
.hero-section {
  margin-bottom: 2rem;
}

.hero-gallery {
  position: relative;
}

.hero-cover {
  position: relative;
  width: 100%;
  max-height: 450px;
  overflow: hidden;
  background: #e2e8f0;
}

.cover-img {
  width: 100%;
  height: 450px;
  object-fit: cover;
}

/* Carousel transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity 0.35s ease;
}

.slide-left-enter-from,
.slide-left-leave-to,
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
}

/* Carousel arrows */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s, transform 0.2s;
}

.carousel-arrow:hover {
  background: rgba(0, 0, 0, 0.55);
  transform: translateY(-50%) scale(1.1);
}

.carousel-arrow--left {
  left: 0.75rem;
}

.carousel-arrow--right {
  right: 0.75rem;
}

/* Carousel dots */
.carousel-dots {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.4rem;
  z-index: 10;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.carousel-dot.active {
  background: #fff;
  transform: scale(1.3);
}

.hero-thumbnails {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  justify-content: center;
}

.thumb-btn {
  width: 60px;
  height: 60px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.thumb-btn.active {
  border-color: #10b981;
  box-shadow: 0 2px 12px rgba(16, 185, 129, 0.3);
}

.thumb-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-info {
  padding-top: 1.5rem;
}

.hero-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.venue-name {
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.venue-location {
  font-size: 1.05rem;
  color: #64748b;
  margin: 0 0 1rem;
}

.amenity-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.amenity-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 20px;
  font-size: 0.85rem;
  color: #047857;
}

.amenity-icon {
  font-size: 1rem;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.75rem;
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;
}

.hero-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(16, 185, 129, 0.45);
}

/* Info */
.info-section {
  margin-bottom: 2rem;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.info-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
}

.info-card h3 {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem;
}

.info-text {
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.6;
  white-space: pre-line;
  margin: 0;
}

.venue-map {
  width: 100%;
  height: 300px;
  border-radius: 16px;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.nav-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
  color: #fff;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.nav-link-btn.waze { background: rgba(51, 204, 255, 0.85); }
.nav-link-btn.gmaps { background: rgba(66, 133, 244, 0.85); }
.nav-link-btn.whatsapp { background: rgba(37, 211, 102, 0.85); }
.nav-link-btn.instagram { background: linear-gradient(45deg, rgba(240,148,51,0.85), rgba(230,104,60,0.85), rgba(220,39,67,0.85), rgba(204,35,102,0.85), rgba(188,24,136,0.85)); }

.nav-link-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  color: #fff;
}

/* Plans */
.plans-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 1.25rem;
}

.plans-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .plans-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

.plan-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.plan-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.3) inset;
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.plan-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.plan-type-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(14, 165, 233, 0.15);
  color: #0369a1;
}

.plan-description {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}

.plan-details {
  flex: 1;
  margin-bottom: 1rem;
}

.plan-prices {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.price-item {
  display: flex;
  flex-direction: column;
}

.price-label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
}

.price-value {
  font-size: 1.15rem;
  font-weight: 800;
  color: #10b981;
}

.plan-schedule {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.plan-food {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.plan-amenities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.plan-amenity-tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background: rgba(241, 245, 249, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  color: #475569;
}

.plan-cta {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1rem;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  box-shadow: 0 2px 12px rgba(16, 185, 129, 0.25);
}

.plan-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
}

/* Loading spinner */
.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Mobile */
@media (max-width: 640px) {
  .venue-name {
    font-size: 1.5rem;
  }

  .cover-img {
    height: 280px;
  }

  .hero-thumbnails {
    justify-content: flex-start;
  }
}


</style>

<!-- Dark mode overrides (unscoped — :global() with descendant selectors breaks in Vue scoped styles) -->
<style>
[data-theme="dark"] .hero-cover {
  background: #1e293b;
}

[data-theme="dark"] .hero-thumbnails {
  background: rgba(2, 6, 23, 0.65);
}

[data-theme="dark"] .thumb-btn {
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .venue-name {
  color: #f1f5f9;
}

[data-theme="dark"] .venue-location {
  color: #94a3b8;
}

[data-theme="dark"] .amenity-badge {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
  color: #34d399;
}

[data-theme="dark"] .info-card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .info-card h3 {
  color: #f1f5f9;
}

[data-theme="dark"] .info-text {
  color: #94a3b8;
}

[data-theme="dark"] .venue-map {
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .section-title {
  color: #f1f5f9;
}

[data-theme="dark"] .plan-card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .plan-card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .plan-name {
  color: #f1f5f9;
}

[data-theme="dark"] .plan-type-badge {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.25);
  color: #7dd3fc;
}

[data-theme="dark"] .plan-description {
  color: #94a3b8;
}

[data-theme="dark"] .price-label {
  color: #cbd5e1;
}

[data-theme="dark"] .plan-schedule {
  color: #94a3b8;
}

[data-theme="dark"] .plan-food {
  color: #94a3b8;
}

[data-theme="dark"] .plan-amenity-tag {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}
</style>
