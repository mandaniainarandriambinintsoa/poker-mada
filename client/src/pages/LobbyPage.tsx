import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import { useSocket } from '../contexts/SocketContext';
import { api, getErrorMessage } from '../services/api';

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

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('lobby:join');
    socket.emit('lobby:get-tables');

    socket.on('lobby:tables-update', (updatedTables: TableInfo[]) => {
      setTables(updatedTables);
    });

    socket.on('table:joined', (data) => {
      navigate(`/game/${data.tableId}`);
    });

    socket.on('table:error', (data) => {
      setError(data.message);
      setIsJoining(false);
    });

    return () => {
      socket.emit('lobby:leave');
      socket.off('lobby:tables-update');
      socket.off('table:joined');
      socket.off('table:error');
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

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Lobby</h1>
          {balance && (
            <div className="bg-gray-800 rounded-lg px-6 py-3">
              <span className="text-gray-400">Solde disponible: </span>
              <span className="text-poker-gold font-bold text-xl">
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

        {/* Modal de join */}
        {selectedTable && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="card max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-white mb-4">Rejoindre {selectedTable.name}</h2>

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
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-400 mt-1">
                    <span>{formatAriary(selectedTable.minBuyIn)}</span>
                    <span className="text-poker-gold font-bold">{formatAriary(buyInAmount)}</span>
                    <span>{formatAriary(selectedTable.maxBuyIn)}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="btn btn-secondary flex-1"
                    disabled={isJoining}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleJoinTable}
                    className="btn btn-primary flex-1"
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
    </div>
  );
}
