import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreBalance() {
  // Restaurer tout le solde gelé vers le solde disponible
  const wallet = await prisma.wallet.findFirst({
    where: { user: { username: 'Manda' } }
  });

  if (!wallet) {
    console.log('Wallet non trouvé');
    return;
  }

  console.log('Avant:');
  console.log('  Balance:', Number(wallet.balance));
  console.log('  Gelée:', Number(wallet.frozenBalance));

  // Remettre tout à 10000 disponible
  const updated = await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: 10000,
      frozenBalance: 0
    }
  });

  console.log('\nAprès:');
  console.log('  Balance:', Number(updated.balance));
  console.log('  Gelée:', Number(updated.frozenBalance));

  await prisma.$disconnect();
}

restoreBalance();
