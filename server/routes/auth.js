import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Site from '../models/Site.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'muster_register_super_secret_key_2026', {
    expiresIn: '30d',
  });
};

// Check if owner exists
router.get('/status', async (req, res) => {
  try {
    const ownerCount = await User.countDocuments();
    let site = await Site.findOne();
    if (!site) {
      site = await Site.create({
        name: process.env.DEFAULT_SITE_NAME || 'Om Sai Construction Site',
        location: 'Plot 42, Industrial Area',
        ownerName: 'Site Owner',
      });
    }

    res.json({
      hasOwner: ownerCount > 0,
      siteName: site.name,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Setup the single owner account (only allowed if no owner exists)
router.post('/setup', async (req, res) => {
  try {
    const ownerCount = await User.countDocuments();
    if (ownerCount > 0) {
      return res.status(400).json({ message: 'Owner account is already configured. Please login.' });
    }

    const { username, password, name, siteName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.create({
      username: username.toLowerCase().trim(),
      password,
      name: name || 'Site Owner',
      role: 'owner',
    });

    if (siteName) {
      await Site.findOneAndUpdate({}, { name: siteName, ownerName: user.name }, { upsert: true });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current owner info & sites
router.get('/me', protect, async (req, res) => {
  try {
    const sites = await Site.find().sort({ createdAt: 1 });
    const defaultSite = sites.find(s => s.isDefault) || sites[0] || { name: 'Construction Site', standardDailyHours: 8, currencySymbol: '₹' };
    res.json({
      user: req.user,
      site: defaultSite,
      sites,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update profile / password
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (name) {
      user.name = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password required to set new password' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }
      user.password = newPassword;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
