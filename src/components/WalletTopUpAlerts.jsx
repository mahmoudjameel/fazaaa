import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

// Acknowledgement is per admin and browser; it never changes payment/settlement state.
function AlertsForAdmin({ uid }) {
  const key = `wallet-topups-reviewed:${uid}`;
  const readSeen = () => {
    try { return Math.max(0, Number(localStorage.getItem(key)) || 0); } catch { return 0; }
  };
  const [seen, setSeen] = useState(readSeen);
  const [paid, setPaid] = useState([]);
  const [pending, setPending] = useState(0);
  const [paidError, setPaidError] = useState(false);
  const [pendingError, setPendingError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = (event) => { if (event.key === key) setSeen(readSeen()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);
  useEffect(() => {
    setReady(false);
    return onSnapshot(query(collection(db, 'wallet_topups'), where('paidAt', '>', Timestamp.fromMillis(seen))), (snap) => {
      setPaid(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.state === 'PAID' && d.source !== 'admin_panel'));
      setPaidError(false);
      setReady(true);
    }, () => { setPaidError(true); setReady(false); });
  }, [seen]);
  useEffect(() => onSnapshot(query(collection(db, 'wallet_topups'), where('state', 'in', ['CREATED', 'PENDING_PAYMENT', 'PROCESSING'])), (snap) => {
    // محاولات متروكة قديمة تبقى «بانتظار الدفع» للأبد — نعدّ آخر 24 ساعة فقط
    const since = Date.now() - 24 * 60 * 60 * 1000;
    setPending(snap.docs.filter((d) => d.data().source !== 'admin_panel'
      && (d.data().createdAt?.toMillis?.() || 0) >= since).length);
    setPendingError(false);
  }, () => setPendingError(true)), []);
  const acknowledge = () => {
    // Use the latest displayed server timestamp, never the browser clock.
    const latest = Math.max(seen, ...paid.map((d) => d.paidAt?.toMillis?.() || 0));
    try { localStorage.setItem(key, String(latest)); } catch { /* session-only acknowledgement */ }
    setSeen(latest);
  };
  return (
    <aside className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/wallet-topups" className="font-bold text-teal-900">
          شحن المزودين: {ready ? `${paid.length} شحنات ناجحة غير مراجعة` : 'جارٍ تحميل التنبيهات…'}
          {' • '}{pendingError ? 'تعذر تحميل المعلّق' : `${pending} بانتظار الدفع أو التأكيد (آخر 24 ساعة)`}
        </Link>
        {ready && paid.length > 0 && (
          <button type="button" onClick={acknowledge} className="rounded-lg bg-white px-3 py-2 font-bold text-teal-800 border border-teal-200">
            تمت مراجعة التنبيهات ({paid.length})
          </button>
        )}
      </div>
      {paidError || pendingError ? <p className="mt-2 text-red-700">تعذر تحديث بعض تنبيهات الشحن. أعد تحميل الصفحة؛ الأرقام قد تكون غير محدثة.</p> : null}
      <p className="mt-1 text-xs text-teal-800">يتحدث تلقائيًا عند تأكيد الدفع، دون انتظار التسوية البنكية. مراجعة التنبيه لا تؤكد وصول التسوية. تُحفظ المراجعة لهذا الحساب على هذا المتصفح.</p>
    </aside>
  );
}

export function WalletTopUpAlerts() {
  const [uid, setUid] = useState(auth.currentUser?.uid || null);
  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid || null)), []);
  return uid ? <AlertsForAdmin key={uid} uid={uid} /> : null;
}
