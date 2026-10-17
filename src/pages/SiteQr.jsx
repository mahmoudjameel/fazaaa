import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** الرابط داخل الباركود: يعدّ المسح ثم يفتح الصفحة الرئيسية */
const SCAN_URL = 'https://fzaeen.com/go';

export default function SiteQr() {
  const [src, setSrc] = useState('');

  useEffect(() => {
    document.title = 'باركود فزاعين';
    QRCode.toDataURL(SCAN_URL, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then(setSrc).catch(() => setSrc(''));
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F4EF] flex items-center justify-center p-6" dir="rtl">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 px-8 py-10 text-center max-w-md w-full">
        <img src="/fzaeen-logo.jpeg" alt="فزاعين" className="w-16 h-16 rounded-2xl mx-auto object-cover" />
        <h1 className="mt-4 text-2xl font-black text-gray-900">فزاعين</h1>
        <p className="mt-2 text-sm text-gray-500">امسح الباركود بالجوال لفتح الموقع</p>
        {src ? (
          <img src={src} alt="باركود يفتح fzaeen.com" className="mx-auto mt-6 w-72 h-72" />
        ) : (
          <p className="mt-8 text-sm text-gray-400">جاري تجهيز الباركود...</p>
        )}
      </div>
    </div>
  );
}
