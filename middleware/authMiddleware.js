const User = require('../models/User');

/**
 * Authentication Middleware
 * Verifies that the user has an active session before proceeding.
 */
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      // Check if it's an API request or HTML page navigation
      if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please log in to continue.'
        });
      }
      return res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    // Verify user still exists in database
    const user = await User.findById(req.session.userId).select('-passwordHash');
    if (!user) {
      req.session.destroy();
      if (req.path.startsWith('/api/') || req.xhr) {
        return res.status(401).json({
          success: false,
          message: 'User session invalid. Please log in again.'
        });
      }
      return res.redirect('/login.html');
    }

    // Attach full user document to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication verification.'
    });
  }
};

/**
 * Optional Auth Middleware
 * If user is logged in, attaches user to req.user, but does not block if unauthenticated.
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('-passwordHash');
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Non-blocking
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth
};
