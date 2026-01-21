import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/lobby" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-poker-gold">Poker Mada</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link to="/lobby" className="text-gray-300 hover:text-white transition-colors">
            Lobby
          </Link>
          <Link to="/wallet" className="text-gray-300 hover:text-white transition-colors">
            Portefeuille
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connecté' : 'Déconnecté'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-white font-medium">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
