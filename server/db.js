const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;
const isPrismaPostgres = databaseUrl?.startsWith('prisma+postgres://');

let prisma;
if (isPrismaPostgres) {
  prisma = new PrismaClient();
} else {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  prisma = new PrismaClient({ adapter });
}

module.exports = { prisma };
