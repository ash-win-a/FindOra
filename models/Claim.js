const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Claim must be linked to an item']
    },
    claimantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Claim must be linked to a claimant user']
    },
    claimDescription: {
      type: String,
      required: [true, 'Please explain why this item belongs to you'],
      trim: true,
      minlength: [10, 'Explanation must be at least 10 characters long'],
      maxlength: [1000, 'Explanation cannot exceed 1000 characters']
    },
    privateVerificationAnswer: {
      type: String,
      required: [true, 'Please provide private verification details or answer the verification question'],
      trim: true,
      minlength: [3, 'Verification answer must be at least 3 characters long'],
      maxlength: [500, 'Verification answer cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Review note cannot exceed 500 characters']
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate active claims by the same claimant for the same item
claimSchema.index({ itemId: 1, claimantId: 1, status: 1 });

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;
