import { useState } from 'react';
import { Phone, Copy, Check } from 'lucide-react';
import { formatPhoneWith00, phoneForIntlDial, WHATSAPP_ICON_PATH } from '../utils/phoneDisplay';

export function PhoneWithActions({ phone, size = 'md' }) {
  const [copied, setCopied] = useState(false);

  const rawPhone = String(phone || '').trim();
  const displayPhone = formatPhoneWith00(rawPhone);
  const intlPhone = phoneForIntlDial(rawPhone);

  const btnClass = size === 'sm'
    ? 'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors'
    : 'inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors';

  const iconSize = size === 'sm' ? 15 : 16;
  const textClass = size === 'sm'
    ? 'text-sm text-gray-800 font-semibold tracking-wide'
    : 'text-gray-800 font-semibold tracking-wide';

  const copyPhone = async () => {
    if (!displayPhone) return;
    try {
      await navigator.clipboard.writeText(displayPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('تعذر النسخ — انسخ الرقم يدوياً');
    }
  };

  if (!displayPhone) {
    return <p className="text-gray-500">لا يوجد</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className={textClass} dir="ltr">{displayPhone}</p>
      {intlPhone && (
        <a
          href={`tel:+${intlPhone}`}
          title="اتصال"
          className={`${btnClass} bg-teal-50 text-teal-700 hover:bg-teal-100`}
        >
          <Phone size={iconSize} />
        </a>
      )}
      <button
        type="button"
        onClick={copyPhone}
        title="نسخ الرقم"
        className={`${btnClass} bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700`}
      >
        {copied ? <Check size={iconSize} className="text-teal-600" /> : <Copy size={iconSize} />}
      </button>
      {intlPhone && (
        <a
          href={`https://wa.me/${intlPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          title="فتح واتساب"
          className={`${btnClass} bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20`}
        >
          <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="currentColor" aria-hidden="true">
            <path d={WHATSAPP_ICON_PATH} />
          </svg>
        </a>
      )}
    </div>
  );
}

export default PhoneWithActions;
