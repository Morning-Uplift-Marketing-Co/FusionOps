import { Button } from "@/components/ui/button";
import { Phone, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks: { label: string; href: string }[] = [];


const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-0 z-50 bg-foreground/95 backdrop-blur-sm shadow-md border-b border-border">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦁</span>
          <span className="font-heading text-xl font-bold text-background">
            LionFunds
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="text-sm font-medium text-background/70 hover:text-background transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <a
            href="tel:18005550144"
            className="hidden items-center gap-1.5 text-sm font-medium text-background/70 hover:text-background transition-colors sm:flex"
          >
            <Phone className="h-4 w-4" />
            1-800-555-0144
          </a>
          <a href="/apply">
            <Button className="rounded-full bg-lion-gold text-primary-foreground font-heading font-semibold hover:bg-lion-gold-dark px-5">
              Get Funded
            </Button>
          </a>
          <button
            className="md:hidden text-background"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden bg-foreground/95 border-t border-border px-4 pb-4">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="block w-full text-left py-3 text-sm font-medium text-background/70 hover:text-background transition-colors border-b border-border/30 last:border-0"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
