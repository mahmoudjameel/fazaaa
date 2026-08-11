import { useEffect, useState, useMemo } from 'react';
import {
  Clock, MapPin, Calendar, Timer, ShoppingBag,
  CheckCircle, AlertTriangle, Zap, RefreshCw, ChevronDown, User
} from 'lucide-react';
import { format, subDays, isAfter, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getAllCities } from '../services/adminService';
import SAUDI_CITIES_FALLBACK from '../services/cities.json';
import { formatOrderNumberLabel } from '../utils/orderNumber';
import {
  buildDistanceInfoFromRequest,
  buildDistanceInfoFromAcceptedFields,
} from '../utils/providerEtaDisplay';

// ── مساعدات ──────────────────────────────────────────────────────────────────
const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toDate = (val) =>
  val?.toDate ? val.toDate() : val?.seconds ? new Date(val.seconds * 1000) : val ? new Date(val) : null;

// ── إعدادات ألوان SLA ─────────────────────────────────────────────────────────
const getSLAConfig = (min) => {
  if (min == null)  return { label: 'غير محدد',    bg: 'bg-gray-100',   text: 'text-gray-500',  border: 'border-gray-200',  bar: 'bg-gray-400',   ring: 'ring-gray-200' };
  if (min <= 15)    return { label: 'ضمن الهدف',   bg: 'bg-green-50',   text: 'text-green-700', border: 'border-green-200', bar: 'bg-green-500',  ring: 'ring-green-200' };
  if (min <= 25)    return { label: 'بطيء نسبياً', bg: 'bg-amber-50',   text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500',  ring: 'ring-amber-200' };
  return              { label: 'تجاوز الهدف',  bg: 'bg-red-50',     text: 'text-red-700',   border: 'border-red-200',   bar: 'bg-red-500',    ring: 'ring-red-200' };
};

// ── بطاقة KPI ──────────────────────────────────────────────────────────────────
const KPICard = ({ icon: Icon, label, value, sub, iconBg, iconColor, valueColor = 'text-gray-800' }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon size={22} className={iconColor} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-gray-400 mb-0.5">{label}</p>
      <p className={`text-2xl font-black leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1 font-medium">{sub}</p>}
    </div>
  </div>
);

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export const SLATracking = () => {
  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [timeFilter, setTimeFilter]   = useState('all');
  const [cityFilter, setCityFilter]   = useState('all');
  const [slaFilter, setSlaFilter]     = useState('over_15');
  const [providersDict, setProviders] = useState({});
  const [cities, setCities]           = useState(SAUDI_CITIES_FALLBACK);

  // ── جلب البيانات ─────────────────────────────────────────────────────────────
  useEffect(() => {
    getAllCities().then(r => { if (r.success && r.cities.length) setCities(r.cities); });

    getDocs(query(collection(db, 'providers'))).then(snap => {
      const d = {};
      snap.forEach(doc => { d[doc.id] = doc.data(); });
      setProviders(d);
    }).catch(console.error);

    const unsub = onSnapshot(
      query(collection(db, 'requests'), orderBy('createdAt', 'desc')),
      snap => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // ── حساب مدة الاستجابة لكل طلب — نفس buildDistanceInfoFromRequest في تطبيق المزود ──
  const withDuration = useMemo(() =>
    requests.map(req => {
      const fromPreview = buildDistanceInfoFromRequest(req);
      const fromAccepted = fromPreview || buildDistanceInfoFromAcceptedFields(req);
      let durationMin = fromAccepted?.duration ?? null;
      let distanceKm = fromAccepted?.distanceKm ?? null;
      let isEstimated = !(fromAccepted?.source === 'google' || fromAccepted?.source === 'google_traffic');

      return { ...req, _durationMin: durationMin, _distanceKm: distanceKm, _isEstimated: isEstimated };
    }),
  [requests]);

  // ── فلترة ────────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = new Date();
    const timeThreshold =
      timeFilter === 'today' ? startOfDay(now) :
      timeFilter === 'week'  ? subDays(now, 7)  :
      timeFilter === 'month' ? subDays(now, 30) : null;

    return withDuration.filter(req => {
      // وقت
      if (timeThreshold) {
        const d = toDate(req.createdAt);
        if (!d || !isAfter(d, timeThreshold)) return false;
      }

      // مدينة
      if (cityFilter !== 'all') {
        const city = cities.find(c => c.id === cityFilter);
        const name = city?.name?.toLowerCase() ?? '';
        const match =
          String(req.cityId ?? '') === cityFilter ||
          String(req.city ?? '').toLowerCase().includes(name) ||
          String(req.location ?? '').toLowerCase().includes(name);
        if (!match) return false;
      }

      // SLA
      const d = req._durationMin;
      if (slaFilter === 'under_15')  return d != null && d <= 15;
      if (slaFilter === 'over_15')   return d != null && d >  15;
      if (slaFilter === 'over_25')   return d != null && d >  25;
      return d != null; // 'all' — فقط الطلبات التي عندها بيانات
    });
  }, [withDuration, timeFilter, cityFilter, slaFilter, cities]);

  // ── إحصاءات KPI ──────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const all = withDuration.filter(r => r._durationMin != null);
    const total    = all.length;
    const sumDur   = all.reduce((s, r) => s + r._durationMin, 0);
    const avg      = total ? Math.round(sumDur / total) : 0;
    const good     = all.filter(r => r._durationMin <= 15).length;
    const violated = all.filter(r => r._durationMin >  15).length;
    const fastest  = total ? Math.min(...all.map(r => r._durationMin)) : null;
    const rate     = total ? Math.round((good / total) * 100) : 0;
    return { total, avg, good, violated, fastest, rate };
  }, [withDuration]);

  // ── مساعد مدينة ──────────────────────────────────────────────────────────────
  const cityLabel = (order) => {
    const entry = cities.find(c => String(c.id).toLowerCase() === String(order.cityId ?? '').toLowerCase());
    if (entry) return entry.name;
    if (order.city) return order.city;
    if (order.location) return order.location.length > 35 ? order.location.slice(0, 35) + '…' : order.location;
    return 'غير محدد';
  };

  const openMap = (order) => {
    if (order.coordinates?.latitude)
      window.open(`https://www.google.com/maps?q=${order.coordinates.latitude},${order.coordinates.longitude}`, '_blank');
    else if (order.location)
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(order.location)}`, '_blank');
  };

  // ── واجهة ─────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <RefreshCw className="animate-spin text-gray-400" size={36} />
      <p className="text-gray-400 font-bold text-sm">جاري تحميل بيانات الاستجابة…</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6" dir="rtl">

      {/* ── رأس الصفحة ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-teal-100 rounded-2xl flex items-center justify-center">
            <Timer size={22} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">متابعة الـ SLA</h1>
            <p className="text-gray-400 text-sm font-medium">مدة وصول المزود للعميل — الهدف ≤ 15 دقيقة</p>
          </div>
        </div>
        <div className="text-xs font-bold text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          يعرض الطلبات التي تم قبولها فقط (بها بيانات مدة استجابة)
        </div>
      </div>

      {/* ── بطاقات KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={ShoppingBag}
          label="إجمالي الطلبات المقيَّمة"
          value={kpi.total}
          sub="طلب بيانات استجابة"
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
        <KPICard
          icon={Clock}
          label="متوسط وقت الاستجابة"
          value={kpi.avg ? `${kpi.avg} د` : '—'}
          sub="دقيقة من القبول للوصول"
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          valueColor="text-teal-700"
        />
        <KPICard
          icon={CheckCircle}
          label="معدل الالتزام بـ SLA"
          value={`${kpi.rate}%`}
          sub={`${kpi.good} طلب ضمن 15 دقيقة`}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          valueColor={kpi.rate >= 80 ? 'text-green-700' : kpi.rate >= 60 ? 'text-amber-700' : 'text-red-700'}
        />
        <KPICard
          icon={AlertTriangle}
          label="تجاوز الـ SLA"
          value={kpi.violated}
          sub={kpi.fastest != null ? `أسرع استجابة: ${kpi.fastest} د` : 'طلب تجاوز 15 دقيقة'}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          valueColor="text-red-600"
        />
      </div>

      {/* ── شريط الفلاتر ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-5 bg-teal-500 rounded-full" />
          <span className="text-sm font-black text-gray-700">خيارات الفلترة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* النطاق الزمني */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <Calendar size={13} /> النطاق الزمني
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'all',   label: 'الكل' },
                { id: 'today', label: 'اليوم' },
                { id: 'week',  label: 'أسبوع' },
                { id: 'month', label: 'شهر' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTimeFilter(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    timeFilter === t.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* المدينة */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <MapPin size={13} /> المدينة
            </label>
            <div className="relative">
              <select
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                className="w-full appearance-none pr-4 pl-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="all">كل المدن</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* حالة SLA */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <Zap size={13} /> حالة الاستجابة
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'all',      label: 'الكل',         cls: 'bg-gray-100 text-gray-500',   active: 'bg-gray-900 text-white' },
                { id: 'under_15', label: '≤ 15 د ✓',     cls: 'bg-green-50 text-green-600',  active: 'bg-green-600 text-white' },
                { id: 'over_15',  label: '> 15 د ⚠',     cls: 'bg-red-50 text-red-600',      active: 'bg-red-600 text-white' },
                { id: 'over_25',  label: '> 25 د 🚨',    cls: 'bg-red-50 text-red-700',      active: 'bg-red-700 text-white' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSlaFilter(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    slaFilter === s.id ? s.active : s.cls + ' hover:opacity-80'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── النتائج ── */}
      <div>
        {/* عنوان النتائج */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm font-black text-gray-600">
            النتائج
            <span className="mr-2 text-teal-600 font-black">{filtered.length}</span>
            <span className="text-gray-400 font-normal">طلب</span>
          </span>
          {slaFilter === 'over_15' && filtered.length > 0 && (
            <span className="text-xs font-bold text-red-500 flex items-center gap-1">
              <AlertTriangle size={13} />
              {filtered.length} طلب تجاوز الـ SLA
            </span>
          )}
        </div>

        {/* قائمة الطلبات */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-14 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-1">لا توجد نتائج</h3>
            <p className="text-gray-400 text-sm">جرّب تغيير الفلاتر لعرض طلبات أخرى</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const d   = order._durationMin;
              const km  = order._distanceKm;
              const est = order._isEstimated;
              const sla = getSLAConfig(d);
              const barW = d != null ? Math.min(100, Math.round((d / 40) * 100)) : 0;
              const dt  = toDate(order.createdAt);

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md ${sla.border}`}
                >
                  {/* شريط علوي ملوّن */}
                  <div className={`h-1 w-full ${sla.bar}`} style={{ width: `${barW}%`, minWidth: '4px', maxWidth: '100%' }} />

                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                      {/* ── أيقونة الخدمة ── */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${sla.bg}`}>
                        <ShoppingBag size={20} className={sla.text} />
                      </div>

                      {/* ── معلومات الطلب ── */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* اسم الخدمة + رقم الطلب */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-gray-800 text-base leading-tight">
                            {order.serviceName || 'طلب خدمة'}
                          </h3>
                          <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                            {formatOrderNumberLabel(order.orderNumber)}
                          </span>
                          {est && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              تقديري
                            </span>
                          )}
                        </div>

                        {/* صف التفاصيل */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          {/* الموقع */}
                          <button
                            onClick={() => openMap(order)}
                            className="flex items-center gap-1.5 text-teal-600 hover:text-teal-800 font-semibold transition-colors"
                          >
                            <MapPin size={13} className="flex-shrink-0" />
                            <span className="underline underline-offset-2">{cityLabel(order)}</span>
                          </button>

                          {/* المزود */}
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="font-medium">{order.providerName || 'غير محدد'}</span>
                          </div>

                          {/* التاريخ */}
                          {dt && (
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                              <span>{format(dt, 'dd MMM yyyy — hh:mm a', { locale: ar })}</span>
                            </div>
                          )}
                        </div>

                        {/* شريط تقدم المدة */}
                        {d != null && (
                          <div className="flex items-center gap-3 pt-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${sla.bar}`}
                                style={{ width: `${barW}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">
                              40 د (أقصى)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── شارة وقت الاستجابة ── */}
                      <div className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-center min-w-[100px] ${sla.bg} ${sla.border}`}>
                        <p className="text-[10px] font-black text-gray-400 mb-0.5 uppercase tracking-wide">
                          الاستجابة
                        </p>
                        <p className={`text-2xl font-black leading-none ${sla.text}`}>
                          {d != null ? d : '—'}
                        </p>
                        {d != null && (
                          <p className={`text-[11px] font-bold mt-0.5 ${sla.text}`}>دقيقة</p>
                        )}
                        {km != null && (
                          <p className="text-[10px] text-gray-400 font-semibold mt-1">
                            {km.toFixed(1)} كم
                          </p>
                        )}
                        <div className={`mt-2 px-2 py-0.5 rounded-full text-[10px] font-black ${sla.bg} ${sla.text} border ${sla.border}`}>
                          {sla.label}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
