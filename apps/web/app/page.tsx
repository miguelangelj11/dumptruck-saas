import Nav from '@/components/landing/nav'
import Hero from '@/components/landing/hero'
import SocialProof from '@/components/landing/social-proof'
import Problem from '@/components/landing/problem'
import FeaturesSection from '@/components/landing/features-section'
import HowItWorks from '@/components/landing/how-it-works'
import Screenshots from '@/components/landing/screenshots'
import Testimonials from '@/components/landing/testimonials'
import PricingSection from '@/components/landing/pricing-section'
import FAQ from '@/components/landing/faq'
import FinalCTA from '@/components/landing/final-cta'
import Footer from '@/components/landing/footer'

export default function HomePage() {
  return (
    <div className="bg-white">
      <Nav />
      <Hero />
      <SocialProof />
      <Problem />
      <FeaturesSection />
      <HowItWorks />
      <Screenshots />
      <Testimonials />
      <PricingSection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
