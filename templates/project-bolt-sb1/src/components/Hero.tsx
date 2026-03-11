import { useState } from 'react';
import { Shield, Zap, Star, DollarSign, MapPin } from 'lucide-react';
import { z } from 'zod';
import { useInView } from '../hooks/useInView';
import ApplyModal from './ApplyModal';

const zipSchema = z
  .string()
  .regex(/^\d{5}$/, 'Please enter a valid 5-digit ZIP code');

const trustBadges = [
  { icon: Star, label: '4.9/5 Stars', sub: '2,400+ Reviews' },
  { icon: Shield, label: 'All Credit Types Considered', sub: 'Soft inquiry only' },
  { icon: Zap, label: 'Fast Lending Decision', sub: 'Response in moments' },
  { icon: DollarSign, label: '$200 – $10,000', sub: 'Flexible loan amounts' },
];

export default function Hero() {
  const { ref, inView } = useInView();
  const [zip, setZip] = useState('');
  const [zipError, setZipError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const shouldAnimate = typeof window === 'undefined' ? true : (hasAnimated || inView);

  if (!hasAnimated && inView) {
    setHasAnimated(true);
  }

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZip(val);
    if (zipError) setZipError('');
  };

  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = zipSchema.safeParse(zip);
    if (!result.success) {
      setZipError(result.error.errors[0].message);
      return;
    }
    setZipError('');
    setModalOpen(true);
  };

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, var(--primary-strong) 0%, var(--primary) 40%, var(--primary-bright) 70%, var(--primary-deep) 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="absolute top-20 right-0 w-96 h-96 bg-primary rounded-full opacity-5 blur-3xl translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent rounded-full opacity-5 blur-3xl -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
          <div ref={ref} className="max-w-3xl">
            <div
              className={`inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6 transition-all duration-700 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-white/90 text-sm font-medium">Installment Loan Solutions — 0% APR Available</span>
            </div>

            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 transition-all duration-700 delay-100 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              Because {' '}
              <span className="text-accent">"Wait".</span>
              <br />
              isn’t an option for your best friend..
            </h1>

            <p
              className={`text-lg sm:text-xl text-primary-soft leading-relaxed mb-10 max-w-2xl transition-all duration-700 delay-200 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              Don't let a vet bill decide your pet's future. Get the funding they need today.
            </p>

            <div
              className={`mb-14 transition-all duration-700 delay-300 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <form onSubmit={handleZipSubmit} className="flex flex-col gap-2 max-w-sm">
                <div className="flex items-stretch shadow-xl rounded-xl overflow-hidden">
                  <div className="relative flex-1">
                    <MapPin
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter ZIP Code"
                      value={zip}
                      onChange={handleZipChange}
                      maxLength={5}
                      aria-label="ZIP code"
                      className={`w-full h-full pl-9 pr-4 py-4 text-gray-900 font-semibold text-base placeholder-gray-400 focus:outline-none transition-all bg-white ${
                        zipError ? 'ring-2 ring-inset ring-danger-soft' : ''
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-accent hover:bg-accent active:scale-95 text-white font-bold text-base px-6 py-4 transition-all duration-200 whitespace-nowrap"
                  >
                   Save My Pet Now
                  </button>
                </div>
                {zipError && (
                  <p className="text-danger text-xs font-medium pl-1">{zipError}</p>
                )}
                <p className="text-primary-soft text-xs pl-1">Soft inquiry only &middot; Data-driven lending decision</p>
              </form>
            </div>

            <div
              className={`grid grid-cols-2 lg:grid-cols-4 gap-3 transition-all duration-700 delay-400 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {trustBadges.map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-4 hover:bg-white/15 transition-colors"
                >
                  <Icon size={20} className="text-accent mb-2" />
                  <div className="text-white font-semibold text-sm">{label}</div>
                  <div className="text-primary-soft text-xs mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L1440 60L1440 0C1200 50 800 60 720 60C640 60 240 50 0 0L0 60Z" fill="hsl(var(--background))" />
          </svg>
        </div>

        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute right-0 top-0 h-full w-1/2 opacity-10 hidden lg:block"
            style={{
              maskImage: 'linear-gradient(to left, rgba(0,0,0,0.6) 0%, transparent 100%)',
              background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)'
            }}
          />
        </div>
      </section>

      {modalOpen && (
        <ApplyModal zipCode={zip} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
