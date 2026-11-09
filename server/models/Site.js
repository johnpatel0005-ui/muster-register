import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Site name is required'],
      default: 'Main Construction Project',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    ownerName: {
      type: String,
      default: 'Site Owner',
      trim: true,
    },
    standardDailyHours: {
      type: Number,
      default: 8,
      min: 1,
      max: 24,
    },
    currencySymbol: {
      type: String,
      default: '₹',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Site', siteSchema);
