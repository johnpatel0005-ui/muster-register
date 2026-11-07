import express from 'express';
import Payment from '../models/Payment.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to normalize payment method
const normalizePaymentMethod = (method) => {
  if (!method) return 'Cash';
  const clean = method.toString().toLowerCase().replace(/_/g, ' ').trim();
  if (clean === 'cash') return 'Cash';
  if (clean === 'upi') return 'UPI';
  if (clean.includes('bank')) return 'Bank Transfer';
  return 'Other';
};

// GET /api/payments/balances - get all workers' calculated outstanding balances
router.get('/balances', protect, async (req, res) => {
  try {
    const workers = await Worker.find().sort({ workerId: 1, name: 1 });

    // Aggregate all earned wages per worker from Attendance
    const attendances = await Attendance.find({}, { worker: 1, wageEarned: 1, status: 1 });
    const earnedMap = new Map();
    for (const att of attendances) {
      if (att.worker) {
        const wId = att.worker.toString();
        const current = earnedMap.get(wId) || 0;
        earnedMap.set(wId, current + (att.wageEarned || 0));
      }
    }

    // Aggregate all advances and payments per worker from Payment
    const payments = await Payment.find({}, { worker: 1, amount: 1, transactionType: 1, paymentType: 1 });
    const advancesMap = new Map();
    const wagePaymentsMap = new Map();

    for (const p of payments) {
      if (p.worker) {
        const wId = p.worker.toString();
        const isAdvance = (p.transactionType || p.paymentType) === 'advance';
        if (isAdvance) {
          const currAdv = advancesMap.get(wId) || 0;
          advancesMap.set(wId, currAdv + (p.amount || 0));
        } else {
          const currPay = wagePaymentsMap.get(wId) || 0;
          wagePaymentsMap.set(wId, currPay + (p.amount || 0));
        }
      }
    }

    const balances = workers.map((w) => {
      const wId = w._id.toString();
      const totalEarned = Math.round(earnedMap.get(wId) || 0);
      const totalAdvances = Math.round(advancesMap.get(wId) || 0);
      const totalPayments = Math.round(wagePaymentsMap.get(wId) || 0);
      const totalPaid = totalAdvances + totalPayments;
      const outstanding = totalEarned - totalPaid;

      return {
        workerId: w._id,
        workerCode: w.workerId || '',
        name: w.name,
        workType: w.workType || w.trade || 'Helper',
        dailyWage: w.dailyWage,
        status: w.status,
        totalEarned,
        totalAdvances,
        totalPayments,
        totalPaid,
        outstanding,
      };
    });

    res.json(balances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/payments/balance/:workerId - single worker balance breakdown
router.get('/balance/:workerId', protect, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Total earned from attendance
    const attendances = await Attendance.find({ worker: worker._id }, { wageEarned: 1 });
    const totalEarned = Math.round(attendances.reduce((acc, curr) => acc + (curr.wageEarned || 0), 0));

    // Total advances & payments
    const payments = await Payment.find({ worker: worker._id }, { amount: 1, transactionType: 1, paymentType: 1 });
    let totalAdvances = 0;
    let totalPayments = 0;

    for (const p of payments) {
      const isAdvance = (p.transactionType || p.paymentType) === 'advance';
      if (isAdvance) {
        totalAdvances += p.amount || 0;
      } else {
        totalPayments += p.amount || 0;
      }
    }

    totalAdvances = Math.round(totalAdvances);
    totalPayments = Math.round(totalPayments);
    const totalPaid = totalAdvances + totalPayments;
    const outstanding = totalEarned - totalPaid;

    res.json({
      workerId: worker._id,
      workerCode: worker.workerId || '',
      name: worker.name,
      workType: worker.workType || worker.trade || 'Helper',
      dailyWage: worker.dailyWage,
      totalEarned,
      totalAdvances,
      totalPayments,
      totalPaid,
      outstanding,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/payments - get list of payments/advances with filtering
router.get('/', protect, async (req, res) => {
  try {
    const { workerId, date, month, transactionType, paymentMethod } = req.query;
    const filter = {};

    if (workerId && workerId !== 'all') {
      filter.worker = workerId;
    }

    if (date) {
      filter.date = date;
    } else if (month) {
      filter.date = { $regex: `^${month}` };
    }

    if (transactionType && transactionType !== 'all') {
      filter.$or = [{ transactionType }, { paymentType: transactionType }];
    }

    if (paymentMethod && paymentMethod !== 'all') {
      const norm = normalizePaymentMethod(paymentMethod);
      filter.$or = [{ paymentMethod: norm }, { paymentMode: norm }, { paymentMode: norm.toLowerCase() }];
    }

    const payments = await Payment.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .populate('worker', 'workerId name workType trade dailyWage');

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/payments - record a new Advance or Wage Payment
router.post('/', protect, async (req, res) => {
  try {
    const { workerId, amount, date, transactionType, paymentType, paymentMethod, paymentMode, referenceNumber, notes } = req.body;

    if (!workerId) {
      return res.status(400).json({ message: 'Worker is required' });
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be a valid number greater than 0' });
    }

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Selected worker was not found' });
    }

    const paymentDate = date && date.trim() ? date.trim() : new Date().toISOString().split('T')[0];
    const type = (transactionType || paymentType || 'advance').toLowerCase() === 'wage_payment' ? 'wage_payment' : 'advance';
    const method = normalizePaymentMethod(paymentMethod || paymentMode);

    const payment = await Payment.create({
      worker: workerId,
      amount: Math.round(numAmount * 100) / 100,
      date: paymentDate,
      transactionType: type,
      paymentType: type,
      paymentMethod: method,
      paymentMode: method,
      referenceNumber: referenceNumber ? referenceNumber.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    const populated = await Payment.findById(payment._id).populate('worker', 'workerId name workType trade dailyWage');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/payments/:id - edit existing payment/advance record
router.put('/:id', protect, async (req, res) => {
  try {
    const { workerId, amount, date, transactionType, paymentType, paymentMethod, paymentMode, referenceNumber, notes } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Transaction record not found' });
    }

    if (workerId) {
      const worker = await Worker.findById(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }
      payment.worker = workerId;
    }

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: 'Amount must be a valid number greater than 0' });
      }
      payment.amount = Math.round(numAmount * 100) / 100;
    }

    if (date) {
      payment.date = date.trim();
    }

    if (transactionType || paymentType) {
      const type = (transactionType || paymentType).toLowerCase() === 'wage_payment' ? 'wage_payment' : 'advance';
      payment.transactionType = type;
      payment.paymentType = type;
    }

    if (paymentMethod || paymentMode) {
      const method = normalizePaymentMethod(paymentMethod || paymentMode);
      payment.paymentMethod = method;
      payment.paymentMode = method;
    }

    if (referenceNumber !== undefined) {
      payment.referenceNumber = referenceNumber.trim();
    }

    if (notes !== undefined) {
      payment.notes = notes.trim();
    }

    await payment.save();

    const populated = await Payment.findById(payment._id).populate('worker', 'workerId name workType trade dailyWage');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/payments/:id - delete a transaction
router.delete('/:id', protect, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
