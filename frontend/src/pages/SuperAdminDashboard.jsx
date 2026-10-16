import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listAuctions,
  createAuction,
  updateAuctionStatus,
  resetAuction,
  regenCreds,
  deleteAuction
} from '../services/superAdmin';
import { logout, getCurrentUser } from '../services/auth';

export default function SuperAdminDashboard({ initialUser }) {
  const [currentUser, setCurrentUser] = useState(initialUser || null);
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);

  // Create auction modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState('');
  const [newAuctionId, setNewAuctionId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Credentials / Success modal (shown after create or regen)
  const [credsModalData, setCredsModalData] = useState(null);

  // Links modal
  const [linksModalAuction, setLinksModalAuction] = useState(null);

  // Toast / feedback message
  const [toast, setToast] = useState('');

  const navigate = useNavigate();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    checkSuperAdminAuth();
  }, []);

  const checkSuperAdminAuth = async () => {
    try {
      const user = await getCurrentUser();
      if (user && user.role === 'super_admin') {
        setCurrentUser(user);
        await loadAuctions();
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAuctions = async () => {
    try {
      const data = await listAuctions();
      setAuctions(data || []);
    } catch (err) {
      console.error('Failed to load auctions:', err);
      showToast('Error loading auctions');
    }
  };


  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAuctions([]);
    navigate('/login');
  };

  const autoSlug = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setNewAuctionName(val);
    if (!newAuctionId || newAuctionId === autoSlug(newAuctionName)) {
      setNewAuctionId(autoSlug(val));
    }
  };

  const handleCreateAuction = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      const res = await createAuction(newAuctionId.trim(), newAuctionName.trim());
      setShowCreateModal(false);
      setNewAuctionName('');
      setNewAuctionId('');
      await loadAuctions();

      // Show credentials modal
      setCredsModalData({
        auction: res.auction,
        credentials: res.credentials
      });
      showToast('Auction created successfully!');
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create auction');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleStatus = async (auction) => {
    const nextStatus = auction.status === 'active' ? 'archived' : 'active';
    if (!window.confirm(`Are you sure you want to change status of "${auction.name}" to ${nextStatus.toUpperCase()}?`)) {
      return;
    }
    try {
      await updateAuctionStatus(auction.id, nextStatus);
      showToast(`Auction is now ${nextStatus}`);
      await loadAuctions();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleResetData = async (auction) => {
    const confirmation = window.prompt(
      `⚠️ WARNING: This will permanently wipe all players, teams, bids, and trades for "${auction.name}".\n\nAdmin credentials will be PRESERVED.\n\nType the auction ID "${auction.id}" to confirm:`
    );
    if (confirmation !== auction.id) {
      if (confirmation !== null) alert('Auction ID did not match. Reset cancelled.');
      return;
    }

    try {
      await resetAuction(auction.id);
      showToast('Auction data reset successfully!');
      await loadAuctions();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reset auction');
    }
  };

  const handleRegenCreds = async (auction) => {
    if (!window.confirm(`Regenerate password for admin_${auction.id}? The existing password will stop working immediately.`)) {
      return;
    }
    try {
      const res = await regenCreds(auction.id);
      setCredsModalData({
        auction,
        credentials: res.credentials
      });
      showToast('New credentials generated!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to regenerate credentials');
    }
  };

  const handleDeleteAuction = async (auction) => {
    if (auction.status !== 'archived') {
      alert('You must archive this auction before deleting it.');
      return;
    }
    if (!window.confirm(`Delete auction "${auction.name}" permanently? This CANNOT be undone.`)) {
      return;
    }
    try {
      await deleteAuction(auction.id);
      showToast('Auction deleted');
      await loadAuctions();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete auction');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`);
  };

  const origin = window.location.origin;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  // Not authenticated → redirect to unified login
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  // ── SUPER ADMIN DASHBOARD ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl font-medium text-sm flex items-center space-x-2 animate-bounce">
          <span>✓</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">EzAuction</h1>
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Super Admin Console</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs text-slate-400 hidden sm:block">
              Logged in as <span className="text-white font-semibold">{currentUser.username}</span>
            </div>
            <a
              href="/app-owner"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition"
              title="Account Settings"
            >
              ⚙️ Settings
            </a>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/50 text-red-300 hover:text-white rounded-lg text-xs font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Auctions Directory</h2>
            <p className="text-sm text-slate-400 mt-1">
              Create and manage isolated auction instances. Each has its own admin dashboard, host, and live links.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40 text-sm flex items-center space-x-2 self-start sm:self-auto"
          >
            <span className="text-lg leading-none">+</span>
            <span>Create New Auction</span>
          </button>
        </div>

        {/* Auctions Grid / Empty State */}
        {auctions.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="text-4xl mb-3">🏏</div>
            <h3 className="text-lg font-semibold text-white">No auctions created yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
              Click &quot;Create New Auction&quot; above to launch your first isolated auction room with custom URLs.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
            >
              + Create Auction
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => (
              <div
                key={auction.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        auction.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                      }`}
                    >
                      {auction.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(auction.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{auction.name}</h3>
                  <div className="text-xs font-mono text-emerald-400/90 bg-slate-950/80 px-2 py-1 rounded-md inline-block mb-4">
                    ID: {auction.id}
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800/80">
                  {/* Dedicated Links Button */}
                  <button
                    onClick={() => setLinksModalAuction(auction)}
                    className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1"
                  >
                    <span>🔗</span>
                    <span>View Links &amp; URLs</span>
                  </button>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() => handleRegenCreds(auction)}
                      title="Generate new admin password"
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition text-center"
                    >
                      🔑 Pass
                    </button>
                    <button
                      onClick={() => handleResetData(auction)}
                      title="Wipe data (keep auction and login)"
                      className="py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-[11px] font-medium transition text-center"
                    >
                      🔄 Reset
                    </button>
                    <button
                      onClick={() => handleToggleStatus(auction)}
                      title={auction.status === 'active' ? 'Archive auction' : 'Unarchive auction'}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition text-center"
                    >
                      {auction.status === 'active' ? '📦 Archive' : '⚡ Active'}
                    </button>
                    <button
                      onClick={() => handleDeleteAuction(auction)}
                      title="Permanently delete auction"
                      className="py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-lg text-[11px] font-medium transition text-center"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── CREATE AUCTION MODAL ────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Create New Auction</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateAuction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Auction Name
                </label>
                <input
                  type="text"
                  required
                  value={newAuctionName}
                  onChange={handleNameChange}
                  placeholder="e.g. IPL 2025 Mega Auction"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Auction ID (Slug)
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Used in URLs (e.g. <span className="font-mono text-emerald-400">/auction/{newAuctionId || 'slug'}/admin</span>). Lowercase letters, numbers, and hyphens only.
                </p>
                <input
                  type="text"
                  required
                  value={newAuctionId}
                  onChange={(e) => setNewAuctionId(e.target.value.toLowerCase())}
                  placeholder="e.g. ipl2025"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                />
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">⚡ Auto-generated on creation:</div>
                <div>• Admin Username: <span className="font-mono text-emerald-400">admin_{newAuctionId || 'slug'}</span></div>
                <div>• Admin Password: 10-character secure alphanumeric string (shown once)</div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Auction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREDENTIALS / SUCCESS MODAL ─────────────────────────────────────── */}
      {credsModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 text-2xl mb-2">
                ✓
              </div>
              <h3 className="text-xl font-bold text-white">Auction Admin Credentials</h3>
              <p className="text-xs text-amber-400 mt-1">
                ⚠️ Save this password now. It will NOT be shown again.
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3 mb-6">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Admin Username</span>
                <div className="flex items-center justify-between font-mono text-sm text-white bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                  <span>{credsModalData.credentials.adminUsername}</span>
                  <button
                    onClick={() => copyToClipboard(credsModalData.credentials.adminUsername, 'Username')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 ml-2"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Admin Password</span>
                <div className="flex items-center justify-between font-mono text-sm text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="font-bold tracking-wider">{credsModalData.credentials.adminPassword}</span>
                  <button
                    onClick={() => copyToClipboard(credsModalData.credentials.adminPassword, 'Password')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 ml-2"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const aid = credsModalData.auction?.id;
                setCredsModalData(null);
                if (aid) {
                  const target = auctions.find(a => a.id === aid) || credsModalData.auction;
                  setLinksModalAuction(target);
                }
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition text-xs"
            >
              I have saved the credentials → View Links
            </button>
          </div>
        </div>
      )}

      {/* ── LINKS / URLS MODAL ──────────────────────────────────────────────── */}
      {linksModalAuction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{linksModalAuction.name}</h3>
                <p className="text-xs text-slate-400 font-mono">ID: {linksModalAuction.id}</p>
              </div>
              <button
                onClick={() => setLinksModalAuction(null)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Share or bookmark these dedicated links. They will automatically connect to this specific auction:
            </p>

            <div className="space-y-3 mb-6">
              {[
                {
                  label: '🛠 Admin Console',
                  sub: 'Login with auction credentials to run the auction',
                  path: `/auction/${linksModalAuction.id}/admin`
                },
                {
                  label: '📺 Host Screen',
                  sub: 'Open URL for big display / projection (no login)',
                  path: `/auction/${linksModalAuction.id}/host`
                },
                {
                  label: '🔴 Public Live',
                  sub: 'Open URL for viewers / fans (no login)',
                  path: `/auction/${linksModalAuction.id}/live`
                },
                {
                  label: '🎬 OBS Overlay',
                  sub: 'Clean overlay for streaming (no login)',
                  path: `/auction/${linksModalAuction.id}/overlay`
                },
                {
                  label: '👥 Team Owner Login',
                  sub: 'For bidders to login with their team credentials',
                  path: `/auction/${linksModalAuction.id}/owner-login`
                }
              ].map((link, idx) => {
                const fullUrl = `${origin}${link.path}`;
                return (
                  <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{link.label}</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyToClipboard(fullUrl, link.label)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-[11px] font-medium transition"
                        >
                          Copy URL
                        </button>
                        <a
                          href={link.path}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-[11px] font-medium transition"
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-1">{link.sub}</p>
                    <div className="text-[11px] font-mono text-slate-400 truncate bg-slate-900/80 px-2 py-1 rounded">
                      {fullUrl}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setLinksModalAuction(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
