import React from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

export default function ThemeNavyGold({
  currentPlayer, currentBid, highestBid, bidFlash,
  teams, sponsorName, sponsorLogo, getImageUrl, setPreviewImage,
  showAge = true, showCategory = true, showSerialNo = true,
}) {
  const winningTeam = highestBid
    ? teams.find(t => t.name === highestBid.team_name || t.id === highestBid.team_id)
    : null;

  const nameParts = (currentPlayer?.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none" style={{ background: '#051126', fontFamily: "'Inter', sans-serif" }}>

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
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center lg:items-stretch min-h-0 w-full max-w-7xl lg:max-w-none mx-auto p-4 sm:p-6 lg:p-0 gap-6 lg:gap-0">

        {/* LEFT: Logo + Player Info (centered within left column) */}
        <div className="w-full lg:w-[35%] flex flex-col justify-between items-center text-center py-2 lg:py-6 px-4 lg:px-8 shrink-0">
          <img src="/ezauction.png" alt="ezAuction" className="h-9 sm:h-11 md:h-12 lg:h-14 object-contain self-center mb-2 lg:mb-3 drop-shadow-lg" />

          <div className="flex-1 flex flex-col justify-center items-center gap-2 w-full">
            {/* Player name: nicely scaled and centered */}
            <h1 className="font-black uppercase text-white leading-[1.0] drop-shadow-2xl text-center" style={{ fontSize: 'clamp(1.85rem, 5vw, 3.8rem)', letterSpacing: '-0.02em' }}>
              <span className="block">{firstName}</span>
              {lastName && <span className="block text-[#ECC867]">{lastName}</span>}
            </h1>

            {/* Role & Category (side by side on same level) */}
            <div className="mt-1 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-block bg-[#ECC867] text-[#051126] text-xs md:text-sm font-black uppercase tracking-[0.15em] px-3.5 py-1 md:px-4 md:py-1.5 rounded-lg shadow-[0_4px_16px_rgba(236,200,103,0.35)]">
                {currentPlayer?.role || 'PLAYER'}
              </span>
              {showCategory && currentPlayer?.category && (
                <span className="inline-flex items-center bg-[#ECC867]/15 text-[#ECC867] border border-[#ECC867]/40 text-xs md:text-sm font-black uppercase tracking-[0.2em] px-3.5 py-1 md:px-4 md:py-1.5 rounded-lg shadow-[0_0_16px_rgba(236,200,103,0.25)]">
                  <span>{currentPlayer.category}</span>
                </span>
              )}
            </div>

            {/* Elegant divider */}
            <div className="w-28 sm:w-32 h-[1px] my-1 opacity-30" style={{ background: 'linear-gradient(90deg, transparent, #ECC867, transparent)' }} />

            {/* Age + Serial No + Base Price (centered) */}
            <div className="flex flex-col items-center gap-2 sm:gap-3 mt-1 sm:mt-2 w-full">
              {(showAge || (showSerialNo && currentPlayer?.serial_number != null)) && (
                <div className="flex items-center justify-center gap-4">
                  {showSerialNo && currentPlayer?.serial_number != null && (
                    <div className="text-white font-black text-xl sm:text-2xl md:text-3xl leading-none">
                      <span className="text-[#ECC867]">#</span>{currentPlayer.serial_number}
                    </div>
                  )}
                  {showSerialNo && currentPlayer?.serial_number != null && showAge && (
                    <div className="w-[1px] h-6 sm:h-7 bg-[#ECC867]/40" />
                  )}
                  {showAge && (
                    <div className="flex flex-col items-center">
                      <span className="text-[#ECC867] text-[10px] sm:text-xs font-black uppercase tracking-[0.25em]">AGE</span>
                      <div className="text-white font-black text-xl sm:text-2xl md:text-3xl leading-none mt-0.5">
                        {currentPlayer?.age || '—'} <span className="text-white/60 text-xs sm:text-sm font-bold">YRS</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center mt-1">
                <span className="text-[#ECC867] text-[10px] sm:text-xs font-black uppercase tracking-[0.25em]">BASE PRICE</span>
                <div className="text-[#FFDF78] font-black font-mono text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-none mt-0.5 drop-shadow-[0_2px_14px_rgba(255,223,120,0.35)]">
                  ₹{FMT(currentPlayer?.base_price)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Player Image with Stage-Lit Radial Spotlight */}
        <div className="w-full lg:flex-1 relative flex items-center justify-center translate-x-0 lg:-translate-x-6 xl:-translate-x-12 p-2 sm:p-4 lg:p-5 overflow-visible lg:overflow-hidden shrink-0">
          {/* Ambient stage spotlight behind player */}
          <div className="absolute w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[520px] lg:h-[520px] rounded-full blur-[70px] sm:blur-[90px] lg:blur-[110px] pointer-events-none opacity-25"
            style={{ background: 'radial-gradient(circle, #ECC867 0%, #1A3E7A 50%, transparent 70%)' }}
          />
          {currentPlayer?.image ? (
            <img
              src={getImageUrl(currentPlayer.image)}
              alt={currentPlayer.name}
              onClick={() => setPreviewImage?.(getImageUrl(currentPlayer.image))}
              className="relative z-10 cursor-pointer max-h-[36vh] sm:max-h-[44vh] lg:max-h-[92vh] w-auto max-w-full object-contain rounded-2xl md:rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] lg:shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-[#ECC867]/30 transition-transform duration-200 hover:scale-[1.01]"
              onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="relative z-10 text-7xl sm:text-8xl lg:text-9xl opacity-20">🏏</div>
          )}
        </div>

        {/* RIGHT: High-Contrast Bid Section inside Dedicated Glass Card */}
        <div className="w-full lg:w-[28%] max-w-md lg:max-w-none flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-3 lg:py-8 relative z-20 shrink-0">
          <div className="w-full bg-[#081836]/95 border-2 border-[#ECC867]/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 backdrop-blur-3xl shadow-[0_0_35px_rgba(201,168,76,0.25)] lg:shadow-[0_0_50px_rgba(201,168,76,0.3)] flex flex-col items-center gap-2 text-center">
            <span className="text-[#ECC867] text-xs md:text-sm font-black uppercase tracking-[0.25em] sm:tracking-[0.3em]">
              CURRENT BID
            </span>

            <div
              className={`font-black font-mono text-[#FFDF78] leading-none drop-shadow-[0_4px_20px_rgba(255,223,120,0.45)] transition-transform duration-200 ${bidFlash ? 'scale-110' : ''}`}
              style={{ fontSize: 'clamp(2.2rem, 5.5vw, 4.8rem)' }}
            >
              ₹{FMT(currentBid)}
            </div>

            <div className="mt-2 sm:mt-3 min-h-[60px] sm:min-h-[70px] flex flex-col items-center justify-center w-full">
              {highestBid ? (
                <div className="animate-team-bounce flex items-center gap-3 sm:gap-3.5 bg-gradient-to-r from-[#ECC867]/25 via-[#ECC867]/15 to-[#ECC867]/5 border-2 border-[#ECC867] px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl lg:rounded-2xl w-full shadow-[0_0_25px_rgba(236,200,103,0.35)]">
                  {winningTeam?.logo ? (
                    <img src={getImageUrl(winningTeam.logo)} alt={highestBid.team_name}
                      className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-[#ECC867] shadow-xl shrink-0 bg-[#051126]"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-black text-xl sm:text-2xl text-[#051126] bg-[#ECC867] shrink-0 shadow-lg">
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
        <div className="relative z-20 shrink-0 h-14 sm:h-16 md:h-20 lg:h-24 w-full bg-[#030B1A] border-t-2 border-[#C9A84C]/50 flex items-center justify-center gap-3 sm:gap-4 md:gap-6 px-4 sm:px-6 lg:px-8">
          <span className="text-[#ECC867] text-xs sm:text-sm md:text-base font-black uppercase tracking-[0.25em] sm:tracking-[0.3em]">SPONSOR</span>
          <div className="w-px h-5 sm:h-6 md:h-8 bg-[#ECC867]/40" />
          {sponsorLogo && <img src={sponsorLogo} alt={sponsorName || 'Sponsor'} className="max-h-8 sm:max-h-10 md:max-h-12 lg:max-h-14 object-contain" />}
          {sponsorName && <span className="text-white font-black text-sm sm:text-base md:text-xl lg:text-2xl tracking-wider sm:tracking-[0.15em] uppercase">{sponsorName}</span>}
        </div>
      )}
    </div>
  );
}
