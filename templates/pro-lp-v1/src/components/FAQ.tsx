import { useState } from 'react';

const FAQS = [
  { q: 'Will checking my rate affect my credit score?', a: 'No. We use a soft credit inquiry which does not affect your credit score. A hard inquiry may occur only if you proceed with a loan offer.' },
  { q: 'How much can I borrow?', a: 'Loan amounts range from $100 to $5,000 depending on your state, credit profile, and lender terms.' },
  { q: 'How fast can I get funded?', a: 'Many lenders offer next-business-day funding once approved. Some may fund same day.' },
  { q: 'What are the interest rates?', a: 'APR ranges from 5.99% to 35.99% depending on your credit profile, loan amount, and term.' },
  { q: 'Can I repay my loan early?', a: 'Most lenders allow early repayment without prepayment penalties, saving you money on interest.' },
  { q: 'What do I need to apply?', a: 'Be 18+, have a valid U.S. bank account, steady income, and a valid email and phone number.' },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQS.map((f, i) => (
        <div
          key={i}
          className={`rounded-xl border overflow-hidden transition-all duration-300 ${
            open === i ? 'border-primary/20 bg-primary/[0.02] shadow-sm' : 'border-border bg-card hover:border-primary/10'
          }`}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <span className="text-sm font-semibold text-foreground pr-4">{f.q}</span>
            <svg
              className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${open === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
            <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
