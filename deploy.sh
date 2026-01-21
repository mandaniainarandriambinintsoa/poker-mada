#!/bin/bash

# ================================================
# Script de déploiement - Poker Mada
# ================================================

set -e

echo "========================================="
echo "  Déploiement Poker Mada"
echo "========================================="

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "Docker n'est pas installé. Installation..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose n'est pas installé. Installation..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Charger les variables d'environnement
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "Variables d'environnement chargées"
else
    echo "ERREUR: .env.production non trouvé!"
    exit 1
fi

# Arrêter les anciens conteneurs
echo "Arrêt des anciens conteneurs..."
docker-compose down || true

# Construire les images
echo "Construction des images Docker..."
docker-compose build --no-cache

# Démarrer les services
echo "Démarrage des services..."
docker-compose up -d

# Attendre que la base de données soit prête
echo "Attente de la base de données..."
sleep 10

# Vérifier le statut
echo ""
echo "========================================="
echo "  Statut des services"
echo "========================================="
docker-compose ps

echo ""
echo "========================================="
echo "  Déploiement terminé!"
echo "========================================="
echo "  Frontend: http://localhost (ou votre domaine)"
echo "  API: http://localhost/api"
echo "  API Health: http://localhost/api/health"
echo "========================================="

# Afficher les logs
echo ""
echo "Pour voir les logs: docker-compose logs -f"
