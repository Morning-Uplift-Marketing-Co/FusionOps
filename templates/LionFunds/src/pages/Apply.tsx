import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Apply = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-foreground/95 backdrop-blur-sm shadow-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🦁</span>
            <span className="font-heading text-xl font-bold text-background">LionFunds</span>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-royal-purple to-deep-purple py-16 sm:py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 border-lion-gold/30 bg-lion-gold/10 text-lion-gold font-heading text-sm px-4 py-1.5 rounded-full">
            👑 Secure Application
          </Badge>
          <h1 className="font-heading text-3xl font-extrabold text-foreground sm:text-5xl mb-4">
            Complete Your Application
          </h1>
          <p className="text-foreground/60 max-w-xl mx-auto text-sm sm:text-base">
            You're one step away from getting matched with the best installment plan for your needs. Fill out the form below to see your personalized offers.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-foreground/50">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-lion-gold" />256-bit Encrypted</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-lion-gold" />Takes ~60 seconds</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-lion-gold" />No credit impact</span>
          </div>
        </div>
      </section>

      {/* Application Form Placeholder */}
      <section className="bg-background py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 sm:p-12 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-lion-gold/10">
              <span className="text-3xl">🦁</span>
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
              Application Form Coming Soon
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto mb-8">
              Our secure application form will be available here shortly. In the meantime, you can call us directly to get started with your application.
            </p>
            <a
              href="tel:18005550144"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-lion-gold to-lion-gold-dark text-primary-foreground font-heading font-bold px-8 py-3 text-base hover:brightness-110 transition"
            >
              Call 1-800-555-0144
            </a>
          </div>
        </div>
      </section>

      {/* Disclosures */}
      <section className="bg-deep-purple py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center text-xs text-foreground/40 space-y-3 leading-relaxed">
            <p>APR: 0%–35.99% | Repayment: 61 days – 72 months | LionFunds is NOT a lender.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/privacy" className="hover:text-lion-gold transition-colors underline underline-offset-2">Privacy Policy</Link>
              <span className="text-foreground/20">|</span>
              <Link to="/terms" className="hover:text-lion-gold transition-colors underline underline-offset-2">Terms of Service</Link>
            </div>
            <p>© 2025 LionFunds. All rights reserved.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Apply;
