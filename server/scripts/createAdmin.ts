/**
 * Script pour promouvoir un utilisateur en SUPER_ADMIN
 * Usage: npx ts-node scripts/createAdmin.ts <email>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx ts-node scripts/createAdmin.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, username: true, email: true, role: true },
  });

  if (!user) {
    console.error(`Utilisateur avec l'email "${email}" non trouve.`);
    process.exit(1);
  }

  if (user.role === 'SUPER_ADMIN') {
    console.log(`${user.username} est deja SUPER_ADMIN.`);
    process.exit(0);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'SUPER_ADMIN' },
    select: { id: true, username: true, email: true, role: true },
  });

  console.log(`Utilisateur promu en SUPER_ADMIN:`);
  console.log(`  ID: ${updated.id}`);
  console.log(`  Username: ${updated.username}`);
  console.log(`  Email: ${updated.email}`);
  console.log(`  Role: ${updated.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
