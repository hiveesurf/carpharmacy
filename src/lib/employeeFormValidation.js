export function normalizeEmployeePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 10) return digits
  return digits.slice(-10)
}

/**
 * @param {{
 *   phone?: string,
 *   name?: string,
 *   role?: string,
 *   customRoleId?: string,
 *   customRoleName?: string,
 *   pageKeys?: string[],
 * }} fields
 * @returns {{
 *   errors: Record<string, string>,
 *   values: Record<string, unknown> | null,
 * }}
 */
export function validateEmployeeForm(fields) {
  const errors = {}
  const phone = normalizeEmployeePhone(fields.phone)
  const name = String(fields.name ?? '').trim()
  const roleRaw = String(fields.role ?? '').trim().toLowerCase()
  const role = roleRaw === 'other' ? 'custom' : roleRaw

  if (!phone) {
    errors.phone = 'Phone is required'
  } else if (phone.length !== 10) {
    errors.phone = 'Phone must be 10 digits'
  }

  if (!name) {
    errors.name = 'Full name is required'
  }

  if (!role) {
    errors.role = 'Role is required'
  } else if (role !== 'sales' && role !== 'delivery' && role !== 'custom') {
    errors.role = 'Role must be sales, delivery, or other'
  }

  if (role === 'custom') {
    const customRoleId = String(fields.customRoleId ?? '').trim()
    const customRoleName = String(fields.customRoleName ?? '').trim()
    const pageKeys = Array.isArray(fields.pageKeys)
      ? fields.pageKeys.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
      : []

    if (customRoleId) {
      // Reuse existing role selected from main dropdown — permissions already stored
    } else if (!customRoleName) {
      errors.customRoleName = 'Custom role name is required'
    } else if (pageKeys.length === 0) {
      errors.pageKeys = 'Select at least one page'
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: null }
  }

  /** @type {Record<string, unknown>} */
  const values = { phone, name, role }

  if (role === 'custom') {
    const customRoleId = String(fields.customRoleId ?? '').trim()
    if (customRoleId) {
      values.customRoleId = customRoleId
    } else {
      values.customRole = {
        name: String(fields.customRoleName ?? '').trim(),
        pageKeys: Array.isArray(fields.pageKeys)
          ? fields.pageKeys.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
          : [],
      }
    }
  }

  return { errors, values }
}

/**
 * Edit modal: sales/delivery as today; custom keeps role=custom without requiring page checklist.
 * @param {{ phone?: string, name?: string, role?: string }} fields
 */
export function validateEmployeeEditForm(fields) {
  const errors = {}
  const phone = normalizeEmployeePhone(fields.phone)
  const name = String(fields.name ?? '').trim()
  const role = String(fields.role ?? '').trim().toLowerCase()

  if (!phone) {
    errors.phone = 'Phone is required'
  } else if (phone.length !== 10) {
    errors.phone = 'Phone must be 10 digits'
  }

  if (!name) {
    errors.name = 'Full name is required'
  }

  if (!role) {
    errors.role = 'Role is required'
  } else if (role !== 'sales' && role !== 'delivery' && role !== 'custom') {
    errors.role = 'Role must be sales, delivery, or custom'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: null }
  }

  return { errors, values: { phone, name, role } }
}
