import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-deep-purple py-6">
        <div className="container mx-auto px-4">
          <Link to="/" className="flex items-center gap-2 w-fit">
            <span className="text-2xl">🦁</span>
            <span className="font-heading text-xl font-bold text-foreground">LionFunds</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-8">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-6">Last Updated: March 14, 2026</p>

        <div className="space-y-8 text-foreground/80 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">1. About Our Service</h2>
            <p>
              LionFunds ("we," "us," or "our") operates a lead generation platform that connects consumers seeking personal loans or financial products with a network of third-party lenders and financial service providers.
            </p>
            <p className="mt-3 p-4 rounded-lg bg-card border border-lion-gold/30 text-foreground">
              <strong className="text-lion-gold">IMPORTANT:</strong> LionFunds is NOT a lender, loan broker, or agent for any lender or loan broker. We do not make credit decisions, set loan terms, or disburse funds. We do not charge consumers any fees for using our service. Submitting a request does not guarantee approval or an offer from any lender.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">2. Eligibility</h2>
            <p>To use our services, you must:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Be at least 18 years of age</li>
              <li>Be a legal resident of the United States</li>
              <li>Have a valid email address and phone number</li>
              <li>Have an active bank account</li>
              <li>Provide accurate and complete information</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">3. How It Works</h2>
            <p>
              When you submit your information through our Site, we share it with lenders and financial service providers in our network who may offer you a loan or financial product. If a lender chooses to make you an offer, you will be redirected to their website or contacted directly. Any loan agreement is solely between you and the lender. We encourage you to carefully review all terms, conditions, and disclosures before accepting any offer.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">4. APR and Loan Terms Disclosure</h2>
            <p>
              Loan terms, including APR, repayment period, and fees, vary by lender and depend on your creditworthiness, requested amount, and other factors.
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>APR Range:</strong> 0% – 35.99%</li>
              <li><strong>Repayment Terms:</strong> 61 days – 72 months</li>
              <li><strong>Loan Amounts:</strong> $1,000 – $25,000</li>
            </ul>
            <div className="mt-4 p-4 rounded-lg bg-card border border-border">
              <p className="font-heading font-medium text-foreground mb-2">Representative Example:</p>
              <p>
                A loan of $5,000 with an APR of 18.99% over 24 months would result in 24 monthly payments of approximately $254.41. Total amount repayable: $6,105.84. Total cost of credit (interest): $1,105.84. No origination fee in this example; however, some lenders may charge origination or other fees.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">5. TCPA Consent</h2>
            <p>
              By submitting your information on our Site, you provide express written consent under the Telephone Consumer Protection Act (TCPA) for LionFunds and its network partners to contact you at the phone number(s) you provide, including via telephone, mobile device, artificial or prerecorded voice, text message (SMS/MMS), and/or email, even if your number is on a Do Not Call list. You understand that consent is not required as a condition to receive services or to purchase any goods or services. Standard message and data rates may apply.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">6. Credit Inquiry Disclosure</h2>
            <p>
              Submitting a request through LionFunds may involve a soft credit inquiry, which does not affect your credit score. However, if you are matched with a lender and proceed with a full application, the lender may perform a hard credit inquiry, which could impact your credit score. The type of inquiry is determined by each lender.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">7. No Guarantee</h2>
            <p>
              We do not guarantee that you will receive a loan offer, that you will be matched with a lender, or that any lender will approve your application. Loan offers depend on lender criteria, your creditworthiness, and other factors outside our control.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, LionFunds shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of our Site or services, or any loan or financial product you receive from a lender in our network. Our total liability shall not exceed $100.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">9. Disclaimer of Warranties</h2>
            <p>
              Our Site and services are provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">10. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions. Any disputes shall be resolved in the state or federal courts located in Los Angeles County, California.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">11. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the Site constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">12. Contact Us</h2>
            <p>If you have questions about these Terms, contact us at:</p>
            <div className="mt-2 p-4 rounded-lg bg-card border border-border">
              <p className="font-heading font-semibold text-foreground">LionFunds</p>
              <p>123 Financial Way, Suite 100</p>
              <p>Los Angeles, CA 90001</p>
              <p>Email: <span className="text-lion-gold">legal@lionfunds.com</span></p>
              <p>Phone: <span className="text-lion-gold">1-800-XXX-XXXX</span></p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
