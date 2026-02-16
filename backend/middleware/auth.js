// Middleware to check if user is authenticated
export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to check if user is admin
export function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware to check if user is owner
export function requireOwner(req, res, next) {
  if (!req.session.userId || req.session.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

// Middleware to check if user is app owner
export function requireAppOwner(req, res, next) {
  if (!req.session.userId || req.session.role !== 'app_owner') {
    return res.status(403).json({ error: 'App Owner access required' });
  }
  next();
}
