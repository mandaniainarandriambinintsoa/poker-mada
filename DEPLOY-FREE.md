# Déploiement 100% GRATUIT (Vercel + Render)

## Coût Total: 0€/mois

| Service | Rôle | Coût |
|---------|------|------|
| **Vercel** | Frontend React | Gratuit |
| **Render** | Backend + Socket.io | Gratuit |
| **Render** | PostgreSQL | Gratuit (90 jours) |

> **Note**: Le plan gratuit Render met le serveur en veille après 15min d'inactivité.
> La première requête prend ~30 secondes pour réveiller le serveur.

---

## Étape 1: Créer un compte sur les services

1. **GitHub**: https://github.com (pour héberger le code)
2. **Vercel**: https://vercel.com (connexion avec GitHub)
3. **Render**: https://render.com (connexion avec GitHub)

---

## Étape 2: Pousser le code sur GitHub

```bash
cd C:\Users\Manda\webApp\poker-mada

# Initialiser git
git init
git add .
git commit -m "Initial commit - Poker Mada"

# Créer le repo sur GitHub puis:
git remote add origin https://github.com/VOTRE-USERNAME/poker-mada.git
git branch -M main
git push -u origin main
```

---

## Étape 3: Déployer sur Render (Backend + DB)

### 3.1 Créer la base de données PostgreSQL

1. Aller sur https://dashboard.render.com
2. Cliquer **New** → **PostgreSQL**
3. Configurer:
   - Name: `poker-mada-db`
   - Database: `poker_mada`
   - User: `poker_user`
   - Plan: **Free**
4. Cliquer **Create Database**
5. **Copier** l'**Internal Database URL** (commence par `postgresql://`)

### 3.2 Déployer le Backend

1. Cliquer **New** → **Web Service**
2. Connecter votre repo GitHub `poker-mada`
3. Configurer:
   - Name: `poker-mada-api`
   - Root Directory: `server`
   - Environment: `Node`
   - Build Command: `npm ci && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && node dist/app.js`
   - Plan: **Free**

4. Ajouter les **Environment Variables**:

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | (coller l'URL copiée à l'étape 3.1) |
| `JWT_SECRET` | (cliquer Generate) |
| `JWT_REFRESH_SECRET` | (cliquer Generate) |
| `CLIENT_URL` | `https://poker-mada.vercel.app` |

5. Cliquer **Create Web Service**

6. **Attendre** le déploiement (~5 minutes)

7. **Copier l'URL** générée (ex: `https://poker-mada-api.onrender.com`)

---

## Étape 4: Déployer sur Vercel (Frontend)

### 4.1 Via l'interface web (plus simple)

1. Aller sur https://vercel.com/new
2. Importer le repo `poker-mada`
3. Configurer:
   - Framework Preset: `Vite`
   - Root Directory: `client`
4. Ajouter les **Environment Variables**:

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://poker-mada-api.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://poker-mada-api.onrender.com` |

5. Cliquer **Deploy**

### 4.2 Mettre à jour vercel.json

Après le premier déploiement, modifier `client/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://poker-mada-api.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Puis commit et push:
```bash
git add .
git commit -m "Update Render URL"
git push
```

Vercel redéploiera automatiquement.

---

## Étape 5: Mettre à jour CLIENT_URL sur Render

1. Retourner sur Render Dashboard
2. Aller dans votre service `poker-mada-api`
3. **Environment** → Modifier `CLIENT_URL`
4. Mettre: `https://poker-mada.vercel.app` (votre URL Vercel exacte)
5. Cliquer **Save Changes** (redéploiement automatique)

---

## URLs Finales

| Service | URL |
|---------|-----|
| **Frontend** | https://poker-mada.vercel.app |
| **API** | https://poker-mada-api.onrender.com/api |
| **Health Check** | https://poker-mada-api.onrender.com/api/health |

---

## Tester le Déploiement

1. Ouvrir https://poker-mada.vercel.app
2. Créer un compte (Register)
3. Se connecter (Login)
4. Aller dans le Lobby
5. Voir les 3 tables disponibles

---

## Garder le Serveur Éveillé (Optionnel)

Pour éviter le délai de 30 secondes au réveil, utiliser un service de ping gratuit:

1. Aller sur https://uptimerobot.com (gratuit)
2. Créer un monitor HTTP(s)
3. URL: `https://poker-mada-api.onrender.com/api/health`
4. Interval: 5 minutes

Cela garde le serveur éveillé en le "pingant" toutes les 5 minutes.

---

## Limites du Plan Gratuit

| Service | Limite |
|---------|--------|
| **Render Web** | Sleep après 15min, 750h/mois |
| **Render PostgreSQL** | 90 jours, puis supprimé |
| **Vercel** | 100GB bandwidth/mois |

> **Pour la production**: Passer à Render Starter (7$/mois) pour un serveur toujours actif.
