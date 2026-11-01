import React, { useEffect, useRef } from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

function getTokens(themeKey) {
  switch (themeKey) {
    case 'navy_gold': return {
      bg: '#071630',
      bgGradient: 'linear-gradient(160deg, #071630 0%, #0b2151 50%, #071630 100%)',
      bgCard: 'rgba(13,27,62,0.88)',
      bgCardStrong: 'rgba(18,35,80,0.97)',
      accent: '#C9A84C',
      accentRgb: '201,168,76',
      accentSoft: 'rgba(201,168,76,0.12)',
      text: '#FFFFFF',
      textDim: 'rgba(255,255,255,0.45)',
      border: 'rgba(201,168,76,0.22)',
      borderStrong: 'rgba(201,168,76,0.55)',
      rankGold: '#C9A84C',
      rankSilver: '#9BA8C0',
      rankBronze: '#C07A3C',
      shimmerA: 'rgba(201,168,76,0.06)',
      shimmerB: 'rgba(201,168,76,0.14)',
      isLight: false,
    };
    case 'blue_brush': return {
      bg: '#DDE6F7',
      bgGradient: 'linear-gradient(160deg, #c8d8f5 0%, #dde6f7 50%, #c8d8f5 100%)',
      bgCard: 'rgba(255,255,255,0.88)',
      bgCardStrong: 'rgba(255,255,255,0.98)',
      accent: '#0047CC',
      accentRgb: '0,71,204',
      accentSoft: 'rgba(0,71,204,0.08)',
      text: '#061E4E',
      textDim: 'rgba(6,30,78,0.5)',
      border: 'rgba(0,71,204,0.15)',
      borderStrong: 'rgba(0,71,204,0.45)',
      rankGold: '#B8860B',
      rankSilver: '#556080',
      rankBronze: '#7B3A1A',
      shimmerA: 'rgba(0,71,204,0.04)',
      shimmerB: 'rgba(0,71,204,0.1)',
      isLight: true,
    };
    case 'dark_teal': return {
      bg: '#040E10',
      bgGradient: 'linear-gradient(160deg, #040e10 0%, #081c20 50%, #040e10 100%)',
      bgCard: 'rgba(6,26,30,0.85)',
      bgCardStrong: 'rgba(10,38,44,0.97)',
      accent: '#0CCFBE',
      accentRgb: '12,207,190',
      accentSoft: 'rgba(12,207,190,0.1)',
      text: '#FFFFFF',
      textDim: 'rgba(255,255,255,0.4)',
      border: 'rgba(12,207,190,0.2)',
      borderStrong: 'rgba(12,207,190,0.5)',
      rankGold: '#0CCFBE',
      rankSilver: '#6BBFBA',
      rankBronze: '#3A9990',
      shimmerA: 'rgba(12,207,190,0.05)',
      shimmerB: 'rgba(12,207,190,0.12)',
      isLight: false,
    };
    default: return {
      bg: '#0A0A0A',
      bgGradient: 'linear-gradient(160deg, #0a0a0a 0%, #141008 50%, #0a0a0a 100%)',
      bgCard: 'rgba(18,18,18,0.88)',
      bgCardStrong: 'rgba(26,22,8,0.97)',
      accent: '#D4AF37',
      accentRgb: '212,175,55',
      accentSoft: 'rgba(212,175,55,0.1)',
      text: '#FFFFFF',
      textDim: 'rgba(255,255,255,0.4)',
      border: 'rgba(212,175,55,0.2)',
      borderStrong: 'rgba(212,175,55,0.5)',
      rankGold: '#D4AF37',
      rankSilver: '#B0B0B0',
      rankBronze: '#CD7F32',
      shimmerA: 'rgba(212,175,55,0.05)',
      shimmerB: 'rgba(212,175,55,0.12)',
      isLight: false,
    };
  }
}

const RANK_LABEL = ['🥇', '🥈', '🥉'];

