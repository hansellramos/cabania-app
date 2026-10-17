// Single entry point for product analytics (PostHog). The rest of the app calls
// these helpers instead of importing posthog-js directly. Event catalog:
// docs/analytics-events.md
import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'
// Hostnames that count as production. Anything else (localhost, previews, Replit)
// never sends events unless VITE_POSTHOG_DEBUG is on.
const PROD_HOSTS = (import.meta.env.VITE_POSTHOG_HOSTS || 'cabania.app,cabania.info')
  .split(',').map(h => h.trim()).filter(Boolean)
const DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === 'true'

let enabled = false
let identifiedId = null
let recordingPausedByUs = false

function isProdHost(hostname) {
  return PROD_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))
}

export function appEnv() {
  if (typeof window === 'undefined') return 'development'
  if (import.meta.env.PROD && isProdHost(window.location.hostname)) return 'production'
  if (import.meta.env.PROD) return 'preview'
  return 'development'
}

// Capability tokens travel in hash URLs (#/contract/<token>, ?token=...). Replace
// them before anything leaves the browser.
const TOKEN_PATTERNS = [
  [/(#\/contract\/amendment\/)[^/?#&"\s]+/g, '$1:token'],
  [/(#\/contract\/code\/)[^/?#&"\s]+/g, '$1:id'],
  [/(#\/contract\/)(?!amendment\/|code\/)[^/?#&"\s]+/g, '$1:token'],
  [/([?&]token=)[^&#"\s]+/g, '$1:token'],
  [/([?&](?:code|email|phone)=)[^&#"\s]+/g, '$1:redacted'],
]

function scrubUrl(value) {
  if (typeof value !== 'string') return value
  return TOKEN_PATTERNS.reduce((v, [re, rep]) => v.replace(re, rep), value)
}

// Digits in clicked-element text are almost always amounts, phones, document
// numbers or dates of a specific booking.
function scrubText(value) {
  return typeof value === 'string' ? value.replace(/\d/g, '•') : value
}

const URL_PROPS = ['$current_url', '$referrer', '$initial_referrer', '$pathname', '$initial_current_url', '$prev_pageview_pathname']

function beforeSend(event) {
  if (!event) return event
  const props = event.properties || {}
  for (const k of URL_PROPS) if (props[k]) props[k] = scrubUrl(props[k])
  if (props.$el_text) props.$el_text = scrubText(props.$el_text)
  if (typeof props.$elements_chain === 'string') {
    props.$elements_chain = props.$elements_chain
      .replace(/(text=")([^"]*)(")/g, (_, a, t, c) => a + scrubText(t) + c)
      .replace(/(attr__href=")([^"]*)(")/g, (_, a, h, c) => a + scrubUrl(h) + c)
  }
  if (Array.isArray(props.$elements)) {
    for (const el of props.$elements) {
      if (el.$el_text) el.$el_text = scrubText(el.$el_text)
      if (el.attr__href) el.attr__href = scrubUrl(el.attr__href)
    }
  }
  if (event.$set?.$current_url) event.$set.$current_url = scrubUrl(event.$set.$current_url)
  if (event.$set_once?.$initial_current_url) event.$set_once.$initial_current_url = scrubUrl(event.$set_once.$initial_current_url)
  return event
}

export function initAnalytics() {
  if (enabled || typeof window === 'undefined') return
  const env = appEnv()
  if (!KEY || (env !== 'production' && !DEBUG)) return

  posthog.init(KEY, {
    api_host: HOST,
    defaults: '2025-11-30',
    // Hash routing: pageviews are captured by the router (see trackPageview).
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    capture_exceptions: true,
    before_send: beforeSend,
    session_recording: {
      maskAllInputs: true,
      // Tables and anything tagged hold guest names, phones and amounts.
      maskTextSelector: 'td, .ph-mask, [data-ph-mask], .ph-no-capture',
      maskTextFn: (text) => scrubText(text),
    },
    loaded: (ph) => {
      if (DEBUG) ph.debug(true)
    },
  })
  posthog.register({ app_env: env })
  enabled = true
}

// Route meta → stable names. route.matched gives the pattern, e.g.
// /business/accommodations/:id, regardless of the actual id.
const MODULE_PREFIXES = [
  ['/business/accommodations', 'accommodations'],
  ['/business/payments', 'payments'],
  ['/payment-result', 'payments'],
  ['/business/deposits', 'deposits'],
  ['/business/expenses', 'expenses'],
  ['/business/estimates', 'estimates'],
  ['/business/commission', 'commissions'],
  ['/business/inventory', 'inventory'],
  ['/admin/inventory', 'inventory'],
  ['/business/maintenance', 'maintenance'],
  ['/admin/maintenance', 'maintenance'],
  ['/business/pending-tasks', 'tasks'],
  ['/business/venues/:venueId/contract-templates', 'contracts'],
  ['/contract', 'public_contract'],
  ['/business/venues/:id/whatsapp', 'channels'],
  ['/business/venues/:id/instagram', 'channels'],
  ['/business/venues/:id/payment-methods', 'payments'],
  ['/business/venues/:id/plans', 'venues'],
  ['/business/venues', 'venues'],
  ['/business/contacts', 'contacts'],
  ['/business/organizations', 'organizations'],
  ['/admin/profiles', 'users'],
  ['/venues/:id/chat', 'chats'],
  ['/users', 'users'],
  ['/invitations', 'users'],
  ['/analytics', 'analytics'],
  ['/dashboard', 'dashboard'],
  ['/next', 'upcoming'],
  ['/availability', 'availability'],
  ['/p/', 'public_venue'],
  ['/onboarding', 'onboarding'],
  ['/pages', 'auth'],
  ['/invitation', 'auth'],
  ['/settings', 'settings'],
  ['/profile', 'settings'],
  ['/no-subscription', 'subscription'],
  ['/admin', 'admin'],
]

export function routePattern(route) {
  const last = route?.matched?.[route.matched.length - 1]
  return last?.path || route?.path || ''
}

export function routeModule(route) {
  const pattern = routePattern(route)
  const hit = MODULE_PREFIXES.find(([p]) => pattern.startsWith(p))
  return hit ? hit[1] : 'other'
}

function isSensitiveRoute(pattern) {
  return pattern.startsWith('/contract')
}

export function trackPageview(route) {
  if (!enabled) return
  const pattern = routePattern(route)
  // Contract pages show the full contract with the guest's name and ID number:
  // keep them out of session replays.
  if (isSensitiveRoute(pattern)) {
    if (posthog.sessionRecordingStarted?.()) {
      posthog.stopSessionRecording()
      recordingPausedByUs = true
    }
  } else if (recordingPausedByUs) {
    posthog.startSessionRecording()
    recordingPausedByUs = false
  }
  posthog.capture('$pageview', {
    $current_url: scrubUrl(window.location.href),
    route_name: route.name ? String(route.name) : null,
    route_pattern: pattern,
    module: routeModule(route),
  })
}

export function track(event, properties = {}) {
  if (!enabled) return
  posthog.capture(event, properties)
}

const amountBuckets = [[200000, '<200k'], [500000, '200k-500k'], [1000000, '500k-1M'], [2000000, '1M-2M']]
export function amountBucket(value) {
  const n = Number(value) || 0
  const hit = amountBuckets.find(([max]) => n < max)
  return hit ? hit[1] : '2M+'
}

async function getJSON(url) {
  try {
    const res = await fetch(url, { credentials: 'include' })
    return res.ok ? await res.json() : null
  } catch (_) {
    return null
  }
}

// Called with the /api/auth/user payload once per session. Only ids and coarse
// attributes leave the browser: no email, phone or name.
export async function identifyUser(user) {
  if (!enabled || !user?.id) return
  // While impersonating, events would merge the admin's device into the other
  // person's profile.
  if (user.is_impersonating) return
  if (identifiedId === user.id) return
  identifiedId = user.id

  const isDemo = !!user.preferences?.demo
  posthog.identify(String(user.id), {
    role: user.profile?.name || null,
    is_super_admin: !!user.is_super_admin,
    is_demo: isDemo,
    plan_type: user.subscription?.plan_type || null,
  }, {
    created_at: user.created_at || null,
  })
  posthog.register({ is_internal: !!user.is_super_admin, is_demo: isDemo })

  // Super admins see every organization; grouping them would be noise.
  if (user.is_super_admin) return
  const orgs = await getJSON('/api/organizations')
  const org = Array.isArray(orgs) ? orgs[0] : null
  if (!org?.id) return
  const venues = await getJSON('/api/venues')
  posthog.group('organization', String(org.id), {
    name: org.name || null,
    plan_type: user.subscription?.plan_type || null,
    subscription_active: !!user.subscription?.is_active,
    is_trial: !!user.subscription?.trial_expires_at,
    venues_count: Array.isArray(venues) ? venues.length : null,
    is_demo: isDemo,
  })
}

export function resetAnalytics() {
  identifiedId = null
  if (enabled) posthog.reset()
}

export function captureException(error, properties = {}) {
  if (!enabled) return
  posthog.captureException(error, properties)
}
