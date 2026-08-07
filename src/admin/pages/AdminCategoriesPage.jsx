import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import {
  categoryDeleteErrorMessage,
  removeCategoryFromList,
} from '../../lib/adminCategoryDelete.js'

function formatInr(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(v)
  } catch {
    return `₹${v}`
  }
}

function formatPurchased(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '—'
  return formatInr(v)
}

export function AdminCategoriesPage() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminService.categoriesOverview()
      setItems(Array.isArray(result.categories) ? result.categories : [])
    } catch (e) {
      setError(getFetchErrorMessage(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setSaving(true)
    setError(null)
    try {
      await adminService.createCategory(n)
      setName('')
      await load()
    } catch (err) {
      setError(getFetchErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete category “${row.name}” (${row.id})? This permanently removes it. Categories with products cannot be deleted.`))
      return
    setBusyId(row.id)
    setError(null)
    try {
      await adminService.removeCategory(row.id)
      if (expandedId === row.id) setExpandedId(null)
      setItems((prev) => removeCategoryFromList(prev, row.id))
    } catch (err) {
      setError(categoryDeleteErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function toggleExpand(id) {
    setExpandedId((x) => (x === id ? null : id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-fog sm:text-3xl">
          Categories
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-mist">
          Product counts, order revenue by group, and who created each category. New names typed when adding a product
          are created automatically on save.
        </p>
      </div>

      <form
        onSubmit={add}
        className="admin-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="cat-name" className="font-sans text-xs font-semibold uppercase tracking-wide text-mist">
            New category name
          </label>
          <input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Brakes"
            className="admin-input mt-1.5 w-full px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-xl bg-accent px-5 py-2.5 font-sans text-sm font-semibold text-on-accent shadow-md transition-[transform,filter] hover:brightness-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">{error}</div>
      )}

      {loading && items.length === 0 ? (
        <p className="font-mono text-xs text-mist">Loading categories…</p>
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-steel/50 font-sans text-xs font-semibold uppercase tracking-wide text-mist">
                  <th className="w-10 px-3 py-3 font-medium" aria-label="Expand" />
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium text-right">Products</th>
                  <th className="px-4 py-3 font-medium text-right">Purchased</th>
                  <th className="px-4 py-3 font-medium">Added by</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel/40">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-mist">
                      No categories.
                    </td>
                  </tr>
                )}
                {items.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="text-mist hover:bg-steel/25">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(c.id)}
                          className="rounded-lg p-1 text-mist hover:bg-steel/50 hover:text-fog"
                          aria-expanded={expandedId === c.id}
                          title={expandedId === c.id ? 'Collapse' : 'Show products'}
                        >
                          {expandedId === c.id ? (
                            <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                          ) : (
                            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-fog">
                        <span>{c.name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-mist">{c.id}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-fog">{c.productCount ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-accent">
                        {formatPurchased(c.purchasedValueInr)}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-mist">
                        {c.createdByAdminEmail || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => remove(c)}
                          className="rounded-lg p-2 text-mist hover:bg-flare-muted hover:text-flare disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr className="admin-row-muted">
                        <td colSpan={7} className="px-4 py-4">
                          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-mist">
                            Products in “{c.name}”
                          </p>
                          {(c.products?.length ?? 0) === 0 ? (
                            <p className="font-sans text-xs text-mist">No products in this category.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-steel/50 bg-slate/35">
                              <table className="w-full min-w-[640px] text-left text-xs">
                                <thead>
                                  <tr className="border-b border-steel/40 font-sans text-[10px] font-semibold uppercase tracking-wide text-mist">
                                    <th className="px-3 py-2">Name</th>
                                    <th className="px-3 py-2">SKU</th>
                                    <th className="px-3 py-2 text-right">Price</th>
                                    <th className="px-3 py-2 text-center">Live</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-steel/30">
                                  {c.products.map((p) => (
                                    <tr key={p.id} className="text-mist">
                                      <td className="px-3 py-2 text-fog">{p.name}</td>
                                      <td className="px-3 py-2 font-mono">{p.sku}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{formatInr(p.priceInr)}</td>
                                      <td className="px-3 py-2 text-center font-mono text-[10px]">
                                        {p.published ? (
                                          <span className="text-accent">Yes</span>
                                        ) : (
                                          <span className="text-mist">No</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
