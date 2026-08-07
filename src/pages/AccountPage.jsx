import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera, LogOut, Plus, Trash2 } from 'lucide-react'
import { publicUrl } from '../lib/publicUrl'
import { useAuth } from '../context/useAuth'
import {
  loadProfile,
  saveProfile,
  loadAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  postUserAvatar,
} from '../services/userService.js'
import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'
import {
  buildAddressPayload,
  getAddressSaveErrorMessage,
  validateAddressForm,
} from '../lib/addressHelpers.js'
import { resolveApiAssetUrl } from '../lib/resolveApiAssetUrl.js'
import { formatPublicIdentityInitials } from '../lib/identityDisplayLabel.js'
import { Button } from '../components/ui/Button'
import { ToggleSwitch } from '../components/ui/ToggleSwitch'

const ADDR_FIELDS = [
  { key: 'line1', label: 'Address line 1', required: true },
  { key: 'line2', label: 'Address line 2 (optional)', required: false },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State', required: false },
  { key: 'pincode', label: 'Pincode', required: true },
  { key: 'label', label: 'Label (e.g. Home, Office)', required: false },
]

const emptyAddr = () => ({
  recipientName: '',
  recipientPhone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'IN',
  label: 'Home',
  gstNumber: '',
  isBusinessPurchase: false,
  isDefault: false,
})

function hasSavedGst(address) {
  return Boolean(String(address?.gstNumber ?? '').trim())
}

