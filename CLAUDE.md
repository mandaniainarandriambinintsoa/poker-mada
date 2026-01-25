# Notes Claude Code - Poker Mada

## Modifications temporaires pour tests

### Système de Bot (À RETIRER EN PRODUCTION)

**Date d'ajout:** 2026-01-25

**Fichiers concernés:**
- `server/src/game/Bot.ts` - Logique du bot de poker
- `server/src/game/BotManager.ts` - Gestionnaire des bots
- `server/src/socket/socketManager.ts` - Intégration du bot (sections marquées `=== BOT ===`)

**Fonctionnement:**
- Quand un joueur rejoint une table seul, un bot est automatiquement ajouté après 2 secondes
- Le bot a 3 niveaux de difficulté selon la table:
  - `table-small` -> Bot facile (prévisible, suit souvent)
  - `table-medium` -> Bot moyen (équilibré, bluff occasionnel)
  - `table-high` -> Bot difficile (stratégique, utilise les cotes du pot)

**Pour retirer le système de bot:**
1. Supprimer `server/src/game/Bot.ts`
2. Supprimer `server/src/game/BotManager.ts`
3. Dans `socketManager.ts`:
   - Supprimer l'import `import { botManager } from '../game/BotManager';`
   - Supprimer la variable `let ioInstance: Server;`
   - Supprimer la ligne `ioInstance = io;`
   - Supprimer les sections entre `// === BOT ===` et `// === FIN BOT ===`
   - Supprimer les appels à `botManager.processBotTurn()`

---

## Autres notes

### Validation utilisateur assouplie
- Nom d'utilisateur: 2-30 caractères (tous caractères permis)
- Mot de passe: minimum 6 caractères
- Téléphone: format malgache obligatoire (032/033/034/037/038)

### Jetons de départ
- Nouveaux comptes reçoivent 10 000 Ar de jetons gratuits
- Configurable dans `authService.ts` -> `STARTING_BALANCE`

### Bug corrigé: Balance gelée
- La balance gelée est maintenant correctement rendue quand un joueur quitte une table ou se déconnecte
- Voir `handleDisconnect()` dans `socketManager.ts`

---

## Dashboard Admin

### Fonctionnalités
- **Dashboard:** Statistiques globales (joueurs, solde total, transactions en attente)
- **Gestion joueurs:** Liste, recherche, filtres (actifs/bannis), bannir/débannir
- **Ajustement solde:** Ajouter/retirer de l'argent manuellement (SUPER_ADMIN uniquement)
- **Transactions en attente:** Confirmer ou refuser les dépôts/retraits
- **Historique transactions:** Voir toutes les transactions avec filtres

### Rôles utilisateur
- `PLAYER` (défaut) - Joueur normal
- `ADMIN` - Accès au dashboard, peut bannir des joueurs et traiter des transactions
- `SUPER_ADMIN` - Tous les droits admin + ajuster les soldes + voir les logs d'audit

### Fichiers concernés

**Backend:**
- `server/prisma/schema.prisma` - Enum UserRole, modèle AdminAuditLog
- `server/src/middleware/adminMiddleware.ts` - requireAdmin, requireSuperAdmin
- `server/src/services/adminService.ts` - Logique métier admin
- `server/src/controllers/adminController.ts` - Contrôleur des routes
- `server/src/routes/adminRoutes.ts` - Routes `/api/admin/*`

**Frontend:**
- `client/src/services/adminApi.ts` - Appels API admin
- `client/src/components/admin/AdminRoute.tsx` - Protection des routes
- `client/src/pages/admin/AdminDashboardPage.tsx` - Dashboard principal
- `client/src/pages/admin/AdminUsersPage.tsx` - Gestion des joueurs
- `client/src/pages/admin/AdminPendingPage.tsx` - Transactions en attente
- `client/src/pages/admin/AdminTransactionsPage.tsx` - Historique

### Pour promouvoir un utilisateur en SUPER_ADMIN

Option 1 - Via script:
```bash
cd server
npx ts-node scripts/createAdmin.ts votre-email@example.com
```

Option 2 - Via SQL:
```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'votre-email@example.com';
```

### Accès au dashboard
- URL: `/admin`
- Nécessite un compte avec rôle ADMIN ou SUPER_ADMIN
- Lien visible dans le header pour les admins

---

## Réconciliation des Balances Gelées

### Problème résolu
Quand un joueur rejoint une table, son buy-in est "gelé" (frozenBalance). Si le serveur crash ou si la déconnexion n'est pas gérée correctement, la balance peut rester gelée même si le joueur n'est plus sur aucune table.

### Solution automatique
Le service de réconciliation (`server/src/services/reconciliationService.ts`):
- S'exécute automatiquement au démarrage du serveur
- S'exécute toutes les 5 minutes
- Vérifie tous les utilisateurs avec frozenBalance > 0
- Si le joueur n'est sur aucune table active, libère automatiquement la balance
- Crée une transaction REFUND pour tracer
- Log l'action dans AdminAuditLog

### Réconciliation manuelle
Dans le dashboard admin (`/admin`), les SUPER_ADMIN peuvent:
- Voir le bouton "Lancer la réconciliation"
- Déclencher manuellement la vérification
- Voir le résultat (nombre vérifié, nombre corrigé, détails)

### Endpoint API
```
POST /api/admin/reconcile
```
Réservé aux SUPER_ADMIN. Retourne:
```json
{
  "checked": 5,
  "corrected": 1,
  "details": [
    { "odId": "...", "username": "player1", "amount": 5000 }
  ]
}
```
