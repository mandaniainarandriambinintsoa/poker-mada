import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const SALT_ROUNDS = 12;

interface TokenPair {
  token: string;
  refreshToken: string;
}

interface UserData {
  id: string;
  username: string;
  email: string;
  phone: string;
  avatar: string | null;
  createdAt: Date;
}

export class AuthService {
  async register(
    username: string,
    email: string,
    password: string,
    phone: string
  ): Promise<{ user: UserData; tokens: TokenPair }> {
    // Vérifier si l'email existe déjà
    const existingEmail = await prisma.user.findUnique({ where: { email } });
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

    // Créer l'utilisateur et son portefeuille
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        phone,
        wallet: {
          create: {
            balance: 0,
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
        createdAt: true,
      },
    });

    // Générer les tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: UserData; tokens: TokenPair }> {
    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
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

    // Vérifier le mot de passe
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

    const { passwordHash, isActive, isBanned, ...userData } = user;
    return { user: userData, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Vérifier le refresh token dans la base
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AppError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (storedToken.expiresAt < new Date()) {
      // Supprimer le token expiré
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new AppError('Refresh token expiré', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Supprimer l'ancien refresh token (rotation)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Générer de nouveaux tokens
    return this.generateTokens(storedToken.userId, storedToken.user.email);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Supprimer le refresh token spécifique
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken, userId },
      });
    } else {
      // Supprimer tous les refresh tokens de l'utilisateur
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  private async generateTokens(userId: string, email: string): Promise<TokenPair> {
    // Générer le JWT
    const token = jwt.sign({ userId, email }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string | number,
    } as jwt.SignOptions);

    // Générer le refresh token
    const refreshToken = uuidv4();

    // Calculer l'expiration du refresh token
    const expiresAt = new Date();
    const days = parseInt(config.jwt.refreshExpiresIn.replace('d', ''), 10) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    // Stocker le refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { token, refreshToken };
  }
}

export const authService = new AuthService();
