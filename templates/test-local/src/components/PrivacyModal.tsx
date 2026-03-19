import { X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | 'cookies' | 'dnsmpi';
}

export default function PrivacyModal({ isOpen, onClose, type }: PrivacyModalProps) {
  if (!isOpen) return null;

  const content = {
    privacy: {
      title: 'Privacy Policy',
      body: (
        <>
          <p className="mb-4"><strong>Effective Date:</strong> January 1, 2024</p>

          <h3 className="text-lg font-bold mb-2">1. Information We Collect</h3>
          <p className="mb-4">
            We collect personal information you provide directly to us, including name, email address, phone number,
            date of birth, Social Security number, employment information, and financial information. We also collect
            information automatically through your use of our services, including device information, IP address,
            browser type, and usage data.
          </p>

          <h3 className="text-lg font-bold mb-2">2. How We Use Your Information</h3>
          <p className="mb-4">
            We use your information to process loan applications, verify your identity, assess creditworthiness,
            communicate with you about our services, improve our website and services, comply with legal obligations,
            and for marketing and advertising purposes with your consent.
          </p>

          <h3 className="text-lg font-bold mb-2">3. Information Sharing</h3>
          <p className="mb-4">
            We share your information with our lending partners to process your loan application, service providers
            who assist us in operating our business, credit reporting agencies, advertising partners including Google Ads,
            analytics providers, and as required by law or to protect our rights.
          </p>

          <h3 className="text-lg font-bold mb-2">4. Advertising & Cookies</h3>
          <p className="mb-4">
            We use cookies and similar tracking technologies for advertising and analytics. We work with Google Ads
            and other advertising networks to show you personalized ads. These third parties may collect information
            about your online activities over time and across different websites. You can opt out of personalized
            advertising by adjusting your browser settings or visiting industry opt-out pages.
          </p>

          <h3 className="text-lg font-bold mb-2">5. Your Rights</h3>
          <p className="mb-4">
            Depending on your location, you may have rights to access, correct, delete, or restrict the use of your
            personal information. You may also have the right to opt out of the sale of your personal information and
            to opt out of targeted advertising. To exercise these rights, contact us at privacy@tpl-usa-b02.com.
          </p>

          <h3 className="text-lg font-bold mb-2">6. Data Security</h3>
          <p className="mb-4">
            We implement reasonable security measures to protect your information. However, no method of transmission
            over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h3 className="text-lg font-bold mb-2">7. Contact Us</h3>
          <p>
            For questions about this Privacy Policy, contact us at:<br />
            Email: privacy@tpl-usa-b02.com<br />
            Phone: 1-800-555-0123<br />
            Address: TPL-USA-B02, LLC, 1234 Financial Plaza, Suite 500, San Francisco, CA 94102
          </p>
        </>
      ),
    },
    terms: {
      title: 'Terms of Service',
      body: (
        <>
          <p className="mb-4"><strong>Effective Date:</strong> January 1, 2024</p>

          <h3 className="text-lg font-bold mb-2">1. Acceptance of Terms</h3>
          <p className="mb-4">
            By using TPL-USA-B02's services, you agree to these Terms of Service. If you do not agree,
            please do not use our services.
          </p>

          <h3 className="text-lg font-bold mb-2">2. Loan Application Process</h3>
          <p className="mb-4">
            Submitting a loan application does not guarantee approval. Loan approval and terms are subject to
            credit verification and underwriting criteria set by our lending partners. A soft credit inquiry
            is performed initially, which does not impact your credit score. If you accept a loan offer,
            a hard credit inquiry will be performed, which may impact your credit score.
          </p>

          <h3 className="text-lg font-bold mb-2">3. Loan Terms</h3>
          <p className="mb-4">
            Loan amounts range from $200 to $10,000. Repayment terms are 3, 6, or 12 months. APR ranges from
            0% to 35.99% based on creditworthiness. All loan terms will be clearly disclosed before you accept
            any offer. You are responsible for making timely payments according to your loan agreement.
          </p>

          <h3 className="text-lg font-bold mb-2">4. Eligibility Requirements</h3>
          <p className="mb-4">
            To apply, you must be at least 18 years old, a U.S. resident, have a valid bank account,
            have a valid email address and phone number, and meet minimum income requirements.
          </p>

          <h3 className="text-lg font-bold mb-2">5. Prohibited Uses</h3>
          <p className="mb-4">
            You may not use our services for any illegal purpose, provide false or misleading information,
            attempt to manipulate or abuse our loan application process, or use automated systems to access
            our services without permission.
          </p>

          <h3 className="text-lg font-bold mb-2">6. Limitation of Liability</h3>
          <p className="mb-4">
            TPL-USA-B02 is a technology platform connecting borrowers with lenders. We are not a lender and
            do not make credit decisions. Our liability is limited to the maximum extent permitted by law.
          </p>

          <h3 className="text-lg font-bold mb-2">7. Changes to Terms</h3>
          <p className="mb-4">
            We reserve the right to modify these Terms at any time. Continued use of our services after
            changes constitutes acceptance of the new Terms.
          </p>

          <h3 className="text-lg font-bold mb-2">8. Contact Information</h3>
          <p>
            For questions about these Terms, contact us at:<br />
            Email: legal@tpl-usa-b02.com<br />
            Phone: 1-800-555-0123
          </p>
        </>
      ),
    },
    cookies: {
      title: 'Cookie Policy',
      body: (
        <>
          <p className="mb-4"><strong>Last Updated:</strong> January 1, 2024</p>

          <h3 className="text-lg font-bold mb-2">What Are Cookies?</h3>
          <p className="mb-4">
            Cookies are small text files stored on your device when you visit our website. They help us
            provide you with a better experience and allow certain features to function properly.
          </p>

          <h3 className="text-lg font-bold mb-2">Types of Cookies We Use</h3>

          <h4 className="font-bold mb-2">Essential Cookies</h4>
          <p className="mb-4">
            These cookies are necessary for the website to function and cannot be disabled. They include
            session cookies that remember your information as you navigate between pages.
          </p>

          <h4 className="font-bold mb-2">Analytics Cookies</h4>
          <p className="mb-4">
            We use Google Analytics and similar services to understand how visitors use our website.
            These cookies collect information about page visits, time spent on pages, and navigation patterns.
          </p>

          <h4 className="font-bold mb-2">Advertising Cookies</h4>
          <p className="mb-4">
            We use cookies for advertising purposes, including Google Ads remarketing and conversion tracking.
            These cookies allow us to show you relevant ads on other websites and measure the effectiveness
            of our advertising campaigns. Third-party advertising partners may also place cookies to show
            you personalized ads based on your browsing activity.
          </p>

          <h3 className="text-lg font-bold mb-2">Managing Cookies</h3>
          <p className="mb-4">
            You can control cookies through your browser settings. Most browsers allow you to refuse cookies
            or delete cookies that have already been set. However, disabling cookies may impact your ability
            to use certain features of our website.
          </p>

          <h3 className="text-lg font-bold mb-2">Third-Party Cookies</h3>
          <p className="mb-4">
            We work with third-party service providers who may set cookies on our website. These include:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Google Ads and Google Analytics</li>
            <li>Social media platforms (Facebook, Twitter, Instagram)</li>
            <li>Other advertising and analytics partners</li>
          </ul>

          <h3 className="text-lg font-bold mb-2">Opt-Out Options</h3>
          <p className="mb-4">
            To opt out of personalized advertising:<br />
            - Google Ads: Visit google.com/settings/ads<br />
            - NAI Opt-Out: Visit networkadvertising.org/choices<br />
            - DAA Opt-Out: Visit optout.aboutads.info
          </p>

          <h3 className="text-lg font-bold mb-2">Contact Us</h3>
          <p>
            For questions about our use of cookies, email us at privacy@tpl-usa-b02.com
          </p>
        </>
      ),
    },
    dnsmpi: {
      title: 'Do Not Sell My Personal Information',
      body: (
        <>
          <p className="mb-4">
            Under certain state privacy laws, including the California Consumer Privacy Act (CCPA), you have
            the right to opt out of the "sale" of your personal information.
          </p>

          <h3 className="text-lg font-bold mb-2">What Constitutes a "Sale"?</h3>
          <p className="mb-4">
            Under privacy laws, "sale" is broadly defined and may include sharing personal information with
            third parties for advertising purposes, even if no money changes hands. This includes sharing
            information with advertising networks and analytics providers.
          </p>

          <h3 className="text-lg font-bold mb-2">Information We May Share</h3>
          <p className="mb-4">
            We may share the following types of information with third parties for advertising and analytics purposes:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Device identifiers and IP addresses</li>
            <li>Browsing history and website usage data</li>
            <li>Demographic information</li>
            <li>Inferred interests and preferences</li>
          </ul>

          <h3 className="text-lg font-bold mb-2">How to Opt Out</h3>
          <p className="mb-4">
            You can opt out of the sale of your personal information by:
          </p>
          <ol className="list-decimal pl-6 mb-4">
            <li>Sending an email to privacy@tpl-usa-b02.com with the subject line "Do Not Sell My Information"</li>
            <li>Calling us at 1-800-555-0123</li>
            <li>Adjusting your browser settings to reject third-party cookies</li>
          </ol>

          <h3 className="text-lg font-bold mb-2">What Happens After You Opt Out?</h3>
          <p className="mb-4">
            After you opt out, we will stop sharing your personal information with third parties for advertising
            purposes to the extent required by law. However, we may still share information as necessary to
            provide our services, comply with legal obligations, or for other permitted purposes.
          </p>

          <h3 className="text-lg font-bold mb-2">Your Other Privacy Rights</h3>
          <p className="mb-4">
            In addition to the right to opt out of sales, you may also have rights to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Know what personal information we collect and how we use it</li>
            <li>Access your personal information</li>
            <li>Delete your personal information</li>
            <li>Not be discriminated against for exercising your rights</li>
          </ul>

          <h3 className="text-lg font-bold mb-2">Authorized Agents</h3>
          <p className="mb-4">
            You may designate an authorized agent to make a request on your behalf. The agent must provide
            proof of authorization and we may need to verify your identity directly.
          </p>

          <h3 className="text-lg font-bold mb-2">Response Time</h3>
          <p className="mb-4">
            We will respond to verifiable requests within 45 days. If we need additional time, we will notify
            you and explain the reason for the delay.
          </p>

          <h3 className="text-lg font-bold mb-2">Contact Us</h3>
          <p>
            To exercise your privacy rights or for questions:<br />
            Email: privacy@tpl-usa-b02.com<br />
            Phone: 1-800-555-0123<br />
            Address: TPL-USA-B02, LLC, 1234 Financial Plaza, Suite 500, San Francisco, CA 94102
          </p>
        </>
      ),
    },
  };

  const currentContent = content[type];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{currentContent.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-gray-700 leading-relaxed">
            {currentContent.body}
          </div>
        </div>

        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
