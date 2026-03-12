import { useState, useEffect } from 'react';
import { Menu, X, Phone, PawPrint } from 'lucide-react';

const brand = import.meta.env.PUBLIC_BRAND || 'Your Brand';
const phone = import.meta.env.PUBLIC_PHONE || '';
const cta = import.meta.env.PUBLIC_CTA || 'Apply Now';
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';
const ctaHref = voluumClickUrl || '#apply';

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'FAQ', href: '#faq' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div className="bg-teal-900 text-teal-100 text-sm py-2 px-4 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Phone size={13} />
            {phone && <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>}
            <span className="mx-3 opacity-30">|</span>
            <span>Mon–Fri, 9:00 AM – 6:00 PM ET</span>
          </span>
          <span className="text-teal-300 font-medium">No hard credit check &bull; Instant decisions &bull; 4.9/5 stars</span>
        </div>
      </div>

      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100'
            : 'bg-white/98 backdrop-blur-sm border-b border-gray-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-teal-700 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-teal-600 transition-colors">
                <PawPrint size={20} className="text-white" />
              </div>
              <span className="text-xl font-800 text-gray-900 tracking-tight">
                {brand}
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-all"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-teal-700 transition-colors"
                >
                  <Phone size={15} />
                  {phone}
                </a>
              )}
              <a
                href={ctaHref}
                onClick={(e) => { if (ctaHref === '#apply') { e.preventDefault(); handleNavClick('#apply'); } }}
                className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
              >
                {cta}
              </a>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-all"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-2 pb-1 border-t border-gray-100 mt-2 space-y-2">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-all"
                  >
                    <Phone size={15} />
                    {phone}
                  </a>
                )}
                <a
                  href={ctaHref}
                  onClick={(e) => { if (ctaHref === '#apply') { e.preventDefault(); handleNavClick('#apply'); } }}
                  className="w-full block text-center bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  {cta} — No Hard Credit Check
                </a>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
