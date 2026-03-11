import { useState, useEffect, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useInView } from '../hooks/useInView';

const reviews = [
  {
    name: 'Sarah M.',
    rating: 5,
    quote: 'BearLoanNow saved us when our dog needed emergency surgery. The application took 3 minutes and we had approval in seconds. Funds were available the very next day. Truly a lifesaver!',
    petType: 'Dog Owner',
    initials: 'SM',
  },
  {
    name: 'James R.',
    rating: 5,
    quote: 'My cat needed a $3,000 dental procedure and I had no idea how I was going to cover it. BearLoanNow offered 0% APR and manageable monthly payments. The process was completely painless.',
    petType: 'Cat Owner',
    initials: 'JR',
  },
  {
    name: 'Maria T.',
    rating: 5,
    quote: 'I was nervous about a credit check impacting my score but the soft pull meant no worries. Got approved instantly and was able to get my rabbit the specialist care she needed right away.',
    petType: 'Rabbit Owner',
    initials: 'MT',
  },
  {
    name: 'David K.',
    rating: 5,
    quote: 'As a first-time pet owner dealing with an unexpected vet bill, I didn\'t know where to turn. BearLoanNow walked me through everything. Clear terms, no hidden fees, and genuinely helpful support.',
    petType: 'Dog Owner',
    initials: 'DK',
  },
  {
    name: 'Lisa B.',
    rating: 5,
    quote: 'Quick, easy, and transparent. I financed my dog\'s orthopedic surgery and the monthly payments fit perfectly into my budget. Would recommend to any pet owner facing a big vet bill.',
    petType: 'Dog Owner',
    initials: 'LB',
  },
  {
    name: 'Tom W.',
    rating: 5,
    quote: 'The entire experience was smooth from start to finish. My vet was thrilled when I said I could cover the full cost upfront. BearLoanNow made that possible with zero stress.',
    petType: 'Cat Owner',
    initials: 'TW',
  },
];

const avatarColors = [
  'bg-primary',
  'bg-primary',
  'bg-primary',
  'bg-primary',
  'bg-primary',
  'bg-primary',
];

export default function Testimonials() {
  const { ref, inView } = useInView();
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldAnimate = typeof window === 'undefined' ? true : inView;

  const perPage = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  };

  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    const update = () => setVisibleCount(perPage());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const maxIndex = reviews.length - visibleCount;

  useEffect(() => {
    if (!isAutoPlaying) return;
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c >= maxIndex ? 0 : c + 1));
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoPlaying, maxIndex]);

  const prev = () => {
    setIsAutoPlaying(false);
    setCurrent((c) => (c <= 0 ? maxIndex : c - 1));
  };

  const next = () => {
    setIsAutoPlaying(false);
    setCurrent((c) => (c >= maxIndex ? 0 : c + 1));
  };

  return (
    <section id="reviews" className="py-20 lg:py-28 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="text-center max-w-2xl mx-auto mb-14">
          <span
            className={`inline-block text-primary-soft font-semibold text-sm uppercase tracking-widest mb-3 transition-all duration-700 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Customer Stories
          </span>
          <h2
            className={`text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 transition-all duration-700 delay-100 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Trusted by Pet Owners Everywhere
          </h2>
          <div
            className={`flex items-center justify-center gap-2 transition-all duration-700 delay-200 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={22} className="fill-amber-400 text-accent" />
              ))}
            </div>
            <span className="font-bold text-gray-900 text-lg">4.9</span>
            <span className="text-gray-500 text-sm">from 2,400+ verified reviews</span>
          </div>
        </div>

        <div
          className={`relative transition-all duration-700 delay-300 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out gap-5"
              style={{ transform: `translateX(calc(-${current * (100 / visibleCount)}% - ${current * 20 / visibleCount}px))` }}
            >
              {reviews.map(({ name, rating, quote, petType, initials }, i) => (
                <div
                  key={name}
                  className="shrink-0 bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex flex-col"
                  style={{ width: `calc(${100 / visibleCount}% - ${20 * (visibleCount - 1) / visibleCount}px)` }}
                  onMouseEnter={() => setIsAutoPlaying(false)}
                  onMouseLeave={() => setIsAutoPlaying(true)}
                >
                  <Quote size={28} className="text-primary-soft mb-4" />
                  <p className="text-gray-700 leading-relaxed text-sm flex-1 mb-5">"{quote}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <div className={`w-10 h-10 ${avatarColors[i]} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{name}</div>
                      <div className="text-gray-400 text-xs">{petType}</div>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(rating)].map((_, j) => (
                        <Star key={j} size={13} className="fill-amber-400 text-accent" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-primary hover:border-primary-soft transition-all"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <div className="flex gap-1.5">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIsAutoPlaying(false); setCurrent(i); }}
                  className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-primary' : 'w-2 bg-gray-200 hover:bg-gray-300'}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-primary hover:border-primary-soft transition-all"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
