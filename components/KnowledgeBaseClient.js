'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Charger connector display labels ──────────────────────────────────────────
const CHARGER_LABELS = {
  barrel_74mm:        '7.4mm Barrel (Blue Pin)',
  barrel_45mm:        '4.5mm Barrel',
  usb_c:              'USB-C / Thunderbolt',
  usb_c_and_barrel:   'USB-C + Barrel',
  slim_tip:           'Slim Tip (Lenovo)',
  slim_tip_and_usbc:  'Slim Tip + USB-C',
  magsafe:            'MagSafe',
}

const CHARGER_OPTIONS = Object.entries(CHARGER_LABELS)

const BRAND_OPTIONS     = ['Intel', 'AMD', 'Apple', 'Qualcomm']
const COMPANY_OPTIONS   = ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba', 'MSI', 'Samsung', 'Microsoft', 'LG', 'Huawei', 'Fujitsu']

// ── Shared input styles ───────────────────────────────────────────────────────
const IS = { fontSize: '12px', width: '100%', padding: '5px 8px' }
const SS = { ...IS, appearance: 'none' }

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  )
}

// ── Empty form states ─────────────────────────────────────────────────────────
const EMPTY_PROC = {
  model: '', brand: 'Intel', generation: '', architecture: '',
  process_node: '', process_node_nm: '', release_year: '',
  cores: '', threads: '', base_clock_ghz: '', boost_clock_ghz: '',
  cache_mb: '', tdp_w: '', integrated_gpu: '', ram_types: '',
  ram_speed_min_mhz: '', ram_speed_max_mhz: '',
}

