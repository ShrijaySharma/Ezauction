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

  // Refs for socket callbacks to access latest state
  const currentPlayerRef = useRef(null);
  const teamsRef = useRef([]);

  // Sync state to refs
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { teamsRef.current = teams; }, [teams]);

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
        // Backend now sends soldToTeamName and soldToTeamLogo directly
        // Fallback to local lookup if not present (backward compat)
        let teamName = data.soldToTeamName || '';
        let teamLogo = data.soldToTeamLogo || null;
        
        if (!teamName && data.soldToTeam) {
          const winningTeam = teamsRef.current.find(t => t.id === data.soldToTeam || t.name === data.soldToTeam);
          if (winningTeam) {
            teamName = winningTeam.name;
            teamLogo = winningTeam.logo;
          }
        }
        
        setSoldAnimation({
          playerName: currentPlayerRef.current?.name || 'Player',
          teamName: teamName,
          teamLogo: teamLogo,
          price: data.soldPrice || 0
        });
        setTimeout(() => setSoldAnimation(null), 4000);
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
        {/* Clean Header Row — in document flow, no overlap */}
        <div className="shrink-0 flex items-center justify-between px-4 md:px-8 py-3 md:py-4 z-30">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex flex-col items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-black/30 hover:bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 transition-all group"
              title="Menu"
            >
              <span className={`block w-5 md:w-6 h-0.5 md:h-[2px] bg-white/80 group-hover:bg-white transition-all ${showMenu ? 'rotate-45 translate-y-[5px]' : ''}`}></span>
              <span className={`block w-5 md:w-6 h-0.5 md:h-[2px] bg-white/80 group-hover:bg-white my-[4px] transition-all ${showMenu ? 'opacity-0' : ''}`}></span>
              <span className={`block w-5 md:w-6 h-0.5 md:h-[2px] bg-white/80 group-hover:bg-white transition-all ${showMenu ? '-rotate-45 -translate-y-[5px]' : ''}`}></span>
            </button>
            <img src="/ezauction.png" alt="EzAuction Logo" className="h-8 sm:h-10 md:h-14 lg:h-16 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
          </div>
          <div className="flex flex-col items-center animate-fade-in z-20">
            {sponsorLogo && <img src={sponsorLogo} alt="Sponsor" className="h-8 sm:h-10 md:h-14 lg:h-16 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" />}
            {sponsorName && <div className="text-white text-[8px] sm:text-[10px] md:text-xs lg:text-sm font-black mt-1 tracking-[0.3em] uppercase drop-shadow-md opacity-80">{sponsorName}</div>}
          </div>
          <div className="flex-1 flex justify-end">
            {status === 'LIVE' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 backdrop-blur-xl rounded-xl border border-red-500/20">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                <span className="text-red-400 text-[10px] md:text-xs font-black uppercase tracking-widest">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden p-3 pt-2 md:px-8 md:py-4 md:pb-6 gap-3 md:gap-5 flex flex-col md:grid md:grid-cols-12 md:items-stretch scrollbar-none min-h-0">
          {currentPlayer ? (
            <>
              {/* Left Column: Enhanced Player Profile */}
              <div className="col-span-12 md:col-span-3 flex flex-col overflow-hidden order-2 md:order-1 md:justify-center">
                <div className="w-full bg-gray-900/80 backdrop-blur-2xl rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 border border-white/10 shadow-2xl flex flex-row md:flex-col items-center relative overflow-hidden gap-4 md:gap-6 lg:gap-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-yellow-400/5 opacity-50"></div>



                  {/* Left Side (Mobile) / Top (Desktop) */}
                  <div className="relative z-10 flex flex-col items-start md:items-center gap-2 md:gap-4 w-1/2 md:w-full justify-center">
                    <div className="px-3 py-1.5 md:px-5 md:py-3 bg-white/10 rounded-xl border border-yellow-400/40 backdrop-blur-xl md:self-end shadow-lg">
                      <span className="text-white font-mono font-black text-lg md:text-3xl xl:text-4xl drop-shadow-lg">#{currentPlayer.serial_number || currentPlayer.id}</span>
                    </div>
                    <h2 className="text-white text-xl sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight drop-shadow-2xl leading-tight md:text-center">
                      {currentPlayer.name}
                    </h2>
                    <div className="inline-block px-3 py-1.5 md:px-6 md:py-2.5 bg-yellow-400 text-black rounded-full text-[10px] md:text-sm lg:text-base font-black uppercase tracking-widest shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                      {currentPlayer.role}
                    </div>
                  </div>

                  {/* Right Side (Mobile) / Bottom Grid (Desktop) */}
                  <div className="relative z-10 flex flex-col gap-2 md:gap-4 w-1/2 md:w-full">
                    <div className="bg-white/5 p-2 md:p-5 rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-md flex flex-row md:flex-col justify-between items-center md:items-center">
                      <span className="text-white/40 text-[8px] md:text-xs lg:text-sm font-black uppercase tracking-[0.1em] md:tracking-[0.2em] md:mb-2 md:text-center block">Age</span>
                      <div className="text-white font-black text-sm md:text-3xl lg:text-4xl uppercase tracking-tight md:text-center">{currentPlayer.age || 'N/A'} <span className="hidden md:inline text-xl lg:text-2xl text-white/50 ml-1">YRS</span></div>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-400/10 to-transparent p-2.5 md:p-6 rounded-xl md:rounded-2xl border border-yellow-400/20 backdrop-blur-md flex flex-col justify-center items-center h-full">
                      <span className="block text-yellow-400/60 text-[8px] md:text-xs lg:text-sm font-black uppercase tracking-widest mb-1 md:mb-2 text-center">Base Price</span>
                      <div className="text-yellow-400 font-black text-lg md:text-4xl lg:text-5xl font-mono tracking-tighter text-center drop-shadow-lg leading-none md:leading-normal">
                        ₹{formatIndianNumber(currentPlayer.base_price || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Column: Image */}
              <div className="col-span-12 md:col-span-5 flex flex-col items-center justify-center relative overflow-hidden order-1 md:order-2">
                <div className={`relative w-full max-w-[220px] sm:max-w-[280px] md:max-w-none md:h-full aspect-[3/4] transition-all duration-500 ${bidFlash ? 'scale-[1.02]' : 'scale-100'}`}>
                  <div className={`w-full h-full rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${bidFlash ? 'shadow-yellow-400/30' : ''}`}>
                    <img
                      src={getImageUrl(currentPlayer.image)}
                      alt={currentPlayer.name}
                      className="w-full h-full object-cover object-top cursor-pointer"
                      onClick={() => setPreviewImage(getImageUrl(currentPlayer.image))}
                      onError={(e) => { e.target.src = '/deafult_player.png'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Bid Action - Optimized for Overflow */}
              <div className="col-span-12 md:col-span-4 flex flex-col gap-2 shrink-0 mb-3 md:mb-0 order-3 z-10 md:justify-center">
                <div className={`w-full flex flex-row md:flex-col bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-2xl md:rounded-3xl p-3 md:p-6 lg:p-8 shadow-2xl border-2 md:border-4 border-white/80 items-center justify-between md:justify-center text-blue-900 transition-all duration-500 gap-3 md:gap-6 lg:gap-8 ${bidFlash ? 'scale-[1.01]' : ''}`}>

                  {/* Mobile Left / Desktop Top: Bid Amount */}
                  <div className="flex flex-col items-start md:items-center w-5/12 md:w-full">
                    <div className="text-blue-900/60 md:text-blue-900/40 text-[10px] md:text-lg lg:text-xl xl:text-2xl font-black tracking-[0.2em] md:tracking-[0.5em] uppercase md:mb-2 text-left md:text-center">Current Bid</div>
                    <div className={`font-black leading-none tracking-tighter transition-all drop-shadow-xl text-left md:text-center w-full break-words
                      ${currentBid.toString().length > 7 ? 'text-xl md:text-3xl lg:text-5xl xl:text-6xl' : (currentBid.toString().length > 5 ? 'text-2xl md:text-4xl lg:text-6xl xl:text-7xl' : 'text-3xl md:text-5xl lg:text-7xl xl:text-8xl')}
                      ${bidFlash ? 'scale-110' : ''}
                    `}>
                      ₹{formatIndianNumber(currentBid)}
                    </div>
                  </div>

                  <div className="hidden md:block h-1.5 w-32 bg-blue-900/10 rounded-full mx-auto"></div>
                  <div className="block md:hidden w-px h-12 bg-blue-900/20 mx-1"></div>

                  {/* Mobile Right / Desktop Bottom: Leading Team */}
                  <div className="flex flex-col items-end md:items-center w-7/12 md:w-auto animate-bounce-slow md:px-4">
                    {highestBid ? (
                      <>
                        <div className="text-blue-900/60 text-[9px] md:text-xs lg:text-sm xl:text-base font-black uppercase tracking-[0.2em] md:tracking-[0.4em] mb-1 md:mb-4 text-right md:text-center">Leading Team</div>
                        <div className="bg-blue-900 text-yellow-400 w-full px-3 py-2 md:px-6 md:py-4 lg:py-6 xl:py-8 rounded-xl md:rounded-[2rem] shadow-xl md:shadow-2xl border-2 md:border-4 border-white/20 flex flex-col md:flex-row items-center justify-center text-center md:text-left gap-2 md:gap-4 lg:gap-6">
                          {(() => {
                            const wTeam = teams.find(t => t.name === highestBid.team_name);
                            if (wTeam && wTeam.logo) {
                              return <img src={getImageUrl(wTeam.logo)} alt={wTeam.name} className="w-8 h-8 md:w-16 md:h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 rounded-full object-cover border-2 border-white/20 shadow-lg drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />;
                            }
                            return null;
                          })()}
                          <span className={`font-black leading-tight break-words w-full truncate md:overflow-visible md:whitespace-normal
                            ${highestBid.team_name.length > 15 ? 'text-sm md:text-xl lg:text-3xl xl:text-4xl' : 'text-base md:text-2xl lg:text-4xl xl:text-5xl'}
                          `}>
                            {highestBid.team_name}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-blue-900/50 font-black italic text-sm md:text-2xl lg:text-3xl xl:text-4xl animate-pulse uppercase tracking-[0.1em] md:tracking-[0.2em] text-right md:text-center w-full">
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
              <div className="flex items-center justify-between px-6 md:px-10 py-5 md:py-8 border-b border-white/10 bg-gradient-to-r from-yellow-400/10 via-yellow-400/5 to-transparent shrink-0 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-transparent"></div>
                <div className="flex items-center gap-4 md:gap-6 relative z-10">
                  <div className="p-3 md:p-4 bg-yellow-400/20 rounded-xl md:rounded-2xl border border-yellow-400/30 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                    <svg className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white font-black text-2xl md:text-4xl tracking-tighter drop-shadow-lg">TEAM PURSES</h2>
                    <p className="text-yellow-400/80 text-xs md:text-sm font-bold uppercase tracking-[0.3em] mt-1">Live Budget Tracking</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTeamPurses(false)}
                  className="p-3 hover:bg-white/10 rounded-2xl transition-all hover:scale-110 active:scale-95 bg-white/5 border border-white/10 relative z-10"
                >
                  <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Team Cards */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 md:gap-6 lg:gap-8 md:content-start scrollbar-none">
                {teamPurses.length > 0 ? (
                  teamPurses.map((team, index) => {
                    const budgetPercent = team.budget && team.totalSpent !== undefined
                      ? Math.max(0, (team.budget / (team.budget + team.totalSpent)) * 100)
                      : 100;
                    return (
                      <div
                        key={team.id}
                        className="bg-white/5 rounded-2xl md:rounded-3xl border border-white/10 p-4 md:p-6 lg:p-8 hover:bg-white/10 transition-all group hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <div className="flex items-center gap-3 md:gap-5 mb-4 md:mb-6">
                          {team.logo ? (
                            <img
                              src={getImageUrl(team.logo)}
                              alt={team.name}
                              className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full object-cover border-2 md:border-4 border-white/20 group-hover:border-yellow-400/60 transition-colors shadow-lg"
                              onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=' + team.name.charAt(0); }}
                            />
                          ) : (
                            <div className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-400/20 border-2 md:border-4 border-white/20 flex items-center justify-center text-white font-black text-lg md:text-2xl shadow-lg">
                              {team.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-black text-base md:text-xl lg:text-2xl truncate drop-shadow-md">{team.name}</h3>
                            <p className="text-white/60 text-sm md:text-base lg:text-lg font-medium mt-0.5 md:mt-1">{team.playersBought || 0} players bought</p>
                          </div>
                        </div>

                        {/* Budget Bar */}
                        <div className="mb-3 md:mb-4">
                          <div className="flex items-baseline justify-between mb-1.5 md:mb-2 gap-2">
                            <span className="text-white/50 text-xs md:text-sm font-bold uppercase tracking-[0.15em] shrink-0">Remaining</span>
                            <span className="text-yellow-400 font-black text-base md:text-xl lg:text-2xl font-mono tracking-tighter drop-shadow-lg text-right whitespace-nowrap">₹{formatIndianNumber(team.budget || 0)}</span>
                          </div>
                          <div className="w-full h-2 md:h-3 bg-white/10 rounded-full overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-700 shadow-[0_0_10px_currentColor] ${
                                budgetPercent > 60 ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-emerald-500' :
                                budgetPercent > 30 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-500' :
                                'bg-gradient-to-r from-red-400 to-rose-600 text-rose-500'
                              }`}
                              style={{ width: `${budgetPercent}%` }}
                            ></div>
                          </div>
                        </div>

                        {team.totalSpent > 0 && (
                          <div className="flex items-center justify-between text-xs md:text-sm lg:text-base mt-4 md:mt-6 pt-3 md:pt-4 border-t border-white/10">
                            <span className="text-white/40 font-bold uppercase tracking-wider">Total Spent</span>
                            <span className="text-rose-400/90 font-mono font-black tracking-tight text-sm md:text-lg lg:text-xl">₹{formatIndianNumber(team.totalSpent)}</span>
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

      {/* Silent Image Preloader for Main Images and Logos */}
      {/* We are preloading ALL unsold main images and team logos here so the browser caches them during random selection */}
      <div style={{ display: 'none' }}>
        {currentPlayer && currentPlayer.image && (
          <link rel="preload" as="image" href={getImageUrl(currentPlayer.image)} />
        )}
        {unsoldPlayers.map((p) => (
          p.image && <link key={`player-${p.id}`} rel="preload" as="image" href={getImageUrl(p.image)} />
        ))}
        {teams.map((t) => (
          t.logo && <link key={`team-${t.id}`} rel="preload" as="image" href={getImageUrl(t.logo)} />
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
          <div className="sold-stamp relative flex flex-col items-center gap-4 md:gap-6 z-10 w-11/12 max-w-4xl">
            <div className="text-6xl md:text-8xl lg:text-[10rem] sold-gavel drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">🔨</div>
            
            <div className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 text-blue-900 font-black text-5xl md:text-8xl lg:text-9xl px-8 md:px-16 py-3 md:py-6 rounded-2xl md:rounded-3xl border-4 md:border-8 border-white shadow-[0_0_80px_rgba(250,204,21,0.6)] tracking-wider uppercase text-center flex flex-col items-center">
              SOLD!
            </div>
            
            {/* Player details pop */}
            <div className="sold-player-details flex flex-col items-center bg-black/50 backdrop-blur-md px-6 md:px-12 py-4 md:py-8 rounded-3xl border border-white/20 shadow-2xl mt-2 md:mt-4 text-center">
              <h3 className="text-white text-3xl md:text-5xl lg:text-6xl font-black drop-shadow-lg mb-2">{soldAnimation.playerName}</h3>
              
              <div className="flex items-center gap-4 my-2 md:my-4">
                <span className="text-white/60 text-lg md:text-2xl font-bold uppercase tracking-widest">TO</span>
              </div>
              
              <div className="flex items-center gap-3 md:gap-6">
                {soldAnimation.teamLogo && (
                  <img src={getImageUrl(soldAnimation.teamLogo)} alt="Team" className="w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full object-cover border-4 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                )}
                <span className="text-yellow-400 text-3xl md:text-5xl lg:text-7xl font-black drop-shadow-2xl">{soldAnimation.teamName || 'A TEAM'}</span>
              </div>
              
              {soldAnimation.price > 0 && (
                <div className="mt-6 md:mt-10 bg-white/10 px-8 py-3 rounded-full border border-white/30">
                  <span className="text-white/80 text-sm md:text-xl font-bold uppercase tracking-widest mr-4">For</span>
                  <span className="text-white text-4xl md:text-6xl lg:text-7xl font-black font-mono tracking-tight drop-shadow-2xl text-rose-400">
                    ₹{formatIndianNumber(soldAnimation.price)}
                  </span>
                </div>
              )}
            </div>
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
        .sold-overlay { animation: sold-overlay-lifecycle 3.8s ease-out forwards; }
        @keyframes sold-overlay-lifecycle {
          0% { opacity: 0; }
          5% { opacity: 1; }
          80% { opacity: 1; }
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
        .sold-player-details {
          animation: details-slide-up 0.5s 0.4s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes details-slide-up {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
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
