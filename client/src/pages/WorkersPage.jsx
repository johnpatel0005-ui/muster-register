import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const WorkersPage = () => {
  const { authFetch, site, sites } = useAuth();

  // Workers data
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState(null);

  const [workerSiteId, setWorkerSiteId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [workType, setWorkType] = useState('Helper');
  const [dailyWage, setDailyWage] = useState(500);
  const [standardWorkingHours, setStandardWorkingHours] = useState(8);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.0);
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');

  // View modal state
  const [viewingWorker, setViewingWorker] = useState(null);
  const [viewingSummary, setViewingSummary] = useState(null);
  const [loadingView, setLoadingView] = useState(false);

  // Status feedback
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currency = site?.currencySymbol || '₹';

  // Load workers with active search, filter, and current site
  const loadWorkers = async (search = searchTerm, filter = statusFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (site?._id) params.append('siteId', site._id);
      if (search.trim()) params.append('search', search.trim());
      if (filter && filter !== 'all') params.append('status', filter);

      const res = await authFetch(`/api/workers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      }
    } catch (err) {
      console.error('Failed to load workers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers(searchTerm, statusFilter);
  }, [site?._id, searchTerm, statusFilter]);

  // Fetch next available Worker ID when opening "Add Worker"
  const handleOpenAddForm = async () => {
    resetForm();
    setShowForm(true);
    const targetSiteId = site?._id || (sites[0]?._id) || '';
    setWorkerSiteId(targetSiteId);
    try {
      const res = await authFetch(`/api/workers/next-id?siteId=${targetSiteId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkerId(data.nextId || 'WRK-001');
      }
    } catch (err) {
      console.error('Failed to get next ID:', err);
    }
  };

  const resetForm = () => {
    setEditingWorkerId(null);
    setWorkerSiteId(site?._id || '');
    setWorkerId('');
    setName('');
    setMobileNumber('');
    setWorkType('Helper');
    setDailyWage(500);
    setStandardWorkingHours(site?.standardDailyHours || 8);
    setOvertimeMultiplier(1.0);
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setStatus('active');
    setNotes('');
    setShowForm(false);
  };

  // Populate form for editing
  const handleEditClick = (worker) => {
    setEditingWorkerId(worker._id);
    setWorkerSiteId(worker.site?._id || worker.site || site?._id || '');
    setWorkerId(worker.workerId || '');
    setName(worker.name || '');
    setMobileNumber(worker.mobileNumber || worker.phone || '');
    setWorkType(worker.workType || worker.trade || 'Helper');
    setDailyWage(worker.dailyWage ?? 500);
    setStandardWorkingHours(worker.standardWorkingHours || site?.standardDailyHours || 8);
    setOvertimeMultiplier(worker.overtimeMultiplier || 1.0);
    setJoiningDate(
      worker.joiningDate
        ? new Date(worker.joiningDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setStatus(worker.status || 'active');
    setNotes(worker.notes || '');

    setShowForm(true);
    setViewingWorker(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // View worker details modal
  const handleViewClick = async (worker) => {
    setViewingWorker(worker);
    setViewingSummary(null);
    setLoadingView(true);

    try {
      const res = await authFetch(`/api/workers/${worker._id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingWorker(data.worker);
        setViewingSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load worker details:', err);
    } finally {
      setLoadingView(false);
    }
  };

  // Submit Add / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        siteId: workerSiteId || site?._id,
        workerId: workerId.trim().toUpperCase(),
        name: name.trim(),
        mobileNumber: mobileNumber.trim(),
        workType: workType.trim(),
        dailyWage: Number(dailyWage),
        standardWorkingHours: Number(standardWorkingHours) || 8,
        overtimeMultiplier: Number(overtimeMultiplier) || 1.0,
        joiningDate,
        status,
        notes: notes.trim(),
      };

      let res;
      if (editingWorkerId) {
        res = await authFetch(`/api/workers/${editingWorkerId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch('/api/workers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.message || 'Operation failed');
      }

      setMessage(
        editingWorkerId
          ? `Worker ${resData.name} (${resData.workerId}) updated successfully.`
          : `Worker ${resData.name} (${resData.workerId}) added successfully.`
      );

      resetForm();
      loadWorkers(searchTerm, statusFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle worker status (Active / Inactive)
  const handleToggleStatus = async (worker) => {
    const targetStatus = worker.status === 'active' ? 'inactive' : 'active';
    try {
      setMessage('');
      setError('');
      const res = await authFetch(`/api/workers/${worker._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to update status');
      }

      setMessage(`Worker ${worker.name} (${worker.workerId}) marked as ${targetStatus}.`);
      loadWorkers(searchTerm, statusFilter);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Workers Register</h1>
          <div className="page-subtitle">
            Manage daily wage workers, wage rates, and shift hours for {site?.name}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) resetForm();
            else handleOpenAddForm();
          }}
        >
          {showForm ? '✕ Close Form' : '+ Add Worker'}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Add / Edit Worker Form */}
      {showForm && (
        <div className="register-panel" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="panel-header">
            <h3>{editingWorkerId ? `Edit Worker: ${name} (${workerId})` : 'Add New Daily Wage Worker'}</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {editingWorkerId ? 'Modify worker details' : 'Worker ID is generated automatically'}
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label>Construction Site *</label>
                <select
                  className="form-control"
                  value={workerSiteId}
                  onChange={async (e) => {
                    const newSid = e.target.value;
                    setWorkerSiteId(newSid);
                    if (!editingWorkerId) {
                      try {
                        const res = await authFetch(`/api/workers/next-id?siteId=${newSid}`);
                        if (res.ok) {
                          const data = await res.json();
                          if (data.nextId) setWorkerId(data.nextId);
                        }
                      } catch (err) {
                        console.error('Failed to get next ID:', err);
                      }
                    }
                  }}
                  required
                >
                  {sites.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} {s.location ? `(${s.location})` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Assigned project site
                </span>
              </div>

              <div className="form-group">
                <label>Worker ID *</label>
                <input
                  type="text"
                  className="form-control"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value.toUpperCase())}
                  placeholder="e.g. WRK-001"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Auto-assigned unique code
                </span>
              </div>

              <div className="form-group">
                <label>Worker Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Mobile Number (Optional)</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Work Type / Skill *</label>
                <input
                  type="text"
                  className="form-control"
                  list="workTypeOptions"
                  placeholder="e.g. Mason (Rajmistri)"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  required
                />
                <datalist id="workTypeOptions">
                  <option value="Mason (Rajmistri)" />
                  <option value="Helper" />
                  <option value="Carpenter" />
                  <option value="Electrician" />
                  <option value="Painter" />
                  <option value="Plumber" />
                  <option value="Barbender / Steel Fixer" />
                  <option value="Tile Layer" />
                  <option value="Welder" />
                  <option value="Supervisor" />
                </datalist>
              </div>

              <div className="form-group">
                <label>Daily Wage Rate ({currency}) *</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  step="10"
                  value={dailyWage}
                  onChange={(e) => setDailyWage(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Standard rate per day
                </span>
              </div>

              <div className="form-group">
                <label>Standard Working Hours *</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="24"
                  step="0.5"
                  value={standardWorkingHours}
                  onChange={(e) => setStandardWorkingHours(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Hours per full work day (Default: 8)
                </span>
              </div>

              <div className="form-group">
                <label>Overtime Multiplier *</label>
                <input
                  type="number"
                  className="form-control"
                  min="1.0"
                  max="5.0"
                  step="0.25"
                  value={overtimeMultiplier}
                  onChange={(e) => setOvertimeMultiplier(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Multiplier for OT hours (1.0 = normal rate, 1.5 = 1.5x)
                </span>
              </div>

              <div className="form-group">
                <label>Joining Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Active (Currently working on site)</option>
                  <option value="inactive">Inactive (Left site / On break)</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Village name, emergency contact, Aadhaar number, or remarks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingWorkerId ? 'Save Changes' : 'Add Worker'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workers Ledger Panel */}
      <div className="register-panel">
        {/* Toolbar: Search by Name and Status Filter */}
        <div className="toolbar-bar">
          <div className="search-input-wrap">
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Search workers by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '320px' }}
            />
            {searchTerm && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status:</label>
            <select
              className="form-control"
              style={{ width: '160px', padding: '5px 8px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Workers</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Count summary banner */}
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Showing <strong>{workers.length}</strong> worker{workers.length === 1 ? '' : 's'}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        {loading ? (
          <p style={{ padding: '20px 0' }}>Loading workers ledger...</p>
        ) : workers.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No workers found.</p>
            {searchTerm && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '8px' }}
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="register-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Worker ID</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Work Type</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Daily Wage</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Shift / OT</th>
                  <th style={{ width: '100px' }}>Joined</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '200px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr
                    key={w._id}
                    style={{
                      opacity: w.status === 'inactive' ? 0.65 : 1,
                      backgroundColor: w.status === 'inactive' ? '#fcfcfc' : 'inherit',
                    }}
                  >
                    <td>
                      <strong>{w.workerId || '-'}</strong>
                    </td>
                    <td>
                      <strong>{w.name}</strong>
                      {w.notes && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {w.notes}
                        </div>
                      )}
                    </td>
                    <td>{w.mobileNumber || w.phone || '-'}</td>
                    <td>{w.workType || w.trade || 'Helper'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{currency} {w.dailyWage}</strong> / day
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {w.standardWorkingHours || 8}h / {w.overtimeMultiplier || 1.0}x
                    </td>
                    <td>
                      {w.joiningDate ? new Date(w.joiningDate).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${w.status === 'active' ? 'badge-present' : 'badge-absent'}`}>
                        {w.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '5px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewClick(w)}
                          title="View worker details and ledger history"
                        >
                          View
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditClick(w)}
                          title="Edit worker details"
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${w.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleToggleStatus(w)}
                          title={w.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                        >
                          {w.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Worker Details Modal */}
      {viewingWorker && (
        <div className="modal-backdrop" onClick={() => setViewingWorker(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h3>{viewingWorker.name} ({viewingWorker.workerId})</h3>
                <span className={`badge ${viewingWorker.status === 'active' ? 'badge-present' : 'badge-absent'}`}>
                  {viewingWorker.status}
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setViewingWorker(null)}
              >
                ✕ Close
              </button>
            </div>

            {loadingView ? (
              <p style={{ padding: '16px 0' }}>Loading details...</p>
            ) : (
              <>
                <table className="detail-table">
                  <tbody>
                    <tr>
                      <th>Worker ID</th>
                      <td><strong>{viewingWorker.workerId}</strong></td>
                    </tr>
                    <tr>
                      <th>Full Name</th>
                      <td>{viewingWorker.name}</td>
                    </tr>
                    <tr>
                      <th>Mobile Number</th>
                      <td>{viewingWorker.mobileNumber || viewingWorker.phone || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <th>Work Type / Skill</th>
                      <td>{viewingWorker.workType || viewingWorker.trade || 'Helper'}</td>
                    </tr>
                    <tr>
                      <th>Daily Wage Rate</th>
                      <td><strong>{currency} {viewingWorker.dailyWage}</strong> per full day</td>
                    </tr>
                    <tr>
                      <th>Standard Working Hours</th>
                      <td>{viewingWorker.standardWorkingHours || 8} Hours / day</td>
                    </tr>
                    <tr>
                      <th>Overtime Multiplier</th>
                      <td>{viewingWorker.overtimeMultiplier || 1.0}x standard hourly rate</td>
                    </tr>
                    <tr>
                      <th>Joining Date</th>
                      <td>
                        {viewingWorker.joiningDate
                          ? new Date(viewingWorker.joiningDate).toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <th>Status</th>
                      <td style={{ textTransform: 'capitalize' }}>{viewingWorker.status}</td>
                    </tr>
                    <tr>
                      <th>Notes / Remarks</th>
                      <td>{viewingWorker.notes || 'None'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Worker Ledger Summary */}
                {viewingSummary && (
                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <h4 style={{ marginBottom: '8px', fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Muster & Payment History Summary
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                      <div style={{ padding: '8px', background: '#f9fafb', border: '1px solid var(--border-light)', borderRadius: '3px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Days / Hours</div>
                        <div style={{ fontWeight: 'bold' }}>
                          {viewingSummary.daysWorked} d ({viewingSummary.totalHours} h)
                        </div>
                      </div>
                      <div style={{ padding: '8px', background: '#f9fafb', border: '1px solid var(--border-light)', borderRadius: '3px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Earned</div>
                        <div style={{ fontWeight: 'bold' }}>{currency} {viewingSummary.totalEarned}</div>
                      </div>
                      <div style={{ padding: '8px', background: '#f9fafb', border: '1px solid var(--border-light)', borderRadius: '3px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Balance Due</div>
                        <div style={{ fontWeight: 'bold', color: viewingSummary.balanceDue > 0 ? 'var(--primary)' : 'inherit' }}>
                          {currency} {viewingSummary.balanceDue}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleEditClick(viewingWorker)}
                  >
                    Edit Worker
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setViewingWorker(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
