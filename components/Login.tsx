
import React, { useState } from 'react';
import * as apiService from '../services/apiService';

interface LoginComponentProps {
  onLoginSuccess: () => void;
}

const LoginComponent: React.FC<LoginComponentProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiService.login(password);
      onLoginSuccess();
    } catch (err) {
      setError((err as Error).message || 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-100 flex items-center justify-center h-screen">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 m-4">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">KI Ernährungsplaner</h1>
        <p className="text-center text-slate-500 mb-6">Bitte melden Sie sich an, um fortzufahren.</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Passwort</label>
            <input
              type="password"
              name="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                          focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
                          ${error ? 'border-red-500' : ''}`}
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-600 mb-4" role="alert">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Melde an...' : 'Anmelden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginComponent;
