import React from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

export default function ThemeNavyGold({
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
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none" style={{ background: '#051126', fontFamily: "'Inter', sans-serif" }}>

      {/* ── BG ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #051126 0%, #0A1C3E 50%, #040D1D 100%)' }} />
        <img src="/stadium_img.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-[0.14]" />
        {/* Stadium light flares */}
        <div className="absolute -top-16 -left-16 w-[45vw] h-[45vw] rounded-full blur-[100px] opacity-25" style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 65%)' }} />
        <div className="absolute top-1/3 right-0 w-[40vw] h-[40vw] rounded-full blur-[110px] opacity-20" style={{ background: 'radial-gradient(circle, #ECC867 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 inset-x-0 h-40 opacity-15" style={{ background: 'linear-gradient(to top, #C9A84C 0%, transparent 100%)' }} />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex items-stretch min-h-0">

        {/* LEFT: Logo + Player Info (centered within left column) */}
        <div className="flex flex-col justify-between items-center text-center py-6 px-6 lg:px-8" style={{ width: '35%' }}>
          <img src="/ezauction.png" alt="ezAuction" className="h-10 md:h-12 lg:h-14 object-contain self-center mb-3 drop-shadow-lg" />

          <div className="flex-1 flex flex-col justify-center items-center gap-2 w-full">
            {/* Player name: nicely scaled and centered */}
            <h1 className="font-black uppercase text-white leading-[1.0] drop-shadow-2xl text-center" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.8rem)', letterSpacing: '-0.02em' }}>
              <span className="block">{firstName}</span>
              {lastName && <span className="block text-[#ECC867]">{lastName}</span>}
            </h1>

            {/* Role pill */}
            <div className="mt-1 flex justify-center">
              <span className="inline-block bg-[#ECC867] text-[#051126] text-xs md:text-sm font-black uppercase tracking-[0.15em] px-4 py-1.5 rounded-lg shadow-[0_4px_16px_rgba(236,200,103,0.35)]">
                {currentPlayer?.role || 'PLAYER'}
              </span>
            </div>

            {/* Age + Base Price (centered) */}
            <div className="flex flex-col items-center gap-3 mt-4 w-full">
              <div className="flex flex-col items-center">
                <span className="text-[#ECC867] text-xs font-black uppercase tracking-[0.25em]">AGE</span>
                <div className="text-white font-black text-2xl md:text-3xl leading-none mt-0.5">
                  {currentPlayer?.age || '—'} <span className="text-white/60 text-sm font-bold">YRS</span>
                </div>
              </div>
              <div className="flex flex-col items-center mt-1">
                <span className="text-[#ECC867] text-xs font-black uppercase tracking-[0.25em]">BASE PRICE</span>
                <div className="text-[#FFDF78] font-black font-mono text-3xl md:text-4xl lg:text-5xl leading-none mt-0.5 drop-shadow-[0_2px_14px_rgba(255,223,120,0.35)]">
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
              className="cursor-pointer max-h-[92vh] w-auto max-w-full object-contain rounded-2xl md:rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] border border-[#ECC867]/20 transition-transform duration-200 hover:scale-[1.01]"
              onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="text-9xl opacity-20">🏏</div>
          )}
        </div>

        {/* RIGHT: High-Contrast Bid Section inside Dedicated Glass Card */}
        <div className="flex flex-col justify-center items-center px-6 lg:px-8 py-8 relative z-20" style={{ width: '28%' }}>
          <div className="w-full bg-[#081836]/90 border-2 border-[#ECC867]/40 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-[0_0_40px_rgba(201,168,76,0.25)] flex flex-col items-center gap-2 text-center">
            <span className="text-[#ECC867] text-xs md:text-sm font-black uppercase tracking-[0.3em]">
              CURRENT BID
            </span>

            <div
              className={`font-black font-mono text-[#FFDF78] leading-none drop-shadow-[0_4px_20px_rgba(255,223,120,0.45)] transition-transform duration-200 ${bidFlash ? 'scale-110' : ''}`}
              style={{ fontSize: 'clamp(2.6rem, 4.8vw, 4.8rem)' }}
            >
              ₹{FMT(currentBid)}
            </div>

            <div className="mt-3 min-h-[70px] flex flex-col items-center justify-center w-full">
              {highestBid ? (
                <div className="animate-team-bounce flex items-center gap-3.5 bg-gradient-to-r from-[#ECC867]/25 via-[#ECC867]/15 to-[#ECC867]/5 border-2 border-[#ECC867] px-4 py-2.5 rounded-2xl w-full shadow-[0_0_25px_rgba(236,200,103,0.35)]">
                  {winningTeam?.logo ? (
                    <img src={getImageUrl(winningTeam.logo)} alt={highestBid.team_name}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-[#ECC867] shadow-xl shrink-0 bg-[#051126]"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-black text-2xl text-[#051126] bg-[#ECC867] shrink-0 shadow-lg">
                      {(highestBid.team_name || 'T').charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col text-left min-w-0 flex-1 justify-center">
                    <span className="text-[#ECC867] text-[10px] md:text-xs font-black uppercase tracking-[0.25em]">HIGHEST BIDDER</span>
                    <span className="text-white font-black text-sm md:text-base leading-tight uppercase tracking-wide break-words">
                      {highestBid.team_name}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[#ECC867] text-sm md:text-base font-black uppercase tracking-[0.2em] italic animate-pulse">
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
        <div className="relative z-20 shrink-0 h-14 md:h-16 w-full bg-[#030B1A] border-t-2 border-[#C9A84C]/50 flex items-center justify-center gap-4 px-6">
          <span className="text-[#ECC867] text-xs md:text-sm font-black uppercase tracking-[0.3em]">SPONSOR</span>
          <div className="w-px h-6 bg-[#ECC867]/40" />
          {sponsorLogo && <img src={sponsorLogo} alt={sponsorName || 'Sponsor'} className="max-h-9 md:max-h-10 object-contain" />}
          {sponsorName && <span className="text-white font-black text-sm md:text-base tracking-[0.15em] uppercase">{sponsorName}</span>}
        </div>
      )}
    </div>
  );
}
