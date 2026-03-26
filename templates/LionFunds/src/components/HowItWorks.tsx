import { Button } from "@/components/ui/button";
import { MapPin, BarChart3, Banknote } from "lucide-react";

const steps = [
  {
    num: "1",
    icon: MapPin,
    title: "Enter Your ZIP Code",
    desc: "Tell us where you are so we can find the best offers available in your area. This takes just 10 seconds and doesn't affect your credit score.",
  },
  {
    num: "2",
    icon: BarChart3,
    title: "Compare Your Offers",
    desc: "Review matched installment plans side-by-side with transparent APR rates, monthly payments, and repayment terms. No hidden fees, no surprises.",
  },
  {
    num: "3",
    icon: Banknote,
    title: "Get Funded Fast",
    desc: "Choose the plan that fits your budget and complete your application. Approved funds can be deposited into your bank account as fast as the next business day.",
  },
];

const HowItWorks = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section id="how-it-works" className="bg-section-light py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-center font-heading text-3xl font-bold text-deep-purple sm:text-4xl mb-4">
          How It Works
        </h2>
        <p className="text-center text-deep-purple/60 max-w-2xl mx-auto mb-14 text-sm sm:text-base">
          Getting matched with the right funding takes just 60 seconds. Here's the simple 3-step process.
        </p>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 sm:grid-cols-3 relative">
            {/* Connector line (desktop) */}
            <div className="hidden sm:block absolute top-7 left-[16.67%] right-[16.67%] h-0.5 bg-deep-purple/15" />

            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="text-center relative">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-royal-purple text-foreground font-heading text-xl font-bold relative z-10">
                    {s.num}
                  </div>
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
                    <Icon className="h-6 w-6 text-deep-purple/70" />
                  </div>
                  <h3 className="font-heading font-bold text-deep-purple text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm text-deep-purple/70 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-14">
          <p className="text-deep-purple/70 font-heading font-semibold text-lg mb-4">
            Ready to find your best offer?
          </p>
          <a href="/apply">
            <Button className="rounded-xl bg-gradient-to-r from-lion-gold to-lion-gold-dark text-primary-foreground font-heading font-bold px-10 py-3.5 h-auto text-base hover:brightness-110">
              Get Started Now
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
