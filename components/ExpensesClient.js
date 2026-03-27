'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteWithLog } from '@/lib/deleteWithLog'

const EXPENSE_CATEGORIES = ['transport', 'fuel', 'repair', 'packaging', 'general', 'misc']

function formatPKR(amount) {
  if (!amount && amount !== 0) return '\u2014'
  return 'PKR ' + Number(amount).toLocaleString('en-PK')
}

function formatDate(isoString) {
  if (!isoString) return '\u2014'
  const d = new Date(isoString)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${min}`
}

function StatusBadge({ status }) {
  const map = {
    pending: 'badge badge-amber',
    deducted_from_profit: 'badge badge-green',
    deducted_from_petty_cash: 'badge badge-blue',
  }
  const labels = {
    pending: 'pending',
    deducted_from_profit: 'from profit',
    deducted_from_petty_cash: 'from petty cash',
  }
  return <span className={map[status] || 'badge'}>{labels[status] || status}</span>
}

function CategoryBadge({ category }) {
  const colors = {
    transport: 'badge badge-blue',
    fuel: 'badge badge-amber',
    repair: 'badge badge-red',
    packaging: 'badge badge-green',
    general: 'badge',
    misc: 'badge',
  }
  return <span className={colors[category] || 'badge'}>{category}</span>
}

export default function ExpensesClient({ user, initialExpenses, purchases }) {
  const [expenses, setExpenses] = useState(initialExpenses || [])
  const [sales, setSales] = useState([])
  const [capital, setCapital] = useState({ liquid_assets: 0, petty_cash: 0 })
  const [showModal, setShowModal] = useState(false)
  const [payModalExpense, setPayModalExpense] = useState(null)
  const [paySource, setPaySource] = useState('net_unsettled_profit')
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'general',
    purchase_id: '',
    notes: '',
  })

  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchExpenses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchSales)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capital' }, fetchCapital)
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchSales()
    fetchCapital()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchExpenses() {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })
    if (data) setExpenses(data)
  }

  async function fetchSales() {
    const { data } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
    if (data) setSales(data)
  }

  async function fetchCapital() {
    const { data } = await supabase.from('enterprise_capital').select('*').limit(1).single()
    if (data) setCapital(data)
  }

  const stats = useMemo(() => {
    const totalCount = expenses.length
    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const pendingExpenses = expenses.filter((e) => e.status === 'pending')
    const pendingCount = pendingExpenses.length
    const pendingAmount = pendingExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const settledCount = expenses.filter((e) => e.status !== 'pending').length
    return { totalCount, totalAmount, pendingCount, pendingAmount, settledCount }
  }, [expenses])

  const filteredExpenses = useMemo(() => {
    if (activeTab === 'pending') return expenses.filter((e) => e.status === 'pending')
    if (activeTab === 'settled') return expenses.filter((e) => e.status !== 'pending')
    return expenses
  }, [expenses, activeTab])

  const totalUnsettledProfit = useMemo(() =>
    sales
      .filter((s) => !s.profit_cleared)
      .reduce((sum, s) => sum + Math.max(Number(s.net_profit) || 0, 0), 0),
  [sales])

  const unsettledSales = useMemo(() =>
    sales
      .filter((s) => !s.profit_cleared && (Number(s.net_profit) || 0) > 0)
      .sort((a, b) => (Number(b.net_profit) || 0) - (Number(a.net_profit) || 0)),
  [sales])

  const eligibleIndividualSales = useMemo(() => {
    const amount = Number(payModalExpense?.amount) || 0
    if (!amount || amount <= 0) return unsettledSales
    return unsettledSales.filter((sale) => (Number(sale.net_profit) || 0) >= amount)
  }, [unsettledSales, payModalExpense])

  function getPurchaseName(purchaseId) {
    if (!purchaseId) return '\u2014'
    const purchase = purchases.find((p) => p.id === purchaseId)
    return purchase?.supplier_name || '\u2014'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const { data: newExpense, error } = await supabase
      .from('expenses')
      .insert([{
        description: form.description.trim(),
        amount: Number(form.amount) || 0,
        category: form.category,
        status: 'pending',
        purchase_id: form.purchase_id || null,
        notes: form.notes.trim() || null,
        created_by: user?.email || 'unknown',
      }])
      .select()
      .single()

    if (error) {
      alert('Error creating expense: ' + error.message)
      setSubmitting(false)
      return
    }

    setExpenses((prev) => [newExpense, ...prev])
    setForm({ description: '', amount: '', category: 'general', purchase_id: '', notes: '' })
    setShowModal(false)
    setSubmitting(false)
  }

  function openPayModal(expense) {
    const canUseUnsettled = totalUnsettledProfit >= (Number(expense.amount) || 0)
    const canUsePetty = (Number(capital.petty_cash) || 0) >= (Number(expense.amount) || 0)

    if (canUseUnsettled) {
      setPaySource('net_unsettled_profit')
    } else if (canUsePetty) {
      setPaySource('petty_cash')
    } else {
      setPaySource('net_unsettled_profit')
    }

    setPayModalExpense(expense)
    setSelectedSaleId('')
  }

  async function handlePayExpense() {
    if (!payModalExpense) return

    const amount = Number(payModalExpense.amount) || 0
    if (amount <= 0) {
      alert('Invalid expense amount.')
      return
    }

    if (paySource === 'petty_cash' && amount > (Number(capital.petty_cash) || 0)) {
      alert('Insufficient petty cash for this payment.')
      return
    }

    if (paySource === 'net_unsettled_profit' && amount > totalUnsettledProfit) {
      alert('Insufficient net unsettled profit pool for this payment.')
      return
    }

    if (paySource === 'individual_unsettled_sale') {
      if (!selectedSaleId) {
        alert('Select an individual unsettled sale.')
        return
      }

      const sale = unsettledSales.find((row) => row.id === selectedSaleId)
      if (!sale || (Number(sale.net_profit) || 0) < amount) {
        alert('Selected sale does not have enough unsettled profit.')
        return
      }
    }

    setPayingId(payModalExpense.id)

    try {
      const res = await fetch('/api/expenses/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_id: payModalExpense.id,
          source: paySource,
          sale_id: paySource === 'individual_unsettled_sale' ? selectedSaleId : null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to pay expense.')
        setPayingId(null)
        return
      }

      setExpenses((prev) => prev.map((exp) => (
        exp.id === payModalExpense.id
          ? {
              ...exp,
              status: paySource === 'petty_cash' ? 'deducted_from_petty_cash' : 'deducted_from_profit',
            }
          : exp
      )))

      setPayModalExpense(null)
      setPaySource('net_unsettled_profit')
      setSelectedSaleId('')
    } catch {
      alert('Network error while paying expense.')
    }

    setPayingId(null)
  }

  async function handleDelete(expense) {
    if (!confirm(`Delete expense "${expense.description}"? This cannot be undone.`)) return
    setDeletingId(expense.id)

    const error = await deleteWithLog(supabase, {
      table: 'expenses',
      id: expense.id,
      entityType: 'expense',
      modelName: expense.description,
      price: Number(expense.amount) || 0,
      deletedBy: user?.email || 'unknown',
      entityData: expense,
    })

    if (error) {
      alert('Error deleting expense: ' + error.message)
      setDeletingId(null)
      return
    }

    setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
    setDeletingId(null)
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>Expenses</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Operational costs and settlement control</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Expense
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Total Expenses</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stats.totalCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{stats.totalCount === 1 ? 'record' : 'records'}</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Pending Amount</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-amber)', letterSpacing: '-0.02em' }}>{formatPKR(stats.pendingAmount)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{stats.pendingCount} waiting payment</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Petty Cash</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>{formatPKR(capital.petty_cash)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>available petty reserve</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Net Unsettled Profit</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>{formatPKR(totalUnsettledProfit)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>pool (smallest sale deducted first)</div>
        </div>
      </div>

      <div className="tab-group" style={{ marginBottom: '20px' }}>
        <button className={'tab-btn' + (activeTab === 'all' ? ' active' : '')} onClick={() => setActiveTab('all')}>All ({expenses.length})</button>
        <button className={'tab-btn' + (activeTab === 'pending' ? ' active' : '')} onClick={() => setActiveTab('pending')}>Pending ({stats.pendingCount})</button>
        <button className={'tab-btn' + (activeTab === 'settled' ? ' active' : '')} onClick={() => setActiveTab('settled')}>Settled ({stats.settledCount})</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Expense Register</h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{filteredExpenses.length} rows</p>
        </div>

        {filteredExpenses.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>No expenses found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Purchase</th>
                  <th style={thStyle}>Created</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{expense.description}</div>
                      {expense.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{expense.notes}</div>
                      )}
                    </td>
                    <td style={tdStyle}><CategoryBadge category={expense.category} /></td>
                    <td style={tdStyle}><StatusBadge status={expense.status} /></td>
                    <td style={tdStyle}>{getPurchaseName(expense.purchase_id)}</td>
                    <td style={tdStyle}>{formatDate(expense.created_at)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--accent-red)' }}>{formatPKR(expense.amount)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {expense.status === 'pending' && (
                          <button className="btn-xs btn-xs-green" onClick={() => openPayModal(expense)} disabled={payingId === expense.id}>
                            {payingId === expense.id ? 'Processing...' : 'Pay'}
                          </button>
                        )}
                        <button className="btn-xs btn-xs-red" onClick={() => handleDelete(expense)} disabled={deletingId === expense.id}>
                          {deletingId === expense.id ? 'Deleting...' : 'Delete'}
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Expense</h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Record a new operational expense</p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Description</label>
                  <input className="form-input" type="text" required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Delivery charges" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Amount (PKR)</label>
                    <input className="form-input" type="number" min="0" step="any" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <label className="form-label">Category</label>
                    <select className="form-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Linked Purchase (Optional)</label>
                  <select className="form-input" value={form.purchase_id} onChange={(e) => setForm((f) => ({ ...f, purchase_id: e.target.value }))}>
                    <option value="">None</option>
                    {purchases.map((purchase) => (
                      <option key={purchase.id} value={purchase.id}>{purchase.supplier_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payModalExpense && (
        <div className="modal-overlay" onClick={() => setPayModalExpense(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>Pay Expense</h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{payModalExpense.description}</p>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expense Amount</span>
                  <span style={{ color: 'var(--accent-red)', fontWeight: '700' }}>{formatPKR(payModalExpense.amount)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Payment Source</label>
                <select
                  className="form-input"
                  value={paySource}
                  onChange={(e) => {
                    setPaySource(e.target.value)
                    setSelectedSaleId('')
                  }}
                >
                  <option value="net_unsettled_profit">Net Unsettled Profit</option>
                  <option value="individual_unsettled_sale">Individual Unsettled Sale</option>
                  <option value="petty_cash">Petty Cash</option>
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Net unsettled profit payments auto-deduct from smallest unsettled sale first.
                </div>
                {paySource === 'individual_unsettled_sale' && (
                  <div style={{ marginTop: '8px' }}>
                    <label className="form-label">Select Individual Sale</label>
                    <select className="form-input" value={selectedSaleId} onChange={(e) => setSelectedSaleId(e.target.value)}>
                      <option value="">Select sale with sufficient profit</option>
                      {eligibleIndividualSales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.item_description || 'Sale'} - {formatPKR(sale.net_profit)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Liquid Assets: <strong style={{ color: 'var(--text-primary)' }}>{formatPKR(capital.liquid_assets)}</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Petty Cash: <strong style={{ color: 'var(--accent-blue)' }}>{formatPKR(capital.petty_cash)}</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Net Unsettled Profit: <strong style={{ color: 'var(--accent-green)' }}>{formatPKR(totalUnsettledProfit)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setPayModalExpense(null)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={payingId === payModalExpense.id} onClick={handlePayExpense}>
                  {payingId === payModalExpense.id ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  fontWeight: 600,
  padding: '12px 14px',
}

const tdStyle = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  padding: '12px 14px',
  verticalAlign: 'top',
}
