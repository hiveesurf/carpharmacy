import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  carsListEmptyStateCopy,
  carsListEmptyStateCtaPath,
  carsListFilteredEmptyStateCopy,
  normalizeCarPartsSummary,
  resolveCarsListEmptyKind,
} from './carPartsSummary.js'
import { matchesAdminCarSearch } from './adminCarListStats.js'

describe('normalizeCarPartsSummary', () => {
  it('returns zeros and empty parts for null/undefined', () => {
    assert.deepEqual(normalizeCarPartsSummary(null), {
      totalParts: 0,
      soldPartsCount: 0,
      parts: [],
    })
  })

  it('preserves totals and parts for a populated summary', () => {
    const summary = {
      carId: 'toyota-corolla',
      totalParts: 2,
      soldPartsCount: 5,
      parts: [
        { productId: 'p1', name: 'Oil filter', sku: 'OF-1', unitsSold: 3, price: 400 },
        { productId: 'p2', name: 'Air filter', sku: 'AF-1', unitsSold: 2, price: 500 },
      ],
    }
    const n = normalizeCarPartsSummary(summary)
    assert.equal(n.totalParts, 2)
    assert.equal(n.soldPartsCount, 5)
    assert.equal(n.parts.length, 2)
    assert.equal(n.parts[0].sku, 'OF-1')
  })
})

describe('cars list empty state (Add Car page removed)', () => {
  it('points users to Inventory Add Product, not /admin/cars/add', () => {
    const copy = carsListEmptyStateCopy()
    assert.match(copy, /Inventory/i)
    assert.match(copy, /Add Product/i)
    assert.doesNotMatch(copy, /button above/i)
    assert.equal(carsListEmptyStateCtaPath(), '/admin/products/add')
  })
})

describe('cars list empty kinds and filter copy', () => {
  it('distinguishes catalog-empty from filtered-empty', () => {
    assert.equal(
      resolveCarsListEmptyKind({
        hasCarsInCatalog: false,
        hasActiveFilters: false,
        filteredCount: 0,
      }),
      'catalog-empty',
    )
    assert.equal(
      resolveCarsListEmptyKind({
        hasCarsInCatalog: true,
        hasActiveFilters: true,
        filteredCount: 0,
      }),
      'filtered-empty',
    )
    assert.equal(
      resolveCarsListEmptyKind({
        hasCarsInCatalog: true,
        hasActiveFilters: true,
        filteredCount: 2,
      }),
      'results',
    )
  })

  it('filtered empty copy differs from catalog empty and mentions filters', () => {
    const filtered = carsListFilteredEmptyStateCopy()
    const catalog = carsListEmptyStateCopy()
    assert.notEqual(filtered, catalog)
    assert.match(filtered, /filters/i)
    assert.doesNotMatch(filtered, /Inventory/i)
  })
})

describe('car name search (existing) vs part filter (server)', () => {
  it('matchesAdminCarSearch covers make/model/variant', () => {
    const car = { make: 'Toyota', model: 'Innova', variant: 'Crysta', modelYear: 2022 }
    assert.equal(matchesAdminCarSearch(car, 'innova'), true)
    assert.equal(matchesAdminCarSearch(car, 'crysta'), true)
    assert.equal(matchesAdminCarSearch(car, 'toyota'), true)
    assert.equal(matchesAdminCarSearch(car, 'oil filter'), false)
  })
})
