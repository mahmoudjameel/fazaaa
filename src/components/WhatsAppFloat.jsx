import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { X, MessageCircle } from 'lucide-react';

const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);

export const WhatsAppFloat = () => {
  const [phone, setPhone] = useState({ number: '', display: '' });
  const [visible, setVisible] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'support'));
        if (snap.exists()) {
          const data = snap.data();
          setPhone({
            number: data.whatsappNumber || '966551780608',
            display: data.whatsappDisplay || '+966 55 178 0608',
          });
        } else {
          setPhone({ number: '966551780608', display: '+966 55 178 0608' });
        }
      } catch {
        setPhone({ number: '966551780608', display: '+966 55 178 0608' });
      } finally {
        setLoading(false);
        setTimeout(() => setVisible(true), 600);
        setTimeout(() => setTooltipOpen(true), 1800);
        setTimeout(() => setTooltipOpen(false), 5000);
      }
    };
    fetchSupport();
  }, []);

  if (loading || !phone.number) return null;

  const waLink = `https://wa.me/${phone.number}?text=${encodeURIComponent('مرحباً، أحتاج مساعدة')}`;

  return (
    <div
      className={`fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      dir="ltr"
    >
      {/* Tooltip / phone number bubble */}
      <div className={`transition-all duration-500 ${tooltipOpen ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-3 pointer-events-none'} flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-xl mb-1`}>
        <WhatsAppIcon className="w-4 h-4 text-[#25D366] flex-shrink-0" />
        <span className="text-gray-800 font-bold text-sm tracking-wide">{phone.display}</span>
        <button
          onClick={() => setTooltipOpen(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors mr-1"
          aria-label="إغلاق"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main floating button */}
      <div className="flex items-center gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`تواصل عبر واتساب: ${phone.display}`}
          className="relative group w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => { }}
        >
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25" />
          <WhatsAppIcon className="w-7 h-7 text-white relative z-10" />
        </a>

        {/* Number label – visible on hover or when tooltip is open */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`bg-white border border-gray-200 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-2 hover:shadow-xl transition-all duration-300 group ${tooltipOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
        >
          <span className="text-gray-800 font-bold text-sm">{phone.display}</span>
          <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
        </a>
      </div>
    </div>
  );
};