const EMPTY_MODEL = {
  company: 'Dell', model_name: '', release_year: '',
  charger_connector: '', charger_wattage_w: '', charger_notes: '',
  battery_wh: '', notes: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// ProcessorRow
// ─────────────────────────────────────────────────────────────────────────────
function ProcessorRow({ proc, onSave, onDelete, savingId, deletingId }) {
  const [editing,   setEditing]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    model:             proc.model             || '',
    brand:             proc.brand             || 'Intel',
    generation:        proc.generation        || '',
    architecture:      proc.architecture      || '',
    process_node:      proc.process_node      || '',
    process_node_nm:   proc.process_node_nm   != null ? String(proc.process_node_nm) : '',
    release_year:      proc.release_year      != null ? String(proc.release_year)   : '',
    cores:             proc.cores             != null ? String(proc.cores)           : '',
    threads:           proc.threads           != null ? String(proc.threads)         : '',
    base_clock_ghz:    proc.base_clock_ghz    != null ? String(proc.base_clock_ghz)  : '',
    boost_clock_ghz:   proc.boost_clock_ghz   != null ? String(proc.boost_clock_ghz) : '',
    cache_mb:          proc.cache_mb          != null ? String(proc.cache_mb)        : '',
    tdp_w:             proc.tdp_w             != null ? String(proc.tdp_w)           : '',
    integrated_gpu:    proc.integrated_gpu    || '',
    ram_types:         Array.isArray(proc.ram_types) ? proc.ram_types.join(', ') : (proc.ram_types || ''),
    ram_speed_min_mhz: proc.ram_speed_min_mhz != null ? String(proc.ram_speed_min_mhz) : '',
    ram_speed_max_mhz: proc.ram_speed_max_mhz != null ? String(proc.ram_speed_max_mhz) : '',
  })

  const isSaving   = savingId   === proc.id
  const isDeleting = deletingId === proc.id

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setFormError('') }

  function handleCancel() {
    setEditing(false); setFormError('')
    setForm({
      model: proc.model || '', brand: proc.brand || 'Intel',
      generation: proc.generation || '', architecture: proc.architecture || '',
      process_node: proc.process_node || '',
      process_node_nm: proc.process_node_nm != null ? String(proc.process_node_nm) : '',
      release_year: proc.release_year != null ? String(proc.release_year) : '',
      cores: proc.cores != null ? String(proc.cores) : '',
      threads: proc.threads != null ? String(proc.threads) : '',
      base_clock_ghz: proc.base_clock_ghz != null ? String(proc.base_clock_ghz) : '',
      boost_clock_ghz: proc.boost_clock_ghz != null ? String(proc.boost_clock_ghz) : '',
      cache_mb: proc.cache_mb != null ? String(proc.cache_mb) : '',
      tdp_w: proc.tdp_w != null ? String(proc.tdp_w) : '',
      integrated_gpu: proc.integrated_gpu || '',
      ram_types: Array.isArray(proc.ram_types) ? proc.ram_types.join(', ') : (proc.ram_types || ''),
      ram_speed_min_mhz: proc.ram_speed_min_mhz != null ? String(proc.ram_speed_min_mhz) : '',
      ram_speed_max_mhz: proc.ram_speed_max_mhz != null ? String(proc.ram_speed_max_mhz) : '',
    })
  }

  async function handleSave() {
    if (!form.model.trim()) { setFormError('Model is required'); return }
    if (!form.brand.trim()) { setFormError('Brand is required'); return }
    const err = await onSave(proc.id, form)
    if (err) { setFormError(err); return }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="laptop-card" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
        {formError && <div className="alert-error mb-2.5 text-[12px] py-2 px-3">{formError}</div>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <FormField label="Model *"><input name="model" value={form.model} onChange={handleChange} className="form-input" style={IS}placeholder="e.g. i7-1185G7" /></FormField>
          <FormField label="Brand *">
            <select name="brand" value={form.brand} onChange={handleChange} className="form-input" style={SS}>
              {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </FormField>
          <FormField label="Generation"><input name="generation" value={form.generation} onChange={handleChange} className="form-input" style={IS}placeholder="e.g. 11th Gen" /></FormField>
          <FormField label="Architecture"><input name="architecture" value={form.architecture} onChange={handleChange} className="form-input" style={IS}placeholder="e.g. Tiger Lake" /></FormField>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <FormField label="Process Node"><input name="process_node" value={form.process_node} onChange={handleChange} className="form-input" style={IS}placeholder="e.g. 10nm SuperFin" /></FormField>
          <FormField label="Node (nm)"><input name="process_node_nm" type="number" value={form.process_node_nm} onChange={handleChange} className="form-input" style={IS}placeholder="10" /></FormField>
          <FormField label="Year"><input name="release_year" type="number" value={form.release_year} onChange={handleChange} className="form-input" style={IS}placeholder="2021" /></FormField>
          <FormField label="TDP (W)"><input name="tdp_w" type="number" value={form.tdp_w} onChange={handleChange} className="form-input" style={IS}placeholder="15" /></FormField>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
          <FormField label="Cores"><input name="cores" type="number" value={form.cores} onChange={handleChange} className="form-input" style={IS}placeholder="4" /></FormField>
          <FormField label="Threads"><input name="threads" type="number" value={form.threads} onChange={handleChange} className="form-input" style={IS}placeholder="8" /></FormField>
          <FormField label="Base GHz"><input name="base_clock_ghz" type="number" step="0.1" value={form.base_clock_ghz} onChange={handleChange} className="form-input" style={IS}placeholder="2.8" /></FormField>
          <FormField label="Boost GHz"><input name="boost_clock_ghz" type="number" step="0.1" value={form.boost_clock_ghz} onChange={handleChange} className="form-input" style={IS}placeholder="4.7" /></FormField>
          <FormField label="Cache MB"><input name="cache_mb" type="number" value={form.cache_mb} onChange={handleChange} className="form-input" style={IS}placeholder="12" /></FormField>
          <FormField label="RAM Min MHz"><input name="ram_speed_min_mhz" type="number" value={form.ram_speed_min_mhz} onChange={handleChange} className="form-input" style={IS}placeholder="3200" /></FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <FormField label="RAM Max MHz"><input name="ram_speed_max_mhz" type="number" value={form.ram_speed_max_mhz} onChange={handleChange} className="form-input" style={IS}placeholder="4267" /></FormField>
          <FormField label="Integrated GPU"><input name="integrated_gpu" value={form.integrated_gpu} onChange={handleChange} className="form-input" style={IS}placeholder="Intel Iris Xe" /></FormField>
          <FormField label="RAM Types (comma-separated)"><input name="ram_types" value={form.ram_types} onChange={handleChange} className="form-input" style={IS}placeholder="DDR4-3200, LPDDR4x-4267" /></FormField>
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-white text-[12px] font-medium cursor-pointer"
            style={{ background: 'var(--accent-blue)', border: 'none' }}>
            {isSaving ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> :
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save</>}
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

  const ramRange = (proc.ram_speed_min_mhz && proc.ram_speed_max_mhz)
    ? `${proc.ram_speed_min_mhz}–${proc.ram_speed_max_mhz} MHz`
    : proc.ram_speed_max_mhz ? `up to ${proc.ram_speed_max_mhz} MHz` : null

  const ghzStr = proc.base_clock_ghz
    ? `${proc.base_clock_ghz}${proc.boost_clock_ghz ? `–${proc.boost_clock_ghz}` : ''} GHz`
    : null

  return (
    <div>
      <div className="item-row">

        {/* Col 1: Model + Architecture */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] text-[var(--text-primary)] leading-snug">{proc.model}</div>
          {proc.architecture && (
            <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{proc.architecture}</div>
          )}
          {/* Mobile extras */}
          <div className="md:hidden text-[11px] text-[var(--text-muted)] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {proc.process_node && <span>{proc.process_node}</span>}
            {proc.release_year && <span>{proc.release_year}</span>}
            {proc.cores && proc.threads && <span>{proc.cores}c / {proc.threads}t</span>}
          </div>
        </div>

        {/* Col 2: Process Node badge (desktop) */}
        <div className="hidden md:flex items-center shrink-0 w-36">
          {proc.process_node && (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(59,130,246,0.2)' }}>
              {proc.process_node}
            </span>
          )}
        </div>

        {/* Col 3: Year (desktop) */}
        <div className="hidden md:block shrink-0 w-14 text-center">
          {proc.release_year && <span className="text-[12px] text-[var(--text-muted)]">{proc.release_year}</span>}
        </div>

        {/* Col 4: Cores / Threads (desktop) */}
        <div className="hidden md:block shrink-0 w-20 text-center">
          {proc.cores && proc.threads && (
            <span className="text-[12px] text-[var(--text-secondary)]">{proc.cores}c / {proc.threads}t</span>
          )}
        </div>

        {/* Col 5: GHz */}
        <div className="hidden md:block shrink-0 w-28 text-right">
          {ghzStr && <span className="text-[12px] text-[var(--text-secondary)]">{ghzStr}</span>}
        </div>

        {/* Col 6: TDP */}
        <div className="hidden lg:block shrink-0 w-16 text-right">
          {proc.tdp_w && (
            <span className="text-[12px] text-[var(--text-muted)]">{proc.tdp_w}W</span>
          )}
        </div>

        {/* Mobile: GHz + TDP + RAM range */}
        <div className="md:hidden flex gap-4 flex-wrap">
          {ghzStr && (
            <div><div className="text-[10px] text-[var(--text-muted)] uppercase">GHz</div>
              <div className="text-[12px] font-semibold text-[var(--text-secondary)]">{ghzStr}</div>
            </div>
          )}
          {ramRange && (
            <div><div className="text-[10px] text-[var(--text-muted)] uppercase">RAM</div>
              <div className="text-[12px] font-semibold text-[var(--accent-blue)]">{ramRange}</div>
            </div>
          )}
        </div>

        {/* Col 7: RAM range (desktop) */}
        <div className="hidden lg:block shrink-0 w-36 text-right">
          {ramRange && <span className="text-[12px] text-[var(--accent-blue)] font-medium">{ramRange}</span>}
        </div>

        {/* Col 8: Actions */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <button className="btn-xs" onClick={() => setEditing(true)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button className="btn-xs btn-xs-red" onClick={() => onDelete(proc.id)} disabled={isDeleting}>
            {isDeleting ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            )}
            Del
          </button>
          {(proc.integrated_gpu || Array.isArray(proc.ram_types) && proc.ram_types.length > 0) && (
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
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {proc.integrated_gpu && (
              <div><span className="text-[var(--text-muted)]">iGPU: </span>
                <span className="text-[var(--text-secondary)]">{proc.integrated_gpu}</span>
              </div>
            )}
            {proc.cache_mb && (
              <div><span className="text-[var(--text-muted)]">Cache: </span>
                <span className="text-[var(--text-secondary)]">{proc.cache_mb}MB</span>
              </div>
            )}
            {Array.isArray(proc.ram_types) && proc.ram_types.length > 0 && (
              <div className="w-full">
                <span className="text-[var(--text-muted)]">RAM types: </span>
                <span className="text-[var(--text-secondary)]">{proc.ram_types.join(' · ')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LaptopModelRow
// ─────────────────────────────────────────────────────────────────────────────
function LaptopModelRow({ lm, onSave, onDelete, savingId, deletingId }) {
  const [editing,   setEditing]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    company:           lm.company           || '',
    model_name:        lm.model_name        || '',
    release_year:      lm.release_year      != null ? String(lm.release_year) : '',
    charger_connector: lm.charger_connector || '',
    charger_wattage_w: lm.charger_wattage_w != null ? String(lm.charger_wattage_w) : '',
    charger_notes:     lm.charger_notes     || '',
    battery_wh:        lm.battery_wh        != null ? String(lm.battery_wh) : '',
    notes:             lm.notes             || '',
  })

  const isSaving   = savingId   === lm.id
  const isDeleting = deletingId === lm.id

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setFormError('') }

  function handleCancel() {
    setEditing(false); setFormError('')
    setForm({
      company: lm.company || '', model_name: lm.model_name || '',
      release_year: lm.release_year != null ? String(lm.release_year) : '',
      charger_connector: lm.charger_connector || '',
      charger_wattage_w: lm.charger_wattage_w != null ? String(lm.charger_wattage_w) : '',
      charger_notes: lm.charger_notes || '', battery_wh: lm.battery_wh != null ? String(lm.battery_wh) : '',
      notes: lm.notes || '',
    })
  }

  async function handleSave() {
    if (!form.company.trim())    { setFormError('Company required'); return }
    if (!form.model_name.trim()) { setFormError('Model name required'); return }
    const err = await onSave(lm.id, form)
    if (err) { setFormError(err); return }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="laptop-card" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
        {formError && <div className="alert-error mb-2.5 text-[12px] py-2 px-3">{formError}</div>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          <FormField label="Company *">
            <select name="company" value={form.company} onChange={handleChange} className="form-input" style={SS}>
              <option value="">Select</option>
              {COMPANY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Model Name *"><input name="model_name" value={form.model_name} onChange={handleChange} className="form-input" style={IS}placeholder="e.g. Latitude 7420" /></FormField>
          <FormField label="Year"><input name="release_year" type="number" value={form.release_year} onChange={handleChange} className="form-input" style={IS}placeholder="2021" /></FormField>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          <FormField label="Charger Connector">
            <select name="charger_connector" value={form.charger_connector} onChange={handleChange} className="form-input" style={SS}>
              <option value="">—</option>
              {CHARGER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Wattage (W)"><input name="charger_wattage_w" type="number" value={form.charger_wattage_w} onChange={handleChange} className="form-input" style={IS}placeholder="65" /></FormField>
          <FormField label="Battery (Wh)"><input name="battery_wh" type="number" step="0.1" value={form.battery_wh} onChange={handleChange} className="form-input" style={IS}placeholder="68.0" /></FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <FormField label="Charger Notes"><input name="charger_notes" value={form.charger_notes} onChange={handleChange} className="form-input" style={IS}placeholder="e.g. USB-C preferred" /></FormField>
          <FormField label="Notes"><input name="notes" value={form.notes} onChange={handleChange} className="form-input" style={IS}placeholder="Optional notes" /></FormField>
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleSave} disabled={isSaving}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-white text-[12px] font-medium cursor-pointer"
            style={{ background: 'var(--accent-blue)', border: 'none' }}>
            {isSaving ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> :
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save</>}
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

  const chargerLabel  = lm.charger_connector ? (CHARGER_LABELS[lm.charger_connector] || lm.charger_connector) : null
  const hasExtras     = lm.charger_notes || lm.notes

  return (
    <div>
      <div className="item-row">

        {/* Col 1: Model name */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] text-[var(--text-primary)] leading-snug">{lm.model_name}</div>
          {/* Mobile extras inline */}
          <div className="md:hidden text-[11px] text-[var(--text-muted)] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {lm.release_year && <span>{lm.release_year}</span>}
            {chargerLabel    && <span>{chargerLabel}</span>}
          </div>
        </div>

        {/* Year (desktop) */}
        <div className="hidden md:block shrink-0 w-14 text-center">
          {lm.release_year && <span className="text-[12px] text-[var(--text-muted)]">{lm.release_year}</span>}
        </div>

        {/* Charger connector (desktop) */}
        <div className="hidden md:block shrink-0 w-44">
          {chargerLabel && (
            <span className="text-[12px] text-[var(--text-secondary)]">{chargerLabel}</span>
          )}
        </div>

        {/* Mobile: charger + battery row */}
        <div className="md:hidden flex gap-4 flex-wrap">
          {lm.charger_wattage_w && (
            <div><div className="text-[10px] text-[var(--text-muted)] uppercase">Charger</div>
              <div className="text-[12px] font-semibold text-[var(--text-secondary)]">{lm.charger_wattage_w}W</div>
            </div>
          )}
          {lm.battery_wh && (
            <div><div className="text-[10px] text-[var(--text-muted)] uppercase">Battery</div>
              <div className="text-[12px] font-semibold text-[var(--accent-green)]">{lm.battery_wh} Wh</div>
            </div>
          )}
        </div>

        {/* Wattage (desktop) */}
        <div className="hidden md:block shrink-0 w-20 text-center">
          {lm.charger_wattage_w && (
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{lm.charger_wattage_w}W</span>
          )}
        </div>

        {/* Battery Wh (desktop) */}
        <div className="hidden md:block shrink-0 w-24 text-right">
          {lm.battery_wh && (
            <span className="text-[12px] font-semibold" style={{ color: 'var(--accent-green)' }}>{lm.battery_wh} Wh</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <button className="btn-xs" onClick={() => setEditing(true)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button className="btn-xs btn-xs-red" onClick={() => onDelete(lm.id)} disabled={isDeleting}>
            {isDeleting ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
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

      {/* Expandable */}
      {open && (
        <div className="mt-1 mb-1 px-4 py-3 rounded-lg text-[12px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          {lm.charger_notes && (
            <div className="mb-1.5">
              <span className="text-[var(--text-muted)]">Charger: </span>
              <span className="text-[var(--text-secondary)]">{lm.charger_notes}</span>
            </div>
          )}
          {lm.notes && (
            <div className="px-3 py-2 rounded-md text-[11px] text-[var(--text-muted)]"
              style={{ background: 'var(--bg-card)' }}>
              {lm.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AddProcessorForm
// ─────────────────────────────────────────────────────────────────────────────
function AddProcessorForm({ onAdd, onCancel }) {
  const [form,   setForm]   = useState(EMPTY_PROC)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.model.trim()) { setError('Model is required'); return }
    if (!form.brand.trim()) { setError('Brand is required'); return }
    setSaving(true)
    const err = await onAdd(form)
    setSaving(false)
    if (err) { setError(err); return }
    setForm(EMPTY_PROC)
    onCancel()
  }

  return (
    <div className="card p-5 mb-6 animate-fade-in" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] m-0">Add Processor</h3>
        <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
      </div>
      {error && <div className="alert-error mb-3 text-[12px] py-2 px-3">{error}</div>}
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div><label className="form-label">Model *</label>
            <input className="form-input" name="model" value={form.model} onChange={handleChange} placeholder="e.g. i7-1185G7" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Brand *</label>
            <select className="form-input" name="brand" value={form.brand} onChange={handleChange} style={{ fontSize: '13px', padding: '8px 10px' }}>
              {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select></div>
          <div><label className="form-label">Generation</label>
            <input className="form-input" name="generation" value={form.generation} onChange={handleChange} placeholder="e.g. 11th Gen" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Architecture</label>
            <input className="form-input" name="architecture" value={form.architecture} onChange={handleChange} placeholder="e.g. Tiger Lake" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div><label className="form-label">Process Node</label>
            <input className="form-input" name="process_node" value={form.process_node} onChange={handleChange} placeholder="e.g. 10nm SuperFin" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Node (nm)</label>
            <input className="form-input" type="number" name="process_node_nm" value={form.process_node_nm} onChange={handleChange} placeholder="10" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Year</label>
            <input className="form-input" type="number" name="release_year" value={form.release_year} onChange={handleChange} placeholder="2021" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">TDP (W)</label>
            <input className="form-input" type="number" name="tdp_w" value={form.tdp_w} onChange={handleChange} placeholder="15" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
          <div><label className="form-label">Cores</label>
            <input className="form-input" type="number" name="cores" value={form.cores} onChange={handleChange} placeholder="4" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Threads</label>
            <input className="form-input" type="number" name="threads" value={form.threads} onChange={handleChange} placeholder="8" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Base GHz</label>
            <input className="form-input" type="number" step="0.1" name="base_clock_ghz" value={form.base_clock_ghz} onChange={handleChange} placeholder="2.8" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Boost GHz</label>
            <input className="form-input" type="number" step="0.1" name="boost_clock_ghz" value={form.boost_clock_ghz} onChange={handleChange} placeholder="4.7" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Cache MB</label>
            <input className="form-input" type="number" name="cache_mb" value={form.cache_mb} onChange={handleChange} placeholder="12" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">RAM Min MHz</label>
            <input className="form-input" type="number" name="ram_speed_min_mhz" value={form.ram_speed_min_mhz} onChange={handleChange} placeholder="3200" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div><label className="form-label">RAM Max MHz</label>
            <input className="form-input" type="number" name="ram_speed_max_mhz" value={form.ram_speed_max_mhz} onChange={handleChange} placeholder="4267" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Integrated GPU</label>
            <input className="form-input" name="integrated_gpu" value={form.integrated_gpu} onChange={handleChange} placeholder="Intel Iris Xe" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">RAM Types (comma-sep)</label>
            <input className="form-input" name="ram_types" value={form.ram_types} onChange={handleChange} placeholder="DDR4-3200, LPDDR4x-4267" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: '130px', justifyContent: 'center' }}>
            {saving ? <div className="spinner" /> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Add Processor</>}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AddModelForm
// ─────────────────────────────────────────────────────────────────────────────
function AddModelForm({ onAdd, onCancel }) {
  const [form,   setForm]   = useState(EMPTY_MODEL)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.company.trim())    { setError('Company is required'); return }
    if (!form.model_name.trim()) { setError('Model name is required'); return }
    setSaving(true)
    const err = await onAdd(form)
    setSaving(false)
    if (err) { setError(err); return }
    setForm(EMPTY_MODEL)
    onCancel()
  }

  return (
    <div className="card p-5 mb-6 animate-fade-in" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] m-0">Add Laptop Model</h3>
        <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
      </div>
      {error && <div className="alert-error mb-3 text-[12px] py-2 px-3">{error}</div>}
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div><label className="form-label">Company *</label>
            <select className="form-input" name="company" value={form.company} onChange={handleChange} style={{ fontSize: '13px', padding: '8px 10px' }}>
              <option value="">Select</option>
              {COMPANY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="form-label">Model Name *</label>
            <input className="form-input" name="model_name" value={form.model_name} onChange={handleChange} placeholder="e.g. Latitude 7420" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Year</label>
            <input className="form-input" type="number" name="release_year" value={form.release_year} onChange={handleChange} placeholder="2021" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div><label className="form-label">Charger Connector</label>
            <select className="form-input" name="charger_connector" value={form.charger_connector} onChange={handleChange} style={{ fontSize: '13px', padding: '8px 10px' }}>
              <option value="">—</option>
              {CHARGER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          <div><label className="form-label">Wattage (W)</label>
            <input className="form-input" type="number" name="charger_wattage_w" value={form.charger_wattage_w} onChange={handleChange} placeholder="65" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Battery (Wh)</label>
            <input className="form-input" type="number" step="0.1" name="battery_wh" value={form.battery_wh} onChange={handleChange} placeholder="68.0" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div><label className="form-label">Charger Notes</label>
            <input className="form-input" name="charger_notes" value={form.charger_notes} onChange={handleChange} placeholder="e.g. USB-C preferred" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
          <div><label className="form-label">Notes</label>
            <input className="form-input" name="notes" value={form.notes} onChange={handleChange} placeholder="Optional notes" style={{ fontSize: '13px', padding: '8px 10px' }} /></div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: '130px', justifyContent: 'center' }}>
            {saving ? <div className="spinner" /> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Add Model</>}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main KnowledgeBaseClient
// ─────────────────────────────────────────────────────────────────────────────
export default function KnowledgeBaseClient({ user, initialProcessors, initialLaptopModels }) {
  const [processors,   setProcessors]   = useState(initialProcessors   || [])
  const [laptopModels, setLaptopModels] = useState(initialLaptopModels || [])
  const [tab,          setTab]          = useState('processors')
  const [search,       setSearch]       = useState('')
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [savingId,     setSavingId]     = useState(null)
  const [deletingId,   setDeletingId]   = useState(null)

  const supabase = createClient()

  useEffect(() => {
    const ch1 = supabase.channel('kb-proc-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processors' }, fetchProcessors)
      .subscribe()
    const ch2 = supabase.channel('kb-models-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laptop_models' }, fetchLaptopModels)
      .subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchProcessors() {
    const { data } = await supabase.from('processors').select('*').order('brand').order('release_year')
    if (data) setProcessors(data)
  }

  async function fetchLaptopModels() {
    const { data } = await supabase.from('laptop_models').select('*').order('company').order('model_name')
    if (data) setLaptopModels(data)
  }

  // ── Processors CRUD ─────────────────────────────────────────────────────────
  function buildProcPayload(form) {
    const ramArr = form.ram_types
      ? form.ram_types.split(',').map(s => s.trim()).filter(Boolean)
      : null
    return {
      model:             form.model.trim()         || null,
      brand:             form.brand.trim()          || null,
      generation:        form.generation.trim()     || null,
      architecture:      form.architecture.trim()   || null,
      process_node:      form.process_node.trim()   || null,
      process_node_nm:   form.process_node_nm   ? Number(form.process_node_nm)   : null,
      release_year:      form.release_year      ? Number(form.release_year)      : null,
      cores:             form.cores             ? Number(form.cores)             : null,
      threads:           form.threads           ? Number(form.threads)           : null,
      base_clock_ghz:    form.base_clock_ghz    ? Number(form.base_clock_ghz)    : null,
      boost_clock_ghz:   form.boost_clock_ghz   ? Number(form.boost_clock_ghz)   : null,
      cache_mb:          form.cache_mb          ? Number(form.cache_mb)          : null,
      tdp_w:             form.tdp_w             ? Number(form.tdp_w)             : null,
      integrated_gpu:    form.integrated_gpu.trim() || null,
      ram_types:         ramArr && ramArr.length > 0 ? ramArr : null,
      ram_speed_min_mhz: form.ram_speed_min_mhz ? Number(form.ram_speed_min_mhz) : null,
      ram_speed_max_mhz: form.ram_speed_max_mhz ? Number(form.ram_speed_max_mhz) : null,
      updated_at:        new Date().toISOString(),
    }
  }

  async function handleAddProcessor(form) {
    const payload = buildProcPayload(form)
    const { data: inserted, error } = await supabase
      .from('processors')
      .insert([{ ...payload, created_at: new Date().toISOString() }])
      .select().single()
    if (error) return error.message
    setProcessors(prev => [...prev, inserted].sort((a, b) => (a.brand > b.brand ? 1 : -1)))
    return null
  }

  async function handleSaveProcessor(id, form) {
    setSavingId(id)
    const payload = buildProcPayload(form)
    const { error } = await supabase.from('processors').update(payload).eq('id', id)
    setSavingId(null)
    if (error) return error.message
    setProcessors(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p))
    return null
  }

  async function handleDeleteProcessor(id) {
    if (!confirm('Delete this processor entry?')) return
    setDeletingId(id)
    const { error } = await supabase.from('processors').delete().eq('id', id)
    setDeletingId(null)
    if (!error) setProcessors(prev => prev.filter(p => p.id !== id))
  }

  // ── Laptop Models CRUD ───────────────────────────────────────────────────────
  function buildModelPayload(form) {
    return {
      company:           form.company.trim()         || null,
      model_name:        form.model_name.trim()      || null,
      release_year:      form.release_year      ? Number(form.release_year)      : null,
      charger_connector: form.charger_connector  || null,
      charger_wattage_w: form.charger_wattage_w ? Number(form.charger_wattage_w) : null,
      charger_notes:     form.charger_notes.trim()   || null,
      battery_wh:        form.battery_wh        ? Number(form.battery_wh)        : null,
      notes:             form.notes.trim()            || null,
      updated_at:        new Date().toISOString(),
    }
  }

  async function handleAddModel(form) {
    const payload = buildModelPayload(form)
    const { data: inserted, error } = await supabase
      .from('laptop_models')
      .insert([{ ...payload, created_at: new Date().toISOString() }])
      .select().single()
    if (error) return error.message
    setLaptopModels(prev => [...prev, inserted].sort((a, b) => (a.company > b.company ? 1 : -1)))
    return null
  }

  async function handleSaveModel(id, form) {
    setSavingId(id)
    const payload = buildModelPayload(form)
    const { error } = await supabase.from('laptop_models').update(payload).eq('id', id)
    setSavingId(null)
    if (error) return error.message
    setLaptopModels(prev => prev.map(m => m.id === id ? { ...m, ...payload } : m))
    return null
  }

  async function handleDeleteModel(id) {
    if (!confirm('Delete this laptop model entry?')) return
    setDeletingId(id)
    const { error } = await supabase.from('laptop_models').delete().eq('id', id)
    setDeletingId(null)
    if (!error) setLaptopModels(prev => prev.filter(m => m.id !== id))
  }

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filteredProcessors = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return processors
    return processors.filter(p =>
      (p.model          || '').toLowerCase().includes(q) ||
      (p.brand          || '').toLowerCase().includes(q) ||
      (p.architecture   || '').toLowerCase().includes(q) ||
      (p.generation     || '').toLowerCase().includes(q) ||
      (p.process_node   || '').toLowerCase().includes(q) ||
      (p.integrated_gpu || '').toLowerCase().includes(q)
    )
  }, [processors, search])

  const filteredModels = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return laptopModels
    return laptopModels.filter(m =>
      (m.company           || '').toLowerCase().includes(q) ||
      (m.model_name        || '').toLowerCase().includes(q) ||
      (m.charger_connector || '').toLowerCase().includes(q) ||
      (m.charger_notes     || '').toLowerCase().includes(q) ||
      (m.notes             || '').toLowerCase().includes(q)
    )
  }, [laptopModels, search])

  // ── Group by brand / company ─────────────────────────────────────────────────
  const groupedProcessors = useMemo(() => {
    const map = new Map()
    filteredProcessors.forEach(p => {
      const key = p.brand || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    })
    return map
  }, [filteredProcessors])

  const groupedModels = useMemo(() => {
    const map = new Map()
    filteredModels.forEach(m => {
      const key = m.company || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    })
    return map
  }, [filteredModels])

  const currentGrouped = tab === 'processors' ? groupedProcessors : groupedModels
  const totalCount = tab === 'processors' ? processors.length : laptopModels.length
  const filteredCount = tab === 'processors' ? filteredProcessors.length : filteredModels.length

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto">

      {/* ── Add form ──────────────────────────────────────────────────────── */}
      {showAddForm && tab === 'processors' && (
        <AddProcessorForm onAdd={handleAddProcessor} onCancel={() => setShowAddForm(false)} />
      )}
      {showAddForm && tab === 'models' && (
        <AddModelForm onAdd={handleAddModel} onCancel={() => setShowAddForm(false)} />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 flex-wrap mb-5">

        {/* Title */}
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">Knowledge Base</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 m-0">
            {filteredCount} of {totalCount} {tab === 'processors' ? 'processors' : 'models'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-0.5 rounded-[10px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          {[
            { id: 'processors', label: 'Processors', count: processors.length },
            { id: 'models',     label: 'Laptop Models', count: laptopModels.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShowAddForm(false) }}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all"
              style={{
                background: tab === t.id ? 'var(--bg-card)' : 'transparent',
                color:      tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                boxShadow: tab === t.id ? 'var(--shadow-card)' : 'none',
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', border: '1px solid rgba(59,130,246,0.25)' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[180px] max-w-[320px] relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" className="form-input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'processors' ? 'Search model, arch…' : 'Search model, brand…'}
            style={{ paddingLeft: '32px', fontSize: '13px', padding: '8px 12px 8px 32px' }} />
        </div>

        {/* Add button */}
        <button onClick={() => setShowAddForm(s => !s)} className="btn-primary whitespace-nowrap ml-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {tab === 'processors' ? 'Add Processor' : 'Add Model'}
        </button>
      </div>

      {/* ── Column headers (desktop) ─────────────────────────────────────── */}
      {currentGrouped.size > 0 && tab === 'processors' && (
        <div className="hidden md:flex items-center gap-4 px-4 pb-1 mb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="flex-1">Model / Architecture</span>
          <span className="w-36">Process Node</span>
          <span className="w-14 text-center">Year</span>
          <span className="w-20 text-center">Cores/Threads</span>
          <span className="w-28 text-right">Clock Speed</span>
          <span className="hidden lg:block w-16 text-right">TDP</span>
          <span className="hidden lg:block w-36 text-right">RAM Speed</span>
          <span className="w-20"></span>
        </div>
      )}
      {currentGrouped.size > 0 && tab === 'models' && (
        <div className="hidden md:flex items-center gap-4 px-4 pb-1 mb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="flex-1">Model Name</span>
          <span className="w-14 text-center">Year</span>
          <span className="w-44">Charger Type</span>
          <span className="w-20 text-center">Wattage</span>
          <span className="w-24 text-right">Battery</span>
          <span className="w-20"></span>
        </div>
      )}

      {/* ── Grouped content ──────────────────────────────────────────────── */}
      {currentGrouped.size === 0 ? (
        <div className="text-center py-16">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <p className="text-[var(--text-muted)] text-[14px] m-0">
            {search ? 'No entries match your search.' : `No ${tab === 'processors' ? 'processors' : 'laptop models'} yet.`}
          </p>
          {!search && (
            <button onClick={() => setShowAddForm(true)} className="text-[var(--accent-blue)] text-[14px] mt-2 cursor-pointer"
              style={{ background: 'transparent', border: 'none' }}>
              Add first entry →
            </button>
          )}
        </div>
      ) : (
        Array.from(currentGrouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, items]) => (
          <div key={groupKey} className="company-section">
            <div className="company-header">
              <span className="text-[var(--text-secondary)]">{groupKey}</span>
              <span className="font-normal text-[var(--text-muted)]">— {items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <div className="item-list">
              {tab === 'processors' ? (
                items.map(proc => (
                  <ProcessorRow
                    key={proc.id}
                    proc={proc}
                    onSave={handleSaveProcessor}
                    onDelete={handleDeleteProcessor}
                    savingId={savingId}
                    deletingId={deletingId}
                  />
                ))
              ) : (
                items.map(lm => (
                  <LaptopModelRow
                    key={lm.id}
                    lm={lm}
                    onSave={handleSaveModel}
                    onDelete={handleDeleteModel}
                    savingId={savingId}
                    deletingId={deletingId}
                  />
                ))
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
