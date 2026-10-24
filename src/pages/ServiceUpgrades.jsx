import { providerCityName } from '../utils/cityLabel';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Loader2, ChevronDown, ChevronUp, Phone, MapPin, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../services/firebase';
import { getRequestsCreatedBetween } from '../services/adminService';
import { aggregateProviderServiceChanges } from '../utils/serviceUpgrade';
import { formatOrderNumberLabel } from '../utils/orderNumber';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  { value: '1', label: 'خلال ٢٤ ساعة' },
  { value: '7', label: 'خلال أسبوع' },
  { value: '30', label: 'خلال شهر' },
  { value: '90', label: 'خلال ٣ أشهر' },
  { value: 'custom', label: 'فترة مخصصة…' },
];

const SORT_METRICS = {
  upgrades: { label: 'عدد الترقيات', get: (r) => r.upgrades },
  value: { label: 'المبلغ المضاف', get: (r) => r.valueAdded },
  accepted: { label: 'قبول العملاء', get: (r) => r.accepted },
  rate: { label: 'نسبة القبول', get: (r) => acceptanceRateValue(r) },
  proposals: { label: 'عدد الاقتراحات', get: (r) => r.proposals },
};

const LIMITS = [
  { value: 'top10', label: 'الأعلى ١٠' },
  { value: 'bottom10', label: 'الأقل ١٠' },
  { value: 'all', label: 'كل المزودين' },
];

const toDateInput = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const OUTCOME_LABELS = {
  accepted: { text: 'وافق العميل', cls: 'bg-violet-100 text-violet-800' },
  admin: { text: 'طبّقتها الإدارة', cls: 'bg-indigo-100 text-indigo-800' },
  pending: { text: 'بانتظار العميل', cls: 'bg-sky-100 text-sky-800' },
  unanswered: { text: 'بلا رد', cls: 'bg-gray-100 text-gray-600' },
  rejected: { text: 'رفض العميل', cls: 'bg-rose-100 text-rose-700' },
  other: { text: 'بدون تغيير', cls: 'bg-gray-100 text-gray-600' },
};

const priceText = (v) => (v != null ? `${v} ر.س` : '—');

/** نسبة قبول العملاء من الاقتراحات المحسومة (قبول + رفض + بلا رد) */
const acceptanceRate = (r) => {
  const decided = r.accepted + r.rejected + r.unanswered;
  return decided > 0 ? Math.round((r.accepted / decided) * 100) : null;
};
const acceptanceRateValue = (r) => acceptanceRate(r) ?? 0;

