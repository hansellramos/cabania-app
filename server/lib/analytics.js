// Product analytics (PostHog) for server-side business events and errors.
// Enabled only in production with POSTHOG_KEY set, or locally with POSTHOG_FORCE=1.
// POSTHOG_DEBUG=1 logs every event to the console (and skips sending unless enabled).
// Never send PII here: no names, emails, phones or exact amounts (use amountBucket).
const { prisma } = require('../db');

const KEY = process.env.POSTHOG_KEY;
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
const DEBUG = process.env.POSTHOG_DEBUG === '1';
// Railway sets RAILWAY_ENVIRONMENT_NAME; the Docker image does not set NODE_ENV.
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
const APP_ENV = IS_PROD ? 'production' : 'development';
const ENABLED = !!KEY && (IS_PROD || process.env.POSTHOG_FORCE === '1');

let client = null;
if (ENABLED) {
  try {
    const { PostHog } = require('posthog-node');
    client = new PostHog(KEY, { host: HOST, flushAt: 20, flushInterval: 10000 });
  } catch (err) {
    console.error('[analytics] PostHog init failed:', err.message);
  }
}

const CACHE_TTL = 10 * 60 * 1000;
const venueOrgCache = new Map(); // venueId -> { orgId, expires }
const demoOrgCache = new Map(); // orgId -> { isDemo, expires }

function cached(map, key) {
  const hit = map.get(key);
  return hit && hit.expires > Date.now() ? hit : null;
}

async function orgForVenue(venueId) {
  if (!venueId) return null;
  const hit = cached(venueOrgCache, venueId);
  if (hit) return hit.orgId;
  const venue = await prisma.venues.findUnique({ where: { id: venueId }, select: { organization: true } });
  const orgId = venue?.organization || null;
  venueOrgCache.set(venueId, { orgId, expires: Date.now() + CACHE_TTL });
  return orgId;
}

// The demo account (server/scripts/demo-account.js) marks its org in users.preferences.demo.
async function isDemoOrg(orgId) {
  if (!orgId) return false;
  const hit = cached(demoOrgCache, orgId);
  if (hit) return hit.isDemo;
  const rows = await prisma.$queryRaw`
    SELECT 1 FROM users WHERE preferences->'demo'->>'organization_id' = ${orgId} LIMIT 1`;
  const isDemo = rows.length > 0;
  demoOrgCache.set(orgId, { isDemo, expires: Date.now() + CACHE_TTL });
  return isDemo;
}

async function send(event, { userId, organizationId, venueId, properties }) {
  // A failed lookup must not drop the event: it goes out without the group.
  const orgId = organizationId || await orgForVenue(venueId).catch(() => null);
  const props = { app_env: APP_ENV, ...properties };
  if (venueId) props.venue_id = venueId;
  if (await isDemoOrg(orgId).catch(() => false)) props.is_demo = true;
  if (orgId) props.$groups = { organization: orgId };

  let distinctId = userId ? String(userId) : null;
  if (!distinctId) {
    distinctId = venueId ? `venue:${venueId}` : orgId ? `org:${orgId}` : 'server';
    props.$process_person_profile = false;
  }

  if (DEBUG) console.log('[analytics]', event, distinctId, JSON.stringify(props));
  if (client) client.capture({ distinctId, event, properties: props });
}

function track(event, ctx = {}) {
  if (!client && !DEBUG) return;
  send(event, ctx).catch(err => console.error('[analytics] track failed:', event, err.message));
}

function captureException(err, { userId, path, method } = {}) {
  if (!client && !DEBUG) return;
  try {
    const props = { app_env: APP_ENV, path, method };
    if (DEBUG) console.log('[analytics] $exception', userId || 'server', err?.message, path || '');
    if (!client) return;
    if (!userId) props.$process_person_profile = false;
    client.captureException(err, userId ? String(userId) : undefined, props);
  } catch (e) {
    console.error('[analytics] captureException failed:', e.message);
  }
}

function amountBucket(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '0';
  if (v < 200000) return '<200k';
  if (v < 500000) return '200k-500k';
  if (v < 1000000) return '500k-1M';
  if (v < 2000000) return '1M-2M';
  return '2M+';
}

function countBucket(n) {
  const v = Number(n) || 0;
  if (v <= 5) return '1-5';
  if (v <= 10) return '6-10';
  if (v <= 20) return '11-20';
  return '21+';
}

async function shutdown() {
  if (client) {
    try { await client.shutdown(); } catch (_) { /* ignore */ }
  }
}

module.exports = { track, captureException, amountBucket, countBucket, shutdown, enabled: ENABLED };
