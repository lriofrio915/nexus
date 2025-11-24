import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  MessageCircle, 
  Stethoscope, 
  UtensilsCrossed, 
  Activity, 
  Zap, 
  CheckCircle, 
  ArrowRight, 
  Menu, 
  X,
  Cpu,
  Globe
} from 'lucide-react';

const NexusLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Detect scroll for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[100px]"></div>
        {/* Grid Pattern overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/80 backdrop-blur-md border-b border-white/10 py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('hero')}>
            <div className="relative">
              <Cpu className="w-8 h-8 text-cyan-400" />
              <div className="absolute inset-0 bg-cyan-400 blur-md opacity-50 animate-pulse"></div>
            </div>
            <span className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              NEXUS
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {['Servicios', 'Soluciones', 'Beneficios', 'Contacto'].map((item) => (
              <button 
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="text-slate-300 hover:text-cyan-400 transition-colors text-sm uppercase tracking-widest font-medium"
              >
                {item}
              </button>
            ))}
            <button 
              onClick={() => window.open('https://wa.me/593978815129', '_blank')}
              className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full font-bold hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all transform hover:scale-105"
            >
              Cotizar Ahora
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-slate-900 border-b border-white/10 p-6 flex flex-col gap-4 shadow-2xl">
            {['Servicios', 'Soluciones', 'Beneficios', 'Contacto'].map((item) => (
              <button 
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                className="text-left text-slate-300 hover:text-cyan-400 py-2 border-b border-white/5"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative z-10 min-h-screen flex items-center justify-center pt-20">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm text-cyan-300 tracking-wider">IA DE ÚLTIMA GENERACIÓN</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            El Futuro de la <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
              Automatización
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Creamos asistentes virtuales inteligentes en WhatsApp que trabajan mientras duermes. 
            Atención médica, reservas en restaurantes y soporte al cliente, todo automatizado.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => window.open('https://wa.me/593978815129', '_blank')}
              className="group relative px-8 py-4 bg-cyan-500 text-black font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(6,182,212,0.6)]"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 transform -translate-x-full skew-x-12 group-hover:animate-shine"></div>
              <span className="flex items-center gap-2">
                Crear mi Asistente <Bot className="w-5 h-5" />
              </span>
            </button>
            <button 
              onClick={() => scrollToSection('soluciones')}
              className="px-8 py-4 bg-transparent border border-white/20 text-white font-bold text-lg rounded-full hover:bg-white/5 transition-all flex items-center gap-2"
            >
              Ver Demos <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Services/Solutions Grid */}
      <section id="soluciones" className="relative z-10 py-24 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Soluciones Especializadas</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Nuestros agentes de IA están entrenados específicamente para tu industria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Medical Card */}
            <div className="group relative p-8 rounded-2xl bg-slate-800/50 border border-white/10 hover:border-cyan-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="w-14 h-14 bg-cyan-900/30 rounded-xl flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">Salud & Medicina</h3>
              <p className="text-slate-400 mb-6">
                Para médicos y clínicas. Agenda citas, realiza triaje básico, envía recordatorios y responde dudas frecuentes de pacientes 24/7.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-500" /> Gestión de Agenda</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-500" /> Pre-diagnóstico IA</li>
              </ul>
            </div>

            {/* Nutrition Card */}
            <div className="group relative p-8 rounded-2xl bg-slate-800/50 border border-white/10 hover:border-green-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="w-14 h-14 bg-green-900/30 rounded-xl flex items-center justify-center mb-6 text-green-400 group-hover:scale-110 transition-transform">
                <Activity className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">Nutrición & Bienestar</h3>
              <p className="text-slate-400 mb-6">
                Seguimiento de pacientes, envío de planes alimenticios, recordatorios de hidratación y resolución de dudas sobre alimentos.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Tracking de Progreso</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Tips Saludables Diarios</li>
              </ul>
            </div>

            {/* Restaurant Card */}
            <div className="group relative p-8 rounded-2xl bg-slate-800/50 border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="w-14 h-14 bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                <UtensilsCrossed className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">Restaurantes</h3>
              <p className="text-slate-400 mb-6">
                El mesero virtual perfecto. Muestra el menú, toma pedidos, gestiona reservas y responde preguntas sobre alérgenos al instante.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Pedidos Automatizados</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Gestión de Mesas</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Feature Section */}
      <section id="beneficios" className="relative z-10 py-20 border-y border-white/5 bg-slate-950">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                ¿Por qué elegir <span className="text-cyan-400">Nexus</span>?
              </h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Velocidad Inhumana</h4>
                    <p className="text-slate-400">Respuestas en milisegundos. Tus clientes nunca más verán el mensaje "Escribiendo...".</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Disponibilidad Global</h4>
                    <p className="text-slate-400">Tu negocio abierto 24/7/365. Captura ventas y citas incluso mientras duermes.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Inteligencia Adaptativa</h4>
                    <p className="text-slate-400">Nuestros bots aprenden de tu negocio. No son simples respuestas automáticas, es IA real.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
                {/* Chat Simulation */}
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">U</div>
                    <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none max-w-[80%] text-slate-300">
                      Hola, quisiera agendar una cita con el nutricionista.
                    </div>
                  </div>
                  <div className="flex items-end gap-2 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-bold">N</div>
                    <div className="bg-cyan-900/40 border border-cyan-500/30 p-3 rounded-2xl rounded-br-none max-w-[80%] text-cyan-100">
                      ¡Hola! Claro que sí. Tengo disponibilidad para mañana a las 10:00 AM o el jueves a las 3:00 PM. ¿Cuál prefieres? 🤖
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">U</div>
                    <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none max-w-[80%] text-slate-300">
                      Mañana a las 10 está perfecto.
                    </div>
                  </div>
                  <div className="flex items-end gap-2 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-bold">N</div>
                    <div className="bg-cyan-900/40 border border-cyan-500/30 p-3 rounded-2xl rounded-br-none max-w-[80%] text-cyan-100">
                      Listo ✅. Agendado para mañana a las 10:00 AM. Te enviaré un recordatorio 1 hora antes.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Contact Section */}
      <section id="contacto" className="relative z-10 py-24 text-center">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 p-12 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px]"></div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">¿Listo para el siguiente nivel?</h2>
            <p className="text-xl text-slate-400 mb-10">
              Deja de perder clientes por no responder a tiempo. Automatiza tu WhatsApp hoy mismo con Nexus.
            </p>
            
            <button 
              onClick={() => window.open('https://wa.me/593978815129', '_blank')}
              className="px-10 py-5 bg-white text-slate-900 font-bold text-xl rounded-full hover:bg-cyan-50 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              Comenzar Ahora
            </button>
            <p className="mt-6 text-sm text-slate-500">Consulta gratuita inicial • Implementación rápida</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-slate-950 py-12 border-t border-white/5 text-slate-400 text-sm">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
             <Cpu className="w-6 h-6 text-cyan-600" />
             <span className="text-xl font-bold text-white">NEXUS</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-cyan-400 transition-colors">Términos</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Soporte</a>
          </div>
          <div>
            © {new Date().getFullYear()} Nexus AI Automation.
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => window.open('https://wa.me/593978815129', '_blank')}
          className="relative group flex items-center justify-center w-16 h-16 bg-[#25D366] rounded-full shadow-[0_0_20px_rgba(37,211,102,0.5)] hover:shadow-[0_0_30px_rgba(37,211,102,0.8)] transition-all hover:scale-110"
        >
          <div className="absolute inset-0 rounded-full border-2 border-[#25D366] animate-ping opacity-75"></div>
          <MessageCircle className="w-8 h-8 text-white fill-current" />
          
          {/* Tooltip */}
          <div className="absolute right-full mr-4 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
            ¡Hablemos por WhatsApp!
          </div>
        </button>
      </div>

    </div>
  );
};

export default NexusLanding;