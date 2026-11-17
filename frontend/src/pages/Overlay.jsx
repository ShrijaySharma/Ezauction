import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getImageUrl } from '../utils/imageUtils';
import { getSocketUrl, setCurrentAuctionId, getCurrentAuctionId } from '../config';
import { getPublicPlayers, getPublicBroadcastConfig, getPublicTeamPurses } from '../services/public';
import TradingWindowBanner from '../components/TradingWindowBanner';
import { getTheme, DEFAULT_THEME } from '../utils/themeEngine';

// ── Overlay mode: purse / teams helpers ──────────────────────────────────────
const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

function getOverlayTokens(themeKey) {
    switch (themeKey) {
        case 'navy_gold': return { bg: 'rgba(7,22,48,0.9)', accent: '#C9A84C', text: '#FFFFFF', dim: 'rgba(255,255,255,0.55)', barBg: 'rgba(13,27,62,0.95)' };
        case 'blue_brush': return { bg: 'rgba(0,30,100,0.9)', accent: '#4D9FFF', text: '#FFFFFF', dim: 'rgba(255,255,255,0.6)', barBg: 'rgba(0,47,150,0.95)' };
        case 'dark_teal': return { bg: 'rgba(4,14,16,0.92)', accent: '#0CCFBE', text: '#FFFFFF', dim: 'rgba(255,255,255,0.5)', barBg: 'rgba(6,26,30,0.95)' };
        case 'midnight_yellow': return { bg: 'rgba(0,36,57,0.92)', accent: '#FAE300', text: '#FFFFFF', dim: 'rgba(255,255,255,0.6)', barBg: 'rgba(0,36,57,0.96)' };
        default: /* black_gold */ return { bg: 'rgba(10,10,10,0.92)', accent: '#D4AF37', text: '#FFFFFF', dim: 'rgba(255,255,255,0.5)', barBg: 'rgba(20,18,10,0.95)' };
    }
}

