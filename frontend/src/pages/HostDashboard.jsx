import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { logout } from '../services/auth';
import * as hostService from '../services/host';
import { getImageUrl } from '../utils/imageUtils';
import BidNotification from '../components/BidNotification';

// Auto-detect API URL based on current host
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api';
};

const API_URL = getApiUrl();

function HostDashboard({ user }) {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('STOPPED');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [highestBid, setHighestBid] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [allBids, setAllBids] = useState([]);
  const [teams, setTeams] = useState([]);
  const [bidFlash, setBidFlash] = useState(false);
  const [notification, setNotification] = useState(null);
  const [notificationKey, setNotificationKey] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const audioElementRef = useRef(null);

  const enableAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.play().then(() => {
        setAudioEnabled(true);
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }).catch(err => console.error('Audio enable failed:', err));
    }
  };

  useEffect(() => {
    console.log('HostDashboard mounted');
    // Create audio element for notifications
    const audio = new Audio('/notification_sound.wav');
    audio.preload = 'auto';
    audioElementRef.current = audio;

    const newSocket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Host connected to socket'));

    // Initial data load
    loadCurrentInfo();
    loadTeams();

    newSocket.on('bid-placed', (data) => {
      console.log('Bid placed event:', data);
      if (data.bid) {
        setBidFlash(true);
        setTimeout(() => setBidFlash(false), 1000);

        setNotification({
          id: Date.now(),
          teamName: data.bid.team_name,
          increment: data.increment || 0
        });
        setNotificationKey(prev => prev + 1);

        setHighestBid(data.bid);
        setCurrentBid(data.bid.amount);

        if (audioElementRef.current) {
          audioElementRef.current.currentTime = 0;
          audioElementRef.current.play().catch(err => console.error('Audio play failed:', err));
        }
      }
      loadCurrentInfo();
    });

    newSocket.on('bid-updated', (data) => {
      console.log('Bid updated event:', data);
      if (data.highestBid) {
        setHighestBid(data.highestBid);
        setCurrentBid(data.highestBid.amount);

        if (audioElementRef.current) {
          audioElementRef.current.currentTime = 0;
          audioElementRef.current.play().catch(err => console.error('Audio play failed:', err));
        }
      } else if (!data.highestBid) {
        setHighestBid(null);
        loadCurrentInfo(); // Refresh to get initial base price if bid undo results in 0 bids
      }
      loadCurrentInfo();
    });

    newSocket.on('player-loaded', (data) => {
      console.log('Player loaded event:', data);
      setCurrentPlayer(data.player);
      setHighestBid(null);
      setCurrentBid(data.player ? data.player.base_price : 0);
      setAllBids([]);
    });

    newSocket.on('auction-status-changed', (data) => {
      setStatus(data.status);
    });

    newSocket.on('bidding-reset', () => {
      setHighestBid(null);
      loadCurrentInfo();
    });

    newSocket.on('all-players-deleted', () => {
      setCurrentPlayer(null);
      setHighestBid(null);
      setCurrentBid(0);
      setAllBids([]);
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
      // console.log('Loaded current info:', data);

      setCurrentPlayer(data.player);
      setHighestBid(data.highestBid);

      const newBid = data.highestBid ? data.highestBid.amount : (data.player ? data.player.base_price : 0);
      setCurrentBid(newBid);

      if (data.status !== status) {
        setStatus(data.status);
      }

      const bidsData = await hostService.getAllBids();
      setAllBids(bidsData.bids || []);
    } catch (error) {
      console.error('Error loading current info:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const data = await hostService.getAllTeams();
      setTeams(data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/login';
    }
  };

  const formatIndianNumber = (num) => {
    if (num === null || num === undefined) return '0';
    const s = num.toString();
    const lastThree = s.substring(s.length - 3);
    const otherNumbers = s.substring(0, s.length - 3);
    if (otherNumbers !== '') {
      return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }
    return lastThree;
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-black font-sans selection:bg-yellow-400 selection:text-blue-900">
      {/* Bid Notification Overlay */}
      {notification && (
        <BidNotification
          key={notificationKey}
          teamName={notification.teamName}
          increment={notification.increment}
          onClose={() => setNotification(null)}
        />
      )}



      {/* Cinematic Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url('/stadium_img.webp')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/60 via-black/40 to-black/80 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 h-full w-full flex flex-col">
        {/* Top bar - Simplified & Centered */}
        <div className="h-20 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md border-b border-white/10 relative">
          <div className="w-32"></div> {/* Spacer for symmetry */}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <img src="/ezauction.png" alt="EzAuction" className="h-16 sm:h-24 object-contain drop-shadow-2xl" />
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition-all text-sm font-black uppercase tracking-widest px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 overflow-hidden p-6 gap-6 grid grid-cols-12 content-stretch">
          {currentPlayer ? (
            <>
              {/* Left Column: Enhanced Player Profile (Full Height) */}
              <div className="col-span-3 flex flex-col h-full overflow-hidden">
                <div className="flex-1 bg-gray-900/90 backdrop-blur-2xl rounded-[2.5rem] p-8 border-2 border-white/20 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-yellow-400/5 opacity-50"></div>

                  {/* Category Badge */}
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-yellow-400 rounded-xl shadow-lg shadow-yellow-400/20">
                          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-yellow-400 font-bold uppercase tracking-widest text-xs">Profile</span>
                      </div>
                    </div>
                    <div className="px-5 py-3 bg-white/10 rounded-2xl border-2 border-yellow-400/50 backdrop-blur-xl shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                      <span className="text-yellow-400/60 text-[12px] uppercase font-black tracking-[0.2em] mr-3">Serial</span>
                      <span className="text-white font-mono font-black text-3xl drop-shadow-lg">{currentPlayer.serial_number}</span>
                    </div>
                  </div>

                  {/* Name & Role */}
                  <div className="relative z-10 my-auto text-center">
                    <h2 className="text-white text-5xl lg:text-6xl font-black tracking-tighter mb-4 drop-shadow-2xl leading-[0.9]">
                      {currentPlayer.name}
                    </h2>
                    <div className="inline-block px-6 py-2.5 bg-yellow-400 text-black rounded-full text-sm font-black uppercase tracking-widest shadow-xl shadow-yellow-400/20 transform hover:scale-105 transition-transform">
                      {currentPlayer.role}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="relative z-10 grid grid-cols-1 gap-4 mt-auto">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                      <span className="block text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-center">Age</span>
                      <div className="text-white font-black text-2xl uppercase tracking-tight text-center">{currentPlayer.age || 'N/A'} YRS</div>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-400/10 to-transparent p-6 rounded-3xl border border-yellow-400/20 backdrop-blur-md">
                      <span className="block text-yellow-400/60 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-center">Country</span>
                      <div className="text-white font-black text-2xl uppercase tracking-tight text-center">{currentPlayer.country || 'N/A'}</div>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-400/10 to-transparent p-6 rounded-3xl border border-yellow-400/20 backdrop-blur-md">
                      <span className="block text-yellow-400/60 text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-center">Base Price</span>
                      <div className="text-yellow-400 font-black text-4xl font-mono tracking-tighter text-center drop-shadow-lg">
                        ₹{formatIndianNumber(currentPlayer.base_price || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Column: Image */}
              <div className="col-span-5 flex flex-col items-center justify-center relative overflow-hidden group px-6">
                <div className={`relative h-full w-full max-h-[78vh] aspect-[3/4] transition-all duration-500 ${bidFlash ? 'scale-[1.03]' : 'scale-100'}`}>
                  <div className="absolute inset-0 bg-yellow-400/10 rounded-[4rem] blur-[100px] animate-pulse"></div>
                  <div className={`w-full h-full rounded-[3rem] border-[12px] p-5 bg-black/50 backdrop-blur-3xl shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${bidFlash ? 'border-yellow-400 shadow-yellow-400/40' : 'border-white/10'}`}>
                    <img
                      src={getImageUrl(currentPlayer.image)}
                      alt={currentPlayer.name}
                      className="w-full h-full object-contain filter drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)]"
                      onError={(e) => { e.target.src = '/deafult_player.png'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Bid Action - Optimized for Overflow */}
              <div className="col-span-4 flex flex-col gap-6">
                <div className={`flex-1 bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-[3rem] p-6 lg:p-10 shadow-2xl border-[12px] border-white flex flex-col items-center justify-center text-blue-900 transition-all duration-500 ${bidFlash ? 'scale-[1.02] rotate-1' : ''}`}>
                  <div className="text-blue-900/40 text-xl lg:text-2xl font-black tracking-[0.5em] uppercase mb-4 lg:mb-8 text-center">Current Bid</div>

                  {/* Dynamic Font Size for Amount */}
                  <div className="w-full grid place-items-center mb-6 lg:mb-10">
                    <div className={`font-black leading-none tracking-tighter transition-all drop-shadow-xl text-center break-words w-full
                      ${currentBid.toString().length > 7 ? 'text-4xl lg:text-6xl' : (currentBid.toString().length > 5 ? 'text-5xl lg:text-7xl' : 'text-6xl lg:text-8xl')}
                      ${bidFlash ? 'scale-110' : ''}
                    `}>
                      ₹{formatIndianNumber(currentBid)}
                    </div>
                  </div>

                  <div className="h-1.5 w-32 bg-blue-900/10 mb-8 rounded-full"></div>

                  {highestBid ? (
                    <div className="w-full flex flex-col items-center animate-bounce-slow px-4">
                      <div className="text-blue-900/60 text-xs lg:text-sm font-black uppercase tracking-[0.4em] mb-4 text-center">Leading Team</div>
                      <div className="bg-blue-900 text-yellow-400 w-full px-6 py-4 lg:py-6 rounded-[2rem] shadow-2xl border-4 border-white/20 flex flex-col items-center justify-center text-center gap-2">
                        <span className="text-2xl mb-1"></span>
                        <span className={`font-black leading-tight break-words w-full
                          ${highestBid.team_name.length > 15 ? 'text-xl lg:text-2xl' : 'text-2xl lg:text-4xl'}
                        `}>
                          {highestBid.team_name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-blue-900/50 font-black italic text-2xl lg:text-3xl animate-pulse uppercase tracking-[0.2em] text-center">
                      Awaiting Bid...
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-12 flex items-center justify-center h-full">
              <div className="bg-white/5 backdrop-blur-3xl rounded-[4rem] p-24 border border-white/10 text-center shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-yellow-400/5 blur-[120px]"></div>
                <div className="relative">
                  <div className="text-[12rem] mb-12 animate-bounce opacity-40">🏏</div>
                  <h1 className="text-white text-8xl font-black tracking-tighter mb-6 opacity-90 drop-shadow-2xl">READY FOR ACTION</h1>
                  <p className="text-yellow-400 text-3xl font-black tracking-[0.6em] uppercase opacity-60 animate-pulse">Waiting for host...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Promotional Footer - Enhanced Visibility */}
        <div className="h-16 flex items-center justify-center bg-black/95 border-t-2 border-yellow-400/30 relative z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          <p className="text-white/80 text-sm sm:text-lg font-black tracking-[0.4em] uppercase drop-shadow-lg">
            For renting this auction app contact <span className="text-yellow-400 font-black px-4 bg-yellow-400/10 py-1 rounded-lg border border-yellow-400/20 scale-110 inline-block mx-2">7697544446</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-bounce-slow { animation: bounce-slow 4s infinite ease-in-out; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default HostDashboard;
