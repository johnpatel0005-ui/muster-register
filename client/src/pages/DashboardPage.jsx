import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const DashboardPage = () => {
  const { authFetch, site } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!site?._id) return;
      try {
        setLoading(true);
        const res = await authFetch(`/api/settings/dashboard?siteId=${site._id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [site?._id]);

  if (loading) {
    return <div className="register-panel">Loading site dashboard...</div>;
  }

  const currency = site?.currencySymbol || '₹';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Muster Dashboard</h1>
          <div className="page-subtitle">
            Site: <strong>{site?.name}</strong> • Today: <strong>{data?.today || new Date().toISOString().split('T')[0]}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/attendance" className="btn btn-primary">
            ✓ Mark Today's Attendance
          </Link>
          <Link to="/muster" className="btn btn-secondary">
            📖 View Muster Register
          </Link>
        </div>
      </div>

      {/* Simple 4-Box Summary Grid */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Total Active Workers</div>
          <div className="value">{data?.totalActiveWorkers ?? 0}</div>
          <div className="sub-note">Registered on site</div>
        </div>

        <div className="summary-card">
          <div className="label">Today's Attendance</div>
          <div className="value">
            {data?.todayPresentCount ?? 0} / {data?.totalActiveWorkers ?? 0}
          </div>
          <div className="sub-note">Workers present today</div>
        </div>

        <div className="summary-card">
          <div className="label">Today's Work Hours</div>
          <div className="value">{data?.todayTotalHours ?? 0} hrs</div>
          <div className="sub-note">Estimated wage: {currency} {data?.todayWagesEarned ?? 0}</div>
        </div>

        <div className="summary-card">
          <div className="label">Payments This Month</div>
          <div className="value">{currency} {data?.monthlyPaymentTotal ?? 0}</div>
          <div className="sub-note">Advances & settlements</div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="register-panel">
        <div className="panel-header">
          <h3>Quick Site Actions</h3>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/workers" className="btn btn-secondary">
            + Add / Manage Workers
          </Link>
          <Link to="/attendance" className="btn btn-secondary">
            🕒 Fill Daily Attendance
          </Link>
          <Link to="/payments" className="btn btn-secondary">
            💵 Record Worker Payment
          </Link>
          <Link to="/muster" className="btn btn-secondary">
            📋 Monthly Muster Ledger
          </Link>
          <Link to="/settings" className="btn btn-secondary">
            ⚙️ Site Settings
          </Link>
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="register-panel">
        <div className="panel-header">
          <h3>Recent Wage Payments / Advances</h3>
          <Link to="/payments" className="btn btn-secondary btn-sm">
            View All Payments →
          </Link>
        </div>

        {data?.recentPayments && data.recentPayments.length > 0 ? (
          <div className="table-container">
            <table className="register-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Date</th>
                  <th>Worker Name</th>
                  <th>Trade</th>
                  <th style={{ width: '130px' }}>Amount ({currency})</th>
                  <th style={{ width: '140px' }}>Type</th>
                  <th style={{ width: '120px' }}>Mode</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <tr key={p._id}>
                    <td>{p.date}</td>
                    <td>
                      <strong>
                        {p.worker?.workerId ? `[${p.worker.workerId}] ` : ''}
                        {p.worker?.name || 'Unknown'}
                      </strong>
                    </td>
                    <td>{p.worker?.workType || p.worker?.trade || '-'}</td>
                    <td><strong>{currency} {p.amount}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{(p.transactionType || p.paymentType)?.replace('_', ' ')}</td>
                    <td style={{ textTransform: 'uppercase' }}>{p.paymentMethod || p.paymentMode}</td>
                    <td>{p.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            No payments recorded yet. Use the <strong>Payments</strong> tab to record advances or daily wages.
          </div>
        )}
      </div>
    </div>
  );
};
