import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MusterRegisterPage = () => {
  const { authFetch, site } = useAuth();

  // Current month & year state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [registerData, setRegisterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currency = site?.currencySymbol || '₹';

  // Load muster register for selected month & year for active site
  const loadMuster = async (monthNum, yearNum) => {
    try {
      setLoading(true);
      setError('');
      const formattedMonth = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
      const siteQuery = site?._id ? `&siteId=${site._id}` : '';
      const res = await authFetch(`/api/attendance/muster?month=${formattedMonth}${siteQuery}`);
      if (res.ok) {
        const data = await res.json();
        setRegisterData(data);
      } else {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to load muster register data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMuster(selectedMonth, selectedYear);
  }, [site?._id, selectedMonth, selectedYear]);

  // Navigate month by +/- 1
  const changeMonthBy = (delta) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const daysInMonth = registerData?.daysInMonth || new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = MONTH_NAMES[selectedMonth - 1];

  // ==========================================
  // 1. EXPORT TO PDF (Traditional Landscape Ledger)
  // ==========================================
  const handleExportPDF = () => {
    if (!registerData || !registerData.rows) return;

    // Landscape orientation on A4
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const siteTitle = registerData.siteName || site?.name || 'Construction Site';
    const siteLoc = registerData.siteLocation || site?.location || '';
    const owner = registerData.ownerName || site?.ownerName || 'Contractor';

    // Header banner
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(siteTitle.toUpperCase(), 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Location: ${siteLoc} | Owner/Contractor: ${owner} | Standard Shift: ${registerData.standardHours || 8} Hours`, 14, 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`MONTHLY MUSTER REGISTER ROLL - ${monthName.toUpperCase()} ${selectedYear}`, 14, 23);

    // Prepare table headers
    const headRow = [
      'ID',
      'Worker Name',
      ...daysArray.map((d) => String(d)),
      'Days',
      'Hours',
      'OT',
      `Wages (${currency})`,
      `Adv (${currency})`,
      `Paid (${currency})`,
      `Due (${currency})`,
    ];

    // Prepare table body rows
    const bodyRows = registerData.rows.map((r) => {
      const dailyCols = daysArray.map((d) => {
        const dayEntry = r.days[d];
        if (!dayEntry) return '-';
        if (dayEntry.symbol === 'A') return 'A';
        if (dayEntry.symbol === 'L') return 'L';
        return `${dayEntry.symbol}${dayEntry.hours}`;
      });

      return [
        r.workerCode || '-',
        r.name,
        ...dailyCols,
        String(r.totalWorkingDays),
        String(r.totalHours),
        String(r.overtimeHours || 0),
        String(r.totalWages),
        String(r.advances),
        String(r.payments),
        String(r.outstanding),
      ];
    });

    // Prepare grand totals footer row
    const g = registerData.grandTotals || {};
    const footRow = [
      '',
      'TOTALS:',
      ...daysArray.map(() => ''),
      String(g.totalWorkingDays || 0),
      String(g.totalHours || 0),
      String(g.overtimeHours || 0),
      String(g.totalWages || 0),
      String(g.advances || 0),
      String(g.payments || 0),
      String(g.outstanding || 0),
    ];

    // Generate table with autoTable
    autoTable(doc, {
      startY: 26,
      head: [headRow],
      body: bodyRows,
      foot: [footRow],
      theme: 'grid',
      styles: {
        fontSize: 5.5,
        cellPadding: 0.8,
        halign: 'center',
        valign: 'middle',
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 58, 138], // Navy slate
        textColor: [255, 255, 255],
        fontSize: 5.5,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 6,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'left' }, // ID
        1: { cellWidth: 28, halign: 'left', fontStyle: 'bold' }, // Name
        // Daily columns will auto divide remaining width
      },
      margin: { left: 8, right: 8 },
      didDrawPage: (data) => {
        // Signatures at page bottom
        const pageHeight = doc.internal.pageSize.height || 210;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Checked By: Site Supervisor / Engineer', 14, pageHeight - 8);
        doc.text('Authorized By: Contractor / Site Owner', 200, pageHeight - 8);
      },
    });

    doc.save(`Muster_Register_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.pdf`);
  };

  // ==========================================
  // 2. EXPORT TO EXCEL (.xlsx)
  // ==========================================
  const handleExportExcel = () => {
    if (!registerData || !registerData.rows) return;

    const siteTitle = registerData.siteName || site?.name || 'Construction Site';
    const siteLoc = registerData.siteLocation || site?.location || '';
    const owner = registerData.ownerName || site?.ownerName || 'Contractor';

    const sheetData = [];

    // Header rows
    sheetData.push([siteTitle.toUpperCase()]);
    sheetData.push([`Location: ${siteLoc}`, `Owner: ${owner}`, `Standard Day: ${registerData.standardHours || 8} Hours`]);
    sheetData.push([`MONTHLY MUSTER ROLL REGISTER - ${monthName.toUpperCase()} ${selectedYear}`]);
    sheetData.push([]); // Empty spacing row

    // Table Column Headers
    const headers = [
      'Worker ID',
      'Worker Name',
      'Trade / Skill',
      'Daily Wage Rate',
      ...daysArray.map((d) => `Day ${d}`),
      'Total Working Days',
      'Total Hours',
      'Overtime Hours',
      'Total Wages',
      'Advances',
      'Payments',
      'Outstanding Balance',
    ];
    sheetData.push(headers);

    // Worker Rows
    registerData.rows.forEach((r) => {
      const dailyValues = daysArray.map((d) => {
        const dayEntry = r.days[d];
        if (!dayEntry) return '-';
        if (dayEntry.symbol === 'A') return 'A';
        if (dayEntry.symbol === 'L') return 'L';
        return `${dayEntry.symbol} (${dayEntry.hours}h)`;
      });

      sheetData.push([
        r.workerCode || '-',
        r.name,
        r.trade || '-',
        r.dailyWage || 0,
        ...dailyValues,
        r.totalWorkingDays,
        r.totalHours,
        r.overtimeHours || 0,
        r.totalWages,
        r.advances,
        r.payments,
        r.outstanding,
      ]);
    });

    // Grand Totals Row
    const g = registerData.grandTotals || {};
    const footerRow = [
      'TOTALS',
      `${registerData.rows.length} Workers`,
      '',
      '',
      ...daysArray.map(() => ''),
      g.totalWorkingDays || 0,
      g.totalHours || 0,
      g.overtimeHours || 0,
      g.totalWages || 0,
      g.advances || 0,
      g.payments || 0,
      g.outstanding || 0,
    ];
    sheetData.push(footerRow);

    // Generate Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set Column Widths
    ws['!cols'] = [
      { wch: 12 }, // Worker ID
      { wch: 22 }, // Worker Name
      { wch: 18 }, // Trade
      { wch: 14 }, // Wage
      ...daysArray.map(() => ({ wch: 8 })), // Daily columns
      { wch: 16 }, // Working Days
      { wch: 12 }, // Hours
      { wch: 12 }, // OT
      { wch: 14 }, // Wages
      { wch: 12 }, // Advances
      { wch: 12 }, // Payments
      { wch: 16 }, // Outstanding
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Muster Register');
    XLSX.writeFile(wb, `Muster_Register_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);
  };

  // Grand totals shortcuts
  const g = registerData?.grandTotals || {};

  return (
    <div>
      {/* Print-Only Header (Appears only on paper/print preview) */}
      <div className="print-only" style={{ marginBottom: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
          {(registerData?.siteName || site?.name || 'CONSTRUCTION SITE').toUpperCase()}
        </h2>
        <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>
          Site Location: {registerData?.siteLocation || site?.location || 'Site #1'} • Contractor: {registerData?.ownerName || site?.ownerName || 'Owner'}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}>
          MONTHLY MUSTER ROLL REGISTER - {monthName.toUpperCase()} {selectedYear}
        </div>
      </div>

      {/* Screen Page Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Monthly Muster Roll Register</h1>
          <div className="page-subtitle">
            Site: <strong>{registerData?.siteName || site?.name}</strong> • Period: <strong>{monthName} {selectedYear}</strong>
          </div>
        </div>

        {/* Export Buttons: PDF, Excel, Print */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExportPDF} title="Download printable PDF ledger in landscape orientation">
            📄 Download PDF
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="Download complete spreadsheet in Excel format">
            📊 Download Excel
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()} title="Print landscape muster ledger">
            🖨️ Print
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error no-print">{error}</div>}

      {/* Month & Year Selectors Bar */}
      <div className="register-panel no-print" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {/* Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => changeMonthBy(-1)} title="Previous Month">
              ◀ Prev Month
            </button>

            {/* Month Select */}
            <select
              className="form-control"
              style={{ width: '135px', padding: '5px 8px', fontWeight: 'bold' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Select */}
            <select
              className="form-control"
              style={{ width: '100px', padding: '5px 8px', fontWeight: 'bold' }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button className="btn btn-secondary btn-sm" onClick={() => changeMonthBy(1)} title="Next Month">
              Next Month ▶
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const now = new Date();
                setSelectedMonth(now.getMonth() + 1);
                setSelectedYear(now.getFullYear());
              }}
            >
              Current Month
            </button>
          </div>

          {/* Attendance Symbols Key */}
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Key:</strong> <span style={{ color: '#15803d', fontWeight: 'bold' }}>P</span> = Present •{' '}
            <span style={{ color: '#b45309', fontWeight: 'bold' }}>H</span> = Half Day •{' '}
            <span style={{ color: '#dc2626', fontWeight: 'bold' }}>A</span> = Absent •{' '}
            <span style={{ color: '#9333ea', fontWeight: 'bold' }}>L</span> = Leave •{' '}
            <span>Actual hours shown per day</span>
          </div>
        </div>
      </div>

      {/* Monthly Metrics Summary Grid */}
      <div className="summary-grid no-print" style={{ marginBottom: '14px' }}>
        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="label">Total Working Days</div>
          <div className="value" style={{ fontSize: '1.25rem' }}>{g.totalWorkingDays ?? 0} days</div>
          <div className="sub-note">Site aggregate</div>
        </div>

        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="label">Total Work Hours</div>
          <div className="value" style={{ fontSize: '1.25rem' }}>{g.totalHours ?? 0} hrs</div>
          <div className="sub-note">Overtime: +{g.overtimeHours ?? 0} hrs</div>
        </div>

        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="label">Total Wages Earned</div>
          <div className="value" style={{ fontSize: '1.25rem' }}>{currency} {g.totalWages ?? 0}</div>
          <div className="sub-note">Calculated from shifts</div>
        </div>

        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="label">Advances Deducted</div>
          <div className="value" style={{ fontSize: '1.25rem', color: '#b45309' }}>{currency} {g.advances ?? 0}</div>
          <div className="sub-note">Cash & online kharcha</div>
        </div>

        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="label">Wage Payments Made</div>
          <div className="value" style={{ fontSize: '1.25rem', color: '#15803d' }}>{currency} {g.payments ?? 0}</div>
          <div className="sub-note">Disbursements</div>
        </div>

        <div className="summary-card" style={{ padding: '10px 14px' }}>
          <div className="label">Remaining Outstanding</div>
          <div className="value" style={{ fontSize: '1.25rem', color: (g.outstanding || 0) > 0 ? 'var(--primary)' : '#15803d' }}>
            {currency} {g.outstanding ?? 0}
          </div>
          <div className="sub-note">Wages - (Advances + Paid)</div>
        </div>
      </div>

      {/* Monthly Muster Register Ledger Table */}
      <div className="register-panel" style={{ padding: '12px' }}>
        <div className="panel-header no-print">
          <h3>
            Muster Roll: {monthName} {selectedYear} ({registerData?.rows?.length || 0} Workers)
          </h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Physical Register Style Ledger Table
          </span>
        </div>

        {loading ? (
          <p style={{ padding: '20px 0' }}>Loading muster roll register...</p>
        ) : !registerData?.rows || registerData.rows.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No worker records found for {monthName} {selectedYear}.
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="register-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '75px', textAlign: 'center' }}>Worker ID</th>
                  <th style={{ minWidth: '130px' }}>Worker Name</th>

                  {/* Daily Attendance Columns 1..daysInMonth */}
                  {daysArray.map((day) => (
                    <th
                      key={day}
                      style={{
                        width: '28px',
                        minWidth: '28px',
                        textAlign: 'center',
                        padding: '4px 1px',
                        backgroundColor: '#f3f4f6',
                        fontSize: '11px',
                      }}
                      title={`Date: ${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
                    >
                      {day}
                    </th>
                  ))}

                  <th style={{ minWidth: '60px', textAlign: 'center' }}>Total Working Days</th>
                  <th style={{ minWidth: '55px', textAlign: 'center' }}>Total Hours</th>
                  <th style={{ minWidth: '50px', textAlign: 'center' }}>Overtime Hours</th>
                  <th style={{ minWidth: '85px', textAlign: 'right' }}>Total Wages ({currency})</th>
                  <th style={{ minWidth: '75px', textAlign: 'right' }}>Advances ({currency})</th>
                  <th style={{ minWidth: '75px', textAlign: 'right' }}>Payments ({currency})</th>
                  <th style={{ minWidth: '85px', textAlign: 'right' }}>Outstanding ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {registerData.rows.map((row) => (
                  <tr key={row.workerId}>
                    {/* Worker ID */}
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {row.workerCode || '-'}
                    </td>

                    {/* Worker Name & Trade */}
                    <td>
                      <div><strong>{row.name}</strong></div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {row.trade} • {currency}{row.dailyWage}/d
                      </div>
                    </td>

                    {/* Daily Attendance 1..daysInMonth */}
                    {daysArray.map((d) => {
                      const dayEntry = row.days[d];
                      if (!dayEntry) {
                        return (
                          <td key={d} style={{ textAlign: 'center', color: '#d1d5db', padding: '3px 1px' }}>
                            -
                          </td>
                        );
                      }

                      let symbolColor = '#15803d'; // Green for Present
                      if (dayEntry.symbol === 'A') symbolColor = '#dc2626'; // Red for Absent
                      else if (dayEntry.symbol === 'H') symbolColor = '#b45309'; // Amber for Half-day
                      else if (dayEntry.symbol === 'L') symbolColor = '#9333ea'; // Purple for Leave

                      return (
                        <td
                          key={d}
                          style={{
                            textAlign: 'center',
                            padding: '2px 1px',
                            lineHeight: 1.1,
                          }}
                          title={`Day ${d}: ${dayEntry.symbol} (${dayEntry.hours} hrs)`}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '11px', color: symbolColor }}>
                            {dayEntry.symbol}
                          </div>
                          {dayEntry.hours > 0 && (
                            <div style={{ fontSize: '9px', color: '#4b5563' }}>
                              {dayEntry.hours}h
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Summary: Total Working Days */}
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {row.totalWorkingDays}
                    </td>

                    {/* Summary: Total Hours */}
                    <td style={{ textAlign: 'center' }}>
                      {row.totalHours}
                    </td>

                    {/* Summary: Overtime Hours */}
                    <td style={{ textAlign: 'center', color: row.overtimeHours > 0 ? 'var(--primary)' : 'inherit', fontWeight: row.overtimeHours > 0 ? 'bold' : 'normal' }}>
                      {row.overtimeHours > 0 ? `+${row.overtimeHours}` : '0'}
                    </td>

                    {/* Summary: Total Wages */}
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {row.totalWages}
                    </td>

                    {/* Summary: Advances */}
                    <td style={{ textAlign: 'right', color: '#b45309' }}>
                      {row.advances}
                    </td>

                    {/* Summary: Payments */}
                    <td style={{ textAlign: 'right', color: '#15803d' }}>
                      {row.payments}
                    </td>

                    {/* Summary: Outstanding */}
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: row.outstanding > 0 ? 'var(--primary)' : '#15803d',
                      }}
                    >
                      {row.outstanding}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
                  <td colSpan={2} style={{ textAlign: 'left', padding: '8px 10px' }}>
                    MONTHLY TOTALS:
                  </td>
                  {daysArray.map((d) => (
                    <td key={d} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                      ·
                    </td>
                  ))}
                  <td style={{ textAlign: 'center' }}>{g.totalWorkingDays || 0}</td>
                  <td style={{ textAlign: 'center' }}>{g.totalHours || 0}</td>
                  <td style={{ textAlign: 'center', color: 'var(--primary)' }}>+{g.overtimeHours || 0}</td>
                  <td style={{ textAlign: 'right' }}>{currency} {g.totalWages || 0}</td>
                  <td style={{ textAlign: 'right', color: '#b45309' }}>{currency} {g.advances || 0}</td>
                  <td style={{ textAlign: 'right', color: '#15803d' }}>{currency} {g.payments || 0}</td>
                  <td style={{ textAlign: 'right', color: (g.outstanding || 0) > 0 ? 'var(--primary)' : '#15803d' }}>
                    {currency} {g.outstanding || 0}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Print Signatures Block */}
        <div
          className="print-only"
          style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            paddingTop: '20px',
            borderTop: '1px solid #111827',
          }}
        >
          <div>Checked By: Site Supervisor / Engineer</div>
          <div>Authorized Signature: Contractor / Owner</div>
        </div>
      </div>
    </div>
  );
};
