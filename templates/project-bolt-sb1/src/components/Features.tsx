import { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  CreditCard,
  Clock,
  TrendingUp,
  DollarSign,
  Calendar,
  Lock,
} from 'lucide-react';
import { useInView } from '../hooks/useInView';

const features = [
  {
    icon: DollarSign,
    title: 'Installment Loans $200 – $10,000',
    description: 'Choose the exact amount you need for your pet\'s care, from a routine checkup to major surgery.',
  },
  {
    icon: ShieldCheck,
    title: 'All Credit Types Considered',
    description: 'We use a soft credit inquiry only — your credit score is never impacted when you apply. Data-driven lending decisions.',
  },
  {
    icon: Zap,
    title: 'Fast Lending Decision',
    description: 'Submit your request and most applicants receive a lending decision in moments — no lengthy waiting.',
  },
  {
    icon: TrendingUp,
    title: '0% APR Available',
    description: 'Qualified applicants on select plans can access 0% APR financing. Rates range from 0% up to 35.99% APR.',
  },
  {
    icon: Clock,
    title: 'Funds as Soon as Next Business Day',
    description: 'Once connected to a lender, funds are deposited directly to your bank account as soon as the following business day.',
  },
  {
    icon: Calendar,
    title: 'Flexible Repayment Terms',
    description: 'Repayment terms ranging from 61 to 2,190 days — choose an installment plan that fits your monthly budget.',
  },
  {
    icon: CreditCard,
    title: 'Multiple Payment Methods',
    description: 'Pay by credit card, debit card, or bank transfer. Manage your installment plan online, anytime.',
  },
  {
    icon: Lock,
    title: '256-Bit SSL Encryption',
    description: 'Your personal and financial data is protected by bank-grade 256-bit SSL encryption. We never sell your information.',
  },
];

export default function Features() {
  const { ref, inView } = useInView();
  const [amount, setAmount] = useState(3000);
  const [months, setMonths] = useState(12);
  const shouldAnimate = typeof window === 'undefined' ? true : inView;

  const apr = 9.99;
  const monthlyRate = apr / 100 / 12;
  const monthlyPayment =
    months === 0
      ? 0
      : (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  return (
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="text-center max-w-2xl mx-auto mb-14">
          <span
            className={`inline-block text-primary-soft font-semibold text-sm uppercase tracking-widest mb-3 transition-all duration-700 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Why BearLoanNow
          </span>
          <h2
            className={`text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 transition-all duration-700 delay-100 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Built for Pet Owners
          </h2>
          <p
            className={`text-lg text-gray-500 transition-all duration-700 delay-200 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Everything about our loans is designed to remove the financial stress from pet care decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, title, description }, i) => (
              <div
                key={title}
                className={`group flex gap-4 p-5 rounded-xl border border-gray-100 hover:border-primary-soft hover:bg-primary/40 transition-all duration-300 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="w-11 h-11 bg-primary group-hover:bg-primary rounded-xl flex items-center justify-center shrink-0 transition-colors">
                  <Icon size={22} className="text-primary-soft" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`bg-gradient-to-br from-teal-700 to-teal-900 rounded-2xl p-7 text-white shadow-xl transition-all duration-700 delay-300 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h3 className="text-xl font-bold mb-1">Loan Calculator</h3>
            <p className="text-primary-soft text-sm mb-6">Estimate your monthly payment</p>

            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-primary-soft">Loan Amount</label>
                <span className="text-2xl font-bold">${amount.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={200}
                max={10000}
                step={100}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-primary-soft mt-1">
                <span>$200</span>
                <span>$10,000</span>
              </div>
            </div>

            <div className="mb-7">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-medium text-primary-soft">Repayment Period</label>
                <span className="text-2xl font-bold">{months} mo</span>
              </div>
              <input
                type="range"
                min={2}
                max={72}
                step={1}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-primary-soft mt-1">
                <span>2 months</span>
                <span>72 months</span>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 mb-4">
              <div className="text-primary-soft text-xs mb-1">Estimated Monthly Payment</div>
              <div className="text-4xl font-extrabold text-accent">
                ${monthlyPayment.toFixed(2)}
              </div>
              <div className="text-primary-soft text-xs mt-1">Based on 9.99% APR example</div>
            </div>

            <div className="space-y-2 text-xs text-primary-soft border-t border-white/10 pt-4">
              <div className="flex justify-between">
                <span>Loan Amount</span>
                <span className="text-white">${amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>APR (example)</span>
                <span className="text-white">9.99%</span>
              </div>
              <div className="flex justify-between">
                <span>Total Repaid</span>
                <span className="text-white">${(monthlyPayment * months).toFixed(2)}</span>
              </div>
            </div>

            <p className="text-primary-soft text-xs mt-4">
              This is an estimate only. Actual rates vary by credit profile.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
