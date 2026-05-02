'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import CatalogImagesInput from '@/components/CatalogImagesInput'
import { normalizeImages } from '@/lib/catalogImages'
import { deleteWithLog } from '@/lib/deleteWithLog'
import { useApp } from '@/lib/AppContext'
import {
  getModelSuggestionsFromDB,
  getProcessorSuggestionsFromDB,
  getProcessorSpecsFromDB,
  extractCPUKey,
} from '@/lib/laptopKB'

const RAM_OPTIONS = ['4GB', '6GB', '8GB', '12GB', '16GB', '24GB', '32GB', '64GB']
const STORAGE_OPTIONS = ['128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '256GB HDD', '512GB HDD', '1TB HDD']
const SCREEN_SIZE_OPTIONS = ['10"', '11.6"', '12.5"', '13.3"', '14"', '15.6"', '16"', '17.3"']
const CONDITION_OPTIONS = ['New', 'Excellent', 'Good', 'Fair']
const COMPANY_SUGGESTIONS = ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba', 'MSI', 'Samsung', 'LG', 'Huawei', 'Microsoft', 'Sony', 'Fujitsu']

const CONDITION_COLORS = {
  'New': 'var(--accent-green)',
  'Excellent': '#3b82f6',
  'Good': '#f59e0b',
  'Fair': 'var(--accent-red)',
}

const EMPTY_FORM = {
  vendor: 'Tahir', company: '', model: '', processor: '',
  screen_size: '', ram: '', storage: '', graphics_card: '',
  condition: '', cost_price: '', comment: '',
  images: [],
}

// -- SmartInput: dropdown with autocomplete suggestions -----------------------
function SmartInput({ value, onChange, onSelect, suggestions, placeholder, label, id, style }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = suggestions.filter(s =>
    !value || s.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 12)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</label>}
      <input
        id={id}
        className="form-input"
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || ''}
        autoComplete="off"
        style={style}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-focus)',
          borderRadius: '8px',
          maxHeight: '180px',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          marginTop: '3px',
        }}>
          {filtered.map((s, i) => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); onSelect(s); setOpen(false) }}
              style={{
                padding: '7px 10px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatPKR(amount) {
  if (!amount && amount !== 0) return '—'
  return 'PKR ' + Number(amount).toLocaleString('en-PK')
}

function compactStorage(storage) {
  if (!storage) return null
  return storage
    .replace(/GB SSD/i, ' SSD').replace(/TB SSD/i, 'TB SSD')
    .replace(/GB HDD/i, ' HDD').replace(/TB HDD/i, 'TB HDD')
    .replace(/\s+/g, ' ').trim()
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  )
}

const IS = { fontSize: '12px', width: '100%', padding: '5px 8px' }
const SS = { ...IS, appearance: 'none' }

