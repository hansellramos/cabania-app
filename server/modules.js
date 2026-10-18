/**
 * Módulos opcionales que cada organización puede apagar.
 *
 * El catálogo (claves, nombres y descripciones) vive en modules.json, que también
 * importa el frontend: es la única fuente de las claves de módulo. Lo central del
 * negocio (alquileres, pagos, calendario, contactos, cabañas, egresos y análisis)
 * no está aquí y siempre queda encendido.
 *
 * En la base se guarda la lista de módulos APAGADOS (organizations.disabled_modules),
 * así un módulo nuevo queda encendido en todas las organizaciones existentes.
 */
const { prisma } = require('./db');
const CATALOG = require('./modules.json');

const MODULE_KEYS = CATALOG.map(m => m.key);
const moduleName = (key) => CATALOG.find(m => m.key === key)?.name || key;

// Endpoints de cada módulo. Los enlaces públicos de contratos (/api/public/contracts)
// no se bloquean: un contrato ya enviado al cliente se puede seguir firmando.
const MODULE_ROUTES = [
  { module: 'maintenance', pattern: /^\/api\/pending-tasks\/[^/]+\/create-maintenance$/ },
  { module: 'pending_tasks', pattern: /^\/api\/pending-tasks?(-images)?(\/|$)/ },
  { module: 'maintenance', pattern: /^\/api\/maintenance-(dashboard|images|logs|supplies|zones)(\/|$)/ },
  { module: 'inventory', pattern: /^\/api\/(inventory|inventory-categories|inventory-images|expense-inventory-items)(\/|$)/ },
  { module: 'inventory', pattern: /^\/api\/expenses\/[^/]+\/inventory-items$/ },
  { module: 'commissions', pattern: /^\/api\/(commission-agents|commission-payments|commissions)(\/|$)/ },
  { module: 'contracts', pattern: /^\/api\/(contract-templates|contract-placeholders)(\/|$)/ },
  { module: 'contracts', pattern: /^\/api\/venues\/[^/]+\/contract-templates$/ },
  { module: 'contracts', pattern: /^\/api\/accommodations\/[^/]+\/contract(\/|$)/ },
  { module: 'estimates', pattern: /^\/api\/estimates(\/|$)/ },
  { module: 'deposits', pattern: /^\/api\/deposits(\/|$)/ },
  { module: 'deposits', pattern: /^\/api\/accommodations\/[^/]+\/deposit-calculation$/ },
];

function moduleForPath(path) {
  return MODULE_ROUTES.find(r => r.pattern.test(path))?.module || null;
}

/** Limpia lo que llega del cliente: solo claves conocidas, sin repetidas. */
function normalizeDisabled(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(k => MODULE_KEYS.includes(k)))];
}

// Caché corta de los módulos apagados por organización: el guard corre en cada
// request de un módulo y la configuración casi nunca cambia.
const CACHE_TTL = 30 * 1000;
const cache = new Map(); // orgId -> { disabled, expires }

async function getDisabledByOrg(orgIds) {
  const result = {};
  const missing = [];
  const now = Date.now();
  for (const id of orgIds) {
    const hit = cache.get(id);
    if (hit && hit.expires > now) result[id] = hit.disabled;
    else missing.push(id);
  }
  if (missing.length) {
    const orgs = await prisma.organizations.findMany({
      where: { id: { in: missing } },
      select: { id: true, disabled_modules: true }
    });
    for (const org of orgs) {
      const disabled = normalizeDisabled(org.disabled_modules);
      cache.set(org.id, { disabled, expires: now + CACHE_TTL });
      result[org.id] = disabled;
    }
  }
  return result;
}

