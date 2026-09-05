import { MessageCircle } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

export default function WhatsAppFAB() {
  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <a
        href={siteConfig.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Pedir más información por WhatsApp"
        className="relative group flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-[#25D366] rounded-full shadow-[0_0_20px_rgba(37,211,102,0.5)] hover:shadow-[0_0_30px_rgba(37,211,102,0.8)] transition-all hover:scale-110"
      >
        <div className="absolute inset-0 rounded-full border-2 border-[#25D366] animate-ping opacity-75" />
        <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white fill-current" />

        {/* Tooltip: hover-only, so it is hidden where there is no pointer. */}
        <div className="hidden md:block absolute right-full mr-4 bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
          Quiero más información
        </div>
      </a>
    </div>
  )
}
