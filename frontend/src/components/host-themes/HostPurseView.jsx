import React from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

// Theme-aware styling tokens
function getTokens(themeKey) {
  switch (themeKey) {
    case 'navy_gold': return {
      bg: '#071630', accent: '#C9A84C', accentRgb: '201,168,76',
      cardBg: 'rgba(13,27,62,0.85)', cardBorder: 'rgba(201,168,76,0.3)',
      label: 'rgba(201,168,76,0.7)', textDim: 'rgba(255,255,255,0.45)',
      isLight: false
    };
    case 'blue_brush': return {
      bg: '#EFF3FB', accent: '#0047CC', accentRgb: '0,71,204',
      cardBg: 'rgba(255,255,255,0.9)', cardBorder: 'rgba(0,71,204,0.18)',
      label: 'rgba(0,71,204,0.65)', textDim: 'rgba(6,30,78,0.5)',
      isLight: true
    };
    case 'dark_teal': return {
      bg: '#040E10', accent: '#0CCFBE', accentRgb: '12,207,190',
      cardBg: 'rgba(6,26,30,0.8)', cardBorder: 'rgba(12,207,190,0.25)',
      label: 'rgba(12,207,190,0.7)', textDim: 'rgba(255,255,255,0.4)',
      isLight: false
    };
    default: return { // black_gold
      bg: '#0A0A0A', accent: '#D4AF37', accentRgb: '212,175,55',
      cardBg: 'rgba(18,18,18,0.85)', cardBorder: 'rgba(212,175,55,0.25)',
      label: 'rgba(212,175,55,0.7)', textDim: 'rgba(255,255,255,0.4)',
      isLight: false
    };
  }
}

export default function HostPurseView({ teamPurses, themeKey, getImageUrl }) {
  const tk = getTokens(themeKey);

  if (!teamPurses || teamPurses.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: tk.bg }}>
        <p className="text-4xl font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: tk.accent, opacity: 0.4 }}>
          Loading Purses…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: tk.bg, fontFamily: "'Inter', sans-serif" }}>

      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] rounded-full blur-[100px] opacity-10"
          style={{ background: `radial-gradient(circle, ${tk.accent} 0%, transparent 70%)` }} />
      </div>

      {/* Header */}
      <div className="relative z-10 shrink-0 flex flex-col items-center py-5 md:py-6 px-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-12 opacity-50" style={{ background: tk.accent }} />
          <span className="font-black uppercase tracking-[0.4em] text-[10px] md:text-xs" style={{ color: tk.accent }}>Live Broadcast</span>
          <div className="h-px w-12 opacity-50" style={{ background: tk.accent }} />
        </div>
        <h2 className="font-black uppercase tracking-tight leading-none" style={{ color: tk.isLight ? '#061E4E' : '#FFFFFF', fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', letterSpacing: '-0.02em' }}>
          Team <span style={{ color: tk.accent }}>Purses</span>
        </h2>
      </div>

      {/* Cards grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-10 lg:px-14 pb-8 scrollbar-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 content-start">
          {teamPurses.map((team, i) => {
            const spent    = team.totalSpent || 0;
            const remaining = team.budget || 0;
            const total    = spent + remaining;
            const pct      = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 100;
            const barColor = pct > 50 ? '#22C55E' : pct > 20 ? '#F59E0B' : '#EF4444';

            return (
              <div
                key={team.id || i}
                className="rounded-2xl border flex flex-col gap-0 overflow-hidden transition-transform hover:scale-[1.01]"
                style={{ background: tk.cardBg, borderColor: tk.cardBorder, backdropFilter: 'blur(20px)', animationDelay: `${i * 50}ms` }}
              >
                {/* Card header — colored accent top stripe */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${tk.accent}, transparent)` }} />

                <div className="flex flex-col gap-4 p-5">
                  {/* Team identity row */}
                  <div className="flex items-center gap-3">
                    {team.logo ? (
                      <img src={getImageUrl(team.logo)} alt={team.name}
                        className="w-14 h-14 rounded-2xl object-cover shadow-lg shrink-0"
                        style={{ border: `2px solid ${tk.accent}50` }}
                        onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center font-black text-xl shadow-lg"
                        style={{ background: `${tk.accent}20`, border: `2px solid ${tk.accent}40`, color: tk.accent }}>
                        {(team.name || 'T').charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-sm md:text-base truncate" style={{ color: tk.isLight ? '#061E4E' : '#FFFFFF' }}>
                        {team.name}
                      </div>
                      <div className="text-xs font-bold mt-0.5 opacity-60" style={{ color: tk.isLight ? '#061E4E' : '#FFFFFF' }}>
                        {team.playersBought || 0} players bought
                      </div>
                    </div>
                  </div>

                  {/* ── REMAINING BUDGET — hero number ── */}
                  <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: `${tk.accent}12`, border: `1px solid ${tk.accent}30` }}>
                    <div className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: tk.label }}>
                      Remaining Budget
                    </div>
                    <div className="font-black font-mono leading-none" style={{ color: tk.accent, fontSize: 'clamp(1.5rem, 3.5vw, 2.8rem)', textShadow: tk.isLight ? 'none' : `0 0 20px ${tk.accent}50` }}>
                      ₹{FMT(remaining)}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(128,128,128,0.18)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}CC, ${barColor})` }} />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold" style={{ color: tk.textDim }}>
                      <span>{pct.toFixed(0)}% remaining</span>
                      <span>Budget: ₹{FMT(total)}</span>
                    </div>
                  </div>

                  {/* Total spent row */}
                  {spent > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'rgba(128,128,128,0.15)' }}>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: tk.textDim }}>Total Spent</span>
                      <span className="text-rose-400 font-black font-mono text-sm">₹{FMT(spent)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
