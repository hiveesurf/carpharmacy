import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchesAdminCarSearch } from './adminCarListStats.js'
import {
  ADMIN_CAR_NAME_COMBOBOX_LIMIT,
  adminCarNameFilterValueFromLabel,
  buildAdminCarNameOptions,
  filterAdminCarNameOptions,
  formatAdminCarNameBase,
} from './adminCarNameCombobox.js'

const sampleCars = [
  { id: '1', make: 'Toyota', model: 'Innova', variant: 'Crysta', modelYear: 2022 },
  { id: '2', make: 'Honda', model: 'City', variant: 'ZX', modelYear: 2021 },
  { id: '3', make: 'Toyota', model: 'Innova', variant: 'Crysta', modelYear: 2019 },
  { id: '4', make: 'Maruti', model: 'Swift', variant: '', modelYear: 2020 },
]

describe('formatAdminCarNameBase', () => {
  it('joins make model variant like the list title + subtitle', () => {
    assert.equal(formatAdminCarNameBase(sampleCars[0]), 'Toyota Innova Crysta')
    assert.equal(formatAdminCarNameBase(sampleCars[3]), 'Maruti Swift')
  })
})

describe('buildAdminCarNameOptions', () => {
  it('builds unique labels and disambiguates duplicates with year', () => {
    const options = buildAdminCarNameOptions(sampleCars)
    const labels = options.map((o) => o.label)
    assert.ok(labels.includes('Honda City ZX'))
    assert.ok(labels.includes('Maruti Swift'))
    assert.ok(labels.includes('Toyota Innova Crysta (2022)'))
    assert.ok(labels.includes('Toyota Innova Crysta (2019)'))
    assert.equal(new Set(labels).size, labels.length)
  })

  it('skips deleted cars', () => {
    const options = buildAdminCarNameOptions([
      ...sampleCars,
      { id: 'x', make: 'Gone', model: 'Car', deleted: true },
    ])
    assert.equal(options.some((o) => o.label.includes('Gone')), false)
  })
})

describe('filterAdminCarNameOptions', () => {
  it('typing filters the dropdown with the same rules as table search', () => {
    const options = buildAdminCarNameOptions(sampleCars)
    const filtered = filterAdminCarNameOptions(options, 'innova')
    assert.equal(filtered.length, 2)
    assert.ok(filtered.every((o) => matchesAdminCarSearch(o.car, 'innova')))
    assert.deepEqual(
      filterAdminCarNameOptions(options, 'city').map((o) => o.label),
      ['Honda City ZX'],
    )
  })

  it('caps results at the combobox limit', () => {
    const many = Array.from({ length: ADMIN_CAR_NAME_COMBOBOX_LIMIT + 20 }, (_, i) => ({
      id: String(i),
      make: 'Brand',
      model: `Model${i}`,
      variant: 'V',
      modelYear: 2020,
    }))
    const options = buildAdminCarNameOptions(many)
    assert.equal(filterAdminCarNameOptions(options, '').length, ADMIN_CAR_NAME_COMBOBOX_LIMIT)
    assert.equal(filterAdminCarNameOptions(options, 'brand').length, ADMIN_CAR_NAME_COMBOBOX_LIMIT)
  })
})

describe('selecting vs free typing for table filter', () => {
  it('selecting an option sets a filterValue that matches that car', () => {
    const options = buildAdminCarNameOptions(sampleCars)
    const picked = options.find((o) => o.label === 'Honda City ZX')
    assert.ok(picked)
    assert.equal(matchesAdminCarSearch(picked.car, picked.filterValue), true)
    assert.equal(matchesAdminCarSearch(sampleCars[0], picked.filterValue), false)
  })

  it('year-disambiguated selection still matches via matchesAdminCarSearch', () => {
    const options = buildAdminCarNameOptions(sampleCars)
    const picked = options.find((o) => o.label === 'Toyota Innova Crysta (2019)')
    assert.ok(picked)
    assert.equal(picked.filterValue, adminCarNameFilterValueFromLabel(picked.label))
    assert.equal(matchesAdminCarSearch(picked.car, picked.filterValue), true)
    assert.equal(matchesAdminCarSearch(sampleCars[0], picked.filterValue), false)
  })

  it('free typing without selecting still filters the table as before', () => {
    const query = 'swift'
    const tableHits = sampleCars.filter((c) => matchesAdminCarSearch(c, query))
    assert.equal(tableHits.length, 1)
    assert.equal(tableHits[0].model, 'Swift')

    const options = buildAdminCarNameOptions(sampleCars)
    const dropdownHits = filterAdminCarNameOptions(options, query)
    assert.equal(dropdownHits.length, 1)
    assert.equal(dropdownHits[0].car.id, tableHits[0].id)
  })
})
