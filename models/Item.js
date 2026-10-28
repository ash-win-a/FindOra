const mongoose = require('mongoose');

const VALID_CATEGORIES = [
  'Electronics',
  'Bags',
  'Wallets and Cards',
  'Documents',
  'Keys',
  'Clothing',
  'Accessories',
  'Books',
  'Other'
];

const itemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: {
        values: ['lost', 'found'],
        message: '{VALUE} is not a valid item type. Must be lost or found.'
      },
      required: [true, 'Item type (lost or found) is required']
    },
    title: {
      type: String,
      required: [true, 'Item title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: VALID_CATEGORIES,
        message: '{VALUE} is not a valid category.'
      }
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    brand: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'Brand cannot exceed 50 characters']
    },
    color: {
      type: String,
      trim: true,
      default: '',
      maxlength: [40, 'Color cannot exceed 40 characters']
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [150, 'Location cannot exceed 150 characters']
    },
    reportDate: {
      type: Date,
      required: [true, 'Report date is required'],
      default: Date.now,
      validate: {
        validator: function (value) {
          // Date cannot be more than 1 day in the future
          const maxFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
          return value <= maxFuture;
        },
        message: 'Report date cannot be in the future'
      }
    },
    imagePath: {
      type: String,
      default: ''
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Item must be associated with a user']
    },
    status: {
      type: String,
      enum: ['active', 'claimed', 'returned', 'deactivated'],
      default: 'active'
    },
    // Optional private verification question set by the finder
    privateVerificationQuestion: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Verification question cannot exceed 200 characters']
    },
    additionalDetails: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Additional details cannot exceed 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster filtering and text searches
itemSchema.index({ itemType: 1, status: 1, category: 1 });
itemSchema.index({
  title: 'text',
  description: 'text',
  brand: 'text',
  location: 'text'
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
module.exports.VALID_CATEGORIES = VALID_CATEGORIES;
