'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteWithLog } from '@/lib/deleteWithLog'

/* ─── Helpers ─────────────────────────────────────────────── */

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
  return `${dd}/${mm}/${yy}`
}

/* ─── Badge helpers ───────────────────────────────────────── */

const CATEGORY_BADGE = {
  laptop:    'badge badge-blue',
  ram:       'badge badge-green',
  ssd:       'badge',
  charger:   'badge badge-amber',
  accessory: 'badge',
  other:     'badge',
}

const STATUS_BADGE = {
  sold:     'badge badge-green',
  returned: 'badge badge-amber',
  damaged:  'badge badge-red',
}

function itemLabel(item) {
  if (item.category === 'laptop') {
    const parts = [item.company, item.model].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : 'Laptop'
  }
  return item.item_name || item.category || 'Item'
}

function itemSubline(item) {
  if (item.category === 'laptop') {
    const parts = []
    if (item.processor) parts.push(item.processor)
    if (item.ram_size) parts.push(item.ram_size)
    return parts.join(' · ')
  }
  return ''
}

/* ─── Main Component ──────────────────────────────────────── */

export default function ArchiveClient({ user, initialItems, initialSales }) {
  const [items, setItems]         = useState(initialItems || [])
  const [sales]                   = useState(initialSales || [])
  const [tab, setTab]             = useState('sold')
  const [restoringId, setRestoringId] = useState(null)
  const [deletingId, setDeletingId]   = useState(null)
  const [expandedId, setExpandedId]   = useState(null)

  const supabase = createClient()

  /* ─── Sales lookup map ────────────────────────────────── */
  const salesByItemId = useMemo(() => {
    const map = {}
    ;(sales || []).forEach(s => {
      if (s.inventory_item_id) map[s.inventory_item_id] = s
    })
    return map
  }, [sales])

  /* ─── Filtered lists ──────────────────────────────────── */
  const soldItems     = useMemo(() => items.filter(i => i.status === 'sold'),     [items])
  const returnedItems = useMemo(() => items.filter(i => i.status === 'returned'), [items])
  const damagedItems  = useMemo(() => items.filter(i => i.status === 'damaged'),  [items])

  const currentList = tab === 'sold'
    ? soldItems
    : tab === 'returned'
      ? returnedItems
      : damagedItems

  /* ─── Stats for current tab ───────────────────────────── */
  const stats = useMemo(() => {
    const count = currentList.length
    const totalCost = currentList.reduce((s, i) => s + (Number(i.cost_price) || 0), 0)

    let totalRevenue = 0
    let totalNetProfit = 0

    if (tab === 'sold') {
      currentList.forEach(i => {
        const sale = salesByItemId[i.id]
        if (sale) {
          totalRevenue   += Number(sale.sale_price)  || 0
          totalNetProfit += Number(sale.net_profit)   || 0
        }
      })
    }

    return { count, totalCost, totalRevenue, totalNetProfit }
  }, [currentList, tab, salesByItemId])

  /* ─── Restore handler ─────────────────────────────────── */
  async function handleRestore(id) {
    if (!confirm('Restore this item to active inventory?')) return
    setRestoringId(id)
    const { error } = await supabase
      .from('inventory')
      .update({ status: 'in_stock', updated_at: new Date().toISOString() })
      .eq('id', id)
    setRestoringId(null)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  /* ─── Delete handler ──────────────────────────────────── */
  async function handleDelete(item) {
    if (!confirm(`Permanently delete "${itemLabel(item)}"? This cannot be undone and will be logged.`)) return
    setDeletingId(item.id)
    const error = await deleteWithLog(supabase, {
      table:      'inventory',
      id:         item.id,
      entityType: 'inventory',
      modelName:  itemLabel(item),
      price:      item.cost_price,
      deletedBy:  user?.email || 'unknown',
      entityData: item,
    })
    setDeletingId(null)
    if (!error) setItems(prev => prev.filter(i => i.id !== item.id))
  }

  /* ─── Build full specs list for an item ───────────────── */
  function getSpecs(item) {
    const specs = []
    if (item.company)       specs.push({ label: 'Company',       value: item.company })
    if (item.model)         specs.push({ label: 'Model',         value: item.model })
    if (item.processor)     specs.push({ label: 'Processor',     value: item.processor })
    if (item.ram_size)      specs.push({ label: 'RAM',           value: item.ram_size })
    if (item.ram_speed)     specs.push({ label: 'RAM Speed',     value: item.ram_speed })
    if (item.ssd_name)      specs.push({ label: 'SSD',           value: item.ssd_name })
    if (item.ssd_size)      specs.push({ label: 'SSD Size',      value: item.ssd_size })
    if (item.ssd_category)  specs.push({ label: 'SSD Category',  value: item.ssd_category })
    if (item.screen_size)   specs.push({ label: 'Screen',        value: item.screen_size })
    if (item.graphics_card) specs.push({ label: 'GPU',           value: item.graphics_card })
    if (item.battery_health) specs.push({ label: 'Battery',      value: item.battery_health })
    if (item.specifications && typeof item.specifications === 'object') {
      Object.entries(item.specifications).forEach(([k, v]) => {
        if (v) specs.push({ label: k, value: String(v) })
      })
    }
    if (item.notes) specs.push({ label: 'Notes', value: item.notes })
    return specs
  }

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px 24px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>Archive</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
          {soldItems.length} sold &middot; {returnedItems.length} returned &middot; {damagedItems.length} damaged
        </p>
      </div>

      {/* Tabs */}
      <div className="tab-group" style={{ marginBottom: '24px' }}>
        <button
          className={`tab-btn${tab === 'sold' ? ' active' : ''}`}
          onClick={() => setTab('sold')}
        >
          Sold
          {soldItems.length > 0 && (
            <span style={{
              marginLeft: '6px', fontSize: '11px', padding: '2px 7px', borderRadius: '999px',
              background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', border: '1px solid rgba(16,185,129,0.25)',
            }}>
              {soldItems.length}
            </span>
          )}
        </button>
        <button
          className={`tab-btn${tab === 'returned' ? ' active' : ''}`}
          onClick={() => setTab('returned')}
        >
          Returned
          {returnedItems.length > 0 && (
            <span style={{
              marginLeft: '6px', fontSize: '11px', padding: '2px 7px', borderRadius: '999px',
              background: 'rgba(245,158,11,0.12)', color: 'var(--accent-amber)', border: '1px solid rgba(245,158,11,0.25)',
            }}>
              {returnedItems.length}
            </span>
          )}
        </button>
        <button
          className={`tab-btn${tab === 'damaged' ? ' active' : ''}`}
          onClick={() => setTab('damaged')}
        >
          Damaged
          {damagedItems.length > 0 && (
            <span style={{
              marginLeft: '6px', fontSize: '11px', padding: '2px 7px', borderRadius: '999px',
              background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              {damagedItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: tab === 'sold'
          ? 'repeat(auto-fit, minmax(180px, 1fr))'
          : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Count
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {stats.count}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {tab} {stats.count === 1 ? 'item' : 'items'}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Total Cost
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {formatPKR(stats.totalCost)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            cost price sum
          </div>
        </div>

        {tab === 'sold' && (
          <>
            <div className="stat-card">
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Total Sale Revenue
              </div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>
                {formatPKR(stats.totalRevenue)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                sale price sum
              </div>
            </div>

            <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Total Net Profit
              </div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: stats.totalNetProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', letterSpacing: '-0.02em' }}>
                {formatPKR(stats.totalNetProfit)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                net earnings
              </div>
            </div>
          </>
        )}
      </div>

      {/* Items List */}
      {currentList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            No {tab} items yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {currentList.map(item => {
            const sale = salesByItemId[item.id]
            const isExpanded = expandedId === item.id
            const isRestoring = restoringId === item.id
            const isDeleting = deletingId === item.id
            const specs = getSpecs(item)
            const sub = itemSubline(item)
            const showRestore = tab === 'returned' || tab === 'damaged'

            return (
              <div key={item.id} className="entity-card" style={{ padding: '16px 20px' }}>

                {/* Main row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>

                  {/* Left: label, badges, sub */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {itemLabel(item)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span className={CATEGORY_BADGE[item.category] || 'badge'}>{item.category}</span>
                      <span className={STATUS_BADGE[item.status] || 'badge'}>{item.status}</span>
                    </div>
                    {sub && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                        {sub}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(item.created_at)}
                    </div>
                  </div>

                  {/* Right: cost + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost</div>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px' }}>{formatPKR(item.cost_price)}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {showRestore && (
                        <button
                          className="btn-xs btn-xs-green"
                          onClick={() => handleRestore(item.id)}
                          disabled={isRestoring}
                        >
                          {isRestoring ? (
                            <div className="spinner" style={{ width: '10px', height: '10px' }} />
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.4"/>
                            </svg>
                          )}
                          Restore
                        </button>
                      )}
                      <button
                        className="btn-xs btn-xs-red"
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <div className="spinner" style={{ width: '10px', height: '10px' }} />
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        )}
                        Delete
                      </button>
                      <button
                        className="btn-xs btn-xs-amber"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? '▲ Less' : '▼ More'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable section */}
                {isExpanded && (
                  <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                  }}>
                    {/* Full specs grid */}
                    {specs.length > 0 && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '8px 24px',
                        marginBottom: sale ? '16px' : 0,
                      }}>
                        {specs.map((sp, i) => (
                          <div key={i} style={{ fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{sp.label}: </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{sp.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Linked sale info (sold tab only) */}
                    {sale && (
                      <div style={{ borderTop: specs.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: specs.length > 0 ? '16px' : 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                          Sale Details
                        </div>

                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px' }}>
                          {sale.sold_by && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Sold by: </span>
                              <span style={{ color: 'var(--text-secondary)' }}>{sale.sold_by}</span>
                            </div>
                          )}
                          {sale.sale_date && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Date: </span>
                              <span style={{ color: 'var(--text-secondary)' }}>{formatDate(sale.sale_date)}</span>
                            </div>
                          )}
                        </div>

                        {/* P&L Waterfall */}
                        <div className="waterfall">
                          <div className="waterfall-row">
                            <span style={{ color: 'var(--text-secondary)' }}>Sale Price</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{formatPKR(sale.sale_price)}</span>
                          </div>
                          <div className="waterfall-row">
                            <span style={{ color: 'var(--text-muted)' }}>&minus; Cost Price</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatPKR(sale.cost_price)}</span>
                          </div>
                          <div className="waterfall-row total">
                            <span style={{ color: 'var(--text-secondary)' }}>= Gross Profit</span>
                            <span style={{ color: (Number(sale.gross_profit) || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {formatPKR(sale.gross_profit)}
                            </span>
                          </div>
                          {Number(sale.liabilities_deducted) > 0 && (
                            <div className="waterfall-row">
                              <span style={{ color: 'var(--text-muted)' }}>&minus; Liabilities</span>
                              <span style={{ color: 'var(--accent-red)' }}>{formatPKR(sale.liabilities_deducted)}</span>
                            </div>
                          )}
                          {Number(sale.expenses_deducted) > 0 && (
                            <div className="waterfall-row">
                              <span style={{ color: 'var(--text-muted)' }}>&minus; Expenses</span>
                              <span style={{ color: 'var(--accent-amber)' }}>{formatPKR(sale.expenses_deducted)}</span>
                            </div>
                          )}
                          {Number(sale.agent_commission) > 0 && (
                            <div className="waterfall-row">
                              <span style={{ color: 'var(--text-muted)' }}>&minus; Agent Commission{sale.agent_commission_pct ? ` (${sale.agent_commission_pct}%)` : ''}</span>
                              <span style={{ color: 'var(--accent-purple)' }}>{formatPKR(sale.agent_commission)}</span>
                            </div>
                          )}
                          {Number(sale.petty_cash_contribution) > 0 && (
                            <div className="waterfall-row">
                              <span style={{ color: 'var(--text-muted)' }}>&minus; Petty Cash</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{formatPKR(sale.petty_cash_contribution)}</span>
                            </div>
                          )}
                          <div className="waterfall-row total">
                            <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>= Net Profit</span>
                            <span style={{ fontSize: '18px', fontWeight: '700', color: (Number(sale.net_profit) || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {formatPKR(sale.net_profit)}
                            </span>
                          </div>
                        </div>

                        {sale.notes && (
                          <div style={{
                            marginTop: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-card)',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                          }}>
                            {sale.notes}
                          </div>
                        )}
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
  )
}
