import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: true,
      index: true,
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      index: true,
    },
    date: {
      type: String, // Stored as YYYY-MM-DD
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'leave'],
      required: true,
      default: 'present',
    },
    inTime: {
      type: String,
      default: '08:00',
      trim: true,
    },
    outTime: {
      type: String,
      default: '17:00',
      trim: true,
    },
    breakMinutes: {
      type: Number,
      default: 60,
      min: 0,
      max: 1440,
    },
    workingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    hoursWorked: {
      type: Number,
      default: 0,
      min: 0,
    },
    regularHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    wageEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Wage snapshot preserved at time of attendance recording
    wageSnapshot: {
      dailyWage: { type: Number, default: 0 },
      standardHours: { type: Number, default: 8 },
      overtimeMultiplier: { type: Number, default: 1.5 },
      hourlyWage: { type: Number, default: 0 },
      regularWage: { type: Number, default: 0 },
      overtimeWage: { type: Number, default: 0 },
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate attendance for the same worker and date
attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
