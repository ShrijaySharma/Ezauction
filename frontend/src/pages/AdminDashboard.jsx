import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { logout } from '../services/auth';
import * as adminService from '../services/admin';
import { getImageUrl } from '../utils/imageUtils';

// Auto-detect API URL based on current host
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const host = window.location.hostname;
  return `http://${host}:4000`;
};

const API_URL = getApiUrl();

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [auctionState, setAuctionState] = useState({ status: 'STOPPED', biddingLocked: false });
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [allBids, setAllBids] = useState([]);
  const [players, setPlayers] = useState([]);
  const [bidIncrements, setBidIncrements] = useState({ increment1: 500, increment2: 1000, increment3: 5000 });
  const [newIncrements, setNewIncrements] = useState({ increment1: 500, increment2: 1000, increment3: 5000 });
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState(10);
  const [newMaxPlayersPerTeam, setNewMaxPlayersPerTeam] = useState(10);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerForm, setPlayerForm] = useState({
    name: '',
    image: '',
    role: 'Batsman',
    country: '',
    base_price: '',
    serial_number: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previousBid, setPreviousBid] = useState(0);
  const [teams, setTeams] = useState([]);
  const [editingTeamBudget, setEditingTeamBudget] = useState(null);
  const [newBudget, setNewBudget] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({
    name: '',
    owner_name: '',
    budget: '',
    logo: null
  });
  const [teamLogoPreview, setTeamLogoPreview] = useState(null);
  const [showTeamSquads, setShowTeamSquads] = useState(false);
  const [teamSquads, setTeamSquads] = useState([]);
  const [enforceMaxBid, setEnforceMaxBid] = useState(false);
  const [showPurseMonitoring, setShowPurseMonitoring] = useState(false);
  const [showBiddingLogicModal, setShowBiddingLogicModal] = useState(false);

  useEffect(() => {
    // Initialize socket
    const newSocket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });

    newSocket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    // Load initial data
    loadData();
    loadTeams();

    // Socket event listeners
    newSocket.on('player-loaded', (data) => {
      setCurrentPlayer(data.player);
      setHighestBid(null);
      setAllBids([]);
      loadCurrentBid();
      loadPlayers(); // Refresh player list to show updated statuses
      if (showTeamSquads) {
        loadTeamSquads(); // Refresh team squads if modal is open
      }
    });

    newSocket.on('bid-placed', (data) => {
      loadCurrentBid();
      loadAllBids();
    });

    newSocket.on('bid-updated', (data) => {
      setPreviousBid(data.highestBid ? data.highestBid.amount : currentBid);
      loadCurrentBid();
      loadAllBids();
    });

    newSocket.on('auction-status-changed', (data) => {
      setAuctionState(prev => ({ ...prev, status: data.status }));
    });

    newSocket.on('bidding-locked', (data) => {
      setAuctionState(prev => ({ ...prev, biddingLocked: data.locked }));
    });

    newSocket.on('bid-increments-changed', (data) => {
      setBidIncrements({
        increment1: data.increment1,
        increment2: data.increment2,
        increment3: data.increment3
      });
      setNewIncrements({
        increment1: data.increment1,
        increment2: data.increment2,
        increment3: data.increment3
      });
    });

    newSocket.on('max-players-changed', (data) => {
      setMaxPlayersPerTeam(data.maxPlayersPerTeam);
      setNewMaxPlayersPerTeam(data.maxPlayersPerTeam);
    });

    newSocket.on('player-marked', () => {
      loadPlayers();
    });

    newSocket.on('bidding-reset', () => {
      setHighestBid(null);
      setAllBids([]);
      loadCurrentBid();
    });

    newSocket.on('player-added', () => {
      loadPlayers();
    });

    newSocket.on('player-updated', () => {
      loadPlayers();
    });

    newSocket.on('player-deleted', () => {
      loadPlayers();
    });

    newSocket.on('team-budget-updated', () => {
      loadTeams();
    });

    newSocket.on('team-bidding-locked', () => {
      loadTeams();
    });

    newSocket.on('team-added', () => {
      loadTeams();
    });

    newSocket.on('team-updated', () => {
      loadTeams();
    });

    newSocket.on('team-deleted', () => {
      loadTeams();
    });

    newSocket.on('player-marked', () => {
      // Reload team squads if modal is open
      if (showTeamSquads) {
        loadTeamSquads();
      }
    });

    newSocket.on('player-removed-from-team', () => {
      // Reload team squads and players if modal is open
      if (showTeamSquads) {
        loadTeamSquads();
      }
      loadPlayers();
      loadTeams();
    });

    newSocket.on('enforce-max-bid-changed', (data) => {
      setEnforceMaxBid(data.enforceMaxBid);
    });

    newSocket.on('all-players-deleted', () => {
      loadPlayers();
      setCurrentPlayer(null);
      setHighestBid(null);
      setAllBids([]);
      alert('All players and bids have been cleared by an admin');
    });

    return () => newSocket.close();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadAuctionState(),
      loadCurrentBid(),
      loadAllBids(),
      loadPlayers()
    ]);
  };

  const loadAuctionState = async () => {
    try {
      const data = await adminService.getAuctionState();
      setAuctionState(data);
      setBidIncrements(data.bidIncrements);
      setNewIncrements(data.bidIncrements);

      // Load max players config
      if (data.maxPlayersPerTeam) {
        setMaxPlayersPerTeam(data.maxPlayersPerTeam);
        setNewMaxPlayersPerTeam(data.maxPlayersPerTeam);
      } else {
        // Fallback to separate API if not in state response
        const maxPlayersData = await adminService.getMaxPlayersPerTeam();
        setMaxPlayersPerTeam(maxPlayersData.maxPlayersPerTeam);
        setNewMaxPlayersPerTeam(maxPlayersData.maxPlayersPerTeam);
      }

      if (data.currentPlayerId) {
        const playerData = await adminService.getCurrentBid();
        setCurrentPlayer(playerData.player);
      }
      if (data.enforceMaxBid !== undefined) {
        setEnforceMaxBid(data.enforceMaxBid);
      }
    } catch (error) {
      console.error('Error loading auction state:', error);
    }
  };

  const loadCurrentBid = async () => {
    try {
      const data = await adminService.getCurrentBid();
      setHighestBid(data.highestBid);
      setCurrentPlayer(data.player);
    } catch (error) {
      console.error('Error loading current bid:', error);
    }
  };

  const loadAllBids = async () => {
    try {
      const data = await adminService.getAllBids();
      setAllBids(data.bids || []);
    } catch (error) {
      console.error('Error loading bids:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const data = await adminService.getAllPlayers();
      setPlayers(data.players || []);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await adminService.updateAuctionStatus(status);
    } catch (error) {
      alert('Error updating status: ' + error.response?.data?.error);
    }
  };

  const handleLoadPlayer = async () => {
    if (!selectedPlayerId) {
      alert('Please select a player');
      return;
    }
    try {
      await adminService.loadPlayer(parseInt(selectedPlayerId));
    } catch (error) {
      alert('Error loading player: ' + error.response?.data?.error);
    }
  };

  const handleUndoBid = async () => {
    if (!confirm('Undo last bid?')) return;
    try {
      await adminService.undoBid();
    } catch (error) {
      alert('Error undoing bid: ' + error.response?.data?.error);
    }
  };

  const handleLockBidding = async (locked) => {
    try {
      await adminService.lockBidding(locked);
    } catch (error) {
      alert('Error locking bidding: ' + error.response?.data?.error);
    }
  };

  const handleUpdateIncrements = async () => {
    try {
      await adminService.updateBidIncrements(
        newIncrements.increment1,
        newIncrements.increment2,
        newIncrements.increment3
      );
      alert('Bid increments updated!');
    } catch (error) {
      alert('Error updating increments: ' + error.response?.data?.error);
    }
  };

  const handleUpdateMaxPlayers = async () => {
    try {
      await adminService.updateMaxPlayersPerTeam(parseInt(newMaxPlayersPerTeam));
      alert('Team size updated!');
    } catch (error) {
      alert('Error updating team size: ' + error.response?.data?.error);
    }
  };

  const handleUpdateEnforceMaxBid = async (val) => {
    try {
      await adminService.updateEnforceMaxBid(val);
      alert(`Bidding logic ${val ? 'enabled' : 'disabled'}!`);
    } catch (error) {
      alert('Error updating bidding logic: ' + error.response?.data?.error);
    }
  };

  const handleDeleteAllPlayers = async () => {
    if (!confirm('CRITICAL: Are you sure you want to delete ALL players and bids permanently? This action cannot be undone.')) {
      return;
    }
    const doubleCheck = prompt('Type "DELETE" to confirm permanent deletion:');
    if (doubleCheck !== 'DELETE') return;

    try {
      await adminService.deleteAllPlayers();
      alert('All players and bids deleted successfully');
      loadData();
    } catch (error) {
      alert('Error deleting all players: ' + error.response?.data?.error);
    }
  };

  const loadTeams = async () => {
    try {
      const teamsData = await adminService.getAllTeams();
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const handleMarkPlayer = async (status) => {
    if (!currentPlayer) {
      alert('No player selected');
      return;
    }

    try {
      // For SOLD, backend will automatically use the highest bidder
      // For UNSOLD, proceed directly
      await adminService.markPlayer(currentPlayer.id, status, null, null);

      if (status === 'SOLD') {
        const teamName = highestBid ? highestBid.team_name : 'leading team';
        alert(`Player marked as SOLD to ${teamName}`);
        loadTeams(); // Refresh teams to update budgets
      } else {
        alert(`Player marked as ${status}`);
      }

      loadPlayers();

      // The backend will automatically load the next player via Socket.IO
      // The 'player-loaded' event listener will handle updating the UI
    } catch (error) {
      alert('Error marking player: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleResetUnsoldTag = async (playerId) => {
    if (!confirm('Reset unsold tag for this player? This will remove the "PREVIOUSLY UNSOLD" indicator.')) {
      return;
    }

    try {
      await adminService.resetUnsoldTag(playerId);
      alert('Unsold tag reset successfully');
      loadPlayers();
      // If this is the current player, reload current bid to refresh the UI
      if (currentPlayer && currentPlayer.id === playerId) {
        loadCurrentBid();
      }
    } catch (error) {
      alert('Error resetting unsold tag: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateTeamBudget = async (teamId) => {
    if (!newBudget || parseFloat(newBudget) < 0) {
      alert('Invalid budget amount');
      return;
    }

    try {
      await adminService.updateTeamBudget(teamId, parseFloat(newBudget));
      alert('Budget updated successfully');
      setEditingTeamBudget(null);
      setNewBudget('');
      loadTeams();
    } catch (error) {
      alert('Error updating budget: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleLockTeamBidding = async (teamId, locked) => {
    try {
      await adminService.lockTeamBidding(teamId, locked);
      loadTeams();
    } catch (error) {
      alert('Error updating team lock status: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddTeam = () => {
    setEditingTeam(null);
    setTeamForm({ name: '', owner_name: '', budget: '', logo: null });
    setTeamLogoPreview(null);
    setShowTeamModal(true);
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name || '',
      owner_name: team.owner_name || '',
      budget: team.budget?.toString() || '',
      logo: null
    });
    setTeamLogoPreview(team.logo ? getImageUrl(team.logo) : null);
    setShowTeamModal(true);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      await adminService.deleteTeam(teamId);
      alert('Team deleted successfully');
      loadTeams();
    } catch (error) {
      alert('Error deleting team: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTeamLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Logo file size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      setTeamForm({ ...teamForm, logo: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setTeamLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTeam = async () => {
    if (!teamForm.name || !teamForm.name.trim()) {
      alert('Team name is required');
      return;
    }

    try {
      console.log('Saving team:', teamForm);
      if (editingTeam) {
        await adminService.updateTeam(editingTeam.id, teamForm);
        alert('Team updated successfully');
      } else {
        await adminService.addTeam(teamForm);
        alert('Team added successfully');
      }
      setShowTeamModal(false);
      setEditingTeam(null);
      setTeamForm({ name: '', owner_name: '', budget: '', logo: null });
      setTeamLogoPreview(null);
      loadTeams();
    } catch (error) {
      console.error('Error saving team:', error);
      const errorMessage = error.message || 'Unknown error';
      alert('Error saving team: ' + errorMessage);
    }
  };

  const loadTeamSquads = async () => {
    try {
      const data = await adminService.getTeamSquads();
      setTeamSquads(data);
    } catch (error) {
      console.error('Error loading team squads:', error);
      alert('Error loading team squads: ' + (error.message || 'Unknown error'));
    }
  };

  const handleRemovePlayerFromTeam = async (playerId, playerName) => {
    if (!confirm(`Are you sure you want to remove ${playerName} from the team and return them to auction?`)) {
      return;
    }

    try {
      await adminService.removePlayerFromTeam(playerId);
      alert(`${playerName} has been removed from the team and returned to auction`);
      loadTeamSquads();
      loadPlayers();
      loadTeams();
    } catch (error) {
      alert('Error removing player: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleResetBidding = async () => {
    if (!confirm('Reset bidding for current player?')) return;
    try {
      await adminService.resetBidding();
    } catch (error) {
      alert('Error resetting bidding: ' + error.response?.data?.error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Force full page reload to clear all state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if logout fails
      window.location.href = '/login';
    }
  };

  const loadHistory = async () => {
    try {
      const data = await adminService.getAuctionHistory();
      setHistory(data.history || []);
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setPlayerForm({
      name: '',
      image: '',
      role: 'Batsman',
      country: '',
      base_price: '',
      serial_number: ''
    });
    setShowPlayerModal(true);
  };

  const handleEditPlayer = (player) => {
    setEditingPlayer(player);
    setPlayerForm({
      name: player.name || '',
      image: player.image || '',
      role: player.role || 'Batsman',
      country: player.country || '',
      base_price: player.base_price || '',
      serial_number: player.serial_number || ''
    });
    setImageFile(null);
    setImagePreview(player.image || null);
    setShowPlayerModal(true);
  };

  const handleDeletePlayer = async (playerId) => {
    if (!confirm('Are you sure you want to delete this player? This will also delete all associated bids.')) {
      return;
    }
    try {
      await adminService.deletePlayer(playerId);
      alert('Player deleted successfully');
      loadPlayers();
    } catch (error) {
      alert('Error deleting player: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        e.target.value = ''; // Clear the input
        return;
      }

      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.onerror = () => {
        alert('Error reading image file');
        setImageFile(null);
        setImagePreview(null);
      };
      reader.readAsDataURL(file);
    } else {
      // Clear preview if no file selected
      setImageFile(null);
      if (!playerForm.image) {
        setImagePreview(null);
      }
    }
  };

  const handleSavePlayer = async () => {
    if (!playerForm.name || !playerForm.role || !playerForm.base_price) {
      alert('Please fill in all required fields (Name, Role, Base Price)');
      return;
    }

    try {
      let imageUrl = playerForm.image;

      // Upload image if file is selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          console.log('Uploading image:', imageFile.name);
          imageUrl = await adminService.uploadImage(imageFile);
          console.log('Image uploaded successfully:', imageUrl);
          setUploadingImage(false);
        } catch (error) {
          console.error('Image upload error:', error);
          setUploadingImage(false);
          alert('Error uploading image: ' + (error.message || 'Upload failed. Please try again.'));
          return;
        }
      } else if (!playerForm.image) {
        // No image file and no URL provided
        imageUrl = null;
      }

      if (editingPlayer) {
        const result = await adminService.updatePlayer(editingPlayer.id, {
          name: playerForm.name,
          image: imageUrl || null,
          role: playerForm.role,
          country: playerForm.country || null,
          base_price: parseFloat(playerForm.base_price),
          serial_number: playerForm.serial_number ? parseInt(playerForm.serial_number) : null
        });
        console.log('Player updated:', result);
        setShowPlayerModal(false);
        setImageFile(null);
        setImagePreview(null);
        // loadPlayers will be called by Socket.IO event
        setTimeout(() => loadPlayers(), 500);
      } else {
        const result = await adminService.addPlayer({
          name: playerForm.name,
          image: imageUrl || null,
          role: playerForm.role,
          country: playerForm.country || null,
          base_price: parseFloat(playerForm.base_price),
          serial_number: playerForm.serial_number ? parseInt(playerForm.serial_number) : null
        });
        console.log('Player added:', result);
        setShowPlayerModal(false);
        setImageFile(null);
        setImagePreview(null);
        // loadPlayers will be called by Socket.IO event
        setTimeout(() => loadPlayers(), 500);
      }
    } catch (error) {
      console.error('Error saving player:', error);
      alert('Error saving player: ' + (error.response?.data?.error || error.message));
    }
  };

  const currentBid = highestBid ? highestBid.amount : (currentPlayer ? currentPlayer.base_price : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 flex justify-between items-center border border-gray-700">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex flex-col gap-1.5 p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <div className="w-6 h-0.5 bg-white"></div>
              <div className="w-6 h-0.5 bg-white"></div>
              <div className="w-6 h-0.5 bg-white"></div>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm">Welcome, {user.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Sidebar Menu */}
        {showSidebar && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowSidebar(false)}>
            <div
              className="fixed left-0 top-0 h-full w-80 bg-gray-800 border-r border-gray-700 shadow-xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Menu</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-white hover:text-gray-400 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => {
                    setShowTeamManagement(true);
                    setShowSidebar(false);
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-left"
                >
                  <div className="font-semibold">Team Management</div>
                  <div className="text-sm text-blue-200">Add, edit, or remove teams</div>
                </button>
                <button
                  onClick={async () => {
                    await loadTeamSquads();
                    setShowTeamSquads(true);
                    setShowSidebar(false);
                  }}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-left"
                >
                  <div className="font-semibold">Team Squads</div>
                  <div className="text-sm text-purple-200">View players sold to each team</div>
                </button>
                <button
                  onClick={() => {
                    setShowPurseMonitoring(true);
                    setShowSidebar(false);
                  }}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-left"
                >
                  <div className="font-semibold">Team Purses</div>
                  <div className="text-sm text-green-200">Monitor all team remaining amounts</div>
                </button>
                <button
                  onClick={() => {
                    setShowBiddingLogicModal(true);
                    setShowSidebar(false);
                  }}
                  className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-left"
                >
                  <div className="font-semibold">Bidding Logic</div>
                  <div className="text-sm text-yellow-100">Manage max bid constraints</div>
                </button>
                <div className="pt-4 border-t border-gray-700 mt-4">
                  <button
                    onClick={handleDeleteAllPlayers}
                    className="w-full px-4 py-3 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg transition-colors text-left border border-red-700"
                  >
                    <div className="font-semibold text-red-100">Clear All Data</div>
                    <div className="text-sm text-red-400">Permanently delete all players & bids</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Player Card */}
          <div className="lg:col-span-2 space-y-4">
            {/* Auction Status */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-lg font-semibold ${auctionState.status === 'LIVE' ? 'bg-green-600 text-white' :
                    auctionState.status === 'PAUSED' ? 'bg-yellow-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                    {auctionState.status}
                  </div>
                  {auctionState.biddingLocked && (
                    <div className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">
                      BIDDING LOCKED
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange('LIVE')}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    START
                  </button>
                  <button
                    onClick={() => handleStatusChange('PAUSED')}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                  >
                    PAUSE
                  </button>
                  <button
                    onClick={() => handleStatusChange('STOPPED')}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    STOP
                  </button>
                </div>
              </div>
            </div>

            {/* Player Card */}
            {currentPlayer ? (
              <div className={`bg-gray-800 rounded-lg p-6 border-2 ${currentPlayer.was_unsold ? 'border-orange-500 shadow-lg shadow-orange-500/50' : 'border-gray-700'
                }`}>
                {currentPlayer.was_unsold && (
                  <div className="mb-4 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-center">
                    ⚠️ PREVIOUSLY UNSOLD - BACK IN AUCTION
                  </div>
                )}
                <div className="flex gap-6">
                  <div className="relative">
                    <img
                      src={getImageUrl(currentPlayer.image)}
                      alt={currentPlayer.name}
                      className="w-48 h-64 object-cover rounded-lg"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/200x300?text=Player';
                      }}
                    />
                    {currentPlayer.serial_number && (
                      <div className="absolute -top-3 -right-3 bg-yellow-400 text-blue-900 font-bold text-3xl px-6 py-2 rounded-full shadow-lg">
                        {currentPlayer.serial_number}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-2">{currentPlayer.name}</h2>
                    <div className="space-y-2 mb-4">
                      <p className="text-gray-300"><span className="font-semibold">Role:</span> {currentPlayer.role}</p>
                      <p className="text-gray-300"><span className="font-semibold">Country:</span> {currentPlayer.country || 'N/A'}</p>
                      <p className="text-gray-300"><span className="font-semibold">Base Price:</span> ₹{currentPlayer.base_price?.toLocaleString()}</p>
                      <p className="text-gray-300"><span className="font-semibold">Status:</span> {currentPlayer.status}</p>
                    </div>
                  </div>
                </div>

                {/* Current Bid Display */}
                <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-2">Current Bid</p>
                    <p className="text-4xl font-bold text-green-400 mb-2">₹{currentBid.toLocaleString()}</p>
                    {highestBid && (
                      <p className="text-xl text-white">
                        Leading: <span className="font-semibold text-green-400">{highestBid.team_name}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Player Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleMarkPlayer('SOLD')}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Mark as SOLD
                  </button>
                  <button
                    onClick={() => handleMarkPlayer('UNSOLD')}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Mark as UNSOLD
                  </button>
                  {currentPlayer.was_unsold && (
                    <button
                      onClick={() => handleResetUnsoldTag(currentPlayer.id)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                      title="Reset unsold tag"
                    >
                      Reset Unsold Tag
                    </button>
                  )}
                  <button
                    onClick={handleResetBidding}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Reset Bidding
                  </button>
                  <button
                    onClick={handleUndoBid}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                  >
                    Undo Last Bid
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center text-gray-400">
                No player loaded
              </div>
            )}

            {/* Load Player */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Load Player</h3>
              <div className="flex gap-2">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select a player</option>
                  {players.filter(p => p.status === 'AVAILABLE').map(player => (
                    <option key={player.id} value={player.id}>
                      {player.was_unsold ? '⚠️ ' : ''}{player.serial_number ? `#${player.serial_number} ` : ''}{player.name} - {player.role} (₹{player.base_price?.toLocaleString()})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLoadPlayer}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Load
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Bid Increments */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Bid Increments</h3>
              <div className="space-y-2 mb-3">
                <input
                  type="number"
                  value={newIncrements.increment1}
                  onChange={(e) => setNewIncrements({ ...newIncrements, increment1: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Increment 1"
                />
                <input
                  type="number"
                  value={newIncrements.increment2}
                  onChange={(e) => setNewIncrements({ ...newIncrements, increment2: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Increment 2"
                />
                <input
                  type="number"
                  value={newIncrements.increment3}
                  onChange={(e) => setNewIncrements({ ...newIncrements, increment3: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Increment 3"
                />
              </div>
              <button
                onClick={handleUpdateIncrements}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Update Increments
              </button>
              <div className="mt-2 text-sm text-gray-400">
                Current: ₹{bidIncrements.increment1} / ₹{bidIncrements.increment2} / ₹{bidIncrements.increment3}
              </div>
            </div>

            {/* Team Size Configuration */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Team Size Limit</h3>
              <div className="space-y-2 mb-3">
                <input
                  type="number"
                  value={newMaxPlayersPerTeam}
                  onChange={(e) => setNewMaxPlayersPerTeam(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Max players per team"
                  min="1"
                  max="50"
                />
              </div>
              <button
                onClick={handleUpdateMaxPlayers}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Update Team Size
              </button>
              <div className="mt-2 text-sm text-gray-400">
                Current Limit: {maxPlayersPerTeam} Players
              </div>
            </div>

            {/* Lock Bidding */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Bidding Control</h3>
              <button
                onClick={() => handleLockBidding(!auctionState.biddingLocked)}
                className={`w-full px-4 py-2 rounded-lg transition-colors ${auctionState.biddingLocked
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
              >
                {auctionState.biddingLocked ? 'Unlock Bidding' : 'Lock Bidding'}
              </button>
            </div>

            {/* All Bids */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">All Bids</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allBids.length > 0 ? (
                  allBids.map((bid, index) => (
                    <div key={bid.id} className="p-2 bg-gray-700 rounded text-sm">
                      <div className="text-white font-semibold">{bid.team_name}</div>
                      <div className="text-green-400">₹{bid.amount.toLocaleString()}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No bids yet</p>
                )}
              </div>
            </div>

            {/* History */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <button
                onClick={loadHistory}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                View Auction History
              </button>
            </div>

            {/* Player Management */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Player Management</h3>
              <button
                onClick={handleAddPlayer}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mb-2"
              >
                Add New Player
              </button>
              <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>
                {players.length > 0 ? (
                  players.map((player) => (
                    <div key={player.id} className="p-2 bg-gray-700 rounded text-sm flex justify-between items-center min-w-0">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-white font-semibold truncate">
                          {player.was_unsold ? '⚠️ ' : ''}{player.name}
                        </div>
                        <div className="text-gray-400 text-xs">{player.role} • ₹{player.base_price?.toLocaleString()}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {player.was_unsold && (
                          <button
                            onClick={() => handleResetUnsoldTag(player.id)}
                            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs whitespace-nowrap"
                            title="Reset unsold tag"
                          >
                            Reset Tag
                          </button>
                        )}
                        <button
                          onClick={() => handleEditPlayer(player)}
                          className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs whitespace-nowrap"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(player.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm text-center py-2">No players yet</p>
                )}
              </div>
            </div>

            {/* Team Budget Management */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Team Budget Management</h3>
              <div className="space-y-3">
                {teams.length > 0 ? (
                  teams.map((team) => (
                    <div key={team.id} className="bg-gray-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-white font-semibold">{team.name}</div>
                            {team.bidding_locked && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-semibold">
                                🔒 LOCKED
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-sm">Current Budget: ₹{team.budget?.toLocaleString() || '0'}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {editingTeamBudget === team.id ? (
                          <>
                            <input
                              type="number"
                              value={newBudget}
                              onChange={(e) => setNewBudget(e.target.value)}
                              className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white w-32"
                              placeholder="New budget"
                              min="0"
                              step="1000"
                            />
                            <button
                              onClick={() => handleUpdateTeamBudget(team.id)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingTeamBudget(null);
                                setNewBudget('');
                              }}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingTeamBudget(team.id);
                                setNewBudget(team.budget?.toString() || '0');
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                            >
                              Edit Budget
                            </button>
                            <button
                              onClick={() => handleLockTeamBidding(team.id, !team.bidding_locked)}
                              className={`px-3 py-1.5 rounded transition-colors text-sm ${team.bidding_locked
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                            >
                              {team.bidding_locked ? '🔓 Unlock Bidding' : '🔒 Lock Bidding'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm text-center py-2">Loading teams...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Auction History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-700 rounded">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">{item.player_name}</span>
                      <span className="text-green-400">₹{item.amount.toLocaleString()}</span>
                    </div>
                    <div className="text-gray-400 text-sm">{item.team_name} • {new Date(item.timestamp).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Player Add/Edit Modal */}
        {showPlayerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  {editingPlayer ? 'Edit Player' : 'Add New Player'}
                </h2>
                <button
                  onClick={() => {
                    setShowPlayerModal(false);
                    // Reset form after a delay to allow modal to close
                    setTimeout(() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }, 300);
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={playerForm.name}
                    onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Serial Number</label>
                  <input
                    type="number"
                    value={playerForm.serial_number}
                    onChange={(e) => setPlayerForm({ ...playerForm, serial_number: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Auto-adjusts other numbers"
                    min="1"
                  />
                  <p className="text-gray-400 text-xs mt-1">If a number is inserted, others will adjust automatically</p>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Player Image</label>

                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="mb-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-600"
                      />
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="mb-3">
                    <label className="block text-gray-300 text-xs mb-1">Upload from PC:</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                  </div>

                  {/* URL Input (Alternative) */}
                  <div>
                    <label className="block text-gray-300 text-xs mb-1">Or enter Image URL:</label>
                    <input
                      type="text"
                      value={playerForm.image}
                      onChange={(e) => {
                        setPlayerForm({ ...playerForm, image: e.target.value });
                        if (e.target.value) {
                          setImagePreview(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  {uploadingImage && (
                    <p className="text-yellow-400 text-xs mt-2">Uploading image...</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Role *</label>
                  <select
                    value={playerForm.role}
                    onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="WK">WK (Wicket-Keeper)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Country</label>
                  <input
                    type="text"
                    value={playerForm.country}
                    onChange={(e) => setPlayerForm({ ...playerForm, country: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Country"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Base Price (₹) *</label>
                  <input
                    type="number"
                    value={playerForm.base_price}
                    onChange={(e) => setPlayerForm({ ...playerForm, base_price: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="1000000"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePlayer}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    {editingPlayer ? 'Update Player' : 'Add Player'}
                  </button>
                  <button
                    onClick={() => setShowPlayerModal(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Management Modal */}
        {showTeamManagement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-blue-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Team Management</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTeam}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    + Add Team
                  </button>
                  <button
                    onClick={() => setShowTeamManagement(false)}
                    className="text-white hover:text-gray-400 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <div key={team.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-3 mb-3">
                      {team.logo ? (
                        <img
                          src={getImageUrl(team.logo)}
                          alt={team.name}
                          className="w-12 h-12 object-cover rounded-full"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/48?text=Team';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                          {team.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold truncate">{team.name}</div>
                        {team.owner_name && (
                          <div className="text-gray-400 text-sm truncate">Owner: {team.owner_name}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-yellow-400 text-sm mb-3">
                      Budget: ₹{team.budget?.toLocaleString() || '0'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTeam(team)}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {teams.length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-8">
                    No teams found. Click "Add Team" to create one.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Team Modal */}
        {showTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border-2 border-blue-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  {editingTeam ? 'Edit Team' : 'Add New Team'}
                </h2>
                <button
                  onClick={() => {
                    setShowTeamModal(false);
                    setEditingTeam(null);
                    setTeamForm({ name: '', owner_name: '', budget: '', logo: null });
                    setTeamLogoPreview(null);
                  }}
                  className="text-white hover:text-gray-400 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Team Name *</label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Team name"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Owner Name <span className="text-gray-500 text-xs">(Optional)</span></label>
                  <input
                    type="text"
                    value={teamForm.owner_name}
                    onChange={(e) => setTeamForm({ ...teamForm, owner_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Owner name (optional)"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Budget (₹) <span className="text-gray-500 text-xs">(Optional)</span></label>
                  <input
                    type="number"
                    value={teamForm.budget}
                    onChange={(e) => setTeamForm({ ...teamForm, budget: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="1000000 (default)"
                    min="0"
                    step="1000"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Team Logo <span className="text-gray-500 text-xs">(Optional)</span></label>
                  {teamLogoPreview && (
                    <div className="mb-3">
                      <img
                        src={teamLogoPreview}
                        alt="Logo preview"
                        className="w-24 h-24 object-cover rounded-lg border border-gray-600"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTeamLogoChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                  />
                  <p className="text-gray-400 text-xs mt-1">Max size: 5MB</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTeam}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    {editingTeam ? 'Update Team' : 'Add Team'}
                  </button>
                  <button
                    onClick={() => {
                      setShowTeamModal(false);
                      setEditingTeam(null);
                      setTeamForm({ name: '', owner_name: '', budget: '', logo: null });
                      setTeamLogoPreview(null);
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Squads Modal */}
        {showTeamSquads && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto border-2 border-purple-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Team Squads</h2>
                <button
                  onClick={() => setShowTeamSquads(false)}
                  className="text-white hover:text-gray-400 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamSquads.map((squad) => (
                  <div key={squad.team.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-3 mb-3">
                      {squad.team.logo ? (
                        <img
                          src={getImageUrl(squad.team.logo)}
                          alt={squad.team.name}
                          className="w-12 h-12 object-cover rounded-full"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/48?text=Team';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                          {squad.team.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg">{squad.team.name}</div>
                        {squad.team.owner_name && (
                          <div className="text-gray-400 text-sm">Owner: {squad.team.owner_name}</div>
                        )}
                        <div className="text-yellow-400 text-sm">Players: {squad.players.length}</div>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {squad.players.length > 0 ? (
                        squad.players.map((player) => (
                          <div key={player.id} className="bg-gray-800 rounded p-2 flex items-center gap-2">
                            {player.image && (
                              <img
                                src={getImageUrl(player.image)}
                                alt={player.name}
                                className="w-10 h-10 object-cover rounded"
                                onError={(e) => {
                                  e.target.src = 'https://via.placeholder.com/40?text=P';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-semibold text-sm truncate">{player.name}</div>
                              <div className="text-gray-400 text-xs">{player.role}</div>
                            </div>
                            <div className="text-green-400 font-semibold text-sm">
                              ₹{player.sold_price?.toLocaleString() || '0'}
                            </div>
                            <button
                              onClick={() => handleRemovePlayerFromTeam(player.id, player.name)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs whitespace-nowrap transition-colors"
                              title="Remove from team and return to auction"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-400 text-sm text-center py-4">No players sold yet</div>
                      )}
                    </div>
                  </div>
                ))}
                {teamSquads.length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-8">
                    No teams found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Purse Monitoring Modal */}
        {showPurseMonitoring && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-green-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Team Purse Monitoring</h2>
                <button
                  onClick={() => setShowPurseMonitoring(false)}
                  className="text-white hover:text-gray-400 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <div key={team.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-3 mb-3">
                      {team.logo ? (
                        <img
                          src={getImageUrl(team.logo)}
                          alt={team.name}
                          className="w-12 h-12 object-cover rounded-full"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/48?text=Team';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                          {team.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-white font-bold truncate">{team.name}</div>
                        <div className="text-gray-400 text-sm">Owner: {team.owner_name || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">REMAINING PURSE</div>
                      <div className="text-2xl font-bold text-green-400">₹{team.budget?.toLocaleString() || '0'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bidding Logic Modal */}
        {showBiddingLogicModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border-2 border-yellow-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Bidding Logic Settings</h2>
                <button
                  onClick={() => setShowBiddingLogicModal(false)}
                  className="text-white hover:text-gray-400 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="space-y-6">
                <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white font-semibold">Enforce Max Bid Logic</label>
                    <button
                      onClick={() => handleUpdateEnforceMaxBid(!enforceMaxBid)}
                      className={`px-4 py-2 rounded-lg font-bold transition-colors ${enforceMaxBid ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'}`}
                    >
                      {enforceMaxBid ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-400">
                    If <strong>ON</strong>, owners MUST keep enough money for their remaining player slots (₹1000 per player).<br />
                    If <strong>OFF</strong>, owners can bid their entire purse on any single player.
                  </p>
                </div>

                <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                  <h4 className="text-blue-200 font-bold text-sm uppercase tracking-wider mb-2">Theoretical Team Limits</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {teams.map(team => (
                      <div key={team.id} className="flex justify-between text-xs border-b border-gray-700 pb-1">
                        <span className="text-white truncate mr-2">{team.name}</span>
                        <span className="text-blue-300 font-mono">Max: ₹{team.budget?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;

