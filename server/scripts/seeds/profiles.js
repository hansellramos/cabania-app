const data = [
  {
    code: 'organization:view',
    name: 'Visualizador de Organización',
    description: 'Solo puede ver datos de las organizaciones asignadas',
    permissions: [
      'organizations:view', 'venues:view', 'accommodations:view',
      'payments:view', 'deposits:view', 'contacts:view',
    ],
    is_system: true,
  },
  {
    code: 'organization:admin',
    name: 'Administrador de Organización',
    description: 'Puede administrar todo dentro de sus organizaciones asignadas',
    permissions: [
      'organizations:view',
      'venues:view', 'venues:create', 'venues:edit', 'venues:delete',
      'accommodations:view', 'accommodations:create', 'accommodations:edit', 'accommodations:delete',
      'payments:view', 'payments:create', 'payments:edit', 'payments:delete', 'payments:verify',
      'deposits:view', 'deposits:create', 'deposits:edit', 'deposits:delete',
      'contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete',
      'ai-usage:view',
    ],
    is_system: true,
  },
  {
    code: 'organization:partner',
    name: 'Aliado',
    description: 'Puede ver disponibilidad, ver agenda sin detalles, y crear/gestionar sus propias reservas en organizaciones asignadas',
    permissions: [
      'organizations:view',
      'venues:view',
      'accommodations:view:own',     // ve agenda como bloques ocupados + detalles solo de lo suyo
      'accommodations:create',       // puede crear reservas (created_by se guarda automáticamente)
      'accommodations:edit:own',     // puede editar solo lo suyo
      'accommodations:delete:own',   // puede eliminar solo lo suyo
      'contacts:view:own',           // solo contactos de sus reservas (protección de base de datos)
      'contacts:create',             // puede crear contactos al reservar
      'payments:view:own',           // solo pagos de sus reservas
      'payments:create',             // puede registrar pagos en sus reservas
      'payments:verify:own',         // puede verificar pagos de sus reservas
      'deposits:view:own',           // solo depósitos de sus reservas
    ],
    is_system: true,
  },
];

async function seed(prisma) {
  for (const item of data) {
    await prisma.profiles.upsert({
      where: { code: item.code },
      update: { name: item.name, description: item.description, permissions: item.permissions, is_system: item.is_system },
      create: item,
    });
  }
  console.log(`  profiles: ${data.length} registros (upsert)`);

  // Asignar perfil por defecto a usuarios sin perfil
  const defaultProfile = await prisma.profiles.findUnique({ where: { code: 'organization:view' } });
  if (defaultProfile) {
    const result = await prisma.users.updateMany({
      where: { profile_id: null },
      data: { profile_id: defaultProfile.id },
    });
    if (result.count > 0) {
      console.log(`  profiles: perfil por defecto asignado a ${result.count} usuarios`);
    }
  }
}

module.exports = seed;
