const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/claims
 * @desc    Submit a claim for a found item
 * @access  Private (Logged-in users)
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { itemId, claimDescription, privateVerificationAnswer } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required.'
      });
    }

    if (!claimDescription || claimDescription.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a clear description (at least 10 characters) explaining why this item is yours.'
      });
    }

    if (!privateVerificationAnswer || privateVerificationAnswer.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please provide private verification details or answer the verification question.'
      });
    }

    // Find the item
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'The item you are claiming does not exist.'
      });
    }

    // Check item status
    if (item.status === 'returned' || item.status === 'deactivated') {
      return res.status(400).json({
        success: false,
        message: 'This item is no longer available for claims.'
      });
    }

    // Security check: User cannot claim their own reported item
    if (item.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot submit a claim for an item you reported yourself.'
      });
    }

    // Security check: Prevent duplicate pending claims for the same item by the same user
    const existingClaim = await Claim.findOne({
      itemId,
      claimantId: req.user._id,
      status: 'pending'
    });

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending claim for this item. Please wait for the finder to review it.'
      });
    }

    // Create the claim
    const newClaim = await Claim.create({
      itemId,
      claimantId: req.user._id,
      claimDescription: claimDescription.trim(),
      privateVerificationAnswer: privateVerificationAnswer.trim(),
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Your claim has been submitted successfully! The finder will review your verification details.',
      claim: newClaim
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/claims/my-claims
 * @desc    Get all claims submitted by the logged-in user
 * @access  Private
 */
router.get('/my-claims', requireAuth, async (req, res, next) => {
  try {
    const claims = await Claim.find({ claimantId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('itemId', 'title category location imagePath status itemType')
      .populate('reviewedBy', 'name');

    return res.json({
      success: true,
      claims
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/claims/item/:itemId
 * @desc    Get all claims submitted for a specific found item
 *          (Only authorized item owner or administrator can view)
 * @access  Private
 */
router.get('/item/:itemId', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    // Authorization check
    const isOwner = item.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view claims for this item.'
      });
    }

    const claims = await Claim.find({ itemId: req.params.itemId })
      .sort({ createdAt: -1 })
      .populate('claimantId', 'name email phone')
      .populate('reviewedBy', 'name');

    return res.json({
      success: true,
      item: {
        _id: item._id,
        title: item.title,
        category: item.category,
        location: item.location,
        status: item.status,
        privateVerificationQuestion: item.privateVerificationQuestion
      },
      claims
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/claims/:id/review
 * @desc    Approve or reject a claim (Item Owner or Admin only)
 * @access  Private
 */
router.put('/:id/review', requireAuth, async (req, res, next) => {
  try {
    const { action, reviewNote } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject".'
      });
    }

    const claim = await Claim.findById(req.params.id).populate('itemId');
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found.'
      });
    }

    if (!claim.itemId) {
      return res.status(404).json({
        success: false,
        message: 'Associated item no longer exists.'
      });
    }

    // Security check: Claimant cannot approve or reject their own claim
    if (claim.claimantId.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: You cannot review or approve your own claim.'
      });
    }

    // Security check: Only the finder who posted the item OR an administrator can review
    const isItemOwner = claim.itemId.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isItemOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the item finder or an administrator can review this claim.'
      });
    }

    // Update claim status
    claim.status = action === 'approve' ? 'approved' : 'rejected';
    claim.reviewNote = reviewNote ? reviewNote.trim() : '';
    claim.reviewedBy = req.user._id;
    claim.reviewedAt = new Date();

    await claim.save();

    // If approved, update the item status to 'claimed'
    if (action === 'approve') {
      await Item.findByIdAndUpdate(claim.itemId._id, { status: 'claimed' });
      // Reject any other pending claims for this item
      await Claim.updateMany(
        { itemId: claim.itemId._id, _id: { $ne: claim._id }, status: 'pending' },
        {
          status: 'rejected',
          reviewNote: 'Another claimant provided verified proof of ownership.',
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      );
    }

    return res.json({
      success: true,
      message: `Claim successfully ${action === 'approve' ? 'approved' : 'rejected'}.`,
      claim
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/claims/item/:itemId/return
 * @desc    Mark item as successfully Returned / Reunited with owner
 * @access  Private (Item Owner or Admin only)
 */
router.put('/item/:itemId/return', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    const isOwner = item.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the reporter or an administrator can mark an item as returned.'
      });
    }

    item.status = 'returned';
    await item.save();

    return res.json({
      success: true,
      message: 'Item has been successfully marked as Returned and Reunited!',
      item
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
