import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Main Construction Project',
      trim: true,
    },
    location: {
      type: String,
      default: 'Site Location #1',
      trim: true,
    },
    ownerName: {
      type: String,
      default: 'Construction Contractor',
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
  },
  { timestamps: true }
);

export default mongoose.model('Site', siteSchema);
