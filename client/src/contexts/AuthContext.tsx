import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, getErrorMessage } from '../services/api';
import { supabase } from '../config/supabase';

interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'PLAYER' | 'ADMIN' | 'SUPER_ADMIN';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  handleGoogleCallback: () => Promise<void>;
  register: (username: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, token, refreshToken } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, phone: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/register', { username, email, password, phone });
      const { user, token, refreshToken } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion Google';
      setError(message);
      throw new Error(message);
    }
  };

  const handleGoogleCallback = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Méthode 1: Extraire les tokens depuis l'URL hash (ancien format)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      let accessToken = hashParams.get('access_token');

      // Méthode 2: Si pas de token dans le hash, vérifier les query params (PKCE flow)
      if (!accessToken) {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          // Échanger le code contre une session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError || !data.session) {
            throw new Error('Erreur lors de l\'échange du code: ' + (exchangeError?.message || 'Session invalide'));
          }

          accessToken = data.session.access_token;
        }
      }

      // Méthode 3: Essayer de récupérer la session existante
      if (!accessToken) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!sessionError && session) {
          accessToken = session.access_token;
        }
      }

      if (!accessToken) {
        throw new Error('Impossible de récupérer le token Google. Veuillez réessayer.');
      }

      // Envoyer le token au backend pour créer/lier le compte
      const response = await api.post('/auth/google/callback', {
        access_token: accessToken,
      });

      const { user, token, refreshToken } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);

      // Nettoyer l'URL
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const clearError = () => setError(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isSuperAdmin,
        login,
        loginWithGoogle,
        handleGoogleCallback,
        register,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
