'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardBody, Button, Input, Select } from '@roomlink/ui'
import { ImageUp } from 'lucide-react'

type Category = { category_id: string; name: string }

type ExtractedItem = {
  name: string
  description?: string
  price: number
  isVeg?: boolean
}

type ReviewRow = ExtractedItem & {
  rowId: string
  included: boolean
  categoryId: string
}

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85

/** Downscales/re-encodes the photo in-browser so the upload stays well under serverless request-size limits — a phone photo can be several MB, this brings it to a few hundred KB. */
async function resizeImageToJpegBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = dataUrl
  })

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser does not support image processing')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]
}

export function MenuImageImport({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReviewRow[] | null>(null)

  async function onFileSelected(file: File | undefined) {
    if (!file) return
    setError(null)
    setExtracting(true)
    setRows(null)
    try {
      const base64 = await resizeImageToJpegBase64(file)
      const res = await fetch('/api/v1/hotel/menu/items/extract-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not read that image.')
        return
      }
      setRows(
        (data.items as ExtractedItem[]).map((item, i) => ({
          ...item,
          rowId: `${Date.now()}-${i}`,
          included: true,
          categoryId: '',
        }))
      )
    } catch {
      setError('Could not read that image.')
    } finally {
      setExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function updateRow(rowId: string, patch: Partial<ReviewRow>) {
    setRows((prev) => (prev ? prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)) : prev))
  }

  function removeRow(rowId: string) {
    setRows((prev) => (prev ? prev.filter((r) => r.rowId !== rowId) : prev))
  }

  const includedRows = rows?.filter((r) => r.included) ?? []
  const canSubmit = includedRows.length > 0 && includedRows.every((r) => r.name.trim() && r.categoryId && r.price >= 0)

  async function submitRows() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/hotel/menu/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          includedRows.map((r) => ({
            categoryId: r.categoryId,
            name: r.name.trim(),
            description: r.description ?? '',
            price: r.price,
            isVeg: r.isVeg,
          }))
        ),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Could not add those items.')
        return
      }
      setRows(null)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900">Import from photo</h2>
        <p className="text-xs text-slate-500">Upload a photo of your menu and Claude will read off the items for you to review.</p>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {!rows && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onFileSelected(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="h-4 w-4" aria-hidden />
              {extracting ? 'Reading menu…' : 'Upload menu photo'}
            </Button>
          </div>
        )}

        {rows && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Found {rows.length} item{rows.length === 1 ? '' : 's'}. Review, pick a category for each, then add them to the menu.
            </p>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.rowId} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12 sm:items-center sm:gap-3">
                  <div className="flex items-center gap-2 sm:col-span-1">
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={(e) => updateRow(row.rowId, { included: e.target.checked })}
                      aria-label={`Include ${row.name}`}
                    />
                  </div>
                  <Input
                    className="sm:col-span-3"
                    value={row.name}
                    onChange={(e) => updateRow(row.rowId, { name: e.target.value })}
                    placeholder="Item name"
                  />
                  <Input
                    className="sm:col-span-2"
                    type="number"
                    min="0"
                    value={row.price}
                    onChange={(e) => updateRow(row.rowId, { price: Number(e.target.value) })}
                    placeholder="Price"
                  />
                  <Select
                    className="sm:col-span-3"
                    value={row.categoryId}
                    onChange={(e) => updateRow(row.rowId, { categoryId: e.target.value })}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    className="sm:col-span-2"
                    value={row.isVeg === undefined ? '' : row.isVeg ? 'veg' : 'non-veg'}
                    onChange={(e) =>
                      updateRow(row.rowId, {
                        isVeg: e.target.value === '' ? undefined : e.target.value === 'veg',
                      })
                    }
                  >
                    <option value="">Unspecified</option>
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-vegetarian</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    className="text-xs text-slate-400 hover:text-red-600 sm:col-span-1 sm:text-right"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {categories.length === 0 && (
              <p className="text-xs text-amber-600">Add at least one category above before importing items.</p>
            )}

            <div className="flex gap-2">
              <Button disabled={!canSubmit || submitting} onClick={submitRows}>
                {submitting ? 'Adding…' : `Add ${includedRows.length} item${includedRows.length === 1 ? '' : 's'} to menu`}
              </Button>
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => setRows(null)}>
                Start over
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
