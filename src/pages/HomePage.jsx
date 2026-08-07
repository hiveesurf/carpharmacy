import { AboutStrip } from '../components/sections/AboutStrip'
import { CTABanner } from '../components/sections/CTABanner'
import { Hero } from '../components/sections/Hero'
import { HowItWorks } from '../components/sections/HowItWorks'
import { PopularBrands } from '../components/sections/PopularBrands'
import { ShopByCategories } from '../components/sections/ShopByCategories'
import { WhyChooseUs } from '../components/sections/WhyChooseUs'
import { PartsHub } from '../components/parts/PartsHub'

export function HomePage() {
  return (
    <>
      <Hero />
      <ShopByCategories />
      <PartsHub />
      <PopularBrands />
      <AboutStrip />
      <HowItWorks />
      <WhyChooseUs />
      <CTABanner />
    </>
  )
}