export function AccountPage() {
  const { user, authHydrated, openAuth, signOut, patchUser, sessionRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [secondaryPhone, setSecondaryPhone] = useState('')
  const [primaryPhone, setPrimaryPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarImgFailed, setAvatarImgFailed] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [addrForm, setAddrForm] = useState(null)
  const [addrSaving, setAddrSaving] = useState(false)
  const [addrError, setAddrError] = useState(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await loadProfile()
      const prof = data?.profile ?? {}
      const pphone = prof.primaryPhone ?? data?.user?.phone ?? ''
      setName(typeof prof.name === 'string' ? prof.name : '')
      setEmail(typeof prof.email === 'string' ? prof.email : '')
      setSecondaryPhone(typeof prof.secondaryPhone === 'string' ? prof.secondaryPhone : '')
      setPrimaryPhone(String(pphone ?? ''))
      setAvatarUrl(typeof prof.avatarUrl === 'string' ? prof.avatarUrl : '')
      setAvatarImgFailed(false)
      const items = await loadAddresses()
      setAddresses(Array.isArray(items) ? items : [])
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      openAuth()
      setLoading(false)
      return
    }
    void reload()
  }, [authHydrated, user, openAuth, reload])

  const onSaveProfile = async (e) => {
    e.preventDefault()
    setSaveMsg(null)
    try {
      const profile = await saveProfile({
        name: name.trim(),
        email: email.trim(),
        secondaryPhone: secondaryPhone.trim(),
      })
      patchUser({
        name: typeof profile.name === 'string' ? profile.name : name.trim(),
        avatarUrl:
          typeof profile.avatarUrl === 'string' && profile.avatarUrl
            ? profile.avatarUrl
            : avatarUrl,
      })
      if (typeof profile.avatarUrl === 'string' && profile.avatarUrl) {
        setAvatarUrl(profile.avatarUrl)
      }
      setSaveMsg('Saved.')
    } catch (err) {
      setSaveMsg(getFetchErrorMessage(err))
    }
  }

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = await postUserAvatar(file)
      const url = typeof data?.avatarUrl === 'string' ? data.avatarUrl : ''
      if (url) {
        setAvatarUrl(url)
        setAvatarImgFailed(false)
        patchUser({ avatarUrl: url })
      }
    } catch (err) {
      setSaveMsg(getFetchErrorMessage(err))
    }
  }

  const resolvedAvatarUrl = resolveApiAssetUrl(avatarUrl)

  if (!authHydrated || !user) {
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">
        <p className="font-sans text-sm">Sign in to manage your account.</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-slate pt-[calc(var(--nav-h)+1rem)] pb-20">
      <img
        src={publicUrl('images/engine.jpg')}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
        loading="lazy"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-slate/85" aria-hidden />
      <div className="relative z-[1] mx-auto max-w-3xl px-4">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-hud transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          Back to home
        </Link>

        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Account</p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-fog">
            Profile & addresses
          </h1>
          <p className="mt-3">
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-accent transition-colors hover:underline"
            >
              View my orders →
            </Link>
          </p>
        </header>

        {loading ? (
          <p className="font-sans text-sm text-mist">Loading…</p>
        ) : error ? (
          <p className="font-sans text-sm text-flare">{error}</p>
        ) : (
          <div className="space-y-10">
            <section className="rounded-2xl border border-steel/70 bg-ink/95 p-6 shadow-lg backdrop-blur-sm">
              <h2 className="font-display text-lg font-bold uppercase text-fog">Photo</h2>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-steel/80 bg-slate">
                  {resolvedAvatarUrl && !avatarImgFailed ? (
                    <img
                      src={resolvedAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => setAvatarImgFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-2xl text-mist">
                      {formatPublicIdentityInitials(user, sessionRole)}
                    </div>
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 font-sans text-xs font-semibold text-accent transition-colors hover:bg-accent/20">
                  <Camera className="h-4 w-4" />
                  Upload photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickAvatar} />
                </label>
              </div>
            </section>

            <form
              onSubmit={onSaveProfile}
              className="rounded-2xl border border-steel/70 bg-ink/95 p-6 shadow-lg backdrop-blur-sm"
            >
              <h2 className="font-display text-lg font-bold uppercase text-fog">Details</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="acc-name" className="block font-mono text-[10px] uppercase tracking-wider text-hud">
                    Display name
                  </label>
                  <input
                    id="acc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-steel/80 bg-slate px-3 py-2.5 font-sans text-sm text-fog outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="acc-email" className="block font-mono text-[10px] uppercase tracking-wider text-hud">
                    Email
                  </label>
                  <input
                    id="acc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-steel/80 bg-slate px-3 py-2.5 font-sans text-sm text-fog outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-hud">Login phone</label>
                  <input
                    readOnly
                    value={primaryPhone}
                    className="mt-1 w-full cursor-not-allowed rounded-xl border border-steel/60 bg-ink/80 px-3 py-2.5 font-sans text-sm text-mist"
                  />
                  <p className="mt-1 font-sans text-xs text-mist">This number is used to sign in and cannot be changed here.</p>
                </div>
                <div>
                  <label htmlFor="acc-phone2" className="block font-mono text-[10px] uppercase tracking-wider text-hud">
                    Secondary phone
                  </label>
                  <input
                    id="acc-phone2"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    placeholder="Optional contact number"
                    className="mt-1 w-full rounded-xl border border-steel/80 bg-slate px-3 py-2.5 font-sans text-sm text-fog outline-none focus:border-accent"
                  />
                </div>
              </div>
              {saveMsg && <p className={`mt-4 font-sans text-sm ${saveMsg === 'Saved.' ? 'text-accent' : 'text-flare'}`}>{saveMsg}</p>}
              <Button type="submit" variant="primary" className="mt-6">
                Save profile
              </Button>
            </form>

            <section className="rounded-2xl border border-steel/70 bg-ink/95 p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-bold uppercase text-fog">Addresses</h2>
                <button
                  type="button"
                  onClick={() => {
                    setAddrError(null)
                    setAddrForm({
                      ...emptyAddr(),
                      recipientName: name.trim(),
                      recipientPhone: secondaryPhone.trim() || primaryPhone.trim(),
                      isBusinessPurchase: false,
                    })
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-accent/40 px-3 py-2 font-sans text-xs font-semibold text-accent hover:bg-accent/10"
                >
                  <Plus className="h-4 w-4" />
                  Add address
                </button>
              </div>
              <ul className="mt-4 space-y-3">
                {addresses.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col gap-2 rounded-xl border border-steel/60 bg-slate/50 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase text-hud">{a.label || 'Address'}</p>
                      <p className="mt-1 font-sans text-sm text-fog">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ''}
                      </p>
                      <p className="font-sans text-sm text-mist">
                        {a.city}
                        {a.state ? `, ${a.state}` : ''} {a.pincode}
                      </p>
                      {a.gstNumber ? (
                        <p className="mt-1 font-sans text-xs text-mist">GST: {a.gstNumber}</p>
                      ) : null}
                      {a.isDefault && <span className="mt-1 inline-block text-xs text-accent">Default</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-steel/70 px-3 py-1.5 font-sans text-xs text-fog hover:border-accent/40"
                        onClick={() => {
                          setAddrError(null)
                          setAddrForm({
                            ...a,
                            recipientName: name.trim(),
                            recipientPhone: secondaryPhone.trim() || primaryPhone.trim(),
                            isBusinessPurchase: hasSavedGst(a),
                          })
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-flare/40 p-2 text-flare hover:bg-flare/10"
                        aria-label="Delete address"
                        onClick={async () => {
                          if (!window.confirm('Remove this address?')) return
                          try {
                            await deleteAddress(a.id)
                            setAddresses((prev) => prev.filter((x) => x.id !== a.id))
                          } catch (err) {
                            setSaveMsg(getFetchErrorMessage(err))
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {addrForm && (
                <form
                  className="mt-6 space-y-3 rounded-xl border border-accent/30 bg-slate/30 p-4"
                  onSubmit={async (ev) => {
                    ev.preventDefault()
                    setAddrError(null)
                    const validationMsg = validateAddressForm(addrForm)
                    if (validationMsg) {
                      setAddrError(validationMsg)
                      return
                    }
                    const recipientName = String(addrForm.recipientName ?? '').trim()
                    const recipientPhone = String(addrForm.recipientPhone ?? '').trim()
                    if (!recipientName) {
                      setAddrError('Full name is required.')
                      return
                    }
                    if (!recipientPhone) {
                      setAddrError('Phone is required.')
                      return
                    }
                    setAddrSaving(true)
                    try {
                      const body = buildAddressPayload(addrForm)
                      if (addrForm.id) {
                        await updateAddress(addrForm.id, body)
                      } else {
                        await createAddress(body)
                      }
                      const profilePatch = {}
                      if (recipientName && recipientName !== name.trim()) profilePatch.name = recipientName
                      if (recipientPhone && recipientPhone !== secondaryPhone.trim()) {
                        profilePatch.secondaryPhone = recipientPhone
                      }
                      if (Object.keys(profilePatch).length > 0) {
                        const profile = await saveProfile(profilePatch)
                        if (typeof profile.name === 'string') setName(profile.name)
                        if (typeof profile.secondaryPhone === 'string') setSecondaryPhone(profile.secondaryPhone)
                      }
                      const items = await loadAddresses()
                      setAddresses(Array.isArray(items) ? items : [])
                      setAddrForm(null)
                    } catch (err) {
                      setAddrError(getAddressSaveErrorMessage(err))
                    } finally {
                      setAddrSaving(false)
                    }
                  }}
                >
                  <p className="font-display text-sm font-bold uppercase text-fog">{addrForm.id ? 'Edit' : 'New'} address</p>
                  <div>
                    <label htmlFor="addr-recipient-name" className="block font-mono text-[9px] uppercase text-mist">
                      Full name
                    </label>
                    <input
                      id="addr-recipient-name"
                      required
                      value={addrForm.recipientName ?? ''}
                      onChange={(e) => setAddrForm((f) => ({ ...f, recipientName: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-steel/70 bg-ink px-2 py-2 text-sm text-fog outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="addr-recipient-phone" className="block font-mono text-[9px] uppercase text-mist">
                      Phone
                    </label>
                    <input
                      id="addr-recipient-phone"
                      required
                      value={addrForm.recipientPhone ?? ''}
                      onChange={(e) => setAddrForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-steel/70 bg-ink px-2 py-2 text-sm text-fog outline-none focus:border-accent"
                    />
                  </div>
                  {ADDR_FIELDS.map(({ key, label, required }) => (
                    <div key={key}>
                      <label htmlFor={`addr-${key}`} className="block font-mono text-[9px] uppercase text-mist">
                        {label}
                      </label>
                      <input
                        id={`addr-${key}`}
                        required={required}
                        value={addrForm[key] ?? ''}
                        onChange={(e) => setAddrForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-steel/70 bg-ink px-2 py-2 text-sm text-fog outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                  <label
                    htmlFor="addr-business-purchase"
                    className="flex cursor-pointer items-center gap-3 font-sans text-sm text-fog"
                  >
                    <ToggleSwitch
                      id="addr-business-purchase"
                      checked={Boolean(addrForm.isBusinessPurchase)}
                      onChange={(e) =>
                        setAddrForm((f) => ({
                          ...f,
                          isBusinessPurchase: e.target.checked,
                          gstNumber: e.target.checked ? (f.gstNumber ?? '') : '',
                        }))
                      }
                    />
                    I'm purchasing as a business
                  </label>
                  {addrForm.isBusinessPurchase ? (
                    <div>
                      <label htmlFor="addr-gst-number" className="block font-mono text-[9px] uppercase text-mist">
                        GST Number
                      </label>
                      <input
                        id="addr-gst-number"
                        type="text"
                        autoComplete="off"
                        maxLength={15}
                        value={addrForm.gstNumber ?? ''}
                        onChange={(e) => setAddrForm((f) => ({ ...f, gstNumber: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-steel/70 bg-ink px-2 py-2 text-sm uppercase text-fog outline-none focus:border-accent"
                      />
                    </div>
                  ) : null}
                  <label className="flex items-center gap-2 font-sans text-sm text-fog">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={Boolean(addrForm.isDefault)}
                      onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    />
                    Default address
                  </label>
                  {addrError ? <p className="font-sans text-sm text-flare">{addrError}</p> : null}
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" variant="primary" disabled={addrSaving}>
                      {addrSaving ? 'Saving…' : 'Save address'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAddrForm(null)
                        setAddrError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </section>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="ghost"
                className="inline-flex items-center gap-2 border border-steel/70"
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
