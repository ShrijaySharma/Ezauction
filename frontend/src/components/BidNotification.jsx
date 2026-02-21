import { useEffect, useRef, useState } from 'react';

function BidNotification({ teamName, increment, onClose }) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  const handleClose = () => {
    // Clear any pending timers
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
    }
    setIsClosing(true);
    // Call onClose after fade animation
    setTimeout(() => {
      onClose();
    }, 300);
  };

  useEffect(() => {
    // Start fade-out animation after 2.7 seconds
    fadeTimerRef.current = setTimeout(() => {
      setIsClosing(true);
    }, 2700);

    // Auto-close after 3 seconds
    closeTimerRef.current = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => {
      // Clear timers on unmount
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, []); // Empty dependency array - run once when component mounts

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className={`bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg shadow-2xl p-6 border-2 border-yellow-600 min-w-[350px] max-w-[500px] pointer-events-auto transition-all duration-300 ease-in-out relative ${isClosing ? 'opacity-0 scale-95 translate-y-[-20px]' : 'animate-slide-in opacity-100 scale-100 translate-y-0'
        }`}>
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-blue-900 hover:text-blue-700 font-bold text-xl sm:text-2xl w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-yellow-300 transition-colors"
          aria-label="Close notification"
        >
          ×
        </button>

        <div className="flex items-center gap-4 pr-6">
          <div className="text-4xl animate-bounce">🔔</div>
          <div className="flex-1">
            <div className="text-blue-900 font-bold text-2xl mb-1">
              {teamName || 'Unknown Team'} BID!
            </div>
            <div className="text-blue-800 text-lg font-semibold">
              +₹{(increment || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BidNotification;
