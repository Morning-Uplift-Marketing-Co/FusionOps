import { Card, CardContent } from "@/components/ui/card";
import { Home, Stethoscope, CreditCard, Car, Truck, GraduationCap, Wrench, Heart } from "lucide-react";

const useCases = [
  {
    icon: Home,
    title: "Home Improvement",
    desc: "Finance renovations, repairs, or upgrades to increase your home's value and comfort.",
  },
  {
    icon: Stethoscope,
    title: "Medical Expenses",
    desc: "Cover unexpected medical bills, dental work, or procedures not fully covered by insurance.",
  },
  {
    icon: CreditCard,
    title: "Debt Consolidation",
    desc: "Combine multiple high-interest debts into one manageable monthly payment at a lower rate.",
  },
  {
    icon: Car,
    title: "Auto Repairs",
    desc: "Get your vehicle back on the road quickly without draining your savings or emergency fund.",
  },
  {
    icon: Truck,
    title: "Moving Expenses",
    desc: "Cover deposits, moving services, and setup costs when relocating for a job or family needs.",
  },
  {
    icon: GraduationCap,
    title: "Education Costs",
    desc: "Invest in certifications, courses, or training programs to advance your career opportunities.",
  },
  {
    icon: Wrench,
    title: "Emergency Repairs",
    desc: "Handle urgent plumbing, electrical, or appliance failures that can't wait for your next paycheck.",
  },
  {
    icon: Heart,
    title: "Life Events",
    desc: "Fund weddings, family celebrations, or other important milestones without financial stress.",
  },
];

const UseCases = () => {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-center font-heading text-3xl font-bold text-foreground sm:text-4xl mb-4">
          What Can You Use Funds For?
        </h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12 text-sm sm:text-base">
          LionFunds helps Americans cover a wide range of personal expenses. Here are some of the most common reasons people use our service.
        </p>
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((uc) => {
            const Icon = uc.icon;
            return (
              <Card key={uc.title} className="border-border bg-card hover:border-lion-gold/30 transition-colors">
                <CardContent className="p-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-lion-gold/10">
                    <Icon className="h-6 w-6 text-lion-gold" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground text-sm">{uc.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{uc.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UseCases;
