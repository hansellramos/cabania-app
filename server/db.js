const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;

// Prisma Postgres uses prisma+postgres:// URLs that only work with PrismaClient.
// Raw pg connections (connect-pg-simple, PrismaPg adapter) need a direct postgres:// URL.
const isPrismaPostgres = databaseUrl?.startsWith('prisma+postgres://');

// Direct URL for raw pg connections (session store, etc.)
// Falls back to DATABASE_URL for non-Prisma-Postgres setups (Neon, local Docker).
const directUrl = process.env.DIRECT_URL || databaseUrl;

let prisma;
if (isPrismaPostgres) {
  prisma = new PrismaClient();
} else {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: directUrl });
  prisma = new PrismaClient({ adapter });
}

module.exports = { prisma, directUrl, isPrismaPostgres };
