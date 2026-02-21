const data = [
  { code: 'accommodations:create', name: 'Crear reservas', description: 'Permite crear nuevas reservas' },
  { code: 'accommodations:delete', name: 'Eliminar reservas', description: 'Permite eliminar reservas' },
  { code: 'accommodations:edit', name: 'Editar reservas', description: 'Permite editar reservas' },
  { code: 'accommodations:view', name: 'Ver reservas', description: 'Permite ver reservas de organizaciones asignadas' },
  { code: 'contacts:create', name: 'Crear contactos', description: 'Permite crear nuevos contactos' },
  { code: 'contacts:delete', name: 'Eliminar contactos', description: 'Permite eliminar contactos' },
  { code: 'contacts:edit', name: 'Editar contactos', description: 'Permite editar contactos' },
  { code: 'contacts:view', name: 'Ver contactos', description: 'Permite ver contactos de organizaciones asignadas' },
  { code: 'deposits:create', name: 'Crear depositos', description: 'Permite crear nuevos depositos' },
  { code: 'deposits:delete', name: 'Eliminar depositos', description: 'Permite eliminar depositos' },
  { code: 'deposits:edit', name: 'Editar depositos', description: 'Permite editar depositos' },
  { code: 'deposits:view', name: 'Ver depositos', description: 'Permite ver depositos de organizaciones asignadas' },
  { code: 'organizations:create', name: 'Crear organizaciones', description: 'Permite crear nuevas organizaciones' },
  { code: 'organizations:delete', name: 'Eliminar organizaciones', description: 'Permite eliminar organizaciones' },
  { code: 'organizations:edit', name: 'Editar organizaciones', description: 'Permite editar organizaciones' },
  { code: 'organizations:view', name: 'Ver organizaciones asignadas', description: 'Permite ver solo las organizaciones asignadas al usuario' },
  { code: 'organizations:view:all', name: 'Ver todas las organizaciones', description: 'Permite ver todas las organizaciones del sistema' },
  { code: 'payments:create', name: 'Crear pagos', description: 'Permite crear nuevos pagos' },
  { code: 'payments:delete', name: 'Eliminar pagos', description: 'Permite eliminar pagos' },
  { code: 'payments:edit', name: 'Editar pagos', description: 'Permite editar pagos' },
  { code: 'payments:verify', name: 'Verificar pagos', description: 'Permite verificar pagos' },
  { code: 'payments:view', name: 'Ver pagos', description: 'Permite ver pagos de organizaciones asignadas' },
  { code: 'profiles:create', name: 'Crear perfiles', description: 'Permite crear nuevos perfiles' },
  { code: 'profiles:delete', name: 'Eliminar perfiles', description: 'Permite eliminar perfiles' },
  { code: 'profiles:edit', name: 'Editar perfiles', description: 'Permite editar perfiles' },
  { code: 'profiles:view', name: 'Ver perfiles', description: 'Permite ver perfiles' },
  { code: 'subscription:manage', name: 'Gestionar Suscripciones', description: 'Permite agregar y remover usuarios de la suscripcion' },
  { code: 'users:edit', name: 'Editar usuarios', description: 'Permite editar usuarios' },
  { code: 'users:lock', name: 'Bloquear usuarios', description: 'Permite bloquear/desbloquear usuarios' },
  { code: 'users:view', name: 'Ver usuarios', description: 'Permite ver usuarios' },
  { code: 'venues:create', name: 'Crear venues', description: 'Permite crear nuevos venues' },
  { code: 'venues:delete', name: 'Eliminar venues', description: 'Permite eliminar venues' },
  { code: 'venues:edit', name: 'Editar venues', description: 'Permite editar venues' },
  { code: 'venues:view', name: 'Ver venues', description: 'Permite ver venues de organizaciones asignadas' },
  { code: 'ai-usage:view', name: 'Ver uso de IA', description: 'Permite ver estadísticas y registros de uso de IA' },
];

async function seed(prisma) {
  for (const item of data) {
    await prisma.permissions.upsert({
      where: { code: item.code },
      update: { name: item.name, description: item.description },
      create: item,
    });
  }
  console.log(`  permissions: ${data.length} registros (upsert)`);
}

module.exports = seed;
