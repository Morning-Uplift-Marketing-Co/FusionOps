import { useState } from 'react';

const faqs = [
  {
    question: "How quickly can I get approved?",
    answer: "Most applicants receive an instant decision within seconds of submitting their application. Once approved, funds are typically available the same business day, allowing you to care for your pet without delay."
  },
  {
    question: "Will checking my rate affect my credit score?",
    answer: "No! We use a soft credit inquiry for pre-qualification, which does not impact your credit score. Only if you decide to accept a loan offer and complete the application will we perform a hard credit pull."
  },
  {
    question: "What credit score do I need to qualify?",
    answer: "We work with a wide range of credit profiles. While we don't have a strict minimum credit score requirement, applicants with scores of 600 or higher typically have the best approval odds and rates. We consider multiple factors beyond just credit score."
  },
  {
    question: "What are the loan terms and APR ranges?",
    answer: "You can borrow between $200 and $10,000 with repayment terms of 3, 6, or 12 months. APR ranges from 0% to 35.99% based on your creditworthiness, with qualified borrowers receiving rates as low as 0%."
  },
  {
    question: "Are there any hidden fees?",
    answer: "Absolutely not. We believe in complete transparency. There are no origination fees, application fees, or prepayment penalties. The APR you see is what you get, and you can pay off your loan early without any additional charges."
  },
  {
    question: "What types of pet expenses are eligible?",
    answer: "TPL-USA-B02 can finance virtually any pet-related expense including veterinary care, surgeries, medications, grooming, training, boarding, pet supplies, and more. If it's for your pet's health or wellbeing, we can likely help."
  },
  {
    question: "Can I use TPL-USA-B02 at any veterinary clinic?",
    answer: "Yes! Unlike some pet financing options, TPL-USA-B02 provides you with funds that can be used at any veterinary clinic, pet store, groomer, or service provider. You're not limited to specific networks or participating locations."
  },
  {
    question: "What if I need to change my payment date?",
    answer: "We understand that life happens. Contact our customer support team and we'll work with you to adjust your payment schedule to better fit your needs. We're here to help, not add stress."
  },
  {
    question: "How do I make payments?",
    answer: "Payments are automatically withdrawn from your bank account on your selected payment date each month. You can also make additional payments or pay off your loan early at any time through your online account portal."
  },
  {
    question: "What information do I need to apply?",
    answer: "You'll need a valid government-issued ID, proof of income, an active checking account, and basic personal information. The application takes just 2-3 minutes to complete."
  },
  {
    question: "Can I apply if I'm self-employed?",
    answer: "Yes! We accept applications from self-employed individuals. You'll need to provide documentation of your income such as bank statements or tax returns to verify your ability to repay the loan."
  },
  {
    question: "What happens if I miss a payment?",
    answer: "We encourage you to contact us immediately if you're having trouble making a payment. We may be able to work out a solution. Late payments may incur fees and could impact your credit score, so it's important to communicate with us."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            FAQ
          </div>
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Got questions? We've got answers. Find everything you need to know about TPL-USA-B02.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-blue-50/50 transition-colors"
                >
                  <span className="text-lg font-bold text-gray-900 pr-8">
                    {faq.question}
                  </span>
                  <svg
                    className={`w-6 h-6 text-blue-600 flex-shrink-0 transition-transform ${
                      openIndex === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openIndex === index ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <div className="px-6 pb-5 text-gray-700 leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Still Have Questions CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-8 max-w-3xl mx-auto border border-blue-100 shadow-xl">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Still Have Questions?
            </h3>
            <p className="text-gray-700 mb-8 text-lg">
              Our friendly customer support team is here to help you every step of the way.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:1-800-555-0123"
                className="inline-flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us
              </a>
              <a
                href="mailto:support@tpl-usa-b02.com"
                className="inline-flex items-center justify-center bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
