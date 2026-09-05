import BackgroundFX from '@/components/BackgroundFX'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Servicios from '@/components/Servicios'
import Especialidades from '@/components/Especialidades'
import Publicos from '@/components/Publicos'
import Proceso from '@/components/Proceso'
import ContactoCTA from '@/components/ContactoCTA'
import Footer from '@/components/Footer'
import WhatsAppFAB from '@/components/WhatsAppFAB'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      <BackgroundFX />
      <Navbar />
      <Hero />
      <Servicios />
      <Especialidades />
      <Publicos />
      <Proceso />
      <ContactoCTA />
      <Footer />
      <WhatsAppFAB />
    </div>
  )
}
