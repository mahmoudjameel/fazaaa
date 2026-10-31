import { useEffect, useMemo, useState } from 'react';
import { Gauge, Loader2, ChevronDown, ChevronUp, Phone, MapPin, RefreshCw, Star, Info } from 'lucide-react';
import { format } from 'date-fns';
import { getAllProviders, getRequestsCreatedBetween } from '../services/adminService';
import { providerCityName } from '../utils/cityLabel';
import { formatOrderNumberLabel } from '../utils/orderNumber';
import {
  buildProviderPerformance,
  MIN_DELAYS_TO_FLAG,
  MIN_ORDERS_TO_SCORE,
  RATING_FULL_DEDUCTION_STARS,
  SCORE_FACTORS,
  SCORE_LEVELS,
  SMOOTHING_ORDERS,
  toMs,
} from '../utils/providerPerformance';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  { value: 30, label: 'آخر شهر' },
  { value: 90, label: 'آخر ٣ أشهر' },
];

const TABS = [
  { id: 'score', label: 'مؤشر الجودة', defaultPeriod: 90 }, // ٣ أشهر: عينة أكبر وحكم أعدل
  { id: 'delays', label: 'الأعلى تأخيراً', defaultPeriod: 30 },
];

const LEVEL_STYLES = {
  poor: 'bg-red-600 text-white',
  watch: 'bg-amber-500 text-white',
  good: 'bg-green-600 text-white',
  insufficient: 'bg-gray-200 text-gray-600',
};

const LEVEL_LABELS = {
  ...Object.fromEntries(Object.entries(SCORE_LEVELS).map(([key, level]) => [key, level.label])),
  insufficient: 'بيانات قليلة',
};
const LEVEL_ORDER = ['poor', 'watch', 'good', 'insufficient'];

const selectCls =
  'w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer';

const providerName = (provider) =>
  [provider?.firstName, provider?.lastName].filter(Boolean).join(' ') || provider?.name || 'مزود';

const mapsUrl = (order) => {
  const { latitude, longitude } = order.coordinates || {};
  if (latitude != null && longitude != null) return `https://www.google.com/maps?q=${latitude},${longitude}`;
  return order.location ? `https://www.google.com/maps?q=${encodeURIComponent(order.location)}` : null;
};

const Select = ({ value, onChange, children }) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>{children}</select>
    <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
  </div>
);

const Stat = ({ label, value }) => (
  <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-center min-w-[84px]">
    <div className="text-[11px] text-gray-500 font-semibold">{label}</div>
    <div className="text-sm font-black text-gray-900 mt-0.5">{value}</div>
  </div>
);

