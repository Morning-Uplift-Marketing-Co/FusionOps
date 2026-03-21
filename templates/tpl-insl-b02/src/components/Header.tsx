// Header Component สำหรับแสดงส่วนหัวของเว็บไซต์
// Header Component for displaying website header
import { useState, useEffect } from 'react';

export default function Header() {
  // ตัวแปรสำหรับเก็บสถานะการเลื่อนหน้าจอ
  // State variable to track scroll position
  const [isScrolled, setIsScrolled] = useState(false);

  // ฟังก์ชันสำหรับตรวจสอบการเลื่อนหน้าจอและเปลี่ยนสไตล์ของ header
  // Function to detect scroll and update header style
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Top bar */}
      <div className="bg-slate-900 text-white py-2.5 text-sm border-b border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span className="font-medium">+1-800-232-7582</span>
            </div>
            <span className="hidden md:inline text-slate-300">Mon-Fri, 9:00 AM - 6:00 PM ET</span>
          </div>
          <div className="hidden md:flex items-center space-x-4 text-xs text-slate-300">
            <span className="flex items-center space-x-1">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>4.9/5 stars</span>
            </span>
            <span>•</span>
            <span>No hard credit check</span>
            <span>•</span>
            <span>Instant decisions</span>
          </div>
        </div>
      </div>

      <header
        className={`fixed top-[42px] left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white shadow-lg py-3'
            : 'bg-slate-900/60 backdrop-blur-md py-4 border-b border-white/10'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isScrolled ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-white/10'}`}>
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
              </div>
              <span className={`text-2xl font-bold ${isScrolled ? 'bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent' : 'text-white'}`}>
                TPL-USA-B02
              </span>
            </div>

          </div>
        </div>
      </header>
    </>
  );
}
