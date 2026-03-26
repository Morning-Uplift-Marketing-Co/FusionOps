import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does LionFunds work?",
    a: "LionFunds connects you with a network of 75+ vetted lenders. Simply enter your ZIP code, compare matched offers with transparent rates and terms, and choose the installment plan that works best for you. The entire process takes about 60 seconds.",
  },
  {
    q: "Will checking my eligibility affect my credit score?",
    a: "No. Our initial eligibility check uses a soft inquiry, which does not impact your credit score. A hard inquiry may only occur if you choose to proceed with a specific lender's offer and formally apply for funding.",
  },
  {
    q: "How much can I receive?",
    a: "You may qualify for installment funding from $1,000 up to $25,000 depending on your creditworthiness, income, and the lender's criteria. The amount you're offered will be clearly shown before you commit to anything.",
  },
  {
    q: "How fast can I get funded?",
    a: "Most applicants receive a decision in under 3 minutes. If approved, funds can be deposited as fast as the next business day, depending on the lender and your bank. Some lenders offer same-day funding for applications submitted early in the day.",
  },
  {
    q: "What are the rates and terms?",
    a: "APR ranges from 0% to 35.99% with repayment terms of 61 days to 72 months. Your specific rate and term depend on creditworthiness and the lender you're matched with. All rates and terms are disclosed upfront before you commit.",
  },
  {
    q: "Is LionFunds a lender?",
    a: "No. LionFunds is a free matching service that connects consumers with lenders and financial service providers. We do not make credit decisions, broker funding, or charge any fees. Our service is completely free to use.",
  },
  {
    q: "Who is eligible to apply?",
    a: "To use LionFunds, you must be at least 18 years old, a US resident, have a valid Social Security Number, an active checking or savings account, a valid email address and phone number, and a source of regular income.",
  },
  {
    q: "What happens after I'm matched with a lender?",
    a: "After matching, you'll be directed to the lender's website to review and complete your application. The lender will present their full terms, including APR, monthly payment, fees, and repayment schedule. You are never obligated to accept an offer.",
  },
  {
    q: "How is my personal information protected?",
    a: "We use 256-bit SSL encryption — the same security standard used by major banks — to protect your personal and financial information. We never sell your data to third parties. Please review our Privacy Policy for complete details on how we handle your information.",
  },
  {
    q: "Is LionFunds available in my state?",
    a: "LionFunds operates in all 50 US states. However, not all lenders in our network may be available in every state. The offers you receive will be from lenders licensed to operate in your state based on the ZIP code you provide.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="bg-background py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-center font-heading text-3xl font-bold text-foreground sm:text-4xl mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10 text-sm sm:text-base">
          Everything you need to know about using LionFunds. Can't find what you're looking for? Contact our support team.
        </p>
        <div className="mx-auto max-w-2xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border rounded-lg px-5 bg-card"
              >
                <AccordionTrigger className="font-heading font-semibold text-foreground text-left hover:text-lion-gold transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
