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

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-900/80 backdrop-blur-md border-b border-white/10 py-4'
          : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        <a href="#hero" className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <Cpu className="w-8 h-8 text-cyan-400" />
            <div className="absolute inset-0 bg-cyan-400 blur-md opacity-50 animate-pulse" />
          </div>
          <span className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            NEXUS
          </span>
        </a>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
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
            className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full font-bold hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all transform hover:scale-105"
          >
            Cotizar proyecto
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Abrir menú"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-slate-900 border-b border-white/10 p-6 flex flex-col gap-4 shadow-2xl">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-left text-slate-300 hover:text-cyan-400 py-2 border-b border-white/5"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
