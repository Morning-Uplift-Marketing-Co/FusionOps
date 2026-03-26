import { Badge } from "@/components/ui/badge";
import ZipForm from "@/components/ZipForm";
import { Check, Star, Lock, Zap, Crown } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-royal-purple to-deep-purple py-16 sm:py-24">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--lion-gold)/0.08),transparent_70%)]" />
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="container relative mx-auto px-4 text-center">
        <Badge className="mb-6 border-lion-gold/30 bg-lion-gold/10 text-lion-gold font-heading text-sm px-4 py-1.5 rounded-full">
          👑 Premium Funding — Up to $25,000
        </Badge>

        <h1 className="mx-auto max-w-3xl font-heading text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-6xl">
          Take Control of Your Finances.{" "}
          <span className="text-lion-gold">Get the Funds You Deserve.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-foreground/70 sm:text-lg">
          Flexible installment plans from 75+ trusted lenders. No hard credit check to see your offers. Apply in 60 seconds.
        </p>

        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-foreground/80">
          {["Up to $25,000", "60-Second Application", "No Hidden Fees"].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-lion-gold" />
              {item}
            </span>
          ))}
        </div>

        {/* ZIP Form */}
        <div className="mx-auto mt-10 max-w-lg">
          <div className="bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-2xl p-6 sm:p-8">
            <p className="text-foreground/90 font-heading font-semibold text-lg mb-4">
              Check Your Offers — Free & No Impact to Credit
            </p>
            <ZipForm />
          </div>
          <p className="mt-3 text-[11px] text-foreground/50">
            APR: 0%–35.99% | Repayment: 61 days – 72 months | Not a lender
          </p>
          <p className="mt-1 text-xs text-foreground/50">
            Join 100,000+ Americans who chose LionFunds
          </p>
        </div>

        {/* Trust Bar */}
        <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground/60 sm:text-sm">
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-lion-gold fill-lion-gold" />
            4.8/5 Rating
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-lion-gold" />
            256-bit SSL
          </span>
          <span className="flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-lion-gold" />
            Premium Network
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-lion-gold" />
            Instant Match
          </span>
        </div>
      </div>
    </section>
  );
};

export default Hero;
