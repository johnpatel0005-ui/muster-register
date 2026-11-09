import express from 'express';
import Attendance from '../models/Attendance.js';
import Worker from '../models/Worker.js';
import Site from '../models/Site.js';
import Payment from '../models/Payment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to calculate shift hours, overtime, and wages based on user specification
export const calculateShiftWage = ({
  inTime = '08:00',
  outTime = '17:00',
  breakMinutes = 60,
  dailyWage = 500,
  standardHours = 8,
  overtimeMultiplier = 1.5,
  status = 'present',
}) => {
  const stdHours = Number(standardHours) > 0 ? Number(standardHours) : 8;
  const otMult = Number(overtimeMultiplier) >= 1 ? Number(overtimeMultiplier) : 1.5;
  const dWage = Number(dailyWage) >= 0 ? Number(dailyWage) : 0;
  const hourlyWage = stdHours > 0 ? dWage / stdHours : 0;

  // For Absent or Leave, working hours and wages are 0
  if (status === 'absent' || status === 'leave') {
    return {
      status,
      inTime: '',
      outTime: '',
      breakMinutes: 0,
      workingMinutes: 0,
      hoursWorked: 0,
      regularHours: 0,
      overtimeMinutes: 0,
      overtimeHours: 0,
      wageEarned: 0,
      wageSnapshot: {
        dailyWage: dWage,
        standardHours: stdHours,
        overtimeMultiplier: otMult,
        hourlyWage: Math.round(hourlyWage * 100) / 100,
        regularWage: 0,
        overtimeWage: 0,
      },
    };
  }

  // Parse inTime and outTime (HH:mm)
  const parseTimeToMinutes = (tStr) => {
    if (!tStr || typeof tStr !== 'string' || !tStr.includes(':')) return 0;
    const [h, m] = tStr.split(':').map((v) => parseInt(v, 10) || 0);
    return h * 60 + m;
  };

  const inMins = parseTimeToMinutes(inTime);
  let outMins = parseTimeToMinutes(outTime);

  // Support overnight shifts: if outTime is less than inTime, the shift crosses midnight
  if (outMins < inMins) {
    outMins += 24 * 60; // Add 1440 minutes (24 hours)
  }

  const brk = Math.max(0, parseInt(breakMinutes, 10) || 0);
  const totalElapsed = outMins - inMins;
  const workingMinutes = Math.max(0, totalElapsed - brk);

  const standardWorkingMinutes = stdHours * 60;
  const overtimeMinutes = Math.max(0, workingMinutes - standardWorkingMinutes);
  const regularMinutes = Math.max(0, workingMinutes - overtimeMinutes);

  const regularHours = regularMinutes / 60;
  const overtimeHours = overtimeMinutes / 60;
  const hoursWorked = workingMinutes / 60;

  const regularWage = hourlyWage * regularHours;
  const overtimeWage = hourlyWage * overtimeHours * otMult;
  const totalEarnedWage = regularWage + overtimeWage;

  return {
    status: 'present',
    inTime,
    outTime,
    breakMinutes: brk,
    workingMinutes,
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeMinutes,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    wageEarned: Math.round(totalEarnedWage * 100) / 100,
    wageSnapshot: {
      dailyWage: dWage,
      standardHours: stdHours,
      overtimeMultiplier: otMult,
      hourlyWage: Math.round(hourlyWage * 100) / 100,
      regularWage: Math.round(regularWage * 100) / 100,
      overtimeWage: Math.round(overtimeWage * 100) / 100,
    },
  };
};

