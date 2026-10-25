import { useEffect, useMemo, useState } from 'react';
import { WifiOff, ExternalLink, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { groupNoCoverageByArea } from '../utils/noCoverage';

const PERIOD_DAYS = 30;
const THRESHOLD_OPTIONS = [5, 10, 20];

/** مدن ومناطق فيها طلبات انتهت بلا أي مزود («لا توجد شبكة») خلال آخر 30 يوماً */
export function NoCoverageReport({ cities }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(10);
  const [onlyAboveThreshold, setOnlyAboveThreshold] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const since = Timestamp.fromMillis(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
    getDocs(query(collection(db, 'requests'), where('createdAt', '>=', since)))
      .then((snap) => { if (!cancelled) setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); })
      .catch((e) => {
        console.error('NoCoverageReport load:', e);
        if (!cancelled) setError(e?.message || 'تعذر تحميل الطلبات');
      });
    return () => { cancelled = true; };
  }, []);

  const areas = useMemo(
    () => (requests ? groupNoCoverageByArea(requests, cities) : []),
    [requests, cities]
  );
  const shown = onlyAboveThreshold ? areas.filter((a) => a.noCoverage >= threshold) : areas;
  const totalNoCoverage = areas.reduce((s, a) => s + a.noCoverage, 0);

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <WifiOff className="w-5 h-5 text-red-500" />
          <div>
            <h2 className="text-lg font-black text-gray-800">مناطق بدون تغطية (آخر {PERIOD_DAYS} يوم)</h2>
            <p className="text-xs text-gray-500">
              طلبات انتهت دون أن يصل الطلب لأي مزود — يرى العميل «لا يوجد شبكة»
              {requests ? ` · الإجمالي ${totalNoCoverage} طلب` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAboveThreshold}
              onChange={(e) => setOnlyAboveThreshold(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded"
            />
            فقط
          </label>
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={!onlyAboveThreshold}
            className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm focus:border-red-300 focus:outline-none disabled:opacity-50"
          >
            {THRESHOLD_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} طلبات وأكثر</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-600 py-3">{error}</div>
      ) : !requests ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
          <Loader2 className="w-4 h-4 animate-spin" /> جاري تحليل الطلبات…
        </div>
      ) : shown.length === 0 ? (
        <div className="text-sm text-gray-400 py-3">
          {onlyAboveThreshold ? `لا توجد مدينة أو منطقة فيها ${threshold} طلبات أو أكثر بلا تغطية` : 'لا توجد طلبات بلا تغطية'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-right font-semibold py-2 px-2">المدينة / المنطقة</th>
                <th className="text-right font-semibold py-2 px-2">بلا تغطية</th>
                <th className="text-right font-semibold py-2 px-2">كل الطلبات</th>
                <th className="text-right font-semibold py-2 px-2">النسبة</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.key} className="border-b border-gray-50">
                  <td className="py-2 px-2">
                    <span className={`font-bold ${a.isCity ? 'text-gray-800' : 'text-amber-700'}`}>{a.label}</span>
                    {!a.isCity && (
                      <span className="block text-[11px] text-gray-400">ليست ضمن المدن المسجّلة</span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-black text-red-600">{a.noCoverage}</td>
                  <td className="py-2 px-2 text-gray-600">{a.total}</td>
                  <td className="py-2 px-2 text-gray-600">{Math.round((a.noCoverage / a.total) * 100)}٪</td>
                  <td className="py-2 px-2">
                    <a
                      href={`https://www.google.com/maps?q=${a.lat.toFixed(5)},${a.lng.toFixed(5)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline"
                      title="مركز الطلبات بلا تغطية على الخريطة"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> الخريطة
                    </a>
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
