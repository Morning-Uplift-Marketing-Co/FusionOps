import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const MobileCTA = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setVisible(scrollPercent > 0.3);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm p-3">
      <a href="/apply" className="block w-full">
        <Button className="w-full rounded-xl bg-gradient-to-r from-lion-gold to-lion-gold-dark text-primary-foreground font-heading font-bold py-3 h-auto text-base hover:brightness-110">
          Get Funded Now →
        </Button>
      </a>
    </div>
  );
};

export default MobileCTA;
