import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../config';
import { getPublicPlayers, getPublicTeams } from '../services/public';
import { getImageUrl } from '../utils/imageUtils';

function PublicLive() {
    const [viewMode, setViewMode] = useState('live'); // 'live' or 'catalog'
    
    // Live Auction State
    const [socket, setSocket] = useState(null);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [highestBid, setHighestBid] = useState(null);
    const [currentBid, setCurrentBid] = useState(0);
    const [bidFlash, setBidFlash] = useState(false);
    const [leadingTeam, setLeadingTeam] = useState(null);
    const [auctionStatus, setAuctionStatus] = useState('STOPPED');

    // Catalog State
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [filterRole, setFilterRole] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    useEffect(() => {
        // --- WEBSOCKET CONNECTION ---
        const newSocket = io(getSocketUrl(), {
            transports: ['websocket'],
            upgrade: false,
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 20,
        });
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('[Public Portal] Connected to live feed');
            newSocket.emit('request-info'); 
        });

        newSocket.on('reconnect', () => {
            newSocket.emit('request-info'); 
        });

        newSocket.on('player-loaded', (data) => {
            setCurrentPlayer(data.player);
            setHighestBid(null);
            setCurrentBid(data.player ? data.player.base_price : 0);
            setLeadingTeam(null);
            setAuctionStatus(data.player ? 'LIVE' : 'STOPPED');
            
            // Also update the local catalog if player loaded
            if (data.player) {
                setPlayers(prev => prev.map(p => p.id === data.player.id ? { ...p, status: 'AVAILABLE' } : p));
            }
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
            }
        });

        newSocket.on('player-marked', (data) => {
            // Update the live overlay state using functional update
            setCurrentPlayer(prev => {
                if (prev && prev.id === data.playerId) {
                    return {
                        ...prev,
                        status: data.status,
                        sold_price: data.soldPrice,
                        sold_to_team: data.soldToTeam
                    };
                }
                return prev;
            });
            
            // Update the catalog in real-time
            setPlayers(prev => prev.map(p => {
                if (p.id === data.playerId) {
                    return {
                        ...p,
                        status: data.status,
                        sold_price: data.soldPrice,
                        sold_to_team: data.soldToTeam
                    };
                }
                return p;
            }));
        });

        newSocket.on('auction-status-changed', (data) => {
            setAuctionStatus(data.status);
        });

        return () => {
            newSocket.close();
        };
    }, []);

    // Load Catalog Data on mount or when switching to catalog view
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [playersData, teamsData] = await Promise.all([
                    getPublicPlayers(),
                    getPublicTeams()
                ]);
                setPlayers(playersData);
                setTeams(teamsData);
            } catch (err) {
                console.error("Failed to load catalog data", err);
            } finally {
                setLoadingCatalog(false);
            }
        };
        loadInitialData();
    }, []);

    const flashBid = () => {
        setBidFlash(true);
        setTimeout(() => setBidFlash(false), 500);
    };

    const formatIndianNumber = (num) => {
        if (!num) return '0';
        const s = num.toString();
        const lastThree = s.substring(s.length - 3);
        const otherNumbers = s.substring(0, s.length - 3);
        if (otherNumbers !== '') {
            return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
        }
        return lastThree;
    };

    const roles = ['All', ...Array.from(new Set(players.map(p => p.role)))];
    const statuses = ['All', 'AVAILABLE', 'SOLD', 'UNSOLD'];

    const filteredPlayers = players.filter(p => {
        const matchesRole = filterRole === 'All' || p.role === filterRole;
        const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesRole && matchesStatus && matchesSearch;
    });

    const getTeamName = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'Unknown Team';
    };

    const getTeamLogo = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.logo : null;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
            {/* Top Navigation Bar */}
            <nav className="bg-gray-800 border-b border-gray-700 shadow-lg px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <img src="/ezauction.png" alt="Logo" className="h-8 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Audience Portal
                    </h1>
                </div>
                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                    <button 
                        onClick={() => setViewMode('live')}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'live' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${viewMode === 'live' && auctionStatus === 'LIVE' ? 'bg-white animate-pulse' : 'bg-red-400'}`}></span>
                            Live Auction
                        </span>
                    </button>
                    <button 
                        onClick={() => setViewMode('catalog')}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        Player Catalog
                    </button>
                    <button 
                        onClick={() => setViewMode('teams')}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${viewMode === 'teams' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        Teams List
                    </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <div className="flex-1 w-full relative">
                
                {/* 🔴 LIVE AUCTION VIEW */}
                {viewMode === 'live' && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 lg:p-12 overflow-hidden bg-gradient-to-br from-gray-900 to-black">
                        {!currentPlayer || auctionStatus === 'STOPPED' ? (
                            <div className="text-center animate-fade-in">
                                <div className="text-6xl mb-4">⏳</div>
                                <h2 className="text-3xl font-bold text-gray-400 tracking-widest uppercase">Waiting for Auction...</h2>
                                <p className="text-gray-500 mt-2">The auctioneer has not loaded a player yet.</p>
                            </div>
                        ) : (
                            <div className="w-full max-w-5xl flex flex-col md:flex-row bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-700/50">
                                {/* Left side - Image */}
                                <div className="md:w-2/5 md:bg-gray-700/50 p-8 flex items-center justify-center relative overflow-hidden">
                                    <div className={`absolute inset-0 bg-yellow-500/10 blur-3xl rounded-full transition-opacity duration-500 ${bidFlash ? 'opacity-100 scale-150' : 'opacity-0'}`}></div>
                                    <div className="w-72 h-72 md:w-[22rem] md:h-[22rem] rounded-full border-4 border-gray-600 shadow-2xl relative z-10 bg-gray-900 flex items-end justify-center overflow-hidden">
                                        <img
                                            src={getImageUrl(currentPlayer.image || currentPlayer.thumb_url)}
                                            alt={currentPlayer.name}
                                            className="w-[120%] h-[120%] object-contain"
                                            style={{ objectPosition: 'center bottom' }}
                                            onError={(e) => { e.target.src = '/default_player.png'; }}
                                        />
                                    </div>
                                    {currentPlayer.status === 'SOLD' && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-green-900/60 backdrop-blur-sm">
                                            <div className="transform rotate-12 flex flex-col items-center">
                                                <span className="text-6xl font-black text-white px-6 py-2 border-4 border-white rounded-xl shadow-2xl tracking-widest bg-green-600">SOLD</span>
                                                <div className="mt-4 flex items-center gap-3 bg-black/80 px-6 py-3 rounded-full border border-gray-700">
                                                    {currentPlayer.sold_to_team && getTeamLogo(currentPlayer.sold_to_team) && (
                                                        <img src={getImageUrl(getTeamLogo(currentPlayer.sold_to_team))} className="h-8 w-8 object-contain rounded-full" alt="Team Logo"/>
                                                    )}
                                                    <span className="text-white font-bold text-xl">{formatIndianNumber(currentPlayer.sold_price)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {currentPlayer.status === 'UNSOLD' && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-900/60 backdrop-blur-sm">
                                            <span className="text-6xl font-black text-white px-6 py-2 border-4 border-white rounded-xl shadow-2xl tracking-widest bg-red-600 transform -rotate-12">UNSOLD</span>
                                        </div>
                                    )}
                                </div>

                                {/* Right side - Details */}
                                <div className="md:w-3/5 p-8 lg:p-12 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-md border border-blue-500/30">{currentPlayer.role}</span>
                                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mt-4 uppercase tracking-tight">{currentPlayer.name}</h1>
                                            </div>
                                            <div className="text-right">
                                                {currentPlayer.serial_number && (
                                                    <span className="text-2xl font-bold text-gray-400">#{currentPlayer.serial_number}</span>
                                                )}
                                                <div className="text-gray-400 font-medium mt-1 uppercase">{currentPlayer.country || 'N/A'}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-8 flex items-center gap-8">
                                            <div>
                                                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Base Price</p>
                                                <p className="text-2xl font-bold text-gray-300">₹{formatIndianNumber(currentPlayer.base_price)}</p>
                                            </div>
                                            {(currentPlayer.age) && (
                                              <div>
                                                  <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Age</p>
                                                  <p className="text-2xl font-bold text-gray-300">{currentPlayer.age} Yrs</p>
                                              </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bidding Section */}
                                    <div className={`mt-10 p-6 rounded-2xl transition-all duration-300 ${bidFlash ? 'bg-yellow-400/20 border-yellow-400 scale-105' : 'bg-gray-900/50 border-gray-700/50'} border-2`}>
                                        <p className="text-green-400 text-sm uppercase tracking-widest font-bold mb-2">Current Bid</p>
                                        <div className={`text-5xl md:text-6xl lg:text-7xl font-mono font-black tracking-tighter ${bidFlash ? 'text-yellow-400' : 'text-white'}`}>
                                            ₹{formatIndianNumber(currentPlayer.status === 'SOLD' ? currentPlayer.sold_price : currentBid)}
                                        </div>
                                        {currentPlayer.status === 'AVAILABLE' && leadingTeam && (
                                            <div className="mt-4 flex items-center gap-2">
                                                <span className="text-gray-400 text-sm uppercase">Leading:</span>
                                                <span className="text-xl font-bold text-yellow-500">{leadingTeam}</span>
                                            </div>
                                        )}
                                        {currentPlayer.status === 'AVAILABLE' && !leadingTeam && (
                                            <div className="mt-4 text-gray-500 italic">Awaiting first bid...</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 📋 CATALOG VIEW */}
                {viewMode === 'catalog' && (
                    <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col">
                        {/* Filters */}
                        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Search Players</label>
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Role</label>
                                <select 
                                    value={filterRole} 
                                    onChange={e => setFilterRole(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none"
                                >
                                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</label>
                                <select 
                                    value={filterStatus} 
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none"
                                >
                                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Player Grid */}
                        <div className="flex-1 min-h-[50vh]">
                            {loadingCatalog ? (
                                <div className="h-40 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                                </div>
                            ) : filteredPlayers.length === 0 ? (
                                <div className="text-center text-gray-500 py-20 flex flex-col items-center">
                                    <span className="text-5xl mb-4">🔍</span>
                                    <p className="text-xl">No players found matching your filters.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-1">
                                    {filteredPlayers.map(player => (
                                        <div key={player.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-500 transition-all hover:shadow-xl hover:-translate-y-1 group">
                                            {/* Image Header */}
                                            <div className="h-56 bg-gray-900 relative p-2 flex items-end justify-center">
                                                <img 
                                                    src={getImageUrl(player.thumb_url || player.image)} 
                                                    alt={player.name}
                                                    className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity scale-110 origin-bottom"
                                                    onError={(e) => { e.target.src='/default_player.png'; }}
                                                />
                                                <div className="absolute top-2 right-2">
                                                    {player.status === 'AVAILABLE' && <span className="px-2 py-1 bg-gray-800/80 text-gray-300 text-xs font-bold rounded shadow backdrop-blur uppercase">Available</span>}
                                                    {player.status === 'SOLD' && <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded shadow uppercase">Sold</span>}
                                                    {player.status === 'UNSOLD' && <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow uppercase">Unsold</span>}
                                                </div>
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-bold text-white leading-tight truncate pr-2">{player.name}</h3>
                                                    {player.serial_number && <span className="text-xs text-gray-500 font-mono">#{player.serial_number}</span>}
                                                </div>
                                                <p className="text-xs text-indigo-400 uppercase font-semibold mb-3">{player.role}</p>
                                                
                                                <div className="space-y-1.5 mt-4">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">Base</span>
                                                        <span className="text-gray-300 font-mono">₹{formatIndianNumber(player.base_price)}</span>
                                                    </div>
                                                    
                                                    {player.status === 'SOLD' && (
                                                        <div className="flex justify-between text-sm items-center pt-2 border-t border-gray-700 mt-2">
                                                            <div className="flex items-center gap-1">
                                                                {getTeamLogo(player.sold_to_team) && (
                                                                    <img src={getImageUrl(getTeamLogo(player.sold_to_team))} className="w-4 h-4 rounded-full"/>
                                                                )}
                                                                <span className="text-gray-400 text-xs max-w-[80px] truncate" title={getTeamName(player.sold_to_team)}>{getTeamName(player.sold_to_team)}</span>
                                                            </div>
                                                            <span className="text-green-400 font-bold font-mono">₹{formatIndianNumber(player.sold_price)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 🛡️ TEAMS CATALOG VIEW */}
                {viewMode === 'teams' && (
                    <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col">
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">Franchises & Stats</h2>
                            <div className="text-gray-400 text-sm">{teams.length} Teams Competing</div>
                        </div>

                        {loadingCatalog ? (
                            <div className="h-40 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                            </div>
                        ) : teams.length === 0 ? (
                            <div className="text-center text-gray-500 py-20 flex flex-col items-center">
                                <span className="text-5xl mb-4">🛡️</span>
                                <p className="text-xl">No teams registered yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {teams.map(team => {
                                    const teamPlayers = players.filter(p => p.sold_to_team === team.id);
                                    const totalSpent = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
                                    
                                    return (
                                        <div key={team.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 hover:border-green-500/50 transition-all hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] group relative">
                                            {/* Header Background */}
                                            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-green-900/40 to-gray-900 border-b border-gray-700/50"></div>
                                            
                                            <div className="p-6 relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-20 h-20 rounded-full bg-gray-900 border-4 border-gray-700 shadow-xl overflow-hidden shrink-0 group-hover:border-green-500 transition-colors bg-white">
                                                        <img 
                                                            src={getImageUrl(team.logo)} 
                                                            alt={team.name}
                                                            className="w-full h-full object-contain"
                                                            onError={(e) => { e.target.src = '/default_player.png'; }}
                                                        />
                                                    </div>
                                                    <div className="pt-2">
                                                        <h3 className="text-xl font-bold text-white mb-1 leading-tight">{team.name}</h3>
                                                        {team.owner_name && (
                                                            <p className="text-xs text-green-400 font-semibold uppercase tracking-wider line-clamp-1 border border-green-400/30 bg-green-400/10 px-2 py-0.5 rounded inline-block mt-1">Owner: {team.owner_name}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-8 space-y-4">
                                                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 group-hover:bg-gray-900 transition-colors">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Remaining Purse</span>
                                                        </div>
                                                        <div className="text-2xl font-mono font-bold text-green-400">
                                                            ₹{formatIndianNumber(team.budget)}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 group-hover:bg-gray-900 transition-colors">
                                                            <span className="block text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">Players</span>
                                                            <span className="text-xl font-bold text-white">{teamPlayers.length}</span>
                                                        </div>
                                                        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 group-hover:bg-gray-900 transition-colors">
                                                            <span className="block text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">Spent</span>
                                                            <span className="text-lg font-mono font-bold text-red-400">₹{formatIndianNumber(totalSpent)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {teamPlayers.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-wrap gap-1">
                                                            {teamPlayers.slice(0, 5).map(tp => (
                                                                <span key={tp.id} className="text-[10px] text-gray-400 bg-gray-900 px-2 py-1 rounded truncate max-w-full block" title={tp.name}>
                                                                    {tp.name}
                                                                </span>
                                                            ))}
                                                            {teamPlayers.length > 5 && (
                                                                <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-1 rounded">+{teamPlayers.length - 5}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PublicLive;
