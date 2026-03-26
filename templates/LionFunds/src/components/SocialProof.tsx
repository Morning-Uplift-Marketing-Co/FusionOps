import { Users, Building2, Clock, ShieldCheck, Award, TrendingUp } from "lucide-react";

const stats = [
  { icon: Users, value: "100,000+", label: "Americans Matched", desc: "Consumers connected with lenders through our platform" },
  { icon: Building2, value: "75+", label: "Vetted Lenders", desc: "Licensed lenders competing for your business" },
  { icon: Clock, value: "< 3 min", label: "Avg. Decision Time", desc: "From application to your first matched offer" },
  { icon: TrendingUp, value: "94%", label: "Match Rate", desc: "Of eligible applicants receive at least one offer" },
];

const badges = [
  { icon: ShieldCheck, label: "256-bit SSL Encrypted" },
  { icon: Award, label: "BBB Accredited" },
  { icon: Users, label: "50 States Covered" },
  { icon: ShieldCheck, label: "No Impact to Credit Score" },
];

const SocialProof = () => {
  return (
    <section className="bg-deep-purple py-16 sm:py-20">
      <div className="container mx-auto px-4">
        {/* Stats Grid */}
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-14">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="text-center rounded-xl bg-foreground/5 border border-foreground/10 p-6">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-lion-gold/15">
                  <Icon className="h-5 w-5 text-lion-gold" />
                </div>
                <p className="font-heading text-3xl font-extrabold text-lion-gold">{s.value}</p>
                <p className="font-heading font-semibold text-foreground text-sm mt-1">{s.label}</p>
                <p className="text-xs text-foreground/50 mt-1 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mx-auto flex flex-wrap items-center justify-center gap-4 max-w-3xl">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-full border border-lion-gold/20 bg-lion-gold/5 px-4 py-2"
              >
                <Icon className="h-4 w-4 text-lion-gold" />
                <span className="text-xs font-medium text-foreground/70">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
