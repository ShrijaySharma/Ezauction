import React, { useEffect, useRef } from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

function getTokens(themeKey) {
  switch (themeKey) {
    case 'navy_gold': return {
      bg: '#071630',
      bgCard: 'rgba(13,27,62,0.92)',
      bgCardHover: 'rgba(20,40,90,0.95)',
      accent: '#C9A84C',
      accentRgb: '201,168,76',
      text: '#FFFFFF',
      textDim: 'rgba(255,255,255,0.45)',
      border: 'rgba(201,168,76,0.3)',
      rankGold: '#C9A84C',
      rankSilver: '#9BA8C0',
      rankBronze: '#C07A3C',
      isLight: false,
    };
    case 'blue_brush': return {
      bg: '#EFF3FB',
      bgCard: 'rgba(255,255,255,0.95)',
      bgCardHover: 'rgba(240,248,255,0.98)',
      accent: '#0047CC',
      accentRgb: '0,71,204',
      text: '#061E4E',
      textDim: 'rgba(6,30,78,0.5)',
      border: 'rgba(0,71,204,0.18)',
      rankGold: '#B8860B',
      rankSilver: '#607090',
      rankBronze: '#8B4513',
      isLight: true,
    };
    case 'dark_teal': return {
      bg: '#040E10',
      bgCard: 'rgba(6,26,30,0.88)',
      bgCardHover: 'rgba(10,40,46,0.95)',
      accent: '#0CCFBE',
      accentRgb: '12,207,190',
      text: '#FFFFFF',
      textDim: 'rgba(255,255,255,0.4)',
      border: 'rgba(12,207,190,0.25)',
      rankGold: '#0CCFBE',
      rankSilver: '#6BBFBA',
      rankBronze: '#3A9990',
      isLight: false,
    };
    default: return {
      bg: '#0A0A0A',
      bgCard: 'rgba(18,18,18,0.92)',
      bgCardHover: 'rgba(28,24,10,0.96)',
      accent: '#D4AF37',
      accentRgb: '212,175,55',
      text: '#FFFFFF',
      textDim: 'rgba(255,255,255,0.4)',
      border: 'rgba(212,175,55,0.25)',
      rankGold: '#D4AF37',
      rankSilver: '#B0B0B0',
      rankBronze: '#CD7F32',
      isLight: false,
    };
  }
}

const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

const ROLE_COLORS = {
  BATSMAN:      { bg: 'rgba(59,130,246,0.18)',  color: '#60A5FA', border: 'rgba(59,130,246,0.4)' },
  BOWLER:       { bg: 'rgba(239,68,68,0.15)',   color: '#F87171', border: 'rgba(239,68,68,0.4)' },
  ALLROUNDER:   { bg: 'rgba(168,85,247,0.15)',  color: '#C084FC', border: 'rgba(168,85,247,0.4)' },
  'ALL-ROUNDER':{ bg: 'rgba(168,85,247,0.15)',  color: '#C084FC', border: 'rgba(168,85,247,0.4)' },
  WICKETKEEPER: { bg: 'rgba(16,185,129,0.15)',  color: '#34D399', border: 'rgba(16,185,129,0.4)' },
  WK:           { bg: 'rgba(16,185,129,0.15)',  color: '#34D399', border: 'rgba(16,185,129,0.4)' },
  DEFAULT:      { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.2)' },
};

function getRoleStyle(role) {
  if (!role) return ROLE_COLORS.DEFAULT;
  const key = role.toUpperCase().replace(/\s+/g, '-');
  return ROLE_COLORS[key] || ROLE_COLORS.DEFAULT;
}

