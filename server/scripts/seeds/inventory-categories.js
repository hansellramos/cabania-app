const data = [
  { name: 'Limpieza', description: '', icon: '', color: 'primary', type: 'supply', is_active: true },
  { name: 'Mobiliario', description: '', icon: '', color: 'primary', type: 'asset', is_active: true },
];

async function seed(prisma) {
  const count = await prisma.inventory_categories.count();
  if (count > 0) {
    console.log(`  inventory_categories: ya tiene ${count} registros, omitido`);
    return;
  }
  await prisma.inventory_categories.createMany({ data });
  console.log(`  inventory_categories: ${data.length} registros creados`);
}

module.exports = seed;
