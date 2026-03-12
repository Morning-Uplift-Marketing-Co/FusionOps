import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';

const stats = [
  { value: 4.9, suffix: '/5', label: 'Customer Rating', decimals: 1 },
  { value: 2400, suffix: '+', label: 'Customers Served', decimals: 0 },
  { value: 10000, prefix: '$', suffix: '', label: 'Maximum Loan Amount', decimals: 0 },
  { value: 256, suffix: '-bit SSL', label: 'Data Encryption', decimals: 0 },
];

function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  active,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  active: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start = 0;
    const duration = 1800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * value;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [active, value]);

  const formatted =
    value >= 1000 ? (display >= 1000 ? (display / 1000).toFixed(decimals === 0 ? 1 : decimals) + 'k' : '0k') : display.toFixed(decimals);

  return (
    <span>
      {prefix}{formatted}{suffix}
    </span>
  );
}

export default function StatsBar() {
  const { ref, inView } = useInView();
  const shouldAnimate = typeof window === 'undefined' ? true : inView;

  return (
    <section className="bg-teal-900 py-14">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-teal-700">
          {stats.map(({ value, prefix, suffix, label, decimals }, i) => (
            <div
              key={label}
              className={`text-center lg:px-8 transition-all duration-700 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="text-4xl lg:text-5xl font-extrabold text-white mb-1">
                <AnimatedNumber
                  value={value}
                  prefix={prefix}
                  suffix={suffix}
                  decimals={decimals}
                  active={inView}
                />
              </div>
              <div className="text-teal-300 font-medium text-sm uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
