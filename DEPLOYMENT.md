# Guide de Déploiement - Poker Mada

## Options de Déploiement

### Option 1: VPS (Recommandé pour Madagascar)

**Fournisseurs recommandés:**
- **Hetzner** - ~5€/mois (CX21: 2 vCPU, 4GB RAM)
- **DigitalOcean** - ~6$/mois (Basic Droplet)
- **Contabo** - ~5€/mois (VPS S)

**Configuration minimale:**
- 2 vCPU
- 4 GB RAM
- 40 GB SSD
- Ubuntu 22.04 LTS

### Option 2: Services Cloud

| Service | Frontend | Backend | Base de données | Prix/mois |
|---------|----------|---------|-----------------|-----------|
| **Railway** | - | ✅ | ✅ PostgreSQL | ~10$ |
| **Render** | ✅ | ✅ | ✅ PostgreSQL | ~15$ |
| **Vercel + Railway** | ✅ | ✅ | ✅ | ~12$ |

---

## Déploiement sur VPS avec Docker

### 1. Préparer le serveur

```bash
# Se connecter au serveur
ssh root@votre-ip

# Mettre à jour le système
apt update && apt upgrade -y

# Installer les outils essentiels
apt install -y git curl wget ufw

# Configurer le firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 2. Installer Docker

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Installer Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Vérifier l'installation
docker --version
docker-compose --version
```

### 3. Cloner le projet

```bash
# Créer le dossier
mkdir -p /var/www
cd /var/www

# Cloner le repo (ou copier les fichiers)
git clone https://github.com/votre-repo/poker-mada.git
cd poker-mada
```

### 4. Configurer l'environnement

```bash
# Copier et éditer la configuration
cp .env.production .env

# Éditer avec vos valeurs
nano .env
```

**Variables importantes à modifier:**
```env
JWT_SECRET=votre_secret_genere_avec_openssl_rand_base64_64
JWT_REFRESH_SECRET=autre_secret_genere
CLIENT_URL=https://votre-domaine.mg
```

### 5. Déployer

```bash
# Rendre le script exécutable
chmod +x deploy.sh

# Lancer le déploiement
./deploy.sh
```

### 6. Configurer SSL avec Let's Encrypt (HTTPS)

```bash
# Installer Certbot
apt install -y certbot python3-certbot-nginx

# Obtenir le certificat
certbot --nginx -d votre-domaine.mg -d www.votre-domaine.mg

# Renouvellement automatique (déjà configuré)
certbot renew --dry-run
```

---

## Configuration Nginx pour Production (avec SSL)

Créez `/etc/nginx/sites-available/pokermada`:

```nginx
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name pokermada.mg www.pokermada.mg;
    return 301 https://$server_name$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name pokermada.mg www.pokermada.mg;

    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/pokermada.mg/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pokermada.mg/privkey.pem;

    # Configuration SSL sécurisée
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Proxy vers le conteneur frontend
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Activer le site:
```bash
ln -s /etc/nginx/sites-available/pokermada /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Commandes Utiles

### Gestion des conteneurs

```bash
# Voir les logs
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f backend

# Redémarrer un service
docker-compose restart backend

# Arrêter tout
docker-compose down

# Reconstruire et redémarrer
docker-compose up -d --build
```

### Base de données

```bash
# Accéder à PostgreSQL
docker-compose exec postgres psql -U poker_user -d poker_mada

# Backup de la base
docker-compose exec postgres pg_dump -U poker_user poker_mada > backup.sql

# Restaurer un backup
cat backup.sql | docker-compose exec -T postgres psql -U poker_user poker_mada
```

### Monitoring

```bash
# Utilisation des ressources
docker stats

# Espace disque des volumes
docker system df
```

---

## Intégration Mobile Money

### Orange Money Madagascar

1. Créer un compte marchand sur https://developer.orange.com
2. Obtenir les clés API
3. Configurer le webhook callback: `https://votre-domaine.mg/api/wallet/deposit/callback/orange`

### MVola (Telma)

1. Contacter Telma pour un compte marchand
2. Accéder au portail développeur: https://developer.mvola.mg
3. Configurer le webhook: `https://votre-domaine.mg/api/wallet/deposit/callback/mvola`

### Airtel Money

1. S'inscrire sur https://developers.airtel.africa
2. Demander l'accès à l'API Madagascar
3. Configurer le webhook: `https://votre-domaine.mg/api/wallet/deposit/callback/airtel`

---

## Checklist de Production

- [ ] Changer tous les secrets JWT
- [ ] Configurer les clés Mobile Money
- [ ] Activer HTTPS (SSL)
- [ ] Configurer les backups automatiques
- [ ] Configurer le monitoring (UptimeRobot, etc.)
- [ ] Tester le flux de paiement complet
- [ ] Configurer les alertes email/SMS

---

## Support

Pour toute question technique:
- Email: support@pokermada.mg
- GitHub Issues: https://github.com/votre-repo/poker-mada/issues
