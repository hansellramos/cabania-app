/**
 * Sets a password for an existing user.
 *
 * Usage:
 *   node server/seed-admin.js <email> <password>
 *
 * Example:
 *   node server/seed-admin.js admin@example.com mypassword123
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('./db');

async function main() {
  const [,, email, password] = process.argv;

  if (!email || !password) {
    console.error('Uso: node server/seed-admin.js <email> <password>');
    process.exit(1);
  }

  const user = await prisma.users.findFirst({
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    console.error(`No se encontró usuario con email: ${email}`);
    const allUsers = await prisma.users.findMany({
      select: { id: true, email: true, display_name: true, is_super_admin: true }
    });
    console.log('\nUsuarios existentes:');
    allUsers.forEach(u => {
      console.log(`  ${u.email || '(sin email)'} - ${u.display_name || '(sin nombre)'} ${u.is_super_admin ? '[ADMIN]' : ''}`);
    });
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.users.update({
    where: { id: user.id },
    data: { password_hash: hash }
  });

  console.log(`Password configurado para: ${user.email} (${user.display_name})`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
