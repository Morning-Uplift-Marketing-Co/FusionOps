import { Link } from "react-router-dom";

const Privacy = () => {
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
        <h1 className="font-heading text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-6">Last Updated: March 14, 2026</p>

        <div className="space-y-8 text-foreground/80 text-sm leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p>
              LionFunds ("we," "us," or "our") operates the website lionfunds.com (the "Site"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our Site or use our services. We are a lead generation service that connects consumers with a network of third-party lenders and financial service providers. We are NOT a lender, broker, or agent for any lender.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <h3 className="font-heading text-base font-medium text-foreground mb-2">Personal Information You Provide</h3>
            <p className="mb-3">When you submit a request through our Site, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Mailing address and ZIP code</li>
              <li>Date of birth</li>
              <li>Social Security Number (partial or full)</li>
              <li>Employment and income information</li>
              <li>Desired loan amount and purpose</li>
              <li>Banking information</li>
            </ul>

            <h3 className="font-heading text-base font-medium text-foreground mt-4 mb-2">Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address and geolocation data</li>
              <li>Browser type and device information</li>
              <li>Referring URLs and pages visited</li>
              <li>Cookies, web beacons, and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To connect you with lenders and financial service providers in our network</li>
              <li>To process and fulfill your funding request</li>
              <li>To communicate with you regarding your request</li>
              <li>To improve our Site and services</li>
              <li>To comply with legal obligations</li>
              <li>To send marketing communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">4. How We Share Your Information</h2>
            <p className="mb-3">We may share your personal information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Lender Network Partners:</strong> Third-party lenders who may offer you a loan or financial product based on your submitted information.</li>
              <li><strong>Service Providers:</strong> Companies that help us operate our business (e.g., hosting, analytics, email delivery).</li>
              <li><strong>Marketing Partners:</strong> Third parties who may contact you with related offers (subject to your consent and opt-out rights).</li>
              <li><strong>Legal Compliance:</strong> When required by law, regulation, or legal process.</li>
            </ul>
            <p className="mt-3">
              <strong>Important:</strong> Once your information is shared with a lender or financial service provider, their privacy policy governs their use of your data. We encourage you to review their policies.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">5. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies, pixel tags, and similar technologies to enhance your experience, analyze usage, and serve targeted advertising. You can manage cookie preferences through your browser settings. Disabling cookies may affect Site functionality.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">6. Your Rights Under CCPA (California Residents)</h2>
            <p className="mb-3">If you are a California resident, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Know</strong> what personal information we collect, use, and share.</li>
              <li><strong>Delete</strong> your personal information (subject to certain exceptions).</li>
              <li><strong>Opt-Out</strong> of the sale or sharing of your personal information.</li>
              <li><strong>Non-Discrimination</strong> for exercising your privacy rights.</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at <span className="text-lion-gold">privacy@lionfunds.com</span> or call <span className="text-lion-gold">1-800-XXX-XXXX</span>.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">7. Data Security</h2>
            <p>
              We implement industry-standard security measures including 256-bit SSL encryption, firewalls, and secure data storage. However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">8. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">9. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the Site constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:</p>
            <div className="mt-2 p-4 rounded-lg bg-card border border-border">
              <p className="font-heading font-semibold text-foreground">LionFunds</p>
              <p>123 Financial Way, Suite 100</p>
              <p>Los Angeles, CA 90001</p>
              <p>Email: <span className="text-lion-gold">privacy@lionfunds.com</span></p>
              <p>Phone: <span className="text-lion-gold">1-800-XXX-XXXX</span></p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
