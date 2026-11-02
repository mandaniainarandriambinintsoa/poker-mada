import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { createAccessToken, createRefreshToken, hashRefreshToken } from '../security/tokens';

const SALT_ROUNDS = 12;
const STARTING_BALANCE = config.nodeEnv === 'production' ? 0 : 10000;
const googleClient = config.google.clientId ? new OAuth2Client(config.google.clientId) : null;

interface TokenPair {
  token: string;
  refreshToken: string;
}

interface UserData {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  createdAt: Date;
}

export class AuthService {
  async register(
    username: string,
    email: string,
    password: string,
    phone: string,
  ): Promise<{ user: UserData; tokens: TokenPair }> {
    // Vérifier si l'email existe déjà
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingEmail) {
      throw new AppError('Cet email est déjà utilisé', 409, 'EMAIL_EXISTS');
    }

    // Vérifier si le username existe déjà
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw new AppError("Ce nom d'utilisateur est déjà pris", 409, 'USERNAME_EXISTS');
    }

    // Vérifier si le téléphone existe déjà
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new AppError('Ce numéro de téléphone est déjà utilisé', 409, 'PHONE_EXISTS');
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Créer l'utilisateur et son portefeuille avec jetons de départ
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        phone,
        authProvider: 'LOCAL',
        wallet: {
          create: {
            balance: STARTING_BALANCE,
            frozenBalance: 0,
          },
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        authProvider: true,
        createdAt: true,
      },
    });

    // Générer les tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: UserData; tokens: TokenPair }> {
    // Trouver l'utilisateur
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        authProvider: true,
        createdAt: true,
        passwordHash: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (!user) {
      throw new AppError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Compte désactivé', 403, 'ACCOUNT_DISABLED');
    }

    if (user.isBanned) {
      throw new AppError('Compte banni', 403, 'ACCOUNT_BANNED');
    }

    // Vérifier si l'utilisateur utilise OAuth
    if (user.authProvider !== 'LOCAL') {
      throw new AppError(
        'Ce compte utilise Google. Veuillez vous connecter avec Google.',
        400,
        'USE_OAUTH',
      );
    }

    // Vérifier le mot de passe
    if (!user.passwordHash) {
      throw new AppError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
    }
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
    }

    // Mettre à jour la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Générer les tokens
    const tokens = await this.generateTokens(user.id, user.email);

    const {
      passwordHash: _passwordHash,
      isActive: _isActive,
      isBanned: _isBanned,
      ...userData
    } = user;
    return { user: userData, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const now = new Date();
    const tokenHash = hashRefreshToken(refreshToken);
    const replacement = createRefreshToken();

    const outcome = await prisma.$transaction(
      async (
        tx,
      ): Promise<
        | { tokens: TokenPair }
        | { error: { message: string; code: 'REFRESH_TOKEN_REUSED' | 'REFRESH_TOKEN_EXPIRED' } }
      > => {
        const storedToken = await tx.refreshToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });

        if (!storedToken) {
          throw new AppError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
        }

        if (storedToken.revokedAt || storedToken.usedAt) {
          await tx.refreshToken.updateMany({
            where: { familyId: storedToken.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
          return {
            error: {
              message: 'Session réutilisée et révoquée',
              code: 'REFRESH_TOKEN_REUSED',
            },
          };
        }

        if (
          storedToken.expiresAt <= now ||
          !storedToken.user.isActive ||
          storedToken.user.isBanned
        ) {
          await tx.refreshToken.updateMany({
            where: { familyId: storedToken.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
          return {
            error: {
              message: 'Session expirée ou révoquée',
              code: 'REFRESH_TOKEN_EXPIRED',
            },
          };
        }

        const consumed = await tx.refreshToken.updateMany({
          where: { id: storedToken.id, usedAt: null, revokedAt: null },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) {
          await tx.refreshToken.updateMany({
            where: { familyId: storedToken.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
          return {
            error: {
              message: 'Session réutilisée et révoquée',
              code: 'REFRESH_TOKEN_REUSED',
            },
          };
        }

        await tx.refreshToken.create({
          data: {
            tokenHash: replacement.tokenHash,
            familyId: storedToken.familyId,
            userId: storedToken.userId,
            expiresAt: this.refreshExpiry(now),
          },
        });

        return {
          tokens: {
            token: createAccessToken(storedToken.userId, storedToken.user.email),
            refreshToken: replacement.rawToken,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if ('error' in outcome) {
      throw new AppError(outcome.error.message, 401, outcome.error.code);
    }
    return outcome.tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const storedToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
        select: { familyId: true, userId: true },
      });
      if (storedToken?.userId === userId) {
        await prisma.refreshToken.updateMany({
          where: { familyId: storedToken.familyId, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } else {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async updateProfile(
    userId: string,
    data: { username?: string; phone?: string },
  ): Promise<UserData> {
    // Vérifier les unicités si les champs sont fournis
    if (data.username) {
      const existingUsername = await prisma.user.findFirst({
        where: { username: data.username, NOT: { id: userId } },
      });
      if (existingUsername) {
        throw new AppError("Ce nom d'utilisateur est déjà pris", 409, 'USERNAME_EXISTS');
      }
    }

    if (data.phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: data.phone, NOT: { id: userId } },
      });
      if (existingPhone) {
        throw new AppError('Ce numéro de téléphone est déjà utilisé', 409, 'PHONE_EXISTS');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.username && { username: data.username }),
        ...(data.phone && { phone: data.phone, phoneVerified: false }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Récupérer l'utilisateur avec le hash du mot de passe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
    }

    // Les utilisateurs OAuth ne peuvent pas changer leur mot de passe
    if (!user.passwordHash) {
      throw new AppError(
        'Les comptes Google ne peuvent pas modifier leur mot de passe',
        400,
        'OAUTH_USER',
      );
    }

    // Vérifier le mot de passe actuel
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Mot de passe actuel incorrect', 401, 'INVALID_PASSWORD');
    }

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Changer le secret révoque toutes les sessions existantes.
    await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash },
        });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 5000,
        maxWait: 5000,
      },
    );
  }

  async loginWithGoogle(idToken: string): Promise<{ user: UserData; tokens: TokenPair }> {
    if (!googleClient || !config.google.clientId) {
      throw new AppError('Connexion Google indisponible', 503, 'OAUTH_UNAVAILABLE');
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError('Jeton Google invalide', 401, 'INVALID_GOOGLE_TOKEN');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AppError('Identité Google non vérifiée', 401, 'UNVERIFIED_GOOGLE_IDENTITY');
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const avatar = payload.picture || null;
    const existingBySubject = await prisma.user.findUnique({ where: { googleId } });
    const existingByEmail = existingBySubject
      ? null
      : await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });

    if (existingByEmail?.authProvider !== undefined && existingByEmail.authProvider !== 'GOOGLE') {
      throw new AppError(
        'Ce courriel appartient déjà à un compte local. Connectez-vous avec son mot de passe.',
        409,
        'GOOGLE_ACCOUNT_CONFLICT',
      );
    }

    const existing = existingBySubject || existingByEmail;
    let user;
    if (existing) {
      if (!existing.isActive) {
        throw new AppError('Compte désactivé', 403, 'ACCOUNT_DISABLED');
      }
      if (existing.isBanned) {
        throw new AppError('Compte banni', 403, 'ACCOUNT_BANNED');
      }

      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId,
          authProvider: 'GOOGLE',
          lastLoginAt: new Date(),
          avatar: existing.avatar || avatar,
        },
      });
    } else {
      user = await this.createGoogleUser({
        email,
        googleId,
        avatar,
        displayName: payload.name || email.split('@')[0],
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    const {
      isActive: _isActive,
      isBanned: _isBanned,
      googleId: _,
      passwordHash: _passwordHash,
      ...userData
    } = user;
    return { user: userData, tokens };
  }

  private async createGoogleUser(input: {
    email: string;
    googleId: string;
    avatar: string | null;
    displayName: string;
  }) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await prisma.user.create({
          data: {
            username: this.generateUsername(input.displayName),
            email: input.email,
            googleId: input.googleId,
            authProvider: 'GOOGLE',
            avatar: input.avatar,
            wallet: { create: { balance: STARTING_BALANCE, frozenBalance: 0 } },
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
      }
    }
    throw new AppError('Impossible de créer le compte Google', 409, 'ACCOUNT_CREATION_CONFLICT');
  }

  private generateUsername(baseName: string): string {
    // Nettoyer le nom et ajouter un suffixe aléatoire
    const cleanName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${cleanName}_${suffix}`;
  }

  private async generateTokens(userId: string, email: string): Promise<TokenPair> {
    const token = createAccessToken(userId, email);
    const refreshToken = createRefreshToken();
    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshToken.tokenHash,
        familyId: randomUUID(),
        userId,
        expiresAt: this.refreshExpiry(new Date()),
      },
    });

    return { token, refreshToken: refreshToken.rawToken };
  }

  private refreshExpiry(from: Date): Date {
    const match = /^(\d+)d$/.exec(config.jwt.refreshExpiresIn);
    const days = match ? Number.parseInt(match[1], 10) : 7;
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }
}

export const authService = new AuthService();
