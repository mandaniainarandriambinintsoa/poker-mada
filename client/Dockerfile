# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Arguments de build
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=

# Définir les variables d'environnement pour le build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Build de production
RUN npm run build

# Production stage avec Nginx
FROM nginx:alpine AS production

# Copier la configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposer les ports
EXPOSE 80 443

# Commande de démarrage
CMD ["nginx", "-g", "daemon off;"]
