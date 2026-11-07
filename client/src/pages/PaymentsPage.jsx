import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const PaymentsPage = () => {
  const { authFetch, site } = useAuth();

  // Data states
  const [payments, setPayments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [workerId, setWorkerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transactionType, setTransactionType] = useState('advance');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Selected worker live balance state
  const [selectedWorkerBalance, setSelectedWorkerBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Filters
  const [filterWorker, setFilterWorker] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('all');

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currency = site?.currencySymbol || '₹';

  // Load all payments, workers, and balances
  const loadData = async () => {
    try {
      setLoading(true);
      const [workersRes, paymentsRes, balancesRes] = await Promise.all([
        authFetch('/api/workers'),
        authFetch('/api/payments'),
        authFetch('/api/payments/balances'),
      ]);

      if (workersRes.ok && paymentsRes.ok && balancesRes.ok) {
        const workersData = await workersRes.json();
        const paymentsData = await paymentsRes.json();
        const balancesData = await balancesRes.json();

        setWorkers(workersData);
        setPayments(paymentsData);
        setBalances(balancesData);

        if (workersData.length > 0 && !workerId) {
          const firstId = workersData[0]._id;
          setWorkerId(firstId);
          fetchWorkerBalance(firstId);
        }
      }
    } catch (err) {
      console.error('Failed to load payments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch single worker's live balance breakdown
  const fetchWorkerBalance = async (wId) => {
    if (!wId) {
      setSelectedWorkerBalance(null);
      return;
    }
    try {
      setLoadingBalance(true);
      const res = await authFetch(`/api/payments/balance/${wId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedWorkerBalance(data);
      }
    } catch (err) {
      console.error('Failed to fetch worker balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // When worker selection changes
  const handleWorkerChange = (newWorkerId) => {
    setWorkerId(newWorkerId);
    fetchWorkerBalance(newWorkerId);
  };

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setTransactionType('advance');
    setPaymentMethod('Cash');
    setReferenceNumber('');
    setNotes('');
    setShowForm(false);
  };

  // Populate form for editing
  const handleEditClick = (p) => {
    setEditingId(p._id);
    const wId = p.worker?._id || p.worker;
    setWorkerId(wId);
    fetchWorkerBalance(wId);
    setAmount(p.amount);
    setDate(p.date || new Date().toISOString().split('T')[0]);
    setTransactionType(p.transactionType || p.paymentType || 'advance');
    setPaymentMethod(p.paymentMethod || p.paymentMode || 'Cash');
    setReferenceNumber(p.referenceNumber || '');
    setNotes(p.notes || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Quick button to open form for a specific worker from the balance table
  const handlePayWorkerDirect = (wId, defaultType = 'wage_payment', defaultAmount = null) => {
    setEditingId(null);
    setWorkerId(wId);
    fetchWorkerBalance(wId);
    setTransactionType(defaultType);
    if (defaultAmount !== null && defaultAmount > 0) {
      setAmount(defaultAmount);
    } else {
      setAmount('');
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Advance / Payment
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        workerId,
        amount: Number(amount),
        date,
        transactionType,
        paymentMethod,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
      };

      let res;
      if (editingId) {
        res = await authFetch(`/api/payments/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch('/api/payments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || 'Transaction failed');
      }

      const typeLabel = transactionType === 'advance' ? 'Advance' : 'Wage Payment';
      setMessage(
        editingId
          ? `${typeLabel} record updated successfully.`
          : `${typeLabel} of ${currency} ${amount} recorded for ${resData.worker?.name || 'worker'}.`
      );

      resetForm();
      loadData();
      if (workerId) fetchWorkerBalance(workerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete transaction
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payment record? This will adjust the worker balance.')) {
      return;
    }
    try {
      setMessage('');
      setError('');
      const res = await authFetch(`/api/payments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage('Transaction record deleted successfully.');
        loadData();
        if (workerId) fetchWorkerBalance(workerId);
      } else {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Delete failed');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchWorker = filterWorker === 'all' || (p.worker?._id || p.worker) === filterWorker;
    const matchDate = !filterDate || p.date === filterDate;
    const pType = p.transactionType || p.paymentType || 'advance';
    const matchType = filterType === 'all' || pType === filterType;
    return matchWorker && matchDate && matchType;
  });

  const totalFilteredAmount = filteredPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalAdvancesFiltered = filteredPayments
    .filter((p) => (p.transactionType || p.paymentType) === 'advance')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalWagePaymentsFiltered = filteredPayments
    .filter((p) => (p.transactionType || p.paymentType) === 'wage_payment')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Advances & Wage Payments</h1>
          <div className="page-subtitle">
            Record advances given, disburse wage payments, and track dynamic outstanding balances
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) resetForm();
            else {
              resetForm();
              setShowForm(true);
            }
          }}
        >
          {showForm ? '✕ Close Form' : '+ Record Advance / Payment'}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Record Advance / Payment Form */}
      {showForm && (
        <div className="register-panel" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="panel-header">
            <h3>{editingId ? 'Edit Transaction Record' : 'Record New Advance or Wage Payment'}</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Outstanding = Earned Wages - Advances - Payments
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              {/* Select Worker */}
              <div className="form-group">
                <label>Select Worker *</label>
                <select
                  className="form-control"
                  value={workerId}
                  onChange={(e) => handleWorkerChange(e.target.value)}
                  required
                >
                  {workers.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.workerId ? `[${w.workerId}] ` : ''}{w.name} ({w.workType || w.trade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction Type */}
              <div className="form-group">
                <label>Transaction Type *</label>
                <select
                  className="form-control"
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  required
                  style={{ fontWeight: 'bold' }}
                >
                  <option value="advance">Advance (Cash / Online Kharcha)</option>
                  <option value="wage_payment">Wage Payment (Partial / Settlement)</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {transactionType === 'advance' ? 'Deducted from future wages' : 'Disbursed towards earned wages'}
                </span>
              </div>

              {/* Amount */}
              <div className="form-group">
                <label>Amount ({currency}) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 500"
                  className="form-control"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{ fontSize: '15px', fontWeight: 'bold' }}
                />
                {selectedWorkerBalance && selectedWorkerBalance.outstanding > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '4px', fontSize: '11px', padding: '2px 6px' }}
                    onClick={() => setAmount(selectedWorkerBalance.outstanding)}
                  >
                    Set Full Balance ({currency} {selectedWorkerBalance.outstanding})
                  </button>
                )}
              </div>

              {/* Date */}
              <div className="form-group">
                <label>Transaction Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label>Payment Method *</label>
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Reference Number */}
              <div className="form-group">
                <label>Reference Number (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UPI txn ID, UTR, Cheque #"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Advance given for ration, Diwali bonus, partial week payment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Live Worker Balance Card */}
            {selectedWorkerBalance && (
              <div
                style={{
                  background: '#f9fafb',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  marginTop: '10px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Live Balance Summary for {selectedWorkerBalance.name} ({selectedWorkerBalance.workerCode})
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', textAlign: 'center' }}>
                  <div style={{ padding: '8px', background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Earned Wages</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{currency} {selectedWorkerBalance.totalEarned}</div>
                  </div>

                  <div style={{ padding: '8px', background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '11px', color: '#b45309' }}>Total Advances Given</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#b45309' }}>{currency} {selectedWorkerBalance.totalAdvances}</div>
                  </div>

                  <div style={{ padding: '8px', background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Total Wage Payments</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#15803d' }}>{currency} {selectedWorkerBalance.totalPayments}</div>
                  </div>

                  <div
                    style={{
                      padding: '8px',
                      background: selectedWorkerBalance.outstanding > 0 ? '#eff6ff' : '#f0fdf4',
                      border: `1px solid ${selectedWorkerBalance.outstanding > 0 ? '#bfdbfe' : '#bbf7d0'}`,
                      borderRadius: '3px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: selectedWorkerBalance.outstanding > 0 ? 'var(--primary)' : '#15803d' }}>
                      Remaining Outstanding
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: selectedWorkerBalance.outstanding > 0 ? 'var(--primary)' : '#15803d' }}>
                      {currency} {selectedWorkerBalance.outstanding}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || workers.length === 0}
              >
                {submitting ? 'Saving...' : editingId ? 'Update Record' : `Save ${transactionType === 'advance' ? 'Advance' : 'Wage Payment'}`}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workers Outstanding & Payable Ledger Panel */}
      <div className="register-panel">
        <div className="panel-header">
          <h3>Worker Outstanding Payable Ledger</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Outstanding = Total Earned Wages - Total Advances - Total Payments
          </span>
        </div>

        {loading ? (
          <p style={{ padding: '16px 0' }}>Loading worker balances...</p>
        ) : balances.length === 0 ? (
          <div style={{ padding: '20px 0', color: 'var(--text-muted)' }}>No worker records found.</div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="register-table">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>Worker ID</th>
                  <th>Worker Name</th>
                  <th>Trade</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total Earned</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total Advances</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total Payments</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Outstanding Due</th>
                  <th style={{ width: '170px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.workerId}>
                    <td><strong>{b.workerCode || '-'}</strong></td>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.workType}</td>
                    <td style={{ textAlign: 'right' }}>{currency} {b.totalEarned}</td>
                    <td style={{ textAlign: 'right', color: '#b45309' }}>{currency} {b.totalAdvances}</td>
                    <td style={{ textAlign: 'right', color: '#15803d' }}>{currency} {b.totalPayments}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: b.outstanding > 0 ? 'var(--primary)' : '#15803d',
                      }}
                    >
                      {currency} {b.outstanding}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handlePayWorkerDirect(b.workerId, 'advance')}
                          title="Give Advance to this worker"
                        >
                          + Advance
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handlePayWorkerDirect(b.workerId, 'wage_payment', b.outstanding > 0 ? b.outstanding : null)}
                          title="Pay wage to this worker"
                        >
                          Pay Wage
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

      {/* Payment & Advance History Table */}
      <div className="register-panel">
        <div className="panel-header">
          <h3>Payment & Advance Transaction History</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing {filteredPayments.length} of {payments.length} transactions
          </span>
        </div>

        {/* Filters Toolbar: Worker, Date, Transaction Type */}
        <div className="toolbar-bar" style={{ background: '#f9fafb', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filter by Worker */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                Filter Worker:
              </label>
              <select
                className="form-control"
                style={{ width: '180px', padding: '4px 8px', fontSize: '13px' }}
                value={filterWorker}
                onChange={(e) => setFilterWorker(e.target.value)}
              >
                <option value="all">All Workers</option>
                {workers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.workerId ? `[${w.workerId}] ` : ''}{w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Date */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                Filter Date:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: '140px', padding: '4px 8px', fontSize: '13px' }}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
                {filterDate && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setFilterDate('')} title="Clear date filter">
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Filter by Transaction Type */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                Transaction Type:
              </label>
              <select
                className="form-control"
                style={{ width: '150px', padding: '4px 8px', fontSize: '13px' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="advance">Advances Only</option>
                <option value="wage_payment">Wage Payments Only</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            Total Filtered: <strong>{currency} {totalFilteredAmount}</strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              (Advances: {currency}{totalAdvancesFiltered} • Payments: {currency}{totalWagePaymentsFiltered})
            </span>
          </div>
        </div>

        {/* Simple History Table */}
        {loading ? (
          <p style={{ padding: '20px 0' }}>Loading payment history...</p>
        ) : filteredPayments.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No transaction records found matching the filters.
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0, marginTop: '12px' }}>
            <table className="register-table">
              <thead>
                <tr>
                  <th style={{ width: '105px' }}>Date</th>
                  <th>Worker</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Transaction Type</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Amount ({currency})</th>
                  <th style={{ width: '130px' }}>Payment Method</th>
                  <th style={{ width: '130px' }}>Reference #</th>
                  <th>Notes</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const isAdvance = (p.transactionType || p.paymentType) === 'advance';

                  return (
                    <tr key={p._id}>
                      {/* Column 1: Date */}
                      <td>{p.date}</td>

                      {/* Column 2: Worker */}
                      <td>
                        <strong>
                          {p.worker?.workerId ? `[${p.worker.workerId}] ` : ''}
                          {p.worker?.name || 'Worker'}
                        </strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {p.worker?.workType || p.worker?.trade || '-'}
                        </div>
                      </td>

                      {/* Column 3: Transaction Type */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isAdvance ? '#fefce8' : '#f0fdf4',
                            color: isAdvance ? '#b45309' : '#15803d',
                            borderColor: isAdvance ? '#fde68a' : '#bbf7d0',
                          }}
                        >
                          {isAdvance ? 'Advance' : 'Wage Payment'}
                        </span>
                      </td>

                      {/* Column 4: Amount */}
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '14px' }}>
                          {currency} {p.amount}
                        </strong>
                      </td>

                      {/* Column 5: Payment Method */}
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {p.paymentMethod || p.paymentMode || 'Cash'}
                        </span>
                      </td>

                      {/* Column 6: Reference Number */}
                      <td>
                        <code style={{ fontSize: '12px', background: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>
                          {p.referenceNumber || '-'}
                        </code>
                      </td>

                      {/* Column 7: Notes */}
                      <td>{p.notes || '-'}</td>

                      {/* Column 8: Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditClick(p)}
                            title="Edit this record"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(p._id)}
                            title="Delete this record"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
