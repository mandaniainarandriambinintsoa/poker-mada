import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { isGoogleConfigured } from '../config/google';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { allowLocalRegistration } from '../config/features';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const { login, loginWithGoogle, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      await login(email, password);
      navigate('/lobby');
    } catch {
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async (response: CredentialResponse) => {
    setIsGoogleLoading(true);
    clearError();
    setGoogleError(null);

    try {
      if (!response.credential) {
        setGoogleError('Google n’a pas pu confirmer votre identité. Réessayez.');
        return;
      }
      await loginWithGoogle(response.credential);
      navigate('/lobby');
    } catch {
      // Error is handled by context
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-screen flex items-center justify-center bg-gray-900 px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-poker-gold mb-2">Poker Mada</h1>
          <p className="text-gray-400">Connectez-vous pour jouer</p>
        </div>

        <div className="card">
          <form method="post" onSubmit={handleSubmit} className="space-y-4">
            {(error || googleError) && (
              <div
                role="alert"
                className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg"
              >
                {error || googleError}
              </div>
            )}

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
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                autoComplete="current-password"
                maxLength={72}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="btn btn-primary w-full py-3"
            >
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {isGoogleConfigured && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-800 text-gray-400">ou</span>
                </div>
              </div>

              <div
                className={isSubmitting || isGoogleLoading ? 'pointer-events-none opacity-50' : ''}
              >
                <GoogleLogin
                  onSuccess={(response) => void handleGoogleLogin(response)}
                  onError={() =>
                    setGoogleError('La fenêtre Google a été fermée ou la connexion a échoué.')
                  }
                  useOneTap={false}
                  shape="rectangular"
                  size="large"
                  text="continue_with"
                  width="100%"
                />
              </div>
            </>
          )}

          {allowLocalRegistration && (
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Pas encore de compte?{' '}
                <Link to="/register" className="text-poker-gold hover:underline">
                  S'inscrire
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
