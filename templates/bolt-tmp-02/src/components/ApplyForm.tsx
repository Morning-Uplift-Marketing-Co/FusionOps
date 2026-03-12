import { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase, LoanApplication } from '../lib/supabase';
import { useInView } from '../hooks/useInView';

export interface ApplyFormProps {
  modal?: boolean;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

type FormState = 'idle' | 'loading' | 'success' | 'error';

const initialForm: LoanApplication = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  state: '',
  requested_amount: 3000,
};

type Errors = Partial<Record<keyof LoanApplication, string>>;

function validate(form: LoanApplication): Errors {
  const errors: Errors = {};
  if (!form.first_name.trim()) errors.first_name = 'First name is required';
  if (!form.last_name.trim()) errors.last_name = 'Last name is required';
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = 'Valid email address is required';
  if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10)
    errors.phone = 'Valid 10-digit phone number is required';
  if (!form.state) errors.state = 'Please select your state';
  if (form.requested_amount < 200 || form.requested_amount > 10000)
    errors.requested_amount = 'Amount must be between $200 and $10,000';
  return errors;
}

function FormContent({ modal = false }: ApplyFormProps) {
  const { ref, inView } = useInView();
  const [form, setForm] = useState<LoanApplication>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [formState, setFormState] = useState<FormState>('idle');

  const update = (field: keyof LoanApplication, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setFormState('loading');
    try {
      const { error } = await supabase.from('loan_applications').insert([form]);
      if (error) throw error;
      setFormState('success');
    } catch {
      setFormState('error');
    }
  };

  const inputClass = (field: keyof LoanApplication) =>
    `w-full px-4 py-3 rounded-xl border text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
      errors[field]
        ? 'border-red-300 focus:ring-red-200 bg-red-50'
        : 'border-gray-200 focus:ring-teal-200 focus:border-teal-400 bg-white'
    }`;

  if (formState === 'success') {
    return (
      <div className={modal ? 'p-10 text-center' : 'py-16 px-4 text-center'}>
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-teal-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Application Received!</h2>
          <p className="text-gray-500 mb-6">
            Thank you, <strong className="text-gray-800">{form.first_name}</strong>! We've received your application and will be in touch shortly. Most applicants hear back within seconds.
          </p>
          <div className="bg-teal-50 rounded-xl p-4 text-sm text-teal-700 mb-6">
            Check your inbox at <strong>{form.email}</strong> for your application confirmation.
          </div>
          <button
            onClick={() => { setForm(initialForm); setFormState('idle'); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
          >
            Submit another application
          </button>
        </div>
      </div>
    );
  }

  const innerForm = (
    <form onSubmit={handleSubmit} className={modal ? 'p-7 md:p-8' : 'bg-white rounded-3xl p-7 md:p-8 shadow-2xl'}>
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Requested Loan Amount
        </label>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-teal-700">
            ${form.requested_amount.toLocaleString()}
          </span>
          <span className="text-xs text-gray-400">$200 – $10,000</span>
        </div>
        <input
          type="range"
          min={200}
          max={10000}
          step={100}
          value={form.requested_amount}
          onChange={(e) => update('requested_amount', Number(e.target.value))}
          className="w-full accent-teal-600 cursor-pointer"
        />
        {errors.requested_amount && (
          <p className="text-red-500 text-xs mt-1">{errors.requested_amount}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
          <input
            type="text"
            placeholder="Jane"
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            className={inputClass('first_name')}
          />
          {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
          <input
            type="text"
            placeholder="Smith"
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            className={inputClass('last_name')}
          />
          {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
        <input
          type="email"
          placeholder="jane@example.com"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputClass('email')}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <input
            type="tel"
            placeholder="(555) 000-0000"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass('phone')}
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
          <select
            value={form.state}
            onChange={(e) => update('state', e.target.value)}
            className={inputClass('state')}
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
        </div>
      </div>

      {formState === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-red-600 text-sm">Something went wrong. Please try again or call us at +1-800-232-7562.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={formState === 'loading'}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-base py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
      >
        {formState === 'loading' ? (
          <>
            <Loader size={18} className="animate-spin" />
            Submitting...
          </>
        ) : (
          'Check My Rate — No Hard Credit Pull'
        )}
      </button>

      <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
        By submitting, you agree to our{' '}
        <a href="#" className="underline hover:text-gray-600">Terms of Service</a> and{' '}
        <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
        A soft credit inquiry will be performed and will not affect your credit score.
      </p>
    </form>
  );

  if (modal) {
    return innerForm;
  }

  const shouldAnimate = typeof window === 'undefined' ? true : inView;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
      <div ref={ref}>
        <span
          className={`inline-block text-amber-400 font-semibold text-sm uppercase tracking-widest mb-4 transition-all duration-700 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          Get Started Today
        </span>
        <h2
          className={`text-3xl sm:text-4xl font-extrabold text-white mb-5 transition-all duration-700 delay-100 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          Check Your Rate in 3 Minutes
        </h2>
        <p
          className={`text-teal-200 text-lg leading-relaxed mb-8 transition-all duration-700 delay-200 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          Fill out our quick pre-qualification form. There's no commitment and no hard credit pull — your credit score won't be affected.
        </p>
        <div
          className={`space-y-4 transition-all duration-700 delay-300 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {[
            { icon: Shield, text: 'Soft credit check only — zero impact on your score' },
            { icon: CheckCircle, text: 'Instant decision in most cases' },
            { icon: CheckCircle, text: 'Borrow $200 to $10,000 for any pet care need' },
            { icon: CheckCircle, text: '0% APR available for qualified applicants' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon size={18} className="text-amber-400 shrink-0" />
              <span className="text-teal-100 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className={`transition-all duration-700 delay-200 ${shouldAnimate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {innerForm}
      </div>
    </div>
  );
}

export default function ApplyForm({ modal = false }: ApplyFormProps) {
  if (modal) {
    return <FormContent modal />;
  }

  return (
    <section id="apply" className="py-20 lg:py-28 bg-teal-900 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FormContent />
      </div>
    </section>
  );
}
