# Déploiement Vercel + Railway

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Vercel       │     │    Railway      │     │    Railway      │
│   (Frontend)    │────▶│   (Backend)     │────▶│  (PostgreSQL)   │
│    Gratuit      │     │    ~5$/mois     │     │    Gratuit      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     React              Node.js + Socket.io        Base de données
```

---

## Étape 1: Déployer PostgreSQL sur Railway

1. Aller sur https://railway.app et créer un compte

2. Cliquer **"New Project"** → **"Provision PostgreSQL"**

3. Une fois créé, aller dans **Variables** et copier:
   - `DATABASE_URL` (format: `postgresql://user:pass@host:port/db`)

---

## Étape 2: Déployer le Backend sur Railway

### 2.1 Créer le service

1. Dans le même projet Railway, cliquer **"New"** → **"GitHub Repo"**

2. Connecter votre repo GitHub et sélectionner le dossier `server`

3. Railway va détecter automatiquement Node.js

### 2.2 Configurer les variables d'environnement

Dans **Variables**, ajouter:

```env
NODE_ENV=production
PORT=3001

# Copier depuis le service PostgreSQL
DATABASE_URL=postgresql://...

# Générer avec: openssl rand -base64 32
JWT_SECRET=votre_secret_jwt_tres_long_et_securise
JWT_REFRESH_SECRET=autre_secret_jwt_tres_long

# URL de votre frontend Vercel (à mettre après déploiement)
CLIENT_URL=https://poker-mada.vercel.app

# Mobile Money (optionnel pour commencer)
ORANGE_MONEY_API_URL=
ORANGE_MONEY_MERCHANT_ID=
ORANGE_MONEY_API_KEY=
MVOLA_API_URL=
MVOLA_CONSUMER_KEY=
MVOLA_CONSUMER_SECRET=
MVOLA_MERCHANT_NUMBER=
```

### 2.3 Configurer le déploiement

Dans **Settings**:
- **Root Directory**: `server`
- **Build Command**: `npm ci && npx prisma generate && npm run build`
- **Start Command**: `npx prisma migrate deploy && node dist/app.js`

### 2.4 Obtenir l'URL du backend

Après déploiement, Railway génère une URL comme:
```
https://poker-mada-backend-production.up.railway.app
```

Copiez cette URL pour l'étape suivante.

---

## Étape 3: Déployer le Frontend sur Vercel

### 3.1 Installer Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Se connecter

```bash
cd client
vercel login
```

### 3.3 Configurer les variables d'environnement

```bash
# URL de votre backend Railway
vercel env add VITE_API_URL
# Entrer: https://votre-backend.railway.app/api

vercel env add VITE_SOCKET_URL
# Entrer: https://votre-backend.railway.app
```

### 3.4 Déployer

```bash
vercel --prod
```

### 3.5 Mettre à jour vercel.json

Modifiez `client/vercel.json` avec votre URL Railway:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://VOTRE-BACKEND.railway.app/api/:path*"
    }
  ]
}
```

Redéployer:
```bash
vercel --prod
```

---

## Étape 4: Finaliser la configuration

### 4.1 Mettre à jour CLIENT_URL sur Railway

Retourner sur Railway et mettre à jour la variable:
```
CLIENT_URL=https://poker-mada.vercel.app
```

### 4.2 Configurer le domaine personnalisé (optionnel)

**Sur Vercel:**
1. Aller dans Project Settings → Domains
2. Ajouter `pokermada.mg`
3. Configurer les DNS chez votre registrar

**Sur Railway:**
1. Aller dans Settings → Networking → Custom Domain
2. Ajouter `api.pokermada.mg`

---

## Résumé des URLs

| Service | URL |
|---------|-----|
| Frontend | https://poker-mada.vercel.app |
| Backend API | https://votre-backend.railway.app/api |
| WebSocket | https://votre-backend.railway.app |

---

## Coûts Mensuels Estimés

| Service | Coût |
|---------|------|
| Vercel (Frontend) | **Gratuit** |
| Railway (Backend) | ~5$ |
| Railway (PostgreSQL) | **Gratuit** (500MB) |
| **Total** | **~5$/mois** |

---

## Commandes Utiles

```bash
# Déployer le frontend
cd client && vercel --prod

# Voir les logs Railway
railway logs

# Accéder à la DB Railway
railway connect postgres

# Variables d'environnement Vercel
vercel env ls
vercel env pull .env.local
```

---

## Dépannage

### Erreur CORS
Vérifier que `CLIENT_URL` sur Railway correspond exactement à l'URL Vercel.

### WebSocket ne se connecte pas
Vérifier que `VITE_SOCKET_URL` pointe vers l'URL Railway (sans `/api`).

### Base de données inaccessible
Vérifier que `DATABASE_URL` est correctement copié depuis le service PostgreSQL Railway.
