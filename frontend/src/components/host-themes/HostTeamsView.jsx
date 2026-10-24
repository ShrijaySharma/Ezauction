import React, { useState } from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

function getTokens(themeKey) {
  switch (themeKey) {
    case 'navy_gold': return {
      bg: '#071630', accent: '#C9A84C', accentRgb: '201,168,76',
      cardBg: 'rgba(13,27,62,0.85)', cardBorder: 'rgba(201,168,76,0.3)',
      label: 'rgba(201,168,76,0.7)', textDim: 'rgba(255,255,255,0.45)',
      rolePill: { background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' },
      isLight: false
    };
    case 'blue_brush': return {
      bg: '#EFF3FB', accent: '#0047CC', accentRgb: '0,71,204',
      cardBg: 'rgba(255,255,255,0.92)', cardBorder: 'rgba(0,71,204,0.15)',
      label: 'rgba(0,71,204,0.65)', textDim: 'rgba(6,30,78,0.5)',
      rolePill: { background: 'rgba(0,71,204,0.1)', color: '#0047CC', border: '1px solid rgba(0,71,204,0.3)' },
      isLight: true
    };
    case 'dark_teal': return {
      bg: '#040E10', accent: '#0CCFBE', accentRgb: '12,207,190',
      cardBg: 'rgba(6,26,30,0.8)', cardBorder: 'rgba(12,207,190,0.25)',
      label: 'rgba(12,207,190,0.7)', textDim: 'rgba(255,255,255,0.4)',
      rolePill: { background: 'rgba(12,207,190,0.12)', color: '#0CCFBE', border: '1px solid rgba(12,207,190,0.3)' },
      isLight: false
    };
    default: return { // black_gold
      bg: '#0A0A0A', accent: '#D4AF37', accentRgb: '212,175,55',
      cardBg: 'rgba(18,18,18,0.85)', cardBorder: 'rgba(212,175,55,0.25)',
      label: 'rgba(212,175,55,0.7)', textDim: 'rgba(255,255,255,0.4)',
      rolePill: { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' },
      isLight: false
    };
  }
}

export default function HostTeamsView({ teamPurses, themeKey, getImageUrl }) {
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const tk = getTokens(themeKey);

  if (!teamPurses || teamPurses.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: tk.bg }}>
        <p className="text-4xl font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: tk.accent, opacity: 0.4 }}>
          Loading Teams…
        </p>
      </div>
    );
  }

  const activeId = selectedTeamId || teamPurses[0]?.id;
  const displayTeam = teamPurses.find(t => t.id === activeId) || teamPurses[0];
  const squad = displayTeam?.players || [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: tk.bg, fontFamily: "'Inter', sans-serif" }}>

      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50vw] h-[30vh] rounded-full blur-[100px] opacity-10"
          style={{ background: `radial-gradient(circle, ${tk.accent} 0%, transparent 70%)` }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 shrink-0 flex flex-col items-center pt-5 pb-3 px-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-10 opacity-50" style={{ background: tk.accent }} />
          <span className="font-black uppercase tracking-[0.4em] text-[10px]" style={{ color: tk.accent }}>Live Broadcast</span>
          <div className="h-px w-10 opacity-50" style={{ background: tk.accent }} />
        </div>
        <h2 className="font-black uppercase leading-none" style={{ color: tk.isLight ? '#061E4E' : '#FFFFFF', fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', letterSpacing: '-0.02em' }}>
          Team <span style={{ color: tk.accent }}>Squads</span>
        </h2>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-1 min-h-0 gap-4 px-4 md:px-6 pb-5">

        {/* Left — Team selector */}
        <div className="flex flex-col gap-2 overflow-y-auto scrollbar-none shrink-0" style={{ width: '220px' }}>
          {teamPurses.map((team, i) => {
            const isActive = activeId === team.id;
            return (
              <button
                key={team.id || i}
                onClick={() => setSelectedTeamId(team.id)}
                className="flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 w-full"
                style={{
                  background: isActive ? `${tk.accent}20` : tk.cardBg,
                  border: `1.5px solid ${isActive ? tk.accent : tk.cardBorder}`,
                  backdropFilter: 'blur(20px)',
                  boxShadow: isActive ? `0 0 20px rgba(${tk.accentRgb},0.2)` : 'none'
                }}
              >
                {team.logo ? (
                  <img src={getImageUrl(team.logo)} alt={team.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                    style={{ border: `1.5px solid ${isActive ? tk.accent : 'rgba(255,255,255,0.1)'}` }}
                    onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-black"
                    style={{ background: `${tk.accent}20`, color: tk.accent, fontSize: '1.1rem' }}>
                    {(team.name || 'T').charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-black text-xs truncate" style={{ color: tk.isLight ? '#061E4E' : '#FFF' }}>{team.name}</div>
                  <div className="text-[10px] font-bold opacity-60 mt-0.5" style={{ color: tk.isLight ? '#061E4E' : '#FFF' }}>
                    {(team.players || []).length} players
                  </div>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tk.accent }} />}
              </button>
            );
          })}
        </div>

        {/* Right — Squad panel */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">

          {/* Team header strip */}
          <div className="shrink-0 rounded-2xl border overflow-hidden"
            style={{ background: tk.cardBg, borderColor: tk.cardBorder, backdropFilter: 'blur(20px)' }}>
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${tk.accent}, transparent)` }} />
            <div className="flex items-center gap-4 px-6 py-4">
              {displayTeam.logo ? (
                <img src={getImageUrl(displayTeam.logo)} alt={displayTeam.name}
                  className="w-16 h-16 rounded-2xl object-cover shadow-xl"
                  style={{ border: `2px solid ${tk.accent}60` }}
                  onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl"
                  style={{ background: `${tk.accent}20`, color: tk.accent }}>
                  {(displayTeam.name || 'T').charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-xl md:text-2xl truncate" style={{ color: tk.isLight ? '#061E4E' : '#FFFFFF' }}>
                  {displayTeam.name}
                </h3>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <span className="text-xs font-black uppercase" style={{ color: tk.accent }}>
                    {squad.length} Players
                  </span>
                  <span className="text-xs font-bold" style={{ color: tk.textDim }}>
                    Budget Remaining: <span className="font-black" style={{ color: tk.accent }}>₹{FMT(displayTeam.budget)}</span>
                  </span>
                  {displayTeam.totalSpent > 0 && (
                    <span className="text-xs font-bold" style={{ color: tk.textDim }}>
                      Spent: <span className="text-rose-400 font-black">₹{FMT(displayTeam.totalSpent)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Players grid */}
          {squad.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl border"
              style={{ background: tk.cardBg, borderColor: tk.cardBorder }}>
              <p className="font-black uppercase tracking-[0.3em] text-sm animate-pulse" style={{ color: tk.label }}>
                No Players Yet
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-none">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {squad.map((player, i) => (
                  <div
                    key={player.id || i}
                    className="rounded-xl border overflow-hidden flex flex-col transition-transform hover:scale-[1.02]"
                    style={{ background: tk.cardBg, borderColor: tk.cardBorder, backdropFilter: 'blur(16px)' }}
                  >
                    {/* Player image area */}
                    <div className="relative overflow-hidden flex items-center justify-center"
                      style={{ height: '140px', background: `linear-gradient(180deg, ${tk.accent}15 0%, ${tk.accent}05 100%)` }}>
                      <div className="absolute top-0 inset-x-0 h-0.5 z-10" style={{ background: `linear-gradient(90deg, transparent, ${tk.accent}80, transparent)` }} />
                      {player.image ? (
                        <img src={getImageUrl(player.image)} alt={player.name}
                          className="w-full h-full object-cover object-top"
                          onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="text-5xl opacity-20 pb-2">👤</div>
                      )}
                      {/* Serial number badge */}
                      {player.serial_number && (
                        <div className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-md"
                          style={{ background: `${tk.accent}25`, color: tk.accent }}>
                          #{player.serial_number}
                        </div>
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex flex-col gap-1.5 p-3">
                      <div className="font-black text-xs leading-tight truncate" style={{ color: tk.isLight ? '#061E4E' : '#FFFFFF' }}>
                        {player.name}
                      </div>
                      {player.role && (
                        <span className="self-start text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md" style={tk.rolePill}>
                          {player.role}
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] font-black uppercase" style={{ color: tk.label }}>
                          Sold
                        </span>
                        <span className="text-[10px] font-black font-mono" style={{ color: tk.accent }}>
                          ₹{FMT(player.sold_price)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
