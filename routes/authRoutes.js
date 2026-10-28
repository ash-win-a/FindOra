const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Simple in-memory tracker for basic login brute-force rate-limiting
const loginAttempts = new Map();

/**
 * Helper to clean up old rate limiting entries
 */
const checkRateLimit = (ip) => {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 10;

  const userAttempts = loginAttempts.get(ip) || [];
  const recentAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);

  if (recentAttempts.length >= maxAttempts) {
    return false; // Rate limit exceeded
  }

  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  return true;
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;

    // 1. Frontend & Backend Required Fields Check
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields (Name, Email, Password, Confirm Password).'
      });
    }

    // 2. Trim and normalize strings
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone ? phone.trim() : '';

    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 2 characters long.'
      });
    }

    // 3. Email Format Validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    // 4. Password Validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    // 5. Prevent Duplicate Email Registration
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    // 6. Hash Password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 7. Save to MongoDB
    const newUser = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      passwordHash,
      phone: trimmedPhone,
      role: 'user' // Default role is always user
    });

    // 8. Establish Session
    req.session.userId = newUser._id.toString();
    req.session.userName = newUser.name;
    req.session.userEmail = newUser.email;
    req.session.userRole = newUser.role;

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & establish session
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // Rate Limiting Check
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please wait 5 minutes before trying again.'
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Find User in MongoDB
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Compare Password with bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Regenerate session to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      req.session.userId = user._id.toString();
      req.session.userName = user.name;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;

      return res.json({
        success: true,
        message: 'Login successful!',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Destroy session and log user out
 * @access  Public
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Could not log out. Please try again.'
      });
    }
    res.clearCookie('connect.sid');
    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user details
 * @access  Public
 */
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({
        success: true,
        isAuthenticated: false,
        user: null
      });
    }

    const user = await User.findById(req.session.userId).select('-passwordHash');
    if (!user) {
      return res.json({
        success: true,
        isAuthenticated: false,
        user: null
      });
    }

    return res.json({
      success: true,
      isAuthenticated: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
