import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallbackPage() {
  const { handleGoogleCallback, error } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        await handleGoogleCallback();
        navigate('/lobby');
      } catch {
        // Error is handled by context
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [handleGoogleCallback, navigate]);

  if (isProcessing && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-poker-gold mx-auto mb-4"></div>
          <p className="text-gray-400">Connexion en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="card text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Erreur de connexion</h2>
          <p className="text-gray-400 mb-6">{error || 'Une erreur est survenue lors de la connexion Google.'}</p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary w-full"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}
