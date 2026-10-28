const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const { findRankedMatches } = require('../services/matchingService');

/**
 * @route   GET /api/items/stats
 * @desc    Get real statistics from MongoDB for homepage & dashboard
 * @access  Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const totalLost = await Item.countDocuments({ itemType: 'lost' });
    const totalFound = await Item.countDocuments({ itemType: 'found' });
    const totalReturned = await Item.countDocuments({ status: 'returned' });
    const totalClaims = await Claim.countDocuments();
    const approvedClaims = await Claim.countDocuments({ status: 'approved' });

    return res.json({
      success: true,
      stats: {
        totalLost,
        totalFound,
        totalReturned,
        totalClaims,
        approvedClaims
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/items/recent
 * @desc    Get recent found items for the landing page
 * @access  Public
 */
router.get('/recent', async (req, res, next) => {
  try {
    const recentItems = await Item.find({
      status: 'active'
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('ownerId', 'name');

    return res.json({
      success: true,
      items: recentItems
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/items/user/my-items
 * @desc    Get items reported by the currently authenticated user
 * @access  Private
 */
router.get('/user/my-items', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const lostItems = await Item.find({ ownerId: userId, itemType: 'lost' }).sort({ createdAt: -1 });
    const foundItems = await Item.find({ ownerId: userId, itemType: 'found' }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      lostItems,
      foundItems
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/items
 * @desc    Browse, filter, and search all items
 * @access  Public
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      type, // 'lost', 'found', or undefined
      category,
      location,
      search,
      sort,
      status,
      page = 1,
      limit = 12
    } = req.query;

    const query = {};

    // Filter by Lost / Found type
    if (type && ['lost', 'found'].includes(type.toLowerCase())) {
      query.itemType = type.toLowerCase();
    }

    // Filter by Category
    if (category && category !== 'All' && Item.VALID_CATEGORIES.includes(category)) {
      query.category = category;
    }

    // Filter by Status: default only active items for public browsing
    if (status && ['active', 'claimed', 'returned', 'deactivated'].includes(status)) {
      query.status = status;
    } else {
      // Default to active or claimed (not returned or deactivated)
      query.status = { $in: ['active', 'claimed'] };
    }

    // Filter by Location keyword
    if (location && location.trim().length > 0) {
      query.location = { $regex: location.trim(), $options: 'i' };
    }

    // Search query on title, description, brand, or location
    if (search && search.trim().length > 0) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { location: searchRegex },
        { color: searchRegex }
      ];
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // default newest
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'az') {
      sortOption = { title: 1 };
    } else if (sort === 'date_recent') {
      sortOption = { reportDate: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Item.countDocuments(query);
    const items = await Item.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('ownerId', 'name');

    return res.json({
      success: true,
      items,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/items/:id
 * @desc    Get details of a single item
 * @access  Public
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id).populate('ownerId', 'name');
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    // Check if the current user is the owner of this item
    const isOwner = req.user && req.user._id.toString() === item.ownerId._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    return res.json({
      success: true,
      item,
      isOwner: Boolean(isOwner || isAdmin)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/items/:id/matches
 * @desc    Intelligent matching: find counterpart items matching this item
 * @access  Public / Private
 */
router.get('/:id/matches', async (req, res, next) => {
  try {
    const targetItem = await Item.findById(req.params.id);
    if (!targetItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    // Determine opposite itemType: if target is 'lost', search 'found', and vice-versa
    const counterpartType = targetItem.itemType === 'lost' ? 'found' : 'lost';

    // Retrieve active counterpart items
    const candidates = await Item.find({
      itemType: counterpartType,
      status: { $in: ['active', 'claimed'] }
    }).populate('ownerId', 'name');

    // Run transparent matching algorithm
    const rankedMatches = findRankedMatches(targetItem, candidates, 30);

    return res.json({
      success: true,
      targetItem: {
        _id: targetItem._id,
        title: targetItem.title,
        itemType: targetItem.itemType,
        category: targetItem.category,
        location: targetItem.location,
        color: targetItem.color,
        reportDate: targetItem.reportDate
      },
      matchCount: rankedMatches.length,
      matches: rankedMatches
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/items
 * @desc    Create a new lost or found item report
 * @access  Private (Logged-in users)
 */
router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const {
      itemType,
      title,
      category,
      description,
      brand,
      color,
      location,
      reportDate,
      privateVerificationQuestion,
      additionalDetails
    } = req.body;

    // 1. Validation checks
    if (!itemType || !['lost', 'found'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item type. Must be either "lost" or "found".'
      });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Item title is required.'
      });
    }

    if (!category || !Item.VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid category from: ${Item.VALID_CATEGORIES.join(', ')}`
      });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Description is required.'
      });
    }

    if (!location || location.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Location is required.'
      });
    }

    // Date Validation
    let parsedDate = Date.now();
    if (reportDate) {
      const dateObj = new Date(reportDate);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid date.'
        });
      }
      // Cannot be more than 1 day in future
      const futureLimit = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (dateObj > futureLimit) {
        return res.status(400).json({
          success: false,
          message: 'Report date cannot be in the future.'
        });
      }
      parsedDate = dateObj;
    }

    // Image Path
    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    }

    // Create item
    const newItem = await Item.create({
      itemType,
      title: title.trim(),
      category,
      description: description.trim(),
      brand: brand ? brand.trim() : '',
      color: color ? color.trim() : '',
      location: location.trim(),
      reportDate: parsedDate,
      imagePath,
      ownerId: req.user._id,
      privateVerificationQuestion: privateVerificationQuestion ? privateVerificationQuestion.trim() : '',
      additionalDetails: additionalDetails ? additionalDetails.trim() : '',
      status: 'active'
    });

    // Check for immediate potential matches
    const counterpartType = itemType === 'lost' ? 'found' : 'lost';
    const candidates = await Item.find({
      itemType: counterpartType,
      status: { $in: ['active', 'claimed'] }
    });
    const potentialMatches = findRankedMatches(newItem, candidates, 40);

    return res.status(201).json({
      success: true,
      message: `${itemType === 'lost' ? 'Lost' : 'Found'} item reported successfully!`,
      item: newItem,
      potentialMatchesCount: potentialMatches.length,
      topMatches: potentialMatches.slice(0, 3)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/items/:id
 * @desc    Update an existing item report (Owner or Admin only)
 * @access  Private
 */
router.put('/:id', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    // Check Ownership or Admin privilege
    const isOwner = req.user._id.toString() === item.ownerId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only edit your own reports.'
      });
    }

    const {
      title,
      category,
      description,
      brand,
      color,
      location,
      reportDate,
      status,
      privateVerificationQuestion,
      additionalDetails
    } = req.body;

    if (title) item.title = title.trim();
    if (category && Item.VALID_CATEGORIES.includes(category)) item.category = category;
    if (description) item.description = description.trim();
    if (brand !== undefined) item.brand = brand.trim();
    if (color !== undefined) item.color = color.trim();
    if (location) item.location = location.trim();
    if (reportDate) {
      const d = new Date(reportDate);
      if (!isNaN(d.getTime())) item.reportDate = d;
    }
    if (status && ['active', 'claimed', 'returned', 'deactivated'].includes(status)) {
      item.status = status;
    }
    if (privateVerificationQuestion !== undefined) {
      item.privateVerificationQuestion = privateVerificationQuestion.trim();
    }
    if (additionalDetails !== undefined) {
      item.additionalDetails = additionalDetails.trim();
    }
    if (req.file) {
      item.imagePath = `/uploads/${req.file.filename}`;
    }

    await item.save();

    return res.json({
      success: true,
      message: 'Item updated successfully.',
      item
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/items/:id
 * @desc    Delete or deactivate an item report (Owner or Admin only)
 * @access  Private
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    // Check Ownership or Admin privilege
    const isOwner = req.user._id.toString() === item.ownerId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only delete your own reports.'
      });
    }

    await Item.findByIdAndDelete(req.params.id);
    // Also remove associated claims
    await Claim.deleteMany({ itemId: req.params.id });

    return res.json({
      success: true,
      message: 'Item report deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
