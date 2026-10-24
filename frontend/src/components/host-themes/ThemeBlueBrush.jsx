import React from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

export default function ThemeBlueBrush({
  currentPlayer, currentBid, highestBid, bidFlash,
  teams, sponsorName, sponsorLogo, getImageUrl, setPreviewImage
}) {
  const winningTeam = highestBid
    ? teams.find(t => t.name === highestBid.team_name || t.id === highestBid.team_id)
    : null;

  const nameParts = (currentPlayer?.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none" style={{ background: '#EFF3FB', fontFamily: "'Inter', sans-serif" }}>

      {/* ── BG ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, #F8FAFD 0%, #EEF3FA 50%, #E3ECF8 100%)' }} />
        <img src="/stadium_img.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-[0.06]" />

        {/* Blue paint splash SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path d="M310 700 Q370 420 420 220 Q440 90 530 -20 L660 -20 Q600 90 570 240 Q530 450 490 700 Z" fill="#0047CC" opacity="0.88" />
          <path d="M270 700 Q330 390 380 160 Q400 40 480 -20 L540 -20 Q460 60 440 200 Q400 420 350 700 Z" fill="#1E6BFF" opacity="0.6" />
          <path d="M440 700 Q470 510 480 360 Q488 230 520 80 L550 20 L565 20 Q530 90 520 240 Q505 390 475 700 Z" fill="#002D8A" opacity="0.7" />
          <path d="M360 700 Q380 490 395 340 Q406 210 430 70 L450 -10 L460 -10 Q435 80 425 220 Q412 370 390 700 Z" fill="#FFFFFF" opacity="0.15" />
          <ellipse cx="240" cy="640" rx="32" ry="12" fill="#0047CC" opacity="0.6" transform="rotate(-30 240 640)" />
          <circle cx="210" cy="620" r="10" fill="#0047CC" opacity="0.55" />
          <circle cx="530" cy="665" r="7" fill="#002D8A" opacity="0.5" />
          <circle cx="500" cy="30" r="14" fill="#0047CC" opacity="0.6" />
          <circle cx="525" cy="15" r="8" fill="#1E6BFF" opacity="0.5" />
        </svg>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex items-stretch min-h-0">

        {/* LEFT: Logo + Player Info (centered within left column) */}
        <div className="flex flex-col justify-between items-center text-center py-6 px-6 lg:px-8" style={{ width: '35%' }}>
          <img src="/ezauction.png" alt="ezAuction" className="h-10 md:h-12 lg:h-14 object-contain self-center mb-3 drop-shadow-md" />

          <div className="flex-1 flex flex-col justify-center items-center gap-2 w-full">
            <h1 className="font-black uppercase leading-[1.0] drop-shadow-sm text-center" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.8rem)', letterSpacing: '-0.02em', color: '#061E4E' }}>
              <span className="block">{firstName}</span>
              {lastName && <span className="block" style={{ color: '#0047CC' }}>{lastName}</span>}
            </h1>

            <div className="mt-1 flex justify-center">
              <span className="inline-block bg-[#0047CC] text-white text-xs md:text-sm font-black uppercase tracking-[0.15em] px-4 py-1.5 rounded-lg shadow-[0_4px_16px_rgba(0,71,204,0.3)]">
                {currentPlayer?.role || 'PLAYER'}
              </span>
            </div>

            <div className="flex flex-col items-center gap-3 mt-4 w-full">
              <div className="flex flex-col items-center">
                <span className="text-slate-600 text-xs font-black uppercase tracking-[0.25em]">AGE</span>
                <div className="text-[#061E4E] font-black text-2xl md:text-3xl leading-none mt-0.5">
                  {currentPlayer?.age || '—'} <span className="text-slate-500 text-sm font-bold">YRS</span>
                </div>
              </div>
              <div className="flex flex-col items-center mt-1">
                <span className="text-[#0047CC] text-xs font-black uppercase tracking-[0.25em]">BASE PRICE</span>
                <div className="text-[#0047CC] font-black font-mono text-3xl md:text-4xl lg:text-5xl leading-none mt-0.5">
                  ₹{FMT(currentPlayer?.base_price)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Player Image (shifted left a bit) */}
        <div className="flex-1 relative flex items-center justify-center -translate-x-6 md:-translate-x-10 lg:-translate-x-12 p-3 md:p-5 overflow-hidden">
          {currentPlayer?.image ? (
            <img
              src={getImageUrl(currentPlayer.image)}
              alt={currentPlayer.name}
              onClick={() => setPreviewImage?.(getImageUrl(currentPlayer.image))}
              className="cursor-pointer max-h-[92vh] w-auto max-w-full object-contain rounded-2xl md:rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.25)] border border-[#0047CC]/25 transition-transform duration-200 hover:scale-[1.01]"
              onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="text-9xl opacity-20">🏏</div>
          )}
        </div>

        {/* RIGHT: High-Contrast Bid Section in Crisp Card */}
        <div className="flex flex-col justify-center items-center px-6 lg:px-8 py-8 relative z-20" style={{ width: '28%' }}>
          <div className="w-full bg-white/95 border-2 border-[#0047CC]/25 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-[0_12px_40px_rgba(0,71,204,0.12)] flex flex-col items-center gap-2 text-center">
            <span className="text-[#0047CC] text-xs md:text-sm font-black uppercase tracking-[0.3em]">
              CURRENT BID
            </span>

            <div
              className={`font-black font-mono text-[#003B9E] leading-none transition-transform duration-200 ${bidFlash ? 'scale-110' : ''}`}
              style={{ fontSize: 'clamp(2.6rem, 4.8vw, 4.8rem)' }}
            >
              ₹{FMT(currentBid)}
            </div>

            <div className="mt-3 min-h-[70px] flex flex-col items-center justify-center w-full">
              {highestBid ? (
                <div className="animate-team-bounce flex items-center gap-3.5 bg-gradient-to-r from-blue-500/15 via-blue-500/10 to-blue-500/5 border-2 border-[#0047CC] px-4 py-2.5 rounded-2xl w-full shadow-[0_4px_25px_rgba(0,71,204,0.18)]">
                  {winningTeam?.logo ? (
                    <img src={getImageUrl(winningTeam.logo)} alt={highestBid.team_name}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-[#0047CC] shadow-md shrink-0 bg-white"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-black text-2xl text-white bg-[#0047CC] shrink-0 shadow-md">
                      {(highestBid.team_name || 'T').charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col text-left min-w-0 flex-1 justify-center">
                    <span className="text-[#0047CC] text-[10px] md:text-xs font-black uppercase tracking-[0.25em]">HIGHEST BIDDER</span>
                    <span className="text-[#061E4E] font-black text-sm md:text-base leading-tight uppercase tracking-wide break-words">
                      {highestBid.team_name}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[#0047CC] text-sm md:text-base font-black uppercase tracking-[0.2em] italic animate-pulse">
                  AWAITING BID...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes team-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-team-bounce {
          animation: team-bounce 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
      `}</style>

      {/* ── SPONSOR BAR (only if user has set sponsor) ── */}
      {(sponsorName || sponsorLogo) && (
        <div className="relative z-20 shrink-0 h-14 md:h-16 w-full bg-[#0047CC] flex items-center justify-center gap-4 px-6 shadow-lg">
          <span className="text-white/80 text-xs md:text-sm font-black uppercase tracking-[0.3em]">SPONSOR</span>
          <div className="w-px h-6 bg-white/40" />
          {sponsorLogo && <img src={sponsorLogo} alt={sponsorName || 'Sponsor'} className="max-h-9 md:max-h-10 object-contain brightness-0 invert" />}
          {sponsorName && <span className="text-white font-black text-sm md:text-base tracking-[0.15em] uppercase">{sponsorName}</span>}
        </div>
      )}
    </div>
  );
}
