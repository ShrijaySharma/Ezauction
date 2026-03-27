import { useState, useEffect } from 'react';
import { getPublicTradingWindowStatus } from '../services/public';

/**
 * TradingWindowBanner — Self-contained component that shows a live trading ticker.
 * Accepts a `socket` prop to listen for real-time `trading-window-update` events.
 * Renders nothing when the trading window is closed.
 */
function TradingWindowBanner({ socket }) {
  const [windowState, setWindowState] = useState({ isOpen: false, trades: [] });

  // Load initial state on mount
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const data = await getPublicTradingWindowStatus();
        if (data) setWindowState(data);
      } catch (err) {
        // Silent fail — banner just won't show
        console.error('[TradingBanner] Failed to load initial state:', err);
      }
    };
    loadInitial();
  }, []);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      if (data) setWindowState(data);
    };

    socket.on('trading-window-update', handleUpdate);
    return () => {
      socket.off('trading-window-update', handleUpdate);
    };
  }, [socket]);

  // Don't render anything if window is closed
  if (!windowState.isOpen) return null;

  const formatIndianNumber = (num) => {
    if (!num && num !== 0) return '0';
    const s = num.toString();
    const lastThree = s.substring(s.length - 3);
    const otherNumbers = s.substring(0, s.length - 3);
    if (otherNumbers !== '') {
      return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    }
    return lastThree;
  };

  const trades = windowState.trades || [];

  return (
    <>
      {/* Fixed top banner — fully click-through so it never blocks UI */}
      <div className="fixed top-0 left-0 right-0 z-[30] pointer-events-none">
        {/* Glowing header bar */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 text-white py-2 px-4 flex items-center justify-center gap-3 shadow-[0_4px_30px_rgba(245,158,11,0.4)]">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <span className="font-black text-sm sm:text-base uppercase tracking-[0.2em] drop-shadow-lg">
            🔄 Trading Window LIVE
          </span>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
        </div>

        {/* Trade ticker (scrolling feed) */}
        {trades.length > 0 && (
          <div className="bg-black/90 backdrop-blur-xl border-b border-amber-500/30 overflow-hidden">
            <div className="flex animate-trading-ticker whitespace-nowrap py-2 px-4">
              {/* Repeat trades for continuous scroll effect */}
              {[...trades, ...trades].map((trade, idx) => (
                <span key={idx} className="inline-flex items-center gap-2 mx-6 text-sm shrink-0">
                  <span className="text-amber-400 font-bold">{trade.player_name}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-red-400 font-semibold line-through opacity-70">{trade.from_team_name}</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-green-400 font-bold">{trade.to_team_name}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-yellow-300 font-mono font-bold">₹{formatIndianNumber(trade.amount)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inject the ticker animation keyframes */}
      <style>{`
        @keyframes trading-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-trading-ticker {
          animation: trading-ticker ${Math.max(10, trades.length * 8)}s linear infinite;
        }
      `}</style>
    </>
  );
}

export default TradingWindowBanner;
