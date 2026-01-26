import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addBalance() {
  try {
    // Trouver l'utilisateur Manda
    const user = await prisma.user.findUnique({
      where: { username: 'Manda' },
      include: { wallet: true }
    });

    if (!user) {
      console.log('Utilisateur Manda non trouvé');
      return;
    }

    console.log('Solde actuel:', user.wallet?.balance);

    // Mettre à jour le solde
    const updatedWallet = await prisma.wallet.update({
      where: { userId: user.id },
      data: { balance: 10000 }
    });

    console.log('Nouveau solde:', updatedWallet.balance);
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addBalance();
