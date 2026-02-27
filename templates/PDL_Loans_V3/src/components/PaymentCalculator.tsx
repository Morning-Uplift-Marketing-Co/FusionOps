import { useState, useEffect } from 'react';

interface Tier {
  label: string;
  months: number;
  apr: number;
  badge?: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  { label: 'Pay in 5', months: 5, apr: 0, badge: '0% Interest', highlight: true },
  { label: '12 Months', months: 12, apr: 15 },
  { label: '24 Months', months: 24, apr: 28 },
];

function calcPayment(amount: number, months: number, apr: number): number {
  if (apr === 0) return amount / months;
  const r = apr / 100 / 12;
  return (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export default function PaymentCalculator() {
  const [amount, setAmount] = useState(2000);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    const el = document.getElementById('calc-root');
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      id="calc-root"
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
        {/* Slider */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground">Loan Amount</span>
            <span className="text-2xl font-bold text-foreground">${amount.toLocaleString()}</span>
          </div>
          <input
            type="range" min={200} max={5000} step={100} value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-2.5 bg-muted rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>$200</span><span>$5,000</span>
          </div>
        </div>

        {/* Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((t) => {
            const mo = calcPayment(amount, t.months, t.apr);
            return (
              <div
                key={t.label}
                className={`relative rounded-xl p-5 border transition-all duration-300 ${
                  t.highlight
                    ? 'bg-secondary/5 border-secondary/30 ring-1 ring-secondary/20 shadow-md'
                    : 'bg-muted/30 border-border hover:border-primary/20 hover:shadow-sm'
                }`}
              >
                {t.badge && (
                  <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 text-white text-xs font-bold rounded-full shadow-sm"
                    style={{background:'linear-gradient(135deg,hsl(158 64% 42%),hsl(158 64% 36%))'}}
                  >
                    {t.badge}
                  </span>
                )}
                <p className="text-sm font-semibold text-muted-foreground mb-1">{t.label}</p>
                <p className="text-3xl font-bold text-foreground mb-1">
                  ${mo.toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                {t.apr > 0 && <p className="text-xs text-muted-foreground">{t.apr}% APR</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <a href="#apply" className="btn-cta inline-flex">Get My Personalized Rate</a>
        </div>
      </div>
    </div>
  );
}
