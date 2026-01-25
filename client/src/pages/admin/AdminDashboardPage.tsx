import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi, DashboardStats } from '../../services/adminApi';
import { getErrorMessage } from '../../services/api';

interface ReconciliationResult {
  checked: number;
  corrected: number;
  details: Array<{ odId: string; username: string; amount: number }>;
}

export default function AdminDashboardPage() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getDashboard();
      setStats(data);
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

  const handleReconciliation = async () => {
    try {
      setReconciling(true);
      setReconciliationResult(null);
      const result = await adminApi.runReconciliation();
      setReconciliationResult(result);
      // Recharger les stats si des corrections ont été faites
      if (result.corrected > 0) {
        loadStats();
      }
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setReconciling(false);
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
              className="py-3 px-2 text-white border-b-2 border-yellow-500 font-medium"
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
            <button
              onClick={loadStats}
              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Reessayer
            </button>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Users */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-gray-400 text-sm font-medium">Joueurs Total</h3>
              <p className="text-3xl font-bold text-white mt-2">{stats.users.total}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-green-400">{stats.users.active} actifs</span>
                <span className="text-red-400">{stats.users.banned} bannis</span>
              </div>
            </div>

            {/* Total Balance */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-gray-400 text-sm font-medium">Solde Total en Circulation</h3>
              <p className="text-3xl font-bold text-green-400 mt-2">
                {formatMoney(stats.finance.totalBalance)}
              </p>
            </div>

            {/* Pending */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-gray-400 text-sm font-medium">Transactions en Attente</h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Depots:</span>
                  <span className="text-yellow-400 font-bold">{stats.finance.pendingDeposits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Retraits:</span>
                  <span className="text-yellow-400 font-bold">{stats.finance.pendingWithdrawals}</span>
                </div>
              </div>
              {(stats.finance.pendingDeposits > 0 || stats.finance.pendingWithdrawals > 0) && (
                <Link
                  to="/admin/pending"
                  className="mt-4 block text-center py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                >
                  Traiter les transactions
                </Link>
              )}
            </div>

            {/* Today Activity */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-gray-400 text-sm font-medium">Activite du Jour</h3>
              <p className="text-3xl font-bold text-white mt-2">
                {stats.activity.todayTransactions}
              </p>
              <p className="text-sm text-gray-400 mt-2">transactions aujourd'hui</p>
            </div>
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/admin/users"
            className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-yellow-600 transition-colors"
          >
            <h3 className="text-lg font-medium text-white">Gerer les Joueurs</h3>
            <p className="text-gray-400 mt-2 text-sm">
              Voir, rechercher et gerer les comptes joueurs
            </p>
          </Link>

          <Link
            to="/admin/pending"
            className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-yellow-600 transition-colors"
          >
            <h3 className="text-lg font-medium text-white">Transactions en Attente</h3>
            <p className="text-gray-400 mt-2 text-sm">
              Confirmer ou refuser les depots et retraits
            </p>
          </Link>

          <Link
            to="/admin/transactions"
            className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-yellow-600 transition-colors"
          >
            <h3 className="text-lg font-medium text-white">Historique Transactions</h3>
            <p className="text-gray-400 mt-2 text-sm">
              Voir toutes les transactions du systeme
            </p>
          </Link>
        </div>

        {/* Reconciliation Section - Super Admin Only */}
        {isSuperAdmin && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-white">Reconciliation des Balances Gelees</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Verifie et libere les balances gelees orphelines (joueurs qui ne sont plus sur une table)
                </p>
              </div>
              <button
                onClick={handleReconciliation}
                disabled={reconciling}
                className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {reconciling ? 'Verification...' : 'Lancer la reconciliation'}
              </button>
            </div>

            {reconciliationResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                reconciliationResult.corrected > 0 ? 'bg-green-900/30 border border-green-700' : 'bg-gray-700/50'
              }`}>
                <p className="text-white">
                  <span className="font-medium">{reconciliationResult.checked}</span> utilisateur(s) verifie(s),{' '}
                  <span className={`font-medium ${reconciliationResult.corrected > 0 ? 'text-green-400' : ''}`}>
                    {reconciliationResult.corrected}
                  </span> correction(s) effectuee(s)
                </p>

                {reconciliationResult.details.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-gray-400">Details des corrections:</p>
                    {reconciliationResult.details.map((detail, i) => (
                      <div key={i} className="text-sm text-green-400">
                        {detail.username}: {formatMoney(detail.amount)} libere
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4">
              Note: La reconciliation automatique s'execute toutes les 5 minutes au demarrage du serveur.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
