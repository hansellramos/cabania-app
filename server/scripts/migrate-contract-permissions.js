/**
 * Migration script — adds contract-related permissions and wires them
 * into the three system profiles. Idempotent: safe to re-run.
 *
 * Usage:
 *   node server/scripts/migrate-contract-permissions.js
 *
 * Or against production via Railway:
 *   DATABASE_URL="postgresql://..." node server/scripts/migrate-contract-permissions.js
 */
const { prisma } = require('../db.js');

const NEW_PERMISSIONS = [
  { code: 'contracts:view', name: 'Ver contratos', description: 'Permite ver contratos de hospedajes' },
  { code: 'contracts:manage', name: 'Gestionar contratos', description: 'Permite crear, regenerar y eliminar contratos' },
  { code: 'contracts:templates:manage', name: 'Gestionar plantillas de contrato', description: 'Permite crear y editar plantillas de contrato a nivel de venue' },
  { code: 'contracts:view:own', name: 'Ver contratos propios', description: 'Solo contratos de sus reservas' },
  { code: 'contracts:manage:own', name: 'Gestionar contratos propios', description: 'Crear, regenerar y eliminar contratos solo en sus reservas' },
];

const PROFILE_ADDITIONS = {
  'organization:view': ['contracts:view'],
  'organization:admin': ['contracts:view', 'contracts:manage', 'contracts:templates:manage'],
  'organization:partner': ['contracts:view:own', 'contracts:manage:own'],
};

async function run() {
  console.log('=== Migracion: permisos de contratos ===\n');

  // 1. Upsert permissions
  for (const p of NEW_PERMISSIONS) {
    await prisma.permissions.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description },
      create: p,
    });
    console.log(`  permiso ok: ${p.code}`);
  }

  // 2. Merge permissions into profiles (preserve existing entries)
  for (const [profileCode, toAdd] of Object.entries(PROFILE_ADDITIONS)) {
    const profile = await prisma.profiles.findUnique({ where: { code: profileCode } });
    if (!profile) {
      console.warn(`  perfil no encontrado: ${profileCode} (omitido)`);
      continue;
    }
    const current = Array.isArray(profile.permissions) ? profile.permissions : [];
    const merged = Array.from(new Set([...current, ...toAdd]));
    if (merged.length === current.length) {
      console.log(`  perfil sin cambios: ${profileCode}`);
      continue;
    }
    await prisma.profiles.update({
      where: { id: profile.id },
      data: { permissions: merged },
    });
    const added = toAdd.filter(p => !current.includes(p));
    console.log(`  perfil actualizado: ${profileCode} (+${added.join(', ')})`);
  }

  console.log('\nListo.');
}

run()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