// GET /api/attendance/daily?date=YYYY-MM-DD&siteId=...
// Returns attendance for all active workers for the selected date and site
router.get('/daily', protect, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const siteId = req.query.siteId || req.query.site;

    let site = null;
    if (siteId && siteId !== 'all') {
      site = await Site.findById(siteId);
    }
    if (!site) {
      site = await Site.findOne();
    }
    const defaultSiteHours = site?.standardDailyHours || 8;

    // Get all active workers for this site
    const workerFilter = { status: 'active' };
    if (site) {
      workerFilter.site = site._id;
    }
    const workers = await Worker.find(workerFilter).sort({ workerId: 1, name: 1 });
    const workerIds = workers.map((w) => w._id);

    // Get attendance records for this date and workers
    const records = await Attendance.find({ date, worker: { $in: workerIds } });
    const recordMap = new Map();
    records.forEach((r) => recordMap.set(r.worker.toString(), r));

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let notMarkedCount = 0;
    let totalWorkingHours = 0;
    let totalWageBill = 0;

    const sheet = workers.map((w) => {
      const existing = recordMap.get(w._id.toString());
      const stdHours = w.standardWorkingHours || defaultSiteHours;
      const otMultiplier = w.overtimeMultiplier || 1.5;

      if (existing) {
        const currentStatus = existing.status === 'half_day' ? 'present' : existing.status;

        if (currentStatus === 'present') {
          presentCount++;
          totalWorkingHours += existing.hoursWorked || 0;
          totalWageBill += existing.wageEarned || 0;
        } else if (currentStatus === 'absent') {
          absentCount++;
        } else if (currentStatus === 'leave') {
          leaveCount++;
        }

        return {
          workerId: w._id,
          workerCode: w.workerId || '',
          name: w.name,
          trade: w.workType || w.trade,
          workType: w.workType || w.trade,
          dailyWage: w.dailyWage,
          standardWorkingHours: stdHours,
          overtimeMultiplier: otMultiplier,
          isMarked: true,
          status: currentStatus,
          inTime: existing.inTime || '08:00',
          outTime: existing.outTime || '17:00',
          breakMinutes: existing.breakMinutes ?? 60,
          workingMinutes: existing.workingMinutes || 0,
          hoursWorked: existing.hoursWorked || 0,
          overtimeMinutes: existing.overtimeMinutes || 0,
          overtimeHours: existing.overtimeHours || 0,
          wageEarned: existing.wageEarned || 0,
          wageSnapshot: existing.wageSnapshot || null,
          notes: existing.notes || '',
          recordId: existing._id,
        };
      } else {
        notMarkedCount++;
        return {
          workerId: w._id,
          workerCode: w.workerId || '',
          name: w.name,
          trade: w.workType || w.trade,
          workType: w.workType || w.trade,
          dailyWage: w.dailyWage,
          standardWorkingHours: stdHours,
          overtimeMultiplier: otMultiplier,
          isMarked: false,
          status: 'not_marked',
          inTime: '08:00',
          outTime: '17:00',
          breakMinutes: 60,
          workingMinutes: 0,
          hoursWorked: 0,
          overtimeMinutes: 0,
          overtimeHours: 0,
          wageEarned: 0,
          wageSnapshot: null,
          notes: '',
          recordId: null,
        };
      }
    });

    res.json({
      date,
      standardHours: defaultSiteHours,
      currencySymbol: site?.currencySymbol || '₹',
      totalWorkers: workers.length,
      presentWorkers: presentCount,
      absentWorkers: absentCount,
      leaveWorkers: leaveCount,
      notMarkedWorkers: notMarkedCount,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      totalWageBill: Math.round(totalWageBill),
      sheet,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/attendance/batch
// Bulk save or edit attendance records for a specific date
router.post('/batch', protect, async (req, res) => {
  try {
    const { date, entries } = req.body;

    if (!date || !Array.isArray(entries)) {
      return res.status(400).json({ message: 'Valid date and entries array are required' });
    }

    const site = await Site.findOne();
    const defaultSiteHours = site?.standardDailyHours || 8;

    // Fetch worker wage and shift settings
    const workerIds = entries.map((e) => e.workerId).filter(Boolean);
    const workers = await Worker.find({ _id: { $in: workerIds } });
    const workerMap = new Map();
    workers.forEach((w) => {
      if (w?._id) workerMap.set(w._id.toString(), w);
    });

    // Fetch existing attendance records to check snapshots if editing
    const existingRecords = await Attendance.find({
      date,
      worker: { $in: workerIds },
    });
    const existingRecordMap = new Map();
    existingRecords.forEach((r) => {
      if (r?.worker) existingRecordMap.set(r.worker.toString(), r);
    });

    const bulkOps = [];
    const deleteWorkerIds = [];

    for (const entry of entries) {
      if (!entry?.workerId) continue;
      const worker = workerMap.get(entry.workerId.toString());
      if (!worker) continue;

      const rawStatus = (entry.status || '').toLowerCase().trim();

      // If owner explicitly resets worker to "not_marked", remove the record
      if (rawStatus === 'not_marked' || !rawStatus) {
        deleteWorkerIds.push(entry.workerId);
        continue;
      }

      // Valid statuses: present, absent, leave
      const status = ['present', 'absent', 'leave'].includes(rawStatus) ? rawStatus : 'present';

      // Check if existing record already has a wage snapshot
      const existing = existingRecordMap.get(entry.workerId.toString());
      
      const dWage = existing?.wageSnapshot?.dailyWage ?? worker.dailyWage;
      const stdHours = existing?.wageSnapshot?.standardHours ?? (worker.standardWorkingHours || defaultSiteHours);
      const otMult = existing?.wageSnapshot?.overtimeMultiplier ?? (worker.overtimeMultiplier || 1.5);

      const calculated = calculateShiftWage({
        inTime: entry.inTime || '08:00',
        outTime: entry.outTime || '17:00',
        breakMinutes: entry.breakMinutes ?? 60,
        dailyWage: dWage,
        standardHours: stdHours,
        overtimeMultiplier: otMult,
        status,
      });

      const siteId = worker?.site || site?._id;

      bulkOps.push({
        updateOne: {
          filter: { worker: entry.workerId, date },
          update: {
            $set: {
              site: siteId,
              status: calculated.status,
              inTime: calculated.inTime,
              outTime: calculated.outTime,
              breakMinutes: calculated.breakMinutes,
              workingMinutes: calculated.workingMinutes,
              hoursWorked: calculated.hoursWorked,
              regularHours: calculated.regularHours,
              overtimeMinutes: calculated.overtimeMinutes,
              overtimeHours: calculated.overtimeHours,
              wageEarned: calculated.wageEarned,
              wageSnapshot: calculated.wageSnapshot,
              notes: (entry.notes || '').trim(),
            },
          },
          upsert: true,
        },
      });
    }

    if (deleteWorkerIds.length > 0) {
      await Attendance.deleteMany({
        date,
        worker: { $in: deleteWorkerIds },
      });
    }

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    res.json({
      message: 'Attendance saved successfully',
      savedCount: bulkOps.length,
      removedCount: deleteWorkerIds.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/attendance/muster?month=YYYY-MM OR ?month=MM&year=YYYY
// Comprehensive Monthly Muster Register Report
router.get('/muster', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let monthParam = req.query.month;
    let yearParam = req.query.year;

    let year, monthNum, formattedMonth;

    if (monthParam && monthParam.includes('-')) {
      const parts = monthParam.split('-');
      year = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
      formattedMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
    } else if (monthParam && yearParam) {
      year = parseInt(yearParam, 10);
      monthNum = parseInt(monthParam, 10);
      formattedMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
    } else {
      const parts = today.split('-');
      year = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
      formattedMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
    }

    const siteId = req.query.siteId || req.query.site;
    let site = null;
    if (siteId && siteId !== 'all') {
      site = await Site.findById(siteId);
    }
    if (!site) {
      site = await Site.findOne();
    }
    const standardHours = site?.standardDailyHours || 8;
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Fetch workers for this site (active & inactive to preserve historical records)
    const workerFilter = {};
    if (site) {
      workerFilter.site = site._id;
    }
    const workers = await Worker.find(workerFilter).sort({ workerId: 1, name: 1 });
    const workerIds = workers.map((w) => w._id);

    // Fetch monthly attendance records for these workers
    const regexPattern = `^${formattedMonth}-`;
    const attendanceRecords = await Attendance.find({
      date: { $regex: regexPattern },
      worker: { $in: workerIds },
    });

    // Fetch monthly payment records for these workers
    const paymentRecords = await Payment.find({
      date: { $regex: regexPattern },
      worker: { $in: workerIds },
    });

    // Map attendance by workerId -> date -> record
    const attendanceMap = new Map();
    attendanceRecords.forEach((att) => {
      if (att.worker) {
        const wId = att.worker.toString();
        if (!attendanceMap.has(wId)) {
          attendanceMap.set(wId, new Map());
        }
        attendanceMap.get(wId).set(att.date, att);
      }
    });

    // Map advances & payments by workerId
    const advancesMap = new Map();
    const paymentsMap = new Map();

    paymentRecords.forEach((pay) => {
      if (pay.worker) {
        const wId = pay.worker.toString();
        const isAdvance = (pay.transactionType || pay.paymentType) === 'advance';
        if (isAdvance) {
          const curr = advancesMap.get(wId) || 0;
          advancesMap.set(wId, curr + pay.amount);
        } else {
          const curr = paymentsMap.get(wId) || 0;
          paymentsMap.set(wId, curr + pay.amount);
        }
      }
    });

    // Grand totals counters
    let grandWorkingDays = 0;
    let grandHours = 0;
    let grandOvertimeHours = 0;
    let grandWages = 0;
    let grandAdvances = 0;
    let grandPayments = 0;
    let grandOutstanding = 0;

    const registerRows = workers.map((worker) => {
      const wId = worker._id.toString();
      const workerAttendance = attendanceMap.get(wId) || new Map();
      const days = {};

      let totalWorkingDays = 0;
      let totalHours = 0;
      let overtimeHours = 0;
      let totalWages = 0;

      const workerStdHours = worker.standardWorkingHours || standardHours;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day < 10 ? `0${day}` : `${day}`;
        const fullDate = `${formattedMonth}-${dayStr}`;
        const rec = workerAttendance.get(fullDate);

        if (rec) {
          let symbol = 'P';
          const hrs = rec.hoursWorked || 0;

          if (rec.status === 'absent') {
            symbol = 'A';
          } else if (rec.status === 'leave') {
            symbol = 'L';
          } else if (hrs > 0 && hrs < workerStdHours) {
            symbol = 'H'; // Half Day
          } else if (hrs >= workerStdHours) {
            symbol = 'P'; // Present
          }

          days[day] = {
            symbol,
            hours: hrs,
            overtimeHours: rec.overtimeHours || 0,
            status: rec.status,
            wage: rec.wageEarned || 0,
          };

          totalHours += hrs;
          overtimeHours += rec.overtimeHours || 0;
          totalWages += rec.wageEarned || 0;

          if (rec.status === 'present' && hrs > 0) {
            totalWorkingDays += (hrs < workerStdHours ? 0.5 : 1);
          }
        } else {
          days[day] = null;
        }
      }

      const advances = Math.round(advancesMap.get(wId) || 0);
      const payments = Math.round(paymentsMap.get(wId) || 0);
      const roundedWages = Math.round(totalWages);
      const outstanding = roundedWages - (advances + payments);

      grandWorkingDays += totalWorkingDays;
      grandHours += totalHours;
      grandOvertimeHours += overtimeHours;
      grandWages += roundedWages;
      grandAdvances += advances;
      grandPayments += payments;
      grandOutstanding += outstanding;

      return {
        workerId: worker._id,
        workerCode: worker.workerId || '',
        name: worker.name,
        trade: worker.workType || worker.trade || 'Helper',
        dailyWage: worker.dailyWage,
        standardWorkingHours: workerStdHours,
        status: worker.status,
        days,
        totalWorkingDays,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        totalWages: roundedWages,
        advances,
        payments,
        outstanding,
      };
    });

    res.json({
      month: formattedMonth,
      year,
      monthNum,
      daysInMonth,
      standardHours,
      currencySymbol: site?.currencySymbol || '₹',
      siteName: site?.name || 'Main Construction Site',
      siteLocation: site?.location || '',
      ownerName: site?.ownerName || '',
      rows: registerRows,
      grandTotals: {
        totalWorkingDays: grandWorkingDays,
        totalHours: Math.round(grandHours * 100) / 100,
        overtimeHours: Math.round(grandOvertimeHours * 100) / 100,
        totalWages: grandWages,
        advances: grandAdvances,
        payments: grandPayments,
        outstanding: grandOutstanding,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
