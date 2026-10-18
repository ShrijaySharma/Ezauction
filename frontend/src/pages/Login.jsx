import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { login } from '../services/auth';
import { clearCurrentAuctionId } from '../config';

function Login({ onLogin, auctionId: propAuctionId }) {
  const { auctionId: routeAuctionId } = useParams();
  const auctionId = propAuctionId !== undefined ? propAuctionId : (routeAuctionId || null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If accessing generic /login, ensure no stale auction ID interferes
    if (!auctionId) {
      clearCurrentAuctionId();
    }
  }, [auctionId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(username, password, auctionId);
      if (response && response.success) {
        // Update global auth state first
        onLogin(response.user);

        // Always send super_admin directly to super admin console
        if (response.user.role === 'super_admin') {
          navigate('/super-admin');
          return;
        }

        // Then navigate based on role and auction scope
        const targetAuctionId = response.user.auctionId || auctionId;
        let redirectPath;
        if (targetAuctionId) {
          redirectPath =
            response.user.role === 'admin' ? `/auction/${targetAuctionId}/admin` :
              response.user.role === 'owner' ? `/auction/${targetAuctionId}/owner` :
                response.user.role === 'host' ? `/auction/${targetAuctionId}/host` :
                  `/auction/${targetAuctionId}/login`;
        } else {
          redirectPath =
            response.user.role === 'admin' ? '/admin' :
              response.user.role === 'owner' ? '/owner' :
                response.user.role === 'host' ? '/host' :
                  response.user.role === 'app_owner' ? '/app-owner' : '/login';
        }
        navigate(redirectPath);
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error details:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      {/* Logo independent of the card */}
      <img src="/ezauction.png" alt="EzAuction" className="h-32 mb-8 object-contain filter drop-shadow-2xl hover:scale-105 transition-transform duration-300" />

      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 backdrop-blur-sm bg-opacity-90">
          <div className="text-center mb-8">
            <p className="text-gray-400 text-lg">Sign in to continue</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">

          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

