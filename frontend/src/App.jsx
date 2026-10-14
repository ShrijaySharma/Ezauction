import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import HostDashboard from './pages/HostDashboard';
import AppOwnerDashboard from './pages/AppOwnerDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Overlay from './pages/Overlay';
import PublicLive from './pages/PublicLive';
import { getCurrentUser } from './services/auth';

function AuctionAdminWrapper({ user }) {
  const { auctionId } = useParams();
  if (user?.role === 'super_admin' || (user?.role === 'admin' && (user.auctionId === auctionId || !user.auctionId))) {
    return <AdminDashboard user={user} />;
  }
  return <Navigate to={`/auction/${auctionId}/login`} replace />;
}

function AuctionOwnerWrapper({ user }) {
  const { auctionId } = useParams();
  if (user?.role === 'owner' && (user.auctionId === auctionId || !user.auctionId)) {
    return <OwnerDashboard user={user} />;
  }
  return <Navigate to={`/auction/${auctionId}/owner-login`} replace />;
}

function AuctionLoginWrapper({ user, onLogin }) {
  const { auctionId } = useParams();
  if (user) {
    if (user.role === 'admin') return <Navigate to={`/auction/${auctionId}/admin`} replace />;
    if (user.role === 'owner') return <Navigate to={`/auction/${auctionId}/owner`} replace />;
    if (user.role === 'host') return <Navigate to={`/auction/${auctionId}/host`} replace />;
    if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />;
  }
  return <Login onLogin={onLogin} />;
}

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
        {/* Super Admin Control Panel */}
        <Route path="/super-admin" element={<SuperAdminDashboard initialUser={user} />} />
        <Route path="/super-admin/dashboard" element={<SuperAdminDashboard initialUser={user} />} />

        {/* Multi-Auction Scoped Routes */}
        <Route path="/auction/:auctionId/overlay" element={<Overlay />} />
        <Route path="/auction/:auctionId/live" element={<PublicLive />} />
        <Route path="/auction/:auctionId/host" element={<HostDashboard />} />
        <Route path="/auction/:auctionId/login" element={<AuctionLoginWrapper user={user} onLogin={setUser} />} />
        <Route path="/auction/:auctionId/owner-login" element={<AuctionLoginWrapper user={user} onLogin={setUser} />} />
        <Route path="/auction/:auctionId/admin" element={<AuctionAdminWrapper user={user} />} />
        <Route path="/auction/:auctionId/owner" element={<AuctionOwnerWrapper user={user} />} />

        {/* Legacy Root Routes (backward compatibility) */}
        <Route path="/overlay" element={<Overlay />} />
        <Route path="/live" element={<PublicLive />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route
          path="/login"
          element={user ? <Navigate to={
            user.role === 'admin' ? '/admin' :
              user.role === 'owner' ? '/owner' :
                user.role === 'host' ? '/host' :
                  user.role === 'super_admin' ? '/super-admin' : '/login'
          } /> : <Login onLogin={setUser} />}
        />
        <Route
          path="/admin"
          element={user?.role === 'admin' ? <AdminDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/app-owner"
          element={user?.role === 'super_admin' ? <AppOwnerDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/owner"
          element={user?.role === 'owner' ? <OwnerDashboard user={user} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
