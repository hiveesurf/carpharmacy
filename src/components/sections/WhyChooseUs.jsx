import { motion } from 'framer-motion'
import { BadgeCheck, IndianRupee, Package, ShieldCheck } from 'lucide-react'
import { Section } from '../ui/Section'
import { staggerContainer, staggerItem, viewportOnce } from '../../lib/motion'
import { sectionBackdrops } from '../../content/media'

const points = [
  {
    n: '01',
    title: 'Genuine parts',
    text: 'OEM and OES lines with traceable SKUs — no grey-market surprises at install time.',
    icon: ShieldCheck,
  },
  {
    n: '02',
    title: 'Fair pricing',
    text: 'Itemized quotes before we bill. Transparent labour rates and parts margins you can read.',
    icon: IndianRupee,
  },
  {
    n: '03',
    title: 'Assured delivery',
    text: 'On-time dispatch with live tracking from warehouse to your door or bay.',
    icon: Package,
  },
  {
    n: '04',
    title: 'Quality promise',
    text: 'Rated technicians, warranty-backed work, and support that actually answers.',
    icon: BadgeCheck,
  },
]

export function WhyChooseUs() {
  return (
    <Section
      id="why"
      eyebrow="Trust"
      title="Why choose us"
      subtitle="Four pillars we refuse to compromise — built for drivers who expect receipts, not riddles."
      className="border-b border-steel/60 bg-slate"
      backdrop={sectionBackdrops.why}
    >
      <motion.ul
        className="grid items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {points.map(({ n, title, text, icon: Icon }) => (
          <motion.li key={n} variants={staggerItem} className="relative h-full">
            <p
              className="pointer-events-none absolute -left-1 -top-4 font-display text-7xl font-black leading-none text-steel/90 select-none sm:text-8xl"
              aria-hidden
            >
              {n}
            </p>
            <div className="relative flex h-full flex-col rounded-xl border border-steel/70 bg-ink p-6 pt-10 shadow-[0_10px_36px_-16px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_-18px_rgba(0,51,102,0.15)]">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </div>
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-fog">{title}</h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-mist">{text}</p>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  )
}
