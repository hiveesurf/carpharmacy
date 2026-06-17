/**
 * URL for files served from Vite `public/` (honours `base`, e.g. GitHub Pages subpath).
 * @param {string} path - e.g. `images/engine.jpg` or `/images/engine.jpg`
 * @returns {string}
 */
export function publicUrl(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  const envObj = import.meta?.env ?? {}
  const base = typeof envObj.BASE_URL === 'string' && envObj.BASE_URL ? envObj.BASE_URL : '/'
  return `${base}${normalized}`
}
