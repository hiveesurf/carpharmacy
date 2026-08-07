import { Link } from 'react-router-dom'
import { publicUrl } from '../../lib/publicUrl'
import { FOOTER_POLICY_LINKS } from '../../lib/policyDocuments.js'
import { Mail, MapPin, Phone } from 'lucide-react'

const footerLinks = [
  { label: 'Home', to: '/' },
  { label: 'Catalog', to: '/catalog' },
  { label: 'Parts', to: '/#parts' },
  { label: 'Buy cars', to: '/cars' },
  { label: 'How it works', to: '/#how' },
]

const policyLinks = FOOTER_POLICY_LINKS

const INSTAGRAM_HREF =
  'https://www.instagram.com/carnalysys?igsh=bXRhaGVveWN6bnI2'

function IconInstagram(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer id="contact" className="border-t border-steel/60 bg-ink px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
        <div>
          <div className="flex items-center gap-3">
            <img
              src={publicUrl('logo-carnalysys.png')}
              alt="carpharmacy"
              className="h-11 w-11 rounded-full border border-steel/70 object-cover"
              loading="lazy"
              decoding="async"
            />
            <p className="font-display text-2xl font-black uppercase tracking-tight text-fog">carpharmacy</p>
          </div>
          <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-mist">
            Genuine automotive parts, assured delivery, and OEM brands — built for drivers who want clarity, not
            guesswork.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href={INSTAGRAM_HREF}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-steel/70 text-mist transition-[color,transform] hover:border-accent hover:text-accent"
            >
              <IconInstagram className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-fog">Links</h3>
          <ul className="mt-5 space-y-3">
            {footerLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="font-sans text-sm text-mist transition-colors hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-fog">Policy</h3>
          <ul className="mt-5 space-y-3">
            {policyLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="font-sans text-sm text-mist transition-colors hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-fog">Contact us</h3>
          <ul className="mt-5 space-y-4 font-sans text-sm text-mist">
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <a href="tel:+916372042226" className="transition-colors hover:text-accent">
                +91 63720 42226
              </a>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <a href="mailto:help@carnalysys.com" className="transition-colors hover:text-accent">
                help@carnalysys.com
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>Bhubaneswar, Odisha</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-6xl border-t border-steel/60 pt-8 text-center font-sans text-xs text-mist">
        © {new Date().getFullYear()} carpharmacy
      </div>
    </footer>
  )
}
