import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { connectDB } from './config/db.js';

import authRoutes from './routes/auth.js';
import workersRoutes from './routes/workers.js';
import attendanceRoutes from './routes/attendance.js';
import paymentsRoutes from './routes/payments.js';
import settingsRoutes from './routes/settings.js';
import sitesRoutes from './routes/sites.js';

import User from './models/User.js';
import Site from './models/Site.js';
import Worker from './models/Worker.js';
import { backfillExistingWorkers } from './controllers/workerController.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sites', sitesRoutes);

// Serve static frontend build in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../client/dist');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for React Router (send index.html for non-API routes)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Seed initial data if empty
const seedInitialData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const username = process.env.DEFAULT_OWNER_USERNAME || 'owner';
      const password = process.env.DEFAULT_OWNER_PASSWORD || 'construction123';
      const defaultOwner = await User.create({
        username,
        password,
        name: 'Site Owner',
        role: 'owner',
      });
      console.log(`Default owner account created: ${username} / ${password}`);

      const siteName = process.env.DEFAULT_SITE_NAME || 'Main Construction Site';
      await Site.create({
        name: siteName,
        location: 'Site Location #1',
        ownerName: defaultOwner.name,
        standardDailyHours: 8,
        currencySymbol: '₹',
      });
      console.log(`Default site settings created: ${siteName}`);
    }

    // Always ensure existing workers have unique workerId and all fields
    await backfillExistingWorkers();
  } catch (err) {
    console.error('Error in initial data seed:', err.message);
  }
};

const PORT = process.env.PORT || 5000;

// Start Server after connecting to MongoDB
connectDB().then(async () => {
  await seedInitialData();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Muster Register backend running on port ${PORT}`);
  });
});
