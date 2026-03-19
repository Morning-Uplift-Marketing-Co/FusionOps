import Hero from './Hero';

interface HeroWithModalProps {
  h1?: string;
  cta?: string;
  amountMin?: string;
  amountMax?: string;
}

export default function HeroWithModal({ 
  h1 = 'Get Up to $5,000 Today',
  cta = 'Apply Now',
  amountMin = '100',
  amountMax = '5000'
}: HeroWithModalProps) {
  return <Hero 
    h1={h1}
    cta={cta}
    amountMin={amountMin}
    amountMax={amountMax}
  />;
}
