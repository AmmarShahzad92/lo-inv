'use client'

import { useState } from 'react'
import {
  MAX_CATALOG_IMAGES,
  mergeImages,
  normalizeImages,
  uploadCatalogImages,
} from '@/lib/catalogImages'

export default function CatalogImagesInput({
  supabase,
  brand,
  model,
  images,
  onChange,
  label = 'Catalog Images',
  hint = 'Add up to 3 JPG images for the catalog listing.',
  maxImages = MAX_CATALOG_IMAGES,
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState([])

  const normalized = normalizeImages(images, maxImages)
  const slots = Array.from({ length: maxImages }, (_, i) => normalized[i] || '')

  function updateSlot(index, value) {
    const next = slots.map((slot, i) => (i === index ? value : slot))
    onChange(normalizeImages(next, maxImages))
  }

  async function handleUpload() {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    if (!files.length) {
      setError('Select image files to upload.')
      return
    }
    setError('')
    setUploading(true)
    const { urls, error: uploadError } = await uploadCatalogImages({
      supabase,
      files,
      brand,
      model,
    })
    setUploading(false)
    if (uploadError) {
      setError(uploadError)
      return
    }
    const merged = mergeImages(normalized, urls, maxImages)
    onChange(merged)
    setFiles([])
  }

  return (
    <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[11px] text-[var(--text-muted)] mb-2">{hint}</div>

      <div className="grid grid-cols-1 gap-2 mb-2">
        {slots.map((value, idx) => (
          <input
            key={idx}
            className="form-input"
            value={value}
            onChange={(e) => updateSlot(idx, e.target.value)}
            placeholder={`Image URL ${idx + 1} (optional)`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="form-input"
          type="file"
          accept=".jpg,.jpeg,image/jpeg"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="btn-secondary"
          style={{ minWidth: '140px' }}
        >
          {uploading ? 'Uploading...' : 'Upload Images'}
        </button>
      </div>

      {error && (
        <div className="alert-error mt-2 text-[12px] py-2 px-3">{error}</div>
      )}
    </div>
  )
}
