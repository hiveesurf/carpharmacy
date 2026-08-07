/**
 * Image URLs: Unsplash (fm=jpg) for hero/sections; part tiles use `/public/images` via PART_IMAGES.
 * SafeImg adds Picsum → inline SVG on error.
 */
import { PART_IMAGES } from './partImages.js'

const u = (id, w) => `https://images.unsplash.com/${id}?w=${w}&q=82&fm=jpg`

export const media = {
  hero: {
    src: u('photo-1492144534655-ae79c964c9d7', 1920),
    alt: 'Performance car — studio lighting',
  },
  about: {
    src: u('photo-1619642751034-765dfdf7c58e', 1200),
    alt: 'Mechanic in a workshop',
  },
  how: {
    select: {
      src: u('photo-1487754180451-c456f7a4fead', 800),
      alt: 'Parts desk',
    },
    book: {
      src: u('photo-1512941937669-90a1b58e7e9c', 800),
      alt: 'Booking on phone',
    },
    done: {
      src: u('photo-1449965408869-ebd3bac13764', 800),
      alt: 'Keys and car',
    },
  },
  parts: PART_IMAGES,
  why: {
    genuine: { src: u('photo-1487754180451-c456f7a4fead', 900), alt: 'Genuine parts shelf' },
    pricing: { src: u('photo-1552519507-da3b142c6e3d', 900), alt: 'Wheel and value' },
    doorstep: { src: u('photo-1449965408869-ebd3bac13764', 900), alt: 'Keys and car' },
    mechanics: { src: u('photo-1625047509168-a7026f36de04', 900), alt: 'Technician' },
  },
  cta: {
    src: u('photo-1492144534655-ae79c964c9d7', 1920),
    alt: 'Sports car',
  },
  footer: {
    src: u('photo-1558618666-fcd25c85cd64', 900),
    alt: 'Service garage',
  },
}

/**
 * Scroll-parallax backgrounds — one distinct automotive image per section theme.
 */
export const sectionBackdrops = {
  parts: { src: u('photo-1487754180451-c456f7a4fead', 1600), alt: 'Parts warehouse shelf' },
  buyCars: { src: u('photo-1503376780353-7e6692767b70', 1600), alt: 'Cars on the road' },
  about: { src: u('photo-1619642751034-765dfdf7c58e', 1600), alt: 'Mechanics at work' },
  how: { src: u('photo-1512941937669-90a1b58e7e9c', 1600), alt: 'Book service from your phone' },
  why: { src: u('photo-1486262715619-67b85e0b08d4', 1600), alt: 'Engine and precision work' },
  footer: { src: u('photo-1617814076367-b759cf79957e', 1600), alt: 'Garage and electrical bay' },
  ctaSection: { src: u('photo-1580273916550-e323be2ae537', 1600), alt: 'Wheel and motion' },
}
