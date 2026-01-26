import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import GlobalChat from '../components/common/GlobalChat';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../services/api';

interface TableInfo {
  id: string;
  name: string;
  tier: 'SMALL' | 'MEDIUM' | 'HIGH';
  minBuyIn: number;
  maxBuyIn: number;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  currentPlayers: number;
  isActive: boolean;
}

interface WalletBalance {
  balance: number;
  frozenBalance: number;
  availableBalance: number;
}

function formatAriary(amount: number): string {
  return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
}

export default function LobbyPage() {
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    console.log('[LobbyPage] Effect running, socket:', !!socket, 'isConnected:', isConnected);
    if (!socket || !isConnected) return;

    console.log('[LobbyPage] Emitting lobby:join and lobby:get-tables');
    socket.emit('lobby:join');
    socket.emit('lobby:get-tables');

    socket.on('lobby:tables-update', (updatedTables: TableInfo[]) => {
      console.log('[LobbyPage] Received tables:', updatedTables);
      setTables(updatedTables);
    });

    socket.on('table:joined', (data) => {
      navigate(`/game/${data.tableId}`);
    });

    socket.on('table:error', (data) => {
      setError(data.message);
      setIsJoining(false);
    });

    // Si le joueur est déjà à une table, le rediriger
    socket.on('player:already-at-table', (data: { tableId: string }) => {
      console.log('[LobbyPage] Player already at table, redirecting to:', data.tableId);
      navigate(`/game/${data.tableId}`);
    });

    return () => {
      socket.emit('lobby:leave');
      socket.off('lobby:tables-update');
      socket.off('table:joined');
      socket.off('table:error');
      socket.off('player:already-at-table');
    };
  }, [socket, isConnected, navigate]);

  const fetchBalance = async () => {
    try {
      const response = await api.get('/wallet/balance');
      setBalance(response.data);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  const handleJoinTable = () => {
    if (!socket || !selectedTable || buyInAmount < selectedTable.minBuyIn) return;

    setError('');
    setIsJoining(true);
    socket.emit('table:join', { tableId: selectedTable.id, buyIn: buyInAmount });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'SMALL':
        return 'bg-green-600';
      case 'MEDIUM':
        return 'bg-blue-600';
      case 'HIGH':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'SMALL':
        return 'Débutant';
      case 'MEDIUM':
        return 'Intermédiaire';
      case 'HIGH':
        return 'High Roller';
      default:
        return tier;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Lobby</h1>
          {balance && (
            <div className="bg-gray-800 rounded-lg px-4 sm:px-6 py-2 sm:py-3 w-full sm:w-auto">
              <span className="text-gray-400 text-sm sm:text-base">Solde disponible: </span>
              <span className="text-poker-gold font-bold text-lg sm:text-xl">
                {formatAriary(balance.availableBalance)}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`card cursor-pointer transition-all hover:ring-2 hover:ring-poker-gold ${
                selectedTable?.id === table.id ? 'ring-2 ring-poker-gold' : ''
              }`}
              onClick={() => {
                setSelectedTable(table);
                setBuyInAmount(table.minBuyIn);
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white">{table.name}</h3>
                <span className={`${getTierColor(table.tier)} px-3 py-1 rounded-full text-sm`}>
                  {getTierLabel(table.tier)}
                </span>
              </div>

              <div className="space-y-2 text-gray-300">
                <div className="flex justify-between">
                  <span>Blinds:</span>
                  <span>
                    {formatAriary(table.smallBlind)} / {formatAriary(table.bigBlind)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cave:</span>
                  <span>
                    {formatAriary(table.minBuyIn)} - {formatAriary(table.maxBuyIn)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Joueurs:</span>
                  <span>
                    {table.currentPlayers} / {table.maxPlayers}
                  </span>
                </div>
              </div>

              {balance && balance.availableBalance < table.minBuyIn && (
                <div className="mt-4 text-red-400 text-sm">Solde insuffisant</div>
              )}
            </div>
          ))}
        </div>

        {/* Modal de join - Responsive */}
        {selectedTable && (
          <div
            className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedTable(null);
            }}
          >
            <div className="card w-full sm:max-w-md rounded-t-2xl sm:rounded-xl animate-slide-up sm:animate-fade-in">
              {/* Handle bar pour mobile */}
              <div className="flex justify-center mb-2 sm:hidden">
                <div className="w-12 h-1.5 bg-gray-600 rounded-full"></div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
                Rejoindre {selectedTable.name}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Montant du buy-in
                  </label>
                  <input
                    type="range"
                    min={selectedTable.minBuyIn}
                    max={Math.min(selectedTable.maxBuyIn, balance?.availableBalance || 0)}
                    value={buyInAmount}
                    onChange={(e) => setBuyInAmount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-poker-gold"
                  />
                  <div className="flex justify-between text-sm text-gray-400 mt-2">
                    <span>{formatAriary(selectedTable.minBuyIn)}</span>
                    <span className="text-poker-gold font-bold text-base">{formatAriary(buyInAmount)}</span>
                    <span>{formatAriary(selectedTable.maxBuyIn)}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="btn btn-secondary flex-1 py-3"
                    disabled={isJoining}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleJoinTable}
                    className="btn btn-primary flex-1 py-3"
                    disabled={
                      isJoining ||
                      !balance ||
                      balance.availableBalance < selectedTable.minBuyIn
                    }
                  >
                    {isJoining ? 'Connexion...' : 'Rejoindre'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bouton flottant Chat Global */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 bg-poker-gold text-gray-900 p-4 rounded-full shadow-lg hover:bg-poker-gold/90 transition-all hover:scale-105 z-40"
        title="Chat Global"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      </button>

      {/* Modal Chat Global */}
      <GlobalChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
