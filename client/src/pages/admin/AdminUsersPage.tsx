import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi, AdminUser, Pagination } from '../../services/adminApi';
import { getErrorMessage } from '../../services/api';

export default function AdminUsersPage() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [filter]);

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers({
        page,
        limit: 20,
        search: search || undefined,
        filter,
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(1);
  };

  const handleBan = async (userId: string) => {
    if (!confirm('Voulez-vous vraiment bannir cet utilisateur ?')) return;

    try {
      setActionLoading(true);
      await adminApi.banUser(userId, 'Banni par admin');
      loadUsers(pagination?.page || 1);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      setActionLoading(true);
      await adminApi.unbanUser(userId);
      loadUsers(pagination?.page || 1);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason) return;

    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      alert('Montant invalide');
      return;
    }

    try {
      setActionLoading(true);
      await adminApi.adjustBalance(selectedUser.id, amount, adjustReason);
      setSelectedUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      loadUsers(pagination?.page || 1);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount) + ' Ar';
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
              className="py-3 px-2 text-white border-b-2 border-yellow-500 font-medium"
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
              className="py-3 px-2 text-gray-400 hover:text-white border-b-2 border-transparent"
            >
              Transactions
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email ou telephone..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Rechercher
            </button>
          </form>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded ${
                filter === 'all'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded ${
                filter === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Actifs
            </button>
            <button
              onClick={() => setFilter('banned')}
              className={`px-4 py-2 rounded ${
                filter === 'banned'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Bannis
            </button>
          </div>
        </div>

        {/* Users Table */}
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
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Utilisateur</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Contact</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Solde</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Derniere connexion</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{u.username}</div>
                        <div className="text-gray-400 text-sm">{u.role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-300 text-sm">{u.email}</div>
                        <div className="text-gray-400 text-sm">{u.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-green-400 font-medium">{formatMoney(u.balance)}</div>
                        {u.frozenBalance > 0 && (
                          <div className="text-yellow-400 text-sm">
                            Gele: {formatMoney(u.frozenBalance)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.isBanned ? (
                          <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded">
                            Banni
                          </span>
                        ) : u.isActive ? (
                          <span className="px-2 py-1 text-xs bg-green-900 text-green-300 rounded">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {formatDate(u.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          {isSuperAdmin && u.role === 'PLAYER' && (
                            <button
                              onClick={() => setSelectedUser(u)}
                              disabled={actionLoading}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Ajuster
                            </button>
                          )}
                          {u.role === 'PLAYER' && (
                            <>
                              {u.isBanned ? (
                                <button
                                  onClick={() => handleUnban(u.id)}
                                  disabled={actionLoading}
                                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                  Debannir
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBan(u.id)}
                                  disabled={actionLoading}
                                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  Bannir
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => loadUsers(page)}
                    className={`px-3 py-1 rounded ${
                      page === pagination.page
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Adjust Balance Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">
              Ajuster le solde de {selectedUser.username}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Solde actuel: <span className="text-green-400">{formatMoney(selectedUser.balance)}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Montant (positif pour ajouter, negatif pour retirer)
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="ex: 5000 ou -2000"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Raison
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="ex: Depot mobile money"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setAdjustAmount('');
                  setAdjustReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={actionLoading || !adjustAmount || !adjustReason}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                {actionLoading ? 'En cours...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
