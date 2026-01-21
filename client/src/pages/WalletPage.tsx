import React, { useEffect, useState } from 'react';
import Header from '../components/common/Header';
import { api, getErrorMessage } from '../services/api';

interface WalletBalance {
  balance: number;
  frozenBalance: number;
  availableBalance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  paymentProvider?: string;
  description?: string;
  createdAt: string;
}

function formatAriary(amount: number): string {
  return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WalletPage() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions'),
      ]);
      setBalance(balanceRes.data);
      setTransactions(transactionsRes.data.transactions);
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT: 'Dépôt',
      WITHDRAWAL: 'Retrait',
      TABLE_BUY_IN: 'Entrée table',
      TABLE_CASH_OUT: 'Sortie table',
      WIN: 'Gain',
      LOSS: 'Perte',
      BONUS: 'Bonus',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-yellow-600',
      PROCESSING: 'bg-blue-600',
      COMPLETED: 'bg-green-600',
      FAILED: 'bg-red-600',
    };
    return badges[status] || 'bg-gray-600';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      PROCESSING: 'En cours',
      COMPLETED: 'Terminé',
      FAILED: 'Échoué',
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-white">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Portefeuille</h1>

        {/* Solde */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h3 className="text-gray-400 mb-2">Solde total</h3>
            <p className="text-3xl font-bold text-white">
              {balance ? formatAriary(balance.balance) : '-'}
            </p>
          </div>
          <div className="card">
            <h3 className="text-gray-400 mb-2">Disponible</h3>
            <p className="text-3xl font-bold text-green-500">
              {balance ? formatAriary(balance.availableBalance) : '-'}
            </p>
          </div>
          <div className="card">
            <h3 className="text-gray-400 mb-2">En jeu</h3>
            <p className="text-3xl font-bold text-yellow-500">
              {balance ? formatAriary(balance.frozenBalance) : '-'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setShowDepositModal(true)}
            className="btn btn-primary px-8 py-3"
          >
            Déposer
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="btn btn-secondary px-8 py-3"
            disabled={!balance || balance.availableBalance < 5000}
          >
            Retirer
          </button>
        </div>

        {/* Historique */}
        <div className="card">
          <h2 className="text-xl font-bold text-white mb-4">Historique des transactions</h2>

          {transactions.length === 0 ? (
            <p className="text-gray-400">Aucune transaction</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Montant</th>
                    <th className="pb-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-700/50">
                      <td className="py-3 text-gray-300">{formatDate(tx.createdAt)}</td>
                      <td className="py-3 text-white">{getTypeLabel(tx.type)}</td>
                      <td
                        className={`py-3 font-medium ${
                          ['DEPOSIT', 'WIN', 'TABLE_CASH_OUT', 'BONUS'].includes(tx.type)
                            ? 'text-green-500'
                            : 'text-red-500'
                        }`}
                      >
                        {['DEPOSIT', 'WIN', 'TABLE_CASH_OUT', 'BONUS'].includes(tx.type)
                          ? '+'
                          : '-'}
                        {formatAriary(tx.amount)}
                      </td>
                      <td className="py-3">
                        <span className={`${getStatusBadge(tx.status)} px-2 py-1 rounded text-xs`}>
                          {getStatusLabel(tx.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Dépôt */}
      {showDepositModal && (
        <DepositModal
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => {
            setShowDepositModal(false);
            fetchData();
          }}
        />
      )}

      {/* Modal Retrait */}
      {showWithdrawModal && balance && (
        <WithdrawModal
          maxAmount={balance.availableBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// Modal de dépôt
function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(5000);
  const [provider, setProvider] = useState<'ORANGE_MONEY' | 'MVOLA' | 'AIRTEL_MONEY'>('ORANGE_MONEY');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [instructions, setInstructions] = useState<any>(null);

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/wallet/deposit', { amount, provider, phone });
      setInstructions(response.data.instructions);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">Déposer de l'argent</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {instructions ? (
          <div className="space-y-4">
            <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
              Transaction initiée avec succès!
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-white font-mono text-lg mb-2">{instructions.code}</p>
              <ol className="text-gray-300 text-sm space-y-1">
                {instructions.steps?.map((step: string, i: number) => (
                  <li key={i}>{i + 1}. {step}</li>
                ))}
              </ol>
            </div>
            <button onClick={onSuccess} className="btn btn-primary w-full">
              Fermer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Montant</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="input"
                min={1000}
                step={1000}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum: 1,000 Ar</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Moyen de paiement
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ORANGE_MONEY', 'MVOLA', 'AIRTEL_MONEY'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`py-2 px-3 rounded-lg text-sm ${
                      provider === p
                        ? 'bg-poker-gold text-black'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {p === 'ORANGE_MONEY' ? 'Orange' : p === 'MVOLA' ? 'MVola' : 'Airtel'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="0341234567"
              />
            </div>

            <div className="flex gap-4">
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || amount < 1000 || !phone}
                className="btn btn-primary flex-1"
              >
                {isSubmitting ? 'Traitement...' : 'Déposer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal de retrait
function WithdrawModal({
  maxAmount,
  onClose,
  onSuccess,
}: {
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(5000);
  const [provider, setProvider] = useState<'ORANGE_MONEY' | 'MVOLA' | 'AIRTEL_MONEY'>('ORANGE_MONEY');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await api.post('/wallet/withdraw', { amount, provider, phone });
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">Retirer de l'argent</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
              Demande de retrait envoyée! Vous recevrez votre argent dans 24-48h.
            </div>
            <button onClick={onSuccess} className="btn btn-primary w-full">
              Fermer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Montant</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="input"
                min={5000}
                max={maxAmount}
                step={1000}
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum: 5,000 Ar | Maximum: {formatAriary(maxAmount)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Moyen de paiement
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['ORANGE_MONEY', 'MVOLA', 'AIRTEL_MONEY'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`py-2 px-3 rounded-lg text-sm ${
                      provider === p
                        ? 'bg-poker-gold text-black'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {p === 'ORANGE_MONEY' ? 'Orange' : p === 'MVOLA' ? 'MVola' : 'Airtel'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="0341234567"
              />
            </div>

            <div className="flex gap-4">
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || amount < 5000 || amount > maxAmount || !phone}
                className="btn btn-primary flex-1"
              >
                {isSubmitting ? 'Traitement...' : 'Retirer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
