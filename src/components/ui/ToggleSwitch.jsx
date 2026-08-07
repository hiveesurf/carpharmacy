/**
 * Accessible pill toggle — real checkbox under the hood (keyboard + screen readers).
 * Parent <label> should wrap this + label text and set htmlFor to `id`.
 */
export function ToggleSwitch({
  id,
  checked = false,
  onChange,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <span className={`relative inline-flex h-6 w-11 shrink-0 ${className}`.trim()}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-steel/70 bg-steel/40 transition-colors duration-200 peer-checked:border-accent/60 peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/35 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-fog shadow-sm transition-transform duration-200 peer-checked:translate-x-5 peer-checked:bg-on-accent"
      />
    </span>
  )
}
