import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: [true, 'Worker is required'],
      index: true,
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['advance', 'wage_payment'],
      default: 'advance',
      required: true,
      index: true,
    },
    // paymentType is kept in sync for backward compatibility
    paymentType: {
      type: String,
      default: 'advance',
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    date: {
      type: String, // Stored as YYYY-MM-DD
      required: [true, 'Date is required'],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Other'],
      default: 'Cash',
      required: true,
    },
    // paymentMode is kept in sync for backward compatibility
    paymentMode: {
      type: String,
      default: 'Cash',
    },
    referenceNumber: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Pre-validate hook to normalize and sync fields
paymentSchema.pre('validate', function (next) {
  // Sync transactionType <-> paymentType
  if (!this.transactionType && this.paymentType) {
    this.transactionType = this.paymentType === 'advance' ? 'advance' : 'wage_payment';
  } else if (this.transactionType) {
    this.paymentType = this.transactionType;
  }

  // Normalize paymentMethod
  if (this.paymentMethod) {
    const raw = this.paymentMethod.toLowerCase().replace(/_/g, ' ');
    if (raw === 'cash') this.paymentMethod = 'Cash';
    else if (raw === 'upi') this.paymentMethod = 'UPI';
    else if (raw.includes('bank')) this.paymentMethod = 'Bank Transfer';
    else this.paymentMethod = 'Other';
  } else if (this.paymentMode) {
    const raw = this.paymentMode.toLowerCase().replace(/_/g, ' ');
    if (raw === 'cash') this.paymentMethod = 'Cash';
    else if (raw === 'upi') this.paymentMethod = 'UPI';
    else if (raw.includes('bank')) this.paymentMethod = 'Bank Transfer';
    else this.paymentMethod = 'Other';
  } else {
    this.paymentMethod = 'Cash';
  }

  this.paymentMode = this.paymentMethod;
  next();
});

export default mongoose.model('Payment', paymentSchema);
