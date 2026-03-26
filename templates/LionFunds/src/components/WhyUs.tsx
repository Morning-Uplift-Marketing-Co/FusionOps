import { Card, CardContent } from "@/components/ui/card";
import { Users, Zap, ShieldCheck, Headphones } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "75+ Vetted Lenders",
    stat: "50 States Covered",
    desc: "Our extensive network of vetted lenders spans all 50 states, ensuring you get competitive offers no matter where you live. More lenders means better rates and higher approval odds for you.",
  },
  {
    icon: Zap,
    title: "Lightning-Fast Decisions",
    stat: "Avg. 2.7 Minutes",
    desc: "No waiting days for a response. Our technology matches you with lenders in minutes, not hours. Most applicants see their first offer within 3 minutes of submitting their information.",
  },
  {
    icon: ShieldCheck,
    title: "Your Privacy, Protected",
    stat: "256-bit Encryption",
    desc: "Your personal and financial data is protected with bank-level 256-bit SSL encryption. We never sell your data to third parties, and our initial check uses a soft inquiry that won't affect your credit score.",
  },
  {
    icon: Headphones,
    title: "Premium Support Team",
    stat: "7 Days a Week",
    desc: "Have questions? Our US-based support team is available 7 days a week to help you understand your options, walk you through the process, and answer any concerns about your funding.",
  },
];

const WhyUs = () => {
  return (
    <section id="why-us" className="bg-foreground py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-center font-heading text-3xl font-bold text-background sm:text-4xl mb-4">
          The LionFunds Difference
        </h2>
        <p className="text-center text-background/60 max-w-2xl mx-auto mb-12 text-sm sm:text-base">
          We're not just another loan marketplace. Here's why over 100,000 Americans trust LionFunds to find the right funding solution.
        </p>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="border-border bg-background/5">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-lg bg-lion-gold/10">
                    <Icon className="h-6 w-6 text-lion-gold" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-background text-lg">{f.title}</h3>
                    <span className="inline-block mt-1 text-xs font-semibold text-lion-gold bg-lion-gold/10 px-2 py-0.5 rounded-full">
                      {f.stat}
                    </span>
                    <p className="text-sm text-background/60 mt-2 leading-relaxed">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyUs;
