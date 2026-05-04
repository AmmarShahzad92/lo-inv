'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

const CATEGORY_OPTIONS = [
    { value: 'laptop', label: 'Laptop' },
    { value: 'ram', label: 'RAM' },
    { value: 'ssd', label: 'SSD' },
    { value: 'charger', label: 'Charger' },
    { value: 'accessory', label: 'Accessory' },
    { value: 'other', label: 'Other' },
]

function formatPrice(amount) {
    return amount != null ? `PKR ${Number(amount).toLocaleString('en-PK')}` : '—'
}

function formatDate(isoString) {
    if (!isoString) return '—'
    const d = new Date(isoString)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(2)
    return `${dd}/${mm}/${yy}`
}

function getStorageLabel(storage) {
    if (!storage) return ''
    if (typeof storage === 'string') return storage
    if (storage.primary) return storage.primary
    return ''
}

function getGpuLabel(gpu) {
    if (!gpu) return ''
    if (typeof gpu === 'string') return gpu
    if (Array.isArray(gpu.dedicated) && gpu.dedicated[0]) return gpu.dedicated[0]
    if (gpu.dedicated) return gpu.dedicated
    if (gpu.integrated) return gpu.integrated
    return ''
}

function getItemTitle(item) {
    return [item.brand, item.model].filter(Boolean).join(' ') || item.item_name || 'Untitled'
}

