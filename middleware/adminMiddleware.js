/**
 * Admin Authorization Middleware
 * Ensures the logged-in user has the 'admin' role.
 * Must be used after requireAuth middleware.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Administrator privileges required.'
      });
    }
    return res.status(403).redirect('/dashboard.html?error=unauthorized_admin');
  }
  next();
};

module.exports = {
  requireAdmin
};
