import { motion } from 'framer-motion'
import { media } from '../../content/media'
import { SafeImg } from '../ui/SafeImg'
import { Section } from '../ui/Section'
import { staggerContainer, viewportOnce } from '../../lib/motion'
import { sectionBackdrops } from '../../content/media'

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

const reviews = [
  {
    quote:
      'Booking was two taps. The mechanic sent photos of the underbody — I’ve never had that level of transparency.',
    name: 'Aditi Rao',
    role: 'Hyundai i20 owner',
    avatar: media.testimonials.aditi,
  },
  {
    quote:
      'AC died in May. They came to my office parking, fixed the relay, and I didn’t miss a single meeting.',
    name: 'Rahul Verma',
    role: 'Honda City owner',
    avatar: media.testimonials.rahul,
  },
  {
    quote:
      'Paint match is indistinguishable from factory. The digital estimate made insurance painless.',
    name: 'Meera Shah',
    role: 'VW Taigun owner',
    avatar: media.testimonials.meera,
  },
]

export function Testimonials() {
  return (
    <Section
      id="reviews"
      eyebrow="Field notes"
      title="What drivers say"
      subtitle="Synthetic quotes for this demo — the bar we’re designing toward is real."
      className="border-b border-steel/60 bg-ink"
      backdrop={sectionBackdrops.reviews}
    >
      <motion.ul
        className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3 lg:gap-6"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {reviews.map((r) => (
          <motion.li
            key={r.name}
            variants={cardVariants}
            className="m-0 h-full translate-y-0 self-stretch"
          >
            <figure className="relative flex h-full flex-col overflow-hidden rounded-xl border border-steel/70 bg-slate/40 p-8 pt-12 shadow-[0_10px_36px_-16px_rgba(0,0,0,0.08)]">
              <span
                className="pointer-events-none absolute left-4 top-4 font-display text-8xl font-black leading-none text-accent/[0.12]"
                aria-hidden
              >
                “
              </span>
              <div className="relative mb-6 flex items-center gap-4">
                <SafeImg
                  src={r.avatar.src}
                  alt={r.avatar.alt}
                  fw={200}
                  fh={200}
                  className="h-14 w-14 rounded-full border-2 border-accent/40 object-cover"
                  width={112}
                  height={112}
                  loading="lazy"
                />
                <div>
                  <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-fog">{r.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-hud">{r.role}</p>
                </div>
              </div>
              <blockquote className="relative border-l-2 border-accent/35 pl-4 font-sans text-base font-normal leading-relaxed text-mist md:text-[1.05rem]">
                {r.quote}
              </blockquote>
              <figcaption className="mt-auto border-t border-fog/10 pt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist/80">Verified purchase flow · demo</p>
              </figcaption>
            </figure>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  )
}
