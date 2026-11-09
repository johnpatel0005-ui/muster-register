import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Client-side helper to mirror backend wage and shift calculations in real-time
const calculateRowShift = (
  inTime,
  outTime,
  breakMinutes,
  standardHours = 8,
  overtimeMultiplier = 1.5,
  dailyWage = 500,
  status = 'present'
) => {
  if (status !== 'present') {
    return {
      hoursWorked: 0,
      overtimeHours: 0,
      wageEarned: 0,
    };
  }

  const parseMinutes = (tStr) => {
    if (!tStr || typeof tStr !== 'string' || !tStr.includes(':')) return 0;
    const [h, m] = tStr.split(':').map((v) => parseInt(v, 10) || 0);
    return h * 60 + m;
  };

  const inM = parseMinutes(inTime);
  let outM = parseMinutes(outTime);

  // Overnight shift: add 24 hours (1440 minutes) if outTime rolled over past midnight
  if (outM < inM) {
    outM += 24 * 60;
  }

  const brk = Math.max(0, parseInt(breakMinutes, 10) || 0);
  const totalElapsed = outM - inM;
  const workingMinutes = Math.max(0, totalElapsed - brk);

  const stdHours = Number(standardHours) > 0 ? Number(standardHours) : 8;
  const otMult = Number(overtimeMultiplier) >= 1 ? Number(overtimeMultiplier) : 1.5;
  const stdMinutes = stdHours * 60;

  const overtimeMinutes = Math.max(0, workingMinutes - stdMinutes);
  const regularMinutes = Math.max(0, workingMinutes - overtimeMinutes);

  const regularHours = regularMinutes / 60;
  const overtimeHours = overtimeMinutes / 60;
  const hoursWorked = workingMinutes / 60;

  const hourlyRate = stdHours > 0 ? dailyWage / stdHours : 0;
  const regularWage = hourlyRate * regularHours;
  const overtimeWage = hourlyRate * overtimeHours * otMult;
  const wageEarned = regularWage + overtimeWage;

  return {
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    wageEarned: Math.round(wageEarned),
  };
};

