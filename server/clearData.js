import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Site from './models/Site.js';
import Worker from './models/Worker.js';
import Attendance from './models/Attendance.js';
import Payment from './models/Payment.js';

dotenv.config();

const clearAll = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/muster_register';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Delete all workers
    const wRes = await Worker.deleteMany({});
    console.log(`Deleted ${wRes.deletedCount} worker records.`);

    // 2. Delete all attendance records
    const aRes = await Attendance.deleteMany({});
    console.log(`Deleted ${aRes.deletedCount} attendance records.`);

    // 3. Delete all payment records
    const pRes = await Payment.deleteMany({});
    console.log(`Deleted ${pRes.deletedCount} payment records.`);

    // 4. Reset site configuration
    await Site.deleteMany({});
    console.log('Reset site configuration.');

    // 5. Reset user accounts to a clean single owner
    await User.deleteMany({});
    const defaultOwner = await User.create({
      username: process.env.DEFAULT_OWNER_USERNAME || 'owner',
      password: process.env.DEFAULT_OWNER_PASSWORD || 'construction123',
      name: 'Site Owner',
      role: 'owner',
    });
    console.log('Created clean single owner account: owner / construction123');

    await Site.create({
      name: process.env.DEFAULT_SITE_NAME || 'Main Construction Site',
      location: 'Site Location #1',
      ownerName: defaultOwner.name,
      standardDailyHours: 8,
      currencySymbol: '₹',
    });
    console.log('Created clean site settings.');

    console.log('\n=== ALL DATA CLEARED SUCCESSFULLY. DATABASE IS FRESH! ===');
    process.exit(0);
  } catch (err) {
    console.error('Error clearing data:', err);
    process.exit(1);
  }
};

clearAll();