// ── Full-Screen Central Purse Overlay (Transparent background for YouTube streams) ──
function OverlayPurse({ teamPurses, theme, themeKey }) {
    const tk = getOverlayTokens(themeKey);
    if (!teamPurses || teamPurses.length === 0) return null;

    return (
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-6 md:p-10 pointer-events-none">
            {/* Header */}
            <div className="shrink-0 flex flex-col items-center mb-6 pointer-events-auto">
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-0.5 w-12" style={{ background: tk.accent }} />
                    <span className="font-black uppercase tracking-[0.4em] text-xs" style={{ color: tk.accent }}>
                        Live Broadcast
                    </span>
                    <div className="h-0.5 w-12" style={{ background: tk.accent }} />
                </div>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
                    Team <span style={{ color: tk.accent }}>Purses</span>
                </h2>
            </div>

            {/* Central Grid of Purse Cards — completely transparent around cards so YT stream shows through */}
            <div className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 max-h-[82vh] overflow-y-auto scrollbar-none pointer-events-auto p-2">
                {teamPurses.map((team, i) => {
                    const remaining = team.budget || 0;
                    const spent = team.totalSpent || 0;
                    const total = remaining + spent;
                    const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 100;
                    const barColor = pct > 50 ? '#22C55E' : pct > 20 ? '#F59E0B' : '#EF4444';

                    return (
                        <div
                            key={team.id || i}
                            className="rounded-2xl border-2 flex flex-col gap-3 p-4 md:p-5 transition-transform hover:scale-[1.02] shadow-[0_15px_40px_rgba(0,0,0,0.8)]"
                            style={{
                                background: 'rgba(10, 10, 15, 0.88)',
                                borderColor: `${tk.accent}50`,
                                backdropFilter: 'blur(20px)',
                            }}
                        >
                            {/* Accent top stripe */}
                            <div className="h-1 w-full -mt-1 rounded-full" style={{ background: `linear-gradient(90deg, ${tk.accent}, transparent)` }} />

                            {/* Team header */}
                            <div className="flex items-center gap-3">
                                {team.logo ? (
                                    <img src={getImageUrl(team.logo)} alt={team.name}
                                        className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-lg"
                                        style={{ border: `2px solid ${tk.accent}70` }}
                                        onError={e => { e.target.style.display = 'none'; }} />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center font-black text-lg shadow-lg"
                                        style={{ background: `${tk.accent}25`, border: `2px solid ${tk.accent}60`, color: tk.accent }}>
                                        {(team.name || 'T').charAt(0)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="font-black text-white text-sm md:text-base leading-tight uppercase truncate">
                                        {team.name}
                                    </div>
                                    <div className="text-[11px] font-bold text-white/60 mt-0.5">
                                        {team.playersBought || 0} players bought
                                    </div>
                                </div>
                            </div>

                            {/* Remaining Budget */}
                            <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${tk.accent}25` }}>
                                <div className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: tk.accent }}>
                                    Remaining Budget
                                </div>
                                <div className="font-black font-mono text-xl md:text-2xl leading-none text-white">
                                    ₹{FMT(remaining)}
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-2 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.12)' }}>
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
                                </div>
                                <div className="flex justify-between text-[9px] font-bold text-white/50">
                                    <span>{pct.toFixed(0)}% remaining</span>
                                    <span>Total: ₹{FMT(total)}</span>
                                </div>
                            </div>

                            {/* Total Spent */}
                            {spent > 0 && (
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10 font-bold">
                                    <span className="text-white/50 uppercase tracking-wider text-[9px] font-black">Total Spent</span>
                                    <span className="text-rose-400 font-black font-mono">₹{FMT(spent)}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Teams Overlay ─────────────────────────────────────────────────────────────
// ── Teams Overlay (Full-screen central transparent layout for YouTube stream) ──
function OverlayTeams({ teamPurses, theme, themeKey }) {
    const tk = getOverlayTokens(themeKey);
    if (!teamPurses || teamPurses.length === 0) return null;

    return (
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-6 md:p-10 pointer-events-none">
            {/* Header */}
            <div className="shrink-0 flex flex-col items-center mb-6 pointer-events-auto">
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-0.5 w-12" style={{ background: tk.accent }} />
                    <span className="font-black uppercase tracking-[0.4em] text-xs" style={{ color: tk.accent }}>
                        Live Broadcast
                    </span>
                    <div className="h-0.5 w-12" style={{ background: tk.accent }} />
                </div>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
                    Team <span style={{ color: tk.accent }}>Squads</span>
                </h2>
            </div>

            {/* Central Grid of Squad Cards — transparent around cards so YT stream shows through */}
            <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 max-h-[82vh] overflow-y-auto scrollbar-none pointer-events-auto p-2">
                {teamPurses.map((team, i) => {
                    const squad = team.players || [];
                    const remaining = team.budget || 0;

                    return (
                        <div
                            key={team.id || i}
                            className="rounded-2xl border-2 flex flex-col gap-3 p-4 md:p-5 transition-transform hover:scale-[1.02] shadow-[0_15px_40px_rgba(0,0,0,0.8)]"
                            style={{
                                background: 'rgba(10, 10, 15, 0.88)',
                                borderColor: `${tk.accent}50`,
                                backdropFilter: 'blur(20px)',
                            }}
                        >
                            {/* Accent top stripe */}
                            <div className="h-1 w-full -mt-1 rounded-full" style={{ background: `linear-gradient(90deg, ${tk.accent}, transparent)` }} />

                            {/* Team header */}
                            <div className="flex items-center gap-3">
                                {team.logo ? (
                                    <img src={getImageUrl(team.logo)} alt={team.name}
                                        className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-lg"
                                        style={{ border: `2px solid ${tk.accent}70` }}
                                        onError={e => { e.target.style.display = 'none'; }} />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center font-black text-lg shadow-lg"
                                        style={{ background: `${tk.accent}25`, border: `2px solid ${tk.accent}60`, color: tk.accent }}>
                                        {(team.name || 'T').charAt(0)}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="font-black text-white text-sm md:text-base leading-tight uppercase truncate">
                                        {team.name}
                                    </div>
                                    <div className="text-[11px] font-bold text-white/60 mt-0.5">
                                        {squad.length} players · <span className="font-mono text-emerald-400 font-bold">₹{FMT(remaining)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bought Players List */}
                            <div className="flex-1 flex flex-col gap-1.5 max-h-48 overflow-y-auto scrollbar-none pt-1">
                                {squad.length > 0 ? (
                                    squad.map((p, j) => (
                                        <div key={j} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {p.image ? (
                                                <img src={getImageUrl(p.image)} alt={p.name}
                                                    className="w-7 h-7 rounded-lg object-cover shrink-0"
                                                    onError={e => { e.target.style.display = 'none'; }} />
                                            ) : (
                                                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs" style={{ background: `${tk.accent}20`, color: tk.accent }}>
                                                    🏏
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <span className="text-white text-xs font-black truncate block leading-tight">{p.name}</span>
                                                <span className="text-[10px] font-semibold text-white/50 block leading-none">{p.role || 'PLAYER'}</span>
                                            </div>
                                            <span className="text-[11px] font-black font-mono shrink-0" style={{ color: tk.accent }}>₹{FMT(p.sold_price)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-center py-6" style={{ color: tk.dim, opacity: 0.5 }}>
                                        No Players Yet
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main bid lower-third with Centered Player Image & Serial on left ─────────
function OverlayLowerThird({
    theme, currentPlayer, currentBid, leadingTeam, bidFlash, formatIndianNumber,
    showAge = true, showCategory = true, showSerialNo = true
}) {
    const imageUrl = currentPlayer?.image ? getImageUrl(currentPlayer.image) : null;

    return (
        <div className="absolute bottom-0 left-0 right-0 z-20">
            {/* Glow behind the bar */}
            <div
                className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                style={{ background: `linear-gradient(to top, ${theme.overlayGlow}, transparent)` }}
            />

            {/* Main lower-third bar: slim height (88px) with 3-column grid to center the player image */}
            <div
                className="relative grid grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10 py-2 md:py-3"
                style={{
                    background: theme.overlayBarBg,
                    borderTop: `2px solid ${theme.overlayBarBorder}`,
                    minHeight: '120px',
                }}
            >
                {/* Left Column: Chevron + Player Info Section */}
                <div className="flex items-center gap-3 md:gap-4 min-w-0 pr-2 md:pr-4">
                    <ChevronAccent color={theme.overlayAccentLeft} side="left" />

                    <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
                        <span
                            className="text-xs md:text-sm font-black uppercase tracking-[0.2em] truncate"
                            style={{ color: theme.overlayRoleText }}
                        >
                            {currentPlayer.role}
                            {currentPlayer.country ? ` · ${currentPlayer.country}` : ''}
                            {showAge && currentPlayer.age ? ` · Age ${currentPlayer.age}` : ''}
                            {showCategory && currentPlayer.category ? ` · ${currentPlayer.category}` : ''}
                        </span>

                        {/* Serial number badge on the LEFT of player name */}
                        <div className="flex items-center gap-2 min-w-0">
                            {showSerialNo && currentPlayer.serial_number && (
                                <span
                                    className="px-2 py-0.5 rounded text-sm md:text-sm font-black uppercase tracking-wider shrink-0 shadow-md"
                                    style={{
                                        background: theme.overlayBarBorder || '#EAB308',
                                        color: '#000',
                                    }}
                                >
                                    #{currentPlayer.serial_number}
                                </span>
                            )}
                            <h2
                                className="text-2xl md:text-3xl lg:text-4xl font-black uppercase leading-none tracking-tight truncate"
                                style={{ color: theme.overlayPlayerText }}
                            >
                                {currentPlayer.name}
                            </h2>
                        </div>

                        <span
                            className="text-xs md:text-sm font-bold"
                            style={{ color: theme.overlayRoleText, opacity: 0.9 }}
                        >
                            Base: ₹{formatIndianNumber(currentPlayer.base_price)}
                        </span>
                    </div>
                </div>

                {/* Center Column: ENLARGED Player Image Box popping out of the slim bar */}
                <div className="relative self-stretch flex items-center justify-center z-30 w-40 sm:w-48 md:w-52 px-2">
                    <div
                        className="w-40 h-52 sm:w-48 sm:h-60 md:w-52 md:h-64 rounded-2xl overflow-hidden border-2 flex items-center justify-center shadow-[0_12px_35px_rgba(0,0,0,0.85)] absolute bottom-2 md:bottom-3"
                        style={{
                            background: 'rgba(10, 10, 15, 0.94)',
                            borderColor: theme.overlayBarBorder,
                            boxShadow: `0 0 25px ${theme.overlayGlow}`,
                        }}
                    >
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={currentPlayer.name}
                                className="w-full h-full object-cover object-top"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div
                            className={`w-full h-full items-center justify-center text-3xl md:text-4xl ${imageUrl ? 'hidden' : 'flex'}`}
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                            🏏
                        </div>
                    </div>
                </div>

                {/* Right Column: Bid Section + Chevron (Right Aligned) */}
                <div className="flex items-center justify-end gap-3 md:gap-4 min-w-0 pl-2 md:pl-4">
                    <div
                        className={`flex flex-col items-center justify-center px-4 md:px-5 py-1 md:py-1.5 transition-all duration-300 min-w-[200px] md:min-w-[260px] max-w-[320px] rounded-xl ${bidFlash ? 'scale-105' : ''}`}
                        style={{
                            background: theme.overlayBidBg,
                            border: `1px solid ${theme.overlayBarBorder}35`,
                        }}
                    >
                        <span
                            className="text-xs md:text-sm font-black uppercase tracking-[0.25em] mb-0.5 text-center leading-none"
                            style={{ color: theme.overlayRoleText }}
                        >
                            Current Bid
                        </span>
                        <span
                            className={`text-3xl md:text-4xl lg:text-5xl font-black font-mono tracking-tighter leading-tight transition-all duration-300 ${bidFlash ? 'scale-110' : ''}`}
                            style={{ color: bidFlash ? theme.overlayBarBorder : theme.overlayBidText }}
                        >
                            ₹{formatIndianNumber(currentBid)}
                        </span>
                        {leadingTeam ? (
                            <span
                                className="text-sm md:text-base font-black text-center leading-tight break-words max-w-[210px] uppercase line-clamp-2 mt-0.5"
                                style={{ color: theme.overlayLeadText }}
                            >
                                {leadingTeam}
                            </span>
                        ) : (
                            <span
                                className="text-[11px] italic text-center mt-0.5"
                                style={{ color: theme.overlayRoleText, opacity: 0.6 }}
                            >
                                Awaiting bid...
                            </span>
                        )}
                    </div>

                    <ChevronAccent color={theme.overlayAccentRight} side="right" />
                </div>
            </div>
        </div>
    );
}

// ── Chevron decorative element ─────────────────────────────────────────────────
function ChevronAccent({ color, side }) {
    const isLeft = side === 'left';
    return (
        <div className="relative flex-shrink-0 flex items-center" style={{ width: '60px' }}>
            <svg viewBox="0 0 48 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                {isLeft ? (
                    <polygon points="0,0 48,0 30,50 48,100 0,100" fill={color} fillOpacity="0.15" />
                ) : (
                    <polygon points="0,0 48,0 48,100 0,100 18,50" fill={color} fillOpacity="0.15" />
                )}
                {isLeft ? (
                    <polyline points="48,0 30,50 48,100" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
                ) : (
                    <polyline points="0,0 18,50 0,100" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.8" />
                )}
            </svg>
        </div>
    );
}

// ── PurseTicker: bottom-right corner widget cycling team purses ───────────────
function PurseTicker({ data, themeKey }) {
    const tk = getOverlayTokens(themeKey);
    if (!data) return null;
    const { team, index, total } = data;
    const remaining = team.budget || 0;
    const spent = team.totalSpent || 0;
    const totalBudget = remaining + spent;
    const pct = totalBudget > 0 ? Math.max(0, Math.min(100, (remaining / totalBudget) * 100)) : 100;
    const barColor = pct > 50 ? '#22C55E' : pct > 20 ? '#F59E0B' : '#EF4444';
    const barGlow  = pct > 50 ? '0 0 12px #22C55E80' : pct > 20 ? '0 0 12px #F59E0B80' : '0 0 12px #EF444480';

    return (
        <div
            className="absolute bottom-32 right-0 z-40 pointer-events-none"
            style={{ animation: 'purseTickIn 0.45s cubic-bezier(0.34,1.4,0.64,1)' }}
        >
            {/* Accent left border stripe */}
            <div style={{
                position: 'absolute', left: 0, top: '12px', bottom: '12px',
                width: '4px', borderRadius: '0 2px 2px 0',
                background: `linear-gradient(180deg, ${tk.accent}, ${tk.accent}44)`,
                boxShadow: `0 0 12px ${tk.accent}`,
            }} />

            <div
                style={{
                    marginLeft: '4px',
                    minWidth: '340px',
                    maxWidth: '380px',
                    background: tk.barBg,
                    border: `1.5px solid ${tk.accent}55`,
                    borderRight: 'none',
                    borderRadius: '16px 0 0 16px',
                    backdropFilter: 'blur(24px)',
                    boxShadow: `0 16px 60px rgba(0,0,0,0.9), 0 0 0 1px ${tk.accent}15`,
                    padding: '20px 24px 20px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                }}
            >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: tk.accent, boxShadow: `0 0 8px ${tk.accent}` }} />
                        <span style={{ color: tk.accent, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.35em' }}>
                            Live Purse
                        </span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 700 }}>
                        {index} / {total}
                    </span>
                </div>

                {/* Team identity row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {team.logo ? (
                        <img
                            src={getImageUrl(team.logo)} alt={team.name}
                            style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0, border: `2px solid ${tk.accent}70`, boxShadow: `0 0 20px ${tk.accent}40` }}
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 900, background: `${tk.accent}22`, border: `2px solid ${tk.accent}60`, color: tk.accent }}>
                            {(team.name || 'T').charAt(0)}
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {team.name}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700, marginTop: '3px' }}>
                            {team.playersBought || 0} player{(team.playersBought || 0) !== 1 ? 's' : ''} bought
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: `linear-gradient(90deg, ${tk.accent}40, transparent)` }} />

                {/* Budget display */}
                <div>
                    <div style={{ color: tk.accent, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '4px' }}>
                        Remaining Purse
                    </div>
                    <div style={{ color: '#fff', fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.02em', lineHeight: 1, textShadow: `0 0 24px ${tk.accent}60` }}>
                        ₹{Number(remaining).toLocaleString('en-IN')}
                    </div>
                    {spent > 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
                            Spent: ₹{Number(spent).toLocaleString('en-IN')}
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div>
                    <div style={{ width: '100%', height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', background: barColor, boxShadow: barGlow, transition: 'width 0.7s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                        <span style={{ color: barColor, fontSize: '10px', fontWeight: 800 }}>{pct.toFixed(0)}% remaining</span>
                        {totalBudget > 0 && (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 700 }}>of ₹{Number(totalBudget).toLocaleString('en-IN')}</span>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes purseTickIn {
                    from { opacity: 0; transform: translateX(60px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}

// ── OverlaySoldBanner: full-screen sold animation ─────────────────────────────
function OverlaySoldBanner({ anim, themeKey }) {
    const tk = getOverlayTokens(themeKey);
    if (!anim) return null;
    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ animation: 'overlaySoldFadeIn 0.35s ease-out' }}
        >
            {/* Semi-transparent dark veil */}
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} />
            {/* Card */}
            <div
                className="relative flex flex-col items-center gap-4 px-16 py-10 rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
                style={{
                    background: 'rgba(8,8,12,0.95)',
                    border: `2px solid ${tk.accent}`,
                    boxShadow: `0 0 60px ${tk.accent}40`,
                }}
            >
                {/* SOLD badge */}
                <div
                    className="text-xs font-black uppercase tracking-[0.5em] px-6 py-1.5 rounded-full"
                    style={{ background: tk.accent, color: '#000' }}
                >
                    ✦ SOLD ✦
                </div>
                {/* Player name */}
                <div className="text-white font-black text-5xl uppercase tracking-tight text-center drop-shadow-2xl">
                    {anim.playerName}
                </div>
                {/* Divider */}
                <div className="w-24 h-[2px] rounded-full" style={{ background: `${tk.accent}60` }} />
                {/* Team */}
                <div className="flex items-center gap-4">
                    {anim.teamLogo && (
                        <img src={getImageUrl(anim.teamLogo)} alt="" className="w-14 h-14 rounded-full object-cover shadow-lg" style={{ border: `2px solid ${tk.accent}` }} onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    <span className="font-black uppercase text-3xl tracking-wide" style={{ color: tk.accent }}>
                        {anim.teamName || 'A TEAM'}
                    </span>
                </div>
                {/* Price */}
                {anim.price > 0 && (
                    <div className="font-black font-mono text-4xl text-white/90">
                        ₹{Number(anim.price).toLocaleString('en-IN')}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes overlaySoldFadeIn {
                    from { opacity: 0; transform: scale(0.92); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

// ── Main Overlay component ────────────────────────────────────────────────────
function Overlay() {
    const { auctionId: routeAuctionId } = useParams();
    const auctionId = routeAuctionId || getCurrentAuctionId();

    const [socket, setSocket] = useState(null);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [highestBid, setHighestBid] = useState(null);
    const [currentBid, setCurrentBid] = useState(0);
    const [bidFlash, setBidFlash] = useState(false);
    const [leadingTeam, setLeadingTeam] = useState(null);

    // Theme + display mode state
    const [themeKey, setThemeKey] = useState(DEFAULT_THEME);
    const [displayMode, setDisplayMode] = useState('main'); // main | purse | teams
    const [teamPurses, setTeamPurses] = useState([]);

    // Sold animation state
    const [overlaySoldAnim, setOverlaySoldAnim] = useState(null); // { playerName, teamName, teamLogo, price }

    // Purse ticker state
    const [purseTicker, setPurseTicker] = useState(null); // { team, index, total }
    const purseTickerRef = useRef(null);
    const purseTickerAuctionRef = useRef(false); // true while cycling
    const purseTickerLivePursesRef = useRef([]);
    const theme = getTheme(themeKey);

    // UI display toggles — initialized to true (server sends correct state via ui-toggles-updated on connect)
    const [showAge, setShowAge] = useState(true);
    const [showCategory, setShowCategory] = useState(true);
    const [showSerialNo, setShowSerialNo] = useState(true);

    const currentPlayerRef = useRef(null);

    // Keep purseTickerLivePursesRef in sync with teamPurses
    useEffect(() => {
        purseTickerLivePursesRef.current = teamPurses;
    }, [teamPurses]);

    // startPurseCycle: cycles through teams one by one
    const startPurseCycle = (purses) => {
        if (!purses || purses.length === 0) return;
        if (purseTickerAuctionRef.current) return; // already running
        purseTickerAuctionRef.current = true;
        let idx = 0;
        const showNext = () => {
            if (idx >= purses.length) {
                // Cycle done — wait 5 mins then restart
                purseTickerAuctionRef.current = false;
                setPurseTicker(null);
                purseTickerRef.current = setTimeout(() => startPurseCycle(purseTickerLivePursesRef.current), 5 * 60 * 1000);
                return;
            }
            setPurseTicker({ team: purses[idx], index: idx + 1, total: purses.length });
            idx++;
            purseTickerRef.current = setTimeout(showNext, 3000); // 3 sec per team
        };
        showNext();
    };

    // Start the purse cycle 5 mins after mount
    useEffect(() => {
        const timer = setTimeout(() => {
            startPurseCycle(purseTickerLivePursesRef.current);
        }, 5 * 60 * 1000);
        return () => {
            clearTimeout(timer);
            if (purseTickerRef.current) clearTimeout(purseTickerRef.current);
        };
    }, []);

    // ── Preload all player images ─────────────────────────────────────────────
    useEffect(() => {
        const preloadAssets = async () => {
            try {
                const players = await getPublicPlayers();
                if (Array.isArray(players)) {
                    players.forEach(p => {
                        if (p.thumb_url) { const img = new Image(); img.src = getImageUrl(p.thumb_url); }
                        if (p.image) { const img = new Image(); img.src = getImageUrl(p.image); }
                    });
                }
            } catch (e) {
                console.error('Failed to preload overlay assets', e);
            }
        };
        preloadAssets();
    }, [auctionId]);

    // ── Fetch saved broadcast config on mount ─────────────────────────────────
    useEffect(() => {
        getPublicBroadcastConfig().then(cfg => {
            if (cfg && cfg.theme) setThemeKey(cfg.theme);
            if (cfg && cfg.hostDisplayMode) setDisplayMode(cfg.hostDisplayMode);
            if (cfg && cfg.uiToggles) {
                if (cfg.uiToggles.showAge !== undefined) setShowAge(cfg.uiToggles.showAge);
                if (cfg.uiToggles.showCategory !== undefined) setShowCategory(cfg.uiToggles.showCategory);
                if (cfg.uiToggles.showSerialNo !== undefined) setShowSerialNo(cfg.uiToggles.showSerialNo);
            }
        }).catch(() => { });
    }, [auctionId]);

    // ── Fetch team purses ─────────────────────────────────────────────────────
    const refreshTeamPurses = async () => {
        try {
            const data = await getPublicTeamPurses(auctionId);
            if (Array.isArray(data) && data.length > 0) setTeamPurses(data);
        } catch (e) { console.error('overlay: failed to fetch purses', e); }
    };

    useEffect(() => {
        refreshTeamPurses();
    }, [auctionId]);

    // ── Socket setup ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (auctionId) setCurrentAuctionId(auctionId);

        document.body.style.setProperty('background', 'transparent', 'important');
        document.body.classList.add('bg-transparent');

        const newSocket = io(getSocketUrl(auctionId), {
            transports: ['websocket', 'polling'],
            upgrade: true,
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });
        setSocket(newSocket);

        newSocket.onAny((eventName, ...args) => {
            console.log(`[Socket:Overlay] ${eventName}`, JSON.stringify(args).slice(0, 300));
        });

        newSocket.on('connect', () => {
            console.log('[Socket:Overlay] Connected');
            newSocket.emit('request-info');
            refreshTeamPurses();
        });

        newSocket.on('reconnect', () => {
            console.log('[Socket:Overlay] Reconnected — re-requesting state');
            newSocket.emit('request-info');
            refreshTeamPurses();
        });

        newSocket.on('player-loaded', (data) => {
            currentPlayerRef.current = data.player;
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
                if (currentPlayerRef.current) setCurrentBid(currentPlayerRef.current.base_price);
            }
        });

        newSocket.on('all-players-deleted', () => {
            currentPlayerRef.current = null;
            setCurrentPlayer(null);
            setHighestBid(null);
            setCurrentBid(0);
            setLeadingTeam(null);
            refreshTeamPurses();
        });

        // ── Theme change from admin ──────────────────────────────────────────
        newSocket.on('theme-updated', (data) => {
            if (data && data.theme) {
                console.log('[Socket:Overlay] theme-updated →', data.theme);
                setThemeKey(data.theme);
            }
        });

        // ── Host display mode change from admin ──────────────────────────────
        newSocket.on('host-display-mode', (data) => {
            if (data && data.mode) {
                console.log('[Socket:Overlay] host-display-mode →', data.mode);
                setDisplayMode(data.mode);
                if (data.mode === 'purse' || data.mode === 'teams') {
                    refreshTeamPurses();
                }
            }
        });

        // ── UI display toggles from Server (Age, Category, Serial No) ───────────
        newSocket.on('ui-toggles-updated', (data) => {
            if (!data) return;
            console.log('[Socket:Overlay] ui-toggles-updated →', data);
            if (data.showAge !== undefined) setShowAge(data.showAge);
            if (data.showCategory !== undefined) setShowCategory(data.showCategory);
            if (data.showSerialNo !== undefined) setShowSerialNo(data.showSerialNo);
        });

        // ── Real-time Player Sold & Team Purse Updates ────────────────────────
        const handlePlayerSoldUpdate = (data) => {
            if (data && data.soldToTeam && data.soldPrice != null) {
                setTeamPurses(prev => prev.map(t => {
                    if (t.id === data.soldToTeam || t.name === data.soldToTeam) {
                        const newBudget = (t.budget != null) ? Math.max(0, t.budget - Number(data.soldPrice)) : t.budget;
                        const newSpent = (t.totalSpent || 0) + Number(data.soldPrice);
                        const newBought = (t.playersBought || 0) + 1;
                        const currentPlayers = t.players || [];
                        const exists = currentPlayers.some(p => p.id === data.playerId);
                        const updatedPlayers = exists ? currentPlayers : [
                            ...currentPlayers,
                            {
                                id: data.playerId,
                                name: currentPlayerRef.current?.name || 'Player',
                                role: currentPlayerRef.current?.role || 'PLAYER',
                                image: currentPlayerRef.current?.image || null,
                                sold_price: data.soldPrice
                            }
                        ];
                        return {
                            ...t,
                            budget: newBudget,
                            totalSpent: newSpent,
                            playersBought: newBought,
                            players: updatedPlayers
                        };
                    }
                    return t;
                }));
            }
            refreshTeamPurses();
            setTimeout(() => refreshTeamPurses(), 350);
            setTimeout(() => refreshTeamPurses(), 800);
        };

        newSocket.on('player-sold', (data) => {
            handlePlayerSoldUpdate(data);
            if (data && data.soldPrice > 0) {
                setOverlaySoldAnim({
                    playerName: currentPlayerRef.current?.name || 'Player',
                    teamName: data.soldToTeamName || '',
                    teamLogo: data.soldToTeamLogo || null,
                    price: data.soldPrice || 0,
                });
                setTimeout(() => setOverlaySoldAnim(null), 3500);
            }
        });

        newSocket.on('player-marked', (data) => {
            console.log('[Socket:Overlay] player-marked', data);
            if (data && data.status === 'SOLD') {
                handlePlayerSoldUpdate(data);
            } else {
                refreshTeamPurses();
                setTimeout(() => refreshTeamPurses(), 350);
            }
        });

        newSocket.on('team-budget-updated', (data) => {
            if (data && data.teamId != null) {
                setTeamPurses(prev => prev.map(t => (String(t.id) === String(data.teamId) || t.name === data.teamId) ? { ...t, budget: data.newBudget } : t));
            }
            refreshTeamPurses();
            setTimeout(() => refreshTeamPurses(), 350);
        });

        newSocket.on('player-removed-from-team', () => {
            refreshTeamPurses();
            setTimeout(() => refreshTeamPurses(), 350);
        });

        newSocket.on('trading-window-update', () => {
            refreshTeamPurses();
            setTimeout(() => refreshTeamPurses(), 350);
        });

        newSocket.on('team-updated', () => {
            refreshTeamPurses();
        });

        return () => {
            newSocket.close();
            document.body.style.removeProperty('background');
            document.body.classList.remove('bg-transparent');
        };
    }, []);

    const flashBid = () => {
        setBidFlash(true);
        setTimeout(() => setBidFlash(false), 500);
    };

    const formatIndianNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('en-IN');
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-screen w-screen overflow-hidden font-sans bg-transparent relative">
            <TradingWindowBanner socket={socket} />

            {/* ezAuction logo — always top right */}
            <div className="absolute top-6 right-8 z-30">
                <img src="/ezauction.png" alt="EzAuction" className="h-10 object-contain drop-shadow-lg" />
            </div>

            {/* ── MODE: purse ── */}
            {displayMode === 'purse' && (
                <OverlayPurse teamPurses={teamPurses} theme={theme} themeKey={themeKey} />
            )}

            {/* ── MODE: teams ── */}
            {displayMode === 'teams' && (
                <OverlayTeams teamPurses={teamPurses} theme={theme} themeKey={themeKey} />
            )}

            {/* ── MODE: main — standard lower-third ── */}
            {displayMode === 'main' && currentPlayer && (
                <OverlayLowerThird
                    theme={theme}
                    currentPlayer={currentPlayer}
                    currentBid={currentBid}
                    leadingTeam={leadingTeam}
                    bidFlash={bidFlash}
                    formatIndianNumber={formatIndianNumber}
                    showAge={showAge}
                    showCategory={showCategory}
                    showSerialNo={showSerialNo}
                />
            )}

            {/* Waiting state for main mode with no player */}
            {displayMode === 'main' && !currentPlayer && (
                <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center z-20">
                    <div className="text-white text-2xl font-bold uppercase tracking-widest animate-pulse opacity-40">
                        Waiting for Auction...
                    </div>
                </div>
            )}

            {displayMode === 'main' && <PurseTicker data={purseTicker} themeKey={themeKey} />}
            <OverlaySoldBanner anim={overlaySoldAnim} themeKey={themeKey} />

        </div>
    );
}

export default Overlay;
