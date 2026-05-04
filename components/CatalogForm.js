'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CatalogImagesInput from '@/components/CatalogImagesInput'
import { normalizeImages } from '@/lib/catalogImages'
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

const RAM_TYPES = ['DDR3', 'DDR4', 'DDR5']
const RAM_SIZES = ['4GB', '8GB', '16GB', '32GB', '64GB']
const SCREEN_SIZES = ['12.5"', '13.3"', '14"', '15.6"', '17"']
const STORAGE_CATEGORIES = ['SSD', 'HDD']
const STORAGE_TYPES = ['NVMe M2', 'SATA M2', 'SATA 3.5"']
const CONDITION_OPTIONS = ['New', 'Excellent', 'Good', 'Fair']
const STATUS_OPTIONS = ['live', 'paused', 'discontinued']
const SPEC_CATEGORIES = ['Notebook', 'Study Laptop', 'Office Laptop', 'High performance Machine', 'Gaming Laptop', 'Workstation']
const COMPANY_LIST = ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Toshiba', 'Fujitsu', 'MSI', 'Samsung', 'LG', 'Microsoft', 'Huawei', 'Sony']

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

function parseStorageSize(value) {
    if (!value) return ''
    const match = String(value).match(/(\d+)/)
    return match ? match[1] : ''
}

function buildStorageString(size, category, type) {
    if (!size && !category && !type) return ''
    const sizeLabel = size ? `${size}GB` : ''
    return [sizeLabel, category, type].filter(Boolean).join('-')
}

function parseStorageString(value) {
    if (!value) return { size: '', category: '', type: '' }
    const parts = String(value).split('-')
    const size = parseStorageSize(parts[0])
    const category = parts[1] || ''
    const type = parts.slice(2).join('-') || ''
    return { size, category, type }
}

function buildRamString(type, size, speed) {
    const speedLabel = speed ? `${speed}MHz` : ''
    return [type, size, speedLabel].filter(Boolean).join('-')
}

function parseRamString(value) {
    if (!value) return { type: '', size: '', speed: '' }
    const parts = String(value).split('-')
    const type = parts[0] || ''
    const size = parts[1] || ''
    const speed = parts[2] ? parts[2].replace(/[^\d]/g, '') : ''
    return { type, size, speed }
}

function inferProcessorBrand(processor) {
    const lower = String(processor || '').toLowerCase()
    if (!lower) return 'Unknown'
    if (lower.includes('ryzen') || lower.includes('amd')) return 'AMD'
    if (lower.startsWith('m')) return 'Apple'
    if (lower.startsWith('i') || lower.includes('intel')) return 'Intel'
    return 'Unknown'
}

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

function getInitialForm(item) {
    const category = item?.category || 'laptop'
    const storage = item?.storage || {}
    const primaryStorage = parseStorageString(storage?.primary)
    const additionalStorage = Array.isArray(storage?.additional)
        ? storage.additional.map(parseStorageString)
        : []
    const ram = parseRamString(item?.ram)

    return {
        category,
        status: item?.status || 'live',
        item_name: category === 'laptop' ? '' : (item?.model || ''),
        brand: item?.brand || '',
        model: item?.model || '',
        processor: item?.cpu || '',
        screen_size: item?.screen || '',
        graphics_card: item?.gpu?.integrated || item?.gpu?.dedicated || '',
        dedicated_gpu: Array.isArray(item?.gpu?.dedicated) ? item.gpu.dedicated[0] : (item?.gpu?.dedicated || ''),
        condition: item?.condition || 'New',
        price: item?.price ?? '',
        highlights: Array.isArray(item?.highlights) ? item.highlights : [''],
        images: normalizeImages(item?.images),
        ram_type: ram.type,
        ram_size: ram.size,
        ram_speed: ram.speed,
        primary_storage_size: primaryStorage.size,
        primary_storage_category: primaryStorage.category,
        primary_storage_type: primaryStorage.type,
        additional_storage: additionalStorage.length ? additionalStorage : [{ size: '', category: '', type: '' }],
        spec_os: item?.specs?.os || '',
        spec_category: item?.specs?.category || '',
        spec_battery_wh: item?.specs?.battery_wh || '',
        spec_battery_health: item?.specs?.battery_health || '',
        wattage: item?.wattage ?? '',
        connector_type: item?.connector_type || '',
    }
}

