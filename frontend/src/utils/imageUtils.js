// Helper function to get proper image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') {
    return '/deafult_player.png';
  }

  const path = imagePath.trim();

  if (path === '' || path === '?') {
    return '/deafult_player.png';
  }

  // Check if it's already a full URL (http/https)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // If it contains localhost or 127.0.0.1, replace with current hostname
    // This is useful for local development on other devices
    if (path.includes('localhost') || path.includes('127.0.0.1')) {
      const host = window.location.hostname;
      const protocol = window.location.protocol;
      try {
        const url = new URL(path);
        // Replace ONLY hostname, keep port and path
        return `${protocol}//${host}:${url.port}${url.pathname}`;
      } catch (e) {
        // Fallback: simple replace
        return path.replace(/localhost|127\.0\.0\.1/, host);
      }
    }
    return path;
  }

  // If it's a relative path starting with /uploads, convert to full URL
  if (path.startsWith('/uploads/')) {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const port = '4000'; // Backend port
    return `${protocol}//${host}:${port}${path}`;
  }

  return path;
};

