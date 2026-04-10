import React from 'react';

/**
 * Fullscreen image preview modal.
 * Shows a player image in full size with object-contain so nothing is cropped.
 * Click the backdrop or the ✕ button to close.
 */
function ImageModal({ src, alt, onClose }) {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white text-2xl font-bold transition-colors border border-white/20"
        aria-label="Close"
      >
        ×
      </button>

      {/* Image */}
      <img
        src={src}
        alt={alt || 'Player Image'}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
        onError={(e) => { e.target.src = '/deafult_player.png'; }}
      />
    </div>
  );
}

export default ImageModal;
