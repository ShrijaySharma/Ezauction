import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { logout } from '../services/auth';
import * as hostService from '../services/host';
import BidNotification from '../components/BidNotification';
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

function HostDashboard({ user }) {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [biddingLocked, setBiddingLocked] = useState(false);
  const [status, setStatus] = useState('STOPPED');
  const [bidIncrements, setBidIncrements] = useState({ increment1: 500, increment2: 1000, increment3: 5000 });
  const [bidFlash, setBidFlash] = useState(false);
  const [stats, setStats] = useState({ sold: 0, unsold: 0, available: 0 });
  const [allBids, setAllBids] = useState([]);
  const [notification, setNotification] = useState(null);
  const [notificationKey, setNotificationKey] = useState(0);
  const [previousBid, setPreviousBid] = useState(0);
  const [teams, setTeams] = useState([]);
  const previousBidRef = useRef(0);
  const currentPlayerRef = useRef(null);
  const audioInitializedRef = useRef(false);
  const audioElementRef = useRef(null);

  // Initialize audio on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioInitializedRef.current) {
        try {
          const audio = new Audio('/notification_sound.wav');
          audio.preload = 'auto';
          audio.volume = 0.7;
          // Try to load the audio
          audio.load();
          audioElementRef.current = audio;
          audioInitializedRef.current = true;
          console.log('Audio initialized for notifications');
        } catch (err) {
          console.error('Error initializing audio:', err);
        }
      }
    };

    // Initialize on any user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, initAudio, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudio);
      });
    };
  }, []);

  useEffect(() => {
    // Initialize socket
    const newSocket = io(API_URL, { withCredentials: true });
    setSocket(newSocket);

    // Load initial data
    loadCurrentInfo();
    loadTeams();

    // Socket event listeners
    newSocket.on('player-loaded', (data) => {
      setCurrentPlayer(data.player);
      currentPlayerRef.current = data.player;
      setHighestBid(null);
      setPreviousBid(0);
      previousBidRef.current = 0;
      loadCurrentInfo();
    });

    newSocket.on('bid-placed', (data) => {
      setBidFlash(true);
      setTimeout(() => setBidFlash(false), 500);

      if (data.bid) {
        const newBid = data.bid.amount;

        // Use previous bid from server if available, otherwise use ref
        const prevBid = data.previousBid !== undefined ? data.previousBid : previousBidRef.current;

        // Calculate increment using server-provided previous bid or fallback
        let increment = 0;
        if (prevBid > 0 && prevBid < newBid) {
          increment = newBid - prevBid;
        } else if (prevBid === 0) {
          // First bid - calculate from base price
          const basePrice = currentPlayerRef.current?.base_price || currentBid || 0;
          increment = newBid - basePrice;
        } else {
          // Fallback: use ref if server didn't provide previous bid
          increment = newBid - previousBidRef.current;
        }

        // Update previous bid ref BEFORE showing notification to prevent race conditions
        previousBidRef.current = newBid;
        setPreviousBid(newBid);

        // Show notification immediately if there's a valid increment and team name
        if (increment > 0 && data.bid.team_name) {
          const newKey = `${Date.now()}-${Math.random()}`;
          setNotificationKey(newKey);
          setNotification({
            id: newKey,
            teamName: data.bid.team_name,
            increment: increment
          });
        }

        // Update bid state immediately
        setHighestBid(data.bid);
        setCurrentBid(data.bid.amount);
      }

      // Load info after a small delay to ensure notification is set first
      setTimeout(() => {
        loadCurrentInfo();
        loadAllBids();
      }, 100);
    });

    newSocket.on('bid-updated', (data) => {
      setBidFlash(true);
      setTimeout(() => setBidFlash(false), 500);

      if (data.highestBid) {
        const newBid = data.highestBid.amount;

        // Use previous bid from server if available, otherwise use ref
        const prevBid = data.previousBid !== undefined ? data.previousBid : previousBidRef.current;

        // Calculate increment using server-provided previous bid or fallback
        let increment = 0;
        if (prevBid > 0 && prevBid < newBid) {
          increment = newBid - prevBid;
        } else if (prevBid === 0) {
          // First bid - calculate from base price
          const basePrice = currentPlayerRef.current?.base_price || currentBid || 0;
          increment = newBid - basePrice;
        } else {
          // Fallback: use ref if server didn't provide previous bid
          increment = newBid - previousBidRef.current;
        }

        // Update previous bid ref BEFORE showing notification to prevent race conditions
        previousBidRef.current = newBid;
        setPreviousBid(newBid);

        // Show notification immediately if there's a valid increment and team name
        if (increment > 0 && data.highestBid.team_name) {
          const newKey = `${Date.now()}-${Math.random()}`;
          setNotificationKey(newKey);
          setNotification({
            id: newKey,
            teamName: data.highestBid.team_name,
            increment: increment
          });
        }

        // Update bid state immediately
        setHighestBid(data.highestBid);
        setCurrentBid(data.highestBid.amount);
      } else if (!data.highestBid) {
        // Handle undo to zero bids
        setHighestBid(null);
        setCurrentBid(currentPlayerRef.current?.base_price || 0);
      }

      // Load info after a small delay to ensure notification is set first
      setTimeout(() => {
        loadCurrentInfo();
        loadAllBids();
      }, 100);
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
        increment2: data.increment2,
        increment3: data.increment3
      });
    });

    newSocket.on('bidding-reset', () => {
      setHighestBid(null);
      setAllBids([]);
      loadCurrentInfo();
    });

    newSocket.on('player-marked', () => {
      loadCurrentInfo();
    });

    newSocket.on('team-budget-updated', () => {
      loadTeams();
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
      const data = await hostService.getCurrentInfo();
      setCurrentPlayer(data.player);
      currentPlayerRef.current = data.player;
      setHighestBid(data.highestBid);
      const newBid = data.currentBid || 0;
      setCurrentBid(newBid);
      setBiddingLocked(data.biddingLocked);
      setStatus(data.status);
      setBidIncrements(data.bidIncrements);
      if (data.stats) {
        setStats(data.stats);
      }

      // Update previous bid if player changed
      if (data.player && (!currentPlayerRef.current || currentPlayerRef.current.id !== data.player.id)) {
        const basePrice = data.player.base_price || 0;
        previousBidRef.current = basePrice;
        setPreviousBid(basePrice);
      } else if (data.highestBid && data.highestBid.amount) {
        // Update previous bid to match the highest bid if it exists
        // Only update if it's different to avoid overwriting during notification
        if (previousBidRef.current !== data.highestBid.amount) {
          previousBidRef.current = data.highestBid.amount;
          setPreviousBid(data.highestBid.amount);
        }
      } else if (newBid > 0 && previousBidRef.current === 0) {
        // Initialize previous bid if we have a current bid but no previous bid
        previousBidRef.current = newBid;
        setPreviousBid(newBid);
      }
    } catch (error) {
      console.error('Error loading current info:', error);
    }
  };

  const loadAllBids = async () => {
    try {
      const data = await hostService.getAllBids();
      setAllBids(data.bids || []);
    } catch (error) {
      console.error('Error loading bids:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const teamsData = await hostService.getAllTeams();
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading teams:', error);
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

  // Format number in Indian style (1,00,000)
  const formatIndianNumber = (num) => {
    return num.toLocaleString('en-IN');
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Bid Notification */}
      {notification && (
        <BidNotification
          key={notification.id || notificationKey}
          teamName={notification.teamName}
          increment={notification.increment}
          onClose={() => setNotification(null)}
        />
      )}

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
        {/* Blurred overlay for better text readability */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-lg"></div>
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Top Navigation Bar - Mobile Responsive */}
        <div className="bg-gradient-to-r from-blue-900/95 to-green-900/95 border-b-2 border-yellow-400 shadow-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 sm:py-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 w-full sm:w-auto">
                <div className="text-yellow-400 font-bold text-xl sm:text-2xl md:text-3xl">CricAuction™</div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-white text-sm sm:text-base md:text-lg flex gap-2 sm:gap-4">
                  <span className="text-yellow-400 font-bold">AUDIENCE VIEW</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 bg-yellow-400 rounded-full flex items-center justify-center text-blue-900 font-bold text-sm sm:text-base">
                    👁
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-white hover:text-yellow-400 text-sm sm:text-base md:text-lg px-2 py-1 font-bold"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Mobile Responsive */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 pb-2 sm:pb-3 flex flex-col min-h-[calc(100vh-70px)]">
          {currentPlayer ? (
            <div className="flex flex-col lg:flex-row gap-4 h-full">
              {/* Left: Player Image */}
              <div className={`lg:w-1/3 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 transition-all flex flex-col items-center justify-center ${bidFlash ? 'border-yellow-400 shadow-2xl shadow-yellow-400/50' : 'border-yellow-400/50'}`}>
                <div className="relative w-full aspect-[3/4] max-w-[400px]">
                  <div className="w-full h-full rounded-2xl border-4 sm:border-8 border-yellow-400 p-1 sm:p-2 bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-2xl overflow-hidden">
                    <img
                      src={getImageUrl(currentPlayer.image)}
                      alt={currentPlayer.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/600x800?text=Player';
                      }}
                    />
                  </div>
                  {currentPlayer.serial_number && (
                    <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 bg-yellow-400 text-blue-900 font-bold text-2xl sm:text-4xl md:text-5xl lg:text-6xl px-3 sm:px-5 py-0.5 sm:py-1.5 rounded-xl shadow-lg border-2 sm:border-4 border-blue-900">
                      {currentPlayer.serial_number}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Player Info and Current Bid */}
              <div className="lg:w-2/3 flex flex-col gap-4">
                {/* Player Info Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 border-yellow-400/50 flex-1 flex flex-col justify-center">
                  <div className="space-y-4">
                    <div className="bg-yellow-400 text-blue-900 px-4 sm:px-8 py-2 sm:py-4 rounded-xl font-black text-2xl sm:text-4xl md:text-5xl lg:text-7xl shadow-2xl uppercase tracking-tighter text-center lg:text-left">
                      {currentPlayer.name}
                    </div>
                    <div className="flex flex-wrap gap-4 items-center justify-center lg:justify-start">
                      <div className="bg-white/90 text-blue-900 px-4 sm:px-6 py-1 sm:py-3 rounded-lg font-bold text-xl sm:text-2xl md:text-3xl shadow-xl">
                        {currentPlayer.role}
                      </div>
                      <div className="bg-blue-600 text-white px-4 sm:px-6 py-1 sm:py-3 rounded-lg font-bold text-lg sm:text-xl md:text-2xl shadow-xl border-2 border-white/20">
                        BASE: ₹{formatIndianNumber(currentPlayer.base_price || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Bid Card */}
                <div className={`bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(234,179,8,0.4)] border-4 border-white/50 flex flex-col items-center justify-center transition-all ${bidFlash ? 'scale-[1.02] shadow-yellow-400/80' : ''}`}>
                  <div className="text-blue-900 text-lg sm:text-2xl font-extrabold mb-2 tracking-widest uppercase">CURRENT BID</div>
                  <div className={`text-blue-900 text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-none drop-shadow-2xl transition-all ${bidFlash ? 'scale-110' : ''}`}>
                    ₹{formatIndianNumber(currentBid)}
                  </div>
                  {highestBid && (
                    <div className="mt-6 bg-blue-900 text-yellow-400 px-6 sm:px-10 py-2 sm:py-4 rounded-full text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black shadow-2xl border-4 border-yellow-400 animate-pulse">
                      LEADING: {highestBid.team_name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-900/95 to-green-900/95 rounded-xl sm:rounded-2xl p-8 sm:p-16 border-2 border-blue-700 text-center shadow-xl">
              <div className="text-yellow-400 text-4xl sm:text-5xl md:text-6xl mb-4">🏏</div>
              <p className="text-white text-2xl sm:text-3xl md:text-4xl font-bold">Waiting for auction to begin...</p>
              <p className="text-gray-300 mt-2 text-lg sm:text-xl md:text-2xl font-bold">The auction will start shortly</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HostDashboard;

