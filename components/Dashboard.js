'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { deleteWithLog } from '@/lib/deleteWithLog'
import { extractCPUKey, getProcessorSpecsFromDB } from '@/lib/laptopKB'
import { useApp } from '@/lib/AppContext'

/* ─── Helpers ────────────────────────────────────────────── */

function formatPKR(amount) {
  if (!amount && amount !== 0) return '---'
  return 'PKR ' + Number(amount).toLocaleString('en-PK')
}

function formatDate(isoString) {
  if (!isoString) return '---'
  const d = new Date(isoString)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function sanitizeNumericInput(value, { allowDecimal = false } = {}) {
  if (value == null) return ''
  const raw = String(value)
  const cleaned = raw.replace(allowDecimal ? /[^\d.]/g : /\D/g, '')
  if (!allowDecimal) return cleaned

  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

function normalizeUserOption(u) {
  if (!u) return null
  const email = typeof u.email === 'string' ? u.email.trim() : ''
  const display = typeof u.display_name === 'string' ? u.display_name.trim() : ''
  const value = display || email
  if (!value) return null
  return {
    id: u.id || value,
    value,
    label: display || email,
    email,
  }
}

function getDefaultSellerName(user) {
  if (!user) return ''
  const display = typeof user.display_name === 'string' ? user.display_name.trim() : ''
  if (display) return display
  const email = typeof user.email === 'string' ? user.email.trim() : ''
  if (!email) return ''
  const prefix = email.split('@')[0]
  return prefix.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const CATEGORY_LABELS = {
  laptop: 'Laptops',
  ram: 'RAM',
  ssd: 'SSDs',
  charger: 'Chargers',
  accessory: 'Accessories',
  other: 'Other',
}

const CATEGORY_BADGE_CLASS = {
  laptop: 'badge badge-blue',
  ram: 'badge badge-purple',
  ssd: 'badge badge-green',
  charger: 'badge badge-amber',
  accessory: 'badge badge-red',
  other: 'badge badge-amber',
}

const CATALOG_CONDITIONS = ['New', 'Excellent', 'Good', 'Fair']

/* ─── InventoryItemCard ──────────────────────────────────── */

function InventoryItemCard({ item, onSell, onPublish, onMarkDamaged, onDelete, deletingId }) {
  const [open, setOpen] = useState(false)
  const isDeleting = deletingId === item.id
  const isLaptop = item.category === 'laptop'

  const title = isLaptop
    ? [item.company, item.model].filter(Boolean).join(' ')
    : item.item_name || 'Unnamed Item'

  const hasExtras = item.screen_size || item.graphics_card || item.battery_health ||
    item.notes || item.processor || item.ram_speed || item.ssd_name ||
    (item.specifications && Object.keys(item.specifications).length > 0)

  return (
    <div>
      <div className="item-row">

        {/* Col 1: Title + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 md:block">
            <div className="font-bold text-[14px] text-[var(--text-primary)] leading-snug truncate">
              {title}
            </div>
            {/* Mobile: category badge */}
            <div className="md:hidden shrink-0 mt-0.5">
              <span className={CATEGORY_BADGE_CLASS[item.category] || 'badge badge-amber'} style={{ fontSize: '10px' }}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
            </div>
          </div>
          {isLaptop && item.processor && (
            <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{item.processor}</div>
          )}
          {!isLaptop && item.company && (
            <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{item.company}</div>
          )}
        </div>

        {/* Col 2: Spec badges (laptops: ram + ssd, others: category) */}
        <div className="flex flex-wrap gap-1.5 shrink-0 md:w-40">
          {isLaptop ? (
            <>
              {item.ram_size && <span className="badge badge-blue text-[11px]">{item.ram_size}</span>}
              {(item.ssd_size || item.ssd_category) && (
                <span className="badge badge-green text-[11px]">
                  {[item.ssd_size, item.ssd_category].filter(Boolean).join(' ')}
                </span>
              )}
            </>
          ) : (
            <span className={`${CATEGORY_BADGE_CLASS[item.category] || 'badge badge-amber'} text-[11px] hidden md:inline-flex`}>
              {CATEGORY_LABELS[item.category] || item.category}
            </span>
          )}
        </div>

        {/* Mobile-only: Cost + Min Sale row */}
        <div className="md:hidden flex gap-6">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Cost</div>
            <div className="text-[13px] font-bold text-[var(--text-primary)]">{formatPKR(item.cost_price)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Min Sale</div>
            <div className="text-[13px] font-semibold text-[var(--accent-green)]">{formatPKR(item.min_sale_price)}</div>
          </div>
        </div>

        {/* Col 3: Cost (desktop) */}
        <div className="hidden md:block w-28 shrink-0 text-right">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Cost</div>
          <div className="text-[13px] font-bold text-[var(--text-primary)]">{formatPKR(item.cost_price)}</div>
        </div>

        {/* Col 4: Min Sale (desktop) */}
        <div className="hidden md:block w-28 shrink-0 text-right">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Min Sale</div>
          <div className="text-[13px] font-semibold text-[var(--accent-green)]">{formatPKR(item.min_sale_price)}</div>
        </div>

        {/* Col 5: Date (large desktop) */}
        <div className="hidden lg:block w-24 shrink-0">
          <div className="text-[11px] text-[var(--text-muted)] truncate">{formatDate(item.created_at)}</div>
        </div>

        {/* Col 6: Actions */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <button className="btn-xs btn-xs-green" onClick={() => onSell(item)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Sell
          </button>
          <Link href={`/inventory/${item.id}/edit`} className="btn-xs no-underline">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
          {isLaptop && (
            <button className="btn-xs btn-xs-green" onClick={() => onPublish(item)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12l7-7 7 7" />
              </svg>
              Publish
            </button>
          )}

          <button className="btn-xs btn-xs-red" onClick={() => onMarkDamaged(item.id)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Damaged
          </button>


          <button className="btn-xs btn-xs-red" onClick={() => onDelete(item)} disabled={isDeleting}>
            {isDeleting ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            )}
            Delete
          </button>
          {hasExtras && (
            <button className="btn-details" onClick={() => setOpen(o => !o)}>
              {open ? '\u25B2' : '\u25BC'} {open ? 'Less' : 'More'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="mx-0 mt-1 mb-1 px-4 py-3 rounded-lg text-[12px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mb-3">
            {item.screen_size && (
              <div><span className="text-[var(--text-muted)]">Screen: </span><span className="text-[var(--text-secondary)]">{item.screen_size}</span></div>
            )}
            {item.graphics_card && (
              <div><span className="text-[var(--text-muted)]">GPU: </span><span className="text-[var(--text-secondary)]">{item.graphics_card}</span></div>
            )}
            {item.battery_health && (
              <div><span className="text-[var(--text-muted)]">Battery: </span><span className="text-[var(--text-secondary)]">{item.battery_health}</span></div>
            )}
            {item.ram_speed && (
              <div><span className="text-[var(--text-muted)]">RAM Speed: </span><span className="text-[var(--text-secondary)]">{item.ram_speed}</span></div>
            )}
            {item.ssd_name && (
              <div><span className="text-[var(--text-muted)]">SSD: </span><span className="text-[var(--text-secondary)]">{item.ssd_name}</span></div>
            )}
            {item.purchase_id && (
              <div><span className="text-[var(--text-muted)]">Purchase ID: </span><span className="text-[var(--text-secondary)]">{item.purchase_id}</span></div>
            )}
            <div><span className="text-[var(--text-muted)]">Added: </span><span className="text-[var(--text-secondary)]">{formatDate(item.created_at)}</span></div>
            {item.updated_at && (
              <div><span className="text-[var(--text-muted)]">Edited: </span><span className="text-[var(--text-secondary)]">{formatDate(item.updated_at)}</span></div>
            )}
            {item.created_by && (
              <div><span className="text-[var(--text-muted)]">Created by: </span><span className="text-[var(--text-secondary)]">{item.created_by}</span></div>
            )}
          </div>

          {item.notes && (
            <div className="px-3 py-2 rounded-md text-[11px] text-[var(--text-muted)] mb-3"
              style={{ background: 'var(--bg-card)' }}>
              {item.notes}
            </div>
          )}

          {item.specifications && Object.keys(item.specifications).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(item.specifications).map(([key, value]) => (
                <span key={key} className="px-2 py-0.5 rounded text-[11px] text-[var(--text-muted)]"
                  style={{ background: 'var(--bg-card)' }}>
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Dashboard component ──────────────────────────── */

export default function Dashboard({
  user,
  initialInventory,
  initialSales,
  partners,
  enterpriseCapital,
  pendingLiabilities,
  pendingExpenses,
}) {
  const { processors } = useApp()
  const [inventory, setInventory] = useState(initialInventory || [])
  const [capitalState, setCapitalState] = useState(enterpriseCapital || { liquid_assets: 0, petty_cash: 0 })
  const [pendingLiabilitiesState, setPendingLiabilitiesState] = useState(pendingLiabilities || [])
  const [pendingExpensesState, setPendingExpensesState] = useState(pendingExpenses || [])
  const [search, setSearch] = useState('')

  const [publishTarget, setPublishTarget] = useState(null)
  const [publishPrice, setPublishPrice] = useState('')
  const [publishQty, setPublishQty] = useState('1')
  const [publishCondition, setPublishCondition] = useState('Good')
  const [publishError, setPublishError] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)

  // Sell modal state
  const [sellTarget, setSellTarget] = useState(null)
  const [sellPrice, setSellPrice] = useState('')
  const [soldBy, setSoldBy] = useState('')
  const [agentCommissionPct, setAgentCommissionPct] = useState(0)
  const [pettyCashContribution, setPettyCashContribution] = useState(3000)
  const [selectedLiabilities, setSelectedLiabilities] = useState([])
  const [selectedExpenses, setSelectedExpenses] = useState([])
  const [sellNotes, setSellNotes] = useState('')
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [salesUsers, setSalesUsers] = useState(() => {
    const normalized = (partners || []).map(normalizeUserOption).filter(Boolean)
    const unique = []
    const seen = new Set()
    normalized.forEach(u => {
      const key = u.value.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      unique.push(u)
    })
    return unique
  })

  const supabase = createClient()

  /* ── Realtime subscriptions ─────────────────────────────── */

  useEffect(() => {
    const ch = supabase.channel('inventory-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_capital' }, fetchCapital)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liabilities' }, fetchPendingLiabilities)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchPendingExpenses)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true

    async function fetchSalesUsers() {
      const { data } = await supabase
        .from('users')
        .select('id, display_name, email')
        .order('display_name', { ascending: true })

      if (!active || !data) return

      const normalized = data.map(normalizeUserOption).filter(Boolean)
      const unique = []
      const seen = new Set()
      normalized.forEach(u => {
        const key = u.value.toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        unique.push(u)
      })

      if (unique.length > 0) setSalesUsers(unique)
    }

    fetchSalesUsers()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchInventory() {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('status', 'in_stock')
      .order('created_at', { ascending: false })
    if (data) setInventory(data)
  }

  async function fetchCapital() {
    const { data } = await supabase.from('enterprise_capital').select('*').limit(1).single()
    if (data) setCapitalState(data)
  }

  async function fetchPendingLiabilities() {
    const { data } = await supabase
      .from('liabilities')
      .select('*')
      .neq('status', 'cleared')
      .order('created_at', { ascending: false })
    if (data) setPendingLiabilitiesState(data)
  }

  async function fetchPendingExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (data) setPendingExpensesState(data)
  }

  /* ── Enterprise Capital stats ───────────────────────────── */

  const solidAssets = useMemo(() =>
    inventory.reduce((sum, item) => sum + (Number(item.cost_price) || 0), 0),
    [inventory])

  const liquidAssets = Number(capitalState?.liquid_assets) || 0
  const pettyCash = Number(capitalState?.petty_cash) || 0
  const totalNetWorth = liquidAssets + pettyCash + solidAssets

  /* ── Status actions ─────────────────────────────────────── */

  async function handleMarkDamaged(id) {
    if (!confirm('Mark this item as damaged? It will be removed from active inventory.')) return
    await supabase.from('inventory').update({ status: 'damaged' }).eq('id', id)
    setInventory(prev => prev.filter(i => i.id !== id))
  }

  async function handleReturn(id) {
    if (!confirm('Mark this item as returned?')) return
    await supabase.from('inventory').update({ status: 'returned' }).eq('id', id)
    setInventory(prev => prev.filter(i => i.id !== id))
  }

  async function handleDeleteItem(item) {
    const label = item.category === 'laptop'
      ? `${item.company || ''} ${item.model || ''}`.trim()
      : item.item_name || 'this item'
    if (!confirm(`Permanently delete ${label}? This cannot be undone and will be logged.`)) return
    setDeletingId(item.id)
    const error = await deleteWithLog(supabase, {
      table: 'inventory',
      id: item.id,
      entityType: 'inventory',
      modelName: label,
      price: item.cost_price,
      deletedBy: user?.email || 'unknown',
      entityData: item,
    })
    setDeletingId(null)
    if (!error) setInventory(prev => prev.filter(i => i.id !== item.id))
  }

  function openPublishModal(item) {
    setPublishTarget(item)
    setPublishPrice(String(item.min_sale_price || item.cost_price || ''))
    setPublishQty('1')
    setPublishCondition('Good')
    setPublishError('')
  }

  function closePublishModal() {
    setPublishTarget(null)
    setPublishError('')
  }

  function buildLaptopPayloadFromInventory(item, { images, price, qty, condition }) {
    const cpuKey = extractCPUKey(item.processor)
    const cpuSpecs = cpuKey ? getProcessorSpecsFromDB(cpuKey, processors) : null

    const storageValue = [item.ssd_size, item.ssd_category].filter(Boolean).join(' ') || item.ssd_name || null

    const specs = cpuSpecs ? {
      cpu_gen: cpuSpecs.gen,
      cpu_arch: cpuSpecs.arch,
      cpu_cores: cpuSpecs.cores,
      cpu_threads: cpuSpecs.threads,
      cpu_base_ghz: cpuSpecs.baseGHz,
      cpu_boost_ghz: cpuSpecs.boostGHz,
      cpu_cache_mb: cpuSpecs.cacheMB,
      cpu_tdp_w: cpuSpecs.tdpW,
      ram_type: item.ram_speed || cpuSpecs.ramTypes?.[0] || null,
      battery_health: item.battery_health || null,
    } : {}

    const highlights = []
    if (item.processor) highlights.push(item.processor)
    if (item.ram_size) highlights.push(`${item.ram_size} RAM`)
    if (storageValue) highlights.push(storageValue)
    if (condition) highlights.push(condition)
    if (item.screen_size) highlights.push(`${item.screen_size} Display`)

    return {
      inventory_id: item.id,
      category: item.category || 'laptop',
      status: 'live',
      brand: item.company?.trim() || item.item_name?.trim() || 'N/A',
      model: item.model?.trim() || item.item_name?.trim() || 'N/A',
      cpu: item.processor?.trim() || 'N/A',
      ram: item.ram_size || 'N/A',
      storage: storageValue ? { primary: storageValue } : {},
      gpu: { dedicated: item.graphics_card?.trim() || cpuSpecs?.gpu || 'Integrated' },
      screen: item.screen_size || 'N/A',
      condition: condition || 'Good',
      price,
      qty,
      images,
      highlights,
      specs,
      updated_at: new Date().toISOString(),
    }
  }

  async function handlePublish() {
    if (!publishTarget) return
    const price = Number(publishPrice)
    if (!Number.isFinite(price) || price <= 0) {
      setPublishError('Enter a valid price.')
      return
    }
    const qty = Math.max(0, Number(publishQty) || 0)

    setPublishLoading(true)
    setPublishError('')

    const { data: existing, error: lookupError } = await supabase
      .from('laptops')
      .select('id, images')
      .eq('inventory_id', publishTarget.id)
      .maybeSingle()

    if (lookupError) {
      setPublishError(lookupError.message)
      setPublishLoading(false)
      return
    }

    const images = Array.isArray(existing?.images) ? existing.images : []
    const payload = buildLaptopPayloadFromInventory(publishTarget, {
      images,
      price,
      qty,
      condition: publishCondition,
    })

    if (existing) {
      const { error } = await supabase.from('laptops').update(payload).eq('id', existing.id)
      if (error) {
        setPublishError(error.message)
        setPublishLoading(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('laptops')
        .insert([{ ...payload, created_at: new Date().toISOString() }])
      if (error) {
        setPublishError(error.message)
        setPublishLoading(false)
        return
      }
    }

    setPublishLoading(false)
    closePublishModal()
  }

  /* ── Sell modal ─────────────────────────────────────────── */

  function openSellModal(item) {
    setSellTarget(item)
    setSellPrice(String(item.min_sale_price || ''))
    const defaultSeller = getDefaultSellerName(user)
    setSoldBy(defaultSeller)
    setAgentCommissionPct(0)
    setPettyCashContribution(3000)
    setSelectedLiabilities([])
    setSelectedExpenses([])
    setSellNotes('')
    setSellError('')
  }

  function closeSellModal() {
    setSellTarget(null)
    setSellError('')
  }

  // Filter liabilities/expenses relevant to this item's purchase_id
  const relevantLiabilities = useMemo(() => {
    if (!sellTarget || !pendingLiabilitiesState) return []
    if (!sellTarget.purchase_id) return []
    return pendingLiabilitiesState.filter(l => l.purchase_id === sellTarget.purchase_id)
  }, [sellTarget, pendingLiabilitiesState])

  const relevantExpenses = useMemo(() => {
    if (!sellTarget || !pendingExpensesState) return []
    if (!sellTarget.purchase_id) return []
    return pendingExpensesState.filter(e => e.purchase_id === sellTarget.purchase_id)
  }, [sellTarget, pendingExpensesState])

  function toggleLiability(id) {
    setSelectedLiabilities(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleExpense(id) {
    setSelectedExpenses(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Live P&L waterfall preview
  const sellPreview = useMemo(() => {
    if (!sellTarget || !sellPrice) return null

    const salePrice = Number(sellPrice) || 0
    const costPrice = Number(sellTarget.cost_price) || 0
    const grossProfit = salePrice - costPrice

    const liabilitiesTotal = relevantLiabilities
      .filter(l => selectedLiabilities.includes(l.id))
      .reduce((sum, l) => sum + (Number(l.remaining_amount) || 0), 0)

    const expensesTotal = relevantExpenses
      .filter(e => selectedExpenses.includes(e.id))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    const agentCommission = Math.max(grossProfit, 0) * (Number(agentCommissionPct) || 0) / 100
    const petty = Number(pettyCashContribution) || 0
    const netProfit = grossProfit - liabilitiesTotal - expensesTotal - agentCommission - petty

    return {
      salePrice,
      costPrice,
      grossProfit,
      liabilitiesTotal,
      expensesTotal,
      agentCommission,
      pettyCash: petty,
      netProfit,
    }
  }, [sellTarget, sellPrice, agentCommissionPct, pettyCashContribution, selectedLiabilities, selectedExpenses, relevantLiabilities, relevantExpenses])

  async function handleSell(e) {
    e.preventDefault()
    setSellError('')

    const price = Number(sellPrice)
    if (!price || price <= 0) { setSellError('Enter a valid sale price.'); return }
    if (!soldBy.trim()) { setSellError('Enter the salesperson name.'); return }

    setSellLoading(true)
    try {
      const res = await fetch('/api/inventory/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_item_id: sellTarget.id,
          sale_price: price,
          sold_by: soldBy.trim(),
          agent_commission_pct: Number(agentCommissionPct) || 0,
          liabilities_to_deduct: relevantLiabilities
            .filter(l => selectedLiabilities.includes(l.id))
            .map(l => ({ liability_id: l.id, amount: Number(l.remaining_amount) || 0 })),
          expenses_to_deduct: relevantExpenses
            .filter(exp => selectedExpenses.includes(exp.id))
            .map(exp => ({ expense_id: exp.id, amount: Number(exp.amount) || 0 })),
          petty_cash_contribution: Number(pettyCashContribution) || 0,
          notes: sellNotes || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSellError(d.error || 'Sale failed.')
        return
      }
      closeSellModal()
    } catch {
      setSellError('Network error. Please try again.')
    } finally {
      setSellLoading(false)
    }
  }

  /* ── Search + grouping ──────────────────────────────────── */

  const grouped = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = inventory.filter(item =>
      !q ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.item_name || '').toLowerCase().includes(q) ||
      (item.company || '').toLowerCase().includes(q) ||
      (item.model || '').toLowerCase().includes(q) ||
      (item.processor || '').toLowerCase().includes(q)
    )

    // Group by category first
    const categoryMap = new Map()
    filtered.forEach(item => {
      const cat = item.category || 'other'
      if (!categoryMap.has(cat)) categoryMap.set(cat, [])
      categoryMap.get(cat).push(item)
    })

    // Within laptops, sub-group by company
    const result = new Map()
    const categoryOrder = ['laptop', 'ram', 'ssd', 'charger', 'accessory', 'other']

    categoryOrder.forEach(cat => {
      if (!categoryMap.has(cat)) return
      const items = categoryMap.get(cat)

      if (cat === 'laptop') {
        // Sub-group laptops by company
        const companyMap = new Map()
        items.forEach(item => {
          const co = item.company || 'Other'
          if (!companyMap.has(co)) companyMap.set(co, [])
          companyMap.get(co).push(item)
        })
        Array.from(companyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([company, companyItems]) => {
            result.set(`laptop:${company}`, {
              label: company,
              sublabel: CATEGORY_LABELS.laptop,
              items: companyItems,
            })
          })
      } else {
        result.set(cat, {
          label: CATEGORY_LABELS[cat] || cat,
          sublabel: null,
          items,
        })
      }
    })

    return result
  }, [inventory, search])

  const totalFiltered = useMemo(() => {
    let n = 0
    grouped.forEach(group => { n += group.items.length })
    return n
  }, [grouped])

  const soldByOptions = useMemo(() => {
    const options = [...salesUsers]
    if (soldBy && !options.some(option => option.value === soldBy)) {
      options.unshift({ id: `custom:${soldBy}`, value: soldBy, label: soldBy, email: '' })
    }
    return options
  }, [salesUsers, soldBy])

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Enterprise Capital ─────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-4">Enterprise Capital</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Liquid Assets</div>
            <div className="text-[20px] font-bold text-[var(--accent-blue)]">{formatPKR(liquidAssets)}</div>
          </div>
          <div className="stat-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Petty Cash</div>
            <div className="text-[20px] font-bold text-[var(--accent-amber)]">{formatPKR(pettyCash)}</div>
          </div>
          <div className="stat-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Solid Assets</div>
            <div className="text-[20px] font-bold text-[var(--accent-green)]">{formatPKR(solidAssets)}</div>
          </div>
          <div className="stat-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Total Net Worth</div>
            <div className="text-[20px] font-bold text-[var(--accent-purple)]">{formatPKR(totalNetWorth)}</div>
          </div>
        </div>
      </div>

      {/* ── Inventory header ───────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">Inventory</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 m-0">{totalFiltered} of {inventory.length} in-stock items</p>
        </div>
        <div className="flex-1 min-w-[200px] max-w-[360px] ml-auto relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" className="form-input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search category, name, brand, model, processor..."
            style={{ paddingLeft: '32px', fontSize: '13px', padding: '8px 12px 8px 32px' }} />
        </div>
        <Link href="/inventory/add" className="btn-primary no-underline whitespace-nowrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Item
        </Link>
      </div>

      {/* ── Grouped inventory rows ─────────────────────────── */}
      {grouped.size === 0 ? (
        <div className="text-center py-16">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <p className="text-[var(--text-muted)] text-[14px] m-0">
            {search ? 'No items match your search.' : 'No items in inventory yet.'}
          </p>
          {!search && (
            <Link href="/inventory/add" className="text-[var(--accent-blue)] text-[14px] mt-2 inline-block no-underline">
              Add first item &rarr;
            </Link>
          )}
        </div>
      ) : (
        Array.from(grouped.entries()).map(([key, group]) => (
          <div key={key} className="company-section">
            <div className="company-header">
              <span className="text-[var(--text-secondary)]">{group.label}</span>
              {group.sublabel && (
                <span className="font-normal text-[var(--text-muted)]">({group.sublabel})</span>
              )}
              <span className="font-normal text-[var(--text-muted)]">
                &mdash; {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="item-list">
              {group.items.map(item => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  user={user}
                  onSell={openSellModal}
                  onPublish={openPublishModal}
                  onMarkDamaged={handleMarkDamaged}
                  onReturn={handleReturn}
                  onDelete={handleDeleteItem}
                  deletingId={deletingId}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {publishTarget && (
        <div className="modal-overlay" onClick={closePublishModal}>
          <div onClick={e => e.stopPropagation()} className="modal-card animate-fade-in">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)] m-0 mb-1">Publish to Catalog</h3>
                <p className="text-[13px] text-[var(--text-muted)] m-0">
                  {publishTarget.company} {publishTarget.model}
                </p>
              </div>
              <button onClick={closePublishModal} className="text-[18px] leading-none cursor-pointer"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '2px' }}>
                &#x2715;
              </button>
            </div>

            {publishError && <div className="alert-error mb-4">{publishError}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="form-label">Price (PKR)</label>
                <input
                  className="form-input"
                  type="number"
                  value={publishPrice}
                  onChange={(e) => setPublishPrice(e.target.value)}
                  min="0"
                  step="500"
                />
              </div>
              <div>
                <label className="form-label">Quantity</label>
                <input
                  className="form-input"
                  type="number"
                  value={publishQty}
                  onChange={(e) => setPublishQty(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">Condition</label>
              <select
                className="form-input"
                value={publishCondition}
                onChange={(e) => setPublishCondition(e.target.value)}
              >
                {CATALOG_CONDITIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2.5">
              <button className="btn-primary flex-1 justify-center" onClick={handlePublish} disabled={publishLoading}>
                {publishLoading ? 'Publishing...' : 'Publish'}
              </button>
              <button className="btn-secondary min-w-[90px]" onClick={closePublishModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sell Modal ─────────────────────────────────────── */}
      {sellTarget && (
        <div className="modal-overlay" onClick={closeSellModal}>
          <div onClick={e => e.stopPropagation()} className="modal-card animate-fade-in">

            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)] m-0 mb-1">Record Sale</h3>
                <p className="text-[13px] text-[var(--text-muted)] m-0">
                  {sellTarget.category === 'laptop'
                    ? `${sellTarget.company || ''} ${sellTarget.model || ''}`.trim()
                    : sellTarget.item_name || 'Item'}
                  {' '}&middot;{' '}
                  <span className={CATEGORY_BADGE_CLASS[sellTarget.category] || 'badge badge-amber'} style={{ fontSize: '10px' }}>
                    {CATEGORY_LABELS[sellTarget.category] || sellTarget.category}
                  </span>
                </p>
              </div>
              <button onClick={closeSellModal} className="text-[18px] leading-none cursor-pointer"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '2px' }}>
                &#x2715;
              </button>
            </div>

            {/* Cost info */}
            <div className="px-3.5 py-2.5 rounded-lg mb-5 text-[13px]" style={{ background: 'var(--bg-secondary)' }}>
              <span className="text-[var(--text-muted)]">Cost Price: </span>
              <span className="text-[var(--text-primary)] font-semibold">{formatPKR(sellTarget.cost_price)}</span>
              {sellTarget.min_sale_price && (
                <>
                  <span className="text-[var(--text-muted)] ml-3">Min Sale: </span>
                  <span className="text-[var(--accent-green)] font-semibold">{formatPKR(sellTarget.min_sale_price)}</span>
                </>
              )}
            </div>

            {sellError && <div className="alert-error mb-4">{sellError}</div>}

            <form onSubmit={handleSell}>
              {/* Sale Price + Sold By */}
              <div className="grid grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label className="form-label">Sale Price *</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="decimal"
                    value={sellPrice}
                    onChange={e => setSellPrice(sanitizeNumericInput(e.target.value, { allowDecimal: true }))}
                    placeholder={String(sellTarget.min_sale_price || '')}
                  />
                </div>
                <div>
                  <label className="form-label">Sold By *</label>
                  <select
                    className="form-input"
                    value={soldBy}
                    onChange={e => setSoldBy(e.target.value)}
                  >
                    <option value="">Select salesperson</option>
                    {soldByOptions.map(option => (
                      <option key={option.id} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Agent Commission + Petty Cash */}
              <div className="grid grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label className="form-label">Agent Commission %</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="decimal"
                    value={agentCommissionPct}
                    onChange={e => setAgentCommissionPct(sanitizeNumericInput(e.target.value, { allowDecimal: true }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="form-label">Petty Cash (PKR)</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    value={pettyCashContribution}
                    onChange={e => setPettyCashContribution(sanitizeNumericInput(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Liabilities to deduct */}
              {relevantLiabilities.length > 0 && (
                <div className="mb-3.5">
                  <label className="form-label">Deduct Liabilities</label>
                  <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--bg-secondary)' }}>
                    {relevantLiabilities.map(l => (
                      <label key={l.id} className="flex items-center gap-2 cursor-pointer text-[13px]">
                        <input type="checkbox"
                          checked={selectedLiabilities.includes(l.id)}
                          onChange={() => toggleLiability(l.id)}
                          style={{ accentColor: 'var(--accent-blue)' }} />
                        <span className="text-[var(--text-secondary)] flex-1 truncate">
                          {l.description || l.creditor || `Liability #${l.id}`}
                        </span>
                        <span className="text-[var(--accent-red)] font-semibold shrink-0">
                          {formatPKR(l.remaining_amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses to deduct */}
              {relevantExpenses.length > 0 && (
                <div className="mb-3.5">
                  <label className="form-label">Deduct Expenses</label>
                  <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--bg-secondary)' }}>
                    {relevantExpenses.map(exp => (
                      <label key={exp.id} className="flex items-center gap-2 cursor-pointer text-[13px]">
                        <input type="checkbox"
                          checked={selectedExpenses.includes(exp.id)}
                          onChange={() => toggleExpense(exp.id)}
                          style={{ accentColor: 'var(--accent-blue)' }} />
                        <span className="text-[var(--text-secondary)] flex-1 truncate">
                          {exp.description || exp.category || `Expense #${exp.id}`}
                        </span>
                        <span className="text-[var(--accent-amber)] font-semibold shrink-0">
                          {formatPKR(exp.amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-5">
                <label className="form-label">Notes</label>
                <input className="form-input" type="text" value={sellNotes}
                  onChange={e => setSellNotes(e.target.value)} placeholder="Optional notes" />
              </div>

              {/* P&L Waterfall Preview */}
              {sellPreview && (
                <div className="waterfall mb-5">
                  <div className="waterfall-row">
                    <span className="text-[var(--text-secondary)]">Sale Price</span>
                    <span className="text-[var(--text-primary)] font-semibold">{formatPKR(sellPreview.salePrice)}</span>
                  </div>
                  <div className="waterfall-row">
                    <span className="text-[var(--text-muted)]">&minus; Cost Price</span>
                    <span className="text-[var(--text-secondary)]">{formatPKR(sellPreview.costPrice)}</span>
                  </div>
                  <div className="waterfall-row total">
                    <span className="text-[var(--text-secondary)]">= Gross Profit</span>
                    <span style={{ color: sellPreview.grossProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {formatPKR(sellPreview.grossProfit)}
                    </span>
                  </div>
                  {sellPreview.liabilitiesTotal > 0 && (
                    <div className="waterfall-row">
                      <span className="text-[var(--text-muted)]">&minus; Liabilities</span>
                      <span className="text-[var(--accent-red)]">{formatPKR(sellPreview.liabilitiesTotal)}</span>
                    </div>
                  )}
                  {sellPreview.expensesTotal > 0 && (
                    <div className="waterfall-row">
                      <span className="text-[var(--text-muted)]">&minus; Expenses</span>
                      <span className="text-[var(--accent-amber)]">{formatPKR(sellPreview.expensesTotal)}</span>
                    </div>
                  )}
                  {sellPreview.agentCommission > 0 && (
                    <div className="waterfall-row">
                      <span className="text-[var(--text-muted)]">&minus; Agent Commission ({agentCommissionPct}%)</span>
                      <span className="text-[var(--accent-purple)]">{formatPKR(sellPreview.agentCommission)}</span>
                    </div>
                  )}
                  {sellPreview.pettyCash > 0 && (
                    <div className="waterfall-row">
                      <span className="text-[var(--text-muted)]">&minus; Petty Cash</span>
                      <span className="text-[var(--text-secondary)]">{formatPKR(sellPreview.pettyCash)}</span>
                    </div>
                  )}
                  <div className="waterfall-row total">
                    <span className="text-[var(--text-primary)] font-bold">= Net Profit</span>
                    <span className="text-[18px] font-bold"
                      style={{ color: sellPreview.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {formatPKR(sellPreview.netProfit)}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-2.5">
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={sellLoading}>
                  {sellLoading ? <div className="spinner" /> : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Record Sale
                    </>
                  )}
                </button>
                <button type="button" className="btn-secondary min-w-[80px]" onClick={closeSellModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
