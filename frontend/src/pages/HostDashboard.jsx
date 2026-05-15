import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import * as hostService from '../services/host';
import { getImageUrl } from '../utils/imageUtils';
import BidNotification from '../components/BidNotification';
import TradingWindowBanner from '../components/TradingWindowBanner';
import ImageModal from '../components/ImageModal';
import { getSocketUrl } from '../config';

// Auto-detect API URL based on current host
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api';
};

const API_URL = getApiUrl();

function HostDashboard() {
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
  const [showMenu, setShowMenu] = useState(false);
  const [showTeamPurses, setShowTeamPurses] = useState(false);
  const [teamPurses, setTeamPurses] = useState([]);
  const [connectionError, setConnectionError] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [soldAnimation, setSoldAnimation] = useState(null); // { playerName, teamName, price }

  // Sponsor Branding State
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState('');

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
    // Load local sponsor branding
    const savedName = localStorage.getItem('ezauction_sponsor_name');
    const savedLogo = localStorage.getItem('ezauction_sponsor_logo');
    if (savedName) setSponsorName(savedName);
    if (savedLogo) setSponsorLogo(savedLogo);

    // Create audio element for notifications
    const audio = new Audio('/notification_sound.wav');
    audio.preload = 'auto';
    audioElementRef.current = audio;

    const newSocket = io(getSocketUrl(), {
      transports: ['websocket'],        // Force WebSocket only — no polling fallback
      upgrade: false,                    // Don't attempt transport upgrade
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });
    setSocket(newSocket);

    // === TEMPORARY DEBUG LOGGING ===
    newSocket.onAny((eventName, ...args) => {
      console.log(`[Socket:Host] ${eventName}`, JSON.stringify(args).slice(0, 300));
    });
    // === END DEBUG LOGGING ===

    newSocket.on('connect', () => {
      console.log('[Socket:Host] Connected');
      setConnectionError(false);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('[Socket:Host] All reconnection attempts failed');
      setConnectionError(true);
    });

    // Initial data load
    loadCurrentInfo();
    loadTeams();
    loadUnsoldPlayers();
    loadTeamPurses();

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

        // Play sound
        if (audioElementRef.current) {
          audioElementRef.current.currentTime = 0;
          audioElementRef.current.play().catch(err => console.error('Audio play failed:', err));
        }
      }
    });

    newSocket.on('bid-updated', (data) => {
      console.log('Bid updated event:', data);
      if (data.highestBid) {
        setHighestBid(data.highestBid);
        setCurrentBid(data.highestBid.amount);
      } else {
        setHighestBid(null);
        // Reset to base price directly — no API call
        setCurrentBid(prev => 0); // Will be corrected by player-loaded or reconnect
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

    newSocket.on('bidding-reset', (data) => {
      setHighestBid(null);
      // Use base price from payload — no API call
      setCurrentBid(data?.basePrice || 0);
    });

    newSocket.on('all-players-deleted', () => {
      setCurrentPlayer(null);
      setHighestBid(null);
      setCurrentBid(0);
      setAllBids([]);
    });

    newSocket.on('player-marked', (data) => {
      console.log('[Socket:Host] player-marked', data);
      if (data.status === 'SOLD') {
        setSoldAnimation({
          playerName: currentPlayer?.name || 'Player',
          teamName: data.soldToTeam ? '' : '',
          price: data.soldPrice || 0
        });
        setTimeout(() => setSoldAnimation(null), 2500);
      }
    });

    newSocket.on('team-budget-updated', (data) => {
      console.log('[Socket:Host] team-budget-updated', data);
      // Team purses panel has manual "Refresh" button
    });

    newSocket.on('reconnect', () => {
      console.log('[Socket:Host] Reconnected — performing full state resync');
      setConnectionError(false);
      loadCurrentInfo();
      loadTeamPurses();
    });

    return () => {
      newSocket.close();
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

  const loadTeamPurses = async () => {
    try {
      const data = await hostService.getTeamPurses();
      setTeamPurses(data || []);
    } catch (error) {
      console.error('Error loading team purses:', error);
    }
  };

  // Logout removed — host dashboard is now public

  const formatIndianNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('en-IN');
  };

  const handleSponsorLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_HEIGHT = 200;
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        
        if (dataUrl.length > 3 * 1024 * 1024) {
            alert('Image is too complex/large even after resize. Please use a smaller file.');
            return;
        }
        
        setSponsorLogo(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-black font-sans selection:bg-yellow-400 selection:text-blue-900">
      <TradingWindowBanner socket={socket} />
      {/* Connection Error Banner */}
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center py-2 text-sm font-bold">
          Connection lost. Please refresh the page.
        </div>
      )}
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
        {/* Floating Top Elements — No bar, directly on the cinematic background */}
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
          {/* Left: Menu + Logo */}
          <div className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-3 pointer-events-auto">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex flex-col items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-black/40 hover:bg-black/60 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/15 transition-all group shadow-lg"
              title="Menu"
            >
              <span className={`block w-5 md:w-7 h-0.5 md:h-[3px] bg-white/80 group-hover:bg-white transition-all ${showMenu ? 'rotate-45 translate-y-[5px]' : ''}`}></span>
              <span className={`block w-5 md:w-7 h-0.5 md:h-[3px] bg-white/80 group-hover:bg-white my-[4px] md:my-[5px] transition-all ${showMenu ? 'opacity-0' : ''}`}></span>
              <span className={`block w-5 md:w-7 h-0.5 md:h-[3px] bg-white/80 group-hover:bg-white transition-all ${showMenu ? '-rotate-45 -translate-y-[5px]' : ''}`}></span>
            </button>
            <img src="/ezauction.png" alt="EzAuction Logo" className="h-8 sm:h-14 lg:h-20 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:scale-105 transition-transform duration-500" />
          </div>

          {/* Center: Sponsor Branding */}
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center animate-fade-in pointer-events-auto">
            {sponsorLogo && <img src={sponsorLogo} alt="Sponsor" className="h-10 sm:h-16 md:h-20 lg:h-24 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] filter brightness-110" />}
            {sponsorName && <div className="text-white text-[10px] sm:text-xs md:text-sm lg:text-base font-black mt-1.5 tracking-[0.3em] uppercase drop-shadow-md opacity-80">{sponsorName}</div>}
          </div>

          {/* Right: Live indicator */}
          <div className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto">
            {status === 'LIVE' && (
              <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-red-600/30 backdrop-blur-xl rounded-xl border border-red-500/30 shadow-lg">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                <span className="text-red-400 text-[10px] md:text-xs font-black uppercase tracking-widest">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden p-2 pt-16 md:p-6 md:pt-6 gap-2 md:gap-6 flex flex-col md:grid md:grid-cols-12 md:content-stretch scrollbar-none">
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
                    <div className="text-left md:text-center mt-0 md:mt-auto md:w-full flex flex-col items-start md:items-center">
                      <h2 className="text-white text-xl sm:text-3xl md:text-4xl lg:text-5xl lg:max-w-[90%] mx-auto font-black tracking-normal mb-1 md:mb-4 drop-shadow-2xl leading-tight md:line-clamp-none py-1 overflow-hidden text-ellipsis">
                        {currentPlayer.name}
                      </h2>
                      <div className="inline-block px-3 py-1.5 md:px-6 md:py-2.5 bg-yellow-400 text-black rounded-full text-[10px] md:text-sm font-black uppercase tracking-widest shadow-lg md:shadow-xl shadow-yellow-400/20 md:hover:scale-105 md:transition-transform">
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
              <div className="col-span-12 md:col-span-5 flex flex-col items-center justify-center relative overflow-hidden group px-0 md:px-2 py-1 md:py-0 order-1 md:order-2">
                <div className={`relative w-full max-w-[220px] sm:max-w-[280px] md:max-w-none md:h-full md:max-h-[85vh] aspect-[3/4] transition-all duration-500 ${bidFlash ? 'scale-[1.03]' : 'scale-100'}`}>
                  <div className="absolute inset-0 bg-yellow-400/10 rounded-2xl md:rounded-[2.5rem] blur-[50px] md:blur-[80px] animate-pulse"></div>
                  <div className={`w-full h-full rounded-2xl md:rounded-[2.5rem] border-2 md:border-4 bg-black/30 backdrop-blur-sm shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${bidFlash ? 'border-yellow-400 shadow-yellow-400/40' : 'border-white/10'}`}>
                    <img
                      src={getImageUrl(currentPlayer.image)}
                      alt={currentPlayer.name}
                      className="w-full h-full object-cover filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] md:drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)] cursor-pointer"
                      onClick={() => setPreviewImage(getImageUrl(currentPlayer.image))}
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
                      ${currentBid.toString().length > 7 ? 'text-xl md:text-3xl lg:text-5xl' : (currentBid.toString().length > 5 ? 'text-2xl md:text-4xl lg:text-5xl' : 'text-3xl md:text-5xl lg:text-6xl')}
                      ${bidFlash ? 'scale-110' : ''}
                    `}>
                      ₹{formatIndianNumber(currentBid)}
                    </div>
                  </div>

                  <div className="hidden md:block h-1.5 w-32 bg-blue-900/10 mb-8 rounded-full"></div>
                  <div className="block md:hidden w-px h-12 bg-blue-900/20 mx-1"></div>

                  {/* Mobile Right / Desktop Bottom: Leading Team */}
                  <div className="flex flex-col items-end md:items-center w-7/12 md:w-auto animate-bounce-slow md:px-4">
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

        {/* Burger Menu Dropdown */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
            <div className="fixed top-16 md:top-20 left-2 md:left-6 z-50 bg-gray-900/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden min-w-[200px] animate-slide-in-right">
              <button
                onClick={() => { setShowSponsorModal(true); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-5 py-4 text-white hover:bg-white/10 transition-colors text-left border-b border-white/10"
              >
                <span className="text-xl">✨</span>
                <span className="font-semibold text-sm tracking-wide">Brand & Sponsor</span>
              </button>
              <button
                onClick={() => { setShowTeamPurses(true); setShowMenu(false); loadTeamPurses(); }}
                className="w-full flex items-center gap-3 px-5 py-4 text-white hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-xl">💰</span>
                <span className="font-semibold text-sm tracking-wide">Team Purses</span>
              </button>
            </div>
          </>
        )}

        {/* Team Purses Slide-out Panel */}
        {showTeamPurses && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowTeamPurses(false)}></div>

            {/* Panel */}
            <div className="relative w-full h-full max-w-7xl bg-gradient-to-b from-gray-900/98 via-gray-900/95 to-black/98 backdrop-blur-3xl border border-white/20 shadow-2xl flex flex-col animate-slide-in-right rounded-3xl overflow-hidden">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-yellow-400/5 to-transparent shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-yellow-400/10 rounded-xl border border-yellow-400/20">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-white font-black text-xl tracking-tight">Team Purses</h2>
                </div>
                <button
                  onClick={() => setShowTeamPurses(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Team Cards */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4 md:content-start scrollbar-none">
                {teamPurses.length > 0 ? (
                  teamPurses.map((team, index) => {
                    const budgetPercent = team.budget && team.totalSpent !== undefined
                      ? Math.max(0, (team.budget / (team.budget + team.totalSpent)) * 100)
                      : 100;
                    return (
                      <div
                        key={team.id}
                        className="bg-white/5 rounded-2xl border border-white/10 p-4 hover:bg-white/8 transition-all group"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {team.logo ? (
                            <img
                              src={getImageUrl(team.logo)}
                              alt={team.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white/20 group-hover:border-yellow-400/40 transition-colors"
                              onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=' + team.name.charAt(0); }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-400/20 border-2 border-white/20 flex items-center justify-center text-white font-black text-sm">
                              {team.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-sm truncate">{team.name}</h3>
                            <p className="text-white/40 text-xs">{team.playersBought || 0} players bought</p>
                          </div>
                        </div>

                        {/* Budget Bar */}
                        <div className="mb-2">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Remaining</span>
                            <span className="text-yellow-400 font-black text-lg font-mono tracking-tight">₹{formatIndianNumber(team.budget || 0)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                budgetPercent > 60 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                                budgetPercent > 30 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                                'bg-gradient-to-r from-red-400 to-rose-600'
                              }`}
                              style={{ width: `${budgetPercent}%` }}
                            ></div>
                          </div>
                        </div>

                        {team.totalSpent > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/30">Total Spent</span>
                            <span className="text-rose-400/70 font-mono font-semibold">₹{formatIndianNumber(team.totalSpent)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3 opacity-40">💰</div>
                    <p className="text-white/40 text-sm">No teams available</p>
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-black/30">
                <button
                  onClick={loadTeamPurses}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sponsor Settings Modal */}
        {showSponsorModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSponsorModal(false)}></div>
            <div className="relative w-full max-w-sm bg-gray-900 border border-white/20 rounded-3xl shadow-2xl p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent pointer-events-none"></div>
              <h3 className="text-white font-black text-xl mb-6 relative">✨ Sponsor Branding</h3>
              
              <div className="space-y-5 relative">
                <div>
                  <label className="block text-white/60 text-xs font-bold uppercase tracking-widest mb-1.5">Sponsor Name</label>
                  <input
                    type="text"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-400/50 transition-colors"
                    placeholder="e.g. Powered by XYZ"
                  />
                  <p className="text-white/30 text-[10px] mt-1.5">Leave blank to show no name.</p>
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-bold uppercase tracking-widest mb-1.5">Sponsor Logo</label>
                  
                  {sponsorLogo && (
                    <div className="relative w-full h-32 bg-black/50 border border-white/10 rounded-xl mb-3 flex items-center justify-center overflow-hidden group">
                      <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSponsorLogo('')}
                          className="px-4 py-2 bg-red-500/90 text-white font-bold text-xs uppercase rounded-lg shadow-lg"
                        >
                          Remove Logo
                        </button>
                      </div>
                      <img src={sponsorLogo} alt="Preview" className="max-h-full max-w-full object-contain p-2" />
                    </div>
                  )}

                  {!sponsorLogo && (
                    <label className="block w-full border border-dashed border-white/20 hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all rounded-xl p-6 text-center cursor-pointer mb-2">
                      <span className="text-2xl mb-2 block opacity-60">🖼️</span>
                      <span className="text-white/60 text-xs font-bold uppercase">Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSponsorLogoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                  <p className="text-white/30 text-[10px]">Logo is stored locally on this device. Max width/height ~200px (auto-scaled).</p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      localStorage.setItem('ezauction_sponsor_name', sponsorName);
                      if (sponsorLogo) {
                        localStorage.setItem('ezauction_sponsor_logo', sponsorLogo);
                      } else {
                        localStorage.removeItem('ezauction_sponsor_logo');
                      }
                      setShowSponsorModal(false);
                    }}
                    className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-black uppercase tracking-widest py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                  >
                    Save & Apply
                  </button>
                  <button
                    onClick={() => setShowSponsorModal(false)}
                    className="px-6 bg-white/5 text-white/80 font-bold rounded-xl hover:bg-white/10 transition-colors border border-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* Image Preview Modal */}
      {previewImage && (
        <ImageModal src={previewImage} alt="Player" onClose={() => setPreviewImage(null)} />
      )}

      {/* ===== SOLD CELEBRATION ANIMATION ===== */}
      {soldAnimation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none sold-overlay">
          {/* Dark flash backdrop */}
          <div className="absolute inset-0 bg-black/60 sold-backdrop"></div>

          {/* Confetti particles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="confetti-particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1.5 + Math.random() * 1.5}s`,
                  backgroundColor: ['#FFD700', '#FF6B35', '#FF1744', '#00E676', '#2979FF', '#AA00FF', '#FFEA00', '#F50057'][i % 8],
                  width: `${6 + Math.random() * 10}px`,
                  height: `${6 + Math.random() * 10}px`,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            ))}
          </div>

          {/* SOLD Stamp */}
          <div className="sold-stamp relative flex flex-col items-center gap-4">
            <div className="text-6xl md:text-8xl lg:text-[10rem] sold-gavel">🔨</div>
            <div className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 text-blue-900 font-black text-5xl md:text-8xl lg:text-9xl px-8 md:px-16 py-3 md:py-6 rounded-2xl md:rounded-3xl border-4 md:border-8 border-white shadow-[0_0_80px_rgba(250,204,21,0.6)] tracking-wider uppercase">
              SOLD!
            </div>
            {soldAnimation.price > 0 && (
              <div className="text-white text-2xl md:text-5xl font-black font-mono tracking-tight drop-shadow-2xl mt-2 sold-price">
                ₹{formatIndianNumber(soldAnimation.price)}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in-right { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-bounce-slow { animation: bounce-slow 4s infinite ease-in-out; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

        /* ===== SOLD CELEBRATION ANIMATIONS ===== */
        .sold-overlay { animation: sold-overlay-lifecycle 2.5s ease-out forwards; }
        @keyframes sold-overlay-lifecycle {
          0% { opacity: 0; }
          8% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
        .sold-backdrop { animation: sold-flash 0.3s ease-out; }
        @keyframes sold-flash {
          0% { background-color: rgba(250,204,21,0.4); }
          100% { background-color: rgba(0,0,0,0.6); }
        }
        .sold-stamp {
          animation: sold-stamp-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          transform: scale(0) rotate(-15deg);
        }
        @keyframes sold-stamp-in {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(-2deg); opacity: 1; }
        }
        .sold-gavel {
          animation: gavel-slam 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          transform-origin: bottom right;
        }
        @keyframes gavel-slam {
          0% { transform: rotate(-45deg) scale(0.5); opacity: 0; }
          50% { transform: rotate(10deg) scale(1.2); }
          70% { transform: rotate(-5deg) scale(1); }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        .sold-price {
          animation: price-pop 0.4s 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        @keyframes price-pop {
          0% { transform: scale(0) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .confetti-particle {
          position: absolute;
          top: 100%;
          animation: confetti-rise 2s ease-out forwards;
        }
        @keyframes confetti-rise {
          0% { top: 100%; opacity: 1; transform: translateX(0) rotate(0deg); }
          25% { opacity: 1; }
          100% { top: -10%; opacity: 0; transform: translateX(calc((var(--random, 0.5) - 0.5) * 200px)) rotate(720deg); }
        }
      `}</style>
    </div>
  );
}

export default HostDashboard;
