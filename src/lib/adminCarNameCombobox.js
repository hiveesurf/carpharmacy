import { matchesAdminCarSearch } from './adminCarListStats.js'

/** Cap dropdown rows so large catalogs stay scrollable without rendering thousands of DOM nodes. */
export const ADMIN_CAR_NAME_COMBOBOX_LIMIT = 80

/**
 * Readable base label: make + model + variant (matches list title + subtitle).
 * @param {Record<string, unknown>} car
 */
export function formatAdminCarNameBase(car) {
  return [car?.make, car?.model, car?.variant]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Convert a display label into the string used for `matchesAdminCarSearch`.
 * Year-disambiguated labels use "(YYYY)" in the UI but plain "YYYY" in the filter haystack.
 * @param {string} label
 */
export function adminCarNameFilterValueFromLabel(label) {
  return String(label ?? '')
    .replace(/\s*\((\d{4})\)\s*$/u, ' $1')
    .trim()
}

function carModelYear(car) {
  const year = car?.modelYear ?? car?.model_year ?? car?.year
  if (year == null || year === '') return ''
  return String(year)
}

function isDeletedCar(car) {
  return Boolean(car?.deleted || car?.deletedAt)
}

/**
 * Build unique combobox options from loaded cars.
 * Duplicate make/model/variant groups are disambiguated with model year.
 *
 * @param {Record<string, unknown>[]} cars
 * @returns {{ id: string, label: string, filterValue: string, car: Record<string, unknown> }[]}
 */
export function buildAdminCarNameOptions(cars) {
  const active = (cars || []).filter((c) => c && !isDeletedCar(c))
  /** @type {Map<string, Record<string, unknown>[]>} */
  const byBase = new Map()
  for (const car of active) {
    const base = formatAdminCarNameBase(car) || 'Car'
    const group = byBase.get(base)
    if (group) group.push(car)
    else byBase.set(base, [car])
  }

  /** @type {{ id: string, label: string, filterValue: string, car: Record<string, unknown> }[]} */
  const options = []
  for (const [base, group] of byBase) {
    if (group.length === 1) {
      const car = group[0]
      options.push({
        id: String(car.id ?? base),
        label: base,
        filterValue: base,
        car,
      })
      continue
    }

    /** @type {Map<string, Record<string, unknown>[]>} */
    const byYear = new Map()
    for (const car of group) {
      const y = carModelYear(car)
      const key = y || '__none__'
      const yearGroup = byYear.get(key)
      if (yearGroup) yearGroup.push(car)
      else byYear.set(key, [car])
    }

    for (const car of group) {
      const y = carModelYear(car)
      const yearGroup = byYear.get(y || '__none__') || [car]
      let label
      let filterValue
      if (y && yearGroup.length === 1) {
        label = `${base} (${y})`
        filterValue = adminCarNameFilterValueFromLabel(label)
      } else if (y) {
        label = `${base} (${y}) · ${car.id}`
        filterValue = `${base} ${y}`
      } else {
        label = `${base} · ${car.id}`
        filterValue = base
      }
      options.push({
        id: String(car.id ?? label),
        label,
        filterValue,
        car,
      })
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return options
}

/**
 * Filter options with the same matching rules as the cars table search, capped for the dropdown.
 *
 * @param {{ label: string, filterValue: string, car: Record<string, unknown> }[]} options
 * @param {string} query
 */
export function filterAdminCarNameOptions(options, query) {
  const list = options || []
  const q = String(query ?? '').trim()
  const matched = q ? list.filter((o) => matchesAdminCarSearch(o.car, q)) : list
  return matched.slice(0, ADMIN_CAR_NAME_COMBOBOX_LIMIT)
}