const ROLE_COLORS = {
  BATSMAN:       { bg: 'rgba(59,130,246,0.18)',  color: '#60A5FA', border: 'rgba(59,130,246,0.4)' },
  BOWLER:        { bg: 'rgba(239,68,68,0.15)',   color: '#F87171', border: 'rgba(239,68,68,0.4)'  },
  ALLROUNDER:    { bg: 'rgba(168,85,247,0.15)',  color: '#C084FC', border: 'rgba(168,85,247,0.4)' },
  'ALL-ROUNDER': { bg: 'rgba(168,85,247,0.15)',  color: '#C084FC', border: 'rgba(168,85,247,0.4)' },
  WICKETKEEPER:  { bg: 'rgba(16,185,129,0.15)',  color: '#34D399', border: 'rgba(16,185,129,0.4)' },
  WK:            { bg: 'rgba(16,185,129,0.15)',  color: '#34D399', border: 'rgba(16,185,129,0.4)' },
  DEFAULT:       { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.2)' },
};

function getRoleStyle(role, isLight) {
  if (!role) return isLight
    ? { bg: 'rgba(0,0,0,0.06)', color: 'rgba(6,30,78,0.5)', border: 'rgba(0,0,0,0.12)' }
    : ROLE_COLORS.DEFAULT;
  const key = role.toUpperCase().replace(/\s+/g, '-');
  return ROLE_COLORS[key] || (isLight
    ? { bg: 'rgba(0,0,0,0.06)', color: 'rgba(6,30,78,0.5)', border: 'rgba(0,0,0,0.12)' }
    : ROLE_COLORS.DEFAULT);
}

