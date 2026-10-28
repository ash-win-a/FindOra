const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// Apply both authentication and admin checks to all routes in this file
router.use(requireAuth, requireAdmin);

/**
 * @route   GET /api/admin/stats
 * @desc    Get comprehensive system statistics for the admin dashboard
 * @access  Admin only
 */
router.get('/stats', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalItems = await Item.countDocuments();
    const totalLost = await Item.countDocuments({ itemType: 'lost' });
    const totalFound = await Item.countDocuments({ itemType: 'found' });
    const activeItems = await Item.countDocuments({ status: 'active' });
    const returnedItems = await Item.countDocuments({ status: 'returned' });
    const totalClaims = await Claim.countDocuments();
    const pendingClaims = await Claim.countDocuments({ status: 'pending' });
    const approvedClaims = await Claim.countDocuments({ status: 'approved' });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalItems,
        totalLost,
        totalFound,
        activeItems,
        returnedItems,
        totalClaims,
        pendingClaims,
        approvedClaims
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get all registered users
 * @access  Admin only
 */
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    return res.json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Change user role (user <-> admin)
 * @access  Admin only
 */
router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be user or admin.'
      });
    }

    // Prevent admin from demoting themselves
    if (req.user._id.toString() === req.params.id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot revoke your own administrator privileges.'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    return res.json({
      success: true,
      message: `User role updated to ${role}.`,
      user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/items
 * @desc    Get all items with optional search & status filter
 * @access  Admin only
 */
router.get('/items', async (req, res, next) => {
  try {
    const { status, type, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (type && type !== 'all') {
      query.itemType = type;
    }
    if (search && search.trim().length > 0) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { location: searchRegex }, { category: searchRegex }];
    }

    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .populate('ownerId', 'name email');

    return res.json({
      success: true,
      items
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/items/:id/status
 * @desc    Update item status (e.g. deactivate listing)
 * @access  Admin only
 */
router.put('/items/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'claimed', 'returned', 'deactivated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.'
      });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    return res.json({
      success: true,
      message: `Item status updated to ${status}.`,
      item
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/items/:id
 * @desc    Delete any item listing as an administrator
 * @access  Admin only
 */
router.delete('/items/:id', async (req, res, next) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }
    await Claim.deleteMany({ itemId: req.params.id });

    return res.json({
      success: true,
      message: 'Item listing and associated claims removed by administrator.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/claims
 * @desc    Get all claims across the entire platform
 * @access  Admin only
 */
router.get('/claims', async (req, res, next) => {
  try {
    const claims = await Claim.find()
      .sort({ createdAt: -1 })
      .populate('itemId', 'title category location itemType status')
      .populate('claimantId', 'name email phone')
      .populate('reviewedBy', 'name email');

    return res.json({
      success: true,
      claims
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
