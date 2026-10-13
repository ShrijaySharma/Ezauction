import { useState } from 'react';
import api, { logout } from '../services/auth';

function AppOwnerDashboard({ user }) {
    const [activeTab, setActiveTab] = useState('password');

    // Password change state
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMessage, setPwMessage] = useState('');
    const [pwError, setPwError] = useState('');

    // Username change state
    const [unForm, setUnForm] = useState({ newUsername: '', currentPassword: '' });
    const [unLoading, setUnLoading] = useState(false);
    const [unMessage, setUnMessage] = useState('');
    const [unError, setUnError] = useState('');

    const [currentUsername, setCurrentUsername] = useState(user?.username || '');

    const handleLogout = async () => {
        try { await logout(); } catch {}
        window.location.href = '/login';
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwMessage('');

        if (pwForm.newPassword !== pwForm.confirmPassword) {
            return setPwError('New passwords do not match');
        }
        if (pwForm.newPassword.length < 6) {
            return setPwError('New password must be at least 6 characters');
        }

        setPwLoading(true);
        try {
            const res = await api.post('/app-owner/change-password', {
                currentPassword: pwForm.currentPassword,
                newPassword: pwForm.newPassword
            });
            if (res.data.success) {
                setPwMessage(res.data.message);
                setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }
        } catch (err) {
            setPwError(err.response?.data?.error || 'Failed to update password');
        } finally {
            setPwLoading(false);
        }
    };

    const handleUsernameChange = async (e) => {
        e.preventDefault();
        setUnError('');
        setUnMessage('');

        if (unForm.newUsername.length < 3) {
            return setUnError('Username must be at least 3 characters');
        }

        setUnLoading(true);
        try {
            const res = await api.post('/app-owner/change-username', {
                newUsername: unForm.newUsername,
                currentPassword: unForm.currentPassword
            });
            if (res.data.success) {
                setUnMessage(res.data.message);
                setCurrentUsername(res.data.newUsername);
                setUnForm({ newUsername: '', currentPassword: '' });
            }
        } catch (err) {
            setUnError(err.response?.data?.error || 'Failed to update username');
        } finally {
            setUnLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <h1 className="text-base font-bold text-white leading-tight">EzAuction</h1>
                            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Super Admin Settings</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-xs text-slate-400 hidden sm:block">
                            Logged in as <span className="text-white font-semibold">{currentUsername}</span>
                        </span>
                        <button
                            onClick={() => window.location.href = '/super-admin'}
                            className="px-3 py-1.5 bg-emerald-800/40 hover:bg-emerald-700/40 text-emerald-300 rounded-lg text-xs font-medium transition"
                        >
                            ← Dashboard
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-10">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Account Settings</h2>
                    <p className="text-sm text-slate-400 mt-1">Manage your Super Admin credentials.</p>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 mb-6 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {[
                        { id: 'password', label: '🔐 Change Password' },
                        { id: 'username', label: '✏️ Change Username' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                                activeTab === tab.id
                                    ? 'bg-emerald-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Password Tab */}
                {activeTab === 'password' && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-1">Change Password</h3>
                        <p className="text-xs text-slate-400 mb-6">
                            You must enter your current password to set a new one.
                        </p>

                        {pwMessage && (
                            <div className="mb-4 p-3 bg-emerald-900/40 border border-emerald-700/50 rounded-xl text-emerald-300 text-sm">
                                ✓ {pwMessage}
                            </div>
                        )}
                        {pwError && (
                            <div className="mb-4 p-3 bg-red-900/40 border border-red-700/50 rounded-xl text-red-300 text-sm">
                                {pwError}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            {[
                                { label: 'Current Password', key: 'currentPassword', placeholder: 'Enter current password' },
                                { label: 'New Password', key: 'newPassword', placeholder: 'At least 6 characters' },
                                { label: 'Confirm New Password', key: 'confirmPassword', placeholder: 'Repeat new password' }
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        {field.label}
                                    </label>
                                    <input
                                        type="password"
                                        value={pwForm[field.key]}
                                        onChange={e => setPwForm({ ...pwForm, [field.key]: e.target.value })}
                                        placeholder={field.placeholder}
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                                    />
                                </div>
                            ))}
                            <button
                                type="submit"
                                disabled={pwLoading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm mt-2"
                            >
                                {pwLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Username Tab */}
                {activeTab === 'username' && (
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-1">Change Username</h3>
                        <p className="text-xs text-slate-400 mb-6">
                            Current username: <span className="font-mono text-emerald-400">{currentUsername}</span>
                        </p>

                        {unMessage && (
                            <div className="mb-4 p-3 bg-emerald-900/40 border border-emerald-700/50 rounded-xl text-emerald-300 text-sm">
                                ✓ {unMessage}
                            </div>
                        )}
                        {unError && (
                            <div className="mb-4 p-3 bg-red-900/40 border border-red-700/50 rounded-xl text-red-300 text-sm">
                                {unError}
                            </div>
                        )}

                        <form onSubmit={handleUsernameChange} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    New Username
                                </label>
                                <input
                                    type="text"
                                    value={unForm.newUsername}
                                    onChange={e => setUnForm({ ...unForm, newUsername: e.target.value })}
                                    placeholder="At least 3 characters"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Current Password (to confirm)
                                </label>
                                <input
                                    type="password"
                                    value={unForm.currentPassword}
                                    onChange={e => setUnForm({ ...unForm, currentPassword: e.target.value })}
                                    placeholder="Enter current password"
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={unLoading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm mt-2"
                            >
                                {unLoading ? 'Updating...' : 'Update Username'}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}

export default AppOwnerDashboard;