export default function HostTopPlayersView({ players, themeKey, topPlayersCount, getImageUrl }) {
  const tk = getTokens(themeKey);
  const containerRef = useRef(null);
  const limit = topPlayersCount || 10;
  const shown = (players || []).slice(0, limit);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('.elite-card');
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      setTimeout(() => {
        card.style.transition = `opacity 0.45s ease ${i * 60}ms, transform 0.45s cubic-bezier(0.23,1,0.32,1) ${i * 60}ms`;
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 30);
    });
  }, [players, limit]);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: tk.bg, fontFamily: "'Inter', 'Outfit', sans-serif" }}
    >
      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[35vh] rounded-full blur-[120px] opacity-[0.08]"
          style={{ background: `radial-gradient(circle, ${tk.accent} 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-0 right-0 w-[30vw] h-[20vh] rounded-full blur-[80px] opacity-[0.05]"
          style={{ background: `radial-gradient(circle, ${tk.accent} 0%, transparent 70%)` }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 shrink-0 flex flex-col items-center pt-6 pb-3 px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-px w-12 opacity-40" style={{ background: tk.accent }} />
          <span className="font-black uppercase tracking-[0.5em] text-[9px]" style={{ color: tk.accent }}>
            Live Broadcast
          </span>
          <div className="h-px w-12 opacity-40" style={{ background: tk.accent }} />
        </div>
        <h2
          className="font-black uppercase leading-none text-center"
          style={{
            color: tk.isLight ? '#061E4E' : '#FFFFFF',
            fontSize: 'clamp(1.6rem, 3.5vw, 2.8rem)',
            letterSpacing: '-0.025em',
          }}
        >
          🏆 Elite <span style={{ color: tk.accent }}>Leaderboard</span>
        </h2>
        <p className="mt-1 font-bold uppercase tracking-[0.3em] text-[10px]" style={{ color: tk.textDim }}>
          Top {limit} Highest Sold Players
        </p>
        <div
          className="mt-3 h-[2px] w-24 rounded-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${tk.accent}, transparent)` }}
        />
      </div>

      {/* Players list */}
      <div
        ref={containerRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 pb-6"
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`.scrollbar-none-el::-webkit-scrollbar { display: none; }`}</style>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ opacity: 0.4 }}>
            <span style={{ fontSize: '4rem' }}>🏆</span>
            <p className="font-black uppercase tracking-[0.3em] text-sm animate-pulse" style={{ color: tk.accent }}>
              No players sold yet…
            </p>
          </div>
        ) : limit <= 5 ? (
          <div className="grid grid-cols-1 gap-3 md:gap-4 max-w-4xl mx-auto">
            {shown.map((player, idx) => (
              <PlayerCard key={player.id} player={player} rank={idx + 1} tk={tk} getImageUrl={getImageUrl} large />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-6xl mx-auto">
            {shown.map((player, idx) => (
              <PlayerCard key={player.id} player={player} rank={idx + 1} tk={tk} getImageUrl={getImageUrl} large={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ player, rank, tk, getImageUrl, large }) {
  const roleStyle = getRoleStyle(player.role);
  const isTop3 = rank <= 3;
  const rankEmoji = RANK_EMOJIS[rank - 1] || null;
  const rankColor =
    rank === 1 ? tk.rankGold :
    rank === 2 ? tk.rankSilver :
    rank === 3 ? tk.rankBronze : tk.textDim;

  return (
    <div
      className="elite-card relative flex items-center gap-3 md:gap-4 rounded-2xl border overflow-hidden"
      style={{
        background: tk.bgCard,
        borderColor: isTop3 ? rankColor + '80' : tk.border,
        boxShadow: isTop3 ? `0 0 28px ${rankColor}22, inset 0 0 0 1px ${rankColor}18` : '0 2px 12px rgba(0,0,0,0.3)',
        padding: large ? '16px 18px' : '12px 14px',
      }}
    >
      {/* Rank */}
      <div className="shrink-0 flex flex-col items-center justify-center" style={{ minWidth: large ? 52 : 40 }}>
        {rankEmoji ? (
          <span style={{ fontSize: large ? '2rem' : '1.5rem', lineHeight: 1 }}>{rankEmoji}</span>
        ) : (
          <div
            className="font-black tabular-nums leading-none"
            style={{ color: rankColor, fontSize: large ? '1.8rem' : '1.3rem', fontFamily: 'monospace' }}
          >
            #{rank}
          </div>
        )}
      </div>

      {/* Photo */}
      <div
        className="shrink-0 rounded-xl overflow-hidden border-2"
        style={{
          width: large ? 72 : 56,
          height: large ? 72 : 56,
          borderColor: isTop3 ? rankColor + '80' : tk.border,
          background: 'rgba(255,255,255,0.05)',
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
                e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:${tk.accent}">${player.name?.charAt(0) || '?'}</div>`;
              }
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: large ? '1.6rem' : '1.2rem', fontWeight: 900, color: tk.accent }}>
            {player.name?.charAt(0) || '?'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-black truncate leading-tight" style={{ color: tk.text, fontSize: large ? '1.05rem' : '0.875rem' }}>
          {player.name}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
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
          {player.teams?.name && (
            <span className="font-semibold text-[9px] uppercase tracking-wide truncate max-w-[90px]" style={{ color: tk.textDim }}>
              → {player.teams.name}
            </span>
          )}
        </div>
      </div>

      {/* Sold price */}
      <div className="shrink-0 flex flex-col items-end">
        <div
          className="font-black tabular-nums leading-none"
          style={{
            color: isTop3 ? rankColor : tk.accent,
            fontSize: large ? '1.25rem' : '1rem',
            fontFamily: 'monospace',
            textShadow: isTop3 ? `0 0 12px ${rankColor}55` : 'none',
          }}
        >
          ₹{FMT(player.sold_price)}
        </div>
        <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: tk.textDim }}>
          SOLD
        </span>
      </div>

      {/* Top-3 ambient overlay */}
      {isTop3 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${rankColor}08 0%, transparent 50%, ${rankColor}04 100%)` }}
        />
      )}
    </div>
  );
}
