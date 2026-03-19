import { useState } from 'react';
import PrivacyModal from './PrivacyModal';

const currentYear = new Date().getFullYear();

type ModalType = 'privacy' | 'terms' | 'cookies' | 'dnsmpi' | null;

export default function FooterWithModals() {
  const [modalType, setModalType] = useState<ModalType>(null);

  const openModal = (type: Exclude<ModalType, null>) => {
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
  };

  const footerLinks = {
    company: [
      { label: 'About Us', href: '#' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
    ],
    resources: [
      { label: 'FAQ', href: '#faq' },
      { label: 'Blog', href: '#' },
      { label: 'Pet Care Tips', href: '#' },
      { label: 'Financial Education', href: '#' },
    ],
    legal: [
      { label: 'Privacy Policy', action: () => openModal('privacy') },
      { label: 'Terms of Service', action: () => openModal('terms') },
      { label: 'Cookie Policy', action: () => openModal('cookies') },
      { label: 'Do Not Sell My Info', action: () => openModal('dnsmpi') },
      { label: 'Licenses', href: '#' },
      { label: 'Accessibility', href: '#' },
    ],
    contact: [
      { label: 'Contact Us', href: '#' },
      { label: 'Support Center', href: '#' },
      { label: 'Partner With Us', href: '#' },
    ],
  };

  return (
    <>
      <footer className="bg-gray-900 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            <div className="lg:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-8 h-8 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
                <span className="text-2xl font-bold">TPL-USA-B02</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Making pet care affordable for everyone. Because every pet deserves the best care.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                {footerLinks.company.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-gray-400 hover:text-orange-400 transition-colors text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Resources</h3>
              <ul className="space-y-2">
                {footerLinks.resources.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-gray-400 hover:text-orange-400 transition-colors text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    {'action' in link ? (
                      <button
                        onClick={link.action}
                        className="text-gray-400 hover:text-orange-400 transition-colors text-sm text-left"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a href={link.href} className="text-gray-400 hover:text-orange-400 transition-colors text-sm">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Contact</h3>
              <ul className="space-y-2">
                {footerLinks.contact.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-gray-400 hover:text-orange-400 transition-colors text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-2 text-sm text-gray-400">
                <p>1-800-555-0123</p>
                <p>support@tpl-usa-b02.com</p>
                <p className="mt-4">
                  <strong>Address:</strong><br />
                  TPL-USA-B02, LLC<br />
                  1234 Financial Plaza, Suite 500<br />
                  San Francisco, CA 94102<br />
                  United States
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="mb-6 text-xs text-gray-500 space-y-2">
              <p>
                <strong>Representative Example:</strong> A loan of $5,000 with a 12-month term at 15.99% APR would have 12 monthly payments of $453.57 and a total repayment amount of $5,442.84.
              </p>
              <p>
                <strong>APR Disclosure:</strong> Annual Percentage Rate (APR) ranges from 0% to 35.99%. Actual rate depends on credit profile, loan amount, loan term, credit usage and history. Loans are offered through our lending partners.
              </p>
              <p>
                <strong>Credit Check:</strong> Checking your rate generates a soft credit inquiry which does not impact your credit score. Accepting a loan offer requires a hard credit inquiry which may impact your credit score.
              </p>
              <p>
                <strong>Loan Terms:</strong> Loan amounts from $200 to $10,000. Repayment terms of 3, 6, or 12 months. No prepayment penalties. Late payment fees may apply.
              </p>
              <p>
                <strong>State Availability:</strong> TPL-USA-B02 services are available in select states. Not all applicants will qualify for a loan. Approval and actual loan terms depend on the ability to meet underwriting requirements.
              </p>
              <p>
                <strong>No Guarantee of Approval:</strong> Submitting a loan application does not guarantee approval. All loan applications are subject to credit review and underwriting approval by our lending partners. Loan approval is not guaranteed and depends on meeting eligibility and creditworthiness requirements.
              </p>
              <p>
                <strong>Data Collection & Advertising:</strong> We collect and use personal information for advertising purposes, including working with Google Ads and other advertising partners. We may share information with third-party advertisers and analytics providers. You can opt out of personalized advertising by visiting our Privacy Policy or using the "Do Not Sell My Personal Information" link.
              </p>
              <p>
                <strong>Third-Party Cookies:</strong> This website uses cookies and similar tracking technologies for advertising and analytics purposes. By using this site, you consent to our use of cookies. For more information, see our Cookie Policy.
              </p>
              <p>
                TPL-USA-B02 is a financial technology company, not a bank. Banking services provided by our partner banks, Members FDIC. Loans are originated by Cross River Bank, Member FDIC, or other lending partners.
              </p>
            </div>

            <div className="text-center text-gray-500 text-sm">
              <p>&copy; {currentYear} TPL-USA-B02. All rights reserved.</p>
              <p className="mt-2">
                TPL-USA-B02 is a fictitious brand created for demonstration purposes only.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {modalType && (
        <PrivacyModal
          isOpen={true}
          onClose={closeModal}
          type={modalType}
        />
      )}
    </>
  );
}
