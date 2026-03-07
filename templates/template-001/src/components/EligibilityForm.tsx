import { useState, useEffect } from 'react';

export default function EligibilityForm() {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', zip: '', amount: '2000',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from URL params
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setFormData((prev) => ({
      ...prev,
      zip: p.get('zip') || prev.zip,
      amount: p.get('amount') || prev.amount,
    }));
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Valid email required';
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) e.phone = '10-digit phone required';
    if (!/^\d{5}$/.test(formData.zip)) e.zip = 'Valid ZIP required';
    const amt = Number(formData.amount);
    if (isNaN(amt) || amt < 100 || amt > 5000) e.amount = '$100 – $5,000';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    (window as any).dataLayer?.push({
      event: 'generate_lead_qualified',
      conversion_value: Number(formData.amount),
      currency: 'USD',
    });

    const params = new URLSearchParams(window.location.search);
    const url = new URL('https://www.elasticcredits.com/apply');
    Object.entries(formData).forEach(([k, v]) => url.searchParams.set(k, v));
    ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'cpid', 'click_id'].forEach((k) => {
      const v = params.get(k);
      if (v) url.searchParams.set(k, v);
    });

    await new Promise((r) => setTimeout(r, 1500));
    window.location.href = url.toString();
  };

  const update = (field: string, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const inputCls = (field: string) =>
    `w-full h-11 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all ${
      errors[field] ? 'border-destructive' : 'border-input'
    }`;

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8 space-y-4 text-left">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">First Name</label>
          <input type="text" value={formData.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputCls('firstName')} placeholder="John" />
          {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Last Name</label>
          <input type="text" value={formData.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputCls('lastName')} placeholder="Smith" />
          {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
        <input type="email" value={formData.email} onChange={(e) => update('email', e.target.value)} className={inputCls('email')} placeholder="john@example.com" />
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Phone</label>
        <input type="tel" inputMode="numeric" value={formData.phone} onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputCls('phone')} placeholder="5551234567" />
        {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">ZIP Code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={formData.zip} onChange={(e) => update('zip', e.target.value.replace(/\D/g, '').slice(0, 5))} className={inputCls('zip')} placeholder="90210" />
          {errors.zip && <p className="text-xs text-destructive mt-1">{errors.zip}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Loan Amount</label>
          <input type="text" inputMode="numeric" value={formData.amount} onChange={(e) => update('amount', e.target.value.replace(/\D/g, ''))} className={inputCls('amount')} placeholder="2000" />
          {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn-cta w-full !mt-6 disabled:opacity-60">
        {submitting ? (
          <><svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg><span>Finding your best rate...</span></>
        ) : (
          <><span>See My Rate</span><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>
        )}
      </button>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        By submitting, you agree to our <a href="/terms" className="underline hover:text-foreground">Terms</a> and <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>. Checking your rate won't affect your credit score.
      </p>
    </form>
  );
}
