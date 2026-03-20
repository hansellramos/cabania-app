const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;

// Prisma Postgres (accelerate) URLs don't support driver adapters
const isPrismaPostgres = connectionString?.startsWith('prisma+postgres://');

let prisma;
if (isPrismaPostgres) {
  prisma = new PrismaClient();
} else {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
}

module.exports = { prisma };
