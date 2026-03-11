import { useEffect } from 'react';
import { X } from 'lucide-react';
import ApplyForm from './ApplyForm';

interface ApplyModalProps {
  zipCode: string;
  onClose: () => void;
}

export default function ApplyModal({ zipCode, onClose }: ApplyModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl mx-4 my-8 animate-fade-up">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:shadow-xl transition-all"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-primary px-7 py-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">
                Great news — financing is available in your area
              </p>
              <p className="text-primary-soft text-xs mt-0.5">
                Zip code: <span className="font-mono font-bold text-accent">{zipCode}</span>
                <span className="mx-2 opacity-40">·</span>
                No hard credit check
                <span className="mx-2 opacity-40">·</span>
                Decision in seconds
              </p>
            </div>
          </div>

          <ApplyForm modal />
        </div>
      </div>
    </div>
  );
}
