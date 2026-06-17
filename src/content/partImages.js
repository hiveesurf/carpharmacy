/**
 * Featured parts & “shop by category” tiles — files in `/public/images`.
 * Mix of product photography (PNG) and real automotive stock (JPG).
 */
import { publicUrl } from '../lib/publicUrl.js'

export const PART_IMAGES = {
  brakes: {
    src: publicUrl('images/car_ceramix_brake_pads.png'),
    alt: 'Ceramic brake pads — product photo',
  },
  oil: { src: publicUrl('images/oil.jpg'), alt: 'Engine oil level check — dipstick' },
  filter: { src: publicUrl('images/oem_air_filter.png'), alt: 'OEM air filter element' },
  led: { src: publicUrl('images/car_led_haedlamp.png'), alt: 'LED headlamp kit' },
  wipers: {
    src: publicUrl('images/premium-wiper-blade-set.png'),
    alt: 'Premium windscreen wiper blades',
  },
  coolant: { src: publicUrl('images/coolant.jpg'), alt: 'Radiator and engine cooling system' },
  spark: { src: publicUrl('images/spark.jpg'), alt: 'Spark plugs and ignition' },
  tire: { src: publicUrl('images/tyres.jpg'), alt: 'Performance tyre and alloy wheel' },
  alternator: { src: publicUrl('images/alternator.jpg'), alt: 'Alternator and serpentine drive belts' },
  clutch: { src: publicUrl('images/clutch.jpg'), alt: 'Transmission gears and shafts' },
  suspension: { src: publicUrl('images/suspension.jpg'), alt: 'Performance chassis — wheel, tyre and brakes' },
  belt: { src: publicUrl('images/belt.jpg'), alt: 'Drive belt and accessories' },
  mirror: { src: publicUrl('images/mirror.jpg'), alt: 'Car exterior — side mirror and profile' },
}

/** Preset image keys for admin product form (matches storefront tiles). */
export const PART_IMAGE_KEYS = Object.keys(PART_IMAGES)
