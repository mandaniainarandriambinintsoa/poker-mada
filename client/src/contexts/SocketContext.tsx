import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { getAccessToken } from '../services/session';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}
const SocketContext = createContext<SocketContextType | undefined>(undefined);
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) {
      setSocket(null);
      setIsConnected(false);
      return;
    }
    let active = true;
    let refreshing = false;
    const connection = io(SOCKET_URL, {
      auth: (done) => done({ token: getAccessToken() }),
      transports: ['websocket', 'polling'],
    });
    connection.on('connect', () => setIsConnected(true));
    connection.on('disconnect', () => setIsConnected(false));
    connection.on('connect_error', async () => {
      setIsConnected(false);
      if (refreshing || !active) return;
      refreshing = true;
      try {
        await api.get('/auth/me');
        if (active && !connection.connected) connection.connect();
      } catch {
        /* The HTTP interceptor handles an expired session; the disconnected state remains visible. */
      } finally {
        refreshing = false;
      }
    });
    connection.on('reconnect-required', () => {
      connection.disconnect();
      void api
        .get('/auth/me')
        .then(() => connection.connect())
        .catch(() => logout().finally(() => navigate('/login', { replace: true })));
    });
    connection.on('auth:revoked', () => {
      void logout().finally(() => navigate('/login', { replace: true }));
    });
    connection.on('player:already-at-table', (data: { tableId: string }) =>
      navigate(`/game/${data.tableId}`, { replace: true }),
    );
    setSocket(connection);
    return () => {
      active = false;
      connection.removeAllListeners();
      connection.disconnect();
      setIsConnected(false);
    };
  }, [isAuthenticated, logout, navigate]);
  return (
    <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
  );
}
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('SocketProvider manquant');
  return context;
}
