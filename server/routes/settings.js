import express from 'express';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Payment from '../models/Payment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get site settings (optionally for specific site)
router.get('/', protect, async (req, res) => {
  try {
    const siteId = req.query.siteId || req.query.site;
    let site = null;
    if (siteId && siteId !== 'all') {
      site = await Site.findById(siteId);
    }
    if (!site) {
      site = await Site.findOne();
    }
    if (!site) {
      site = await Site.create({
        name: 'Om Sai Construction Site',
        location: 'Site Location #1',
        ownerName: req.user.name,
        standardDailyHours: 8,
        currencySymbol: '₹',
        isDefault: true,
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
    const { siteId, name, location, ownerName, standardDailyHours, currencySymbol } = req.body;

    let site = null;
    if (siteId) {
      site = await Site.findById(siteId);
    }
    if (!site) {
      site = await Site.findOne();
    }
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

// Summary for dashboard (scoped by site)
router.get('/dashboard', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const siteId = req.query.siteId || req.query.site;

    let site = null;
    if (siteId && siteId !== 'all') {
      site = await Site.findById(siteId);
    }
    if (!site) {
      site = await Site.findOne();
    }

    const workerFilter = { status: 'active' };
    if (site) {
      workerFilter.site = site._id;
    }

    const totalWorkers = await Worker.countDocuments(workerFilter);
    const siteWorkerIds = await Worker.find(site ? { site: site._id } : {}).distinct('_id');

    // Today's attendance for this site
    const todayAttendance = await Attendance.find({ date: today, worker: { $in: siteWorkerIds } })
      .populate('worker', 'workerId name workType trade dailyWage');
    const todayPresentCount = todayAttendance.filter(a => a.status === 'present' || a.hoursWorked > 0).length;
    const todayTotalHours = todayAttendance.reduce((acc, curr) => acc + (curr.hoursWorked || 0), 0);
    const todayWagesEarned = todayAttendance.reduce((acc, curr) => acc + (curr.wageEarned || 0), 0);

    // Recent payments for this site (last 5)
    const recentPayments = await Payment.find({ worker: { $in: siteWorkerIds } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('worker', 'workerId name workType trade dailyWage');

    // Total payments made this month for this site
    const currentMonthPrefix = today.substring(0, 7); // YYYY-MM
    const allMonthlyPayments = await Payment.find({
      date: { $regex: `^${currentMonthPrefix}` },
      worker: { $in: siteWorkerIds },
    });
    const monthlyPaymentTotal = allMonthlyPayments.reduce((acc, curr) => acc + curr.amount, 0);

    res.json({
      site: site || { name: 'Construction Site', standardDailyHours: 8, currencySymbol: '₹' },
      today,
      totalActiveWorkers: totalWorkers,
      todayPresentCount,
      todayTotalHours: Math.round(todayTotalHours * 100) / 100,
      todayWagesEarned: Math.round(todayWagesEarned),
      monthlyPaymentTotal: Math.round(monthlyPaymentTotal),
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
