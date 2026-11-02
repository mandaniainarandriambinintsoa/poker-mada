# Build stage
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder

WORKDIR /app

# Prisma 5 requires an OpenSSL implementation both when generating its client
# and when loading the native query engine at runtime.
RUN apk add --no-cache openssl

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
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS production

WORKDIR /app

RUN apk add --no-cache openssl

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
# Apply reviewed migrations separately before release; startup must not alter production data.
CMD ["node", "dist/app.js"]
