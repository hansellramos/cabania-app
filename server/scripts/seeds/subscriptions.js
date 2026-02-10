const data = [
  { name: 'Propietarios', description: 'Suscripción principal para los dueños de la aplicación', is_active: true, plan_type: 'owner', max_users: 100, max_organizations: 100 },
  { name: 'Prueba Gratuita', description: null, is_active: true, plan_type: 'free', max_users: 5, max_organizations: 3 },
];

async function seed(prisma) {
  const count = await prisma.subscriptions.count();
  if (count > 0) {
    console.log(`  subscriptions: ya tiene ${count} registros, omitido`);
    return;
  }
  await prisma.subscriptions.createMany({ data });
  console.log(`  subscriptions: ${data.length} registros creados`);
}

module.exports = seed;
