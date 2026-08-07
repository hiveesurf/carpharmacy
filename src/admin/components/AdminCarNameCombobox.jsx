import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import {
  buildAdminCarNameOptions,
  filterAdminCarNameOptions,
} from '../../lib/adminCarNameCombobox.js'

/**
 * Combobox for admin car-name filter: type to filter (free text) or pick from loaded cars.
 *
 * @param {{
 *   id?: string,
 *   value: string,
 *   onChange: (next: string) => void,
 *   cars: Record<string, unknown>[],
 *   inputClassName?: string,
 *   placeholder?: string,
 *   'aria-label'?: string,
 *   disabled?: boolean,
 * }} props
 */
export function AdminCarNameCombobox({
  id,
  value,
  onChange,
  cars,
  inputClassName = '',
  placeholder = 'Make, model, variant…',
  'aria-label': ariaLabel = 'Search by car name',
  disabled = false,
}) {
  const listboxId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const options = useMemo(() => buildAdminCarNameOptions(cars), [cars])
  const filtered = useMemo(() => filterAdminCarNameOptions(options, value), [options, value])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (rootRef.current?.contains(e.target)) return
      setOpen(false)
      setHighlight(-1)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    setHighlight(-1)
  }, [value, open])

  function pickOption(option) {
    if (!option) return
    onChange(option.filterValue)
    setOpen(false)
    setHighlight(-1)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (!open) return
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => {
        const max = filtered.length - 1
        if (max < 0) return -1
        return h < 0 ? 0 : Math.min(h + 1, max)
      })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => {
        const max = filtered.length - 1
        if (max < 0) return -1
        if (h < 0) return max
        return Math.max(h - 1, 0)
      })
      return
    }
    if (e.key === 'Enter') {
      if (!open) {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (highlight >= 0 && filtered[highlight]) {
        e.preventDefault()
        pickOption(filtered[highlight])
      }
    }
  }

  const activeOptionId =
    open && highlight >= 0 && filtered[highlight] ? `${listboxId}-opt-${filtered[highlight].id}` : undefined

  return (
    <div ref={rootRef} className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist"
        aria-hidden
      />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={`${inputClassName} pr-9`.trim()}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setHighlight(-1)
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open ? 'Close car name list' : 'Open car name list'}
        className="absolute right-0 top-0 flex h-full items-center px-2 text-mist hover:text-fog disabled:opacity-50"
        onMouseDown={(ev) => ev.preventDefault()}
        onClick={() => {
          setOpen((wasOpen) => {
            const next = !wasOpen
            if (next) setHighlight(-1)
            return next
          })
        }}
      >
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-[60] mt-1 max-h-52 overflow-auto rounded-lg border border-steel/60 bg-slate py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-mist" role="presentation">
              No matching cars
            </li>
          ) : (
            filtered.map((option, idx) => {
              const active = highlight === idx
              const optionDomId = `${listboxId}-opt-${option.id}`
              return (
                <li key={option.id} role="presentation">
                  <button
                    type="button"
                    id={optionDomId}
                    role="option"
                    tabIndex={-1}
                    aria-selected={active}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pickOption(option)}
                    className={`w-full truncate px-3 py-2 text-left text-xs text-fog hover:bg-steel/30 ${
                      active ? 'bg-steel/30' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
