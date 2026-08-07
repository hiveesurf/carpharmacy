import { Link } from 'react-router-dom'
import { getPolicyDoc } from '../lib/policyDocuments.js'

export function PolicyDocumentPage({ kind }) {
  const doc = getPolicyDoc(kind)
  if (!doc) return null

  const sections = Array.isArray(doc.sections) ? doc.sections : []
  const paragraphs = Array.isArray(doc.paragraphs) ? doc.paragraphs : []

  return (
    <div className="min-h-svh bg-slate px-4 pb-20 pt-[calc(var(--nav-h)+1.5rem)] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="font-sans text-sm font-semibold text-accent transition-colors hover:text-fog"
        >
          ← Back to home
        </Link>
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight text-fog sm:text-4xl">
          {doc.title}
        </h1>
        {doc.lastUpdated ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-mist">
            Last updated: {doc.lastUpdated}
          </p>
        ) : null}
        {doc.intro ? (
          <p className="mt-8 font-sans text-base leading-relaxed text-mist whitespace-pre-line">{doc.intro}</p>
        ) : null}

        {sections.length > 0 ? (
          <div className="mt-10 space-y-10">
            {sections.map((section) =>
              section.body?.trim() ? (
                <section key={section.heading}>
                  <h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-fog sm:text-xl">
                    {section.heading}
                  </h2>
                  <p className="mt-3 font-sans text-base leading-relaxed text-mist whitespace-pre-line">
                    {section.body}
                  </p>
                </section>
              ) : null,
            )}
          </div>
        ) : (
          <div className="mt-10 space-y-6 font-sans text-base leading-relaxed text-mist">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
