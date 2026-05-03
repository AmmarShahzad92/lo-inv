'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  extractCPUKey,
  getModelSuggestionsFromDB,
  getProcessorSuggestionsFromDB,
  getProcessorSpecsFromDB,
} from '@/lib/laptopKB'
import { useApp } from '@/lib/AppContext'

const CATEGORY_OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'ram', label: 'RAM' },
  { value: 'ssd', label: 'SSD' },
  { value: 'charger', label: 'Charger' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
]

const RAM_OPTIONS = ['4GB', '8GB', '16GB', '32GB', '64GB']
const SSD_SIZE_OPTIONS = ['128GB', '256GB', '512GB', '1TB', '2TB']
const SSD_CATEGORY_OPTIONS = ['NVMe', 'SATA', 'eMMC']
const SCREEN_SIZE_OPTIONS = ['10"', '11.6"', '12.5"', '13.3"', '14.0"', '15.6"', '17.3"']
const COMPANY_LIST = ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba', 'Fujitsu', 'MSI', 'Samsung', 'LG', 'Microsoft', 'Huawei', 'Sony']

function extractName(email) {
  if (!email) return ''
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function parseWholePKR(raw, label) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a valid non-negative number.`)
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole PKR amount (no decimals).`)
  }
  return value
}

// -- Custom dropdown input with autocomplete ----------------------------------
function SmartInput({ value, onChange, onSelect, suggestions, placeholder, label, required, id }) {
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
  ).slice(0, 14)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}{required ? ' *' : ''}
        </label>
      )}
      <input
        id={id}
        className="form-input"
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || ''}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-focus)',
          borderRadius: '8px',
          maxHeight: '210px',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          marginTop: '3px',
        }}>
          {filtered.map((s, i) => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); onSelect(s); setOpen(false) }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
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

// -- Default empty form state -------------------------------------------------
function getInitialForm(item) {
  return {
    category: item?.category || 'laptop',
    item_name: item?.item_name || '',
    company: item?.company || '',
    model: item?.model || '',
    processor: item?.processor || '',
    screen_size: item?.screen_size || '',
    ram_size: item?.ram_size || '',
    ram_speed: item?.ram_speed || '',
    ssd_name: item?.ssd_name || '',
    ssd_size: item?.ssd_size || '',
    ssd_category: item?.ssd_category || '',
    graphics_card: item?.graphics_card || '',
    battery_health: item?.battery_health || '',
    cost_price: item?.cost_price || '',
    min_sale_price: item?.min_sale_price || '',
    specifications: item?.specifications || {},
    notes: item?.notes || '',
    purchase_id: item?.purchase_id || '',
    liability_amount: '',
  }
}

