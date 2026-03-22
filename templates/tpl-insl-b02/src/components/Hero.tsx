import { useState } from 'react';
import { z } from 'zod';

// Zod schema สำหรับตรวจสอบ ZIP code (5 หลักเท่านั้น)
// Zod schema for ZIP code validation (5 digits only)
const zipCodeSchema = z.string().regex(/^\d{5}$/, 'Please enter a valid 5-digit ZIP code');

export default function Hero() {
  const [zipCode, setZipCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // ฟังก์ชันสำหรับค้นหาชื่อเมืองจาก ZIP code โดยใช้ Zippopotam.us API
  // Function to lookup city name from ZIP code using Zippopotam.us API
  const lookupCity = async (zip: string) => {
    try {
      setIsValidating(true);
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const city = data.places[0]['place name'];
          const state = data.places[0]['state abbreviation'];
          setCityName(`${city}, ${state}`);
          setError('');
        } else {
          setCityName('');
          setError('ZIP code not found');
        }
      } else {
        setCityName('');
        setError('ZIP code not found');
      }
    } catch (err) {
      setCityName('');
      setError('Unable to validate ZIP code');
    } finally {
      setIsValidating(false);
    }
  };

  // ฟังก์ชันจัดการการเปลี่ยนแปลง ZIP code input
  // Handle ZIP code input change
  const handleZipChange = (value: string) => {
    setZipCode(value);
    setCityName('');
    setError('');

    // ตรวจสอบและค้นหาเมืองเมื่อกรอกครบ 5 หลัก
    // Validate and lookup city when 5 digits are entered
    if (value.length === 5) {
      const validation = zipCodeSchema.safeParse(value);
      if (validation.success) {
        lookupCity(value);
      } else {
        setError(validation.error.errors[0].message);
      }
    }
  };

  // ฟังก์ชันจัดการการ submit form
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = zipCodeSchema.safeParse(zipCode);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    // นำทางไปยังหน้าสมัคร พร้อม ZIP code เป็น query parameter
    // Navigate to application page with ZIP code as query parameter
    window.location.href = `/apply.html?zip=${zipCode}`;
  };

  return (
    <div className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 overflow-hidden min-h-screen flex items-center">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-orange-500/10 to-blue-500/10 animate-pulse"></div>
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-blue-200 text-sm">Fast Approval • 0% APR Available</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Pet Care Financing
            <span className="block text-orange-400">Made Simple</span>
          </h1>

          <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            $200 to $10,000 installment loans for veterinary care and pet expenses. All credit types welcome.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-12">
            <div className="bg-white rounded-2xl p-2 shadow-2xl">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => handleZipChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="Enter ZIP Code"
                  className="flex-1 px-5 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 text-lg"
                  maxLength={5}
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
                >
                  Get Started
                </button>
              </div>
            </div>
            {error && (
              <p className="text-red-300 text-sm mt-3 bg-red-500/20 px-4 py-2 rounded-lg inline-block">{error}</p>
            )}
            {isValidating && (
              <p className="text-blue-200 text-sm mt-3">Validating ZIP code...</p>
            )}
            {cityName && (
              <p className="text-green-300 text-sm mt-3 bg-green-500/20 px-4 py-2 rounded-lg inline-block flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {cityName}
              </p>
            )}
            <p className="text-blue-200 text-sm mt-4 flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              No credit score impact
            </p>
          </form>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-bold text-white mb-1">4.9/5</div>
              <div className="text-blue-200 text-sm">9,400+ Reviews</div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-bold text-white mb-1">2.4k+</div>
              <div className="text-blue-200 text-sm">Happy Customers</div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-bold text-white mb-1">$10k</div>
              <div className="text-blue-200 text-sm">Max Loan</div>
            </div>
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="text-3xl font-bold text-white mb-1">24/7</div>
              <div className="text-blue-200 text-sm">Support</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
