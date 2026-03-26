import { Check } from "lucide-react";

const requirements = [
  { label: "At least 18 years old", detail: "You must be of legal age to enter into a financial agreement in your state." },
  { label: "US resident", detail: "You must reside in one of the 50 US states or Washington, D.C." },
  { label: "Valid Social Security Number", detail: "Required for identity verification and credit assessment." },
  { label: "Active bank account", detail: "A checking or savings account in your name for fund deposit." },
  { label: "Valid email & phone number", detail: "So lenders can communicate offers and account updates securely." },
  { label: "Regular source of income", detail: "Employment, self-employment, benefits, or other verifiable income." },
];

const Eligibility = () => {
  return (
    <section id="eligibility" className="bg-section-purple py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-center font-heading text-3xl font-bold text-foreground sm:text-4xl mb-4">
          Eligibility Requirements
        </h2>
        <p className="text-center text-foreground/60 max-w-2xl mx-auto mb-12 text-sm sm:text-base">
          Before you apply, make sure you meet these basic requirements. Meeting these criteria does not guarantee approval — final decisions are made by individual lenders.
        </p>
        <div className="mx-auto max-w-2xl space-y-4">
          {requirements.map((req) => (
            <div
              key={req.label}
              className="flex items-start gap-4 rounded-xl bg-foreground/5 border border-foreground/10 p-4"
            >
              <div className="flex-shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-lion-gold/20">
                <Check className="h-4 w-4 text-lion-gold" />
              </div>
              <div>
                <p className="font-heading font-semibold text-foreground text-sm">{req.label}</p>
                <p className="text-xs text-foreground/50 mt-0.5 leading-relaxed">{req.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-foreground/40 mt-8 max-w-xl mx-auto">
          LionFunds is a matching service, not a lender. Meeting these requirements allows us to connect you with potential lenders, but each lender has its own approval criteria.
        </p>
      </div>
    </section>
  );
};

export default Eligibility;