function CatalogItemRow({ item, onDelete, onStatusChange, isDeleting }) {
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const supabase = createClient()
    const isLaptop = item.category === 'laptop'

    async function handleStatusChange(newStatus) {
        setUpdatingStatus(true)
        const { error } = await supabase.from('laptops').update({ status: newStatus }).eq('id', item.id)
        setUpdatingStatus(false)
        if (!error) {
            onStatusChange(item.id, newStatus)
        }
    }

    const storageLabel = getStorageLabel(item.storage)
    const gpuLabel = getGpuLabel(item.gpu)

    return (
        <div className="item-row">
            {/* Col 1: Title + subtitle */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 md:block">
                    <div className="font-bold text-[14px] text-[var(--text-primary)] leading-snug truncate">
                        {getItemTitle(item)}
                    </div>
                    <div className="md:hidden shrink-0 mt-0.5">
                        <span className="badge badge-amber" style={{ fontSize: '10px' }}>{item.category || 'item'}</span>
                    </div>
                </div>
                {item.cpu && (
                    <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{item.cpu}</div>
                )}
            </div>

            {/* Col 2: Spec badges */}
            <div className="flex flex-wrap gap-1.5 shrink-0 md:w-44">
                {item.ram && <span className="badge badge-blue text-[11px]">{item.ram}</span>}
                {storageLabel && <span className="badge badge-green text-[11px]">{storageLabel}</span>}
                {!isLaptop && (
                    <span className="badge badge-amber text-[11px] hidden md:inline-flex">{item.category}</span>
                )}
            </div>

            {/* Col 3: Price */}
            <div className="hidden md:block w-32 shrink-0 text-right">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Price</div>
                <div className="text-[13px] font-bold text-[var(--text-primary)]">{formatPrice(item.price)}</div>
            </div>

            {/* Col 4: GPU */}
            <div className="hidden lg:block w-36 shrink-0">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">GPU</div>
                <div className="text-[12px] text-[var(--text-secondary)] truncate">{gpuLabel || '—'}</div>
            </div>

            {/* Col 5: Status */}
            <div className="hidden lg:block w-32 shrink-0">
                <select
                    value={item.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="form-input"
                    style={{ fontSize: '11px', padding: '6px 8px' }}
                >
                    <option value="live">live</option>
                    <option value="paused">paused</option>
                    <option value="discontinued">discontinued</option>
                </select>
            </div>

            {/* Col 6: Actions */}
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <Link href={`/catalog/edit/${item.id}`} className="btn-xs no-underline">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                </Link>
                <button className="btn-xs btn-xs-red" onClick={() => onDelete(item)} disabled={isDeleting}>
                    {isDeleting ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                    )}
                    Delete
                </button>
            </div>
        </div>
    )
}

export default function CatalogPage() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [brandFilter, setBrandFilter] = useState('')
    const [deletingId, setDeletingId] = useState(null)
    const supabase = createClient()

    useEffect(() => {
        fetchCatalog()
        const ch = supabase.channel('catalog-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'laptops' }, fetchCatalog).subscribe()
        return () => { supabase.removeChannel(ch) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function fetchCatalog() {
        const { data } = await supabase.from('laptops').select('*').order('created_at', { ascending: false })
        setItems(data || [])
        setLoading(false)
    }

    const stats = useMemo(() => {
        const total = items.length
        const live = items.filter(i => i.status === 'live').length
        const paused = items.filter(i => i.status === 'paused').length
        const discontinued = items.filter(i => i.status === 'discontinued').length
        return { total, live, paused, discontinued }
    }, [items])

    const brands = useMemo(() => Array.from(new Set(items.map(i => i.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [items])

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return items.filter(i => {
            if (statusFilter && i.status !== statusFilter) return false
            if (categoryFilter && i.category !== categoryFilter) return false
            if (brandFilter && i.brand !== brandFilter) return false
            if (!q) return true
            const title = getItemTitle(i).toLowerCase()
            const cpu = (i.cpu || '').toLowerCase()
            const cat = (i.category || '').toLowerCase()
            return title.includes(q) || cpu.includes(q) || cat.includes(q)
        })
    }, [items, search, statusFilter, categoryFilter, brandFilter])

    async function handleDelete(item) {
        const label = getItemTitle(item)
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return
        setDeletingId(item.id)
        const { error } = await supabase.from('laptops').delete().eq('id', item.id)
        setDeletingId(null)
        if (!error) setItems(prev => prev.filter(i => i.id !== item.id))
    }

    function handleStatusChange(id, newStatus) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
    }

    return (
        <div className="app-shell">
            <Navbar user={null} />
            <main className="app-content px-4 sm:px-6 py-6 max-w-[1600px] mx-auto" style={{ background: 'var(--bg-primary)' }}>

                {/* ── Stats ────────────────────────────────────────── */}
                <div className="mb-8">
                    <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 mb-4">Catalog Overview</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Total Items</div>
                            <div className="text-[24px] font-bold text-[var(--accent-blue)]">{stats.total}</div>
                        </div>
                        <div className="stat-card">
                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Live</div>
                            <div className="text-[24px] font-bold text-[var(--accent-green)]">{stats.live}</div>
                        </div>
                        <div className="stat-card">
                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Paused</div>
                            <div className="text-[24px] font-bold text-[var(--accent-amber)]">{stats.paused}</div>
                        </div>
                        <div className="stat-card">
                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-2">Discontinued</div>
                            <div className="text-[24px] font-bold text-[var(--accent-red)]">{stats.discontinued}</div>
                        </div>
                    </div>
                </div>

                {/* ── Header ───────────────────────────────────────── */}
                <div className="flex items-center gap-3 flex-wrap mb-4">
                    <div>
                        <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">Catalog Items</h2>
                        <p className="text-[12px] text-[var(--text-muted)] mt-0.5 m-0">{filtered.length} of {items.length} items</p>
                    </div>
                    <div className="flex-1 min-w-[200px] max-w-[360px] ml-auto relative">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input type="text" className="form-input" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search product, brand, model, processor..."
                            style={{ paddingLeft: '32px', fontSize: '13px' }} />
                    </div>
                    <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: '130px' }}>
                        <option value="">All Status</option>
                        <option value="live">live</option>
                        <option value="paused">paused</option>
                        <option value="discontinued">discontinued</option>
                    </select>
                    <select className="form-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ minWidth: '130px' }}>
                        <option value="">All Categories</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <select className="form-input" value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ minWidth: '130px' }}>
                        <option value="">All Brands</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <Link href="/catalog/add" className="btn-primary no-underline whitespace-nowrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add to Catalog
                    </Link>
                </div>

                {/* ── Items Grid ───────────────────────────────────── */}
                {loading ? (
                    <div className="text-center py-16">
                        <div className="spinner mx-auto" style={{ width: '24px', height: '24px' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        <p className="text-[var(--text-muted)] text-[14px] m-0">
                            {search ? 'No items match your search.' : 'No catalog items yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {filtered.map(item => (
                            <CatalogItemRow
                                key={item.id}
                                item={item}
                                onDelete={handleDelete}
                                onStatusChange={handleStatusChange}
                                isDeleting={deletingId === item.id}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
