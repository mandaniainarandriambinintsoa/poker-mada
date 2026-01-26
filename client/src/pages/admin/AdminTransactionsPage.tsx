import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi, AdminTransaction, Pagination } from '../../services/adminApi';
import { getErrorMessage } from '../../services/api';

export default function AdminTransactionsPage() {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, [typeFilter, statusFilter]);

  const loadTransactions = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getTransactions({
        page,
        limit: 30,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
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

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT: 'Depot',
      WITHDRAWAL: 'Retrait',
      TABLE_BUY_IN: 'Entree table',
      TABLE_CASH_OUT: 'Sortie table',
      WIN: 'Gain',
      LOSS: 'Perte',
      BONUS: 'Bonus',
      REFUND: 'Remboursement',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      PROCESSING: 'En cours',
      COMPLETED: 'Complete',
      FAILED: 'Echoue',
      CANCELLED: 'Annule',
      REFUNDED: 'Rembourse',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-900 text-green-300';
      case 'PENDING':
        return 'bg-yellow-900 text-yellow-300';
      case 'PROCESSING':
        return 'bg-blue-900 text-blue-300';
      case 'FAILED':
        return 'bg-red-900 text-red-300';
      case 'CANCELLED':
        return 'bg-gray-700 text-gray-300';
      case 'REFUNDED':
        return 'bg-purple-900 text-purple-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'WIN':
      case 'BONUS':
      case 'REFUND':
        return 'text-green-400';
      case 'WITHDRAWAL':
      case 'LOSS':
      case 'TABLE_BUY_IN':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

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
              className="py-3 px-2 text-gray-400 hover:text-white border-b-2 border-transparent"
            >
              En attente
            </Link>
            <Link
              to="/admin/transactions"
              className="py-3 px-2 text-white border-b-2 border-yellow-500 font-medium"
            >
              Transactions
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
          >
            <option value="">Tous les types</option>
            <option value="DEPOSIT">Depot</option>
            <option value="WITHDRAWAL">Retrait</option>
            <option value="TABLE_BUY_IN">Entree table</option>
            <option value="TABLE_CASH_OUT">Sortie table</option>
            <option value="WIN">Gain</option>
            <option value="LOSS">Perte</option>
            <option value="BONUS">Bonus</option>
            <option value="REFUND">Remboursement</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="PROCESSING">En cours</option>
            <option value="COMPLETED">Complete</option>
            <option value="FAILED">Echoue</option>
            <option value="CANCELLED">Annule</option>
            <option value="REFUNDED">Rembourse</option>
          </select>

          <button
            onClick={() => {
              setTypeFilter('');
              setStatusFilter('');
            }}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            Reinitialiser
          </button>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Chargement...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400">{error}</div>
          </div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Joueur</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Montant</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white text-sm">{tx.user.username}</div>
                        <div className="text-gray-500 text-xs">{tx.user.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${getTypeColor(tx.type)}`}>
                          {getTypeLabel(tx.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${getTypeColor(tx.type)}`}>
                          {tx.type === 'DEPOSIT' || tx.type === 'WIN' || tx.type === 'BONUS' || tx.type === 'REFUND' || tx.type === 'TABLE_CASH_OUT'
                            ? '+' : '-'}
                          {formatMoney(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(tx.status)}`}>
                          {getStatusLabel(tx.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                        {tx.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => loadTransactions(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50"
                >
                  Precedent
                </button>
                <span className="px-3 py-1 text-gray-400">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => loadTransactions(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}

            {/* Total */}
            {pagination && (
              <div className="mt-4 text-center text-gray-500 text-sm">
                {pagination.total} transactions au total
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
