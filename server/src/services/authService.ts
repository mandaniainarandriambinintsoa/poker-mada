import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

const SALT_ROUNDS = 12;
const STARTING_BALANCE = 10000; // Jetons de départ gratuits

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
    const user = await prisma.user.findUnique({
      where: { email },
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
      throw new AppError('Ce compte utilise Google. Veuillez vous connecter avec Google.', 400, 'USE_OAUTH');
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

  async updateProfile(
    userId: string,
    data: { username?: string; email?: string; phone?: string }
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

    if (data.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id: userId } },
      });
      if (existingEmail) {
        throw new AppError('Cet email est déjà utilisé', 409, 'EMAIL_EXISTS');
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
        ...(data.email && { email: data.email }),
        ...(data.phone && { phone: data.phone }),
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
    newPassword: string
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
      throw new AppError('Les comptes Google ne peuvent pas modifier leur mot de passe', 400, 'OAUTH_USER');
    }

    // Vérifier le mot de passe actuel
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Mot de passe actuel incorrect', 401, 'INVALID_PASSWORD');
    }

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async getGoogleAuthUrl(): Promise<string> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${config.clientUrl}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error || !data.url) {
      throw new AppError('Erreur lors de la génération du lien Google', 500, 'OAUTH_ERROR');
    }

    return data.url;
  }

  async loginWithGoogle(accessToken: string): Promise<{ user: UserData; tokens: TokenPair }> {
    // Vérifier le token avec Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.getUser(accessToken);

    if (supabaseError || !supabaseData.user) {
      throw new AppError('Token Google invalide', 401, 'INVALID_GOOGLE_TOKEN');
    }

    const googleUser = supabaseData.user;
    const email = googleUser.email;
    const googleId = googleUser.id;

    if (!email) {
      throw new AppError('Email non disponible depuis Google', 400, 'NO_EMAIL');
    }

    // Chercher l'utilisateur existant
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        authProvider: true,
        googleId: true,
        createdAt: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (user) {
      // Utilisateur existant
      if (!user.isActive) {
        throw new AppError('Compte désactivé', 403, 'ACCOUNT_DISABLED');
      }

      if (user.isBanned) {
        throw new AppError('Compte banni', 403, 'ACCOUNT_BANNED');
      }

      // Si l'utilisateur existe avec cet email mais sans googleId, lier le compte
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            authProvider: 'GOOGLE',
            avatar: user.avatar || googleUser.user_metadata?.avatar_url,
          },
        });
      }

      // Mettre à jour la dernière connexion et avatar si nécessaire
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          avatar: user.avatar || googleUser.user_metadata?.avatar_url,
        },
      });
    } else {
      // Créer un nouvel utilisateur
      const username = this.generateUsername(googleUser.user_metadata?.full_name || email.split('@')[0]);

      user = await prisma.user.create({
        data: {
          username,
          email,
          googleId,
          authProvider: 'GOOGLE',
          avatar: googleUser.user_metadata?.avatar_url,
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
          googleId: true,
          createdAt: true,
          isActive: true,
          isBanned: true,
        },
      });
    }

    // Générer les tokens
    const tokens = await this.generateTokens(user.id, user.email);

    const { isActive, isBanned, googleId: _, ...userData } = user;
    return { user: userData, tokens };
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
