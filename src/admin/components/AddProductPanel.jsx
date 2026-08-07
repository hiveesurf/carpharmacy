import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2 } from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import { imageFileToCompressedDataUrl } from '../../lib/compressImage.js'
import {
  carIdentityKey,
  dedupeBrandLabelsFromCars,
  normalizeCarBrand,
  normalizeCarText,
} from '../../lib/carIdentityNormalize.js'
import { SaveSuccessNotice } from './SaveSuccessNotice.jsx'

const MAX_RAW_FILE = 12 * 1024 * 1024

/**
 * @param {{ onCreated?: (product: unknown) => void, openTrigger?: number, variant?: 'panel' | 'page', onSuccess?: (product: unknown) => void }} props
 */
export function AddProductPanel({ onCreated, openTrigger = 0, variant = 'panel', onSuccess }) {
  const isPage = variant === 'page'
  const [open, setOpen] = useState(false)
  const expanded = isPage || open
  const [categories, setCategories] = useState([])
  const [cars, setCars] = useState([])
  const [selectedCarIds, setSelectedCarIds] = useState([])
  const [catLoading, setCatLoading] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [brand, setBrand] = useState('')
  const [unitVolume, setUnitVolume] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [stockIn, setStockIn] = useState('0')
  const [stockOut, setStockOut] = useState('0')
  const [primaryUploadDataUrl, setPrimaryUploadDataUrl] = useState('')
  const [primaryBusy, setPrimaryBusy] = useState(false)
  const [extraPhotos, setExtraPhotos] = useState([])
  const [extrasBusy, setExtrasBusy] = useState(false)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false)
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleVariant, setVehicleVariant] = useState('')
  const [vehicleFuel, setVehicleFuel] = useState('')
  const [vehicleError, setVehicleError] = useState('')
  const [makeComboOpen, setMakeComboOpen] = useState(false)
  const [makeInput, setMakeInput] = useState('')
  const [makeHighlight, setMakeHighlight] = useState(-1)
  const makeComboRef = useRef(null)
  const vehicleMakeRef = useRef(vehicleMake)
  vehicleMakeRef.current = vehicleMake
  const [carFormOpen, setCarFormOpen] = useState(false)
  const [carBusy, setCarBusy] = useState(false)
  const [carMsg, setCarMsg] = useState(null)
  const [carFormOptions, setCarFormOptions] = useState({ fuels: [], transmissions: [] })
  const [newCar, setNewCar] = useState({
    make: '',
    model: '',
    variant: '',
    modelYear: '',
    fuel: '',
    transmission: '',
    engineCc: '',
    notes: '',
    published: true,
  })

  const inputClass =
    'w-full border border-steel/80 bg-ink/40 px-3 py-2 font-sans text-sm text-fog outline-none focus:border-accent/60'

  /** Opaque white surface for vehicle compatibility native selects (browser list is OS-rendered). */
  const vehicleCompatSelectClass =
    'w-full border border-steel/80 bg-[#ffffff] px-3 py-2 font-sans text-sm text-neutral-900 opacity-100 outline-none focus:border-accent/60'

  const sectionTitleClass = 'font-display text-xs font-bold uppercase tracking-wide text-fog'
  const labelClass = 'mb-1 block font-mono text-[10px] uppercase tracking-wider text-hud'

  const inQty = useMemo(() => Math.max(0, Number(stockIn) || 0), [stockIn])
  const outQty = useMemo(() => Math.max(0, Number(stockOut) || 0), [stockOut])
  const currentStock = useMemo(() => inQty - outQty, [inQty, outQty])
  const selectedCars = useMemo(() => {
    if (!Array.isArray(cars) || cars.length === 0 || selectedCarIds.length === 0) return []
    const selected = new Set(selectedCarIds.map((id) => String(id)))
    return cars.filter((car) => selected.has(String(car?.id ?? '')))
  }, [cars, selectedCarIds])
  const uniqueSorted = useCallback((values) => {
    return [...new Set(values.filter((v) => v != null && String(v).trim() !== '').map((v) => String(v).trim()))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [])
  // Brand/make: case-insensitive dedupe for UI only; each car row stays separate by id in DB and compatibleCarIds.
  const makeOptions = useMemo(() => dedupeBrandLabelsFromCars(cars), [cars])
  const filteredMakeOptions = useMemo(() => {
    const q = makeInput.trim().toLowerCase()
    if (!q) return makeOptions
    return makeOptions.filter((m) => m.toLowerCase().includes(q))
  }, [makeInput, makeOptions])
  const carsByMake = useMemo(() => {
    if (!vehicleMake) return []
    const makeKey = carIdentityKey(vehicleMake)
    return cars.filter((car) => carIdentityKey(car.make) === makeKey)
  }, [cars, vehicleMake])
  const modelOptions = useMemo(() => uniqueSorted(carsByMake.map((car) => car.model)), [carsByMake, uniqueSorted])
  const carsByMakeModel = useMemo(() => {
    if (!vehicleMake || !vehicleModel) return []
    const makeKey = carIdentityKey(vehicleMake)
    return cars.filter(
      (car) =>
        carIdentityKey(car.make) === makeKey && String(car.model || '').trim() === vehicleModel,
    )
  }, [cars, vehicleMake, vehicleModel])
  const yearOptions = useMemo(() => uniqueSorted(carsByMakeModel.map((car) => car.modelYear)), [carsByMakeModel, uniqueSorted])
  const variantOptions = useMemo(() => uniqueSorted(carsByMakeModel.map((car) => car.variant)), [carsByMakeModel, uniqueSorted])
  const fuelOptions = useMemo(() => uniqueSorted(carsByMakeModel.map((car) => car.fuel)), [carsByMakeModel, uniqueSorted])

  const loadCategories = useCallback(async () => {
    setCatLoading(true)
    try {
      const list = await adminService.listCategories()
      setCategories(list)
      setCategoryName((prev) => (prev.trim() ? prev : list[0]?.name || ''))
    } catch {
      setCategories([])
    } finally {
      setCatLoading(false)
    }
  }, [])

  const loadCars = useCallback(async () => {
    try {
      const list = await adminService.listCars()
      const activeCars = Array.isArray(list)
        ? list.filter((car) => {
            const status = String(car?.status || '').trim().toLowerCase()
            return !(
              car?.deleted === true ||
              car?.isDeleted === true ||
              Boolean(car?.deletedAt) ||
              status === 'deleted'
            )
          })
        : []
      setCars(activeCars)
    } catch {
      setCars([])
    }
  }, [])

  useEffect(() => {
    if (!isPage && openTrigger > 0) setOpen(true)
  }, [openTrigger, isPage])

  useEffect(() => {
    if (expanded) {
      loadCategories()
      loadCars()
      ;(async () => {
        try {
          const o = await adminService.listCarFormOptions()
          setCarFormOptions(o)
        } catch {
          setCarFormOptions({ fuels: [], transmissions: [] })
        }
      })()
    }
  }, [expanded, loadCategories, loadCars])

  useEffect(() => {
    if (!msg?.text) return undefined
    const timeoutMs = msg.type === 'ok' ? 4000 : 7000
    const timer = window.setTimeout(() => {
      setMsg(null)
    }, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [msg])

  useEffect(() => {
    if (!carMsg?.text) return undefined
    const timeoutMs = carMsg.type === 'ok' ? 4000 : 7000
    const timer = window.setTimeout(() => {
      setCarMsg(null)
    }, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [carMsg])

  useEffect(() => {
    if (!makeComboOpen) {
      setMakeInput(vehicleMake)
    }
  }, [vehicleMake, makeComboOpen])

  useEffect(() => {
    if (!makeComboOpen) return undefined
    function onDocMouseDown(e) {
      if (makeComboRef.current && !makeComboRef.current.contains(e.target)) {
        setMakeComboOpen(false)
        setMakeHighlight(-1)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [makeComboOpen])

  const makeMenuRows = useMemo(() => {
    return [{ kind: 'clear' }, ...filteredMakeOptions.map((value) => ({ kind: 'make', value }))]
  }, [filteredMakeOptions])

  async function onPickPrimaryFile(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    if (f.size > MAX_RAW_FILE) {
      setMsg({ type: 'err', text: 'Image too large before compression (max 12MB file).' })
      return
    }
    setPrimaryBusy(true)
    setMsg(null)
    try {
      const dataUrl = await imageFileToCompressedDataUrl(f)
      setPrimaryUploadDataUrl(dataUrl)
      setMsg({ type: 'ok', text: 'Primary image compressed and ready to save.' })
    } catch (err) {
      setMsg({ type: 'err', text: err?.message || 'Could not process image.' })
    } finally {
      setPrimaryBusy(false)
    }
  }

  async function onPickExtraFiles(ev) {
    const files = ev.target.files ? Array.from(ev.target.files) : []
    ev.target.value = ''
    if (!files.length) return
    const bad = files.find((f) => !f.type.startsWith('image/'))
    if (bad) {
      setMsg({ type: 'err', text: 'Only image files are allowed.' })
      return
    }
    const big = files.find((f) => f.size > MAX_RAW_FILE)
    if (big) {
      setMsg({ type: 'err', text: `“${big.name}” is too large (max 12MB per file).` })
      return
    }
    setExtrasBusy(true)
    setMsg(null)
    try {
      const next = []
      for (const f of files) {
        const dataUrl = await imageFileToCompressedDataUrl(f)
        next.push({
          id: crypto.randomUUID(),
          dataUrl,
          fileName: f.name,
        })
      }
      setExtraPhotos((prev) => [...prev, ...next])
      setMsg({ type: 'ok', text: `Added ${next.length} photo(s).` })
    } catch (err) {
      setMsg({ type: 'err', text: err?.message || 'Could not process images.' })
    } finally {
      setExtrasBusy(false)
    }
  }

  function removeExtra(id) {
    setExtraPhotos((prev) => prev.filter((x) => x.id !== id))
  }

  function clearPrimaryUpload() {
    setPrimaryUploadDataUrl('')
  }

  function resetFormAfterCreate() {
    setSku('')
    setName('')
    setPartNumber('')
    setBrand('')
    setUnitVolume('')
    setSupplierName('')
    setPurchasePrice('')
    setSellingPrice('')
    setStockIn('0')
    setStockOut('0')
    setPrimaryUploadDataUrl('')
    setExtraPhotos([])
    setDescription('')
    setSelectedCarIds([])
    setVehicleMake('')
    setVehicleModel('')
    setVehicleYear('')
    setVehicleVariant('')
    setVehicleFuel('')
    setVehicleError('')
    setMakeComboOpen(false)
    setMakeHighlight(-1)
  }

  function onNonNegativeNumber(setter) {
    return (e) => {
      const next = e.target.value
      if (next === '') {
        setter('')
        return
      }
      const n = Number(next)
      if (Number.isNaN(n)) return
      setter(String(Math.max(0, n)))
    }
  }

  function onVehicleMakeChange(nextMake) {
    setVehicleMake(nextMake)
    setVehicleModel('')
    setVehicleYear('')
    setVehicleVariant('')
    setVehicleFuel('')
    setVehicleError('')
  }

  function pickVehicleMake(nextMake) {
    onVehicleMakeChange(nextMake)
    setMakeComboOpen(false)
    setMakeHighlight(-1)
    setMakeInput(nextMake)
  }

  function onVehicleModelChange(nextModel) {
    setVehicleModel(nextModel)
    setVehicleYear('')
    setVehicleVariant('')
    setVehicleFuel('')
    setVehicleError('')
  }

  function addVehicleSelection() {
    setVehicleError('')
    if (!vehicleMake || !vehicleModel) {
      setVehicleError('Select at least Vehicle Make and Vehicle Model.')
      return
    }
    const makeKey = carIdentityKey(vehicleMake)
    const matches = cars.filter((car) => {
      if (carIdentityKey(car.make) !== makeKey) return false
      if (String(car.model || '').trim() !== vehicleModel) return false
      if (vehicleYear && String(car.modelYear ?? '').trim() !== vehicleYear) return false
      if (vehicleVariant && String(car.variant || '').trim() !== vehicleVariant) return false
      if (vehicleFuel && String(car.fuel || '').trim() !== vehicleFuel) return false
      return true
    })
    const picked = matches[0]
    if (!picked) {
      setVehicleError('No matching car found for the selected combination.')
      return
    }
    const pickedId = String(picked.id)
    if (selectedCarIds.includes(pickedId)) {
      setVehicleError('This vehicle is already selected.')
      return
    }
    setSelectedCarIds((prev) => [...prev, pickedId])
  }

  function removeSelectedVehicle(id) {
    setSelectedCarIds((prev) => prev.filter((x) => x !== id))
  }

  function resetNewCarForm() {
    setNewCar({
      make: '',
      model: '',
      variant: '',
      modelYear: '',
      fuel: '',
      transmission: '',
      engineCc: '',
      notes: '',
      published: true,
    })
  }

  async function submitNewCar(e) {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const make = normalizeCarBrand(newCar.make)
    const model = normalizeCarText(newCar.model)
    const variant = normalizeCarText(newCar.variant)
    if (!make || !model) {
      setCarMsg({ type: 'err', text: 'Brand and model are required to create a car.' })
      return
    }

    setCarBusy(true)
    setCarMsg(null)
    setVehicleError('')
    if (!carFormOptions.fuels?.length || !carFormOptions.transmissions?.length) {
      setCarMsg({ type: 'err', text: 'Fuel and transmission options could not be loaded. Close and reopen Add inventory, then try again.' })
      setCarBusy(false)
      return
    }
    const fuelTrim = newCar.fuel.trim()
    const txTrim = newCar.transmission.trim()
    if (!fuelTrim) {
      setCarMsg({ type: 'err', text: 'Fuel is required to create a car.' })
      setCarBusy(false)
      return
    }
    if (!carFormOptions.fuels.some((o) => o.label === fuelTrim)) {
      setCarMsg({ type: 'err', text: 'Select a valid fuel from the list.' })
      setCarBusy(false)
      return
    }
    if (txTrim && !carFormOptions.transmissions.some((o) => o.label === txTrim)) {
      setCarMsg({ type: 'err', text: 'Select a valid transmission from the list or leave it blank.' })
      setCarBusy(false)
      return
    }
    try {
      const createdCar = await adminService.createCar({
        brandName: make,
        make,
        model,
        variant: variant || null,
        modelYear: newCar.modelYear ? Number(newCar.modelYear) : null,
        fuel: fuelTrim,
        transmission: txTrim || null,
        engineCc: newCar.engineCc ? Number(newCar.engineCc) : null,
        notes: newCar.notes.trim() || null,
        published: Boolean(newCar.published),
      })

      const createdId = createdCar?.id != null ? String(createdCar.id) : ''
      if (!createdId) {
        throw new Error('Could not identify created car id.')
      }

      setCars((prev) => {
        const nextCar = { ...createdCar, id: createdId }
        const filtered = prev.filter((car) => String(car?.id ?? '') !== createdId)
        return [nextCar, ...filtered]
      })
      setSelectedCarIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]))

      await loadCars()
      setCarFormOpen(false)
      resetNewCarForm()
      setCarMsg({ type: 'ok', text: 'Car created and selected successfully.' })
    } catch (err) {
      setCarMsg({ type: 'err', text: getFetchErrorMessage(err) })
    } finally {
      setCarBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const cat = categoryName.trim()
    if (!cat) {
      setMsg({ type: 'err', text: 'Choose a category.' })
      setBusy(false)
      return
    }

    if (currentStock < 0) {
      setMsg({ type: 'err', text: 'Current stock cannot be negative. Increase stock in or reduce stock out.' })
      setBusy(false)
      return
    }

    const uploadedPrimary = primaryUploadDataUrl.trim()
    const fromFiles = extraPhotos.map((x, i) => ({
      src: x.dataUrl,
      alt: x.fileName || `Photo ${i + 1}`,
    }))
    let primaryImageUrl = uploadedPrimary
    let galleryExtras = []

    if (!primaryImageUrl && fromFiles.length > 0) {
      primaryImageUrl = fromFiles[0].src
      galleryExtras = [...fromFiles.slice(1)]
    } else {
      galleryExtras = [...fromFiles]
    }

    const body = {
      type: 'part',
      category: cat,
      sku: sku.trim(),
      name: name.trim(),
      partNumber: partNumber.trim(),
      brand: brand.trim(),
      unitVolume: unitVolume.trim(),
      supplierName: supplierName.trim(),
      price: Number(sellingPrice) || 0,
      purchasePrice: Number(purchasePrice) || 0,
      totalStock: currentStock,
      published: true,
      compatibleCarIds: selectedCarIds,
      metadata: {
        stockIn: inQty,
        stockOut: outQty,
      },
    }
    if (description.trim()) body.description = description.trim()
    if (primaryImageUrl) body.primaryImageUrl = primaryImageUrl
    if (galleryExtras.length) body.galleryExtras = galleryExtras

    try {
      console.log('Add Product payload:', body)
      const product = await adminService.createProduct(body)
      if (product) {
        onCreated?.(product)
        if (isPage) {
          onSuccess?.(product)
        } else {
          resetFormAfterCreate()
          setOpen(false)
          setSaveSuccessOpen(true)
        }
      }
    } catch (err) {
      setMsg({ type: 'err', text: getFetchErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const formBody = expanded ? (
        <div className={isPage ? '' : 'border-t border-steel/50 px-4 pb-5 pt-2 md:px-5'}>
          {msg && (
            <p
              className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                msg.type === 'ok'
                  ? 'border-accent/40 bg-accent-muted text-fog'
                  : 'border-flare/40 bg-flare-muted text-fog'
              }`}
            >
              {msg.text}
            </p>
          )}

          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="md:col-span-2 xl:col-span-1">
                <label className={labelClass}>Category</label>
                <select required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} disabled={busy || catLoading} className={inputClass}>
                  <option value="">{catLoading ? 'Loading catalog…' : 'Select product category'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>SKU</label>
                <input
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Enter unique SKU"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Part Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Part Number</label>
                <input
                  type="text"
                  required
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="Enter part number"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Brand</label>
                <input
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Enter brand name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Unit/Volume</label>
                <input
                  required
                  value={unitVolume}
                  onChange={(e) => setUnitVolume(e.target.value)}
                  placeholder="Enter unit or volume (e.g. 1L, 4 pcs)"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Supplier Name</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Purchase Price</label>
                <input
                  required
                  type="number"
                  min={0}
                  step="1"
                  value={purchasePrice}
                  onChange={onNonNegativeNumber(setPurchasePrice)}
                  placeholder="Enter purchase price"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Selling Price (INR)</label>
                <input
                  required
                  type="number"
                  min={0}
                  step="1"
                  value={sellingPrice}
                  onChange={onNonNegativeNumber(setSellingPrice)}
                  placeholder="Enter selling price"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Stock In</label>
                <input
                  required
                  type="number"
                  min={0}
                  step="1"
                  value={stockIn}
                  onChange={onNonNegativeNumber(setStockIn)}
                  placeholder="Enter opening stock"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Stock Out</label>
                <input
                  required
                  type="number"
                  min={0}
                  step="1"
                  value={stockOut}
                  onChange={onNonNegativeNumber(setStockOut)}
                  placeholder="Enter stock out quantity"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`${labelClass} text-accent`}>Current Stock</label>
                <input
                  readOnly
                  value={currentStock}
                  placeholder="Calculated from stock in minus stock out"
                  className={`${inputClass} border-accent/40 bg-accent-muted/30 font-semibold text-accent`}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-steel/50 bg-ink/10 p-3">
              <div className="flex items-center justify-between">
                <h3 className={sectionTitleClass}>Vehicle Compatibility</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-mist">
                  {selectedCars.length} selected
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div ref={makeComboRef} className="relative">
                  <label className={labelClass}>Vehicle Make</label>
                  <div className="relative">
                    <input
                      type="text"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={makeComboOpen}
                      aria-controls="admin-vehicle-make-listbox"
                      aria-autocomplete="list"
                      placeholder="Select car brand"
                      value={makeComboOpen ? makeInput : vehicleMake}
                      onChange={(e) => {
                        setMakeInput(e.target.value)
                        setMakeComboOpen(true)
                        setMakeHighlight(-1)
                      }}
                      onFocus={() => {
                        setMakeInput(vehicleMake)
                        setMakeComboOpen(true)
                        setMakeHighlight(-1)
                      }}
                      onBlur={() => {
                        window.requestAnimationFrame(() => {
                          if (makeComboRef.current?.contains(document.activeElement)) return
                          setMakeComboOpen(false)
                          setMakeHighlight(-1)
                          setMakeInput(vehicleMakeRef.current)
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setMakeComboOpen(false)
                          setMakeHighlight(-1)
                          setMakeInput(vehicleMake)
                          return
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setMakeComboOpen(true)
                          setMakeHighlight((h) => {
                            const max = makeMenuRows.length - 1
                            if (max < 0) return -1
                            return h < 0 ? 0 : Math.min(h + 1, max)
                          })
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setMakeComboOpen(true)
                          setMakeHighlight((h) => {
                            const max = makeMenuRows.length - 1
                            if (max < 0) return -1
                            if (h < 0) return max
                            return Math.max(h - 1, 0)
                          })
                          return
                        }
                        if (e.key === 'Enter') {
                          if (!makeComboOpen) {
                            e.preventDefault()
                            setMakeComboOpen(true)
                            setMakeInput(vehicleMake)
                            return
                          }
                          e.preventDefault()
                          const row = makeMenuRows[makeHighlight]
                          if (row?.kind === 'clear') {
                            pickVehicleMake('')
                            return
                          }
                          if (row?.kind === 'make') {
                            pickVehicleMake(row.value)
                            return
                          }
                          if (filteredMakeOptions.length === 1) {
                            pickVehicleMake(filteredMakeOptions[0])
                          }
                        }
                      }}
                      className={`${inputClass} pr-9`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={makeComboOpen ? 'Close make list' : 'Open make list'}
                      className="absolute right-0 top-0 flex h-full items-center px-2 text-mist hover:text-fog"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => {
                        setMakeComboOpen((open) => {
                          const next = !open
                          if (next) {
                            setMakeInput(vehicleMake)
                            setMakeHighlight(-1)
                          }
                          return next
                        })
                      }}
                    >
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${makeComboOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {makeComboOpen ? (
                    <ul
                      id="admin-vehicle-make-listbox"
                      role="listbox"
                      className="absolute left-0 right-0 z-[60] mt-1 max-h-48 overflow-auto rounded-lg border border-steel/80 bg-[#ffffff] py-1 font-sans text-sm text-neutral-900 opacity-100 shadow-lg [backdrop-filter:none]"
                    >
                      {makeMenuRows.map((row, idx) => {
                        if (row.kind === 'clear') {
                          const active = makeHighlight === idx
                          return (
                            <li key="__clear" role="presentation">
                              <button
                                type="button"
                                role="option"
                                tabIndex={-1}
                                aria-selected={!vehicleMake}
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => pickVehicleMake('')}
                                className={`w-full px-3 py-2 text-left hover:bg-neutral-100 ${active ? 'bg-neutral-100 font-medium' : ''}`}
                              >
                                Select car brand
                              </button>
                            </li>
                          )
                        }
                        const active = makeHighlight === idx
                        return (
                          <li key={row.value} role="presentation">
                            <button
                              type="button"
                              role="option"
                              tabIndex={-1}
                              aria-selected={vehicleMake === row.value}
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => pickVehicleMake(row.value)}
                              className={`w-full px-3 py-2 text-left hover:bg-neutral-100 ${active ? 'bg-neutral-100 font-medium' : ''}`}
                            >
                              {row.value}
                            </button>
                          </li>
                        )
                      })}
                      {filteredMakeOptions.length === 0 && makeInput.trim() !== '' ? (
                        <li className="px-3 py-2 text-xs text-neutral-600">No matching makes.</li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Vehicle Model</label>
                  <select value={vehicleModel} onChange={(e) => onVehicleModelChange(e.target.value)} disabled={!vehicleMake} className={vehicleCompatSelectClass}>
                    <option value="">{vehicleMake ? 'Select car model' : 'Select car brand first'}</option>
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Year</label>
                  <select value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} disabled={!vehicleModel} className={vehicleCompatSelectClass}>
                    <option value="">{vehicleModel ? 'Select manufacturing year' : 'Select car model first'}</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Vehicle Variant</label>
                  <select value={vehicleVariant} onChange={(e) => setVehicleVariant(e.target.value)} disabled={!vehicleModel} className={vehicleCompatSelectClass}>
                    <option value="">{vehicleModel ? 'Select variant' : 'Select car model first'}</option>
                    {variantOptions.map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Vehicle Fuel</label>
                  <select value={vehicleFuel} onChange={(e) => setVehicleFuel(e.target.value)} disabled={!vehicleModel} className={vehicleCompatSelectClass}>
                    <option value="">{vehicleModel ? 'Select fuel type' : 'Select car model first'}</option>
                    {fuelOptions.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {fuel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCarFormOpen((v) => !v)
                    setCarMsg(null)
                    setVehicleError('')
                  }}
                  className="mr-2 rounded-lg border border-steel/70 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mist hover:border-hud/60 hover:text-hud"
                >
                  {carFormOpen ? 'Cancel New Car' : 'Add New Car'}
                </button>
                <button
                  type="button"
                  onClick={addVehicleSelection}
                  className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-accent hover:bg-accent/20"
                >
                  Add Vehicle
                </button>
              </div>
              {carFormOpen ? (
                <div
                  className="space-y-3 rounded-lg border border-steel/40 bg-ink/20 p-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-hud">
                    Create car inline
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input
                      required
                      placeholder="Enter car brand"
                      value={newCar.make}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, make: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      required
                      placeholder="Enter car model name"
                      value={newCar.model}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, model: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      placeholder="Enter variant"
                      value={newCar.variant}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, variant: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      placeholder="Enter manufacturing year"
                      value={newCar.modelYear}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, modelYear: e.target.value }))}
                      className={inputClass}
                    />
                    <select
                      value={newCar.fuel}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, fuel: e.target.value }))}
                      className={inputClass}
                      aria-label="Fuel"
                    >
                      <option value="">Select fuel type</option>
                      {(carFormOptions.fuels || []).map((o) => (
                        <option key={o.label} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newCar.transmission}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, transmission: e.target.value }))}
                      className={inputClass}
                      aria-label="Transmission"
                    >
                      <option value="">Select transmission type</option>
                      {(carFormOptions.transmissions || []).map((o) => (
                        <option key={o.label} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      placeholder="Enter engine displacement (CC)"
                      value={newCar.engineCc}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, engineCc: e.target.value }))}
                      className={inputClass}
                    />
                    <label className="flex items-center gap-2 rounded-xl border border-steel/70 px-3 py-2 text-xs text-fog">
                      <input
                        type="checkbox"
                        checked={newCar.published}
                        onChange={(e) => setNewCar((prev) => ({ ...prev, published: e.target.checked }))}
                      />
                      Published
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Enter vehicle notes (optional)"
                    value={newCar.notes}
                    onChange={(e) => setNewCar((prev) => ({ ...prev, notes: e.target.value }))}
                    className={`${inputClass} resize-y`}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCarFormOpen(false)
                        setCarMsg(null)
                        resetNewCarForm()
                      }}
                      className="rounded-lg border border-steel/70 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mist hover:border-steel/40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={carBusy}
                      onClick={(e) => {
                        void submitNewCar(e)
                      }}
                      className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-accent hover:bg-accent/20 disabled:opacity-50"
                    >
                      {carBusy ? 'Creating…' : 'Create and Select Car'}
                    </button>
                  </div>
                </div>
              ) : null}
              {carMsg ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    carMsg.type === 'ok'
                      ? 'border-accent/40 bg-accent-muted text-fog'
                      : 'border-flare/40 bg-flare-muted text-fog'
                  }`}
                >
                  {carMsg.text}
                </p>
              ) : null}
              {vehicleError ? <p className="text-xs text-flare">{vehicleError}</p> : null}
              <div className="overflow-x-auto rounded-lg border border-steel/40">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-steel/40 font-mono uppercase tracking-wider text-mist">
                    <tr>
                      <th className="px-2 py-2">Vehicle Make</th>
                      <th className="px-2 py-2">Vehicle Model</th>
                      <th className="px-2 py-2">Year</th>
                      <th className="px-2 py-2">Vehicle Variant</th>
                      <th className="px-2 py-2">Vehicle Fuel</th>
                      <th className="px-2 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steel/30 text-fog">
                    {selectedCars.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-3 text-mist">
                          No vehicles selected yet.
                        </td>
                      </tr>
                    ) : (
                      selectedCars.map((car) => (
                        <tr key={car.id}>
                          <td className="px-2 py-2">{normalizeCarBrand(car.make) || '—'}</td>
                          <td className="px-2 py-2">{car.model || '—'}</td>
                          <td className="px-2 py-2">{car.modelYear ?? '—'}</td>
                          <td className="px-2 py-2">{car.variant || '—'}</td>
                          <td className="px-2 py-2">{car.fuel || '—'}</td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeSelectedVehicle(car.id)}
                              className="rounded-md border border-steel/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-mist hover:border-flare/40 hover:text-flare"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-steel/50 bg-ink/20 p-3">
              <label className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-hud">
                <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                Upload primary image (JPEG, auto-resized)
              </label>
              <p className="mb-2 text-xs text-mist">Upload product image</p>
              <input
                type="file"
                accept="image/*"
                disabled={primaryBusy || busy}
                onChange={onPickPrimaryFile}
                aria-label="Upload product image"
                className="font-sans text-sm text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:font-semibold file:uppercase file:text-on-accent disabled:opacity-50"
              />
              {primaryBusy && <p className="mt-2 font-mono text-[10px] text-mist">Compressing…</p>}
              {primaryUploadDataUrl && (
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <img
                    src={primaryUploadDataUrl}
                    alt="Primary preview"
                    className="h-16 w-16 rounded-lg border border-steel/60 object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPrimaryUpload}
                    className="inline-flex items-center gap-1 rounded-lg border border-steel/60 px-2 py-1 font-mono text-[10px] uppercase text-mist hover:border-flare/50 hover:text-flare"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove upload
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-steel/50 bg-ink/20 p-3">
              <label className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-hud">
                <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                More photos (gallery) — select multiple files
              </label>
              <p className="mb-2 text-xs text-mist">Upload gallery images</p>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={extrasBusy || busy}
                onChange={onPickExtraFiles}
                aria-label="Upload gallery images"
                className="font-sans text-sm text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-hud file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:font-semibold file:uppercase file:text-white disabled:opacity-50"
              />
              {extrasBusy && <p className="mt-2 font-mono text-[10px] text-mist">Compressing…</p>}
              {extraPhotos.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {extraPhotos.map((p) => (
                    <li key={p.id} className="relative">
                      <img
                        src={p.dataUrl}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-steel/60 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExtra(p.id)}
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-steel/80 bg-ink text-mist hover:bg-flare-muted hover:text-flare"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-mist">
                If you only add gallery files and no primary upload, the first gallery file becomes the main catalog
                image. Others show in the product gallery.
              </p>
            </div>

            <div>
              <label className={labelClass}>Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Enter product description"
                className={`${inputClass} resize-y`}
              />
            </div>

            {currentStock < 0 ? (
              <p className="text-xs text-flare">Current stock cannot be negative.</p>
            ) : null}

            <div
              className={`flex flex-wrap gap-3 ${isPage ? 'justify-end border-t border-steel/40 pt-5' : 'justify-end'}`}
            >
              {isPage ? (
                <Link
                  to="/admin/products"
                  className="rounded-xl border border-steel/70 bg-ink/20 px-5 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-steel/30 hover:text-fog"
                >
                  Cancel
                </Link>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-w-[10rem] items-center justify-center rounded-xl bg-accent px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-md transition-[filter] hover:brightness-95 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Create product'}
              </button>
            </div>
          </form>
        </div>
  ) : null

  if (isPage) {
    return formBody
  }

  return (
    <>
      <SaveSuccessNotice open={saveSuccessOpen} onDismiss={() => setSaveSuccessOpen(false)} />
      <section className="admin-card">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-display text-lg font-bold uppercase tracking-tight text-fog md:px-5 md:py-4"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-accent" strokeWidth={2} />
            Add inventory
          </span>
          {open ? <ChevronUp className="h-5 w-5 text-mist" /> : <ChevronDown className="h-5 w-5 text-mist" />}
        </button>
        {formBody}
      </section>
    </>
  )
}