export const ServiceUpgrades = () => {
  const [period, setPeriod] = useState('7');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(Date.now() - 7 * DAY_MS));
  const [customTo, setCustomTo] = useState(() => toDateInput(Date.now()));
  const [sortBy, setSortBy] = useState('upgrades');
  const [limitMode, setLimitMode] = useState('top10');
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
        let fromMs;
        let toMs = Date.now();
        if (period === 'custom') {
          fromMs = new Date(`${customFrom}T00:00:00`).getTime();
          toMs = new Date(`${customTo}T23:59:59`).getTime();
        } else {
          fromMs = Date.now() - Number(period) * DAY_MS;
        }
        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
          if (!cancelled) setRows([]);
          return;
        }
        const orders = await getRequestsCreatedBetween(fromMs, toMs);
        const agg = aggregateProviderServiceChanges(orders);
        const withProviders = await Promise.all(
          Object.entries(agg).map(async ([id, v]) => {
            const snap = await getDoc(doc(db, 'providers', id)).catch(() => null);
            return { id, ...v, provider: snap?.exists() ? snap.data() : null };
          })
        );
        if (!cancelled) setRows(withProviders);
      } catch (e) {
        console.error('ServiceUpgrades load:', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, customFrom, customTo, reloadKey]);

  const cityOptions = useMemo(
    () => [...new Set(rows.map((r) => providerCityName(r.provider)))].sort(),
    [rows]
  );

  const visible = useMemo(() => {
    const list = cityFilter === 'all'
      ? rows
      : rows.filter((r) => providerCityName(r.provider) === cityFilter);
    const metric = (SORT_METRICS[sortBy] || SORT_METRICS.upgrades).get;
    // تعادل: المبلغ المضاف ثم الاقتراحات — ترتيب ثابت للأعلى والأقل
    const desc = (a, b) => (metric(b) - metric(a)) || (b.valueAdded - a.valueAdded) || (b.proposals - a.proposals);
    const sorted = [...list].sort(limitMode === 'bottom10' ? (a, b) => -desc(a, b) : desc);
    return limitMode === 'all' ? sorted : sorted.slice(0, 10);
  }, [rows, cityFilter, sortBy, limitMode]);

  const totals = useMemo(() => visible.reduce((t, r) => ({
    proposals: t.proposals + r.proposals,
    accepted: t.accepted + r.accepted,
    upgrades: t.upgrades + r.upgrades,
    valueAdded: t.valueAdded + r.valueAdded,
  }), { proposals: 0, accepted: 0, upgrades: 0, valueAdded: 0 }), [visible]);

  const selectCls =
    'w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">ترقيات الخدمة من المزودين</h1>
            <p className="text-sm text-gray-500">من اقترح تعديل الخدمة على العميل، وكم قُبل، والمبلغ المضاف</p>
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

      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="relative">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={limitMode} onChange={(e) => setLimitMode(e.target.value)} className={selectCls}>
            {LIMITS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls}>
            {Object.entries(SORT_METRICS).map(([k, m]) => <option key={k} value={k}>حسب {m.label}</option>)}
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
        {period === 'custom' && (
          <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              من
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700" />
            </label>
            <label className="text-xs text-gray-500">
              إلى
              <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700" />
            </label>
          </div>
        )}
      </div>

      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'اقتراحات', value: totals.proposals },
            { label: 'قبلها العملاء', value: totals.accepted },
            { label: 'ترقيات بسعر أعلى', value: totals.upgrades },
            { label: 'المبلغ المضاف', value: `${totals.valueAdded} ر.س` },
          ].map((t) => (
            <div key={t.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">{t.label}</div>
              <div className="text-xl font-black text-gray-900 mt-1">{t.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-500 font-semibold">
          لا توجد اقتراحات تعديل خدمة من المزودين في هذه الفترة
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">
            {limitMode === 'top10' ? 'الأعلى' : limitMode === 'bottom10' ? 'الأقل' : 'كل'}{' '}
            <span className="font-black text-gray-900">{visible.length}</span> مزود حسب {(SORT_METRICS[sortBy] || SORT_METRICS.upgrades).label}
            {cityFilter !== 'all' ? ` · ${cityFilter}` : ''}
          </div>
          {visible.map((r) => {
            const p = r.provider || {};
            const open = expanded === r.id;
            const rate = acceptanceRate(r);
            const orders = [...r.orders].sort((a, b) => b.at - a.at);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-violet-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : r.id)}
                  className="w-full p-4 flex items-center gap-4 text-right"
                >
                  <div className="w-16 h-14 rounded-2xl bg-violet-600 text-white flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-lg font-black leading-none">+{r.valueAdded}</span>
                    <span className="text-[10px] font-bold mt-0.5">ر.س</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 truncate">
                      {[p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || p.fullName || `مزود …${r.id.slice(-6)}`}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      {p.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /><span dir="ltr">{p.phone}</span></span>}
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{providerCityName(p)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 mt-2 font-semibold">
                      <span>اقتراحات: {r.proposals}</span>
                      <span className="text-violet-700">قبول: {r.accepted}</span>
                      <span>ترقيات: {r.upgrades}</span>
                      {r.rejected > 0 && <span className="text-rose-600">رفض: {r.rejected}</span>}
                      {r.unanswered > 0 && <span className="text-gray-500">بلا رد: {r.unanswered}</span>}
                      {r.pending > 0 && <span className="text-sky-700">بانتظار: {r.pending}</span>}
                      {r.adminApplied > 0 && <span className="text-indigo-700">طبّقتها الإدارة: {r.adminApplied}</span>}
                      {rate != null && <span>نسبة القبول: {rate}%</span>}
                    </div>
                  </div>
                  {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                    {orders.map((o) => {
                      const oc = OUTCOME_LABELS[o.outcome] || OUTCOME_LABELS.other;
                      const showProposed = (o.outcome === 'pending' || o.outcome === 'unanswered' || o.outcome === 'rejected') && o.proposed;
                      return (
                        <div key={o.id} className="px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              طلب {formatOrderNumberLabel(o.orderNumber) || o.id.slice(-6)}
                              <span className={`px-2 py-0.5 rounded-full text-[11px] ${oc.cls}`}>{oc.text}</span>
                            </div>
                            <div className="text-gray-600 mt-0.5 break-words">
                              {o.original.name} ({priceText(o.original.price)})
                              {' ← '}
                              {showProposed
                                ? <>{o.proposed.name} ({priceText(o.proposed.price)}) <span className="text-gray-400">مقترح</span></>
                                : <>{o.final.name} ({priceText(o.final.price)})</>}
                              {o.outcome === 'accepted' && o.priceDiff ? (
                                <span className={`mr-2 font-bold ${o.priceDiff > 0 ? 'text-violet-700' : 'text-amber-700'}`}>
                                  ({o.priceDiff > 0 ? '+' : ''}{o.priceDiff} ر.س)
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {o.at > 0 && (
                            <div className="text-xs text-gray-500" dir="ltr">
                              {format(new Date(o.at), 'yyyy/MM/dd HH:mm')}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
