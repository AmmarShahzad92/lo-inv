'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

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

function getBadgeClass(label) {
    if (!label) return 'badge badge-gray'
    const lower = String(label).toLowerCase()
    if (lower.includes('gb') || lower.includes('ram')) return 'badge badge-purple'
    if (lower.includes('storage') || lower.includes('ssd') || lower.includes('nvme')) return 'badge badge-green'
    if (lower.includes('gpu') || lower.includes('graphics') || lower.includes('nvidia') || lower.includes('amd') || lower.includes('intel')) return 'badge badge-blue'
    return 'badge badge-amber'
}

function getItemTitle(item) {
    return [item.brand, item.model].filter(Boolean).join(' ') || item.item_name || 'Untitled'
}

function CatalogItemCard({ item, user, onEdit, onDelete, onStatusChange, isDeleting }) {
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const supabase = createClient()

    async function handleStatusChange(newStatus) {
        setUpdatingStatus(true)
        const { error } = await supabase.from('laptops').update({ status: newStatus }).eq('id', item.id)
        setUpdatingStatus(false)
        if (!error) {
            onStatusChange(item.id, newStatus)
        }
    }

    return (
        <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] text-[var(--text-primary)] truncate">{getItemTitle(item)}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{item.cpu || 'CPU unknown'}</div>
                </div>
                <select
                    value={item.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="form-input"
                    style={{ fontSize: '11px', padding: '4px 8px', minWidth: '80px' }}>
                    <option value="live">live</option>
                    <option value="paused">paused</option>
                    <option value="discontinued">discontinued</option>
                </select>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
                {item.highlights && Array.isArray(item.highlights) && item.highlights.slice(0, 3).map((h, i) => (
                    <span key={i} className={`badge text-[10px] px-2 py-0.5`} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        {h}
                    </span>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3 text-[11px]">
                <div><span className="text-[var(--text-muted)]">Category:</span> <span className="text-[var(--text-secondary)]">{item.category}</span></div>
                <div><span className="text-[var(--text-muted)]">Storage:</span> <span className="text-[var(--text-secondary)]">{getStorageLabel(item.storage) || '—'}</span></div>
                <div><span className="text-[var(--text-muted)]">GPU:</span> <span className="text-[var(--text-secondary)]">{getGpuLabel(item.gpu) || '—'}</span></div>
                <div><span className="text-[var(--text-muted)]">Qty:</span> <span className="text-[var(--text-secondary)]">{item.qty ?? 0}</span></div>
            </div>

            <div className="mb-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="font-semibold text-[14px] text-[var(--text-primary)]">{formatPrice(item.price)}</div>
            </div>

            <div className="flex gap-1.5">
                <Link href={`/catalog/edit/${item.id}`} className="btn-xs btn-xs-blue" style={{ flex: 1, textAlign: 'center' }}>
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
    const router = useRouter()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
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

    const filtered = useMemo(() => {
        if (!search) return items
        const q = search.toLowerCase()
        return items.filter(i => {
            const title = getItemTitle(i).toLowerCase()
            const cpu = (i.cpu || '').toLowerCase()
            const cat = (i.category || '').toLowerCase()
            return title.includes(q) || cpu.includes(q) || cat.includes(q)
        })
    }, [items, search])

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map(item => (
                            <CatalogItemCard
                                key={item.id}
                                item={item}
                                user={null}
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
