import { useState } from 'react';

const AMOUNTS = [1000, 2000, 3000, 5000];

export default function HeroForm() {
  const [amount, setAmount] = useState(2000);
  const [zip, setZip] = useState('');
  const [zipError, setZipError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Enter a valid 5-digit ZIP code');
      return;
    }
    setZipError('');

    if (typeof window !== 'undefined') {
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({
        event: 'generate_lead_start',
        conversion_value: amount,
        currency: 'USD',
      });
    }

    const params = new URLSearchParams(window.location.search);
    params.set('amount', String(amount));
    params.set('zip', zip);
    window.location.href = `/apply?${params.toString()}`;
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="glass-card p-6 md:p-8 space-y-6"
      >
        {/* Amount buttons */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            How much do you need?
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  amount === a
                    ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                ${a >= 1000 ? `${a / 1000}K` : a}
              </button>
            ))}
          </div>

          {/* Slider */}
          <input
            type="range"
            min={100}
            max={5000}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>$100</span>
            <span className="text-base font-bold text-foreground">
              ${amount.toLocaleString()}
            </span>
            <span>$5,000</span>
          </div>
        </div>

        {/* ZIP */}
        <div>
          <label
            htmlFor="zip"
            className="block text-sm font-semibold text-foreground mb-2"
          >
            Your ZIP Code
          </label>
          <input
            id="zip"
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 90210"
            value={zip}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 5);
              setZip(val);
              if (zipError) setZipError('');
            }}
            className={`w-full h-12 px-4 rounded-lg border bg-background text-foreground
              text-base font-medium placeholder:text-muted-foreground/60
              focus:outline-none focus:ring-2 focus:ring-ring transition-all
              ${zipError ? 'border-destructive ring-1 ring-destructive' : 'border-input'}`}
          />
          {zipError && (
            <p className="text-sm text-destructive mt-1.5 animate-shake">
              {zipError}
            </p>
          )}
        </div>

        {/* Submit */}
        <button type="submit" className="btn-cta w-full group">
          <span>Check My Rate</span>
          <svg
            className="w-5 h-5 transition-transform group-hover:translate-x-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          <svg
            className="inline w-3.5 h-3.5 text-secondary mr-1 -mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Won't affect your credit score
        </p>
      </form>
    </div>
  );
}
