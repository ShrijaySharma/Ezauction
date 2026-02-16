import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import HostDashboard from './pages/HostDashboard';
import AppOwnerDashboard from './pages/AppOwnerDashboard';
import { getCurrentUser } from './services/auth';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={
            user.role === 'admin' ? '/admin' :
              user.role === 'owner' ? '/owner' :
                user.role === 'host' ? '/host' :
                  user.role === 'app_owner' ? '/app-owner' : '/login'
          } /> : <Login onLogin={setUser} />}
        />
        <Route
          path="/admin"
          element={user?.role === 'admin' ? <AdminDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/app-owner"
          element={user?.role === 'app_owner' ? <AppOwnerDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/owner"
          element={user?.role === 'owner' ? <OwnerDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/host"
          element={user?.role === 'host' ? <HostDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;

