import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { logout } from '../services/auth';
import * as ownerService from '../services/owner';
import { getImageUrl } from '../utils/imageUtils';


// Auto-detect API URL based on current host
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Use relative /api path for Vercel/proxies compatibility
  return '/api';
};

const API_URL = getApiUrl();

function OwnerDashboard({ user }) {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [biddingLocked, setBiddingLocked] = useState(false);
  const [status, setStatus] = useState('STOPPED');
  const [bidIncrements, setBidIncrements] = useState({ increment1: 500, increment2: 1000 });
  const [bidding, setBidding] = useState({});
  const [bidFlash, setBidFlash] = useState(false);
  const [stats, setStats] = useState({ sold: 0, unsold: 0, available: 0 });
  const [previousBid, setPreviousBid] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [committedAmount, setCommittedAmount] = useState(0);
  const [teamBiddingLocked, setTeamBiddingLocked] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [showAvailableModal, setShowAvailableModal] = useState(false);
  const [showUnsoldModal, setShowUnsoldModal] = useState(false);
  const [showTeamBrowserModal, setShowTeamBrowserModal] = useState(false);
  const [soldPlayers, setSoldPlayers] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [notification, setNotification] = useState(null);
  const [notificationKey, setNotificationKey] = useState(0);

  // Financial constraints state
  const [totalAllowedPlayers, setTotalAllowedPlayers] = useState(10);
  const [playersBought, setPlayersBought] = useState(0);
  const [remainingPlayers, setRemainingPlayers] = useState(0);
  const [minimumAmountToKeep, setMinimumAmountToKeep] = useState(0);
  const [maxBidAllowed, setMaxBidAllowed] = useState(0);
  const [bidLockout, setBidLockout] = useState(false);

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
    loadCurrentInfo();

    // Socket event listeners
    newSocket.on('player-loaded', (data) => {
      setCurrentPlayer(data.player);
      setHighestBid(null);
      loadCurrentInfo();
    });

    newSocket.on('bid-placed', (data) => {
      setBidFlash(true);
      setTimeout(() => setBidFlash(false), 500);



      // 3-second bid lockout
      setBidLockout(true);
      setTimeout(() => setBidLockout(false), 3000);

      setPreviousBid(data.bid ? data.bid.amount : currentBid);
      loadCurrentInfo();
    });

    newSocket.on('bid-updated', (data) => {
      setBidFlash(true);
      setTimeout(() => setBidFlash(false), 500);

      // 3-second bid lockout
      setBidLockout(true);
      setTimeout(() => setBidLockout(false), 3000);

      setPreviousBid(data.highestBid ? data.highestBid.amount : currentBid);
      loadCurrentInfo();
    });

    newSocket.on('auction-status-changed', (data) => {
      setStatus(data.status);
    });

    newSocket.on('bidding-locked', (data) => {
      setBiddingLocked(data.locked);
    });

    newSocket.on('bid-increments-changed', (data) => {
      setBidIncrements({
        increment1: data.increment1,
        increment2: data.increment2
      });
    });

    newSocket.on('max-players-changed', () => {
      loadCurrentInfo();
    });

    newSocket.on('bidding-reset', () => {
      setHighestBid(null);
      loadCurrentInfo();
    });

    newSocket.on('player-marked', () => {
      loadCurrentInfo();
    });

    newSocket.on('team-budget-updated', (data) => {
      if (data.teamId === user.teamId) {
        loadCurrentInfo();
      }
    });

    newSocket.on('team-bidding-locked', (data) => {
      if (data.teamId === user.teamId) {
        loadCurrentInfo();
      }
    });

    // Poll for updates every 2 seconds as backup
    const interval = setInterval(loadCurrentInfo, 2000);

    return () => {
      newSocket.close();
      clearInterval(interval);
    };
  }, []);

  const loadCurrentInfo = async () => {
    try {
      const data = await ownerService.getCurrentInfo();
      setCurrentPlayer(data.player);
      setHighestBid(data.highestBid);
      setCurrentBid(data.currentBid || 0);
      setBiddingLocked(data.biddingLocked);
      setStatus(data.status);
      setBidIncrements(data.bidIncrements);
      setWalletBalance(data.walletBalance || 0);
      setTotalBudget(data.totalBudget || 0);
      setCommittedAmount(data.committedAmount || 0);
      setTeamBiddingLocked(data.teamBiddingLocked || false);

      // Update financial constraints
      setTotalAllowedPlayers(data.totalAllowedPlayers || 10);
      setPlayersBought(data.playersBought || 0);
      setRemainingPlayers(data.remainingPlayers || 0);
      setMinimumAmountToKeep(data.minimumAmountToKeep || 0);
      setMaxBidAllowed(data.maxBidAllowed !== undefined ? data.maxBidAllowed : (data.totalBudget || 0));

      // Load stats
      if (data.stats) {
        setStats(data.stats);
      } else {
        // Default stats if not provided
        setStats({ sold: 0, unsold: 0, available: 0 });
      }
      if (data.highestBid) {
        setPreviousBid(data.highestBid.amount);
      } else if (data.player) {
        setPreviousBid(data.player.base_price);
      }
    } catch (error) {
      console.error('Error loading current info:', error);
    }
  };

  const loadSoldPlayers = async () => {
    try {
      const players = await ownerService.getPlayersByStatus('SOLD');
      setSoldPlayers(players);
      setShowSoldModal(true);
    } catch (error) {
      console.error('Error loading sold players:', error);
    }
  };

  const loadAvailablePlayers = async () => {
    try {
      const players = await ownerService.getPlayersByStatus('AVAILABLE');
      setAvailablePlayers(players);
      setShowAvailableModal(true);
    } catch (error) {
      console.error('Error loading available players:', error);
    }
  };

  const loadUnsoldPlayers = async () => {
    try {
      const players = await ownerService.getPlayersByStatus('UNSOLD');
      setUnsoldPlayers(players);
      setShowUnsoldModal(true);
    } catch (error) {
      console.error('Error loading unsold players:', error);
    }
  };

  const loadTeams = async () => {
    try {
      console.log('Loading teams...');
      const teamsData = await ownerService.getTeams();
      console.log('Teams loaded:', teamsData);
      setTeams(teamsData);
      setSelectedTeam(null);
      setTeamPlayers([]);
      setShowTeamBrowserModal(true);
    } catch (error) {
      console.error('Error loading teams:', error);
      alert('Failed to load teams: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadTeamPlayers = async (team) => {
    try {
      console.log('Loading players for team:', team);
      const players = await ownerService.getTeamPlayers(team.id);
      console.log('Team players loaded:', players);
      setTeamPlayers(players);
      setSelectedTeam(team);
    } catch (error) {
      console.error('Error loading team players:', error);
      alert('Failed to load team players: ' + (error.response?.data?.error || error.message));
    }
  };


  const handleBid = async (increment) => {
    if (bidding[increment]) return; // Prevent double clicks

    const newBidAmount = currentBid + increment;

    setBidding({ ...bidding, [increment]: true });

    try {
      console.log('Placing bid:', newBidAmount, 'Current balance:', walletBalance);
      const response = await ownerService.placeBid(newBidAmount);
      console.log('Bid response:', response);
      playBidSound();

      // Update wallet balance immediately from response
      if (response && response.walletBalance !== undefined) {
        console.log('Updating wallet balance to:', response.walletBalance);
        setWalletBalance(response.walletBalance);
      }
      if (response && response.totalBudget !== undefined) {
        setTotalBudget(response.totalBudget);
      }
      if (response && response.committedAmount !== undefined) {
        setCommittedAmount(response.committedAmount);
      }

      // Also reload current info to ensure everything is in sync
      setTimeout(() => {
        loadCurrentInfo();
      }, 100);
    } catch (error) {
      console.error('Bid error:', error);
      alert(error.response?.data?.error || error.message || 'Bid failed');
    } finally {
      setTimeout(() => {
        setBidding({ ...bidding, [increment]: false });
      }, 1000);
    }
  };

  const handleBasePriceBid = async () => {
    if (!currentPlayer || !currentPlayer.base_price) return;
    if (bidding['base']) return; // Prevent double clicks

    const basePriceAmount = currentPlayer.base_price;

    setBidding({ ...bidding, base: true });

    try {
      console.log('Placing base price bid:', basePriceAmount, 'Current balance:', walletBalance);
      const response = await ownerService.placeBid(basePriceAmount);
      console.log('Base price bid response:', response);
      playBidSound();

      // Update wallet balance immediately from response
      if (response && response.walletBalance !== undefined) {
        console.log('Updating wallet balance to:', response.walletBalance);
        setWalletBalance(response.walletBalance);
      }
      if (response && response.totalBudget !== undefined) {
        setTotalBudget(response.totalBudget);
      }
      if (response && response.committedAmount !== undefined) {
        setCommittedAmount(response.committedAmount);
      }

      // Also reload current info to ensure everything is in sync
      setTimeout(() => {
        loadCurrentInfo();
      }, 100);
    } catch (error) {
      console.error('Base price bid error:', error);
      alert(error.response?.data?.error || error.message || 'Bid failed');
    } finally {
      setTimeout(() => {
        setBidding({ ...bidding, base: false });
      }, 1000);
    }
  };

  const playBidSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
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

  const canBid = status === 'LIVE' && !biddingLocked && !teamBiddingLocked && highestBid?.team_id !== user.teamId && !bidLockout;
  const isLeading = highestBid?.team_id === user.teamId;

  // Format number in Indian style (1,00,000)
  const formatIndianNumber = (num) => {
    return num.toLocaleString('en-IN');
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Stadium Background Image */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url('/stadium_img.webp')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Top Navigation Bar - Mobile Responsive */}
        <div className="bg-gradient-to-r from-blue-900/95 to-green-900/95 border-b-2 border-yellow-400 shadow-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 w-full sm:w-auto">
                {/* Menu Button */}
                <button
                  onClick={loadTeams}
                  className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 p-2 rounded-lg font-bold transition-colors shadow-lg"
                  title="View Teams"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <img src="/ezauction.png" alt="EzAuction" className="h-12 sm:h-16 object-contain" />
              </div>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-white text-xs sm:text-sm flex gap-2 sm:gap-4">
                  <span className="hover:text-yellow-400 cursor-pointer hidden sm:inline">WELCOME</span>
                  <span className="text-yellow-400 font-bold">AUCTION</span>
                  <span className="hover:text-yellow-400 cursor-pointer hidden sm:inline">TEAMS</span>
                  <span className="hover:text-yellow-400 cursor-pointer hidden sm:inline">PLAYERS</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-400 rounded-full flex items-center justify-center text-blue-900 font-bold text-xs sm:text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-white hover:text-yellow-400 text-xs sm:text-sm px-2 py-1"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Mobile Responsive */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
          {currentPlayer ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Player Section */}
              <div className={`bg-gradient-to-br from-blue-900/95 to-green-900/95 rounded-xl sm:rounded-2xl p-4 sm:p-8 border-2 transition-all ${bidFlash ? 'border-yellow-400 shadow-2xl shadow-yellow-400/50' : 'border-blue-700'
                }`}>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center sm:items-start">
                  {/* Circular Player Image */}
                  <div className="relative">
                    <div className="w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 rounded-full border-4 border-yellow-400 p-1 bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-2xl">
                      <img
                        src={getImageUrl(currentPlayer.image)}
                        alt={currentPlayer.name}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.target.src = '/deafult_player.png';
                        }}
                      />
                    </div>
                    {currentPlayer.serial_number && (
                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-yellow-400 text-blue-900 font-bold text-sm sm:text-xl px-2 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-lg">
                        {currentPlayer.serial_number}
                      </div>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 w-full text-center sm:text-left">
                    {/* Yellow Info Bars */}
                    <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                      <div className="bg-yellow-400 text-blue-900 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-xl shadow-lg">
                        {currentPlayer.name}
                      </div>
                      <div className="bg-yellow-400 text-blue-900 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-base sm:text-lg shadow-lg">
                        {currentPlayer.role}
                      </div>
                      <div className="bg-yellow-400 text-blue-900 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-sm sm:text-lg shadow-lg">
                        {currentPlayer.base_price ? `Base: ₹${formatIndianNumber(currentPlayer.base_price)}` : 'Base Price'}
                      </div>
                    </div>

                    {/* Current Bid Display */}
                    <div className="bg-yellow-400 rounded-xl p-4 sm:p-6 shadow-2xl">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <div className="text-blue-900 text-xs sm:text-sm font-semibold mb-1">CURRENT BID</div>
                          <div className={`text-blue-900 text-3xl sm:text-4xl md:text-5xl font-bold transition-all ${bidFlash ? 'scale-110' : ''
                            }`}>
                            ₹{formatIndianNumber(currentBid)}
                          </div>
                          {highestBid && (
                            <div className="text-blue-700 text-sm sm:text-lg mt-2">
                              Leading: <span className={`font-bold ${isLeading ? 'text-green-700' : 'text-blue-900'
                                }`}>
                                {highestBid.team_name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-4xl sm:text-6xl"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallet Balance */}
                <div className="mt-4 sm:mt-6 bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-4 sm:p-6 shadow-xl border-2 border-green-400">
                  <div className="text-white text-center">
                    <div className="text-xs sm:text-sm font-semibold mb-1">YOUR WALLET BALANCE</div>
                    <div className="text-2xl sm:text-4xl font-bold">₹{formatIndianNumber(walletBalance)}</div>
                    {committedAmount > 0 && (
                      <div className="mt-2 text-xs sm:text-sm opacity-90">
                        <div>Total Budget: ₹{formatIndianNumber(totalBudget)}</div>
                        <div className="text-yellow-200">Committed: ₹{formatIndianNumber(committedAmount)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Constraints Info */}
                <div className="mt-2 bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-blue-500/30">
                  <div className="flex justify-center text-sm">
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-500/20 w-full sm:w-1/2">
                      <div className="text-blue-200 text-xs text-center">Squad Size Limit</div>
                      <div className="text-white font-bold text-center text-lg">{playersBought}/{totalAllowedPlayers} Players</div>
                      <div className="text-gray-400 text-xs text-center">Needed: {remainingPlayers}</div>
                    </div>
                  </div>
                </div>

                {/* Status Indicators and Action Buttons - Mobile Responsive */}
                <div className="flex flex-wrap gap-2 sm:gap-4 mt-4 sm:mt-6 justify-center sm:justify-start">
                  <button
                    onClick={loadSoldPlayers}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm shadow-lg transition-colors"
                  >
                    My Players ({stats.sold || 0})
                  </button>
                  <button
                    onClick={loadUnsoldPlayers}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm shadow-lg transition-colors"
                  >
                    Unsold Players ({stats.unsold || 0})
                  </button>
                  <button
                    onClick={loadAvailablePlayers}
                    className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm shadow-lg transition-colors"
                  >
                    Remaining Players ({stats.available || 0})
                  </button>
                  {biddingLocked && (
                    <div className="bg-red-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm shadow-lg">
                      🔒 LOCKED
                    </div>
                  )}
                  {isLeading && (
                    <div className="bg-yellow-400 text-blue-900 px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-xs sm:text-sm shadow-lg">
                      🏆 YOU LEAD
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Control Panel - Mobile Responsive */}
              <div className="bg-gradient-to-r from-blue-900/95 to-green-900/95 rounded-xl p-4 sm:p-6 border-2 border-blue-700 shadow-xl">
                {/* Bid Buttons Container */}
                <div className="flex flex-row items-center justify-center gap-4 sm:gap-8 mt-2">
                  {/* Base Price Button */}
                  <button
                    onClick={handleBasePriceBid}
                    disabled={!canBid || bidding['base'] || !currentPlayer}
                    className={`flex-1 sm:flex-none px-4 sm:px-12 py-3 sm:py-5 rounded-lg font-bold text-sm sm:text-2xl transition-all shadow-lg ${canBid && !bidding['base'] && currentPlayer
                      ? 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-105 active:scale-95'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    Base Price
                  </button>

                </div>

                {/* Increment Buttons Row */}
                <div className="flex flex-row items-center justify-center gap-4 sm:gap-8 mt-4">
                  {/* First Configurable Increment Button */}
                  <button
                    onClick={() => handleBid(bidIncrements.increment1)}
                    disabled={!canBid || bidding[bidIncrements.increment1]}
                    className={`flex-1 sm:flex-none px-4 sm:px-12 py-3 sm:py-5 rounded-lg font-bold text-sm sm:text-2xl transition-all shadow-lg ${canBid && !bidding[bidIncrements.increment1]
                      ? 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-105 active:scale-95'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    +₹{formatIndianNumber(bidIncrements.increment1)}
                  </button>

                  {/* Second Configurable Increment Button */}
                  <button
                    onClick={() => handleBid(bidIncrements.increment2)}
                    disabled={!canBid || bidding[bidIncrements.increment2]}
                    className={`flex-1 sm:flex-none px-4 sm:px-12 py-3 sm:py-5 rounded-lg font-bold text-sm sm:text-2xl transition-all shadow-lg ${canBid && !bidding[bidIncrements.increment2]
                      ? 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-105 active:scale-95'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    +₹{formatIndianNumber(bidIncrements.increment2)}
                  </button>
                </div>

                {/* Right: Team Info */}
                <div className="text-white text-center sm:text-right mt-4 sm:mt-0">
                  <div className="text-xs sm:text-sm text-gray-300">Your Team</div>
                  <div className="text-yellow-400 font-bold text-sm sm:text-lg">{user.teamName}</div>
                </div>

                {!canBid && (
                  <div className="mt-4 text-center">
                    <p className="text-yellow-300 text-xs sm:text-sm">
                      {status !== 'LIVE' && '⏸ Auction is not live'}
                      {biddingLocked && '🔒 Bidding is locked by admin'}
                      {teamBiddingLocked && '🔒 Your team is locked from bidding by admin'}
                      {isLeading && '🏆 You are already the highest bidder'}
                      {bidLockout && '⏳ Please wait... (Lockout active)'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-900/95 to-green-900/95 rounded-xl sm:rounded-2xl p-8 sm:p-16 border-2 border-blue-700 text-center shadow-xl">
              <div className="text-yellow-400 text-3xl sm:text-4xl mb-4">🏏</div>
              <p className="text-white text-xl sm:text-2xl font-semibold">Waiting for admin to load a player...</p>
              <p className="text-gray-300 mt-2 text-sm sm:text-base">The auction will begin shortly</p>
            </div>
          )}
        </div>
      </div>

      {/* Sold Players Modal */}
      {showSoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-green-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-yellow-400">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-yellow-400">My Players</h2>
              <button
                onClick={() => setShowSoldModal(false)}
                className="text-white hover:text-yellow-400 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {soldPlayers
                .sort((a, b) => {
                  // Sort by serial_number in ascending order
                  const serialA = a.serial_number || 999;
                  const serialB = b.serial_number || 999;
                  return serialA - serialB;
                })
                .map((player) => (
                  <div key={player.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      {player.serial_number && (
                        <span className="bg-yellow-400 text-blue-900 font-bold text-lg px-3 py-1 rounded-full">
                          #{player.serial_number}
                        </span>
                      )}
                    </div>
                    <img
                      src={getImageUrl(player.image)}
                      alt={player.name}
                      className="w-full h-32 object-cover rounded mb-2"
                      onError={(e) => {
                        e.target.src = '/deafult_player.png';
                      }}
                    />
                    <h3 className="text-white font-bold text-lg">{player.name}</h3>
                    <p className="text-gray-400 text-sm">{player.role}</p>
                    <p className="text-yellow-400 font-semibold mt-2">₹{formatIndianNumber(player.sold_price || 0)}</p>
                    {player.team_name && (
                      <p className="text-green-400 text-sm mt-1">→ {player.team_name}</p>
                    )}
                  </div>
                ))}
              {soldPlayers.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-8">
                  No players sold yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available Players Modal */}
      {showAvailableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-green-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-yellow-400">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-yellow-400">Remaining Players</h2>
              <button
                onClick={() => setShowAvailableModal(false)}
                className="text-white hover:text-yellow-400 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {availablePlayers
                .sort((a, b) => {
                  // Sort by serial_number in ascending order
                  const serialA = a.serial_number || 999;
                  const serialB = b.serial_number || 999;
                  return serialA - serialB;
                })
                .map((player) => (
                  <div key={player.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      {player.serial_number && (
                        <span className="bg-yellow-400 text-blue-900 font-bold text-lg px-3 py-1 rounded-full">
                          #{player.serial_number}
                        </span>
                      )}
                    </div>
                    <img
                      src={getImageUrl(player.image)}
                      alt={player.name}
                      className="w-full h-32 object-cover rounded mb-2"
                      onError={(e) => {
                        e.target.src = '/deafult_player.png';
                      }}
                    />
                    <h3 className="text-white font-bold text-lg">{player.name}</h3>
                    <p className="text-gray-400 text-sm">{player.role}</p>
                  </div>
                ))}
              {availablePlayers.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-8">
                  No remaining players
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unsold Players Modal */}
      {showUnsoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-green-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-yellow-400">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-yellow-400">Unsold Players</h2>
              <button
                onClick={() => setShowUnsoldModal(false)}
                className="text-white hover:text-yellow-400 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {unsoldPlayers
                .sort((a, b) => {
                  // Sort by serial_number in ascending order
                  const serialA = a.serial_number || 999;
                  const serialB = b.serial_number || 999;
                  return serialA - serialB;
                })
                .map((player) => (
                  <div key={player.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      {player.serial_number && (
                        <span className="bg-yellow-400 text-blue-900 font-bold text-lg px-3 py-1 rounded-full">
                          #{player.serial_number}
                        </span>
                      )}
                    </div>
                    <img
                      src={getImageUrl(player.image)}
                      alt={player.name}
                      className="w-full h-32 object-cover rounded mb-2"
                      onError={(e) => {
                        e.target.src = '/deafult_player.png';
                      }}
                    />
                    <h3 className="text-white font-bold text-lg">{player.name}</h3>
                    <p className="text-gray-400 text-sm">{player.role}</p>
                  </div>
                ))}
              {unsoldPlayers.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-8">
                  No unsold players
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Browser Modal */}
      {showTeamBrowserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-green-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-yellow-400">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                {selectedTeam && (
                  <button
                    onClick={() => {
                      setSelectedTeam(null);
                      setTeamPlayers([]);
                    }}
                    className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-4 py-2 rounded-lg font-bold transition-colors"
                  >
                    ← Back
                  </button>
                )}
                <h2 className="text-2xl font-bold text-yellow-400">
                  {selectedTeam ? `${selectedTeam.name} - Players` : 'XYZ'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowTeamBrowserModal(false);
                  setSelectedTeam(null);
                  setTeamPlayers([]);
                }}
                className="text-white hover:text-yellow-400 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Team List View */}
            {!selectedTeam && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => loadTeamPlayers(team)}
                    className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 border border-gray-700 transition-colors text-left"
                  >
                    <h3 className="text-white font-bold text-xl">{team.name}</h3>
                    <p className="text-gray-400 text-sm mt-2">Click to view players →</p>
                  </button>
                ))}
                {teams.length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-8">
                    No teams available
                  </div>
                )}
              </div>
            )}

            {/* Team Players View */}
            {selectedTeam && (
              <div className="space-y-3">
                {teamPlayers
                  .sort((a, b) => {
                    // Sort by serial_number in ascending order
                    const serialA = a.serial_number || 999;
                    const serialB = b.serial_number || 999;
                    return serialA - serialB;
                  })
                  .map((player, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {player.serial_number && (
                          <span className="bg-yellow-400 text-blue-900 font-bold text-sm px-2 py-1 rounded">
                            #{player.serial_number}
                          </span>
                        )}
                        <h3 className="text-white font-bold text-lg">{player.name}</h3>
                      </div>
                      <p className="text-green-400 font-semibold text-lg">₹{formatIndianNumber(player.sold_price || 0)}</p>
                    </div>
                  ))}
                {teamPlayers.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No players purchased by this team yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerDashboard;
