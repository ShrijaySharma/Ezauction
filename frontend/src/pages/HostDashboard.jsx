import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { logout } from '../services/auth';
import * as hostService from '../services/host';
import { getImageUrl } from '../utils/imageUtils';
import BidNotification from '../components/BidNotification';
import { getSocketUrl } from '../config';

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
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
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

    const newSocket = io(getSocketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Host connected to socket'));

    // Initial data load
    loadCurrentInfo();
    loadTeams();
    loadUnsoldPlayers();

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

        // Play sound ONLY on bid-placed to avoid double trigger with bid-updated
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
        // We don't play sound here as it's triggered by bid-placed for new bids
      } else {
        setHighestBid(null);
        // Refresh to get correct base price
        loadCurrentInfo();
      }
    });

    // Auto-unlock audio on first user interaction
    const handleFirstClick = () => {
      if (!audioEnabled) {
        if (audioElementRef.current) {
          audioElementRef.current.play().then(() => {
            setAudioEnabled(true);
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            console.log('Audio context unlocked');
          }).catch(err => console.error('Audio auto-unlock failed:', err));
        }
      }
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);

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

  const loadUnsoldPlayers = async () => {
    try {
      const data = await hostService.getUnsoldPlayers();
      setUnsoldPlayers(data || []);
      console.log(`Preloading ${data?.length || 0} unsold player images for instant rendering`);
    } catch (error) {
      console.error('Error loading unsold players for preloading:', error);
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
      {/* Bid Notification Overlay (Removed for now, sound kept) */}
      {false && notification && (
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
        <div className="h-16 md:h-32 flex items-center justify-between md:justify-end px-4 md:px-8 bg-black/40 backdrop-blur-md border-b border-white/10 relative shrink-0">
          <div className="md:absolute md:left-4 lg:left-8 md:top-1/2 md:-translate-y-1/2 flex flex-col items-center">
            <img src="/ezauction.png" alt="EzAuction Logo" className="h-6 sm:h-12 lg:h-16 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] md:hover:scale-105 transition-transform duration-500" />
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <img src="/GAPL.png" alt="GAPL Logo" className="h-12 sm:h-40 lg:h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] md:hover:scale-105 transition-transform duration-500" />
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            {/* Audio Unlock Indicator */}
            {!audioEnabled && (
              <button
                onClick={enableAudio}
                className="flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-4 md:py-2 bg-yellow-400 text-black rounded-lg md:rounded-xl font-black text-[10px] md:text-sm uppercase tracking-widest animate-pulse md:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
              >
                <span>🔊</span> <span className="hidden sm:inline">Sound</span>
              </button>
            )}
            {audioEnabled && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-green-500/20 text-green-400 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest border border-green-500/30">
                <span>🔔</span> <span className="hidden sm:inline">Sound Active</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition-all text-[10px] md:text-sm font-black uppercase tracking-widest px-2 py-1 md:px-4 md:py-2 bg-white/5 hover:bg-white/10 rounded-lg md:rounded-xl border border-white/10"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden p-2 md:p-6 gap-2 md:gap-6 flex flex-col md:grid md:grid-cols-12 md:content-stretch scrollbar-none">
          {currentPlayer ? (
            <>
              {/* Left Column: Enhanced Player Profile */}
              <div className="col-span-12 md:col-span-3 flex flex-col flex-none md:h-full overflow-hidden order-2 md:order-1">
                <div className="flex-1 bg-gray-900/90 backdrop-blur-2xl rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 border md:border-2 border-white/20 shadow-xl md:shadow-2xl flex flex-row md:flex-col justify-between items-center md:items-stretch relative overflow-hidden group gap-4 md:gap-0 md:min-h-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-yellow-400/5 opacity-50"></div>

                  {/* Desktop Category Badge (hidden on mobile) */}
                  <div className="hidden md:flex relative z-10 justify-between items-start mb-4">
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
                  </div>

                  {/* Left Side (Mobile) / Top (Desktop) */}
                  <div className="relative z-10 flex flex-col items-start gap-2 md:gap-0 md:justify-between w-1/2 md:w-auto h-full justify-center">
                    <div className="px-3 py-1.5 md:px-5 md:py-3 bg-white/10 rounded-xl md:rounded-2xl border md:border-2 border-yellow-400/50 backdrop-blur-xl mb-2 md:mb-0 md:self-end md:-mt-16 md:shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                      <span className="text-white font-mono font-black text-lg md:text-3xl drop-shadow-lg"><span className="md:hidden">#</span>{currentPlayer.serial_number}</span>
                    </div>
                    <div className="text-left md:text-center mt-0 md:mt-auto">
                      <h2 className="text-white text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter mb-1 md:mb-4 drop-shadow-2xl leading-[1.1] md:leading-[0.9] line-clamp-2 md:line-clamp-none">
                        {currentPlayer.name}
                      </h2>
                      <div className="inline-block px-3 py-1 md:px-6 md:py-2.5 bg-yellow-400 text-black rounded-full text-[10px] md:text-sm font-black uppercase tracking-widest shadow-lg md:shadow-xl shadow-yellow-400/20 md:hover:scale-105 md:transition-transform">
                        {currentPlayer.role}
                      </div>
                    </div>
                  </div>

                  {/* Right Side (Mobile) / Bottom Grid (Desktop) */}
                  <div className="relative z-10 flex flex-col gap-2 md:grid md:grid-cols-1 md:gap-4 mt-0 md:mt-auto w-1/2 md:w-auto">
                    <div className="bg-white/5 p-2 md:p-6 rounded-xl md:rounded-3xl border border-white/10 backdrop-blur-md flex flex-row md:flex-col justify-between items-center md:block md:hover:bg-white/10 md:transition-colors">
                      <span className="text-white/40 text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] md:mb-2 md:text-center block">Age</span>
                      <div className="text-white font-black text-sm md:text-2xl uppercase tracking-tight md:text-center">{currentPlayer.age || 'N/A'} <span className="hidden md:inline">YRS</span></div>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-400/10 to-transparent p-3 md:p-6 rounded-xl md:rounded-3xl border border-yellow-400/20 backdrop-blur-md flex flex-col justify-center h-full md:block">
                      <span className="block text-yellow-400/60 text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1 md:mb-2 text-center">Base Price</span>
                      <div className="text-yellow-400 font-black text-lg md:text-4xl font-mono tracking-tighter text-center drop-shadow-lg leading-none md:leading-normal">
                        ₹{formatIndianNumber(currentPlayer.base_price || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Column: Image */}
              <div className="col-span-12 md:col-span-5 flex flex-col items-center justify-center relative overflow-hidden group px-1 md:px-6 py-1 md:py-0 order-1 md:order-2">
                <div className={`relative w-full max-w-[220px] sm:max-w-[280px] md:max-w-none md:h-full md:max-h-[70vh] aspect-[3/4] transition-all duration-500 ${bidFlash ? 'scale-[1.03]' : 'scale-100'}`}>
                  <div className="absolute inset-0 bg-yellow-400/10 rounded-[2rem] md:rounded-[4rem] blur-[50px] md:blur-[100px] animate-pulse"></div>
                  <div className={`w-full h-full rounded-3xl md:rounded-[3rem] border-[4px] md:border-[12px] bg-black/50 backdrop-blur-3xl shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${bidFlash ? 'border-yellow-400 shadow-yellow-400/40' : 'border-white/10'}`}>
                    <img
                      src={getImageUrl(currentPlayer.image)}
                      alt={currentPlayer.name}
                      className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] md:drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)]"
                      onError={(e) => { e.target.src = '/deafult_player.png'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Bid Action - Optimized for Overflow */}
              <div className="col-span-12 md:col-span-4 flex flex-col gap-2 md:gap-6 shrink-0 md:min-h-0 mb-4 md:mb-0 order-3 z-10">
                <div className={`flex flex-row md:flex-col bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-2xl md:rounded-[3rem] p-3 md:p-4 lg:p-6 shadow-2xl border-[4px] md:border-[12px] border-white items-center justify-between md:justify-center text-blue-900 transition-all duration-500 gap-3 md:gap-0 h-full md:flex-1 ${bidFlash ? 'scale-[1.02] rotate-1' : ''}`}>

                  {/* Mobile Left / Desktop Top: Bid Amount */}
                  <div className="flex flex-col items-start md:items-center w-5/12 md:w-full">
                    <div className="text-blue-900/60 md:text-blue-900/40 text-[10px] md:text-lg lg:text-xl font-black tracking-[0.2em] md:tracking-[0.5em] uppercase md:mb-2 lg:mb-4 text-left md:text-center">Current Bid</div>
                    <div className={`font-black leading-none tracking-tighter transition-all drop-shadow-xl text-left md:text-center w-full break-words md:mb-6 lg:mb-10
                      ${currentBid.toString().length > 7 ? 'text-2xl md:text-4xl lg:text-6xl' : (currentBid.toString().length > 5 ? 'text-3xl md:text-5xl lg:text-7xl' : 'text-3xl md:text-6xl lg:text-8xl')}
                      ${bidFlash ? 'scale-110' : ''}
                    `}>
                      ₹{formatIndianNumber(currentBid)}
                    </div>
                  </div>

                  <div className="hidden md:block h-1.5 w-32 bg-blue-900/10 mb-8 rounded-full"></div>
                  <div className="block md:hidden w-px h-12 bg-blue-900/20 mx-1"></div>

                  {/* Mobile Right / Desktop Bottom: Leading Team */}
                  <div className="flex flex-col items-end md:items-center w-7/12 md:w-full animate-bounce-slow md:px-4">
                    {highestBid ? (
                      <>
                        <div className="text-blue-900/60 text-[9px] md:text-xs lg:text-sm font-black uppercase tracking-[0.2em] md:tracking-[0.4em] mb-1 md:mb-4 text-right md:text-center">Leading Team</div>
                        <div className="bg-blue-900 text-yellow-400 w-full px-3 py-2 md:px-6 md:py-4 lg:py-6 rounded-xl md:rounded-[2rem] shadow-xl md:shadow-2xl border-2 md:border-4 border-white/20 flex flex-col items-center justify-center text-center gap-1 md:gap-2">
                          <span className={`font-black leading-tight break-words w-full truncate md:overflow-visible md:whitespace-normal
                            ${highestBid.team_name.length > 15 ? 'text-sm md:text-xl lg:text-2xl' : 'text-base md:text-2xl lg:text-4xl'}
                          `}>
                            {highestBid.team_name}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-blue-900/50 font-black italic text-sm md:text-2xl lg:text-3xl animate-pulse uppercase tracking-[0.1em] md:tracking-[0.2em] text-right md:text-center w-full">
                        Awaiting Bid...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-12 flex items-center justify-center md:h-full min-h-[60vh]">
              <div className="bg-white/5 backdrop-blur-3xl rounded-[3rem] md:rounded-[4rem] p-8 md:p-24 border border-white/10 text-center shadow-2xl relative overflow-hidden group">
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

        {/* Sponsors Footer - Replaced Promotional Footer */}
        <div className="h-auto md:h-24 lg:h-32 flex flex-col items-center justify-center bg-black/95 border-t-2 border-white/10 relative z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] py-2 md:py-2 shrink-0">
          <div className="text-white/40 text-[8px] sm:text-xs font-black tracking-[0.3em] uppercase mb-2 md:mb-3">SPONSORS</div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 lg:gap-20 px-2 md:px-4">
            <img src="/Sumeet ( sponsor ).png" alt="Sumeet" className="h-6 sm:h-12 lg:h-20 object-contain" />
            <img src="/Navneet ( sponsor).webp" alt="Navneet" className="h-6 sm:h-12 lg:h-20 object-contain" />
            <img src="/Ratna Sagar ( sponsor ).png" alt="Ratna Sagar" className="h-6 sm:h-12 lg:h-20 object-contain" />
            <img src="/Holy Faith ( sponsor).png" alt="Holy Faith" className="h-6 sm:h-12 lg:h-20 object-contain" />
          </div>
        </div>
      </div>

      {/* Silent Image Preloader for Main Images */}
      {/* We are preloading ALL unsold main images here so the browser caches them during random selection */}
      <div style={{ display: 'none' }}>
        {currentPlayer && currentPlayer.image && (
          <link rel="preload" as="image" href={getImageUrl(currentPlayer.image)} />
        )}
        {unsoldPlayers.map((p) => (
          p.image && <link key={p.id} rel="preload" as="image" href={getImageUrl(p.image)} />
        ))}
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
