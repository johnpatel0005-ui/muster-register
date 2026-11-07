import mongoose from 'mongoose';

const workerSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Worker name is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      default: '',
    },
    // phone is kept as alias/sync for backward compatibility
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    workType: {
      type: String,
      default: 'Helper',
      trim: true,
    },
    // trade is kept as alias/sync for backward compatibility
    trade: {
      type: String,
      default: 'Helper',
      trim: true,
    },
    dailyWage: {
      type: Number,
      required: [true, 'Daily wage is required'],
      min: [0, 'Daily wage cannot be negative'],
      default: 500,
    },
    standardWorkingHours: {
      type: Number,
      required: true,
      default: 8,
      min: [1, 'Standard working hours must be at least 1'],
      max: [24, 'Standard working hours cannot exceed 24'],
    },
    overtimeMultiplier: {
      type: Number,
      default: 1.0,
      min: [1.0, 'Overtime multiplier cannot be less than 1.0'],
      max: [5.0, 'Overtime multiplier cannot exceed 5.0'],
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Synchronize mobileNumber <-> phone and workType <-> trade
workerSchema.pre('validate', function (next) {
  if (this.mobileNumber && !this.phone) {
    this.phone = this.mobileNumber;
  } else if (this.phone && !this.mobileNumber) {
    this.mobileNumber = this.phone;
  }

  if (this.workType && !this.trade) {
    this.trade = this.workType;
  } else if (this.trade && !this.workType) {
    this.workType = this.trade;
  }

  next();
});

export default mongoose.model('Worker', workerSchema);
