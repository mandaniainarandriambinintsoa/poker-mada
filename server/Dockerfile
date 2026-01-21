# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Générer le client Prisma
RUN npx prisma generate

# Compiler TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copier les dépendances de production
COPY package*.json ./
RUN npm ci --only=production

# Copier le client Prisma généré
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copier le code compilé
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Changer l'utilisateur
USER nodejs

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
