import { Router } from 'express';
import {
  walletController,
  depositSchema,
  withdrawSchema,
  confirmDepositSchema,
} from '../controllers/walletController';
import { validate } from '../middleware/validator';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// GET /api/wallet/balance - Obtenir le solde
router.get('/balance', walletController.getBalance.bind(walletController));

// GET /api/wallet/transactions - Historique des transactions
router.get('/transactions', walletController.getTransactions.bind(walletController));

// POST /api/wallet/deposit - Initier un dépôt
router.post(
  '/deposit',
  validate(depositSchema),
  walletController.initiateDeposit.bind(walletController)
);

// POST /api/wallet/deposit/confirm - Confirmer un dépôt (callback Mobile Money)
router.post(
  '/deposit/confirm',
  validate(confirmDepositSchema),
  walletController.confirmDeposit.bind(walletController)
);

// POST /api/wallet/withdraw - Initier un retrait
router.post(
  '/withdraw',
  validate(withdrawSchema),
  walletController.initiateWithdrawal.bind(walletController)
);

export default router;
