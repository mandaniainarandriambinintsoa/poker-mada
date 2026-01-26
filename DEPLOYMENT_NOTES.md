# Notes de Déploiement - Poker Mada

## Base de données Render (PostgreSQL gratuit)

### Limitation
- **Expiration : 30 jours** après création
- Les données seront supprimées à l'expiration
- Base actuelle : `poker-mada-db` (expire le 20 février 2026)

### Options après expiration

#### Option 1 : Recréer une base gratuite (pour tests)
1. Supprimer l'ancienne base sur https://dashboard.render.com
2. Créer une nouvelle base PostgreSQL gratuite
3. Copier la nouvelle `Internal Database URL`
4. Mettre à jour `DATABASE_URL` dans les variables d'environnement du service
5. Redéployer (prisma db push recréera les tables)
- **Note** : Les données seront perdues

#### Option 2 : Migrer vers Supabase (gratuit, permanent)
- Plan gratuit : 500 MB, sans expiration
- URL : https://supabase.com
- Utiliser le **Session Pooler** pour compatibilité IPv4 avec Render

#### Option 3 : Migrer vers Neon (gratuit, permanent)
- Plan gratuit : 512 MB, sans expiration
- URL : https://neon.tech
- Compatible Prisma, pas de problème IPv6

#### Option 4 : Plan payant Render (~7$/mois)
- Base persistante sans expiration

---

## Configuration Render actuelle

### Service Web : poker-mada-api
- **URL** : https://poker-mada-api.onrender.com
- **Dashboard** : https://dashboard.render.com/web/srv-d5o7i6khg0os73feekeg
- **Region** : Frankfurt
- **Runtime** : Node.js
- **Root Directory** : server
- **Build Command** : `npm ci && npx prisma generate && npm run build`
- **Start Command** : `npx prisma db push && node dist/app.js`

### Variables d'environnement requises
- `DATABASE_URL` : URL de connexion PostgreSQL (Internal Database URL de Render)
- `JWT_SECRET` : Clé secrète pour les tokens JWT
- `JWT_REFRESH_SECRET` : Clé secrète pour les refresh tokens
- `CLIENT_URL` : URL du frontend (pour CORS)
- `NODE_ENV` : production

### Base de données : poker-mada-db
- **Dashboard** : https://dashboard.render.com/d/dpg-d5o8ftmid0rc7393vhmg-a
- **Region** : Frankfurt
- **Plan** : Free (expire après 30 jours)

---

## Problèmes résolus

1. **Build command mal formaté** : "buildyarn" → "build"
2. **DATABASE_URL avec espace** : "supabase.c o" → "supabase.co"
3. **Connexion Supabase IPv6** : Migré vers Render PostgreSQL
4. **TypeScript rootDir error** : Copié shared/ dans server/src/shared/
5. **Build command incomplet** : "npm run " → "npm run build"
6. **@types non installés** : Déplacé typescript et @types/* de devDependencies vers dependencies
