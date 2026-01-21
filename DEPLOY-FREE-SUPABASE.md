# Déploiement 100% GRATUIT (Vercel + Render + Supabase)

## Stack Gratuite Sans Expiration

| Service | Rôle | Coût | Limite |
|---------|------|------|--------|
| **Vercel** | Frontend React | Gratuit | 100GB/mois |
| **Render** | Backend + Socket.io | Gratuit | Sleep après 15min |
| **Supabase** | PostgreSQL | Gratuit | 500MB, illimité |

---

## Étape 1: Créer la Base de Données sur Supabase

### 1.1 Créer un compte

1. Aller sur https://supabase.com
2. Cliquer **Start your project** → Se connecter avec GitHub

### 1.2 Créer un nouveau projet

1. Cliquer **New Project**
2. Configurer:
   - **Organization**: Votre organisation (ou en créer une)
   - **Name**: `poker-mada`
   - **Database Password**: Générer un mot de passe fort et **LE NOTER**
   - **Region**: Choisir le plus proche (ex: Frankfurt pour Europe/Afrique)
   - **Plan**: Free

3. Cliquer **Create new project**
4. Attendre ~2 minutes que le projet soit créé

### 1.3 Obtenir l'URL de connexion

1. Aller dans **Project Settings** (icône engrenage en bas à gauche)
2. Cliquer **Database**
3. Sous **Connection string**, choisir **URI**
4. Copier l'URL qui ressemble à:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
5. **Remplacer `[PASSWORD]`** par le mot de passe que vous avez noté

> **Important**: Utilisez le port `6543` (pooler) et non `5432` pour éviter les problèmes de connexion.

---

## Étape 2: Pousser le Code sur GitHub

```bash
cd C:\Users\Manda\webApp\poker-mada

# Initialiser git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit - Poker Mada"

# Créer un repo sur GitHub: https://github.com/new
# Nom: poker-mada
# Visibilité: Public ou Private

# Connecter et pousser
git remote add origin https://github.com/VOTRE-USERNAME/poker-mada.git
git branch -M main
git push -u origin main
```

---

## Étape 3: Déployer le Backend sur Render

### 3.1 Créer le service

1. Aller sur https://dashboard.render.com
2. Cliquer **New** → **Web Service**
3. Connecter votre compte GitHub si pas fait
4. Sélectionner le repo `poker-mada`

### 3.2 Configurer le service

| Paramètre | Valeur |
|-----------|--------|
| **Name** | `poker-mada-api` |
| **Root Directory** | `server` |
| **Environment** | `Node` |
| **Build Command** | `npm ci && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && node dist/app.js` |
| **Plan** | **Free** |

### 3.3 Ajouter les Variables d'Environnement

Cliquer **Advanced** → **Add Environment Variable**:

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `JWT_SECRET` | Cliquer **Generate** |
| `JWT_REFRESH_SECRET` | Cliquer **Generate** |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://poker-mada.vercel.app` |

> **Note**: Ajoutez `?pgbouncer=true` à la fin de DATABASE_URL pour Supabase

### 3.4 Créer le service

1. Cliquer **Create Web Service**
2. Attendre le déploiement (~5-10 minutes)
3. **Copier l'URL** générée (ex: `https://poker-mada-api.onrender.com`)

### 3.5 Vérifier le déploiement

Ouvrir dans le navigateur:
```
https://poker-mada-api.onrender.com/api/health
```

Vous devriez voir:
```json
{"status":"ok","timestamp":"..."}
```

---

## Étape 4: Déployer le Frontend sur Vercel

### 4.1 Importer le projet

1. Aller sur https://vercel.com/new
2. Cliquer **Import** à côté de votre repo `poker-mada`

### 4.2 Configurer le projet

| Paramètre | Valeur |
|-----------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `client` |

### 4.3 Ajouter les Variables d'Environnement

Cliquer **Environment Variables** et ajouter:

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://poker-mada-api.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://poker-mada-api.onrender.com` |

### 4.4 Déployer

1. Cliquer **Deploy**
2. Attendre ~2 minutes
3. **Copier l'URL** (ex: `https://poker-mada.vercel.app`)

---

## Étape 5: Finaliser la Configuration

### 5.1 Mettre à jour CLIENT_URL sur Render

1. Retourner sur https://dashboard.render.com
2. Ouvrir `poker-mada-api`
3. Aller dans **Environment**
4. Modifier `CLIENT_URL` avec votre URL Vercel exacte
5. Cliquer **Save Changes**

### 5.2 Mettre à jour vercel.json (si nécessaire)

Si les appels API ne fonctionnent pas, modifier `client/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://poker-mada-api.onrender.com/api/:path*"
    }
  ]
}
```

Puis commit et push:
```bash
git add .
git commit -m "Update API URL"
git push
```

---

## Étape 6: Tester l'Application

1. Ouvrir https://poker-mada.vercel.app
2. Cliquer **S'inscrire**
3. Créer un compte avec:
   - Nom d'utilisateur
   - Email
   - Téléphone (format: 0341234567)
   - Mot de passe (min 8 caractères, 1 majuscule, 1 chiffre)
4. Vous serez redirigé vers le **Lobby**
5. Voir les 3 tables de poker disponibles

---

## Garder le Serveur Actif (Recommandé)

Le plan gratuit Render met le serveur en veille après 15 minutes. Pour éviter ça:

### Option 1: UptimeRobot (Gratuit)

1. Créer un compte sur https://uptimerobot.com
2. **Add New Monitor**:
   - Monitor Type: HTTP(s)
   - Friendly Name: Poker Mada API
   - URL: `https://poker-mada-api.onrender.com/api/health`
   - Monitoring Interval: 5 minutes
3. Cliquer **Create Monitor**

### Option 2: Cron-job.org (Gratuit)

1. Créer un compte sur https://cron-job.org
2. Créer un nouveau cron job:
   - URL: `https://poker-mada-api.onrender.com/api/health`
   - Schedule: Every 5 minutes

---

## Récapitulatif des URLs

| Service | URL |
|---------|-----|
| **Frontend** | https://poker-mada.vercel.app |
| **Backend API** | https://poker-mada-api.onrender.com/api |
| **Health Check** | https://poker-mada-api.onrender.com/api/health |
| **Supabase Dashboard** | https://supabase.com/dashboard |

---

## Commandes Utiles

```bash
# Voir les logs Render
# → Dashboard Render → Logs

# Accéder à la DB Supabase
# → Dashboard Supabase → SQL Editor

# Redéployer Vercel
git add . && git commit -m "Update" && git push

# Redéployer Render
# → Dashboard Render → Manual Deploy → Deploy latest commit
```

---

## Dépannage

### "Cannot connect to database"
- Vérifier que `?pgbouncer=true` est dans DATABASE_URL
- Vérifier le mot de passe Supabase

### "CORS error"
- Vérifier que CLIENT_URL sur Render = URL Vercel exacte

### "Socket.io ne se connecte pas"
- Vérifier VITE_SOCKET_URL (sans /api à la fin)

### "Le serveur met du temps à répondre"
- Normal pour le plan gratuit Render (réveil ~30 sec)
- Configurer UptimeRobot pour garder le serveur actif

---

## Limites des Plans Gratuits

| Service | Limite |
|---------|--------|
| **Supabase** | 500MB database, 50k requêtes/mois |
| **Render** | 750h/mois, sleep après 15min |
| **Vercel** | 100GB bandwidth/mois |

Pour la production avec plus de trafic, prévoir ~15$/mois (Render Starter + Supabase Pro).
