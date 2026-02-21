import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getImageUrl } from '../utils/imageUtils';

// Auto-detect API URL
const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    return '/api';
};

const API_URL = getApiUrl();

function Overlay() {
    const [socket, setSocket] = useState(null);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [highestBid, setHighestBid] = useState(null);
    const [currentBid, setCurrentBid] = useState(0);
    const [bidFlash, setBidFlash] = useState(false);
    const [leadingTeam, setLeadingTeam] = useState(null);

    useEffect(() => {
        // Add class to body to allow transparency
        document.body.classList.add('bg-transparent');

        // Connect to the server. 
        // In production, we need to connect to the backend URL explicitly if we rely on API_URL.
        const newSocket = io('/', {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Overlay connected to socket');
            newSocket.emit('request-info');
        });

        // Polling as fallback
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/host/current-info`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.player) setCurrentPlayer(prev =>
                        JSON.stringify(prev) !== JSON.stringify(data.player) ? data.player : prev
                    );

                    if (data.highestBid) {
                        setHighestBid(data.highestBid);
                        setCurrentBid(data.highestBid.amount);
                        setLeadingTeam(data.highestBid.team_name);
                    } else {
                        setHighestBid(null);
                        setLeadingTeam(null);
                        if (data.player) {
                            setCurrentBid(data.player.base_price);
                        }
                    }
                }
            } catch (err) {
                console.error('Overlay polling error:', err);
            }
        }, 2000);

        // Since we don't have a service imported that fetches data (to avoid auth deps if possible),
        // we might need to rely on the socket pushing an initial state or just wait.
        // Actually, let's try to fetch current info using fetch directly to avoid service dependency requiring auth logic
        // But since authentication is cookie-based, axios/fetch with credentials should work if user is logged in context of browser
        // For now, let's listen to events aggressively.

        newSocket.on('player-loaded', (data) => {
            setCurrentPlayer(data.player);
            setHighestBid(null);
            setCurrentBid(data.player ? data.player.base_price : 0);
            setLeadingTeam(null);
        });

        newSocket.on('bid-placed', (data) => {
            if (data.bid) {
                setHighestBid(data.bid);
                setCurrentBid(data.bid.amount);
                setLeadingTeam(data.bid.team_name);
                flashBid();
            }
        });

        newSocket.on('bid-updated', (data) => {
            if (data.highestBid) {
                setHighestBid(data.highestBid);
                setCurrentBid(data.highestBid.amount);
                setLeadingTeam(data.highestBid.team_name);
                flashBid();
            } else {
                setHighestBid(null);
                setLeadingTeam(null);
                // revert to base price if possible, or 0
                if (currentPlayer) setCurrentBid(currentPlayer.base_price);
            }
        });

        newSocket.on('all-players-deleted', () => {
            setCurrentPlayer(null);
            setHighestBid(null);
            setCurrentBid(0);
            setLeadingTeam(null);
        });

        return () => {
            newSocket.close();
            clearInterval(pollInterval);
            document.body.classList.remove('bg-transparent');
        };
    }, []); // Removed currentPlayer dependency to prevent socket reconnection cycles

    const flashBid = () => {
        setBidFlash(true);
        setTimeout(() => setBidFlash(false), 500);
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

    if (!currentPlayer) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-black/80">
                <div className="text-white text-4xl font-bold uppercase tracking-widest animate-pulse">
                    Waiting for Auction...
                </div>
                {/* DEBUG INFO */}
                <div className="absolute bottom-2 right-2 text-xs text-white/50 font-mono bg-black/50 p-1 rounded z-50">
                    Status: {socket?.connected ? 'Connected' : 'Disconnected'} | Player: Waiting | API: {API_URL} | Socket ID: {socket?.id}
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen overflow-hidden font-sans bg-green-500/0"> {/* Transparent background mostly */}

            {/* Lower Third / Overlay Container */}
            <div className="absolute bottom-10 left-10 right-10 h-64 flex items-end justify-between items-center gap-8">

                {/* LEFT: Player Info */}
                <div className="flex-1 bg-blue-900/90 border-l-4 border-yellow-400 p-6 rounded-r-xl shadow-2xl backdrop-blur-md transform transition-all hover:scale-105 origin-left">
                    <div className="flex flex-col gap-1">
                        <span className="text-yellow-400 font-bold uppercase tracking-widest text-sm">{currentPlayer.role}</span>
                        <h1 className="text-white text-5xl font-black uppercase leading-tight drop-shadow-lg line-clamp-1">{currentPlayer.name}</h1>
                        <div className="flex items-center gap-4 mt-2">
                            <span className="text-white/80 font-bold text-xl">{currentPlayer.country || 'N/A'}</span>
                            {currentPlayer.serial_number && (
                                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded text-sm font-bold">#{currentPlayer.serial_number}</span>
                            )}
                        </div>
                        <div className="mt-2 text-yellow-200/80 text-lg">
                            Base: <span className="font-mono">₹{formatIndianNumber(currentPlayer.base_price)}</span>
                        </div>
                    </div>
                </div>

                {/* CENTER: Player Image */}
                <div className="relative w-64 h-64 -mb-8 z-10">
                    <div className={`absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-20 ${bidFlash ? 'opacity-60 scale-110' : ''} transition-all duration-300`}></div>
                    <div className="w-full h-full rounded-full border-4 border-white/20 bg-black/40 overflow-hidden shadow-2xl relative">
                        <img
                            src={getImageUrl(currentPlayer.image)}
                            alt={currentPlayer.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = '/deafult_player.png'; }}
                        />
                    </div>
                </div>

                {/* RIGHT: Bid Info */}
                <div className={`flex-1 bg-gradient-to-l from-blue-900/90 to-blue-800/80 border-r-4 border-green-500 p-6 rounded-l-xl shadow-2xl backdrop-blur-md flex flex-col items-end justify-center transition-all duration-300 ${bidFlash ? 'bg-blue-800/95 scale-105 border-yellow-400' : ''}`}>
                    <span className="text-green-400 font-bold uppercase tracking-widest text-sm mb-1">Current Bid</span>
                    <div className={`text-white font-black text-6xl font-mono tracking-tighter drop-shadow-xl transition-all ${bidFlash ? 'text-yellow-400 scale-110' : ''}`}>
                        ₹{formatIndianNumber(currentBid)}
                    </div>

                    {leadingTeam ? (
                        <div className="mt-2 flex flex-col items-end animate-fade-in-up">
                            <span className="text-blue-200 text-xs uppercase">Leading</span>
                            <span className="text-yellow-400 font-bold text-xl text-right line-clamp-1">{leadingTeam}</span>
                        </div>
                    ) : (
                        <div className="mt-2 text-white/40 italic">No bids yet</div>
                    )}
                </div>

            </div>

            {/* Optional Top Branding if needed, keeping it minimal */}
            <div className="absolute top-8 right-8 opacity-80">
                <img src="/ezauction.png" alt="Logo" className="h-12 object-contain drop-shadow" />
            </div>

        </div>
    );
}

export default Overlay;
