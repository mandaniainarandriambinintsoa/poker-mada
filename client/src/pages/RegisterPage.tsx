import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (password !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 12) {
      setLocalError('Le mot de passe doit contenir au moins 12 caractères');
      return;
    }

    if (!/^0(32|33|34|37|38)\d{7}$/.test(phone)) {
      setLocalError('Numéro de téléphone invalide (ex: 0341234567)');
      return;
    }

    setIsSubmitting(true);

    try {
      await register(username, email, password, phone);
      navigate('/lobby');
    } catch {
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <main className="auth-page min-h-screen flex items-center justify-center bg-gray-900 px-4 py-10 py-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-poker-gold mb-2">Poker Mada</h1>
          <p className="text-gray-400">Créez votre compte</p>
        </div>

        <div className="card">
          <form method="post" onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div
                role="alert"
                className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg"
              >
                {displayError}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Nom d'utilisateur
              </label>
              <input
                id="username"
                autoComplete="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="VotreNom"
                required
                minLength={2}
                maxLength={30}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                autoComplete="email"
                maxLength={254}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="votre@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                Téléphone
              </label>
              <input
                id="phone"
                autoComplete="tel"
                pattern="0(32|33|34|37|38)[0-9]{7}"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="0341234567"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Format: 032, 033, 034, 037 ou 038</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                autoComplete="new-password"
                maxLength={72}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                minLength={12}
              />
              <p className="text-xs text-gray-500 mt-1">Entre 12 et 72 caractères</p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                autoComplete="new-password"
                maxLength={72}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                minLength={12}
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full py-3">
              {isSubmitting ? 'Inscription...' : "S'inscrire"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Déjà un compte?{' '}
              <Link to="/login" className="text-poker-gold hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