export default function InventoryForm({ user, partners, mode, item }) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const { laptopModels, processors, purchases } = useApp()

  const [form, setForm] = useState(() => getInitialForm(item))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [specsOpen, setSpecsOpen] = useState(false)
  const [autoSpecs, setAutoSpecs] = useState(null)
  const [modelSuggestions, setModelSuggestions] = useState([])
  const [processorSuggestions, setProcessorSuggestions] = useState([])

  const supabase = createClient()

  function getItemLabelForLogs(sourceForm) {
    if (sourceForm.category === 'laptop') {
      return `${sourceForm.company || ''} ${sourceForm.model || ''}`.trim() || 'Inventory item'
    }
    return sourceForm.item_name?.trim() || 'Inventory item'
  }

  const isLaptop = form.category === 'laptop'
  const isRam = form.category === 'ram'
  const isSsd = form.category === 'ssd'
  const isCharger = form.category === 'charger'
  const isAccessory = form.category === 'accessory'
  const isOther = form.category === 'other'

  // Has SSD fields: laptop + ssd
  const showSsdFields = isLaptop || isSsd
  // Has RAM fields: laptop + ram
  const showRamFields = isLaptop || isRam
  // Has item_name: everything except laptop
  const showItemName = !isLaptop
  // Has laptop-specific fields
  const showLaptopFields = isLaptop

  // -- Populate model suggestions when company changes (laptop only) ----------
  useEffect(() => {
    if (isLaptop) {
      setModelSuggestions(form.company ? getModelSuggestionsFromDB(form.company, '', laptopModels) : [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.company, form.category])

  // -- On edit load, resolve processor specs ----------------------------------
  useEffect(() => {
    if (isEdit && isLaptop && form.processor && !autoSpecs) {
      applyProcessorSpecs(form.processor)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyProcessorSpecs(cpuText) {
    const key = extractCPUKey(cpuText)
    if (!key) return
    const specs = getProcessorSpecsFromDB(key, processors)
    if (!specs) return
    setAutoSpecs(specs)
    setForm(f => ({
      ...f,
      graphics_card: f.graphics_card || specs.gpu || '',
      specifications: Object.keys(f.specifications || {}).length > 0 ? f.specifications : {
        architecture: specs.arch,
        generation: String(specs.gen),
        cores: String(specs.cores),
        threads: String(specs.threads),
        base_clock_ghz: String(specs.baseGHz),
        boost_clock_ghz: specs.boostGHz ? String(specs.boostGHz) : '',
        cache_mb: String(specs.cacheMB),
        tdp_w: String(specs.tdpW),
        ram_type: specs.ramTypes?.[0] || '',
      },
    }))
  }

  function handleCompanyChange(val) {
    setForm(f => ({ ...f, company: val, model: '', processor: '', graphics_card: '' }))
    setModelSuggestions(getModelSuggestionsFromDB(val, '', laptopModels))
    setProcessorSuggestions([])
    setAutoSpecs(null)
    setError('')
  }

  function handleModelChange(val) {
    setForm(f => ({ ...f, model: val }))
    setError('')
    setModelSuggestions(getModelSuggestionsFromDB(form.company, val, laptopModels))
  }

  function handleModelSelect(modelName) {
    setForm(f => ({ ...f, model: modelName }))
    const procs = getProcessorSuggestionsFromDB(form.company, modelName, laptopModels)
    setProcessorSuggestions(procs)
  }

  function handleProcessorChange(val) {
    setForm(f => ({ ...f, processor: val }))
    setError('')
    const key = extractCPUKey(val)
    if (key) applyProcessorSpecs(key)
  }

  function handleProcessorSelect(cpuKey) {
    setForm(f => ({ ...f, processor: cpuKey }))
    applyProcessorSpecs(cpuKey)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setError('')
  }

  function handleSpecsChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, specifications: { ...(f.specifications || {}), [name]: value } }))
  }

  function handleCategoryChange(e) {
    const newCategory = e.target.value
    // Reset form but keep shared fields
    setForm(f => ({
      ...getInitialForm(null),
      category: newCategory,
      cost_price: f.cost_price,
      min_sale_price: f.min_sale_price,
      notes: f.notes,
      purchase_id: f.purchase_id,
    }))
    setAutoSpecs(null)
    setModelSuggestions([])
    setProcessorSuggestions([])
    setError('')
  }

  // -- Validation -------------------------------------------------------------
  function validate() {
    if (isLaptop) {
      if (!form.company.trim()) return 'Company/brand is required.'
      if (!form.model.trim()) return 'Model is required.'
      if (!form.processor.trim()) return 'Processor is required.'
      if (!form.ram_size) return 'RAM size is required.'
      if (!form.ssd_size) return 'SSD size is required.'
    } else {
      if (!form.item_name.trim()) return 'Item name is required.'
    }
    if (isRam && !form.ram_size) return 'RAM size is required.'
    if (isSsd && !form.ssd_size) return 'SSD size is required.'
    try {
      const cost = parseWholePKR(form.cost_price, 'Cost price')
      const minSale = parseWholePKR(form.min_sale_price, 'Minimum sale price')
      if (cost <= 0) return 'Please enter a valid cost price.'
      if (minSale <= 0) return 'Please enter a valid minimum sale price.'
    } catch (e) {
      return e.message
    }
    if (form.liability_amount !== '') {
      try {
        const liabilityAmount = parseWholePKR(form.liability_amount, 'Liability amount')
        if (liabilityAmount > parseWholePKR(form.cost_price, 'Cost price')) return 'Liability amount cannot exceed cost price.'
      } catch (e) {
        return e.message
      }
    }
    return null
  }

  // -- Submit -----------------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')

    // Clean specifications JSONB
    const cleanSpecs = {}
    Object.entries(form.specifications || {}).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) cleanSpecs[k] = v
    })

    const costPriceWhole = parseWholePKR(form.cost_price, 'Cost price')
    const minSaleWhole = parseWholePKR(form.min_sale_price, 'Minimum sale price')

    const payload = {
      category: form.category,
      cost_price: costPriceWhole,
      min_sale_price: minSaleWhole,
      notes: form.notes.trim() || null,
      specifications: Object.keys(cleanSpecs).length > 0 ? cleanSpecs : null,
      purchase_id: form.purchase_id || null,
    }

    // Category-specific fields
    if (isLaptop) {
      payload.item_name = null
      payload.company = form.company.trim()
      payload.model = form.model.trim()
      payload.processor = form.processor.trim()
      payload.screen_size = form.screen_size || null
      payload.ram_size = form.ram_size || null
      payload.ram_speed = form.ram_speed.trim() || null
      payload.ssd_name = form.ssd_name.trim() || null
      payload.ssd_size = form.ssd_size || null
      payload.ssd_category = form.ssd_category || null
      payload.graphics_card = form.graphics_card.trim() || null
      payload.battery_health = form.battery_health.trim() || null
    } else {
      payload.item_name = form.item_name.trim()
      payload.company = null
      payload.model = null
      payload.processor = null
      payload.screen_size = null
      payload.graphics_card = null
      payload.battery_health = null
    }

    if (showRamFields && !isLaptop) {
      payload.ram_size = form.ram_size || null
      payload.ram_speed = form.ram_speed.trim() || null
    }

    if (showSsdFields && !isLaptop) {
      payload.ssd_name = form.ssd_name.trim() || null
      payload.ssd_size = form.ssd_size || null
      payload.ssd_category = form.ssd_category || null
    }

    if (!showRamFields && !isLaptop) {
      payload.ram_size = null
      payload.ram_speed = null
    }

    if (!showSsdFields && !isLaptop) {
      payload.ssd_name = null
      payload.ssd_size = null
      payload.ssd_category = null
    }

    if (isEdit) {
      payload.updated_at = new Date().toISOString()
      const { error: dbError } = await supabase.from('inventory').update(payload).eq('id', item.id)
      if (dbError) { setError(dbError.message); setLoading(false); return }
    } else {
      const costPrice = costPriceWhole
      const explicitLiability = form.liability_amount === '' ? 0 : parseWholePKR(form.liability_amount, 'Liability amount')
      let cashToDeduct = costPrice - explicitLiability
      let finalLiability = explicitLiability

      const { data: capital, error: capitalFetchErr } = await supabase
        .from('enterprise_capital')
        .select('*')
        .limit(1)
        .single()

      if (capitalFetchErr || !capital) {
        setError('Could not load enterprise capital. Please check enterprise_capital setup.')
        setLoading(false)
        return
      }

      const currentLiquid = Number(capital.liquid_assets) || 0
      if (cashToDeduct > currentLiquid) {
        const shortage = cashToDeduct - currentLiquid
        const proceed = confirm(
          `Liquid assets are insufficient by PKR ${shortage.toLocaleString('en-PK')}.\n\n` +
          `Press OK to deduct PKR ${currentLiquid.toLocaleString('en-PK')} from liquid assets and add PKR ${shortage.toLocaleString('en-PK')} to liabilities.`
        )
        if (!proceed) {
          setLoading(false)
          return
        }
        cashToDeduct = currentLiquid
        finalLiability += shortage
      }

      const previewMessage =
        `Please confirm this financial split:\n\n` +
        `Cost (solid assets): PKR ${costPrice.toLocaleString('en-PK')}\n` +
        `Cash deduction (liquid assets): PKR ${cashToDeduct.toLocaleString('en-PK')}\n` +
        `Liability creation: PKR ${finalLiability.toLocaleString('en-PK')}`
      if (!confirm(previewMessage)) {
        setLoading(false)
        return
      }

      payload.status = 'in_stock'
      payload.created_by = user.email
      payload.created_at = new Date().toISOString()
      const { data: insertedItem, error: dbError } = await supabase.from('inventory').insert([payload]).select().single()
      if (dbError) { setError(dbError.message); setLoading(false); return }

      const itemLabel = getItemLabelForLogs(form)

      if (cashToDeduct > 0) {
        const newLiquid = currentLiquid - cashToDeduct
        const { error: capitalUpdateErr } = await supabase
          .from('enterprise_capital')
          .update({ liquid_assets: newLiquid, updated_at: new Date().toISOString() })
          .eq('id', capital.id)

        if (capitalUpdateErr) {
          setError('Inventory added, but liquid assets update failed: ' + capitalUpdateErr.message)
          setLoading(false)
          return
        }

        const { error: ledgerErr } = await supabase.from('capital_ledger').insert([{
          transaction_type: 'purchase',
          amount: -cashToDeduct,
          balance_after: newLiquid,
          petty_cash_after: Number(capital.petty_cash) || 0,
          reference_type: 'inventory',
          reference_id: insertedItem.id,
          description: `Inventory purchase: ${itemLabel}`,
          created_by: user?.email || 'unknown',
        }])

        if (ledgerErr) {
          setError('Inventory added and cash updated, but purchase ledger log failed: ' + ledgerErr.message)
          setLoading(false)
          return
        }
      }

      if (finalLiability > 0) {
        const status = finalLiability === costPrice ? 'pending' : 'partial'
        const { error: liabilityErr } = await supabase.from('liabilities').insert([{
          description: `Inventory liability - ${itemLabel}`,
          total_amount: finalLiability,
          remaining_amount: finalLiability,
          status,
          purchase_id: form.purchase_id || null,
          created_by: user?.email || 'unknown',
          notes: `Auto-created during inventory add. Item cost: PKR ${costPrice.toLocaleString('en-PK')}.`,
        }])

        if (liabilityErr) {
          setError('Inventory added, but creating liability failed: ' + liabilityErr.message)
          setLoading(false)
          return
        }
      }
    }

    setSuccess(isEdit ? 'Item updated successfully.' : 'Item added to inventory.')
    setTimeout(() => router.push('/'), 800)
  }

  // -- Category label for headings --------------------------------------------
  const categoryLabel = CATEGORY_OPTIONS.find(c => c.value === form.category)?.label || 'Item'

  // -- Format purchase for dropdown -------------------------------------------
  function formatPurchaseOption(p) {
    const date = p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('en-GB') : ''
    const amount = p.total_amount ? `PKR ${Number(p.total_amount).toLocaleString('en-PK')}` : ''
    const parts = [p.supplier_name, amount, date].filter(Boolean)
    return parts.join(' - ')
  }

  // -- Charger specification fields -------------------------------------------
  const chargerSpecFields = [
    { key: 'wattage', label: 'Wattage', ph: 'e.g. 65W' },
    { key: 'connector', label: 'Connector Type', ph: 'e.g. USB-C, Barrel' },
  ]

  // -- Laptop technical specification fields ----------------------------------
  const laptopSpecFields = [
    { key: 'architecture', label: 'Architecture', ph: 'e.g. Tiger Lake' },
    { key: 'generation', label: 'Generation', ph: 'e.g. 11' },
    { key: 'cores', label: 'Cores', ph: 'e.g. 4' },
    { key: 'threads', label: 'Threads', ph: 'e.g. 8' },
    { key: 'base_clock_ghz', label: 'Base GHz', ph: 'e.g. 2.4' },
    { key: 'boost_clock_ghz', label: 'Boost GHz', ph: 'e.g. 4.2' },
    { key: 'cache_mb', label: 'Cache (MB)', ph: 'e.g. 8' },
    { key: 'tdp_w', label: 'TDP (W)', ph: 'e.g. 15' },
    { key: 'ram_type', label: 'RAM Type', ph: 'e.g. DDR4-3200' },
  ]

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10 max-w-[720px] mx-auto">
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none',
        marginBottom: '24px', transition: 'color 0.1s',
      }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to inventory
      </Link>

      <div className="card p-5 sm:p-8" style={{ background: 'var(--bg-card)', borderRadius: '12px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {isEdit ? `Edit ${categoryLabel}` : 'Add New Inventory Item'}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
            {isEdit
              ? `Editing ${categoryLabel.toLowerCase()} entry · last saved ${item?.updated_at ? new Date(item.updated_at).toLocaleDateString('en-GB') : 'never'}`
              : 'Select a category, fill in the details, and add to inventory.'}
          </p>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '20px' }}>{error}</div>}
        {success && <div className="alert-success" style={{ marginBottom: '20px' }}>{success}</div>}

        <form onSubmit={handleSubmit} autoComplete="off">

          {/* ── Category Selector ──────────────────────────────────────────── */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">Category *</label>
            <select
              className="form-input"
              name="category"
              value={form.category}
              onChange={handleCategoryChange}
              disabled={isEdit}
              style={isEdit ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
            >
              {CATEGORY_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* ── Item Name (non-laptop categories) ──────────────────────────── */}
          {showItemName && (
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Item Name *</label>
              <input
                className="form-input"
                type="text"
                name="item_name"
                value={form.item_name}
                onChange={handleChange}
                placeholder={
                  isRam ? 'e.g. Kingston Fury 16GB DDR4' :
                    isSsd ? 'e.g. Samsung 970 EVO Plus 512GB' :
                      isCharger ? 'e.g. Dell 65W USB-C Charger' :
                        'e.g. Laptop bag, Mouse, Keyboard'
                }
              />
            </div>
          )}

          {/* ── Laptop-specific: Brand + Model ─────────────────────────────── */}
          {showLaptopFields && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <SmartInput
                  id="company"
                  label="Brand / Company"
                  required
                  value={form.company}
                  onChange={handleCompanyChange}
                  onSelect={handleCompanyChange}
                  suggestions={COMPANY_LIST}
                  placeholder="e.g. Dell, HP, Lenovo"
                />
                <SmartInput
                  id="model"
                  label="Model"
                  required
                  value={form.model}
                  onChange={handleModelChange}
                  onSelect={handleModelSelect}
                  suggestions={modelSuggestions}
                  placeholder={form.company ? 'Type to search models...' : 'Select company first'}
                />
              </div>

              {/* Processor with KB autocomplete */}
              <div style={{ marginBottom: '4px' }}>
                <SmartInput
                  id="processor"
                  label="Processor"
                  required
                  value={form.processor}
                  onChange={handleProcessorChange}
                  onSelect={handleProcessorSelect}
                  suggestions={processorSuggestions}
                  placeholder="e.g. i7-1185G7, Ryzen 5 5600U"
                />
              </div>
              {autoSpecs && (
                <div style={{ marginBottom: '16px', marginTop: '5px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: '600' }}>{autoSpecs.arch}</span>
                  <span>·</span>
                  <span>{autoSpecs.cores}c / {autoSpecs.threads}t</span>
                  <span>·</span>
                  <span>{autoSpecs.baseGHz}
                    {autoSpecs.boostGHz ? ` – ${autoSpecs.boostGHz}` : ''} GHz
                  </span>
                  <span>·</span>
                  <span>{autoSpecs.cacheMB}MB cache</span>
                  <span>·</span>
                  <span>{autoSpecs.tdpW}W TDP</span>
                  {autoSpecs.ramTypes?.[0] && <><span>·</span><span>{autoSpecs.ramTypes[0]}</span></>}
                </div>
              )}
              {!autoSpecs && <div style={{ marginBottom: '16px' }} />}

              {/* Screen Size + Graphics Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label">Screen Size</label>
                  <select className="form-input" name="screen_size" value={form.screen_size} onChange={handleChange}>
                    <option value="">Select screen size</option>
                    {SCREEN_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">
                    Graphics Card
                    {autoSpecs && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: '400', marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>
                        · auto-filled
                      </span>
                    )}
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    name="graphics_card"
                    value={form.graphics_card}
                    onChange={handleChange}
                    placeholder="Auto-filled from processor"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── RAM Fields (laptop + ram category) ─────────────────────────── */}
          {showRamFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="form-label">RAM Size {(isLaptop || isRam) ? '*' : ''}</label>
                <select className="form-input" name="ram_size" value={form.ram_size} onChange={handleChange}>
                  <option value="">Select RAM size</option>
                  {RAM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">RAM Speed</label>
                <input
                  className="form-input"
                  type="text"
                  name="ram_speed"
                  value={form.ram_speed}
                  onChange={handleChange}
                  placeholder="e.g. DDR4-3200, DDR5-4800"
                />
              </div>
            </div>
          )}

          {/* ── SSD Fields (laptop + ssd category) ─────────────────────────── */}
          {showSsdFields && (
            <>
              <div className={`grid grid-cols-1 ${isLaptop ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 mb-4`}>
                {!isLaptop && (
                  <div>
                    <label className="form-label">SSD Name</label>
                    <input
                      className="form-input"
                      type="text"
                      name="ssd_name"
                      value={form.ssd_name}
                      onChange={handleChange}
                      placeholder="e.g. Samsung 970 EVO"
                    />
                  </div>
                )}
                {isLaptop && (
                  <div>
                    <label className="form-label">SSD Name</label>
                    <input
                      className="form-input"
                      type="text"
                      name="ssd_name"
                      value={form.ssd_name}
                      onChange={handleChange}
                      placeholder="e.g. Samsung 970 EVO"
                    />
                  </div>
                )}
                <div>
                  <label className="form-label">SSD Size {(isLaptop || isSsd) ? '*' : ''}</label>
                  <select className="form-input" name="ssd_size" value={form.ssd_size} onChange={handleChange}>
                    <option value="">Select SSD size</option>
                    {SSD_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">SSD Category</label>
                  <select className="form-input" name="ssd_category" value={form.ssd_category} onChange={handleChange}>
                    <option value="">Select type</option>
                    {SSD_CATEGORY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── Charger Specifications (inline) ────────────────────────────── */}
          {isCharger && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {chargerSpecFields.map(f => (
                <div key={f.key}>
                  <label className="form-label">{f.label}</label>
                  <input
                    className="form-input"
                    type="text"
                    name={f.key}
                    value={form.specifications?.[f.key] ?? ''}
                    onChange={handleSpecsChange}
                    placeholder={f.ph}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Prices ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Cost Price (PKR) *</label>
              <input className="form-input" type="number" name="cost_price" value={form.cost_price} onChange={handleChange} onWheel={e => e.currentTarget.blur()} placeholder="e.g. 45000" min="0" step="1" />
            </div>
            <div>
              <label className="form-label">Min. Sale Price (PKR) *</label>
              <input className="form-input" type="number" name="min_sale_price" value={form.min_sale_price} onChange={handleChange} onWheel={e => e.currentTarget.blur()} placeholder="e.g. 52000" min="0" step="1" />
            </div>
          </div>

          {/* ── Liability Split (add mode only) ────────────────────────────── */}
          {!isEdit && (
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">
                Liability Portion (PKR)
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  {' '}(optional)
                </span>
              </label>
              <input
                className="form-input"
                type="number"
                name="liability_amount"
                value={form.liability_amount}
                onChange={handleChange}
                onWheel={e => e.currentTarget.blur()}
                min="0"
                step="1"
                placeholder="If part of cost should become liability"
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Cash deduction preview: {(() => {
                  const cost = Number(form.cost_price) || 0
                  const liab = Math.max(0, Number(form.liability_amount) || 0)
                  const cashPart = Math.max(0, cost - liab)
                  return `PKR ${cashPart.toLocaleString('en-PK')}`
                })()}
                {' · '}
                Liability preview: {(() => {
                  const liab = Math.max(0, Number(form.liability_amount) || 0)
                  return `PKR ${liab.toLocaleString('en-PK')}`
                })()}
              </div>
            </div>
          )}

          {/* ── Purchase Link (optional) ───────────────────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">
              Linked Purchase{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <select className="form-input" name="purchase_id" value={form.purchase_id} onChange={handleChange}>
              <option value="">No linked purchase</option>
              {(purchases || []).map(p => (
                <option key={p.id} value={p.id}>{formatPurchaseOption(p)}</option>
              ))}
            </select>
          </div>

          {/* ── Battery Health (laptop only) ───────────────────────────────── */}
          {isLaptop && (
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">
                Battery Health{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                className="form-input"
                type="text"
                name="battery_health"
                value={form.battery_health}
                onChange={handleChange}
                placeholder="Not set — e.g. 95%, Good, Degraded, Replace"
              />
            </div>
          )}

          {/* ── Notes ──────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder={`Any notes about this ${categoryLabel.toLowerCase()} (condition, accessories, etc.)`}
              rows={2}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
          </div>


          {/* ── Collapsible Technical Specifications (JSONB) ───────────────── */}
          <div style={{ marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => setSpecsOpen(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: specsOpen ? '8px 8px 0 0' : '8px',
                color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Technical Specifications
              {isLaptop && autoSpecs && (
                <span className="badge badge-blue" style={{ fontSize: '10px', padding: '1px 6px', marginLeft: '2px' }}>
                  auto-filled
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {specsOpen ? '▲' : '▼'}
              </span>
            </button>

            {specsOpen && (
              <div style={{
                padding: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
              }}>
                {isLaptop && autoSpecs?.ramTypes && (
                  <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Supported RAM types: <strong style={{ color: 'var(--text-secondary)' }}>{autoSpecs.ramTypes.join(' · ')}</strong>
                  </p>
                )}

                {isLaptop ? (
                  // Laptop: structured spec fields
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    {laptopSpecFields.map(f => (
                      <div key={f.key}>
                        <label className="form-label" style={{ fontSize: '10px' }}>{f.label}</label>
                        <input
                          className="form-input"
                          type="text"
                          name={f.key}
                          value={form.specifications?.[f.key] ?? ''}
                          onChange={handleSpecsChange}
                          placeholder={f.ph}
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Non-laptop: free-form key-value specifications
                  <SpecsEditor
                    specs={form.specifications}
                    onChange={(newSpecs) => setForm(f => ({ ...f, specifications: newSpecs }))}
                    excludeKeys={isCharger ? ['wattage', 'connector'] : []}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Meta info ──────────────────────────────────────────────────── */}
          <div style={{
            padding: '12px 16px', background: 'var(--bg-secondary)',
            borderRadius: '8px', border: '1px solid var(--border)',
            marginBottom: '24px', fontSize: '12px', color: 'var(--text-muted)',
          }}>
            {isEdit ? (
              <>
                <span>Editing as <strong style={{ color: 'var(--text-secondary)' }}>{user?.display_name || extractName(user.email)}</strong></span>
                <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                <span>Originally added by <strong style={{ color: 'var(--text-secondary)' }}>{extractName(item?.created_by)}</strong> on {item?.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : '—'}</span>
              </>
            ) : (
              <span>Adding as <strong style={{ color: 'var(--text-secondary)' }}>{user?.display_name || extractName(user.email)}</strong></span>
            )}
          </div>

          {/* ── Actions ────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
              {loading ? <div className="spinner" /> : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {isEdit ? 'Save Changes' : 'Add to Inventory'}
                </>
              )}
            </button>
            <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

// -- Free-form key-value specifications editor for non-laptop categories ------
function SpecsEditor({ specs, onChange, excludeKeys = [] }) {
  const currentSpecs = specs || {}
  // Filter out keys handled elsewhere (e.g. charger wattage/connector)
  const entries = Object.entries(currentSpecs).filter(([k]) => !excludeKeys.includes(k))

  function handleKeyChange(oldKey, newKey) {
    const updated = {}
    Object.entries(currentSpecs).forEach(([k, v]) => {
      if (k === oldKey) {
        if (newKey.trim()) updated[newKey.trim()] = v
      } else {
        updated[k] = v
      }
    })
    onChange(updated)
  }

  function handleValueChange(key, newValue) {
    onChange({ ...currentSpecs, [key]: newValue })
  }

  function handleRemove(key) {
    const updated = { ...currentSpecs }
    delete updated[key]
    onChange(updated)
  }

  function handleAdd() {
    const newKey = `spec_${Object.keys(currentSpecs).length + 1}`
    onChange({ ...currentSpecs, [newKey]: '' })
  }

  return (
    <div>
      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
        Add custom specification key-value pairs.
      </p>
      {entries.map(([key, value], i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2 items-end">
          <div>
            {i === 0 && <label className="form-label" style={{ fontSize: '10px' }}>Key</label>}
            <input
              className="form-input"
              type="text"
              value={key}
              onChange={e => handleKeyChange(key, e.target.value)}
              placeholder="e.g. color"
              style={{ fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
          <div>
            {i === 0 && <label className="form-label" style={{ fontSize: '10px' }}>Value</label>}
            <input
              className="form-input"
              type="text"
              value={value}
              onChange={e => handleValueChange(key, e.target.value)}
              placeholder="e.g. black"
              style={{ fontSize: '12px', padding: '6px 10px' }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleRemove(key)}
            style={{
              padding: '6px 10px', borderRadius: '6px',
              background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--accent-red)', cursor: 'pointer', fontSize: '12px',
              flexShrink: 0,
            }}
          >
            X
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        style={{
          padding: '6px 12px', borderRadius: '6px',
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '12px',
          display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px',
        }}
      >
        + Add spec
      </button>
    </div>
  )
}
