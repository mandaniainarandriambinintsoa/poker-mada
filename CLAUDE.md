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

---

## Gestion des Pics de Trafic

### Améliorations implémentées

1. **Gestionnaires d'erreurs non capturées** (`server/src/app.ts`)
   - `uncaughtException`: Capture les erreurs JS non gérées, log mais ne crash pas
   - `unhandledRejection`: Capture les Promises rejetées non gérées

2. **Configuration Socket.io optimisée**
   - `pingTimeout: 60000` - 60s avant de considérer un client déconnecté
   - `pingInterval: 25000` - Ping toutes les 25s pour maintenir la connexion
   - `maxHttpBufferSize: 1e6` - 1MB max par message
   - `perMessageDeflate` - Compression des messages > 1KB

3. **Rate Limiting amélioré**
   - Limite générale: 100 req/min par IP
   - Limite auth: 10 tentatives/15 min (protection brute force)

4. **Arrêt gracieux**
   - Ferme proprement les connexions HTTP et Socket.io
   - Déconnecte la base de données avant de quitter
   - Capture SIGTERM et SIGINT

5. **Health Check Endpoint**
   - `GET /health` - Retourne le statut du serveur
   - Vérifie la connexion à la base de données
   - Affiche la mémoire utilisée et le nombre de connexions

6. **Retry sur erreurs DB**
   - Fonction `withDatabaseRetry()` dans `database.ts`
   - Réessaie 3 fois avec délai progressif en cas d'erreur de connexion

### Configuration PM2 (Production)

Fichier: `server/ecosystem.config.js`

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer avec PM2
cd server
npm run build
npm run start:pm2

# Voir les logs
npm run logs:pm2

# Monitoring
npm run monit:pm2

# Redémarrer
npm run restart:pm2
```

### Configuration recommandée pour la base de données

Ajouter ces paramètres à votre DATABASE_URL pour optimiser le pool de connexions:
```
?connection_limit=20&pool_timeout=20
```

Exemple complet:
```
postgresql://user:password@host:5432/pokermada?connection_limit=20&pool_timeout=20
```

### Monitoring sur Render

1. Configurer le Health Check Path: `/health`
2. Le endpoint retourne:
   - `200 OK` si tout fonctionne
   - `503 Service Unavailable` si la DB a un problème

### En cas de crash

1. Vérifier les logs: `npm run logs:pm2` ou logs Render
2. Chercher les erreurs `UNCAUGHT EXCEPTION` ou `UNHANDLED REJECTION`
3. Vérifier la mémoire: endpoint `/health` affiche l'utilisation
4. Vérifier les connexions: `/health` affiche le nombre de sockets

---

## Authentification Google OAuth (via Supabase)

### Configuration requise

**1. Dans le dashboard Supabase:**
- Aller dans Authentication > Providers
- Activer Google
- Configurer les credentials OAuth (depuis Google Cloud Console)
- Ajouter l'URL de callback: `https://your-project.supabase.co/auth/v1/callback`

**2. Variables d'environnement serveur (.env):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**3. Variables d'environnement client (.env):**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Fichiers modifiés

**Backend:**
- `server/prisma/schema.prisma` - Ajout enum `AuthProvider`, champs `googleId` et `authProvider` sur User
- `server/src/config/env.ts` - Configuration Supabase
- `server/src/config/supabase.ts` - Client Supabase
- `server/src/services/authService.ts` - Méthodes `getGoogleAuthUrl()` et `loginWithGoogle()`
- `server/src/controllers/authController.ts` - Endpoints `googleAuth` et `googleCallback`
- `server/src/routes/authRoutes.ts` - Routes `/auth/google` et `/auth/google/callback`

**Frontend:**
- `client/src/config/supabase.ts` - Client Supabase
- `client/src/contexts/AuthContext.tsx` - Méthodes `loginWithGoogle()` et `handleGoogleCallback()`
- `client/src/pages/LoginPage.tsx` - Bouton "Continuer avec Google"
- `client/src/pages/AuthCallbackPage.tsx` - Page de callback OAuth
- `client/src/App.tsx` - Route `/auth/callback`

### Fonctionnement

1. L'utilisateur clique sur "Continuer avec Google"
2. Redirection vers la page de connexion Google (via Supabase)
3. Après autorisation, retour sur `/auth/callback`
4. Le client récupère le token Supabase et l'envoie au backend
5. Le backend vérifie le token et crée/lie le compte utilisateur
6. L'utilisateur reçoit un JWT et est connecté

### Notes importantes

- Les utilisateurs Google n'ont pas de mot de passe (champ nullable)
- Le numéro de téléphone est aussi nullable pour les utilisateurs Google
- Si un email existe déjà (compte local), le compte Google sera lié au compte existant
- Les utilisateurs Google ne peuvent pas changer leur mot de passe
