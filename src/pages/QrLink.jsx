import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { QrCode, Copy, Check } from 'lucide-react';
import { db } from '../services/firebase';

const PUBLIC_URL = 'https://fzaeen.com/q';

function formatWhen(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
}

export default function QrLink() {
  const [total, setTotal] = useState(0);
  const [lastOpenedAt, setLastOpenedAt] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'qr_links', 'main'), (snap) => {
      const data = snap.data() || {};
      setTotal(Number(data.totalOpens) || 0);
      setLastOpenedAt(data.lastOpenedAt || null);
    });
    return unsub;
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <QrCode className="w-7 h-7 text-amber-500" />
          باركود الموقع
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          افتح الرابط عشان تشوف الباركود. لما أحد يمسحه بالجوال يفتح الموقع الرئيسي، والفتحة تتحسب هنا.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">الرابط</p>
          <p className="font-mono text-lg font-bold text-gray-900 break-all">{PUBLIC_URL}</p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-950 text-white text-sm font-bold"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'تم النسخ' : 'نسخ الرابط'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-400">عدد الفتحات</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-400">آخر فتحة</p>
          <p className="text-sm font-bold text-gray-900 mt-2">{formatWhen(lastOpenedAt)}</p>
        </div>
      </div>
    </div>
  );
}