export const AttendancePage = () => {
  const { authFetch, site } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sheet, setSheet] = useState([]);
  const [standardHours, setStandardHours] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currency = site?.currencySymbol || '₹';

  // Load attendance data for the selected date and site
  const loadAttendance = async (date) => {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const siteQuery = site?._id ? `&siteId=${site._id}` : '';
      const res = await authFetch(`/api/attendance/daily?date=${date}${siteQuery}`);
      if (res.ok) {
        const data = await res.json();
        setSheet(data.sheet || []);
        if (data.standardHours) {
          setStandardHours(data.standardHours);
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to load attendance');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance(selectedDate);
  }, [site?._id, selectedDate]);

  // Navigate date by +/- days
  const changeDateBy = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const nextDate = current.toISOString().split('T')[0];
    setSelectedDate(nextDate);
  };

  // Change individual field in row
  const updateRow = (index, field, value) => {
    const updated = [...sheet];
    const row = { ...updated[index], [field]: value };

    // When status changes
    if (field === 'status') {
      if (value === 'present') {
        if (!row.inTime) row.inTime = '08:00';
        if (!row.outTime) row.outTime = '17:00';
        if (row.breakMinutes === undefined || row.breakMinutes === null) row.breakMinutes = 60;
      }
    }

    // Recompute hours and wages live on the client
    const calc = calculateRowShift(
      row.inTime || '08:00',
      row.outTime || '17:00',
      row.breakMinutes ?? 60,
      row.standardWorkingHours || standardHours,
      row.overtimeMultiplier || 1.5,
      row.dailyWage,
      row.status
    );

    row.hoursWorked = calc.hoursWorked;
    row.overtimeHours = calc.overtimeHours;
    row.wageEarned = calc.wageEarned;

    updated[index] = row;
    setSheet(updated);
  };

  // Mark all workers present with standard shift
  const handleMarkAllPresent = () => {
    const updated = sheet.map((w) => {
      const stdHours = w.standardWorkingHours || standardHours;
      const otMult = w.overtimeMultiplier || 1.5;

      const calc = calculateRowShift('08:00', '17:00', 60, stdHours, otMult, w.dailyWage, 'present');

      return {
        ...w,
        status: 'present',
        inTime: '08:00',
        outTime: '17:00',
        breakMinutes: 60,
        hoursWorked: calc.hoursWorked,
        overtimeHours: calc.overtimeHours,
        wageEarned: calc.wageEarned,
      };
    });

    setSheet(updated);
  };

  // Quick set status for an individual worker
  const handleSetWorkerStatus = (index, newStatus) => {
    updateRow(index, 'status', newStatus);
  };

  // Save attendance batch to backend
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      // Send all workers who have a marked status (or unmarking if changed)
      const entries = sheet.map((w) => ({
        workerId: w.workerId,
        status: w.status,
        inTime: w.inTime || '08:00',
        outTime: w.outTime || '17:00',
        breakMinutes: parseInt(w.breakMinutes, 10) || 0,
        notes: w.notes || '',
      }));

      const res = await authFetch('/api/attendance/batch', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          entries,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save attendance');
      }

      setMessage(`Attendance for ${selectedDate} saved successfully.`);
      loadAttendance(selectedDate);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Summary counts
  const totalWorkers = sheet.length;
  const presentWorkers = sheet.filter((s) => s.status === 'present').length;
  const absentWorkers = sheet.filter((s) => s.status === 'absent').length;
  const leaveWorkers = sheet.filter((s) => s.status === 'leave').length;
  const notMarkedWorkers = sheet.filter((s) => s.status === 'not_marked' || !s.status).length;
  const totalWorkingHours = sheet.reduce((acc, curr) => acc + (parseFloat(curr.hoursWorked) || 0), 0);
  const totalWageBill = sheet.reduce((acc, curr) => acc + (parseFloat(curr.wageEarned) || 0), 0);

  // Helper to format date label
  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Attendance Register</h1>
          <div className="page-subtitle">
            Site: <strong>{site?.name}</strong> • Standard Shift: <strong>{standardHours} Hours</strong> • Overtime Multiplier: <strong>1.5x</strong>
          </div>
        </div>

        {/* Top Save Attendance button */}
        <button
          className="btn btn-primary"
          onClick={handleSaveAttendance}
          disabled={saving || sheet.length === 0}
          style={{ padding: '9px 18px', fontSize: '15px' }}
        >
          {saving ? 'Saving...' : '💾 Save Attendance'}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Date Navigation & Top Summary Bar */}
      <div className="register-panel" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Selected Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => changeDateBy(-1)} title="Previous Day">
              ◀ Prev
            </button>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px', padding: '5px 8px', fontWeight: 'bold' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => changeDateBy(1)} title="Next Day">
              Next ▶
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              Today
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
              ({formattedDate})
            </span>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleMarkAllPresent}>
              ✓ Mark All Present (08:00 - 17:00)
            </button>
          </div>
        </div>

        {/* Top Metrics Row: Selected date, Total workers, Present workers, Absent workers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <div style={{ background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Selected Date
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '2px' }}>{selectedDate}</div>
          </div>

          <div style={{ background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Workers
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '2px' }}>{totalWorkers}</div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' }}>
              Present Workers
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803d', marginTop: '2px' }}>
              {presentWorkers}
            </div>
          </div>

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' }}>
              Absent Workers
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c', marginTop: '2px' }}>
              {absentWorkers}
            </div>
          </div>

          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>
              On Leave
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b45309', marginTop: '2px' }}>
              {leaveWorkers}
            </div>
          </div>

          <div style={{ background: '#f3f4f6', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Not Marked
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {notMarkedWorkers}
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
              Total Wage Bill
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)', marginTop: '2px' }}>
              {currency} {totalWageBill}
            </div>
          </div>
        </div>
      </div>

      {/* Main Attendance Table (Physical Register Style) */}
      <div className="register-panel">
        <div className="panel-header">
          <h3>Daily Attendance Sheet • {selectedDate}</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Working Hours = (Out Time - In Time - Break) • Overtime = Hours past {standardHours}h (at 1.5x)
          </span>
        </div>

        {loading ? (
          <p style={{ padding: '20px 0' }}>Loading daily muster sheet...</p>
        ) : sheet.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active workers found. Please add workers in the Workers tab first.
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="register-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Worker</th>
                  <th style={{ width: '105px', textAlign: 'center' }}>In Time</th>
                  <th style={{ width: '105px', textAlign: 'center' }}>Out Time</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Break (m)</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Working Hours</th>
                  <th style={{ width: '95px', textAlign: 'center' }}>Overtime</th>
                  <th style={{ minWidth: '170px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Wage ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((entry, idx) => {
                  const isPresent = entry.status === 'present';
                  const isAbsent = entry.status === 'absent';
                  const isLeave = entry.status === 'leave';
                  const isNotMarked = entry.status === 'not_marked' || !entry.status;

                  return (
                    <tr
                      key={entry.workerId}
                      style={{
                        backgroundColor: isAbsent ? '#fffdfd' : isLeave ? '#fffef7' : isNotMarked ? '#fafafa' : '#ffffff',
                      }}
                    >
                      {/* Column 1: Worker */}
                      <td>
                        <div>
                          <strong>
                            {entry.workerCode ? `[${entry.workerCode}] ` : ''}
                            {entry.name}
                          </strong>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {entry.workType || entry.trade} • {currency}{entry.dailyWage}/day
                        </div>
                      </td>

                      {/* Column 2: In Time */}
                      <td style={{ textAlign: 'center' }}>
                        {isPresent ? (
                          <input
                            type="time"
                            className="form-control"
                            style={{
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: 600,
                              width: '95px',
                              margin: '0 auto',
                            }}
                            value={entry.inTime || '08:00'}
                            onChange={(e) => updateRow(idx, 'inTime', e.target.value)}
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Column 3: Out Time */}
                      <td style={{ textAlign: 'center' }}>
                        {isPresent ? (
                          <input
                            type="time"
                            className="form-control"
                            style={{
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: 600,
                              width: '95px',
                              margin: '0 auto',
                            }}
                            value={entry.outTime || '17:00'}
                            onChange={(e) => updateRow(idx, 'outTime', e.target.value)}
                            title="If out-time is earlier than in-time, overnight shift is automatically supported"
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Column 4: Break */}
                      <td style={{ textAlign: 'center' }}>
                        {isPresent ? (
                          <input
                            type="number"
                            min="0"
                            max="360"
                            step="5"
                            className="form-control"
                            style={{
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontSize: '13px',
                              width: '70px',
                              margin: '0 auto',
                            }}
                            value={entry.breakMinutes ?? 60}
                            onChange={(e) => updateRow(idx, 'breakMinutes', e.target.value)}
                            title="Break duration in minutes"
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Column 5: Working Hours */}
                      <td style={{ textAlign: 'center' }}>
                        {isPresent ? (
                          <div>
                            <strong style={{ fontSize: '14px' }}>{entry.hoursWorked} hrs</strong>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0 hrs</span>
                        )}
                      </td>

                      {/* Column 6: Overtime */}
                      <td style={{ textAlign: 'center' }}>
                        {isPresent && entry.overtimeHours > 0 ? (
                          <span
                            style={{
                              background: '#eff6ff',
                              color: 'var(--primary)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            +{entry.overtimeHours} hrs
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>0 hrs</span>
                        )}
                      </td>

                      {/* Column 7: Status */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${isPresent ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleSetWorkerStatus(idx, 'present')}
                            style={{
                              backgroundColor: isPresent ? '#15803d' : '#ffffff',
                              color: isPresent ? '#ffffff' : 'inherit',
                              borderColor: isPresent ? '#15803d' : 'var(--border-color)',
                            }}
                            title="Mark Present"
                          >
                            Present
                          </button>

                          <button
                            type="button"
                            className={`btn btn-sm ${isAbsent ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleSetWorkerStatus(idx, 'absent')}
                            style={{
                              backgroundColor: isAbsent ? '#b91c1c' : '#ffffff',
                              color: isAbsent ? '#ffffff' : 'inherit',
                              borderColor: isAbsent ? '#b91c1c' : 'var(--border-color)',
                            }}
                            title="Mark Absent"
                          >
                            Absent
                          </button>

                          <button
                            type="button"
                            className={`btn btn-sm ${isLeave ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleSetWorkerStatus(idx, 'leave')}
                            style={{
                              backgroundColor: isLeave ? '#b45309' : '#ffffff',
                              color: isLeave ? '#ffffff' : 'inherit',
                              borderColor: isLeave ? '#b45309' : 'var(--border-color)',
                            }}
                            title="Mark On Leave"
                          >
                            Leave
                          </button>
                        </div>

                        {/* Display "Not Marked" indicator if untouched */}
                        {isNotMarked && (
                          <div style={{ marginTop: '3px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                              }}
                            >
                              (Not Marked)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Wage Column */}
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: isPresent ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {currency} {entry.wageEarned || 0}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Save Attendance Button */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {presentWorkers} Present • {absentWorkers} Absent • {leaveWorkers} Leave • {notMarkedWorkers} Not Marked • Total Bill: <strong>{currency} {totalWageBill}</strong>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSaveAttendance}
            disabled={saving || sheet.length === 0}
            style={{ padding: '9px 20px', fontSize: '15px' }}
          >
            {saving ? 'Saving Attendance...' : '💾 Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
};