/* ─── OfferCard: row on desktop, card on mobile, form when editing ─ */
function OfferCard({ offer, onSave, onDelete, onPublish, savingId, deletingId, laptopModels, processors, supabase }) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    vendor: offer.vendor || 'Tahir',
    company: offer.company || '',
    model: offer.model || '',
    processor: offer.processor || '',
    screen_size: offer.screen_size || '',
    ram: offer.ram || '',
    storage: offer.storage || '',
    graphics_card: offer.graphics_card || '',
    condition: offer.condition || '',
    cost_price: offer.cost_price || '',
    comment: offer.comment || '',
    images: normalizeImages(offer.images),
  })

  // Knowledge base suggestions
  const modelSuggestions = useMemo(() => {
    if (!form.company) return []
    return getModelSuggestionsFromDB(form.company, form.model, laptopModels)
  }, [form.company, form.model, laptopModels])

  const processorSuggestions = useMemo(() => {
    if (!form.company || !form.model) return []
    return getProcessorSuggestionsFromDB(form.company, form.model, laptopModels)
  }, [form.company, form.model, laptopModels])

  // Auto-fill GPU when processor is selected
  function handleProcessorSelect(cpu) {
    setForm(f => {
      const specs = getProcessorSpecsFromDB(cpu, processors)
      return {
        ...f,
        processor: cpu,
        graphics_card: specs?.gpu || f.graphics_card,
      }
    })
    setFormError('')
  }

  // Sync form with offer prop when not editing (e.g., after external update)
  useEffect(() => {
    if (!editing) setForm({
      vendor: offer.vendor || 'Tahir',
      company: offer.company || '',
      model: offer.model || '',
      processor: offer.processor || '',
      screen_size: offer.screen_size || '',
      ram: offer.ram || '',
      storage: offer.storage || '',
      graphics_card: offer.graphics_card || '',
      condition: offer.condition || '',
      cost_price: offer.cost_price || '',
      comment: offer.comment || '',
      images: normalizeImages(offer.images),
    })
  }, [offer, editing])

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setFormError('') }

  function handleCancel() {
    setEditing(false); setFormError('')
    setForm({
      vendor: offer.vendor || 'Tahir',
      company: offer.company || '',
      model: offer.model || '',
      processor: offer.processor || '',
      screen_size: offer.screen_size || '',
      ram: offer.ram || '',
      storage: offer.storage || '',
      graphics_card: offer.graphics_card || '',
      condition: offer.condition || '',
      cost_price: offer.cost_price || '',
      comment: offer.comment || '',
      images: normalizeImages(offer.images),
    })
  }

  async function handleSave() {
    if (!form.vendor.trim()) { setFormError('Vendor required'); return }
    if (!form.company.trim()) { setFormError('Company required'); return }
    if (!form.model.trim()) { setFormError('Model required'); return }
    const err = await onSave(offer.id, form)
    if (err) { setFormError(err); return }
    setEditing(false)
  }

  const compact = compactStorage(offer.storage)
  const isSavingThis = savingId === offer.id
  const isDeletingThis = deletingId === offer.id
  const hasExtras = offer.screen_size || offer.graphics_card || offer.comment

  /* ── Edit form ── */
  if (editing) {
    return (
      <div className="laptop-card" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
        {formError && <div className="alert-error mb-2.5 text-[12px] py-2 px-3">{formError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <FormField label="Vendor *"><input name="vendor" value={form.vendor} onChange={handleChange} className="form-input" style={IS} placeholder="e.g. Tahir" /></FormField>
          <FormField label="Company *"><input name="company" value={form.company} onChange={handleChange} className="form-input" style={IS} placeholder="e.g. Dell" list="oc-company-list" /></FormField>
          <SmartInput
            value={form.model}
            onChange={v => { setForm(f => ({ ...f, model: v })); setFormError('') }}
            onSelect={v => setForm(f => ({ ...f, model: v }))}
            suggestions={modelSuggestions}
            placeholder="e.g. Latitude 7420"
            label="Model *"
            style={IS}
          />
        </div>
        <div className="mb-2">
          <SmartInput
            value={form.processor}
            onChange={v => { setForm(f => ({ ...f, processor: v })); setFormError('') }}
            onSelect={handleProcessorSelect}
            suggestions={processorSuggestions}
            placeholder="e.g. i7-1185G7"
            label="Processor"
            style={IS}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          <FormField label="RAM"><select name="ram" value={form.ram} onChange={handleChange} className="form-input" style={SS}><option value="">—</option>{RAM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></FormField>
          <FormField label="Storage"><select name="storage" value={form.storage} onChange={handleChange} className="form-input" style={SS}><option value="">—</option>{STORAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
          <FormField label="Screen"><select name="screen_size" value={form.screen_size} onChange={handleChange} className="form-input" style={SS}><option value="">—</option>{SCREEN_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          <FormField label="Condition"><select name="condition" value={form.condition} onChange={handleChange} className="form-input" style={SS}><option value="">—</option>{CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></FormField>
          <FormField label="Price (PKR)"><input name="cost_price" type="number" value={form.cost_price} onChange={handleChange} className="form-input" style={IS} placeholder="e.g. 55000" min="0" step="500" /></FormField>
          <FormField label="GPU"><input name="graphics_card" value={form.graphics_card} onChange={handleChange} className="form-input" style={IS} placeholder="e.g. Intel Iris Xe" /></FormField>
        </div>
        <div className="mb-2">
          <FormField label="Comment"><input name="comment" value={form.comment} onChange={handleChange} className="form-input" style={IS} placeholder="Optional notes" /></FormField>
        </div>
        <CatalogImagesInput
          supabase={supabase}
          brand={form.company}
          model={form.model}
          images={form.images}
          onChange={(images) => setForm(f => ({ ...f, images }))}
          label="Catalog Images"
          hint="Stored on offer and reused when publishing to catalog."
        />
        <div className="flex gap-1.5">
          <button onClick={handleSave} disabled={isSavingThis}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-white text-[12px] font-medium cursor-pointer"
            style={{ background: 'var(--accent-blue)', border: 'none' }}>
            {isSavingThis ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Save</>}
          </button>
          <button onClick={handleCancel}
            className="px-3 py-1.5 rounded-lg text-[12px] cursor-pointer"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  /* ── Display row ── */
  return (
    <div>
      <div className="item-row">

        {/* Col 1: Vendor + Model + Processor */}
        <div className="flex-1 min-w-0">
          {/* Mobile: vendor + condition badges top */}
          <div className="flex items-center gap-2 mb-1 md:hidden">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
              {offer.vendor}
            </span>
            {offer.condition && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: CONDITION_COLORS[offer.condition] || 'var(--text-secondary)', background: `${CONDITION_COLORS[offer.condition] || '#888'}15`, border: `1px solid ${CONDITION_COLORS[offer.condition] || '#888'}30` }}>
                {offer.condition}
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-[14px] text-[var(--text-primary)] leading-snug">{offer.model}</div>
              {offer.processor && <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{offer.processor}</div>}
            </div>
          </div>
        </div>

        {/* Col 2: Vendor badge (desktop) */}
        <div className="hidden md:flex items-center shrink-0 w-24">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
            {offer.vendor}
          </span>
        </div>

        {/* Col 3: RAM + Storage + Screen badges */}
        <div className="flex flex-wrap gap-1.5 shrink-0 md:w-44">
          {offer.ram && <span className="badge badge-blue  text-[11px]">{offer.ram}</span>}
          {compact && <span className="badge badge-green text-[11px]">{compact}</span>}
          {offer.screen_size && <span className="badge text-[11px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{offer.screen_size}</span>}
        </div>

        {/* Col 4: Condition badge (desktop) */}
        <div className="hidden md:flex items-center shrink-0 w-20">
          {offer.condition && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ color: CONDITION_COLORS[offer.condition] || 'var(--text-secondary)', background: `${CONDITION_COLORS[offer.condition] || '#888'}15`, border: `1px solid ${CONDITION_COLORS[offer.condition] || '#888'}30` }}>
              {offer.condition}
            </span>
          )}
        </div>

        {/* Col 5: Price */}
        <div className="shrink-0 md:w-28 md:text-right">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide hidden md:block">Price</div>
          <div className="text-[13px] font-bold text-[var(--text-primary)]">{formatPKR(offer.cost_price)}</div>
        </div>

        {/* Col 6: Actions */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <button className="btn-xs" onClick={() => setEditing(true)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button className="btn-xs btn-xs-green" onClick={() => onPublish(offer)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12l7-7 7 7" />
            </svg>
            Publish
          </button>
          <button className="btn-xs btn-xs-red" onClick={() => onDelete(offer.id)} disabled={isDeletingThis}>
            {isDeletingThis ? (
              <div className="spinner" style={{ width: '10px', height: '10px' }} />
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            )}
            Del
          </button>
          {hasExtras && (
            <button className="btn-details" onClick={() => setOpen(o => !o)}>
              {open ? '▲' : '▼'} {open ? 'Less' : 'More'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="mt-1 mb-1 px-4 py-3 rounded-lg text-[12px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mb-2">
            {offer.screen_size && <div><span className="text-[var(--text-muted)]">Screen: </span><span className="text-[var(--text-secondary)]">{offer.screen_size}</span></div>}
            {offer.graphics_card && <div><span className="text-[var(--text-muted)]">GPU: </span><span className="text-[var(--text-secondary)]">{offer.graphics_card}</span></div>}
          </div>
          {offer.comment && (
            <div className="px-3 py-2 rounded-md text-[11px] text-[var(--text-muted)]" style={{ background: 'var(--bg-card)' }}>
              {offer.comment}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── AddOfferForm ─────────────────────────────────────────── */
function AddOfferForm({ onAdd, onCancel, laptopModels, processors, supabase }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Knowledge base suggestions
  const modelSuggestions = useMemo(() => {
    if (!form.company) return []
    return getModelSuggestionsFromDB(form.company, form.model, laptopModels)
  }, [form.company, form.model, laptopModels])

  const processorSuggestions = useMemo(() => {
    if (!form.company || !form.model) return []
    return getProcessorSuggestionsFromDB(form.company, form.model, laptopModels)
  }, [form.company, form.model, laptopModels])

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError('') }

  // Auto-fill GPU when processor is selected
  function handleProcessorSelect(cpu) {
    const specs = getProcessorSpecsFromDB(cpu, processors)
    setForm(f => ({
      ...f,
      processor: cpu,
      graphics_card: specs?.gpu || f.graphics_card,
    }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.vendor.trim()) { setError('Vendor required'); return }
    if (!form.company.trim()) { setError('Company required'); return }
    if (!form.model.trim()) { setError('Model required'); return }
    setSaving(true)
    const err = await onAdd(form)
    setSaving(false)
    if (err) { setError(err); return }
    setForm(EMPTY_FORM)
    onCancel()
  }

  const inputStyle = { fontSize: '13px', padding: '8px 10px' }

  return (
    <div className="card p-5 mb-6 animate-fade-in" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] m-0">Add Vendor Offer</h3>
        <button onClick={onCancel} className="text-[16px] cursor-pointer" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>✕</button>
      </div>
      {error && <div className="alert-error mb-3 text-[12px] py-2 px-3">{error}</div>}
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="form-label">Vendor *</label>
            <input className="form-input" name="vendor" value={form.vendor} onChange={handleChange} placeholder="e.g. Tahir" style={inputStyle} />
          </div>
          <div>
            <label className="form-label">Company *</label>
            <input className="form-input" name="company" value={form.company} onChange={handleChange} placeholder="e.g. Dell" list="oc-company-list" style={inputStyle} />
          </div>
          <SmartInput
            value={form.model}
            onChange={v => { setForm(f => ({ ...f, model: v })); setError('') }}
            onSelect={v => setForm(f => ({ ...f, model: v }))}
            suggestions={modelSuggestions}
            placeholder="e.g. Latitude 7420"
            label="Model *"
            style={inputStyle}
          />
        </div>
        <div className="mb-3">
          <SmartInput
            value={form.processor}
            onChange={v => { setForm(f => ({ ...f, processor: v })); setError('') }}
            onSelect={handleProcessorSelect}
            suggestions={processorSuggestions}
            placeholder="e.g. i7-1185G7 (auto-fills GPU)"
            label="Processor"
            style={inputStyle}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="form-label">RAM</label>
            <select className="form-input" name="ram" value={form.ram} onChange={handleChange} style={inputStyle}>
              <option value="">—</option>{RAM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Storage</label>
            <select className="form-input" name="storage" value={form.storage} onChange={handleChange} style={inputStyle}>
              <option value="">—</option>{STORAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Screen</label>
            <select className="form-input" name="screen_size" value={form.screen_size} onChange={handleChange} style={inputStyle}>
              <option value="">—</option>{SCREEN_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="form-label">Condition</label>
            <select className="form-input" name="condition" value={form.condition} onChange={handleChange} style={inputStyle}>
              <option value="">—</option>{CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Price (PKR)</label>
            <input className="form-input" name="cost_price" type="number" value={form.cost_price} onChange={handleChange} placeholder="e.g. 55000" min="0" step="500" style={inputStyle} />
          </div>
          <div>
            <label className="form-label">GPU</label>
            <input className="form-input" name="graphics_card" value={form.graphics_card} onChange={handleChange} placeholder="e.g. Intel Iris Xe" style={inputStyle} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Comment</label>
          <input className="form-input" name="comment" value={form.comment} onChange={handleChange} placeholder="Optional notes" style={inputStyle} />
        </div>
        <CatalogImagesInput
          supabase={supabase}
          brand={form.company}
          model={form.model}
          images={form.images}
          onChange={(images) => setForm(f => ({ ...f, images }))}
          label="Catalog Images"
          hint="Stored on offer and reused when publishing to catalog."
        />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: '120px', justifyContent: 'center' }}>
            {saving ? <div className="spinner" /> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Add Offer</>}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

/* ─── Main OffersClient component ──────────────────────────── */
export default function OffersClient({ user, initialOffers }) {
  const [offers, setOffers] = useState(initialOffers || [])
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [publishTarget, setPublishTarget] = useState(null)
  const [publishPrice, setPublishPrice] = useState('')
  const [publishQty, setPublishQty] = useState('1')
  const [publishCondition, setPublishCondition] = useState('')
  const [publishImages, setPublishImages] = useState([])
  const [publishError, setPublishError] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)

  const supabase = createClient()
  const { laptopModels, processors } = useApp()

  useEffect(() => {
    const channel = supabase
      .channel('offers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_offers' }, fetchOffers)
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchOffers() {
    const { data } = await supabase.from('vendor_offers').select('*').order('created_at', { ascending: false })
    if (data) setOffers(data)
  }

  function openPublish(offer) {
    setPublishTarget(offer)
    setPublishPrice(String(offer.cost_price || ''))
    setPublishQty('1')
    setPublishCondition(offer.condition || 'New')
    setPublishImages(normalizeImages(offer.images))
    setPublishError('')
  }

  function closePublish() {
    setPublishTarget(null)
    setPublishError('')
  }

  async function handleAdd(form) {
    const payload = buildPayload(form)
    const { data: inserted, error } = await supabase
      .from('vendor_offers')
      .insert([{ ...payload, created_at: new Date().toISOString() }])
      .select().single()
    if (error) return error.message

    setOffers(prev => [inserted, ...prev])
    return null
  }

  async function handleSave(id, form) {
    setSavingId(id)
    const payload = buildPayload(form)
    const { error } = await supabase.from('vendor_offers').update(payload).eq('id', id)
    setSavingId(null)
    if (error) return error.message

    setOffers(prev => prev.map(o => o.id === id ? { ...o, ...payload } : o))
    return null
  }

  async function handleDelete(id) {
    if (!confirm('Delete this offer?')) return
    const offer = offers.find(o => o.id === id)
    setDeletingId(id)

    const error = await deleteWithLog(supabase, {
      table: 'vendor_offers',
      id,
      entityType: 'offer',
      modelName: offer ? `${offer.vendor} — ${offer.company} ${offer.model}` : id,
      price: offer?.cost_price,
      deletedBy: user?.email || 'unknown',
      entityData: offer,
    })
    setDeletingId(null)
    if (!error) setOffers(prev => prev.filter(o => o.id !== id))
  }

  function buildLaptopPayloadFromOffer(offer, { images, price, qty, condition }) {
    const cpuKey = extractCPUKey(offer.processor)
    const cpuSpecs = cpuKey ? getProcessorSpecsFromDB(cpuKey, processors) : null

    const specs = cpuSpecs ? {
      cpu_gen: cpuSpecs.gen,
      cpu_arch: cpuSpecs.arch,
      cpu_cores: cpuSpecs.cores,
      cpu_threads: cpuSpecs.threads,
      cpu_base_ghz: cpuSpecs.baseGHz,
      cpu_boost_ghz: cpuSpecs.boostGHz,
      cpu_cache_mb: cpuSpecs.cacheMB,
      cpu_tdp_w: cpuSpecs.tdpW,
    } : {}

    const highlights = []
    if (offer.processor) highlights.push(offer.processor)
    if (offer.ram) highlights.push(`${offer.ram} RAM`)
    if (offer.storage) highlights.push(offer.storage)
    if (condition) highlights.push(condition)
    if (offer.screen_size) highlights.push(`${offer.screen_size} Display`)

    return {
      offer_id: offer.id,
      brand: offer.company?.trim() || 'N/A',
      model: offer.model?.trim() || 'N/A',
      cpu: offer.processor?.trim() || 'N/A',
      ram: offer.ram || 'N/A',
      storage: offer.storage || 'N/A',
      gpu: offer.graphics_card?.trim() || cpuSpecs?.gpu || 'Integrated',
      screen: offer.screen_size || 'N/A',
      condition: condition || 'New',
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
    const images = normalizeImages(publishImages)
    if (!publishTarget.company || !publishTarget.model) {
      setPublishError('Company and model are required before publishing.')
      return
    }
    if (!images.length) {
      setPublishError('Add at least one image before publishing.')
      return
    }
    const price = Number(publishPrice)
    if (!Number.isFinite(price) || price <= 0) {
      setPublishError('Enter a valid price.')
      return
    }
    const qty = Math.max(0, Number(publishQty) || 0)

    setPublishLoading(true)
    setPublishError('')

    const { error: offerUpdateErr } = await supabase
      .from('vendor_offers')
      .update({ images, updated_at: new Date().toISOString() })
      .eq('id', publishTarget.id)

    if (offerUpdateErr) {
      setPublishError(offerUpdateErr.message)
      setPublishLoading(false)
      return
    }

    const payload = buildLaptopPayloadFromOffer(publishTarget, {
      images,
      price,
      qty,
      condition: publishCondition,
    })

    const { data: existing, error: lookupError } = await supabase
      .from('laptops')
      .select('id')
      .eq('offer_id', publishTarget.id)
      .maybeSingle()

    if (lookupError) {
      setPublishError(lookupError.message)
      setPublishLoading(false)
      return
    }

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

    setOffers(prev => prev.map(o => o.id === publishTarget.id ? { ...o, images } : o))
    setPublishLoading(false)
    closePublish()
  }

  function buildPayload(form) {
    return {
      vendor: form.vendor.trim(),
      company: form.company.trim(),
      model: form.model.trim(),
      processor: form.processor.trim() || null,
      screen_size: form.screen_size || null,
      ram: form.ram || null,
      storage: form.storage || null,
      graphics_card: form.graphics_card.trim() || null,
      condition: form.condition || null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      comment: form.comment.trim() || null,
      images: normalizeImages(form.images),
      updated_at: new Date().toISOString(),
    }
  }

  // Unique vendors + companies for filters
  const vendors = useMemo(() => Array.from(new Set(offers.map(o => o.vendor).filter(Boolean))).sort(), [offers])
  const companies = useMemo(() => Array.from(new Set(offers.map(o => o.company).filter(Boolean))).sort(), [offers])

  // Filtered
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return offers.filter(o => {
      if (vendorFilter && o.vendor !== vendorFilter) return false
      if (companyFilter && o.company !== companyFilter) return false
      if (!q) return true
      return (
        (o.company || '').toLowerCase().includes(q) ||
        (o.model || '').toLowerCase().includes(q) ||
        (o.processor || '').toLowerCase().includes(q) ||
        (o.ram || '').toLowerCase().includes(q) ||
        (o.storage || '').toLowerCase().includes(q) ||
        (o.graphics_card || '').toLowerCase().includes(q) ||
        (o.condition || '').toLowerCase().includes(q) ||
        (o.comment || '').toLowerCase().includes(q) ||
        (o.vendor || '').toLowerCase().includes(q)
      )
    })
  }, [offers, search, vendorFilter, companyFilter])

  // Group by company
  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach(o => {
      const co = o.company || 'Other'
      if (!map.has(co)) map.set(co, [])
      map.get(co).push(o)
    })
    return map
  }, [filtered])

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto">

      <datalist id="oc-company-list">
        {COMPANY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
      </datalist>

      {showAddForm && (
        <AddOfferForm
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
          laptopModels={laptopModels}
          processors={processors}
          supabase={supabase}
        />
      )}

      {/* ── Header + Filters ──────────────────────────────── */}
      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">Vendor Offers</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 m-0">{filtered.length} of {offers.length} offers</p>
        </div>

        {/* Vendor filter */}
        <select className="form-input" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '120px', fontSize: '13px', padding: '7px 10px' }}>
          <option value="">All vendors</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        {/* Company filter */}
        <select className="form-input" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '120px', fontSize: '13px', padding: '7px 10px' }}>
          <option value="">All brands</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[180px] max-w-[320px] relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" className="form-input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search model, spec…"
            style={{ paddingLeft: '32px', fontSize: '13px', padding: '8px 12px 8px 32px' }} />
        </div>

        <button onClick={() => setShowAddForm(s => !s)} className="btn-primary whitespace-nowrap ml-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Offer
        </button>
      </div>

      {/* ── Grouped rows ──────────────────────────────────── */}
      {grouped.size === 0 ? (
        <div className="text-center py-16">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <p className="text-[var(--text-muted)] text-[14px] m-0">
            {search || vendorFilter || companyFilter ? 'No offers match your filters.' : 'No vendor offers yet.'}
          </p>
          {!search && !vendorFilter && !companyFilter && (
            <button onClick={() => setShowAddForm(true)} className="text-[var(--accent-blue)] text-[14px] mt-2 cursor-pointer"
              style={{ background: 'transparent', border: 'none' }}>
              Add first offer →
            </button>
          )}
        </div>
      ) : (
        Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([company, items]) => (
          <div key={company} className="company-section">
            <div className="company-header">
              <span className="text-[var(--text-secondary)]">{company}</span>
              <span className="font-normal text-[var(--text-muted)]">— {items.length} {items.length === 1 ? 'offer' : 'offers'}</span>
            </div>
            <div className="item-list">
              {items.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onPublish={openPublish}
                  savingId={savingId}
                  deletingId={deletingId}
                  laptopModels={laptopModels}
                  processors={processors}
                  supabase={supabase}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {publishTarget && (
        <div className="modal-overlay" onClick={closePublish}>
          <div onClick={(e) => e.stopPropagation()} className="modal-card animate-fade-in">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)] m-0 mb-1">Publish to Catalog</h3>
                <p className="text-[13px] text-[var(--text-muted)] m-0">
                  {publishTarget.company} {publishTarget.model}
                </p>
              </div>
              <button onClick={closePublish} className="text-[18px] leading-none cursor-pointer"
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
                {CONDITION_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <CatalogImagesInput
              supabase={supabase}
              brand={publishTarget.company}
              model={publishTarget.model}
              images={publishImages}
              onChange={setPublishImages}
              label="Catalog Images"
              hint="These images will be stored in vendor offers and published to the catalog."
            />

            <div className="flex gap-2.5">
              <button className="btn-primary flex-1 justify-center" onClick={handlePublish} disabled={publishLoading}>
                {publishLoading ? 'Publishing...' : 'Publish'}
              </button>
              <button className="btn-secondary min-w-[90px]" onClick={closePublish}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
