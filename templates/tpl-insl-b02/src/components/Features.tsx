import { useState } from 'react';

const features = [
  {
    title: "Flexible Loan Amounts",
    description: "Borrow anywhere from $200 to $10,000 based on your needs and qualifications.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  {
    title: "No Hidden Fees",
    description: "What you see is what you get. No origination fees, prepayment penalties, or surprises.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  {
    title: "Fast Approval",
    description: "Get a decision in seconds and access to funds the same day you're approved.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z"
  },
  {
    title: "Soft Credit Check",
    description: "Check your rate without impacting your credit score. Only a hard pull when you accept.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  },
  {
    title: "Multiple Payment Options",
    description: "Choose from 3, 6, or 12-month payment plans that fit your budget.",
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
  },
  {
    title: "Dedicated Support",
    description: "Our pet-loving team is here to help you every step of the way.",
    icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
  }
];

export default function Features() {
  const [loanAmount, setLoanAmount] = useState(5000);
  const [term, setTerm] = useState(6);

  const calculateMonthlyPayment = () => {
    const apr = 0.1599; // 15.99% example APR
    const monthlyRate = apr / 12;
    const payment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                    (Math.pow(1 + monthlyRate, term) - 1);
    return payment.toFixed(2);
  };

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            Why Choose Us
          </div>
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-4">
            Simple, Transparent Pet Care Financing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We're committed to making pet care financing simple, transparent, and stress-free
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div key={index} className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all border border-gray-100 hover:border-blue-200 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-shadow group-hover:scale-110">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Loan Calculator */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-3xl shadow-2xl p-8 md:p-12 max-w-4xl mx-auto relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>

          <div className="relative z-10">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center">
              Loan Payment Calculator
            </h3>
            <p className="text-blue-200 text-center mb-10">See what your monthly payment could look like</p>

            <div className="space-y-8">
              {/* Loan Amount Slider */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-blue-100 font-semibold">Loan Amount</label>
                  <span className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
                    ${loanAmount.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="10000"
                  step="100"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(parseInt(e.target.value))}
                  className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-blue-200 mt-2">
                  <span>$200</span>
                  <span>$10,000</span>
                </div>
              </div>

              {/* Term Selector */}
              <div>
                <label className="text-blue-100 font-semibold mb-4 block">Payment Term</label>
                <div className="grid grid-cols-3 gap-4">
                  {[3, 6, 12].map((months) => (
                    <button
                      key={months}
                      onClick={() => setTerm(months)}
                      className={`py-4 px-6 rounded-xl font-bold transition-all ${
                        term === months
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg scale-105'
                          : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                      }`}
                    >
                      {months} months
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center">
                <div className="text-blue-100 font-semibold mb-3 text-lg">Estimated Monthly Payment</div>
                <div className="text-5xl md:text-6xl font-bold text-white mb-6">
                  ${calculateMonthlyPayment()}
                </div>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Based on 15.99% APR. Your actual rate may vary from 0%-35.99% based on creditworthiness.
                </p>
              </div>

              <div className="text-center">
                <a
                  href="/apply.html"
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  <span>Get Your Actual Rate</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            cursor: pointer;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
            border: 3px solid white;
          }

          .slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            cursor: pointer;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
          }
        `}
      </style>
    </section>
  );
}
