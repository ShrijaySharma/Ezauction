import React from 'react';

const FMT = (n) => Number(n || 0).toLocaleString('en-IN');

export default function ThemeDarkTeal({
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
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none" style={{ background: '#040E10', fontFamily: "'Inter', sans-serif" }}>

      {/* ── BG ── */}
      <div className="absolute inset-0 pointer-events-none">
        <img src="/stadium_img.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-[0.52]" />
        {/* Reduced overlay opacity so stadium shows through strongly */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(4,14,16,0.25) 0%, rgba(4,14,16,0.55) 80%)' }} />
        <div className="absolute -top-16 -left-16 w-[45vw] h-[45vw] rounded-full blur-[100px] opacity-15" style={{ background: 'radial-gradient(circle, #0CCFBE 0%, transparent 60%)' }} />
        <div className="absolute -top-16 right-0 w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-12" style={{ background: 'radial-gradient(circle, #0CCFBE 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 inset-x-0 h-32 blur-[40px] opacity-10" style={{ background: 'linear-gradient(to top, #057A5B 0%, transparent 100%)' }} />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex items-stretch min-h-0">

        {/* LEFT: Logo + Player Info (centered within left column) */}
        <div className="flex flex-col justify-between items-center text-center py-6 px-6 lg:px-8" style={{ width: '35%' }}>
          <img src="/ezauction.png" alt="ezAuction" className="h-10 md:h-12 lg:h-14 object-contain self-center mb-3 drop-shadow-lg" />

          {/* Name — scaled nicely & centered */}
          <div className="flex-1 flex flex-col justify-center items-center gap-2 w-full">
            <h1 className="font-black uppercase text-white leading-[1.0] drop-shadow-2xl text-center" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.8rem)', letterSpacing: '-0.02em' }}>
              <span className="block">{firstName}</span>
              {lastName && <span className="block text-[#0CCFBE]" style={{ textShadow: '0 0 25px rgba(12,207,190,0.45)' }}>{lastName}</span>}
            </h1>

            {/* Role & Category (side by side on same level) */}
            <div className="mt-1 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-block text-[#040E10] text-xs md:text-sm font-black uppercase tracking-[0.15em] px-4 py-1.5 rounded-lg shadow-[0_4px_16px_rgba(12,207,190,0.4)]" style={{ background: '#0CCFBE' }}>
                {currentPlayer?.role || 'PLAYER'}
              </span>
              {showCategory && currentPlayer?.category && (
                <span className="inline-flex items-center bg-[#0CCFBE]/15 text-[#0CCFBE] border border-[#0CCFBE]/40 text-xs md:text-sm font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full shadow-[0_0_16px_rgba(12,207,190,0.25)]">
                  <span>{currentPlayer.category}</span>
                </span>
              )}
            </div>

            {/* Elegant divider */}
            <div className="w-32 h-[1px] my-1 opacity-30" style={{ background: 'linear-gradient(90deg, transparent, #0CCFBE, transparent)' }} />

            {/* Age + Serial No + Base Price (centered) */}
            <div className="flex flex-col items-center gap-3 mt-2 w-full">
              {(showAge || (showSerialNo && currentPlayer?.serial_number != null)) && (
                <div className="flex items-center justify-center gap-4">
                  {showSerialNo && currentPlayer?.serial_number != null && (
                    <div className="text-white font-black text-2xl md:text-3xl leading-none">
                      <span className="text-[#0CCFBE]">#</span>{currentPlayer.serial_number}
                    </div>
                  )}
                  {showSerialNo && currentPlayer?.serial_number != null && showAge && (
                    <div className="w-[1px] h-7 bg-[#0CCFBE]/35" />
                  )}
                  {showAge && (
                    <div className="flex flex-col items-center">
                      <span className="text-[#0CCFBE] text-xs font-black uppercase tracking-[0.25em]">AGE</span>
                      <div className="text-white font-black text-2xl md:text-3xl leading-none mt-0.5">
                        {currentPlayer?.age || '—'} <span className="text-white/70 text-sm font-bold">YRS</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center mt-1">
                <span className="text-[#0CCFBE] text-xs font-black uppercase tracking-[0.25em]">BASE PRICE</span>
                <div className="text-[#2EE6D6] font-black font-mono text-3xl md:text-4xl lg:text-5xl leading-none mt-0.5 drop-shadow-[0_2px_14px_rgba(46,230,214,0.35)]">
                  ₹{FMT(currentPlayer?.base_price)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Player Image with Stage-Lit Radial Spotlight */}
        <div className="flex-1 relative flex items-center justify-center -translate-x-6 md:-translate-x-10 lg:-translate-x-12 p-3 md:p-5 overflow-hidden">
          {/* Ambient stage spotlight behind player */}
          <div className="absolute w-[520px] h-[520px] rounded-full blur-[110px] pointer-events-none opacity-25"
            style={{ background: 'radial-gradient(circle, #0CCFBE 0%, #064044 50%, transparent 70%)' }}
          />
          {currentPlayer?.image ? (
            <img
              src={getImageUrl(currentPlayer.image)}
              alt={currentPlayer.name}
              onClick={() => setPreviewImage?.(getImageUrl(currentPlayer.image))}
              className="relative z-10 cursor-pointer max-h-[92vh] w-auto max-w-full object-contain rounded-2xl md:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-[#0CCFBE]/30 transition-transform duration-200 hover:scale-[1.01]"
              onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="relative z-10 text-9xl opacity-20">🏏</div>
          )}
        </div>

        {/* RIGHT: High-Contrast Bid Section inside Dedicated Glass Card */}
        <div className="flex flex-col justify-center items-center px-6 lg:px-8 py-8 relative z-20" style={{ width: '28%' }}>
          <div className="w-full bg-[#06181A]/95 border-2 border-[#0CCFBE]/50 rounded-3xl p-6 md:p-8 backdrop-blur-3xl shadow-[0_0_50px_rgba(12,207,190,0.3)] flex flex-col items-center gap-2 text-center">
            <span className="text-[#0CCFBE] text-xs md:text-sm font-black uppercase tracking-[0.3em]">
              CURRENT BID
            </span>

            <div
              className={`font-black font-mono text-white leading-none drop-shadow-[0_4px_22px_rgba(12,207,190,0.6)] transition-transform duration-200 ${bidFlash ? 'scale-110' : ''}`}
              style={{ fontSize: 'clamp(2.6rem, 4.8vw, 4.8rem)' }}
            >
              ₹{FMT(currentBid)}
            </div>

            <div className="mt-3 min-h-[70px] flex flex-col items-center justify-center w-full">
              {highestBid ? (
                <div className="animate-team-bounce flex items-center gap-3.5 bg-gradient-to-r from-[#0CCFBE]/25 via-[#0CCFBE]/15 to-[#0CCFBE]/5 border-2 border-[#0CCFBE] px-4 py-2.5 rounded-2xl w-full shadow-[0_0_25px_rgba(12,207,190,0.35)]">
                  {winningTeam?.logo ? (
                    <img src={getImageUrl(winningTeam.logo)} alt={highestBid.team_name}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-[#0CCFBE] shadow-xl shrink-0 bg-[#040E10]"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center font-black text-2xl text-[#040E10] bg-[#0CCFBE] shrink-0 shadow-lg">
                      {(highestBid.team_name || 'T').charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col text-left min-w-0 flex-1 justify-center">
                    <span className="text-[#0CCFBE] text-[10px] md:text-xs font-black uppercase tracking-[0.25em]">HIGHEST BIDDER</span>
                    <span className="text-white font-black text-sm md:text-base leading-tight uppercase tracking-wide break-words">
                      {highestBid.team_name}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[#0CCFBE] text-sm md:text-base font-black uppercase tracking-[0.2em] italic animate-pulse">
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
        <div className="relative z-20 shrink-0 h-20 md:h-24 w-full bg-[#040E10] border-t-2 border-[#0CCFBE]/40 flex items-center justify-center gap-6 px-8">
          <span className="text-[#0CCFBE]/70 text-sm md:text-base font-black uppercase tracking-[0.3em]">SPONSOR</span>
          <div className="w-px h-8 bg-[#0CCFBE]/40" />
          {sponsorLogo && <img src={sponsorLogo} alt={sponsorName || 'Sponsor'} className="max-h-12 md:max-h-14 object-contain" />}
          {sponsorName && <span className="text-white font-black text-xl md:text-2xl tracking-[0.15em] uppercase">{sponsorName}</span>}
        </div>
      )}
    </div>
  );
}
