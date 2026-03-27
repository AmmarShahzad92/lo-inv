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

function StatusBadge({ status }) {
  const map = {
    pending: 'badge badge-amber',
    partial: 'badge badge-blue',
    cleared: 'badge badge-green',
  }
  return <span className={map[status] || 'badge'}>{status}</span>
}

export default function LiabilitiesClient({ user, initialLiabilities, purchases, initialUnsettledNetProfit = 0 }) {
  const [liabilities, setLiabilities] = useState(initialLiabilities || [])
  const [sales, setSales] = useState([])
  const [capital, setCapital] = useState({ liquid_assets: 0, petty_cash: 0 })
  const [expandedId, setExpandedId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [paySource, setPaySource] = useState('net_unsettled_profit')
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState({
    description: '',
    total_amount: '',
    remaining_amount: '',
    purchase_id: '',
    due_date: '',
    notes: '',
  })

  const supabase = createClient()

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel('liabilities-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liabilities' }, fetchLiabilities)
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

  async function fetchLiabilities() {
    const { data } = await supabase.from('liabilities').select('*').order('created_at', { ascending: false })
    if (data) setLiabilities(data)
  }

  async function fetchSales() {
    const { data } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
    if (data) setSales(data)
  }

  async function fetchCapital() {
    const { data } = await supabase.from('enterprise_capital').select('*').limit(1).single()
    if (data) setCapital(data)
  }

  // --- Stats ---
  const totalCount = liabilities.length

  const totalOutstanding = useMemo(() =>
    liabilities
      .filter(l => l.status !== 'cleared')
      .reduce((s, l) => s + (Number(l.remaining_amount) || 0), 0),
    [liabilities])

  const countCleared = useMemo(() =>
    liabilities.filter(l => l.status === 'cleared').length,
    [liabilities])

  const countPendingPartial = useMemo(() =>
    liabilities.filter(l => l.status !== 'cleared').length,
    [liabilities])

  const unsettledSales = useMemo(() =>
    sales
      .filter(s => !s.profit_cleared && (Number(s.net_profit) || 0) > 0)
      .sort((a, b) => (Number(b.net_profit) || 0) - (Number(a.net_profit) || 0)),
  [sales])

  const totalUnsettledProfit = useMemo(() =>
    unsettledSales.reduce((sum, s) => sum + (Number(s.net_profit) || 0), 0),
  [unsettledSales])

  const unsettledProfitDisplay = sales.length > 0 ? totalUnsettledProfit : initialUnsettledNetProfit

  const eligibleIndividualSales = useMemo(() => {
    const required = Number(payAmount) || 0
    if (!required || required <= 0) return unsettledSales
    return unsettledSales.filter((sale) => (Number(sale.net_profit) || 0) >= required)
  }, [unsettledSales, payAmount])

  // --- Supplier name helper ---
  function getPurchaseName(purchaseId) {
    if (!purchaseId) return null
    const p = purchases.find(p => p.id === purchaseId)
    return p?.supplier_name || null
  }

  // --- Submit new liability ---
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const totalAmount = Number(form.total_amount) || 0
    const remainingAmount = form.remaining_amount !== '' ? Number(form.remaining_amount) : totalAmount

    const { data: newLiability, error } = await supabase.from('liabilities').insert([{
      description: form.description.trim(),
      total_amount: totalAmount,
      remaining_amount: remainingAmount,
      status: remainingAmount <= 0 ? 'cleared' : remainingAmount < totalAmount ? 'partial' : 'pending',
      purchase_id: form.purchase_id || null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
      created_by: user?.email || 'unknown',
    }]).select().single()

    if (error) {
      alert('Error creating liability: ' + error.message)
      setSubmitting(false)
      return
    }

    setLiabilities(prev => [newLiability, ...prev])
    setForm({ description: '', total_amount: '', remaining_amount: '', purchase_id: '', due_date: '', notes: '' })
    setShowModal(false)
    setSubmitting(false)
  }

  // --- Pay liability ---
  async function handlePay(e) {
    e.preventDefault()
    if (!showPayModal) return
    setPayingId(showPayModal.id)

    const amount = Number(payAmount) || 0
    if (amount <= 0) {
      alert('Enter a valid payment amount.')
      setPayingId(null)
      return
    }

    if (paySource !== 'net_unsettled_profit') {
      if (paySource !== 'individual_unsettled_sale') {
        alert('Invalid payment source.')
        setPayingId(null)
        return
      }

      if (!selectedSaleId) {
        alert('Select an unsettled sale for individual payment.')
        setPayingId(null)
        return
      }

      const selectedSale = unsettledSales.find((sale) => sale.id === selectedSaleId)
      if (!selectedSale || (Number(selectedSale.net_profit) || 0) < amount) {
        alert('Selected sale does not have enough unsettled profit for this payment.')
        setPayingId(null)
        return
      }
    }

    if (amount > totalUnsettledProfit) {
      alert('Payment exceeds total unsettled profit pool.')
      setPayingId(null)
      return
    }

    try {
      const res = await fetch('/api/liabilities/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liability_id: showPayModal.id,
          amount,
          source: paySource,
          sale_id: paySource === 'individual_unsettled_sale' ? selectedSaleId : null,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to pay liability.')
        setPayingId(null)
        return
      }

      setLiabilities(prev => prev.map(l =>
        l.id === showPayModal.id
          ? {
              ...l,
              remaining_amount: data.remaining_amount,
              status: data.status,
              settled_from: 'profit',
            }
          : l
      ))
    } catch {
      alert('Network error while paying liability.')
    }

    setShowPayModal(null)
    setPayAmount('')
    setPaySource('net_unsettled_profit')
    setSelectedSaleId('')
    setPayingId(null)
  }

  // --- Delete liability ---
  async function handleDelete(liability) {
    if (!confirm('Permanently delete this liability record? This cannot be undone.')) return
    setDeletingId(liability.id)

    const error = await deleteWithLog(supabase, {
      table: 'liabilities',
      id: liability.id,
      entityType: 'liability',
      modelName: liability.description || 'Unknown Liability',
      price: liability.total_amount,
      deletedBy: user?.email || 'unknown',
      entityData: liability,
    })

    setDeletingId(null)
    if (!error) {
      setLiabilities(prev => prev.filter(l => l.id !== liability.id))
      if (expandedId === liability.id) setExpandedId(null)
    }
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>Liabilities</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Outstanding balances and payment tracking</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Liability
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
            Total Liabilities
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            all time records
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Outstanding
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-amber)', letterSpacing: '-0.02em' }}>
            {formatPKR(totalOutstanding)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            across all active liabilities
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Cleared
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>
            {countCleared}
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
            {countPendingPartial}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            outstanding payments
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Unsettled Net Profit
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>
            {formatPKR(unsettledProfitDisplay)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            available for liability settlement
          </div>
        </div>
      </div>

      {/* Liability List */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            All Liabilities
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {liabilities.length} {liabilities.length === 1 ? 'record' : 'records'}
          </p>
        </div>

        {liabilities.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No liabilities recorded yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
            {liabilities.map(liability => {
              const purchaseName = getPurchaseName(liability.purchase_id)
              const isExpanded = expandedId === liability.id

              return (
                <div key={liability.id} className="entity-card" style={{ padding: '16px 20px' }}>
                  {/* Main row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {liability.description}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {liability.due_date && (
                          <span>Due: {formatDate(liability.due_date)}</span>
                        )}
                        {purchaseName && (
                          <span>Purchase: {purchaseName}</span>
                        )}
                      </div>
                      {liability.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                          {liability.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '15px' }}>{formatPKR(liability.total_amount)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Remaining</div>
                        <div style={{ fontWeight: '600', color: liability.status === 'cleared' ? 'var(--accent-green)' : 'var(--accent-amber)', fontSize: '15px' }}>
                          {formatPKR(liability.remaining_amount)}
                        </div>
                      </div>
                      <StatusBadge status={liability.status} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {liability.status !== 'cleared' && (
                          <button
                            className="btn-xs btn-xs-green"
                            onClick={() => {
                              setShowPayModal(liability)
                              setPayAmount('')
                              setPaySource('net_unsettled_profit')
                              setSelectedSaleId('')
                            }}
                            disabled={unsettledSales.length === 0}
                          >
                            {unsettledSales.length === 0 ? 'No Profit' : 'Pay'}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : liability.id)}
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
                          onClick={() => handleDelete(liability)}
                          disabled={deletingId === liability.id}
                        >
                          {deletingId === liability.id ? (
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

                  {/* Expanded details section */}
                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                      }}>
                        <div style={{
                          padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            Total Amount
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {formatPKR(liability.total_amount)}
                          </div>
                        </div>

                        <div style={{
                          padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            Remaining
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: liability.status === 'cleared' ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                            {formatPKR(liability.remaining_amount)}
                          </div>
                        </div>

                        <div style={{
                          padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            Amount Paid
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-green)' }}>
                            {formatPKR((Number(liability.total_amount) || 0) - (Number(liability.remaining_amount) || 0))}
                          </div>
                        </div>

                        <div style={{
                          padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            Status
                          </div>
                          <div style={{ marginTop: '2px' }}>
                            <StatusBadge status={liability.status} />
                          </div>
                        </div>

                        {liability.settled_from && (
                          <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                              Settled From
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {liability.settled_from === 'petty_cash' ? 'Petty Cash' : 'Profit'}
                            </div>
                          </div>
                        )}

                        {liability.due_date && (
                          <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                              Due Date
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {formatDate(liability.due_date)}
                            </div>
                          </div>
                        )}

                        {liability.cleared_at && (
                          <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                              Cleared At
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-green)' }}>
                              {formatDate(liability.cleared_at)}
                            </div>
                          </div>
                        )}

                        {purchaseName && (
                          <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                              Linked Purchase
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-blue)' }}>
                              {purchaseName}
                            </div>
                          </div>
                        )}

                        <div style={{
                          padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            Created
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                            {formatDate(liability.created_at)}
                            {liability.created_by && (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                by {liability.created_by}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {liability.notes && (
                        <div style={{
                          marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            Notes
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                            {liability.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Liability Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Add Liability
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Record a new outstanding balance
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Description</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Supplier balance - ABC Electronics"
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
                      onChange={e => setForm(f => ({
                        ...f,
                        total_amount: e.target.value,
                        remaining_amount: f.remaining_amount === '' || f.remaining_amount === f.total_amount ? e.target.value : f.remaining_amount,
                      }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="form-label">Remaining Amount (PKR)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="any"
                      value={form.remaining_amount}
                      onChange={e => setForm(f => ({ ...f, remaining_amount: e.target.value }))}
                      placeholder="Defaults to total"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Linked Purchase (Optional)</label>
                    <select
                      className="form-input"
                      value={form.purchase_id}
                      onChange={e => setForm(f => ({ ...f, purchase_id: e.target.value }))}
                    >
                      <option value="">None</option>
                      {purchases.map(p => (
                        <option key={p.id} value={p.id}>{p.supplier_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Due Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    />
                  </div>
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
                  {submitting ? 'Saving...' : 'Save Liability'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Liability Modal */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Pay Liability
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {showPayModal.description}
              </p>
            </div>

            <form onSubmit={handlePay} style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Amount</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatPKR(showPayModal.total_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Remaining</span>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: '600' }}>{formatPKR(showPayModal.remaining_amount)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Payment Amount (PKR)</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max={showPayModal.remaining_amount}
                  step="any"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder={`Max: ${showPayModal.remaining_amount}`}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => setPayAmount(String(showPayModal.remaining_amount))}
                  >
                    Pay Full
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => setPayAmount(String(Math.round((Number(showPayModal.remaining_amount) || 0) / 2)))}
                  >
                    Pay Half
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Payment Source</label>
                <select
                  className="form-input"
                  value={paySource}
                  onChange={e => {
                    setPaySource(e.target.value)
                    setSelectedSaleId('')
                  }}
                >
                  <option value="net_unsettled_profit">Net Unsettled Profit</option>
                  <option value="individual_unsettled_sale">Individual Unsettled Sale</option>
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Liabilities cannot be paid from petty cash or liquid assets.
                </div>
                {paySource === 'individual_unsettled_sale' && (
                  <div style={{ marginTop: '8px' }}>
                    <label className="form-label">Select Individual Sale</label>
                    <select
                      className="form-input"
                      value={selectedSaleId}
                      onChange={e => setSelectedSaleId(e.target.value)}
                    >
                      <option value="">Select sale with sufficient profit</option>
                      {eligibleIndividualSales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.item_description || 'Sale'} - {formatPKR(sale.net_profit)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Liquid Assets: <strong style={{ color: 'var(--text-primary)' }}>{formatPKR(capital.liquid_assets)}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Net Unsettled Profit: <strong style={{ color: 'var(--accent-amber)' }}>{formatPKR(totalUnsettledProfit)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPayModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={payingId === showPayModal.id}>
                  {payingId === showPayModal.id ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
