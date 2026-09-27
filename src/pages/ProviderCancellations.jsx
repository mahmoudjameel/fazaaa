import { useEffect, useMemo, useState } from 'react';
import { UserX, Loader2, ChevronDown, ChevronUp, Phone, MapPin, Clock, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { formatDistanceToNow, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '../services/firebase';
import { getProviderCancellationCounts } from '../services/adminService';

/** مزود يظهر هنا عند ٣ إلغاءات فأكثر (إلغاء/اعتذار من المزود بعد القبول) خلال الفترة */
const CANCEL_THRESHOLD = 3;

const PERIODS = [
  { value: 1, label: 'خلال ٢٤ ساعة' },
  { value: 7, label: 'خلال أسبوع' },
  { value: 30, label: 'خلال شهر' },
];

const providerCityLabel = (p) => p?.cityName || p?.city || 'غير محدد';

export const ProviderCancellations = () => {
  const [period, setPeriod] = useState(7);
  // الافتراضي: الأحدث — آخر مزود ألغى يظهر أولاً للمتابعة الفورية
  const [sortBy, setSortBy] = useState('latest');
  const [cityFilter, setCityFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const counts = await getProviderCancellationCounts(period);
        const flagged = Object.entries(counts || {}).filter(([, v]) => v.count >= CANCEL_THRESHOLD);
        const withProviders = await Promise.all(
          flagged.map(async ([id, v]) => {
            const snap = await getDoc(doc(db, 'providers', id)).catch(() => null);
            return { id, ...v, provider: snap?.exists() ? snap.data() : null };
          })
        );
        if (!cancelled) setRows(withProviders);
      } catch (e) {
        console.error('ProviderCancellations load:', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, reloadKey]);

  const cityOptions = useMemo(
    () => [...new Set(rows.map((r) => providerCityLabel(r.provider)))].sort(),
    [rows]
  );

  const visible = useMemo(() => {
    const list = cityFilter === 'all'
      ? rows
      : rows.filter((r) => providerCityLabel(r.provider) === cityFilter);
    return [...list].sort((a, b) =>
      sortBy === 'most'
        ? (b.count - a.count) || (b.lastCancelAt - a.lastCancelAt)
        : (b.lastCancelAt - a.lastCancelAt) || (b.count - a.count)
    );
  }, [rows, cityFilter, sortBy]);

  const selectCls =
    'w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">متابعة إلغاءات المزودين</h1>
            <p className="text-sm text-gray-500">مزودون ألغوا {CANCEL_THRESHOLD} طلبات أو أكثر بعد القبول</p>
          </div>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-teal-600"
          aria-label="تحديث"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className={selectCls}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls}>
            <option value="latest">الأحدث إلغاءً أولاً</option>
            <option value="most">الأعلى إلغاءات أولاً</option>
          </select>
          <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={selectCls}>
            <option value="all">كل المدن</option>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-500 font-semibold">
          لا يوجد مزود ألغى {CANCEL_THRESHOLD} طلبات أو أكثر في هذه الفترة 👍
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">يعرض <span className="font-black text-gray-900">{visible.length}</span> مزود</div>
          {visible.map((r) => {
            const p = r.provider || {};
            const open = expanded === r.id;
            const events = [...r.events].sort((a, b) => b.at - a.at);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-rose-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : r.id)}
                  className="w-full p-4 flex items-center gap-4 text-right"
                >
                  <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xl font-black leading-none">{r.count}</span>
                    <span className="text-[10px] font-bold mt-0.5">إلغاء</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 truncate">{[p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || 'مزود محذوف'}</div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      {p.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /><span dir="ltr">{p.phone}</span></span>}
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{providerCityLabel(p)}</span>
                      {r.lastCancelAt > 0 && (
                        <span className="flex items-center gap-1 text-rose-600 font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          آخر إلغاء {formatDistanceToNow(new Date(r.lastCancelAt), { addSuffix: true, locale: ar })}
                        </span>
                      )}
                    </div>
                  </div>
                  {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                    {events.map((e) => (
                      <div key={e.requestId} className="px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-800">
                            طلب {e.orderNumber ? `#${e.orderNumber}` : e.requestId.slice(-6)}
                          </div>
                          <div className="text-gray-600 mt-0.5 break-words">
                            السبب: {e.reason || <span className="text-gray-400">بدون سبب</span>}
                          </div>
                        </div>
                        {e.at > 0 && (
                          <div className="text-xs text-gray-500" dir="ltr">
                            {format(new Date(e.at), 'yyyy/MM/dd HH:mm')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
