'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteWithLog } from '@/lib/deleteWithLog'

function formatPKR(amount) {
  if (!amount && amount !== 0) return '—'
  return 'PKR ' + Number(amount).toLocaleString('en-PK')
}

function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${min}`
}

function CategoryBadge({ category }) {
  const map = {
    laptop: 'badge badge-blue',
    ram: 'badge badge-green',
    ssd: 'badge badge-purple',
    charger: 'badge badge-amber',
    accessory: 'badge',
    other: 'badge',
  }
  return <span className={map[category] || 'badge'}>{category || 'other'}</span>
}

export default function SalesClient({ user, initialSales, partners, initialLiquidAssets = 0 }) {
  const [sales, setSales] = useState(initialSales || [])
  const [liquidAssets, setLiquidAssets] = useState(Number(initialLiquidAssets) || 0)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [settlingId, setSettlingId] = useState(null)

  const supabase = createClient()

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel('sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchSales)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capital' }, fetchCapital)
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchCapital()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchSales() {
    const { data } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
    if (data) setSales(data)
  }

  async function fetchCapital() {
    const { data } = await supabase.from('enterprise_capital').select('liquid_assets').limit(1).single()
    if (data) setLiquidAssets(Number(data.liquid_assets) || 0)
  }

  // --- Delete ---
  async function handleDelete(sale) {
    if (!confirm('Permanently delete this sale record? This cannot be undone.')) return
    setDeletingId(sale.id)
    const error = await deleteWithLog(supabase, {
      table: 'sales',
      id: sale.id,
      entityType: 'sale',
      modelName: sale.item_description || 'Unknown item',
      price: sale.sale_price,
      deletedBy: user?.email || 'unknown',
      entityData: sale,
    })
    setDeletingId(null)
    if (!error) setSales(prev => prev.filter(s => s.id !== sale.id))
  }

  async function handleSettle(sale) {
    if (sale.profit_cleared) return
    if (!confirm(`Settle ${formatPKR(Math.max(Number(sale.net_profit) || 0, 0))} from this sale into liquid assets?`)) return

    setSettlingId(sale.id)
    try {
      const res = await fetch('/api/sales/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_id: sale.id }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to settle sale profit.')
        return
      }

      setSales(prev => prev.map(s => (
        s.id === sale.id ? { ...s, profit_cleared: true } : s
      )))
    } catch {
      alert('Network error while settling sale.')
    } finally {
      setSettlingId(null)
    }
  }

  // --- Filtered sales ---
  const filtered = useMemo(() => {
    if (!search.trim()) return sales
    const q = search.toLowerCase()
    return sales.filter(s =>
      (s.item_description || '').toLowerCase().includes(q) ||
      (s.sold_by || '').toLowerCase().includes(q) ||
      (s.item_category || '').toLowerCase().includes(q)
    )
  }, [sales, search])

  // --- Stats (computed from ALL sales, not filtered) ---
  const totalSalesCount = sales.length

  const totalRevenue = useMemo(() =>
    sales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0),
    [sales])

  const totalNetProfit = useMemo(() =>
    sales.reduce((sum, s) => sum + (Number(s.net_profit) || 0), 0),
    [sales])

  const unsettledProfit = useMemo(() =>
    sales
      .filter(s => !s.profit_cleared)
      .reduce((sum, s) => sum + Math.max(Number(s.net_profit) || 0, 0), 0),
  [sales])

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Sales
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {totalSalesCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {totalSalesCount === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Revenue
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {formatPKR(totalRevenue)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            sum of sale prices
          </div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Liquid Assets
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>
            {formatPKR(liquidAssets)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            current enterprise cash
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: totalNetProfit >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Net Profit
          </div>
          <div style={{
            fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em',
            color: totalNetProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {formatPKR(totalNetProfit)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            after all deductions
          </div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Unsettled Net Profit
          </div>
          <div style={{
            fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em',
            color: unsettledProfit >= 0 ? 'var(--accent-amber)' : 'var(--accent-red)',
          }}>
            {formatPKR(unsettledProfit)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            not yet settled to liquid assets
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <input
          className="form-input"
          type="text"
          placeholder="Search by description, sold by, or category..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '480px', width: '100%' }}
        />
      </div>

      {/* Sales List */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Sales History
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {filtered.length} of {sales.length} {sales.length === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
              {search.trim() ? 'No sales match your search.' : 'No sales recorded yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
            {filtered.map(sale => {
              const salePrice = Number(sale.sale_price) || 0
              const costPrice = Number(sale.cost_price) || 0
              const grossProfit = Number(sale.gross_profit) || 0
              const liabilities = Number(sale.liabilities_deducted) || 0
              const expenses = Number(sale.expenses_deducted) || 0
              const agentComm = Number(sale.agent_commission) || 0
              const agentPct = Number(sale.agent_commission_pct) || 0
              const pettyCash = Number(sale.petty_cash_contribution) || 0
              const netProfit = Number(sale.net_profit) || 0
              const isExpanded = expandedId === sale.id

              return (
                <div key={sale.id} className="entity-card" style={{ padding: '16px 20px' }}>
                  {/* Top row: description + category + actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>
                          {sale.item_description || 'Untitled'}
                        </span>
                        <CategoryBadge category={sale.item_category} />
                      </div>

                      {/* Price line */}
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sale </span>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>{formatPKR(salePrice)}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost </span>
                          <span style={{ fontWeight: '500', color: 'var(--text-secondary)', fontSize: '14px' }}>{formatPKR(costPrice)}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net </span>
                          <span style={{
                            fontWeight: '700', fontSize: '14px',
                            color: netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                          }}>
                            {formatPKR(netProfit)}
                          </span>
                        </div>
                      </div>

                      {/* Meta line */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>{sale.sold_by}</span>
                        <span>&middot;</span>
                        <span>{formatDate(sale.sale_date)}</span>
                        {sale.profit_distributed && (
                          <span className="badge badge-green" style={{ fontSize: '10px' }}>Distributed</span>
                        )}
                        {sale.profit_cleared ? (
                          <span className="badge badge-blue" style={{ fontSize: '10px' }}>Cleared</span>
                        ) : (
                          <span className="badge badge-amber" style={{ fontSize: '10px' }}>Unsettled</span>
                        )}
                      </div>

                      {sale.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                          {sale.notes}
                        </div>
                      )}
                    </div>

                    {/* Right side: expand + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!sale.profit_cleared && (Number(sale.net_profit) || 0) > 0 && (
                        <button
                          className="btn-xs btn-xs-green"
                          onClick={() => handleSettle(sale)}
                          disabled={settlingId === sale.id}
                        >
                          {settlingId === sale.id ? 'Settling...' : 'Settle'}
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                      >
                        {isExpanded ? '▲ Hide P&L' : '▼ P&L'}
                      </button>
                      <button
                        className="btn-xs btn-xs-red"
                        onClick={() => handleDelete(sale)}
                        disabled={deletingId === sale.id}
                      >
                        {deletingId === sale.id ? (
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

                  {/* Expandable P&L Waterfall */}
                  {isExpanded && (
                    <div className="waterfall" style={{ marginTop: '14px' }}>
                      <div className="waterfall-row">
                        <span style={{ color: 'var(--text-secondary)' }}>Sale Price</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatPKR(salePrice)}</span>
                      </div>
                      <div className="waterfall-row">
                        <span style={{ color: 'var(--text-muted)' }}>- Cost Price</span>
                        <span style={{ color: 'var(--accent-red)' }}>-{formatPKR(costPrice)}</span>
                      </div>
                      <div className="waterfall-row total">
                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>= Gross Profit</span>
                        <span style={{
                          fontWeight: '600',
                          color: grossProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}>{formatPKR(grossProfit)}</span>
                      </div>

                      {liabilities > 0 && (
                        <div className="waterfall-row">
                          <span style={{ color: 'var(--text-muted)' }}>- Liabilities Deducted</span>
                          <span style={{ color: 'var(--accent-red)' }}>-{formatPKR(liabilities)}</span>
                        </div>
                      )}
                      {expenses > 0 && (
                        <div className="waterfall-row">
                          <span style={{ color: 'var(--text-muted)' }}>- Expenses Deducted</span>
                          <span style={{ color: 'var(--accent-red)' }}>-{formatPKR(expenses)}</span>
                        </div>
                      )}
                      {agentComm > 0 && (
                        <div className="waterfall-row">
                          <span style={{ color: 'var(--text-muted)' }}>
                            - Agent Commission{agentPct > 0 ? ` (${agentPct}%)` : ''}
                          </span>
                          <span style={{ color: 'var(--accent-red)' }}>-{formatPKR(agentComm)}</span>
                        </div>
                      )}
                      {pettyCash > 0 && (
                        <div className="waterfall-row">
                          <span style={{ color: 'var(--text-muted)' }}>- Petty Cash Contribution</span>
                          <span style={{ color: 'var(--accent-red)' }}>-{formatPKR(pettyCash)}</span>
                        </div>
                      )}

                      <div className="waterfall-row total">
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>= Net Profit</span>
                        <span style={{
                          fontWeight: '700',
                          color: netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}>{formatPKR(netProfit)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
