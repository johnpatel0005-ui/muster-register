import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Payment from '../models/Payment.js';
import Site from '../models/Site.js';

// Helper to generate the next unique Worker ID (e.g., WRK-001, WRK-002)
export const generateNextWorkerId = async () => {
  const workers = await Worker.find({}, { workerId: 1 }).lean();
  let maxNum = 0;

  for (const w of workers) {
    if (w.workerId) {
      const match = w.workerId.match(/^WRK-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `WRK-${String(nextNum).padStart(3, '0')}`;
};

// Backfill existing workers who might not have workerId or new fields
export const backfillExistingWorkers = async () => {
  try {
    const workers = await Worker.find({});
    let nextNum = 1;

    for (const worker of workers) {
      let modified = false;

      if (!worker.workerId) {
        // Find an unused WRK-XXX
        let candidateId = `WRK-${String(nextNum).padStart(3, '0')}`;
        while (await Worker.findOne({ workerId: candidateId })) {
          nextNum++;
          candidateId = `WRK-${String(nextNum).padStart(3, '0')}`;
        }
        worker.workerId = candidateId;
        nextNum++;
        modified = true;
      }

      if (!worker.standardWorkingHours) {
        worker.standardWorkingHours = 8;
        modified = true;
      }

      if (!worker.overtimeMultiplier) {
        worker.overtimeMultiplier = 1.0;
        modified = true;
      }

      if (!worker.joiningDate) {
        worker.joiningDate = worker.createdAt || new Date();
        modified = true;
      }

      if (!worker.workType && worker.trade) {
        worker.workType = worker.trade;
        modified = true;
      }

      if (!worker.mobileNumber && worker.phone) {
        worker.mobileNumber = worker.phone;
        modified = true;
      }

      if (modified) {
        await worker.save();
      }
    }
  } catch (error) {
    console.error('Worker backfill error:', error.message);
  }
};

// GET /api/workers/next-id - preview the next worker ID
export const getNextId = async (req, res) => {
  try {
    const nextId = await generateNextWorkerId();
    res.json({ nextId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/workers - list workers with search & status filter
export const getWorkers = async (req, res) => {
  try {
    const { search, status, workType } = req.query;
    const filter = {};

    // Filter by status (active / inactive / all)
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Filter by workType
    if (workType && workType !== 'all') {
      filter.$or = [
        { workType: new RegExp(workType, 'i') },
        { trade: new RegExp(workType, 'i') },
      ];
    }

    // Search by name, workerId, or mobileNumber
    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: regex },
          { workerId: regex },
          { mobileNumber: regex },
          { phone: regex },
          { workType: regex },
          { trade: regex },
        ],
      });
    }

    const workers = await Worker.find(filter).sort({ workerId: 1, name: 1 });
    res.json(workers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/workers/:id - single worker details + historical statistics
export const getWorkerById = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Calculate total earned and hours from attendance
    const attendances = await Attendance.find({ worker: worker._id }).sort({ date: -1 });
    const totalEarned = attendances.reduce((acc, curr) => acc + (curr.wageEarned || 0), 0);
    const totalHours = attendances.reduce((acc, curr) => acc + (curr.hoursWorked || 0), 0);
    const daysWorked = attendances.filter((a) => a.hoursWorked > 0).length;

    // Calculate total paid from payments
    const payments = await Payment.find({ worker: worker._id }).sort({ date: -1 });
    const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);

    const balanceDue = Math.round(totalEarned - totalPaid);

    res.json({
      worker,
      summary: {
        totalHours,
        daysWorked,
        totalEarned: Math.round(totalEarned),
        totalPaid,
        balanceDue,
      },
      recentAttendance: attendances.slice(0, 7),
      recentPayments: payments.slice(0, 7),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/workers - create worker with auto-generated unique ID
export const createWorker = async (req, res) => {
  try {
    let {
      workerId,
      name,
      mobileNumber,
      phone,
      workType,
      trade,
      dailyWage,
      standardWorkingHours,
      overtimeMultiplier,
      joiningDate,
      status,
      notes,
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Worker name is required' });
    }

    if (dailyWage === undefined || dailyWage === null || Number(dailyWage) < 0) {
      return res.status(400).json({ message: 'A valid daily wage rate is required' });
    }

    // Auto-generate or sanitize unique workerId
    if (!workerId || !workerId.trim()) {
      workerId = await generateNextWorkerId();
    } else {
      workerId = workerId.trim().toUpperCase();
      const existing = await Worker.findOne({ workerId });
      if (existing) {
        return res.status(400).json({ message: `Worker ID "${workerId}" already exists. Please choose a unique ID.` });
      }
    }

    // Default site standard daily hours if not provided
    if (!standardWorkingHours) {
      const site = await Site.findOne();
      standardWorkingHours = site?.standardDailyHours || 8;
    }

    const worker = await Worker.create({
      workerId,
      name: name.trim(),
      mobileNumber: (mobileNumber || phone || '').trim(),
      phone: (phone || mobileNumber || '').trim(),
      workType: (workType || trade || 'Helper').trim(),
      trade: (trade || workType || 'Helper').trim(),
      dailyWage: Number(dailyWage),
      standardWorkingHours: Number(standardWorkingHours) || 8,
      overtimeMultiplier: Number(overtimeMultiplier) || 1.0,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      status: status === 'inactive' ? 'inactive' : 'active',
      notes: (notes || '').trim(),
    });

    res.status(201).json(worker);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Worker ID must be unique. A worker with this ID already exists.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/workers/:id - edit worker details
export const updateWorker = async (req, res) => {
  try {
    const {
      workerId,
      name,
      mobileNumber,
      phone,
      workType,
      trade,
      dailyWage,
      standardWorkingHours,
      overtimeMultiplier,
      joiningDate,
      status,
      notes,
    } = req.body;

    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Check if workerId is being changed to another that already exists
    if (workerId && workerId.trim().toUpperCase() !== worker.workerId) {
      const targetId = workerId.trim().toUpperCase();
      const existing = await Worker.findOne({ workerId: targetId });
      if (existing && existing._id.toString() !== worker._id.toString()) {
        return res.status(400).json({ message: `Worker ID "${targetId}" is already assigned to another worker.` });
      }
      worker.workerId = targetId;
    }

    if (name) worker.name = name.trim();
    if (mobileNumber !== undefined || phone !== undefined) {
      const mNum = (mobileNumber || phone || '').trim();
      worker.mobileNumber = mNum;
      worker.phone = mNum;
    }
    if (workType !== undefined || trade !== undefined) {
      const wType = (workType || trade || 'Helper').trim();
      worker.workType = wType;
      worker.trade = wType;
    }
    if (dailyWage !== undefined) worker.dailyWage = Math.max(0, Number(dailyWage));
    if (standardWorkingHours !== undefined) worker.standardWorkingHours = Math.max(1, Number(standardWorkingHours));
    if (overtimeMultiplier !== undefined) worker.overtimeMultiplier = Math.max(1.0, Number(overtimeMultiplier));
    if (joiningDate) worker.joiningDate = new Date(joiningDate);
    if (status !== undefined) worker.status = status;
    if (notes !== undefined) worker.notes = notes.trim();

    await worker.save();
    res.json(worker);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Worker ID must be unique.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/workers/:id/status - mark active or inactive
export const toggleWorkerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    if (status && ['active', 'inactive'].includes(status)) {
      worker.status = status;
    } else {
      // Toggle
      worker.status = worker.status === 'active' ? 'inactive' : 'active';
    }

    await worker.save();
    res.json({
      message: `Worker ${worker.name} marked as ${worker.status}`,
      worker,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/workers/:id
export const deleteWorker = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Check if worker has historical attendance or payment records
    const attendanceCount = await Attendance.countDocuments({ worker: worker._id });
    const paymentCount = await Payment.countDocuments({ worker: worker._id });

    if (attendanceCount > 0 || paymentCount > 0) {
      // Must not delete historical data; soft deactivate instead!
      worker.status = 'inactive';
      await worker.save();
      return res.json({
        message: 'Worker has historical muster attendance/payment records and was safely marked inactive rather than deleted.',
        worker,
        preserved: true,
      });
    }

    // No historical records exist, safe to remove completely
    await Worker.findByIdAndDelete(worker._id);
    res.json({ message: 'Worker deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