function invalidateModulesCache(orgId) {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

async function isModuleEnabledForOrg(orgId, key) {
  if (!orgId) return true;
  const disabled = (await getDisabledByOrg([orgId]))[orgId] || [];
  return !disabled.includes(key);
}

async function isModuleEnabledForVenue(venueId, key) {
  if (!venueId) return true;
  const venue = await prisma.venues.findUnique({ where: { id: venueId }, select: { organization: true } });
  return isModuleEnabledForOrg(venue?.organization, key);
}

/**
 * Módulos encendidos para un conjunto de organizaciones: un módulo cuenta como
 * encendido si lo está en AL MENOS UNA de ellas (alguien con dos cabañas en
 * organizaciones distintas no pierde el módulo por la que lo apagó).
 * orgIds null = todas (super admin): todo encendido.
 */
async function enabledModulesFor(orgIds) {
  if (orgIds === null) return [...MODULE_KEYS];
  if (!orgIds.length) return [...MODULE_KEYS];
  const byOrg = await getDisabledByOrg(orgIds);
  return MODULE_KEYS.filter(key => orgIds.some(id => !(byOrg[id] || []).includes(key)));
}

/** Estado de módulos que va en /api/auth/user. */
async function modulesStateForUser(user) {
  if (user.is_super_admin) {
    return { enabled: [...MODULE_KEYS], disabled_by_organization: {} };
  }
  const memberships = await prisma.user_organizations.findMany({
    where: { user_id: user.id },
    select: { organization_id: true }
  });
  const orgIds = memberships.map(m => m.organization_id);
  const byOrg = orgIds.length ? await getDisabledByOrg(orgIds) : {};
  return { enabled: await enabledModulesFor(orgIds), disabled_by_organization: byOrg };
}

/** Organización a la que apunta el request, cuando se puede saber barato. */
async function resolveRequestOrg(req) {
  const accMatch = req.path.match(/^\/api\/accommodations\/([^/]+)\//);
  if (accMatch) {
    const acc = await prisma.accommodations.findUnique({ where: { id: accMatch[1] }, select: { venue: true } }).catch(() => null);
    if (acc?.venue) {
      const venue = await prisma.venues.findUnique({ where: { id: acc.venue }, select: { organization: true } });
      return venue?.organization || null;
    }
    return null;
  }
  const venueMatch = req.path.match(/^\/api\/venues\/([^/]+)\//);
  const venueId = venueMatch?.[1] || req.query?.venue_id || req.body?.venue_id;
  if (typeof venueId === 'string' && venueId) {
    const venue = await prisma.venues.findUnique({ where: { id: venueId }, select: { organization: true } }).catch(() => null);
    if (venue?.organization) return venue.organization;
  }
  const orgId = req.query?.organization_id || req.body?.organization_id;
  return typeof orgId === 'string' && orgId ? orgId : null;
}

/**
 * Middleware: responde 403 en los endpoints de un módulo apagado. Si el request
 * apunta a una cabaña u organización concreta se mira esa; si no, basta con que
 * el módulo esté encendido en alguna de las organizaciones del usuario.
 * Los super admin no se bloquean.
 */
function moduleGuard() {
  return async (req, res, next) => {
    const key = moduleForPath(req.path);
    if (!key || !req.user || req.userPermissions?.isSuperAdmin) return next();
    try {
      const orgId = await resolveRequestOrg(req);
      const enabled = orgId
        ? await isModuleEnabledForOrg(orgId, key)
        : (await enabledModulesFor(req.userPermissions?.organizationIds || [])).includes(key);
      if (enabled) return next();
      return res.status(403).json({
        error: `El módulo ${moduleName(key)} está desactivado para esta organización. Un administrador puede activarlo en Organizaciones > Módulos.`,
        code: 'module_disabled',
        module: key
      });
    } catch (err) {
      console.error('[modules] Error verificando módulo:', err.message);
      return next();
    }
  };
}

module.exports = {
  MODULES: CATALOG,
  MODULE_KEYS,
  moduleName,
  moduleForPath,
  normalizeDisabled,
  getDisabledByOrg,
  invalidateModulesCache,
  isModuleEnabledForOrg,
  isModuleEnabledForVenue,
  enabledModulesFor,
  modulesStateForUser,
  moduleGuard,
};
