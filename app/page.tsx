import BackgroundFX from '@/components/BackgroundFX'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Soluciones from '@/components/Soluciones'
import Beneficios from '@/components/Beneficios'
import ContactoCTA from '@/components/ContactoCTA'
import Footer from '@/components/Footer'
import WhatsAppFAB from '@/components/WhatsAppFAB'
import ChatWidget from '@/components/ChatWidget'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      <BackgroundFX />
      <Navbar />
      <Hero />
      <Soluciones />
      <Beneficios />
      <ContactoCTA />
      <Footer />
      <WhatsAppFAB />
      <ChatWidget />
    </div>
  )
}
