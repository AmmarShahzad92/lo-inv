'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteWithLog } from '@/lib/deleteWithLog'

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

function computePaymentStatus(totalAmount, amountPaid) {
  const total = Number(totalAmount) || 0
  const paid = Number(amountPaid) || 0
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'pending'
}

function parseWholePKR(raw, label) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a valid non-negative number.`)
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole PKR amount (no decimals).`)
  }
  return value
}

function StatusBadge({ status }) {
  const map = {
    paid: 'badge badge-green',
    partial: 'badge badge-blue',
    pending: 'badge badge-amber',
  }
  return <span className={map[status] || 'badge'}>{status}</span>
}

export default function PurchasesClient({ user, initialPurchases, inventory, liabilities }) {
  const [purchases, setPurchases] = useState(initialPurchases || [])
  const [invItems, setInvItems] = useState(inventory || [])
  const [liabilityItems, setLiabilityItems] = useState(liabilities || [])
  const [expandedId, setExpandedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    supplier_name: '',
    total_amount: '',
    amount_paid: '',
    notes: '',
  })

  const supabase = createClient()

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel('purchases-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, fetchPurchases)
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchPurchases() {
    const { data } = await supabase.from('purchases').select('*').order('purchase_date', { ascending: false })
    if (data) setPurchases(data)
  }

  // --- Stats ---
  const totalPurchases = purchases.length

  const totalSpent = useMemo(() =>
    purchases.reduce((s, p) => s + (Number(p.total_amount) || 0), 0),
    [purchases])

  const totalPaid = useMemo(() =>
    purchases.filter(p => computePaymentStatus(p.total_amount, p.amount_paid) === 'paid').length,
    [purchases])

  const totalPendingPartial = useMemo(() =>
    purchases.filter(p => computePaymentStatus(p.total_amount, p.amount_paid) !== 'paid').length,
    [purchases])

  // --- Submit ---
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    let totalAmount = 0
    let amountPaid = 0
    try {
      totalAmount = parseWholePKR(form.total_amount, 'Total amount')
      amountPaid = parseWholePKR(form.amount_paid, 'Amount paid')
    } catch (err) {
      alert(err.message)
      setSubmitting(false)
      return
    }

    if (amountPaid > totalAmount) {
      alert('Amount paid cannot be greater than total amount.')
      setSubmitting(false)
      return
    }

    const paymentStatus = computePaymentStatus(totalAmount, amountPaid)

    const { data: newPurchase, error } = await supabase.from('purchases').insert([{
      supplier_name: form.supplier_name.trim(),
      total_amount: totalAmount,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      notes: form.notes.trim() || null,
      purchase_date: new Date().toISOString(),
      created_by: user?.email || 'unknown',
    }]).select().single()

    if (error) {
      alert('Error creating purchase: ' + error.message)
      setSubmitting(false)
      return
    }

    // Auto-create liability if not fully paid
    if (amountPaid < totalAmount) {
      const remainder = totalAmount - amountPaid
      await supabase.from('liabilities').insert([{
        description: `Purchase balance - ${form.supplier_name.trim()}`,
        total_amount: remainder,
        remaining_amount: remainder,
        status: 'pending',
        purchase_id: newPurchase.id,
        created_by: user?.email || 'unknown',
      }])
    }

    // Update enterprise capital: liquid_assets -= amount_paid
    if (amountPaid > 0) {
      const { data: capital } = await supabase.from('enterprise_capital').select('*').limit(1).single()
      if (capital) {
        const currentLiquid = Number(capital.liquid_assets) || 0
        const newLiquid = currentLiquid - amountPaid
        await supabase.from('enterprise_capital')
          .update({ liquid_assets: newLiquid, updated_at: new Date().toISOString() })
          .eq('id', capital.id)

        await supabase.from('capital_ledger').insert([{
          transaction_type: 'purchase',
          amount: -amountPaid,
          balance_after: newLiquid,
          petty_cash_after: Number(capital.petty_cash) || 0,
          reference_type: 'purchase',
          description: `Purchase payment to ${form.supplier_name.trim()}`,
          reference_id: newPurchase.id,
          created_by: user?.email || 'unknown',
        }])
      }
    }

    setPurchases(prev => [newPurchase, ...prev])
    setForm({ supplier_name: '', total_amount: '', amount_paid: '', notes: '' })
    setShowModal(false)
    setSubmitting(false)
  }

  // --- Delete ---
  async function handleDelete(purchase) {
    if (!confirm('Permanently delete this purchase record? This cannot be undone.')) return
    setDeletingId(purchase.id)
    const error = await deleteWithLog(supabase, {
      table: 'purchases',
      id: purchase.id,
      entityType: 'purchase',
      modelName: purchase.supplier_name || 'Unknown Supplier',
      price: purchase.total_amount,
      deletedBy: user?.email || 'unknown',
      entityData: purchase,
    })
    setDeletingId(null)
    if (!error) setPurchases(prev => prev.filter(p => p.id !== purchase.id))
  }

  // --- Linked data helpers ---
  function getLinkedInventory(purchaseId) {
    return invItems.filter(i => i.purchase_id === purchaseId)
  }

  function getLinkedLiabilities(purchaseId) {
    return liabilityItems.filter(l => l.purchase_id === purchaseId)
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>Purchases</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Track supplier purchases and payments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Purchase
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Purchases
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {totalPurchases}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            all time records
          </div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Spent
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-red)', letterSpacing: '-0.02em' }}>
            {formatPKR(totalSpent)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            combined purchase value
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Paid
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>
            {totalPaid}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            fully settled
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Pending / Partial
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-amber)', letterSpacing: '-0.02em' }}>
            {totalPendingPartial}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            outstanding payments
          </div>
        </div>
      </div>

      {/* Purchase List */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Purchase Records
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {purchases.length} {purchases.length === 1 ? 'record' : 'records'}
          </p>
        </div>

        {purchases.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No purchases recorded yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
            {purchases.map(purchase => {
              const status = computePaymentStatus(purchase.total_amount, purchase.amount_paid)
              const isExpanded = expandedId === purchase.id
              const linkedInv = getLinkedInventory(purchase.id)
              const linkedLiab = getLinkedLiabilities(purchase.id)

              return (
                <div key={purchase.id} className="entity-card" style={{ padding: '16px 20px' }}>
                  {/* Main row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {purchase.supplier_name || 'Unknown Supplier'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatDate(purchase.purchase_date)}
                      </div>
                      {purchase.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                          {purchase.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '15px' }}>{formatPKR(purchase.total_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paid</div>
                        <div style={{ fontWeight: '600', color: 'var(--accent-green)', fontSize: '15px' }}>{formatPKR(purchase.amount_paid)}</div>
                      </div>
                      <StatusBadge status={status} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : purchase.id)}
                          style={{
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', borderRadius: '5px',
                            padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
                          }}
                        >
                          {isExpanded ? '\u25B2 Less' : '\u25BC More'}
                        </button>
                        <button
                          className="btn-xs btn-xs-red"
                          onClick={() => handleDelete(purchase)}
                          disabled={deletingId === purchase.id}
                        >
                          {deletingId === purchase.id ? (
                            <div className="spinner" style={{ width: '10px', height: '10px' }} />
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          )}
                          Del
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                      {/* Linked Inventory */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                          Linked Inventory ({linkedInv.length})
                        </div>
                        {linkedInv.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No inventory items linked to this purchase.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {linkedInv.map(item => (
                              <div key={item.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 10px', borderRadius: '6px',
                                background: 'var(--bg-input)', border: '1px solid var(--border)',
                                fontSize: '12px',
                              }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                  {item.company} {item.model}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {formatPKR(item.cost_price)} &middot; Qty: {item.quantity || 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Linked Liabilities */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                          Linked Liabilities ({linkedLiab.length})
                        </div>
                        {linkedLiab.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No liabilities linked to this purchase.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {linkedLiab.map(l => (
                              <div key={l.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 10px', borderRadius: '6px',
                                background: 'var(--bg-input)', border: '1px solid var(--border)',
                                fontSize: '12px',
                              }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                  {l.description}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: 'var(--accent-amber)' }}>
                                    Remaining: {formatPKR(l.remaining_amount)}
                                  </span>
                                  <StatusBadge status={l.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Purchase Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Add Purchase
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Record a new supplier purchase
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Supplier Name</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    value={form.supplier_name}
                    onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                    placeholder="e.g. ABC Electronics"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Total Amount (PKR)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={form.total_amount}
                      onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                      onWheel={e => e.currentTarget.blur()}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="form-label">Amount Paid (PKR)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={form.amount_paid}
                      onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
                      onWheel={e => e.currentTarget.blur()}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Payment status preview */}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Status: <StatusBadge status={computePaymentStatus(form.total_amount, form.amount_paid)} />
                  {Number(form.amount_paid) < Number(form.total_amount) && Number(form.total_amount) > 0 && (
                    <span style={{ marginLeft: '8px', color: 'var(--accent-amber)' }}>
                      A liability of {formatPKR((Number(form.total_amount) || 0) - (Number(form.amount_paid) || 0))} will be auto-created
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
