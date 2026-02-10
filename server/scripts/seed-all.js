const { prisma } = require('../db.js');

const seeds = [
  { name: 'permissions', fn: require('./seeds/permissions') },
  { name: 'profiles', fn: require('./seeds/profiles') },
  { name: 'ai_settings', fn: require('./seeds/ai-settings') },
  { name: 'llm_providers', fn: require('./seeds/llm-providers') },
  { name: 'expense_categories', fn: require('./seeds/expense-categories') },
  { name: 'inventory_categories', fn: require('./seeds/inventory-categories') },
  { name: 'subscriptions', fn: require('./seeds/subscriptions') },
  { name: 'amenities', fn: require('./seeds/amenities') },
  { name: 'countries', fn: require('./seeds/countries') },
  { name: 'states', fn: require('./seeds/states') },
];

async function seedAll() {
  console.log('=== Seed de datos de referencia ===\n');
  const start = Date.now();

  for (const seed of seeds) {
    try {
      await seed.fn(prisma);
    } catch (error) {
      console.error(`  ERROR en ${seed.name}:`, error.message);
    }
  }

  console.log(`\nCompletado en ${Date.now() - start}ms`);
}

seedAll()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
