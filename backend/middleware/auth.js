// Middleware to check if user is authenticated
export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to check if user is admin (scoped to an auction, or super_admin)
export function requireAdmin(req, res, next) {
  if (!req.session.userId || (req.session.role !== 'admin' && req.session.role !== 'super_admin')) {
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

// Middleware to check if user is host
export function requireHost(req, res, next) {
  if (!req.session.userId || req.session.role !== 'host') {
    return res.status(403).json({ error: 'Host access required' });
  }
  next();
}

// Middleware to check if user is app owner (legacy)
export function requireAppOwner(req, res, next) {
  if (!req.session.userId || req.session.role !== 'app_owner') {
    return res.status(403).json({ error: 'App Owner access required' });
  }
  next();
}

// Middleware to check if user is super admin
export function requireSuperAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
}

/**
 * Middleware to enforce auction-level session isolation.
 * Checks that the session's auctionId matches the route's :auctionId param.
 * Super admins bypass this check.
 */
export function requireAuctionScope(req, res, next) {
  // Super admins can access any auction
  if (req.session.role === 'super_admin') return next();

  const routeAuctionId = req.params.auctionId;
  const sessionAuctionId = req.session.auctionId;

  if (!routeAuctionId || !sessionAuctionId || routeAuctionId !== sessionAuctionId) {
    return res.status(403).json({ error: 'Access denied: auction scope mismatch' });
  }
  next();
}