export default function CatalogForm({ user, mode, item }) {
    const router = useRouter()
    const isEdit = mode === 'edit'
    const { laptopModels, processors } = useApp()
    const supabase = createClient()

    const [form, setForm] = useState(() => getInitialForm(item))
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [modelSuggestions, setModelSuggestions] = useState([])
    const [processorSuggestions, setProcessorSuggestions] = useState([])

    const isLaptop = form.category === 'laptop'
    const isRam = form.category === 'ram'
    const isSsd = form.category === 'ssd'
    const isCharger = form.category === 'charger'
    const isAccessory = form.category === 'accessory'
    const isOther = form.category === 'other'

    const showBrand = isLaptop || isCharger || isAccessory
    const showModel = isLaptop
    const showItemName = !isLaptop
    const showProcessor = isLaptop
    const showRamFields = isLaptop || isRam
    const showStorageFields = isLaptop || isSsd
    const showGpuFields = isLaptop
    const showScreen = isLaptop
    const showSpecs = isLaptop
    const showWattage = isCharger
    const showConnector = isCharger

    useEffect(() => {
        if (isLaptop && form.brand) {
            setModelSuggestions(getModelSuggestionsFromDB(form.brand, form.model, laptopModels))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.brand, form.category])

    function handleCategoryChange(e) {
        const nextCategory = e.target.value
        setForm(prev => ({
            ...getInitialForm({ category: nextCategory }),
            category: nextCategory,
            status: prev.status || 'live',
        }))
        setModelSuggestions([])
        setProcessorSuggestions([])
        setError('')
    }

    function handleModelSelect(modelName) {
        setForm(f => ({ ...f, model: modelName }))
        const procs = getProcessorSuggestionsFromDB(form.brand, modelName, laptopModels)
        setProcessorSuggestions(procs)
    }

    function handleProcessorSelect(cpuKey) {
        setForm(f => ({ ...f, processor: cpuKey }))
        const specs = getProcessorSpecsFromDB(cpuKey, processors)
        if (specs?.gpu && !form.graphics_card) {
            setForm(f => ({ ...f, graphics_card: specs.gpu }))
        }
    }

    function updateHighlights(index, value) {
        setForm(f => {
            const next = [...f.highlights]
            next[index] = value
            return { ...f, highlights: next }
        })
    }

    function addHighlight() {
        setForm(f => {
            if (f.highlights.length >= 5) return f
            return { ...f, highlights: [...f.highlights, ''] }
        })
    }

    function removeHighlight(index) {
        setForm(f => ({ ...f, highlights: f.highlights.filter((_, i) => i !== index) }))
    }

    function updateAdditionalStorage(index, key, value) {
        setForm(f => {
            const next = f.additional_storage.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
            return { ...f, additional_storage: next }
        })
    }

    function addAdditionalStorage() {
        setForm(f => ({ ...f, additional_storage: [...f.additional_storage, { size: '', category: '', type: '' }] }))
    }

    function removeAdditionalStorage(index) {
        setForm(f => ({ ...f, additional_storage: f.additional_storage.filter((_, i) => i !== index) }))
    }

    function validate() {
        if (!form.category) return 'Category is required.'
        if (!form.status) return 'Status is required.'
        if (!form.condition) return 'Condition is required.'
        if (showBrand && !form.brand.trim()) return 'Brand/company is required.'
        if (showModel && !form.model.trim()) return 'Model is required.'
        if (showItemName && !form.item_name.trim()) return 'Item name is required.'
        if (showProcessor && !form.processor.trim()) return 'Processor is required.'
        if (showRamFields) {
            if (!form.ram_type) return 'RAM type is required.'
            if (!form.ram_size) return 'RAM size is required.'
            if (!form.ram_speed) return 'RAM speed is required.'
        }
        if (showStorageFields) {
            if (!form.primary_storage_size) return 'Primary storage size is required.'
            if (!form.primary_storage_category) return 'Primary storage category is required.'
            if (!form.primary_storage_type) return 'Primary storage type is required.'
        }
        if (showGpuFields && !form.graphics_card.trim()) return 'Graphics card is required.'
        if (showScreen && !form.screen_size) return 'Screen size is required.'
        if (showWattage && !form.wattage) return 'Wattage is required.'
        if (showConnector && !form.connector_type.trim()) return 'Connector type is required.'

        const price = parseWholePKR(form.price, 'Price')
        if (!price || price <= 0) return 'Price must be greater than 0.'

        const highlights = form.highlights.map(h => h.trim()).filter(Boolean)
        if (highlights.length < 1) return 'Add at least one highlight.'

        const images = normalizeImages(form.images)
        if (images.length < 1) return 'Upload at least one image.'

        return null
    }

    async function upsertLaptopModel(company, modelName, processor) {
        if (!company || !modelName) return
        const { data: existing } = await supabase
            .from('laptop_models')
            .select('id, cpus')
            .eq('company', company)
            .eq('model_name', modelName)
            .maybeSingle()

        if (!existing) {
            await supabase.from('laptop_models').insert([{
                company,
                model_name: modelName,
                cpus: processor ? [processor] : null,
                created_at: new Date().toISOString(),
            }])
            return
        }

        if (processor) {
            const list = Array.isArray(existing.cpus) ? existing.cpus : []
            if (!list.includes(processor)) {
                await supabase.from('laptop_models').update({
                    cpus: [...list, processor],
                    updated_at: new Date().toISOString(),
                }).eq('id', existing.id)
            }
        }
    }

    async function upsertProcessor(processor) {
        if (!processor) return
        const { data: existing } = await supabase
            .from('processors')
            .select('id')
            .eq('model', processor)
            .maybeSingle()

        if (existing) return

        await supabase.from('processors').insert([{
            model: processor,
            brand: inferProcessorBrand(processor),
            created_at: new Date().toISOString(),
        }])
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const err = validate()
        if (err) { setError(err); return }

        setLoading(true)
        setError('')

        const price = parseWholePKR(form.price, 'Price')
        const highlights = form.highlights.map(h => h.trim()).filter(Boolean).slice(0, 5)
        const images = normalizeImages(form.images)

        const ramValue = showRamFields ? buildRamString(form.ram_type, form.ram_size, form.ram_speed) : null
        const primaryStorage = showStorageFields
            ? buildStorageString(form.primary_storage_size, form.primary_storage_category, form.primary_storage_type)
            : ''
        const additionalStorage = showStorageFields
            ? form.additional_storage
                .map(s => buildStorageString(s.size, s.category, s.type))
                .filter(Boolean)
            : []

        const storagePayload = showStorageFields
            ? { primary: primaryStorage || null, additional: additionalStorage }
            : {}

        const gpuPayload = showGpuFields
            ? {
                integrated: form.graphics_card.trim(),
                dedicated: form.dedicated_gpu.trim() || null,
            }
            : {}

        const specsPayload = showSpecs
            ? {
                os: form.spec_os || null,
                category: form.spec_category || null,
                battery_wh: form.spec_battery_wh || null,
                battery_health: form.spec_battery_health || null,
            }
            : {}

        const brandValue = showBrand ? form.brand.trim() : 'N/A'
        const modelValue = isLaptop ? form.model.trim() : form.item_name.trim()

        const payload = {
            category: form.category,
            status: form.status,
            brand: brandValue,
            model: modelValue,
            cpu: showProcessor ? form.processor.trim() : null,
            ram: ramValue,
            storage: storagePayload,
            gpu: gpuPayload,
            screen: showScreen ? form.screen_size : null,
            condition: form.condition,
            price,
            qty: item?.qty ?? 0,
            images,
            highlights,
            specs: specsPayload,
            wattage: showWattage ? Number(form.wattage) || null : null,
            connector_type: showConnector ? form.connector_type.trim() : null,
            updated_at: new Date().toISOString(),
        }

        if (!isEdit) payload.created_at = new Date().toISOString()

        const { error: dbError } = isEdit
            ? await supabase.from('laptops').update(payload).eq('id', item.id)
            : await supabase.from('laptops').insert([payload])

        if (dbError) {
            setError(dbError.message)
            setLoading(false)
            return
        }

        if (isLaptop) {
            await upsertLaptopModel(brandValue, modelValue, form.processor.trim())
            await upsertProcessor(form.processor.trim())
        }

        setSuccess(isEdit ? 'Catalog item updated.' : 'Catalog item added.')
        setTimeout(() => router.push('/catalog'), 800)
    }

    return (
        <div className="px-4 sm:px-6 py-8 sm:py-10 max-w-[860px] mx-auto">
            <Link href="/catalog" style={{
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
                Back to catalog
            </Link>

            <div className="card p-5 sm:p-8" style={{ background: 'var(--bg-card)', borderRadius: '12px' }}>
                <div style={{ marginBottom: '28px' }}>
                    <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {isEdit ? 'Edit Catalog Item' : 'Add Catalog Item'}
                    </h1>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                        {isEdit ? 'Update catalog details and save changes.' : 'Add a new item to the live catalog.'}
                    </p>
                </div>

                {error && <div className="alert-error" style={{ marginBottom: '20px' }}>{error}</div>}
                {success && <div className="alert-success" style={{ marginBottom: '20px' }}>{success}</div>}

                <form onSubmit={handleSubmit} autoComplete="off">
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

                    {showItemName && (
                        <div style={{ marginBottom: '16px' }}>
                            <label className="form-label">Item Name *</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.item_name}
                                onChange={(e) => setForm(f => ({ ...f, item_name: e.target.value }))}
                                placeholder="e.g. Logitech MX Mouse"
                            />
                        </div>
                    )}

                    {showBrand && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <SmartInput
                                id="brand"
                                label="Brand / Company"
                                required
                                value={form.brand}
                                onChange={val => setForm(f => ({ ...f, brand: val }))}
                                onSelect={val => setForm(f => ({ ...f, brand: val }))}
                                suggestions={COMPANY_LIST}
                                placeholder="e.g. Dell, HP"
                            />
                            {showModel && (
                                <SmartInput
                                    id="model"
                                    label="Model"
                                    required
                                    value={form.model}
                                    onChange={val => { setForm(f => ({ ...f, model: val })); setError('') }}
                                    onSelect={handleModelSelect}
                                    suggestions={modelSuggestions}
                                    placeholder={form.brand ? 'Type to search models...' : 'Select company first'}
                                />
                            )}
                        </div>
                    )}

                    {showProcessor && (
                        <div style={{ marginBottom: '16px' }}>
                            <SmartInput
                                id="processor"
                                label="Processor"
                                required
                                value={form.processor}
                                onChange={val => { setForm(f => ({ ...f, processor: val })); setError('') }}
                                onSelect={handleProcessorSelect}
                                suggestions={processorSuggestions}
                                placeholder="e.g. i7-1185G7"
                            />
                        </div>
                    )}

                    {showRamFields && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="form-label">RAM Type *</label>
                                <select className="form-input" value={form.ram_type} onChange={e => setForm(f => ({ ...f, ram_type: e.target.value }))}>
                                    <option value="">Select type</option>
                                    {RAM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">RAM Size *</label>
                                <select className="form-input" value={form.ram_size} onChange={e => setForm(f => ({ ...f, ram_size: e.target.value }))}>
                                    <option value="">Select size</option>
                                    {RAM_SIZES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">RAM Speed (MHz) *</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={form.ram_speed}
                                    onChange={e => setForm(f => ({ ...f, ram_speed: e.target.value }))}
                                    placeholder="e.g. 3200"
                                />
                            </div>
                        </div>
                    )}

                    {showStorageFields && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="form-label">Primary Storage Size (GB) *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={form.primary_storage_size}
                                        onChange={e => setForm(f => ({ ...f, primary_storage_size: e.target.value }))}
                                        placeholder="e.g. 512"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Primary Storage Category *</label>
                                    <select className="form-input" value={form.primary_storage_category} onChange={e => setForm(f => ({ ...f, primary_storage_category: e.target.value }))}>
                                        <option value="">Select category</option>
                                        {STORAGE_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Primary Storage Type *</label>
                                    <select className="form-input" value={form.primary_storage_type} onChange={e => setForm(f => ({ ...f, primary_storage_type: e.target.value }))}>
                                        <option value="">Select type</option>
                                        {STORAGE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="form-label" style={{ marginBottom: 0 }}>Additional Storage (optional)</label>
                                    <button type="button" onClick={addAdditionalStorage} className="btn-xs btn-xs-green">Add Storage</button>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {form.additional_storage.map((entry, idx) => (
                                        <div key={`${idx}-storage`} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <input
                                                className="form-input"
                                                type="number"
                                                value={entry.size}
                                                onChange={e => updateAdditionalStorage(idx, 'size', e.target.value)}
                                                placeholder="Size (GB)"
                                            />
                                            <select className="form-input" value={entry.category} onChange={e => updateAdditionalStorage(idx, 'category', e.target.value)}>
                                                <option value="">Category</option>
                                                {STORAGE_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <div className="flex gap-2">
                                                <select className="form-input" value={entry.type} onChange={e => updateAdditionalStorage(idx, 'type', e.target.value)}>
                                                    <option value="">Type</option>
                                                    {STORAGE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                {form.additional_storage.length > 1 && (
                                                    <button type="button" className="btn-xs btn-xs-red" onClick={() => removeAdditionalStorage(idx)}>Remove</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {showGpuFields && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="form-label">Graphics Card *</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={form.graphics_card}
                                    onChange={e => setForm(f => ({ ...f, graphics_card: e.target.value }))}
                                    placeholder="e.g. Intel Iris Xe"
                                />
                            </div>
                            <div>
                                <label className="form-label">Dedicated Graphics (optional)</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={form.dedicated_gpu}
                                    onChange={e => setForm(f => ({ ...f, dedicated_gpu: e.target.value }))}
                                    placeholder="e.g. NVIDIA MX450"
                                />
                            </div>
                        </div>
                    )}

                    {showScreen && (
                        <div className="mb-4">
                            <label className="form-label">Screen Size *</label>
                            <select className="form-input" value={form.screen_size} onChange={e => setForm(f => ({ ...f, screen_size: e.target.value }))}>
                                <option value="">Select screen size</option>
                                {SCREEN_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    {showSpecs && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="form-label">OS</label>
                                <input className="form-input" value={form.spec_os} onChange={e => setForm(f => ({ ...f, spec_os: e.target.value }))} placeholder="e.g. Windows 11" />
                            </div>
                            <div>
                                <label className="form-label">Category</label>
                                <select className="form-input" value={form.spec_category} onChange={e => setForm(f => ({ ...f, spec_category: e.target.value }))}>
                                    <option value="">Select category</option>
                                    {SPEC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Battery (Wh)</label>
                                <input className="form-input" type="number" value={form.spec_battery_wh} onChange={e => setForm(f => ({ ...f, spec_battery_wh: e.target.value }))} placeholder="e.g. 52" />
                            </div>
                            <div>
                                <label className="form-label">Battery Health</label>
                                <input className="form-input" value={form.spec_battery_health} onChange={e => setForm(f => ({ ...f, spec_battery_health: e.target.value }))} placeholder="e.g. 85%" />
                            </div>
                        </div>
                    )}

                    {showWattage && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="form-label">Wattage (Watts) *</label>
                                <input className="form-input" type="number" value={form.wattage} onChange={e => setForm(f => ({ ...f, wattage: e.target.value }))} placeholder="e.g. 65" />
                            </div>
                            <div>
                                <label className="form-label">Connector Type *</label>
                                <input className="form-input" value={form.connector_type} onChange={e => setForm(f => ({ ...f, connector_type: e.target.value }))} placeholder="e.g. USB-C" />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="form-label">Condition *</label>
                            <select className="form-input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                                {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Price (PKR) *</label>
                            <input className="form-input" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 85000" min="0" step="500" />
                        </div>
                        <div>
                            <label className="form-label">Status *</label>
                            <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="form-label">Highlights (max 5) *</label>
                        <div className="grid grid-cols-1 gap-2">
                            {form.highlights.map((value, idx) => (
                                <div key={`hl-${idx}`} className="flex gap-2">
                                    <input
                                        className="form-input"
                                        value={value}
                                        onChange={e => updateHighlights(idx, e.target.value)}
                                        placeholder={`Highlight ${idx + 1}`}
                                    />
                                    {form.highlights.length > 1 && (
                                        <button type="button" className="btn-xs btn-xs-red" onClick={() => removeHighlight(idx)}>Remove</button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {form.highlights.length < 5 && (
                            <button type="button" className="btn-xs btn-xs-green mt-2" onClick={addHighlight}>Add Highlight</button>
                        )}
                    </div>

                    <CatalogImagesInput
                        supabase={supabase}
                        brand={form.brand || 'misc'}
                        model={form.model || form.item_name || 'item'}
                        images={form.images}
                        onChange={(images) => setForm(f => ({ ...f, images }))}
                        label="Catalog Images"
                        hint="Upload 1-3 JPG images. Links are stored with the catalog item."
                    />

                    <div className="flex gap-2">
                        <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth: '140px', justifyContent: 'center' }}>
                            {loading ? <div className="spinner" /> : (isEdit ? 'Save Changes' : 'Add to Catalog')}
                        </button>
                        <Link href="/catalog" className="btn-secondary no-underline">Cancel</Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
