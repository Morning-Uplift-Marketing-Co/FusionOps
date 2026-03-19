import ApplyForm from './ApplyForm';

export default function ApplySection() {
  return (
    <section id="apply" className="py-20 bg-gradient-to-br from-gray-50 to-teal-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Apply for Financing
            </h2>
            <p className="text-xl text-gray-600">
              Get approved in minutes and give your pet the care they deserve
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
            <ApplyForm />
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 grid md:grid-cols-3 gap-6 text-center">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <svg className="w-12 h-12 text-teal-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="font-bold text-gray-900 mb-1">Bank-Level Security</h3>
              <p className="text-sm text-gray-600">256-bit encryption protects your data</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg">
              <svg className="w-12 h-12 text-teal-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-bold text-gray-900 mb-1">Instant Decision</h3>
              <p className="text-sm text-gray-600">Know your approval status in seconds</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-lg">
              <svg className="w-12 h-12 text-teal-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-bold text-gray-900 mb-1">No Credit Impact</h3>
              <p className="text-sm text-gray-600">Soft pull for pre-qualification</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
