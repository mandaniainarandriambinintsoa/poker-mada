import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { z } from 'zod';
import { api, getErrorMessage } from '../services/api';
import { clearAccessToken, refreshAccessToken, setAccessToken } from '../services/session';

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatar: z.string().nullable().optional(),
  role: z.enum(['PLAYER', 'ADMIN', 'SUPER_ADMIN']),
});
const sessionSchema = z.object({
  user: userSchema,
  token: z.string().min(1),
});
type User = z.infer<typeof userSchema>;
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, phone: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void refreshAccessToken()
      .then(() => api.get('/auth/me', { signal: controller.signal }))
      .then((response) => {
        if (!controller.signal.aborted) setUser(userSchema.parse(response.data.user));
      })
      .catch(() => {
        if (!controller.signal.aborted) clearAccessToken();
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);
  const saveSession = useCallback((data: unknown) => {
    const session = sessionSchema.parse(data);
    setAccessToken(session.token);
    setUser(session.user);
  }, []);
  const login = async (email: string, password: string) => {
    setError(null);
    try {
      saveSession((await api.post('/auth/login', { email, password })).data);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  };
  const register = async (username: string, email: string, password: string, phone: string) => {
    setError(null);
    try {
      saveSession((await api.post('/auth/register', { username, email, password, phone })).data);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  };
  const refreshProfile = async () => {
    setUser(userSchema.parse((await api.get('/auth/me')).data.user));
  };
  const loginWithGoogle = async (credential: string) => {
    setError(null);
    try {
      saveSession((await api.post('/auth/google/callback', { credential })).data);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  };
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAccessToken();
      setUser(null);
      setError(null);
    }
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
        login,
        register,
        loginWithGoogle,
        logout,
        refreshProfile,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider manquant');
  return context;
}
