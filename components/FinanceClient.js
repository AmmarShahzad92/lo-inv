'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ─── Helpers ─── */
function formatPKR(amount) {
  if (!amount && amount !== 0) return '---'
  return 'PKR ' + Number(amount).toLocaleString('en-PK')
}

function formatDate(iso) {
  if (!iso) return '---'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

/* ─── Constants ─── */
const TRANSACTION_TYPE_LABELS = {
  investment:           'Investment',
  purchase:             'Purchase',
  sale_revenue:         'Sale Revenue',
  cost_reimbursement:   'Cost Reimbursement',
  liability_payment:    'Liability Payment',
  expense_payment:      'Expense Payment',
  petty_cash_deposit:   'Petty Cash Deposit',
  petty_cash_withdrawal:'Petty Cash Withdrawal',
  profit_distribution:  'Profit Distribution',
  profit_withdrawal:    'Profit Withdrawal',
}

const TRANSACTION_TYPE_COLORS = {
  investment:           'var(--accent-blue)',
  purchase:             'var(--accent-red)',
  sale_revenue:         'var(--accent-green)',
  cost_reimbursement:   'var(--accent-green)',
  liability_payment:    'var(--accent-amber)',
  expense_payment:      'var(--accent-red)',
  petty_cash_deposit:   'var(--accent-amber)',
  petty_cash_withdrawal:'var(--accent-amber)',
  profit_distribution:  'var(--accent-blue)',
  profit_withdrawal:    'var(--accent-red)',
}

const NEGATIVE_TYPES = new Set([
  'purchase', 'liability_payment', 'expense_payment',
  'petty_cash_deposit', 'profit_distribution', 'profit_withdrawal',
])

const TABS = [
  { key: 'capital',       label: 'Enterprise Capital' },
  { key: 'ledger',        label: 'Capital Ledger' },
  { key: 'distributions', label: 'Profit Distributions' },
  { key: 'withdrawals',   label: 'Withdrawal Requests' },
]

/* ─── Main Component ─── */
export default function FinanceClient({
  user,
  enterpriseCapital,
  investors,
  capitalLedger,
  profitDistributions,
  withdrawalRequests,
}) {
  const supabase = createClient()
  const isAdmin = user?.is_admin === true

  /* ── Local state seeded from props ── */
  const [capital, setCapital]             = useState(enterpriseCapital || { liquid_assets: 0, petty_cash: 0 })
  const [ledger, setLedger]               = useState(capitalLedger || [])
  const [distributions, setDistributions] = useState(profitDistributions || [])
  const [requests, setRequests]           = useState(withdrawalRequests || [])
  const [localInvestors, setLocalInvestors] = useState(investors || [])

  /* ── UI state ── */
  const [activeTab, setActiveTab]         = useState('capital')
  const [pettyCashModal, setPettyCashModal] = useState(null) // 'deposit' | 'withdraw' | null
  const [pettyCashAmount, setPettyCashAmount] = useState('')
  const [pettyCashDesc, setPettyCashDesc] = useState('')
  const [pettyCashLoading, setPettyCashLoading] = useState(false)

  // Ledger filters
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('')
  const [ledgerSearch, setLedgerSearch]         = useState('')

  // Distributions
  const [releasingId, setReleasingId] = useState(null)

  // Withdrawal actions
  const [actioningId, setActioningId]     = useState(null)
  const [rejectNotesId, setRejectNotesId] = useState(null)
  const [rejectNotes, setRejectNotes]     = useState('')
  const [completingId, setCompletingId]   = useState(null)

  /* ── Realtime subscriptions ── */
  useEffect(() => {
    const channel = supabase
      .channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capital' }, () => fetchCapital())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_ledger' }, () => fetchLedger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profit_distributions' }, () => fetchDistributions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => fetchRequests())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchCapital() {
    const { data } = await supabase.from('enterprise_capital').select('*').limit(1).single()
    if (data) setCapital(data)
  }

  async function fetchLedger() {
    const { data } = await supabase
      .from('capital_ledger').select('*')
      .order('created_at', { ascending: false })
    if (data) setLedger(data)
  }

  async function fetchDistributions() {
    const { data } = await supabase
      .from('profit_distributions').select('*')
      .order('created_at', { ascending: false })
    if (data) setDistributions(data)
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from('withdrawal_requests').select('*')
      .order('requested_at', { ascending: false })
    if (data) setRequests(data)
  }

  /* ═══════════════════════════════════════════
     TAB 1 — Enterprise Capital actions
     ═══════════════════════════════════════════ */
  async function handlePettyCashTransfer() {
    const amt = Number(pettyCashAmount)
    if (!amt || amt <= 0) return
    const isDeposit = pettyCashModal === 'deposit'

    if (isDeposit && amt > capital.liquid_assets) {
      alert('Insufficient liquid assets for this transfer.')
      return
    }
    if (!isDeposit && amt > capital.petty_cash) {
      alert('Insufficient petty cash for this withdrawal.')
      return
    }

    setPettyCashLoading(true)

    const newLiquid = isDeposit ? capital.liquid_assets - amt : capital.liquid_assets + amt
    const newPetty  = isDeposit ? capital.petty_cash + amt    : capital.petty_cash - amt

    const { error: capErr } = await supabase
      .from('enterprise_capital')
      .update({ liquid_assets: newLiquid, petty_cash: newPetty })
      .eq('id', capital.id)

    if (capErr) {
      alert('Failed to update capital: ' + capErr.message)
      setPettyCashLoading(false)
      return
    }

    const { error: logErr } = await supabase.from('capital_ledger').insert([{
      transaction_type: isDeposit ? 'petty_cash_deposit' : 'petty_cash_withdrawal',
      amount: amt,
      description: pettyCashDesc.trim() || (isDeposit ? 'Transfer from liquid assets to petty cash' : 'Transfer from petty cash to liquid assets'),
      created_by: user?.email || 'system',
    }])

    if (logErr) {
      alert('Capital updated but ledger entry failed: ' + logErr.message)
    }

    setCapital({ ...capital, liquid_assets: newLiquid, petty_cash: newPetty })
    setPettyCashModal(null)
    setPettyCashAmount('')
    setPettyCashDesc('')
    setPettyCashLoading(false)
    fetchLedger()
  }

  /* ═══════════════════════════════════════════
     TAB 3 — Profit Distribution actions
     ═══════════════════════════════════════════ */
  async function handleReleaseDistribution(dist) {
    if (!confirm(`Release ${formatPKR(dist.amount)} to ${dist.investor_name}?`)) return
    setReleasingId(dist.id)

    const { error: distErr } = await supabase
      .from('profit_distributions')
      .update({ status: 'released' })
      .eq('id', dist.id)

    if (distErr) {
      alert('Failed to release: ' + distErr.message)
      setReleasingId(null)
      return
    }

    // Add to investor profit_balance
    const investor = localInvestors.find(inv => inv.id === dist.investor_id)
    if (investor) {
      const newBalance = (Number(investor.profit_balance) || 0) + Number(dist.amount)
      await supabase
        .from('investors')
        .update({ profit_balance: newBalance })
        .eq('id', investor.id)
      setLocalInvestors(prev => prev.map(inv =>
        inv.id === investor.id ? { ...inv, profit_balance: newBalance } : inv
      ))
    }

    setDistributions(prev => prev.map(d =>
      d.id === dist.id ? { ...d, status: 'released' } : d
    ))
    setReleasingId(null)
  }

  /* ═══════════════════════════════════════════
     TAB 4 — Withdrawal Request actions
     ═══════════════════════════════════════════ */
  async function handleApproveRequest(req) {
    if (!confirm(`Approve withdrawal of ${formatPKR(req.amount)}?`)) return
    setActioningId(req.id)

    const { error } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email || 'admin',
      })
      .eq('id', req.id)

    if (error) {
      alert('Failed: ' + error.message)
    } else {
      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'approved', resolved_at: new Date().toISOString(), resolved_by: user?.email } : r
      ))
    }
    setActioningId(null)
  }

  async function handleRejectRequest(req) {
    if (!rejectNotes.trim()) {
      alert('Please provide a reason for rejection.')
      return
    }
    setActioningId(req.id)

    const { error } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'rejected',
        admin_notes: rejectNotes.trim(),
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email || 'admin',
      })
      .eq('id', req.id)

    if (error) {
      alert('Failed: ' + error.message)
    } else {
      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'rejected', admin_notes: rejectNotes.trim(), resolved_at: new Date().toISOString(), resolved_by: user?.email } : r
      ))
    }
    setRejectNotesId(null)
    setRejectNotes('')
    setActioningId(null)
  }

  async function handleCompleteWithdrawal(req) {
    const investor = localInvestors.find(inv => inv.id === req.investor_id)
    if (!investor) { alert('Investor not found.'); return }

    const amt = Number(req.amount)
    if (amt > (Number(investor.profit_balance) || 0)) {
      alert('Investor does not have sufficient profit balance.')
      return
    }
    if (amt > capital.liquid_assets) {
      alert('Insufficient liquid assets for this withdrawal.')
      return
    }
    if (!confirm(`Complete withdrawal: deduct ${formatPKR(amt)} from ${investor.name}'s profit balance and enterprise liquid assets?`)) return

    setCompletingId(req.id)

    // 1. Deduct from investor profit_balance
    const newBalance = (Number(investor.profit_balance) || 0) - amt
    const { error: invErr } = await supabase
      .from('investors')
      .update({ profit_balance: newBalance })
      .eq('id', investor.id)

    if (invErr) {
      alert('Failed to deduct from investor: ' + invErr.message)
      setCompletingId(null)
      return
    }

    // 2. Deduct from enterprise liquid_assets
    const newLiquid = capital.liquid_assets - amt
    const { error: capErr } = await supabase
      .from('enterprise_capital')
      .update({ liquid_assets: newLiquid })
      .eq('id', capital.id)

    if (capErr) {
      alert('Investor debited but capital deduction failed: ' + capErr.message)
      setCompletingId(null)
      return
    }

    // 3. Log to capital_ledger
    await supabase.from('capital_ledger').insert([{
      transaction_type: 'profit_withdrawal',
      amount: amt,
      description: `Profit withdrawal completed for ${investor.name}`,
      reference_id: req.id,
      created_by: user?.email || 'admin',
    }])

    // 4. Set withdrawal status to completed
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email || 'admin',
      })
      .eq('id', req.id)

    // Update local state
    setCapital(prev => ({ ...prev, liquid_assets: newLiquid }))
    setLocalInvestors(prev => prev.map(inv =>
      inv.id === investor.id ? { ...inv, profit_balance: newBalance } : inv
    ))
    setRequests(prev => prev.map(r =>
      r.id === req.id ? { ...r, status: 'completed', resolved_at: new Date().toISOString(), resolved_by: user?.email } : r
    ))
    setCompletingId(null)
    fetchLedger()
  }

  /* ═══════════════════════════════════════════
     Computed / Memos
     ═══════════════════════════════════════════ */

  // Filtered ledger
  const filteredLedger = useMemo(() => {
    const q = ledgerSearch.toLowerCase()
    return ledger
      .filter(entry => {
        if (ledgerTypeFilter && entry.transaction_type !== ledgerTypeFilter) return false
        if (q && !(entry.description || '').toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [ledger, ledgerTypeFilter, ledgerSearch])

  // Distribution stats
  const distStats = useMemo(() => {
    const total = distributions.length
    let lockedSum = 0, releasedSum = 0, withdrawnSum = 0
    distributions.forEach(d => {
      const amt = Number(d.amount) || 0
      if (d.status === 'locked')    lockedSum    += amt
      if (d.status === 'released')  releasedSum  += amt
      if (d.status === 'withdrawn') withdrawnSum += amt
    })
    return { total, lockedSum, releasedSum, withdrawnSum }
  }, [distributions])

  // Investor name lookup
  function getInvestorName(investorId) {
    const inv = localInvestors.find(i => i.id === investorId)
    return inv?.name || 'Unknown'
  }

  const netWorth = (Number(capital.liquid_assets) || 0) + (Number(capital.petty_cash) || 0)

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */
  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* ── Tab Navigation ── */}
      <div className="tab-group" style={{ marginBottom: '24px' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          TAB 1 — Enterprise Capital Dashboard
          ════════════════════════════════════════ */}
      {activeTab === 'capital' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>

            {/* Liquid Assets */}
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Liquid Assets
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>
                {formatPKR(capital.liquid_assets)}
              </div>
            </div>

            {/* Petty Cash */}
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Petty Cash
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-amber)', letterSpacing: '-0.02em' }}>
                {formatPKR(capital.petty_cash)}
              </div>
            </div>

            {/* Solid Assets */}
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Solid Assets (Inventory)
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
                See Dashboard
              </div>
            </div>

            {/* Net Worth */}
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Net Worth (Liquid + Petty)
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>
                {formatPKR(netWorth)}
              </div>
            </div>
          </div>

          {/* Petty Cash Actions */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <button
                className="btn-primary"
                onClick={() => { setPettyCashModal('deposit'); setPettyCashAmount(''); setPettyCashDesc('') }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add to Petty Cash
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setPettyCashModal('withdraw'); setPettyCashAmount(''); setPettyCashDesc('') }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Withdraw from Petty Cash
              </button>
            </div>
          )}

          {/* Investors Overview */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              Active Investors
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {localInvestors.filter(inv => inv.is_active).map(inv => (
                <div className="entity-card" key={inv.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{inv.name}</span>
                    <span className="badge badge-green" style={{ fontSize: '10px' }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div>Invested: <span style={{ color: 'var(--accent-blue)', fontWeight: '600' }}>{formatPKR(inv.investment_amount)}</span></div>
                    <div>Profit Balance: <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>{formatPKR(inv.profit_balance)}</span></div>
                    {inv.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{inv.email}</div>}
                    {inv.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{inv.phone}</div>}
                  </div>
                </div>
              ))}
              {localInvestors.filter(inv => inv.is_active).length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No active investors.
                </div>
              )}
            </div>
          </div>

          {/* Petty Cash Modal */}
          {pettyCashModal && (
            <div className="modal-overlay" onClick={() => setPettyCashModal(null)}>
              <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {pettyCashModal === 'deposit' ? 'Add to Petty Cash' : 'Withdraw from Petty Cash'}
                  </h3>
                  <button
                    onClick={() => setPettyCashModal(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                  {pettyCashModal === 'deposit'
                    ? `Transfer from Liquid Assets (${formatPKR(capital.liquid_assets)}) to Petty Cash (${formatPKR(capital.petty_cash)}).`
                    : `Transfer from Petty Cash (${formatPKR(capital.petty_cash)}) back to Liquid Assets (${formatPKR(capital.liquid_assets)}).`
                  }
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">Amount (PKR)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={pettyCashAmount}
                    onChange={e => setPettyCashAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Description (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={pettyCashDesc}
                    onChange={e => setPettyCashDesc(e.target.value)}
                    placeholder="Reason for transfer"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setPettyCashModal(null)} disabled={pettyCashLoading}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handlePettyCashTransfer} disabled={pettyCashLoading || !pettyCashAmount}>
                    {pettyCashLoading
                      ? <div className="spinner" style={{ width: '12px', height: '12px' }} />
                      : (pettyCashModal === 'deposit' ? 'Transfer to Petty Cash' : 'Transfer to Liquid Assets')
                    }
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB 2 — Capital Ledger
          ════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div>
          {/* Header + Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ marginRight: 'auto' }}>
              <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Capital Ledger
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                {filteredLedger.length} of {ledger.length} entries (immutable log)
              </p>
            </div>

            <select
              className="form-input"
              value={ledgerTypeFilter}
              onChange={e => setLedgerTypeFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '170px', fontSize: '13px', padding: '7px 10px' }}
            >
              <option value="">All types</option>
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <div style={{ position: 'relative', minWidth: '180px', maxWidth: '300px', flex: 1 }}>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="form-input"
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                placeholder="Search description..."
                style={{ paddingLeft: '32px', fontSize: '13px', width: '100%' }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            {filteredLedger.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                  {ledgerSearch || ledgerTypeFilter ? 'No entries match your filters.' : 'No ledger entries recorded yet.'}
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map(entry => {
                    const typeLabel = TRANSACTION_TYPE_LABELS[entry.transaction_type] || entry.transaction_type
                    const typeColor = TRANSACTION_TYPE_COLORS[entry.transaction_type] || 'var(--text-muted)'
                    const isNeg = NEGATIVE_TYPES.has(entry.transaction_type)
                    return (
                      <tr key={entry.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {formatDate(entry.created_at)}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '5px',
                              background: `color-mix(in srgb, ${typeColor} 12%, transparent)`,
                              color: typeColor,
                              border: `1px solid color-mix(in srgb, ${typeColor} 25%, transparent)`,
                            }}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700', whiteSpace: 'nowrap', color: isNeg ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                          {isNeg ? '−' : '+'}{formatPKR(entry.amount)}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={entry.description}>
                          {entry.description || '---'}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {entry.created_by || '---'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB 3 — Profit Distributions
          ════════════════════════════════════════ */}
      {activeTab === 'distributions' && (
        <div>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Total Distributions
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{distStats.total}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Total Locked
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-amber)' }}>{formatPKR(distStats.lockedSum)}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Total Released
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-green)' }}>{formatPKR(distStats.releasedSum)}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Total Withdrawn
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-blue)' }}>{formatPKR(distStats.withdrawnSum)}</div>
            </div>
          </div>

          {/* Distributions Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            {distributions.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No profit distributions recorded yet.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Investor</th>
                    <th>Amount</th>
                    <th>Status</th>
                    {isAdmin && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {distributions.map(dist => {
                    const isReleasing = releasingId === dist.id
                    return (
                      <tr key={dist.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {formatDate(dist.created_at)}
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {dist.investor_name || getInvestorName(dist.investor_id)}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--accent-green)', whiteSpace: 'nowrap' }}>
                          {formatPKR(dist.amount)}
                        </td>
                        <td>
                          <span className={`badge ${
                            dist.status === 'locked'    ? 'badge-amber'  :
                            dist.status === 'released'  ? 'badge-green'  :
                            dist.status === 'withdrawn' ? 'badge-blue'   : ''
                          }`}>
                            {dist.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            {dist.status === 'locked' && (
                              <button
                                className="btn-xs btn-xs-green"
                                onClick={() => handleReleaseDistribution(dist)}
                                disabled={isReleasing}
                              >
                                {isReleasing
                                  ? <div className="spinner" style={{ width: '10px', height: '10px' }} />
                                  : 'Release'
                                }
                              </button>
                            )}
                            {dist.status !== 'locked' && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>---</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB 4 — Withdrawal Requests
          ════════════════════════════════════════ */}
      {activeTab === 'withdrawals' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Withdrawal Requests
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              {requests.length} total requests
            </p>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            {requests.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No withdrawal requests yet.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Investor</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Admin Notes</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => {
                    const investorName = getInvestorName(req.investor_id)
                    const isActioning = actioningId === req.id
                    const isCompleting = completingId === req.id
                    const showRejectInput = rejectNotesId === req.id

                    return (
                      <tr key={req.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {formatDate(req.requested_at)}
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {investorName}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--accent-green)', whiteSpace: 'nowrap' }}>
                          {formatPKR(req.amount)}
                        </td>
                        <td>
                          <span className={`badge ${
                            req.status === 'pending'   ? 'badge-amber'  :
                            req.status === 'approved'  ? 'badge-blue'   :
                            req.status === 'rejected'  ? 'badge-red'    :
                            req.status === 'completed' ? 'badge-green'  : ''
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={req.admin_notes}>
                          {req.admin_notes || '---'}
                        </td>
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {/* Pending: Approve / Reject */}
                              {req.status === 'pending' && !showRejectInput && (
                                <>
                                  <button
                                    className="btn-xs btn-xs-green"
                                    onClick={() => handleApproveRequest(req)}
                                    disabled={isActioning}
                                  >
                                    {isActioning ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : 'Approve'}
                                  </button>
                                  <button
                                    className="btn-xs btn-xs-red"
                                    onClick={() => { setRejectNotesId(req.id); setRejectNotes('') }}
                                    disabled={isActioning}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {/* Reject notes input */}
                              {req.status === 'pending' && showRejectInput && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={rejectNotes}
                                    onChange={e => setRejectNotes(e.target.value)}
                                    placeholder="Reason for rejection..."
                                    style={{ fontSize: '12px', padding: '4px 8px', width: '180px' }}
                                  />
                                  <button
                                    className="btn-xs btn-xs-red"
                                    onClick={() => handleRejectRequest(req)}
                                    disabled={isActioning}
                                  >
                                    {isActioning ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : 'Confirm'}
                                  </button>
                                  <button
                                    className="btn-xs"
                                    onClick={() => { setRejectNotesId(null); setRejectNotes('') }}
                                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}

                              {/* Approved: Complete */}
                              {req.status === 'approved' && (
                                <button
                                  className="btn-xs btn-xs-amber"
                                  onClick={() => handleCompleteWithdrawal(req)}
                                  disabled={isCompleting}
                                >
                                  {isCompleting ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : 'Complete'}
                                </button>
                              )}

                              {/* Final states */}
                              {(req.status === 'completed' || req.status === 'rejected') && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>---</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
