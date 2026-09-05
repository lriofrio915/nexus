import type { LucideIcon } from 'lucide-react'
import {
  Stethoscope,
  LineChart,
  Globe,
  Smartphone,
  Bot,
  Plug,
  BarChart3,
  User,
  Briefcase,
  Building2,
  Search,
  PenTool,
  Code2,
  Rocket,
} from 'lucide-react'

export const siteConfig = {
  name: 'Nexus',
  legalName: 'Nexus Software Studio',
  tagline: 'Software a medida para tu negocio',
  description:
    'Nexus desarrolla proyectos de software a medida para personas, profesionales independientes y empresas. Especialistas en sistemas de gestión médica y en algoritmos de trading cuantitativo.',
  url: 'https://nexus-ia.com.es',
  whatsappNumber: '593978815129',
  /** Message pre-loaded in the WhatsApp composer when a visitor taps any contact link. */
  whatsappMessage: 'Quiero más información',
  get whatsappUrl() {
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(this.whatsappMessage)}`
  },
} as const

export const navItems = [
  { label: 'Servicios', href: '#servicios' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Proceso', href: '#proceso' },
  { label: 'Contacto', href: '#contacto' },
] as const

/** Headline numbers rendered under the hero. */
export const heroStats = [
  { value: 'A medida', label: 'Cero plantillas: el sistema se adapta a tu operación' },
  { value: '2 nichos', label: 'Gestión médica y trading cuantitativo' },
  { value: '24/7', label: 'Automatización e IA integradas al producto' },
] as const

/** Everything Nexus builds. Full Tailwind class names so they survive extraction. */
export interface Servicio {
  icon: LucideIcon
  title: string
  description: string
  iconBg: string
  iconText: string
  borderHover: string
}

export const servicios: Servicio[] = [
  {
    icon: Globe,
    title: 'Aplicaciones web',
    description:
      'Plataformas, portales y paneles internos con la lógica exacta de tu negocio: usuarios, permisos, reportes y facturación.',
    iconBg: 'bg-cyan-900/30',
    iconText: 'text-cyan-400',
    borderHover: 'hover:border-cyan-500/50',
  },
  {
    icon: Smartphone,
    title: 'Apps móviles y PWA',
    description:
      'Aplicaciones instalables para tus clientes o tu equipo en campo, con trabajo offline y notificaciones push.',
    iconBg: 'bg-blue-900/30',
    iconText: 'text-blue-400',
    borderHover: 'hover:border-blue-500/50',
  },
  {
    icon: Bot,
    title: 'Agentes de IA y automatización',
    description:
      'Asistentes en WhatsApp y web que agendan, cotizan, califican leads y ejecutan procesos dentro de tus propios sistemas.',
    iconBg: 'bg-purple-900/30',
    iconText: 'text-purple-400',
    borderHover: 'hover:border-purple-500/50',
  },
  {
    icon: Plug,
    title: 'Integraciones y APIs',
    description:
      'Conectamos lo que ya usas: facturación electrónica, pasarelas de pago, ERPs, brokers, historia clínica y hojas de cálculo.',
    iconBg: 'bg-emerald-900/30',
    iconText: 'text-emerald-400',
    borderHover: 'hover:border-emerald-500/50',
  },
  {
    icon: BarChart3,
    title: 'Datos y dashboards',
    description:
      'Modelos de datos, ETL y tableros en tiempo real para decidir con números en vez de intuición.',
    iconBg: 'bg-amber-900/30',
    iconText: 'text-amber-400',
    borderHover: 'hover:border-amber-500/50',
  },
  {
    icon: Code2,
    title: 'Rescate y modernización',
    description:
      'Tomamos software heredado o proyectos a medio terminar, los estabilizamos y los llevamos a producción.',
    iconBg: 'bg-rose-900/30',
    iconText: 'text-rose-400',
    borderHover: 'hover:border-rose-500/50',
  },
]

/** The two deep-expertise verticals. */
export interface Especialidad {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  features: string[]
  accentText: string
  accentBg: string
  glow: string
  borderHover: string
}

export const especialidades: Especialidad[] = [
  {
    icon: Stethoscope,
    eyebrow: 'Especialidad 01',
    title: 'Software de gestión médica',
    description:
      'Sistemas para consultorios, clínicas y profesionales de la salud: toda la operación en un solo lugar, del primer contacto al cobro.',
    features: [
      'Historia clínica electrónica configurable por especialidad',
      'Agenda multi-profesional con recordatorios automáticos',
      'Ficha de paciente, evolución, recetas y certificados',
      'Facturación, convenios y control de caja',
      'Teleconsulta y portal del paciente',
      'Trazabilidad y control de acceso por rol',
    ],
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-900/30',
    glow: 'bg-cyan-500/20',
    borderHover: 'hover:border-cyan-500/50',
  },
  {
    icon: LineChart,
    eyebrow: 'Especialidad 02',
    title: 'Algoritmos de trading cuantitativo',
    description:
      'Investigación, backtesting e implementación de estrategias sistemáticas, con la infraestructura para operarlas en vivo.',
    features: [
      'Diseño de estrategias y generación de señales',
      'Backtesting con costos, slippage y walk-forward',
      'Gestión de riesgo, sizing y control de drawdown',
      'Conexión a brokers y exchanges vía API',
      'Ejecución automatizada y monitoreo en vivo',
      'Reportes de performance y métricas de portafolio',
    ],
    accentText: 'text-purple-400',
    accentBg: 'bg-purple-900/30',
    glow: 'bg-purple-500/20',
    borderHover: 'hover:border-purple-500/50',
  },
]

/** Audience strip: Nexus works with all of these. */
export interface Publico {
  icon: LucideIcon
  title: string
  description: string
  iconText: string
}

export const publicos: Publico[] = [
  {
    icon: User,
    title: 'Personas',
    description: 'Una idea concreta que necesita convertirse en producto real.',
    iconText: 'text-cyan-400',
  },
  {
    icon: Briefcase,
    title: 'Profesionales independientes',
    description: 'Médicos, traders, consultores y estudios que quieren dejar de operar a mano.',
    iconText: 'text-purple-400',
  },
  {
    icon: Building2,
    title: 'Empresas',
    description: 'Equipos que necesitan sistemas propios, integrados y que escalen.',
    iconText: 'text-blue-400',
  },
]

/** How a project runs, start to finish. */
export interface Paso {
  icon: LucideIcon
  step: string
  title: string
  description: string
}

export const proceso: Paso[] = [
  {
    icon: Search,
    step: '01',
    title: 'Diagnóstico',
    description:
      'Entendemos tu operación, los cuellos de botella y qué debe hacer el software. Sin costo.',
  },
  {
    icon: PenTool,
    step: '02',
    title: 'Propuesta y alcance',
    description:
      'Definimos funcionalidades, tiempos y precio cerrado. Sabes qué recibes antes de empezar.',
  },
  {
    icon: Code2,
    step: '03',
    title: 'Desarrollo por entregas',
    description:
      'Trabajamos en ciclos cortos con entregas revisables. Ves avances reales, no promesas.',
  },
  {
    icon: Rocket,
    step: '04',
    title: 'Puesta en marcha y soporte',
    description:
      'Despliegue, migración de datos, capacitación y acompañamiento posterior.',
  },
]

/** Tech mentioned in the stack strip. */
export const stack = [
  'TypeScript',
  'Next.js',
  'React',
  'Python',
  'PostgreSQL',
  'Supabase',
  'Node.js',
  'pandas',
  'Docker',
  'APIs de brokers',
  'LLMs',
  'WhatsApp API',
] as const

/** Demo conversation rendered next to the process section. */
export const chatDemo: { from: 'user' | 'bot'; text: string }[] = [
  { from: 'user', text: 'Necesito un sistema para mi consultorio: agenda, historia clínica y facturación.' },
  {
    from: 'bot',
    text: '¡Perfecto! Eso es exactamente lo que construimos. ¿Cuántos profesionales atienden y qué usas hoy para agendar?',
  },
  { from: 'user', text: 'Somos 3 médicos y hoy usamos cuadernos y WhatsApp.' },
  {
    from: 'bot',
    text: 'Entonces conviene arrancar con agenda + ficha del paciente y sumar facturación en la segunda entrega. Te armo la propuesta con alcance y tiempos. ¿A qué correo la envío?',
  },
]
