import { Router } from 'express';
import {
  adminController,
  adjustBalanceSchema,
  banUserSchema,
  completeTransactionSchema,
  failTransactionSchema,
} from '../controllers/adminController';
import { validate } from '../middleware/validator';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/adminMiddleware';

const router = Router();

// Tous les routes admin nécessitent une authentification + rôle admin
router.use(authMiddleware);
router.use(requireAdmin);

// ============================================
// DASHBOARD
// ============================================

// GET /api/admin/dashboard - Statistiques du dashboard
router.get('/dashboard', adminController.getDashboard.bind(adminController));

// ============================================
// USERS
// ============================================

// GET /api/admin/users - Liste des joueurs avec pagination/recherche
router.get('/users', adminController.getUsers.bind(adminController));

// GET /api/admin/users/:userId - Détails d'un joueur
router.get('/users/:userId', adminController.getUserDetails.bind(adminController));

// POST /api/admin/users/ban - Bannir un joueur
router.post(
  '/users/ban',
  validate(banUserSchema),
  adminController.banUser.bind(adminController)
);

// POST /api/admin/users/:userId/unban - Débannir un joueur
router.post('/users/:userId/unban', adminController.unbanUser.bind(adminController));

// ============================================
// BALANCE (Super Admin only)
// ============================================

// POST /api/admin/balance/adjust - Ajouter/retirer argent
router.post(
  '/balance/adjust',
  requireSuperAdmin,
  validate(adjustBalanceSchema),
  adminController.adjustBalance.bind(adminController)
);

// ============================================
// TRANSACTIONS
// ============================================

// GET /api/admin/transactions - Toutes les transactions
router.get('/transactions', adminController.getTransactions.bind(adminController));

// GET /api/admin/transactions/pending - Transactions en attente
router.get('/transactions/pending', adminController.getPendingTransactions.bind(adminController));

// POST /api/admin/transactions/complete - Confirmer une transaction
router.post(
  '/transactions/complete',
  validate(completeTransactionSchema),
  adminController.completeTransaction.bind(adminController)
);

// POST /api/admin/transactions/fail - Marquer comme échouée
router.post(
  '/transactions/fail',
  validate(failTransactionSchema),
  adminController.failTransaction.bind(adminController)
);

// ============================================
// AUDIT LOGS (Super Admin only)
// ============================================

// GET /api/admin/audit-logs - Journal des actions admin
router.get('/audit-logs', requireSuperAdmin, adminController.getAuditLogs.bind(adminController));

// ============================================
// RECONCILIATION
// ============================================

// POST /api/admin/reconcile - Lancer la réconciliation des balances gelées
router.post('/reconcile', requireSuperAdmin, adminController.runReconciliation.bind(adminController));

export default router;
