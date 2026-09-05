'use client'

import { useState, useEffect } from 'react'
import { Cpu, Menu, X } from 'lucide-react'
import { navItems, siteConfig } from '@/lib/site-config'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // The dropdown is taller than a small phone in landscape, so the page behind
  // it is locked while it is open and the panel itself scrolls.
  useEffect(() => {
    if (!isMobileMenuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isMobileMenuOpen])

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-900/80 backdrop-blur-md border-b border-white/10 py-3 sm:py-4'
          : 'bg-transparent py-4 sm:py-6'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 flex justify-between items-center gap-4">
        <a href="#hero" className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <Cpu className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" />
            <div className="absolute inset-0 bg-cyan-400 blur-md opacity-50 animate-pulse" />
          </div>
          <span className="text-xl sm:text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            NEXUS
          </span>
        </a>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-6 lg:gap-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-slate-300 hover:text-cyan-400 transition-colors text-sm uppercase tracking-widest font-medium"
            >
              {item.label}
            </a>
          ))}
          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 lg:px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full font-bold text-sm whitespace-nowrap hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all transform hover:scale-105"
          >
            Cotizar proyecto
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden text-white p-2 -mr-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full max-h-[calc(100svh-4rem)] overflow-y-auto bg-slate-900 border-b border-white/10 px-4 py-4 flex flex-col gap-1 shadow-2xl">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-300 hover:text-cyan-400 py-3 border-b border-white/5"
            >
              {item.label}
            </a>
          ))}
          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMobileMenuOpen(false)}
            className="mt-3 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full font-bold text-center"
          >
            Cotizar proyecto
          </a>
        </div>
      )}
    </nav>
  )
}
