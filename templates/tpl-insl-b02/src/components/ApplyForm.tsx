import { useState } from 'react';

export default function ApplyForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    zipCode: '',
    loanAmount: '',
    loanPurpose: '',
    employmentStatus: '',
    annualIncome: '',
    ssn: '',
    dateOfBirth: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = 'Valid email is required';
    if (!formData.phone.match(/^\d{10}$/)) newErrors.phone = 'Valid 10-digit phone number is required';
    if (!formData.zipCode.match(/^\d{5}$/)) newErrors.zipCode = 'Valid 5-digit ZIP code is required';
    if (!formData.loanAmount || parseFloat(formData.loanAmount) < 200 || parseFloat(formData.loanAmount) > 10000) {
      newErrors.loanAmount = 'Loan amount must be between $200 and $10,000';
    }
    if (!formData.loanPurpose) newErrors.loanPurpose = 'Please select a loan purpose';
    if (!formData.employmentStatus) newErrors.employmentStatus = 'Please select employment status';
    if (!formData.annualIncome || parseFloat(formData.annualIncome) < 1) {
      newErrors.annualIncome = 'Annual income is required';
    }
    if (!formData.ssn.match(/^\d{9}$/)) newErrors.ssn = 'Valid 9-digit SSN is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Log form data to console (in production, this would send to your backend)
      console.log('Loan Application Submitted:', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        zipCode: formData.zipCode,
        loanAmount: formData.loanAmount,
        loanPurpose: formData.loanPurpose,
        employmentStatus: formData.employmentStatus,
        annualIncome: formData.annualIncome,
        dateOfBirth: formData.dateOfBirth,
      });

      setSubmitStatus('success');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        zipCode: '',
        loanAmount: '',
        loanPurpose: '',
        employmentStatus: '',
        annualIncome: '',
        ssn: '',
        dateOfBirth: '',
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-3xl font-bold text-gray-900 mb-4">Application Submitted!</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Thank you for applying! We're reviewing your application and will get back to you within 24 hours with a decision.
        </p>
        <button
          onClick={() => setSubmitStatus('idle')}
          className="bg-teal-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-teal-700 transition-colors"
        >
          Submit Another Application
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitStatus === 'error' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700">
            There was an error submitting your application. Please try again or contact support.
          </p>
        </div>
      )}

      {/* Personal Information */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.firstName ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.lastName ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={(e) => handleChange({ ...e, target: { ...e.target, value: e.target.value.replace(/\D/g, '').slice(0, 10) } })}
            placeholder="1234567890"
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">
            ZIP Code *
          </label>
          <input
            type="text"
            id="zipCode"
            name="zipCode"
            value={formData.zipCode}
            onChange={(e) => handleChange({ ...e, target: { ...e.target, value: e.target.value.replace(/\D/g, '').slice(0, 5) } })}
            placeholder="12345"
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.zipCode ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode}</p>}
        </div>

        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-gray-700 mb-2">
            Date of Birth *
          </label>
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
        </div>
      </div>

      {/* Loan Information */}
      <div className="pt-6 border-t-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Loan Information</h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="loanAmount" className="block text-sm font-semibold text-gray-700 mb-2">
              Requested Loan Amount * ($200 - $10,000)
            </label>
            <input
              type="number"
              id="loanAmount"
              name="loanAmount"
              value={formData.loanAmount}
              onChange={handleChange}
              min="200"
              max="10000"
              step="100"
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
                errors.loanAmount ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.loanAmount && <p className="text-red-500 text-sm mt-1">{errors.loanAmount}</p>}
          </div>

          <div>
            <label htmlFor="loanPurpose" className="block text-sm font-semibold text-gray-700 mb-2">
              Loan Purpose *
            </label>
            <select
              id="loanPurpose"
              name="loanPurpose"
              value={formData.loanPurpose}
              onChange={handleChange}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
                errors.loanPurpose ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select purpose</option>
              <option value="veterinary">Veterinary Care</option>
              <option value="emergency">Emergency Treatment</option>
              <option value="surgery">Surgery</option>
              <option value="preventive">Preventive Care</option>
              <option value="grooming">Grooming & Boarding</option>
              <option value="training">Training</option>
              <option value="supplies">Pet Supplies</option>
              <option value="other">Other</option>
            </select>
            {errors.loanPurpose && <p className="text-red-500 text-sm mt-1">{errors.loanPurpose}</p>}
          </div>
        </div>
      </div>

      {/* Financial Information */}
      <div className="pt-6 border-t-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Financial Information</h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="employmentStatus" className="block text-sm font-semibold text-gray-700 mb-2">
              Employment Status *
            </label>
            <select
              id="employmentStatus"
              name="employmentStatus"
              value={formData.employmentStatus}
              onChange={handleChange}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
                errors.employmentStatus ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select status</option>
              <option value="employed">Employed Full-Time</option>
              <option value="part-time">Employed Part-Time</option>
              <option value="self-employed">Self-Employed</option>
              <option value="retired">Retired</option>
              <option value="other">Other</option>
            </select>
            {errors.employmentStatus && <p className="text-red-500 text-sm mt-1">{errors.employmentStatus}</p>}
          </div>

          <div>
            <label htmlFor="annualIncome" className="block text-sm font-semibold text-gray-700 mb-2">
              Annual Income *
            </label>
            <input
              type="number"
              id="annualIncome"
              name="annualIncome"
              value={formData.annualIncome}
              onChange={handleChange}
              min="0"
              step="1000"
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
                errors.annualIncome ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.annualIncome && <p className="text-red-500 text-sm mt-1">{errors.annualIncome}</p>}
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor="ssn" className="block text-sm font-semibold text-gray-700 mb-2">
            Social Security Number * (Encrypted & Secure)
          </label>
          <input
            type="password"
            id="ssn"
            name="ssn"
            value={formData.ssn}
            onChange={(e) => handleChange({ ...e, target: { ...e.target, value: e.target.value.replace(/\D/g, '').slice(0, 9) } })}
            placeholder="•••••••••"
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-teal-500 ${
              errors.ssn ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.ssn && <p className="text-red-500 text-sm mt-1">{errors.ssn}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Your information is encrypted and secure. We use bank-level security to protect your data.
          </p>
        </div>
      </div>

      {/* Consent */}
      <div className="pt-6 border-t-2 border-gray-200">
        <label className="flex items-start">
          <input
            type="checkbox"
            required
            className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500 mt-0.5"
          />
          <span className="ml-3 text-sm text-gray-700">
            I authorize TPL-USA-B02 to obtain my credit report and verify my information. I understand this is a soft inquiry that won't affect my credit score until I accept a loan offer. *
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-amber-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-amber-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By submitting this application, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}
