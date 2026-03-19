import Hero from './Hero';

interface HeroWithModalProps {
  brand?: string;
  h1?: string;
  sub?: string;
  cta?: string;
  amountMin?: string;
  amountMax?: string;
  amountMinRaw?: string;
  amountMaxRaw?: string;
  aprMin?: string;
  aprMax?: string;
}

export default function HeroWithModal({ 
  brand = 'TPL-USA-B02',
  h1 = 'Get Up to $5,000 Today',
  sub = 'Fast approval. No hard credit check.',
  cta = 'Apply Now',
  amountMin = '100',
  amountMax = '5000',
  amountMinRaw = '100',
  amountMaxRaw = '5000',
  aprMin = '5.99',
  aprMax = '35.99'
}: HeroWithModalProps) {
  return <Hero 
    brand={brand}
    h1={h1}
    sub={sub}
    cta={cta}
    amountMin={amountMin}
    amountMax={amountMax}
    amountMinRaw={amountMinRaw}
    amountMaxRaw={amountMaxRaw}
    aprMin={aprMin}
    aprMax={aprMax}
  />;
}
