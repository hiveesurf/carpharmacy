/**
 * Pure helpers for car parts-summary display and Cars list empty-state copy.
 */

/**
 * @param {unknown} summary
 * @returns {{ totalParts: number, soldPartsCount: number, parts: Array<Record<string, unknown>> }}
 */
export function normalizeCarPartsSummary(summary) {
  const s = summary && typeof summary === 'object' ? summary : {}
  const parts = Array.isArray(s.parts) ? s.parts : []
  return {
    totalParts: typeof s.totalParts === 'number' ? s.totalParts : Number(s.totalParts) || 0,
    soldPartsCount:
      typeof s.soldPartsCount === 'number' ? s.soldPartsCount : Number(s.soldPartsCount) || 0,
    parts,
  }
}

/**
 * Empty-state copy for the Cars list when there are zero cars (no filters).
 * Must not mention a standalone Add Car page.
 */
export function carsListEmptyStateCopy() {
  return 'No cars in the catalog yet. Create one from Inventory → Add Product → Add New Car.'
}

export function carsListEmptyStateCtaPath() {
  return '/admin/products/add'
}

/** Shown when filters are active but no cars match. */
export function carsListFilteredEmptyStateCopy() {
  return 'No cars match your filters. Try clearing search or part name.'
}

/**
 * @param {{ hasCarsInCatalog: boolean, hasActiveFilters: boolean, filteredCount: number }} opts
 * @returns {'loading' | 'catalog-empty' | 'filtered-empty' | 'results'}
 */
export function resolveCarsListEmptyKind({ hasCarsInCatalog, hasActiveFilters, filteredCount }) {
  if (filteredCount > 0) return 'results'
  if (!hasCarsInCatalog && !hasActiveFilters) return 'catalog-empty'
  if (hasActiveFilters) return 'filtered-empty'
  return 'catalog-empty'
}
