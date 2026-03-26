import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-deep-purple py-12 sm:py-16">
      <div className="container mx-auto px-4">
        {/* About LionFunds */}
        <div className="mx-auto max-w-3xl mb-10">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-2xl">🦁</span>
            <span className="font-heading text-xl font-bold text-foreground">LionFunds</span>
          </div>
          <div className="text-center text-sm text-foreground/60 space-y-3 leading-relaxed">
            <p>
              LionFunds is a free online service that connects consumers with a network of 75+ vetted lenders and financial service providers. Our mission is to make personal funding more accessible, transparent, and fair for everyday Americans.
            </p>
            <p>
              We believe everyone deserves access to clear, competitive funding options — without the hassle of visiting multiple lender websites or submitting duplicate applications. By entering your ZIP code and basic information, our technology instantly matches you with lenders most likely to offer favorable terms based on your profile.
            </p>
            <p>
              <span className="text-lion-gold font-medium">Important:</span> LionFunds is NOT a lender, loan broker, or financial advisor. We do not make credit decisions, set interest rates, or charge any fees. All credit decisions and terms are made by the individual lenders in our network. Our service is and always will be completely free for consumers.
            </p>
          </div>
        </div>

        {/* Disclosures */}
        <div className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-foreground/50 space-y-4">
          <p>
            <span className="text-lion-gold font-medium">APR Disclosure:</span> The APR ranges from 0% to 35.99%. APR offered depends on creditworthiness, term, and lender. Repayment terms range from 61 days to 72 months. Not all applicants will qualify for the lowest rate. Rates and terms are subject to change.
          </p>

          <div className="p-4 rounded-lg border border-lion-gold/20 bg-foreground/5">
            <p className="text-lion-gold font-medium mb-1">Representative Example:</p>
            <p>
              A loan of $5,000 with an APR of 18.99% over 24 months would result in 24 monthly payments of approximately $254.41. Total amount repayable: $6,105.84. Total cost of credit (interest): $1,105.84. No origination fee in this example; some lenders may charge origination or other fees.
            </p>
          </div>

          <p>
            <span className="text-lion-gold font-medium">TCPA Consent:</span> By submitting your information, you consent to receive communications via phone, email, or SMS, including by automated means, from LionFunds and its network partners. Consent is not required as a condition to receive services. You may opt out at any time.
          </p>
          <p>
            <span className="text-lion-gold font-medium">Credit Impact:</span> Checking your eligibility through LionFunds uses a soft credit inquiry, which does not affect your credit score. If you choose to proceed with a lender's offer, the lender may perform a hard credit inquiry, which could affect your credit score.
          </p>
          <p>
            <span className="text-lion-gold font-medium">State Licensing:</span> LionFunds is a lead generator and is not required to be licensed as a lender. All lenders in our network are responsible for maintaining their own state licenses and regulatory compliance. Services may not be available in all states.
          </p>
        </div>

        {/* Legal Links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-foreground/60">
          <Link to="/privacy" className="hover:text-lion-gold transition-colors underline underline-offset-2">
            Privacy Policy
          </Link>
          <span className="text-foreground/20">|</span>
          <Link to="/terms" className="hover:text-lion-gold transition-colors underline underline-offset-2">
            Terms of Service
          </Link>
          <span className="text-foreground/20">|</span>
          <a href="mailto:privacy@lionfunds.com" className="hover:text-lion-gold transition-colors underline underline-offset-2">
            Do Not Sell My Info
          </a>
          <span className="text-foreground/20">|</span>
          <a href="mailto:support@lionfunds.com" className="hover:text-lion-gold transition-colors underline underline-offset-2">
            Contact Us
          </a>
        </div>

        {/* Address */}
        <div className="mt-4 text-center text-xs text-foreground/40">
          <p>LionFunds · 123 Financial Way, Suite 100 · Los Angeles, CA 90001</p>
          <p className="mt-1">Email: support@lionfunds.com · Phone: 1-800-555-0144</p>
        </div>

        <div className="mt-6 border-t border-foreground/10 pt-6 text-center text-xs text-foreground/40">
          © 2025 LionFunds. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
