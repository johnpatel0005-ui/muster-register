import express from 'express';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Payment from '../models/Payment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/sites - list all construction sites
router.get('/', protect, async (req, res) => {
  try {
    let sites = await Site.find().sort({ createdAt: 1 }).lean();

    if (sites.length === 0) {
      const defaultSite = await Site.create({
        name: 'Main Construction Site',
        location: 'Site Location #1',
        ownerName: req.user.name || 'Site Owner',
        standardDailyHours: 8,
        currencySymbol: '₹',
        isDefault: true,
      });
      sites = [defaultSite.toObject()];
    }

    // Attach worker counts to each site
    const sitesWithCounts = await Promise.all(
      sites.map(async (s) => {
        const activeWorkers = await Worker.countDocuments({ site: s._id, status: 'active' });
        const totalWorkers = await Worker.countDocuments({ site: s._id });
        return {
          ...s,
          activeWorkers,
          totalWorkers,
        };
      })
    );

    res.json(sitesWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/sites - create a new construction site
router.post('/', protect, async (req, res) => {
  try {
    const { name, location, ownerName, standardDailyHours, currencySymbol } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Site name is required' });
    }

    const existingCount = await Site.countDocuments();

    const site = await Site.create({
      name: name.trim(),
      location: (location || '').trim(),
      ownerName: (ownerName || req.user.name || 'Site Owner').trim(),
      standardDailyHours: Number(standardDailyHours) > 0 ? Number(standardDailyHours) : 8,
      currencySymbol: (currencySymbol || '₹').trim(),
      status: 'active',
      isDefault: existingCount === 0,
    });

    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/sites/:id - get site details
router.get('/:id', protect, async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const activeWorkers = await Worker.countDocuments({ site: site._id, status: 'active' });
    const totalWorkers = await Worker.countDocuments({ site: site._id });

    res.json({
      ...site.toObject(),
      activeWorkers,
      totalWorkers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/sites/:id - update site details
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, location, ownerName, standardDailyHours, currencySymbol, status } = req.body;

    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (name) site.name = name.trim();
    if (location !== undefined) site.location = location.trim();
    if (ownerName !== undefined) site.ownerName = ownerName.trim();
    if (standardDailyHours !== undefined && Number(standardDailyHours) > 0) {
      site.standardDailyHours = Number(standardDailyHours);
    }
    if (currencySymbol !== undefined) site.currencySymbol = currencySymbol.trim() || '₹';
    if (status && ['active', 'completed', 'archived'].includes(status)) {
      site.status = status;
    }

    await site.save();
    res.json(site);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/sites/:id - delete site if it has no workers
router.delete('/:id', protect, async (req, res) => {
  try {
    const totalSites = await Site.countDocuments();
    if (totalSites <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only construction site.' });
    }

    const workersCount = await Worker.countDocuments({ site: req.params.id });
    if (workersCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this site because it has ${workersCount} worker(s) registered. Please transfer or remove the workers first.`,
      });
    }

    const attendanceCount = await Attendance.countDocuments({ site: req.params.id });
    if (attendanceCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this site because it has historical attendance records. You can archive it instead.`,
      });
    }

    await Site.findByIdAndDelete(req.params.id);
    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