const DelayedOrders = ({ delayed }) => {
  if (delayed.length === 0) {
    return <div className="px-4 py-4 text-sm text-gray-500">لا توجد طلبات متأخرة في هذه الفترة.</div>;
  }
  const sorted = [...delayed].sort((a, b) => toMs(b.order.createdAt) - toMs(a.order.createdAt));
  return (
    <div className="divide-y divide-gray-100">
      {sorted.map(({ order, expectedMinutes, actualMinutes, delayedFromMinutes }) => {
        const url = mapsUrl(order);
        const createdMs = toMs(order.createdAt);
        return (
          <div key={order.id} className="px-4 py-3 text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-gray-900">
                {formatOrderNumberLabel(order.orderNumber)} · {order.serviceName || order.serviceType || 'خدمة'}
              </span>
              {createdMs > 0 && <span className="text-xs text-gray-500" dir="ltr">{format(new Date(createdMs), 'yyyy/MM/dd HH:mm')}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-700">المتوقع {expectedMinutes} د</span>
              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-700">التأخير من {delayedFromMinutes} د</span>
              <span className="px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">الفعلي {actualMinutes} د</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
              <span>العميل: {order.customerName || '—'}</span>
              {order.customerPhone && (
                <a href={`tel:${order.customerPhone}`} className="flex items-center gap-1 text-teal-700 font-bold">
                  <Phone className="w-3.5 h-3.5" /><span dir="ltr">{order.customerPhone}</span>
                </a>
              )}
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-teal-700 font-bold min-w-0">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate max-w-[260px]">{order.location || 'الموقع على الخريطة'}</span>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ProviderRow = ({ row, tab, open, onToggle }) => {
  const { provider } = row;
  const showsDelays = tab === 'delays';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-4 text-right">
        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${showsDelays ? 'bg-red-600 text-white' : LEVEL_STYLES[row.level]}`}>
          <span className="text-xl font-black leading-none">{showsDelays ? row.delayed.length : row.level === 'insufficient' ? '—' : row.score}</span>
          <span className="text-[10px] font-bold mt-0.5">{showsDelays ? 'تأخير' : 'درجة'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-gray-900 truncate">{providerName(provider)}</span>
            {!showsDelays && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{LEVEL_LABELS[row.level]}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
            {provider?.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /><span dir="ltr">{provider.phone}</span></span>}
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{providerCityName(provider)}</span>
            {showsDelays
              ? <span className="font-bold text-red-700">من {row.measured} طلب مكتمل</span>
              : row.mainIssue && row.level !== 'good' && row.level !== 'insufficient' && (
                <span className="font-bold text-amber-700">أكبر خصم: {SCORE_FACTORS[row.mainIssue].label}</span>
              )}
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/60">
          {!showsDelays && (
            <div className="p-4 flex flex-wrap gap-2 border-b border-gray-100">
              <Stat label="مكتملة" value={row.completed} />
              <Stat label="إلغاء من المزود" value={row.providerCancelled} />
              <Stat label="إلغاء من العميل" value={row.clientCancelled} />
              <Stat label="متأخرة" value={`${row.delayed.length} من ${row.measured}`} />
              <Stat
                label="التقييم"
                value={row.averageRating == null
                  ? 'لا يوجد'
                  : <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />{row.averageRating.toFixed(1)} ({row.ratingCount})</span>}
              />
            </div>
          )}
          {!showsDelays && (
            <div className="p-4 border-b border-gray-100 space-y-1.5">
              <div className="text-xs font-black text-gray-800">كيف حُسبت الدرجة: 100 ناقص الخصومات</div>
              {row.factors.map((factor) => (
                <div key={factor.id} className="flex items-center justify-between gap-3 text-xs text-gray-600">
                  <span>{SCORE_FACTORS[factor.id].label} (بعد التعديل بمتوسط المنصة: {factor.adjustedValue})</span>
                  <span className="font-black text-red-700" dir="ltr">-{factor.points}</span>
                </div>
              ))}
            </div>
          )}
          <DelayedOrders delayed={row.delayed} />
        </div>
      )}
    </div>
  );
};

export const ProviderPerformance = () => {
  const [tab, setTab] = useState('score');
  const [periods, setPeriods] = useState(() => Object.fromEntries(TABS.map((t) => [t.id, t.defaultPeriod])));
  const [levelFilter, setLevelFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const period = periods[tab];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const [orders, { providers }] = await Promise.all([
          getRequestsCreatedBetween(Date.now() - period * DAY_MS),
          getAllProviders(),
        ]);
        const providersById = new Map(providers.map((p) => [p.id, p]));
        const performance = buildProviderPerformance(orders, new Set(providersById.keys()));
        if (cancelled) return;
        setResult({
          platform: performance.platform,
          rows: performance.providers
            .filter((row) => row.completed + row.providerCancelled + row.clientCancelled > 0)
            .map((row) => ({ ...row, provider: providersById.get(row.id) })),
        });
      } catch (e) {
        console.error('ProviderPerformance load:', e);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, reloadKey]);

  const rows = result?.rows ?? [];
  const cityOptions = useMemo(() => [...new Set(rows.map((r) => providerCityName(r.provider)))].sort(), [rows]);

  const visible = useMemo(() => {
    const inCity = cityFilter === 'all' ? rows : rows.filter((r) => providerCityName(r.provider) === cityFilter);
    if (tab === 'delays') {
      return inCity
        .filter((r) => r.delayed.length >= MIN_DELAYS_TO_FLAG)
        .sort((a, b) => (b.delayed.length - a.delayed.length) || (b.delayed.length / b.measured - a.delayed.length / a.measured));
    }
    const inLevel = levelFilter === 'all' ? inCity : inCity.filter((r) => r.level === levelFilter);
    return [...inLevel].sort((a, b) =>
      (LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)) || (a.score - b.score));
  }, [rows, cityFilter, levelFilter, tab]);

  const levelCounts = useMemo(() => {
    const counts = {};
    rows.forEach((r) => { counts[r.level] = (counts[r.level] || 0) + 1; });
    return counts;
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">أداء المزودين</h1>
            <p className="text-sm text-gray-500">تقييم بالأرقام يراعي عدد طلبات كل مزود</p>
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

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setExpanded(null); }}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold border ${tab === t.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select value={period} onChange={(v) => setPeriods((prev) => ({ ...prev, [tab]: Number(v) }))}>
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        <Select value={cityFilter} onChange={setCityFilter}>
          <option value="all">كل المدن</option>
          {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {tab === 'score' && (
          <Select value={levelFilter} onChange={setLevelFilter}>
            <option value="all">كل المستويات</option>
            {LEVEL_ORDER.map((key) => <option key={key} value={key}>{LEVEL_LABELS[key]} ({levelCounts[key] || 0})</option>)}
          </Select>
        )}
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-sm text-teal-900 flex gap-2.5">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        {tab === 'delays' ? (
          <p>
            الطلب المكتمل يُعد متأخراً إذا بلغ الوقت الفعلي ضعف الوقت المتوقع
            (المتوقع ١٠ د: ١٩ د مقبول و٢٠ د متأخر). يظهر هنا من عنده {MIN_DELAYS_TO_FLAG} حالات فأكثر.
            {result && <> متوسط المنصة: {Math.round(result.platform.delayRate * 100)}% من الطلبات متأخرة.</>}
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="font-black">تجريبي: المعادلة بانتظار اعتماد الإدارة، والدرجة للمتابعة فقط.</p>
            <p>الدرجة = 100 ناقص خصم كل عامل. الخصم = وزن العامل × (نسبة المزود ÷ الحد الأقصى)، ولا يتجاوز الوزن:</p>
            <ul className="list-disc pr-5">
              <li>{SCORE_FACTORS.providerCancel.label}: حتى {SCORE_FACTORS.providerCancel.weight} نقطة، الخصم الكامل عند {SCORE_FACTORS.providerCancel.worst * 100}%</li>
              <li>{SCORE_FACTORS.rating.label}: حتى {SCORE_FACTORS.rating.weight} نقطة، لا خصم عند ٥ نجوم والخصم الكامل عند {RATING_FULL_DEDUCTION_STARS}</li>
              <li>{SCORE_FACTORS.delay.label}: حتى {SCORE_FACTORS.delay.weight} نقطة، الخصم الكامل عند {SCORE_FACTORS.delay.worst * 100}%</li>
              <li>{SCORE_FACTORS.clientCancel.label}: حتى {SCORE_FACTORS.clientCancel.weight} نقطة، الخصم الكامل عند {SCORE_FACTORS.clientCancel.worst * 100}%</li>
            </ul>
            <p>
              حتى لا يُظلم صاحب الطلبات القليلة: تُحسب النسبة كأن لكل مزود {SMOOTHING_ORDERS} طلبات إضافية بمتوسط المنصة.
              مثال: ٢٠ مكتمل و٥ إلغاء عميل أفضل من ٢ مكتمل و٥ إلغاء عميل.
            </p>
            <p>
              {SCORE_LEVELS.good.label}: {SCORE_LEVELS.good.min} فأكثر · {SCORE_LEVELS.watch.label}: {SCORE_LEVELS.watch.min} فأكثر ·
              {' '}{SCORE_LEVELS.poor.label}: أقل من ذلك · أقل من {MIN_ORDERS_TO_SCORE} طلبات: لا يُحكم عليه.
              افتح أي مزود لترى تفاصيل خصوماته.
            </p>
          </div>
        )}
      </div>

      {failed ? (
        <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
          <p className="text-gray-700 font-semibold">تعذر تحميل البيانات.</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold">إعادة المحاولة</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-500 font-semibold">
          لا يوجد مزودون بهذه الشروط في الفترة المحددة.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">يعرض <span className="font-black text-gray-900">{visible.length}</span> مزود</div>
          {visible.map((row) => (
            <ProviderRow
              key={row.id}
              row={row}
              tab={tab}
              open={expanded === row.id}
              onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
