import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi, AdminTransaction } from '../../services/adminApi';
import { getErrorMessage } from '../../services/api';

export default function AdminPendingPage() {
  const { user, logout } = useAuth();
  const [deposits, setDeposits] = useState<AdminTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [failReason, setFailReason] = useState('');
  const [failingTx, setFailingTx] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getPendingTransactions();
      setDeposits(data.deposits);
      setWithdrawals(data.withdrawals);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (transactionId: string) => {
    try {
      setActionLoading(transactionId);
      await adminApi.completeTransaction(transactionId);
      loadPending();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFail = async () => {
    if (!failingTx || !failReason) return;

    try {
      setActionLoading(failingTx);
      await adminApi.failTransaction(failingTx, failReason);
      setFailingTx(null);
      setFailReason('');
      loadPending();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount) + ' Ar';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProviderLabel = (provider: string | null) => {
    switch (provider) {
      case 'ORANGE_MONEY':
        return 'Orange Money';
      case 'MVOLA':
        return 'MVola';
      case 'AIRTEL_MONEY':
        return 'Airtel Money';
      default:
        return provider || '-';
    }
  };

  const TransactionCard = ({ tx, type }: { tx: AdminTransaction; type: 'deposit' | 'withdrawal' }) => (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className={`px-2 py-1 text-xs rounded ${
            type === 'deposit' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
          }`}>
            {type === 'deposit' ? 'Depot' : 'Retrait'}
          </span>
          <span className="ml-2 text-gray-400 text-sm">
            {formatDate(tx.createdAt)}
          </span>
        </div>
        <span className="text-2xl font-bold text-white">
          {formatMoney(tx.amount)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Joueur:</span>
          <p className="text-white">{tx.user.username}</p>
          <p className="text-gray-400 text-xs">{tx.user.email}</p>
        </div>
        <div>
          <span className="text-gray-400">Telephone:</span>
          <p className="text-white">{tx.phoneNumber || tx.user.phone}</p>
        </div>
        <div>
          <span className="text-gray-400">Operateur:</span>
          <p className="text-white">{getProviderLabel(tx.paymentProvider)}</p>
        </div>
        {tx.description && (
          <div>
            <span className="text-gray-400">Note:</span>
            <p className="text-white text-xs">{tx.description}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleComplete(tx.id)}
          disabled={actionLoading === tx.id}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {actionLoading === tx.id ? 'En cours...' : 'Confirmer'}
        </button>
        <button
          onClick={() => setFailingTx(tx.id)}
          disabled={actionLoading === tx.id}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Admin Poker Mada</h1>
            <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">
              {user?.role}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/lobby" className="text-gray-400 hover:text-white text-sm">
              Retour au jeu
            </Link>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white text-sm"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            <Link
              to="/admin"
              className="py-3 px-2 text-gray-400 hover:text-white border-b-2 border-transparent"
            >
              Dashboard
            </Link>
            <Link
              to="/admin/users"
              className="py-3 px-2 text-gray-400 hover:text-white border-b-2 border-transparent"
            >
              Joueurs
            </Link>
            <Link
              to="/admin/pending"
              className="py-3 px-2 text-white border-b-2 border-yellow-500 font-medium"
            >
              En attente
            </Link>
            <Link
              to="/admin/transactions"
              className="py-3 px-2 text-gray-400 hover:text-white border-b-2 border-transparent"
            >
              Transactions
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Chargement...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400">{error}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Deposits */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">
                  Depots en attente
                </h2>
                <span className="px-2 py-1 text-sm bg-green-900 text-green-300 rounded">
                  {deposits.length}
                </span>
              </div>

              {deposits.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                  <p className="text-gray-400">Aucun depot en attente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deposits.map((tx) => (
                    <TransactionCard key={tx.id} tx={tx} type="deposit" />
                  ))}
                </div>
              )}
            </div>

            {/* Withdrawals */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">
                  Retraits en attente
                </h2>
                <span className="px-2 py-1 text-sm bg-blue-900 text-blue-300 rounded">
                  {withdrawals.length}
                </span>
              </div>

              {withdrawals.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                  <p className="text-gray-400">Aucun retrait en attente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((tx) => (
                    <TransactionCard key={tx.id} tx={tx} type="withdrawal" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Refresh button */}
        <div className="mt-8 text-center">
          <button
            onClick={loadPending}
            disabled={loading}
            className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Rafraichir
          </button>
        </div>
      </main>

      {/* Fail Modal */}
      {failingTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">
              Refuser la transaction
            </h3>

            <div>
              <label className="block text-gray-400 text-sm mb-1">
                Raison du refus
              </label>
              <input
                type="text"
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="ex: Paiement non recu"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setFailingTx(null);
                  setFailReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleFail}
                disabled={!failReason}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
