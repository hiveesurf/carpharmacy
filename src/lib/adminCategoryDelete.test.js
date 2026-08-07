import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { categoryDeleteErrorMessage, removeCategoryFromList } from './adminCategoryDelete.js'

describe('removeCategoryFromList', () => {
  it('successful delete removes the row from the list', () => {
    const items = [
      { id: 'brakes', name: 'Brakes' },
      { id: 'engine', name: 'Engine' },
    ]
    assert.deepEqual(removeCategoryFromList(items, 'brakes'), [{ id: 'engine', name: 'Engine' }])
  })

  it('blocked delete leaves the list unchanged when id is not removed', () => {
    const items = [
      { id: 'brakes', name: 'Brakes' },
      { id: 'engine', name: 'Engine' },
    ]
    assert.deepEqual(removeCategoryFromList(items, 'missing'), items)
    assert.equal(items.length, 2)
  })
})

describe('categoryDeleteErrorMessage', () => {
  it('blocked delete shows the in-use message', () => {
    const err = {
      status: 409,
      payload: {
        error: {
          code: 'CATEGORY_IN_USE',
          message: 'Cannot delete category: 3 product(s) still use this category.',
        },
      },
    }
    assert.equal(
      categoryDeleteErrorMessage(err),
      "This category is used by 3 products and can't be deleted until those are reassigned or removed.",
    )
  })

  it('uses singular copy for one product', () => {
    const err = {
      status: 409,
      payload: {
        error: {
          code: 'CATEGORY_IN_USE',
          message: 'Cannot delete category: 1 product(s) still use this category.',
        },
      },
    }
    assert.match(categoryDeleteErrorMessage(err), /used by 1 product and can't be deleted/)
  })
})
