import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, BadgeCheck } from "lucide-react";

const testimonials = [
  {
    initials: "LR",
    name: "Luis R.",
    location: "Dallas, TX",
    text: "Needed $5,000 for a home repair emergency. LionFunds matched me with a great rate and I had funds within 24 hours. Premium service — couldn't believe how smooth the process was.",
    amount: "$5,000",
    stars: 5,
  },
  {
    initials: "AK",
    name: "Amy K.",
    location: "Seattle, WA",
    text: "Other sites gave me the runaround. LionFunds was direct, honest, and fast. No hidden fees, no surprises. I was approved in under 3 minutes. 10/10 would recommend to anyone.",
    amount: "$8,500",
    stars: 5,
  },
  {
    initials: "MJ",
    name: "Marcus J.",
    location: "Atlanta, GA",
    text: "I was worried about my credit score being affected. LionFunds used a soft check first, so I could see my options without any impact. Ended up getting $12,000 at a rate way better than my credit card.",
    amount: "$12,000",
    stars: 5,
  },
  {
    initials: "SP",
    name: "Sarah P.",
    location: "Denver, CO",
    text: "Used the funds to consolidate three credit cards into one manageable payment. My monthly obligation dropped by almost 40%. The whole process took less than a day from application to funding.",
    amount: "$15,000",
    stars: 5,
  },
  {
    initials: "DW",
    name: "David W.",
    location: "Phoenix, AZ",
    text: "Had a medical bill I couldn't pay upfront. LionFunds connected me with a lender who offered 0% APR for the first 5 months. That breathing room made all the difference for my family.",
    amount: "$3,500",
    stars: 5,
  },
  {
    initials: "JT",
    name: "Jessica T.",
    location: "Miami, FL",
    text: "I needed funds quickly for a car repair so I could keep getting to work. Applied on Monday morning, had money in my account Tuesday. The customer support team was incredibly helpful throughout.",
    amount: "$4,200",
    stars: 4,
  },
];

const Testimonials = () => {
  return (
    <section className="bg-deep-purple py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 text-lion-gold fill-lion-gold" />
            ))}
          </div>
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Hear From Our Community
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <BadgeCheck className="h-5 w-5 text-lion-gold" />
            <span className="text-sm text-foreground/60 font-medium">Verified Reviews from Real Customers</span>
          </div>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.initials} className="border-lion-gold/30 bg-foreground/5 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-11 w-11 border-2 border-lion-gold/50">
                    <AvatarFallback className="bg-royal-purple text-foreground font-heading font-bold text-sm">
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-heading font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 mb-3">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 text-lion-gold fill-lion-gold" />
                  ))}
                  {[...Array(5 - t.stars)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 text-muted-foreground" />
                  ))}
                  <span className="ml-2 text-xs text-lion-gold font-medium">Funded {t.amount}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 italic">"{t.text}"</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-xl bg-lion-gold/10 border border-lion-gold/30 px-6 py-3 text-center text-sm text-lion-gold font-medium">
          APR 0%–35.99% | Terms 61–72 months
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
