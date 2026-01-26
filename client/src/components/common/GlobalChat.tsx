import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

interface OnlineUser {
  odId: string;
  username: string;
  avatar?: string;
  status: 'lobby' | 'playing';
  tableId?: string;
}

interface ChatMessage {
  id: string;
  odId: string;
  username: string;
  avatar?: string;
  message: string;
  timestamp: number;
}

interface GlobalChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalChat({ isOpen, onClose }: GlobalChatProps) {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'users'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Récupérer la liste des utilisateurs et l'historique des messages
    socket.emit('global:get-users');
    socket.emit('global:get-messages');

    // Écouter les mises à jour
    socket.on('users:list', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on('users:update', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on('global:messages-history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('global:chat-message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off('users:list');
      socket.off('users:update');
      socket.off('global:messages-history');
      socket.off('global:chat-message');
    };
  }, [socket, isConnected]);

  // Auto-scroll vers le bas quand un nouveau message arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newMessage.trim()) return;

    socket.emit('global:chat-send', { message: newMessage.trim() });
    setNewMessage('');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'playing' ? 'bg-yellow-500' : 'bg-green-500';
  };

  const getStatusText = (status: string) => {
    return status === 'playing' ? 'En jeu' : 'Lobby';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-800 w-full sm:max-w-lg h-[85vh] sm:h-[600px] sm:rounded-xl flex flex-col animate-slide-up sm:animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Chat Global</h2>
            <span className="bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full text-sm">
              {onlineUsers.length} en ligne
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-poker-gold border-b-2 border-poker-gold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-poker-gold border-b-2 border-poker-gold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Joueurs ({onlineUsers.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'chat' ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  Aucun message. Soyez le premier !
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.odId === user?.id ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {msg.avatar ? (
                        <img
                          src={msg.avatar}
                          alt={msg.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-poker-gold/20 flex items-center justify-center text-poker-gold font-bold text-sm">
                          {msg.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Message */}
                    <div className={`max-w-[75%] ${msg.odId === user?.id ? 'items-end' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${msg.odId === user?.id ? 'text-poker-gold' : 'text-gray-300'}`}>
                          {msg.odId === user?.id ? 'Vous' : msg.username}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          msg.odId === user?.id
                            ? 'bg-poker-gold/20 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Votre message..."
                  maxLength={200}
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-poker-gold"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-poker-gold text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-poker-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Users List */
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {onlineUsers.map((onlineUser) => (
                <div
                  key={onlineUser.odId}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    onlineUser.odId === user?.id ? 'bg-poker-gold/10' : 'bg-gray-700/50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    {onlineUser.avatar ? (
                      <img
                        src={onlineUser.avatar}
                        alt={onlineUser.username}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-poker-gold/20 flex items-center justify-center text-poker-gold font-bold">
                        {onlineUser.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {/* Status indicator */}
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(
                        onlineUser.status
                      )}`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {onlineUser.username}
                      </span>
                      {onlineUser.odId === user?.id && (
                        <span className="text-xs text-poker-gold">(vous)</span>
                      )}
                    </div>
                    <span className={`text-xs ${onlineUser.status === 'playing' ? 'text-yellow-400' : 'text-green-400'}`}>
                      {getStatusText(onlineUser.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
