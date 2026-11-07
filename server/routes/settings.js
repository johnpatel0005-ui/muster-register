import express from 'express';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Payment from '../models/Payment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get site settings
router.get('/', protect, async (req, res) => {
  try {
    let site = await Site.findOne();
    if (!site) {
      site = await Site.create({
        name: 'Om Sai Construction Site',
        location: 'Site Location #1',
        ownerName: req.user.name,
        standardDailyHours: 8,
        currencySymbol: '₹',
      });
    }
    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update site settings
router.put('/', protect, async (req, res) => {
  try {
    const { name, location, ownerName, standardDailyHours, currencySymbol } = req.body;

    let site = await Site.findOne();
    if (!site) {
      site = new Site();
    }

    if (name) site.name = name.trim();
    if (location !== undefined) site.location = location.trim();
    if (ownerName !== undefined) site.ownerName = ownerName.trim();
    if (standardDailyHours !== undefined) site.standardDailyHours = Number(standardDailyHours) || 8;
    if (currencySymbol !== undefined) site.currencySymbol = currencySymbol.trim() || '₹';

    await site.save();
    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Summary for dashboard
router.get('/dashboard', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalWorkers = await Worker.countDocuments({ status: 'active' });
    const site = await Site.findOne();

    // Today's attendance
    const todayAttendance = await Attendance.find({ date: today }).populate('worker', 'workerId name workType trade dailyWage');
    const todayPresentCount = todayAttendance.filter(a => a.status === 'present' || a.hoursWorked > 0).length;
    const todayTotalHours = todayAttendance.reduce((acc, curr) => acc + (curr.hoursWorked || 0), 0);
    const todayWagesEarned = todayAttendance.reduce((acc, curr) => acc + (curr.wageEarned || 0), 0);

    // Recent payments (last 5)
    const recentPayments = await Payment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('worker', 'workerId name workType trade dailyWage');

    // Total payments made this month
    const currentMonthPrefix = today.substring(0, 7); // YYYY-MM
    const allMonthlyPayments = await Payment.find({
      date: { $regex: `^${currentMonthPrefix}` },
    });
    const monthlyPaymentTotal = allMonthlyPayments.reduce((acc, curr) => acc + curr.amount, 0);

    res.json({
      site: site || { name: 'Construction Site', standardDailyHours: 8, currencySymbol: '₹' },
      today,
      totalActiveWorkers: totalWorkers,
      todayPresentCount,
      todayTotalHours,
      todayWagesEarned: Math.round(todayWagesEarned),
      monthlyPaymentTotal,
      recentPayments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset all operational data (Workers, Attendance, Payments)
router.post('/reset-data', protect, async (req, res) => {
  try {
    const deletedWorkers = await Worker.deleteMany({});
    const deletedAttendance = await Attendance.deleteMany({});
    const deletedPayments = await Payment.deleteMany({});

    res.json({
      message: 'All operational records cleared successfully.',
      deletedWorkers: deletedWorkers.deletedCount,
      deletedAttendance: deletedAttendance.deletedCount,
      deletedPayments: deletedPayments.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
