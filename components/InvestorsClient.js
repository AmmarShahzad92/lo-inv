'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  return `${dd}/${mm}/${yy}`
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  investment_amount: '',
  notes: '',
}

export default function InvestorsClient({ user, initialInvestors, enterpriseCapital }) {
  const [investors, setInvestors] = useState(initialInvestors || [])
  const [capital, setCapital] = useState(enterpriseCapital || null)
  const [investmentEntries, setInvestmentEntries] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(null)
  const [showAddInvestmentModal, setShowAddInvestmentModal] = useState(null)
  const [showEditInvestmentModal, setShowEditInvestmentModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [addInvAmount, setAddInvAmount] = useState('')
  const [addInvNotes, setAddInvNotes] = useState('')
  const [editInvAmount, setEditInvAmount] = useState('')
  const [editInvNotes, setEditInvNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = user?.is_admin === true
  const supabase = createClient()

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel('investors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investors' }, fetchInvestors)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capital' }, fetchCapital)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_ledger' }, fetchInvestmentEntries)
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchInvestmentEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchInvestors() {
    const { data } = await supabase.from('investors').select('*').order('name')
    if (data) setInvestors(data)
  }

  async function fetchCapital() {
    const { data } = await supabase.from('enterprise_capital').select('*').limit(1).single()
    if (data) setCapital(data)
  }

  async function getOrCreateCapitalRow() {
    let currentCapital = capital
    if (currentCapital?.id) return currentCapital

    const { data: fetched } = await supabase
      .from('enterprise_capital')
      .select('*')
      .limit(1)
      .single()

    if (fetched?.id) {
      setCapital(fetched)
      return fetched
    }

    const { data: created, error: createErr } = await supabase
      .from('enterprise_capital')
      .insert([{ liquid_assets: 0, petty_cash: 0 }])
      .select()
      .single()

    if (createErr || !created?.id) {
      setError('Enterprise capital row could not be created automatically.')
      return null
    }

    setCapital(created)
    return created
  }

  async function fetchInvestmentEntries() {
    const { data } = await supabase
      .from('capital_ledger')
      .select('id, transaction_type, amount, reference_type, reference_id, description, created_at')
      .eq('transaction_type', 'investment')
      .eq('reference_type', 'investor')
      .order('created_at', { ascending: false })

    if (data) setInvestmentEntries(data)
  }

  async function applyCapitalDelta(amountDelta, investorId, description, transactionType = 'adjustment') {
    const delta = Number(amountDelta) || 0
    if (delta === 0) return true

    const currentCapital = await getOrCreateCapitalRow()

    if (!currentCapital?.id) {
      setError('Enterprise capital row not found and could not be auto-created.')
      return false
    }

    const newLiquid = (Number(currentCapital.liquid_assets) || 0) + delta
    const { error: capErr } = await supabase
      .from('enterprise_capital')
      .update({ liquid_assets: newLiquid, updated_at: new Date().toISOString() })
      .eq('id', currentCapital.id)

    if (capErr) {
      setError('Capital update failed: ' + capErr.message)
      return false
    }

    setCapital(prev => ({ ...(prev || currentCapital), liquid_assets: newLiquid }))

    const { error: ledgerErr } = await supabase.from('capital_ledger').insert([{
      transaction_type: transactionType,
      amount: delta,
      balance_after: newLiquid,
      petty_cash_after: Number(currentCapital.petty_cash) || 0,
      reference_type: 'investor',
      reference_id: investorId,
      description,
      created_by: user?.email || 'unknown',
    }])

    if (ledgerErr) {
      setError('Capital updated, but ledger log failed: ' + ledgerErr.message)
    }

    return true
  }

  async function applyInvestmentToCapital(amount, investorId, description) {
    const numericAmount = Number(amount) || 0
    if (numericAmount <= 0) return true
    return applyCapitalDelta(numericAmount, investorId, description, 'investment')
  }

  // --- Stats ---
  const totalInvestors = investors.length

  const totalInvested = useMemo(() =>
    investors.reduce((s, inv) => s + (Number(inv.investment_amount) || 0), 0),
    [investors])

  const totalProfitBalance = useMemo(() =>
    investors.reduce((s, inv) => s + (Number(inv.profit_balance) || 0), 0),
    [investors])

  const investmentsByInvestor = useMemo(() => {
    return investmentEntries.reduce((acc, row) => {
      const key = row.reference_id
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    }, {})
  }, [investmentEntries])

  // --- Add Investor ---
  async function handleAddInvestor(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Investor name is required'); return }
    const investmentAmount = Number(form.investment_amount)
    if (!investmentAmount || investmentAmount <= 0) {
      setError('Initial investment must be greater than 0.')
      return
    }
    setSubmitting(true)

    // Insert investor
    const { data: newInvestor, error: invErr } = await supabase.from('investors').insert([{
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      investment_amount: investmentAmount,
      profit_balance: 0,
      is_active: true,
      notes: form.notes.trim() || null,
    }]).select().single()

    if (invErr) {
      setError('Error adding investor: ' + invErr.message)
      setSubmitting(false)
      return
    }

    const capitalApplied = await applyInvestmentToCapital(
      investmentAmount,
      newInvestor.id,
      `Initial investment by ${form.name.trim()}`
    )

    if (!capitalApplied) {
      await supabase.from('investors').delete().eq('id', newInvestor.id)
      setSubmitting(false)
      return
    }

    // Avoid local optimistic append because realtime insert event + append causes temporary duplicates.
    await fetchInvestors()
    await fetchCapital()
    await fetchInvestmentEntries()

    setForm(EMPTY_FORM)
    setShowAddModal(false)
    setSubmitting(false)
  }

  // Handle Edit Investor 
  async function handleEditInvestor(e) {
    e.preventDefault()
    if (!showEditModal) return
    setError('')
    if (!form.name.trim()) { setError('Investor name is required'); return }
    setSubmitting(true)
    const inv = showEditModal
    const { error: invErr } = await supabase.from('investors')
      .update({ name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', inv.id)

    if (invErr) {
      setError('Failed to update investor: ' + invErr.message)
      setSubmitting(false)
      return
    }

    await fetchInvestors()
    setForm(EMPTY_FORM)
    setShowEditModal(null)
    setSubmitting(false)
  }




  // --- Add Investment ---
  async function handleAddInvestment(e) {
    e.preventDefault()
    if (!showAddInvestmentModal) return
    setError('')
    const amount = Number(addInvAmount)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }
    setSubmitting(true)

    const inv = showAddInvestmentModal
    const newTotal = (Number(inv.investment_amount) || 0) + amount

    const capitalApplied = await applyInvestmentToCapital(
      amount,
      inv.id,
      addInvNotes.trim() || `Additional investment by ${inv.name}`
    )

    if (!capitalApplied) {
      setSubmitting(false)
      return
    }

    // Update investor investment_amount
    const { error: invErr } = await supabase.from('investors')
      .update({ investment_amount: newTotal, updated_at: new Date().toISOString() })
      .eq('id', inv.id)

    if (invErr) {
      await applyCapitalDelta(
        -amount,
        inv.id,
        `Rollback: investor update failed after investment capital update for ${inv.name}`,
        'adjustment'
      )
      setError('Failed to update investor: ' + invErr.message)
      setSubmitting(false)
      return
    }

    await fetchInvestors()
    await fetchCapital()
    await fetchInvestmentEntries()

    setShowAddInvestmentModal(null)
    setAddInvAmount('')
    setAddInvNotes('')
    setSubmitting(false)
  }

  async function handleEditInvestmentEntry(e) {
    e.preventDefault()
    if (!showEditInvestmentModal) return
    setError('')

    const nextAmount = Number(editInvAmount)
    if (!nextAmount || nextAmount <= 0) {
      setError('Enter a valid amount')
      return
    }

    setSubmitting(true)
    const { entry, investor } = showEditInvestmentModal
    const prevAmount = Number(entry.amount) || 0
    const delta = nextAmount - prevAmount

    const { error: ledgerUpdateErr } = await supabase
      .from('capital_ledger')
      .update({ description: editInvNotes.trim() || entry.description || null })
      .eq('id', entry.id)

    if (ledgerUpdateErr) {
      setError('Failed to update investment note: ' + ledgerUpdateErr.message)
      setSubmitting(false)
      return
    }

    if (delta !== 0) {
      const { data: latestInvestor, error: investorFetchErr } = await supabase
        .from('investors')
        .select('id, investment_amount')
        .eq('id', investor.id)
        .single()

      if (investorFetchErr || !latestInvestor) {
        setError('Could not refresh investor total for adjustment.')
        setSubmitting(false)
        return
      }

      const updatedTotal = (Number(latestInvestor.investment_amount) || 0) + delta
      if (updatedTotal < 0) {
        setError('Adjusted investment would make total investment negative.')
        setSubmitting(false)
        return
      }

      const adjusted = await applyCapitalDelta(
        delta,
        investor.id,
        `Adjustment from edited investment entry ${entry.id.slice(0, 8)} for ${investor.name}`,
        'adjustment'
      )

      if (!adjusted) {
        setSubmitting(false)
        return
      }

      const { error: investorUpdateErr } = await supabase
        .from('investors')
        .update({ investment_amount: updatedTotal, updated_at: new Date().toISOString() })
        .eq('id', investor.id)

      if (investorUpdateErr) {
        await applyCapitalDelta(
          -delta,
          investor.id,
          `Rollback: investor total update failed after capital adjustment for ${investor.name}`,
          'adjustment'
        )
        setError('Failed to update investor total: ' + investorUpdateErr.message)
        setSubmitting(false)
        return
      }

      const { error: amountUpdateErr } = await supabase
        .from('capital_ledger')
        .update({ amount: nextAmount })
        .eq('id', entry.id)

      if (amountUpdateErr) {
        setError('Totals adjusted, but updating this entry amount failed: ' + amountUpdateErr.message)
      }
    }

    await fetchInvestors()
    await fetchCapital()
    await fetchInvestmentEntries()
    setShowEditInvestmentModal(null)
    setEditInvAmount('')
    setEditInvNotes('')
    setSubmitting(false)
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>Investors</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Manage investor profiles, capital, and profit distribution</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { setForm(EMPTY_FORM); setError(''); setShowEditModal(null); setShowAddModal(true) }}>
            + Add Investor
          </button>
        )}
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
            Total Investors
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {totalInvestors}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            registered profiles
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Invested
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>
            {formatPKR(totalInvested)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            combined capital
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Profit Balance
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>
            {formatPKR(totalProfitBalance)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            undistributed profits
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Enterprise Liquid Assets
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>
            {formatPKR(capital?.liquid_assets || 0)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            cash available in enterprise_capital
          </div>
        </div>
      </div>

      {/* Investor Cards */}
      {investors.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No investors added yet.</p>
          {isAdmin && (
            <button
              onClick={() => { setForm(EMPTY_FORM); setError(''); setShowEditModal(null); setShowAddModal(true) }}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}
            >
              Add first investor
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {investors.map(inv => {
            const invEntries = investmentsByInvestor[inv.id] || []
            return (
              <div key={inv.id} className="entity-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Name */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                      {inv.name}
                    </div>
                    {inv.email && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{inv.email}</div>
                    )}
                    {inv.phone && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{inv.phone}</div>
                    )}
                  </div>
                </div>

                {/* Financial details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Investment</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: '700' }}>{formatPKR(inv.investment_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Profit Balance</span>
                    <span style={{ color: 'var(--accent-green)', fontWeight: '700' }}>{formatPKR(inv.profit_balance)}</span>
                  </div>
                </div>

                {/* Notes */}
                {inv.notes && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    {inv.notes}
                  </div>
                )}

                {/* Meta */}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  Joined {formatDate(inv.created_at)}
                </div>

                {/* Investment history */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                    Added Investments
                  </div>
                  {invEntries.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No investment entries logged yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '170px', overflowY: 'auto', paddingRight: '2px' }}>
                      {invEntries.map(entry => (
                        <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--accent-blue)', fontWeight: '700', fontSize: '12px' }}>{formatPKR(entry.amount)}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(entry.created_at)}</span>
                          </div>
                          {entry.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{entry.description}</div>
                          )}
                          {isAdmin && (
                            <div style={{ marginTop: '6px' }}>
                              <button
                                className="btn-xs"
                                onClick={() => {
                                  setShowEditInvestmentModal({ entry, investor: inv })
                                  setEditInvAmount(String(Number(entry.amount) || 0))
                                  setEditInvNotes(entry.description || '')
                                  setError('')
                                }}
                                style={{
                                  border: '1px solid rgba(59,130,246,0.4)',
                                  background: 'rgba(59,130,246,0.08)',
                                  color: 'var(--accent-blue)',
                                }}
                              >
                                Edit Investment
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <button
                      className="btn-xs btn-xs-green"
                      onClick={() => {
                        setShowAddInvestmentModal(inv)
                        setAddInvAmount('')
                        setAddInvNotes('')
                        setError('')
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Investment
                    </button>
                    
                    <button
                      className="btn-xs btn-xs-blue"
                      onClick={() => {
                        setForm({
                          name: inv.name,
                          email: inv.email || '',
                          phone: inv.phone || '',
                          investment_amount: '',
                          notes: inv.notes || '',
                        })
                        setError('')
                        setShowEditModal(inv)
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit Details
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Investor Modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Add Investor
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Register a new investor and their initial capital
              </p>
            </div>

            <form onSubmit={handleAddInvestor} style={{ padding: '20px 24px' }}>
              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '12px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Name *</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="investor@example.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="e.g. 0300-1234567"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Initial Investment (PKR)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={form.investment_amount}
                      onChange={e => setForm(f => ({ ...f, investment_amount: e.target.value }))}
                      placeholder="0"
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
                    placeholder="Optional notes about this investor..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Investor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Investor Modal ── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Edit Investor Details
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {showEditModal.name}
              </p>
            </div>

            <form onSubmit={handleEditInvestor} style={{ padding: '20px 24px' }}>
              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '12px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Name *</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="investor@example.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="e.g. 0300-1234567"
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
                    placeholder="Optional notes about this investor..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Investment Modal ── */}
      {showAddInvestmentModal && (
        <div className="modal-overlay" onClick={() => setShowAddInvestmentModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Add Investment
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {showAddInvestmentModal.name}
              </p>
            </div>

            <form onSubmit={handleAddInvestment} style={{ padding: '20px 24px' }}>
              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '12px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)',
                }}>
                  {error}
                </div>
              )}

              {/* Current investment summary */}
              <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Investment</span>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: '600' }}>{formatPKR(showAddInvestmentModal.investment_amount)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Amount (PKR) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={addInvAmount}
                    onChange={e => { setAddInvAmount(e.target.value); setError('') }}
                    placeholder="e.g. 50000"
                    autoFocus
                  />
                  {addInvAmount && Number(addInvAmount) > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      New total: {formatPKR((Number(showAddInvestmentModal.investment_amount) || 0) + Number(addInvAmount))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <input
                    className="form-input"
                    type="text"
                    value={addInvNotes}
                    onChange={e => setAddInvNotes(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddInvestmentModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Add Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Investment Entry Modal ── */}
      {showEditInvestmentModal && (
        <div className="modal-overlay" onClick={() => setShowEditInvestmentModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Edit Investment Entry
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {showEditInvestmentModal.investor.name}
              </p>
            </div>

            <form onSubmit={handleEditInvestmentEntry} style={{ padding: '20px 24px' }}>
              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '12px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Amount (PKR)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={editInvAmount}
                    onChange={e => { setEditInvAmount(e.target.value); setError('') }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editInvNotes}
                    onChange={e => setEditInvNotes(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditInvestmentModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