export default function HostTopPlayersView({ players, themeKey, topPlayersCount, getImageUrl }) {
  const tk = getTokens(themeKey);
  const containerRef = useRef(null);
  const limit = topPlayersCount || 10;
  const shown = (players || []).slice(0, limit);
  const isTop5 = limit <= 5;

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('.elite-card');
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = isTop5 ? 'translateY(32px) scale(0.96)' : 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = `opacity 0.5s ease ${i * 80}ms, transform 0.5s cubic-bezier(0.23,1,0.32,1) ${i * 80}ms`;
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
      }, 40);
    });
  }, [players, limit]);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: tk.bgGradient, fontFamily: "'Inter', 'Outfit', sans-serif" }}
    >
      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[40vh] rounded-full blur-[140px] opacity-[0.1]"
          style={{ background: `radial-gradient(circle, ${tk.accent} 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-0 right-0 w-[35vw] h-[25vh] rounded-full blur-[100px] opacity-[0.06]"
          style={{ background: `radial-gradient(circle, ${tk.accent} 0%, transparent 70%)` }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 shrink-0 flex flex-col items-center pt-5 pb-3 px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-14 opacity-40" style={{ background: tk.accent }} />
          <span className="font-black uppercase tracking-[0.5em] text-[9px]" style={{ color: tk.accent }}>
            Live Broadcast
          </span>
          <div className="h-px w-14 opacity-40" style={{ background: tk.accent }} />
        </div>
        <h2
          className="font-black uppercase leading-none text-center"
          style={{
            color: tk.isLight ? '#061E4E' : '#FFFFFF',
            fontSize: 'clamp(1.7rem, 3.8vw, 3rem)',
            letterSpacing: '-0.025em',
          }}
        >
          🏆 Elite <span style={{ color: tk.accent }}>Leaderboard</span>
        </h2>
        <p className="mt-1 font-bold uppercase tracking-[0.3em] text-[10px]" style={{ color: tk.textDim }}>
          Top {limit} Highest Sold Players
        </p>
        <div
          className="mt-3 h-[2px] w-28 rounded-full opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${tk.accent}, transparent)` }}
        />
      </div>

      {/* Players area */}
      <div
        ref={containerRef}
        className="relative z-10 flex-1 overflow-y-auto pb-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ opacity: 0.4 }}>
            <span style={{ fontSize: '5rem' }}>🏆</span>
            <p className="font-black uppercase tracking-[0.3em] text-sm animate-pulse" style={{ color: tk.accent }}>
              No players sold yet…
            </p>
          </div>
        ) : isTop5 ? (
          /* ─── TOP-5: Portrait gallery ─── */
          <div className="h-full flex items-center justify-center px-4 md:px-8">
            <div className="w-full max-w-[1400px] grid gap-3 md:gap-4" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
              {shown.map((player, idx) => (
                <PortraitCard
                  key={player.id}
                  player={player}
                  rank={idx + 1}
                  tk={tk}
                  getImageUrl={getImageUrl}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ─── TOP-10: Wide horizontal cards ─── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4 md:px-6 max-w-[1400px] mx-auto pt-1">
            {shown.map((player, idx) => (
              <HorizontalCard
                key={player.id}
                player={player}
                rank={idx + 1}
                tk={tk}
                getImageUrl={getImageUrl}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   PORTRAIT CARD  (Top-5 gallery)
   Tall card: big photo (top 60%), info below
───────────────────────────────────────────────────── */
function PortraitCard({ player, rank, tk, getImageUrl }) {
  const roleStyle = getRoleStyle(player.role, tk.isLight);
  const isTop3 = rank <= 3;
  const rankColor =
    rank === 1 ? tk.rankGold :
    rank === 2 ? tk.rankSilver :
    rank === 3 ? tk.rankBronze : tk.accent;

  return (
    <div
      className="elite-card relative flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: tk.bgCardStrong,
        border: `1.5px solid ${isTop3 ? rankColor + '70' : tk.border}`,
        boxShadow: isTop3
          ? `0 0 40px ${rankColor}30, 0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px ${rankColor}18`
          : `0 4px 20px rgba(0,0,0,0.4)`,
        minHeight: '340px',
      }}
    >
      {/* Top-3 shimmer sweep */}
      {isTop3 && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: `linear-gradient(135deg, ${rankColor}10 0%, transparent 40%, ${rankColor}08 100%)`,
          }}
        />
      )}

      {/* Rank badge — top-left */}
      <div
        className="absolute top-3 left-3 z-20 flex items-center justify-center rounded-full"
        style={{
          width: 38,
          height: 38,
          background: isTop3 ? rankColor : tk.bgCard,
          border: `1.5px solid ${isTop3 ? rankColor : tk.border}`,
          boxShadow: isTop3 ? `0 0 14px ${rankColor}60` : 'none',
        }}
      >
        {rank <= 3 ? (
          <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{RANK_LABEL[rank - 1]}</span>
        ) : (
          <span
            className="font-black tabular-nums leading-none"
            style={{ color: tk.isLight ? '#061E4E' : '#fff', fontSize: '0.9rem' }}
          >
            #{rank}
          </span>
        )}
      </div>

      {/* Photo — 60% of card height */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          height: '58%',
          minHeight: 190,
          background: `linear-gradient(180deg, ${rankColor}10 0%, rgba(0,0,0,0.2) 100%)`,
        }}
      >
        {player.image ? (
          <img
            src={getImageUrl(player.image)}
            alt={player.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              display: 'block',
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.parentNode) {
                e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:900;color:${rankColor}">${player.name?.charAt(0) || '?'}</div>`;
              }
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '3rem', fontWeight: 900, color: rankColor,
          }}>
            {player.name?.charAt(0) || '?'}
          </div>
        )}
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12"
          style={{ background: `linear-gradient(transparent, ${tk.bgCardStrong})` }}
        />
      </div>

      {/* Info — bottom 40% */}
      <div className="flex flex-col items-center justify-between flex-1 px-3 pt-2 pb-4 gap-1.5">
        <div
          className="font-black text-center leading-tight w-full truncate"
          style={{ color: tk.text, fontSize: 'clamp(0.8rem, 1.4vw, 1.1rem)' }}
          title={player.name}
        >
          {player.name}
        </div>

        {/* Role + team */}
        <div className="flex flex-col items-center gap-1 w-full">
          {player.role && (
            <span
              className="font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                background: roleStyle.bg,
                color: roleStyle.color,
                border: `1px solid ${roleStyle.border}`,
              }}
            >
              {player.role}
            </span>
          )}
          {player.teams?.name && (
            <span
              className="font-semibold text-[9px] uppercase tracking-wide truncate max-w-full"
              style={{ color: tk.textDim }}
            >
              {player.teams.name}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex flex-col items-center">
          <div
            className="font-black tabular-nums leading-none"
            style={{
              color: rankColor,
              fontSize: 'clamp(0.95rem, 1.6vw, 1.35rem)',
              textShadow: isTop3 ? `0 0 16px ${rankColor}66` : 'none',
              fontFamily: 'monospace',
            }}
          >
            ₹{FMT(player.sold_price)}
          </div>
          <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: tk.textDim }}>
            SOLD
          </span>
        </div>
      </div>

      {/* Accent bottom line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, transparent, ${rankColor}, transparent)`, opacity: isTop3 ? 0.7 : 0.3 }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   HORIZONTAL CARD  (Top-10 grid)
   Wide card: big square photo left, info right
───────────────────────────────────────────────────── */
function HorizontalCard({ player, rank, tk, getImageUrl }) {
  const roleStyle = getRoleStyle(player.role, tk.isLight);
  const isTop3 = rank <= 3;
  const rankColor =
    rank === 1 ? tk.rankGold :
    rank === 2 ? tk.rankSilver :
    rank === 3 ? tk.rankBronze : tk.accent;
  const PHOTO = 88;

  return (
    <div
      className="elite-card relative flex items-center gap-4 rounded-2xl overflow-hidden"
      style={{
        background: tk.bgCardStrong,
        border: `1.5px solid ${isTop3 ? rankColor + '70' : tk.border}`,
        boxShadow: isTop3
          ? `0 0 32px ${rankColor}28, 0 4px 16px rgba(0,0,0,0.45), inset 0 0 0 1px ${rankColor}15`
          : `0 3px 14px rgba(0,0,0,0.35)`,
        padding: '14px 16px',
        minHeight: `${PHOTO + 28}px`,
      }}
    >
      {/* Top-3 shimmer */}
      {isTop3 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${rankColor}09 0%, transparent 45%, ${rankColor}05 100%)` }}
        />
      )}

      {/* Rank */}
      <div className="shrink-0 flex flex-col items-center justify-center" style={{ minWidth: 48 }}>
        {rank <= 3 ? (
          <span style={{ fontSize: '2rem', lineHeight: 1 }}>{RANK_LABEL[rank - 1]}</span>
        ) : (
          <div
            className="font-black tabular-nums leading-none"
            style={{ color: rankColor, fontSize: '1.7rem', fontFamily: 'monospace' }}
          >
            #{rank}
          </div>
        )}
      </div>

      {/* Photo */}
      <div
        className="shrink-0 rounded-xl overflow-hidden"
        style={{
          width: PHOTO,
          height: PHOTO,
          border: `2px solid ${isTop3 ? rankColor + '80' : tk.border}`,
          background: tk.accentSoft,
          boxShadow: isTop3 ? `0 0 18px ${rankColor}40` : 'none',
          flexShrink: 0,
        }}
      >
        {player.image ? (
          <img
            src={getImageUrl(player.image)}
            alt={player.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.parentNode) {
                e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:${rankColor}">${player.name?.charAt(0) || '?'}</div>`;
              }
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', fontWeight: 900, color: rankColor,
          }}>
            {player.name?.charAt(0) || '?'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className="font-black leading-tight truncate"
          style={{ color: tk.text, fontSize: 'clamp(0.9rem, 1.4vw, 1.1rem)' }}
        >
          {player.name}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {player.age && (
            <span className="font-bold text-[10px] uppercase tracking-wide" style={{ color: tk.textDim }}>
              Age {player.age}
            </span>
          )}
          {player.role && (
            <span
              className="font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.border}` }}
            >
              {player.role}
            </span>
          )}
        </div>
        {player.teams?.name && (
          <span className="font-semibold text-[9px] uppercase tracking-wide truncate block mt-1 max-w-[120px]" style={{ color: tk.textDim }}>
            → {player.teams.name}
          </span>
        )}
      </div>

      {/* Sold price */}
      <div className="shrink-0 flex flex-col items-end">
        <div
          className="font-black tabular-nums leading-none"
          style={{
            color: isTop3 ? rankColor : tk.accent,
            fontSize: 'clamp(1.1rem, 1.8vw, 1.45rem)',
            fontFamily: 'monospace',
            textShadow: isTop3 ? `0 0 14px ${rankColor}55` : 'none',
          }}
        >
          ₹{FMT(player.sold_price)}
        </div>
        <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: tk.textDim }}>
          SOLD
        </span>
      </div>

      {/* Bottom accent stripe */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2.5px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${rankColor}, transparent)`,
          opacity: isTop3 ? 0.65 : 0.25,
        }}
      />
    </div>
  );
}
