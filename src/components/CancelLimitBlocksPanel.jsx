import { useCallback, useEffect, useState } from 'react';
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Loader2, RefreshCw, ShieldOff, TimerOff } from 'lucide-react';
import { auth, db } from '../services/firebase';

/**
 * العملاء الموقوفون مؤقتاً لتكرار الإلغاء بعد قبول المزود.
 * السيرفر يكتب customer_request_limits (functions/lib/customerCancelLimits.js)، والإدارة ترفع الإيقاف هنا.
 */
const REASON_LABEL = {
  accepted_cancel: '3 إلغاءات بعد القبول خلال يوم',
  arrived_cancel: 'إلغاءان بعد وصول المزود خلال يوم',
  arrived_cancel_repeat: 'تكرار الإلغاء بعد الوصول',
};

const fmt = (ts) => (ts?.toDate ? format(ts.toDate(), 'dd MMM yyyy، HH:mm', { locale: ar }) : '—');

async function loadCustomer(customerId) {
  const snap = await getDoc(doc(db, 'customers', customerId)).catch(() => null);
  return snap?.exists() ? snap.data() : null;
}

export default function CancelLimitBlocksPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liftingId, setLiftingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(query(
        collection(db, 'customer_request_limits'),
        where('blockedUntil', '>', Timestamp.now()),
      ));
      const list = await Promise.all(snap.docs.map(async (d) => ({
        id: d.id, ...d.data(), customer: await loadCustomer(d.id),
      })));
      list.sort((a, b) => (b.blockedUntil?.toMillis?.() || 0) - (a.blockedUntil?.toMillis?.() || 0));
      setRows(list);
    } catch (e) {
      setError(e?.message || 'تعذر التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lift = async (row) => {
    const name = row.customer?.name || row.customer?.phone || row.id;
    if (!window.confirm(`رفع الإيقاف عن ${name}؟ سيبدأ عدّ الإلغاءات من الصفر.`)) return;
    setLiftingId(row.id);
    try {
      await updateDoc(doc(db, 'customer_request_limits', row.id), {
        blockedUntil: null,
        acceptedCancels: [],
        arrivedCancels: [],
        liftedAt: serverTimestamp(),
        liftedBy: auth.currentUser?.email || auth.currentUser?.uid || null,
      });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      window.alert(e?.message || 'تعذر رفع الإيقاف');
    } finally {
      setLiftingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <TimerOff className="w-5 h-5 text-amber-600" />
            عملاء موقوفون مؤقتاً لتكرار الإلغاء
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            بعد القبول: 3 إلغاءات خلال يوم = ساعة · بعد وصول المزود: إلغاءان خلال يوم = 24 ساعة، وتكرارها = أسبوع. العميل لا يرى المدة.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="px-4 py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500">لا يوجد عملاء موقوفون حالياً</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-right">العميل</th>
                <th className="px-4 py-2 text-right">السبب</th>
                <th className="px-4 py-2 text-right">آخر طلب</th>
                <th className="px-4 py-2 text-right">ينتهي</th>
                <th className="px-4 py-2 text-right">مرات الإيقاف</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-800">{row.customer?.name || '—'}</div>
                    <div className="text-xs text-gray-500" dir="ltr">
                      {[row.customer?.customerNumber, row.customer?.phone || row.customer?.phoneNumber].filter(Boolean).join(' · ') || row.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{REASON_LABEL[row.blockReason] || row.blockReason || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.lastBlock?.requestId || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{fmt(row.blockedUntil)}</td>
                  <td className="px-4 py-3 text-gray-700">{row.blockCount || 1}</td>
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => lift(row)}
                      disabled={liftingId === row.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {liftingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      رفع الإيقاف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
