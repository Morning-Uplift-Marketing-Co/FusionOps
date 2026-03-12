import { useState, useEffect, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useInView } from '../hooks/useInView';

const reviewsRaw = import.meta.env.PUBLIC_REVIEWS || '[]';
let reviews: Array<{ name: string; rating: number; text: string; location: string }> = [];
try { reviews = JSON.parse(reviewsRaw); } catch (_) {}

if (reviews.length === 0) {
  reviews = [
    {
      name: 'Sarah M.',
      rating: 5,
      text: 'BearLoanNow saved us when our dog needed emergency surgery. The application took 3 minutes and we had approval in seconds. Funds were available the very next day. Truly a lifesaver!',
      location: 'Dog Owner',
    },
    {
      name: 'James R.',
      rating: 5,
      text: 'My cat needed a $3,000 dental procedure and I had no idea how I was going to cover it. BearLoanNow offered 0% APR and manageable monthly payments. The process was completely painless.',
      location: 'Cat Owner',
    },
    {
      name: 'Maria T.',
      rating: 5,
      text: 'I was nervous about a credit check impacting my score but the soft pull meant no worries. Got approved instantly and was able to get my rabbit the specialist care she needed right away.',
      location: 'Rabbit Owner',
    },
  ];
}

const avatarColors = [
  'bg-teal-600',
  'bg-teal-700',
  'bg-teal-800',
  'bg-teal-600',
  'bg-teal-700',
  'bg-teal-800',
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
            className={`inline-block text-teal-700 font-semibold text-sm uppercase tracking-widest mb-3 transition-all duration-700 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
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
                <Star key={i} size={22} className="fill-amber-400 text-amber-400" />
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
              {reviews.map(({ name, rating, text, location }, i) => (
                <div
                  key={name}
                  className="shrink-0 bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex flex-col"
                  style={{ width: `calc(${100 / visibleCount}% - ${20 * (visibleCount - 1) / visibleCount}px)` }}
                  onMouseEnter={() => setIsAutoPlaying(false)}
                  onMouseLeave={() => setIsAutoPlaying(true)}
                >
                  <Quote size={28} className="text-teal-200 mb-4" />
                  <p className="text-gray-700 leading-relaxed text-sm flex-1 mb-5">"{text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <div className={`w-10 h-10 ${avatarColors[i % avatarColors.length]} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{name}</div>
                      <div className="text-gray-400 text-xs">{location}</div>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(rating)].map((_, j) => (
                        <Star key={j} size={13} className="fill-amber-400 text-amber-400" />
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
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-teal-50 hover:border-teal-300 transition-all"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <div className="flex gap-1.5">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIsAutoPlaying(false); setCurrent(i); }}
                  className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-teal-600' : 'w-2 bg-gray-200 hover:bg-gray-300'}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-teal-50 hover:border-teal-300 transition-all"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
