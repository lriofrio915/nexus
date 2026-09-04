import type { LucideIcon } from 'lucide-react'
import { Stethoscope, Activity, UtensilsCrossed, Zap, Globe, Bot } from 'lucide-react'

export const siteConfig = {
  name: 'Nexus',
  legalName: 'Nexus AI Automation',
  tagline: 'El Futuro de la Automatización',
  description:
    'Creamos asistentes virtuales inteligentes en WhatsApp que trabajan mientras duermes. Atención médica, reservas en restaurantes y soporte al cliente, todo automatizado.',
  url: 'https://nexus-ia.com.es',
  whatsappNumber: '593978815129',
  get whatsappUrl() {
    return `https://wa.me/${this.whatsappNumber}`
  },
} as const

/**
 * The old SPA also listed `Servicios`, which pointed at a `#servicios` anchor
 * that never existed — clicking it did nothing. Dropped until that section exists.
 */
export const navItems = [
  { label: 'Soluciones', href: '#soluciones' },
  { label: 'Beneficios', href: '#beneficios' },
  { label: 'Contacto', href: '#contacto' },
] as const

/** Color accent per solution card. Full class names so Tailwind can statically extract them. */
export interface Solucion {
  icon: LucideIcon
  title: string
  description: string
  features: string[]
  borderHover: string
  gradientFrom: string
  iconBg: string
  iconText: string
  checkText: string
}

export const soluciones: Solucion[] = [
  {
    icon: Stethoscope,
    title: 'Salud & Medicina',
    description:
      'Para médicos y clínicas. Agenda citas, realiza triaje básico, envía recordatorios y responde dudas frecuentes de pacientes 24/7.',
    features: ['Gestión de Agenda', 'Pre-diagnóstico IA'],
    borderHover: 'hover:border-cyan-500/50',
    gradientFrom: 'from-cyan-500/10',
    iconBg: 'bg-cyan-900/30',
    iconText: 'text-cyan-400',
    checkText: 'text-cyan-500',
  },
  {
    icon: Activity,
    title: 'Nutrición & Bienestar',
    description:
      'Seguimiento de pacientes, envío de planes alimenticios, recordatorios de hidratación y resolución de dudas sobre alimentos.',
    features: ['Tracking de Progreso', 'Tips Saludables Diarios'],
    borderHover: 'hover:border-green-500/50',
    gradientFrom: 'from-green-500/10',
    iconBg: 'bg-green-900/30',
    iconText: 'text-green-400',
    checkText: 'text-green-500',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurantes',
    description:
      'El mesero virtual perfecto. Muestra el menú, toma pedidos, gestiona reservas y responde preguntas sobre alérgenos al instante.',
    features: ['Pedidos Automatizados', 'Gestión de Mesas'],
    borderHover: 'hover:border-purple-500/50',
    gradientFrom: 'from-purple-500/10',
    iconBg: 'bg-purple-900/30',
    iconText: 'text-purple-400',
    checkText: 'text-purple-500',
  },
]

export interface Beneficio {
  icon: LucideIcon
  title: string
  description: string
  iconBg: string
  iconText: string
}

export const beneficios: Beneficio[] = [
  {
    icon: Zap,
    title: 'Velocidad Inhumana',
    description:
      'Respuestas en milisegundos. Tus clientes nunca más verán el mensaje "Escribiendo...".',
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
  },
  {
    icon: Globe,
    title: 'Disponibilidad Global',
    description:
      'Tu negocio abierto 24/7/365. Captura ventas y citas incluso mientras duermes.',
    iconBg: 'bg-purple-500/20',
    iconText: 'text-purple-400',
  },
  {
    icon: Bot,
    title: 'Inteligencia Adaptativa',
    description:
      'Nuestros bots aprenden de tu negocio. No son simples respuestas automáticas, es IA real.',
    iconBg: 'bg-cyan-500/20',
    iconText: 'text-cyan-400',
  },
]

/** Demo conversation rendered in the Beneficios section. */
export const chatDemo: { from: 'user' | 'bot'; text: string }[] = [
  { from: 'user', text: 'Hola, quisiera agendar una cita con el nutricionista.' },
  {
    from: 'bot',
    text: '¡Hola! Claro que sí. Tengo disponibilidad para mañana a las 10:00 AM o el jueves a las 3:00 PM. ¿Cuál prefieres? 🤖',
  },
  { from: 'user', text: 'Mañana a las 10 está perfecto.' },
  {
    from: 'bot',
    text: 'Listo ✅. Agendado para mañana a las 10:00 AM. Te enviaré un recordatorio 1 hora antes.',
  },
]
