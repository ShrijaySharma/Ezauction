import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { logout } from '../services/auth'; // Import api instance

function AppOwnerDashboard({ user }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        targetRole: 'admin',
        newUsername: '',
        newPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            // Use the configured api instance instead of fetch
            const response = await api.post('/app-owner/update-credentials', formData);

            if (response.data.success) {
                setMessage(response.data.message);
                setFormData({ ...formData, newUsername: '', newPassword: '' });
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">App Owner Dashboard</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-400">Welcome, {user?.username}</span>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">Manage Credentials</h2>
                    <p className="text-gray-400 mb-6">
                        Update the username and password for Admin or Host accounts.
                        This allows you to secure the application after renting it out.
                    </p>

                    {message && (
                        <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-200">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                Select Account to Update
                            </label>
                            <select
                                value={formData.targetRole}
                                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                            >
                                <option value="admin">Admin</option>
                                <option value="host">Host</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                New Username
                            </label>
                            <input
                                type="text"
                                value={formData.newUsername}
                                onChange={(e) => setFormData({ ...formData, newUsername: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                                placeholder="Enter new username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                New Password
                            </label>
                            <input
                                type="text"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500"
                                placeholder="Enter new password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-green-600 hover:bg-green-700 rounded font-semibold transition disabled:opacity-50"
                        >
                            {loading ? 'Updating...' : 'Update Credentials'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AppOwnerDashboard;
