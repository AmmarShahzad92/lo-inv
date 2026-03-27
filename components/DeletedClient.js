'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

const TYPE_LABELS = {
  inventory:  'Inventory',
  sale:       'Sale',
  offer:      'Offer',
  expense:    'Expense',
  liability:  'Liability',
  purchase:   'Purchase',
}

const TYPE_COLORS = {
  inventory:  '#3b82f6',
  sale:       '#10b981',
  offer:      '#f59e0b',
  expense:    '#ef4444',
  liability:  '#8b5cf6',
  purchase:   '#06b6d4',
}

function formatPKR(amount) {
  if (!amount && amount !== 0) return '—'
  return 'PKR ' + Number(amount).toLocaleString('en-PK')
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const dd  = String(d.getDate()).padStart(2, '0')
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const yy  = String(d.getFullYear()).slice(2)
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${min}`
}

function extractName(email) {
  if (!email) return 'Unknown'
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/* ── Row component ── */
function DeletedRow({ item, isAdmin, onPurge, onRestore, purgingId }) {
  const [showData, setShowData] = useState(false)
  const isPurging = purgingId === item.id
  const typeColor = TYPE_COLORS[item.entity_type] || '#888'

  return (
    <>
      <tr>
        <td style={{ whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: '11px', fontWeight: '600', padding: '2px 7px',
            borderRadius: '5px',
            background: `${typeColor}18`, color: typeColor,
            border: `1px solid ${typeColor}30`,
          }}>
            {TYPE_LABELS[item.entity_type] || item.entity_type}
          </span>
        </td>
        <td>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
            {item.model_name || '—'}
          </div>
          {item.entity_id && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {item.entity_id.slice(0, 8)}…
            </div>
          )}
        </td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '13px' }}>
          {formatPKR(item.price)}
        </td>
        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {item.deleted_by ? extractName(item.deleted_by) : '—'}
        </td>
        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {formatDateTime(item.deleted_at)}
        </td>
        <td>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {item.entity_data && (
              <button
                className="btn-xs"
                onClick={() => setShowData(v => !v)}
              >
                {showData ? '▲ Hide' : '▼ Data'}
              </button>
            )}
            {isAdmin && (
              <>
              <button
                className="btn-xs btn-xs-red"
                onClick={() => onPurge(item.id)}
                disabled={isPurging}
              >
                {isPurging ? (
                  <div className="spinner" style={{ width: '10px', height: '10px' }} />
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                )}
                Purge
              </button>
              <button
                className="btn-xs btn-xs-green"
                onClick={() => onRestore(item.id)}
                disabled={isPurging}
              >
                {isPurging ? (
                  <div className="spinner" style={{ width: '10px', height: '10px' }} />
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                )}
                Restore
              </button>


              </>
            )}
          </div>
        </td>
      </tr>
      {showData && item.entity_data && (
        <tr>
          <td colSpan={6} style={{ padding: '0 12px 12px 12px' }}>
            <pre style={{
              margin: 0, padding: '10px 14px', borderRadius: '6px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              fontSize: '11px', color: 'var(--text-muted)', overflowX: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {JSON.stringify(item.entity_data, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Main DeletedClient ── */
export default function DeletedClient({ user, initialItems }) {
  const [items,     setItems]     = useState(initialItems || [])
  const [search,    setSearch]    = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [purgingId, setPurgingId] = useState(null)

  const supabase = createClient()
  const isAdmin  = user?.is_admin === true

  async function handlePurge(id) {
    if (!confirm('Permanently purge this log entry? This cannot be undone.')) return
    setPurgingId(id)
    await supabase.from('deleted_items').delete().eq('id', id)
    setPurgingId(null)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleRestore(id) {
    if (!confirm('Restore this item? This will attempt to recreate the deleted record.')) return
    setPurgingId(id)
    const { data: item } = await supabase.from('deleted_items').select('*').eq('id', id).single()
    if (item) {
      // Attempt to restore the original record based on entity_type
      let tableName = ''
      switch (item.entity_type) {
        case 'inventory': tableName = 'inventory'; break
        case 'sale':      tableName = 'sales'; break
        case 'offer':     tableName = 'vendor_offers'; break
        case 'expense':   tableName = 'expenses'; break
        case 'liability': tableName = 'liabilities'; break
        case 'purchase':  tableName = 'purchases'; break
        default: alert('Unknown entity type, cannot restore.'); return
      }
      const { error } = await supabase.from(tableName).insert(item.entity_data)
      if (error) {
        alert('Failed to restore item: ' + error.message)
      } else {
        await supabase.from('deleted_items').delete().eq('id', id)
        setItems(prev => prev.filter(i => i.id !== id))
      }
    }
    setPurgingId(null)
  } 

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      if (typeFilter && item.entity_type !== typeFilter) return false
      if (!q) return true
      return (
        (item.model_name  || '').toLowerCase().includes(q) ||
        (item.deleted_by  || '').toLowerCase().includes(q) ||
        (item.entity_type || '').toLowerCase().includes(q)
      )
    })
  }, [items, search, typeFilter])

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header + Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Deleted Items
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {filtered.length} of {items.length} log entries
          </p>
        </div>

        {/* Type filter */}
        <select
          className="form-input"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '120px', fontSize: '13px', padding: '7px 10px' }}
        >
          <option value="">All types</option>
          <option value="inventory">Inventory</option>
          <option value="sale">Sale</option>
          <option value="offer">Offer</option>
          <option value="expense">Expense</option>
          <option value="liability">Liability</option>
          <option value="purchase">Purchase</option>
        </select>

        {/* Search */}
        <div style={{ flex: '1', minWidth: '180px', maxWidth: '320px', position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, deleted by…"
            style={{ paddingLeft: '32px', fontSize: '13px', padding: '8px 12px 8px 32px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                {search || typeFilter ? 'No entries match your filters.' : 'No deleted items logged yet.'}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Price</th>
                  <th>Deleted By</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <DeletedRow
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    onPurge={handlePurge}
                    onRestore={handleRestore}
                    purgingId={purgingId}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
