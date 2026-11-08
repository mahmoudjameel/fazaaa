import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  addDoc, collection, doc, getCountFromServer, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp,
  updateDoc, where,
} from 'firebase/firestore';
import {
  Activity, AlertTriangle, ArrowLeft, Ban, BarChart3, Car, CheckCircle2, ClipboardList, Clock, FlaskConical,
  Gauge, Loader2, Map as MapIcon, MapPin, RefreshCw, Repeat, Search, Settings2, ShieldCheck, Sparkles, Target,
  TrendingUp, Users, X, Zap,
} from 'lucide-react';
import { auth, db } from '../services/firebase';
import { getAllCities } from '../services/adminService';
import { normalizePricing, DEFAULT_PRICING } from '../utils/providerPricing';
import {
  CANCEL_TYPE_LABELS, DEFAULT_TARGETS, DEFAULT_TEST_PHONES, LOSS_TYPE_LABELS,
  analyzeLiveOrders, buildAgentFindings, buildAreaResolver, buildNeeds, buildUrgentIssues, compareKpi,
  computeKpis, dailyTrend, filterOrders, isTestOrder, providerDispatchReach, needsInRange, phoneKey,
  resolvePeriod, topLostAreas,
} from '../utils/decisionCenter';
import { requestCoords } from '../utils/noCoverage';
import { toMs } from '../utils/providerPerformance';

/**
 * مركز القرار — بهوية اللوحة: خلفية فاتحة، بطاقات بيضاء بخط لوني جانبي، والكهرماني للإجراءات.
 * خفيف: الطلبات تُجلب كل دقيقة (لا مستمع لحظي يعيد الحساب كل 3ث)، وبلا مكتبة رسوم.
 */

const PERIODS = [
  { id: 'today', label: 'اليوم' },
  { id: '7d', label: '7 أيام' },
  { id: '30d', label: '30 يوم' },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const ORDERS_REFRESH_MS = 60 * 1000;
const LIVE_REFRESH_MS = 5 * 60 * 1000; // المزودون والتصعيدات والاعتمادات
const DRILL_PAGE = 60;

const STATUS_LABELS = {
  searching: 'جاري البحث', assigned: 'تم القبول', en_route: 'في الطريق', arrived: 'وصل', in_progress: 'قيد التنفيذ',
  pending_legal_docs: 'وثائق قانونية', pending_client_confirmation: 'بانتظار تأكيد العميل', pending_review: 'بانتظار التقييم',
  completed: 'مكتمل', timed_out: 'انتهى البحث', canceled_by_client: 'ألغاه العميل', canceled_by_client_with_reason: 'ألغاه العميل',
  canceled_by_provider: 'ألغاه المزود', canceled_by_provider_with_reason: 'ألغاه المزود', canceled_by_admin: 'ألغته الإدارة',
  escalated_to_city_manager: 'مُصعّد',
};
const SEVERITY_STYLE = {
  high: { label: 'عالية', cls: 'bg-red-50 text-red-600 border-red-100' },
  medium: { label: 'متوسطة', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  low: { label: 'منخفضة', cls: 'bg-sky-50 text-sky-700 border-sky-100' },
};
const AGENTS = [
  { id: 'coverage', icon: MapPin, tone: 'bg-violet-50 text-violet-600', title: 'وكيل التغطية', sub: 'تحليل التغطية وتوزيع المزودين' },
  { id: 'operations', icon: Zap, tone: 'bg-amber-50 text-amber-600', title: 'وكيل التشغيل', sub: 'مراقبة الطلبات والتأخير' },
  { id: 'quality', icon: BarChart3, tone: 'bg-emerald-50 text-emerald-600', title: 'وكيل الجودة والنمو', sub: 'الأنماط وتحسين الأداء' },
];

const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
/** اليوم المحلي (YYYY-MM-DD) — toISOString بتوقيت UTC يخطئ بين 00:00 و03:00 بتوقيت الرياض */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** بيانات الصفحة: الطلبات كل دقيقة، والمزودون كل 5 دقائق، والثابت مرة واحدة */
function useDecisionData(fetchFromMs) {
  const [orders, setOrders] = useState(null);
  const [cities, setCities] = useState([]);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [config, setConfig] = useState({ targets: DEFAULT_TARGETS, testPhones: DEFAULT_TEST_PHONES });
  const [testCustomerIds, setTestCustomerIds] = useState(() => new Set());
  const [openEscalations, setOpenEscalations] = useState(0);
  const [approvals, setApprovals] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const snap = await getDocs(query(
        collection(db, 'requests'),
        where('createdAt', '>=', Timestamp.fromMillis(fetchFromMs)),
        orderBy('createdAt', 'desc'),
      ));
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUpdatedAt(Date.now());
    } catch (e) {
      console.error('DecisionCenter orders:', e);
      setOrders((prev) => prev || []);
    }
  }, [fetchFromMs]);

  const loadLive = useCallback(async () => {
    const [providerSnap, escCount, approvalSnap] = await Promise.all([
      getDocs(query(collection(db, 'providers'), where('approvalStatus', '==', 'approved'))).catch(() => null),
      getCountFromServer(query(collection(db, 'admin_escalations'), where('status', '==', 'new'))).catch(() => null),
      getDocs(query(collection(db, 'decision_log'), where('dayKey', '==', todayKey()))).catch(() => null),
    ]);
    setProviders(providerSnap ? providerSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
    setOpenEscalations(escCount ? escCount.data().count : 0);
    setApprovals(approvalSnap ? approvalSnap.docs.map((d) => d.data()) : []);
  }, []);

  const loadStatic = useCallback(async () => {
    const [cityList, serviceSnap, distSnap, dcSnap] = await Promise.all([
      getAllCities().catch(() => []),
      getDocs(collection(db, 'emergency-services')).catch(() => null),
      getDoc(doc(db, 'settings', 'distribution')).catch(() => null),
      getDoc(doc(db, 'settings', 'decisionCenter')).catch(() => null),
    ]);
    setCities(Array.isArray(cityList) ? cityList : (cityList?.cities || []));
    setServices(serviceSnap ? serviceSnap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })) : []);
    if (distSnap?.exists() && distSnap.data().pricing) setPricing(normalizePricing(distSnap.data().pricing));
    const dc = dcSnap?.exists() ? dcSnap.data() : {};
    const testPhones = [...new Set([...DEFAULT_TEST_PHONES, ...(Array.isArray(dc.testPhones) ? dc.testPhones : [])])];
    setConfig({ targets: { ...DEFAULT_TARGETS, ...(dc.targets || {}) }, testPhones });

    // عملاء الاختبار بالجوال في phone/verifiedPhone/phoneNumber بكل الصيغ — دفعات من 30 (حد «in»)
    const variants = [...new Set(testPhones.flatMap((p) => {
      const k = phoneKey(p);
      return [`966${k}`, `0${k}`, k, `+966${k}`];
    }))];
    const chunks = [];
    for (let i = 0; i < variants.length; i += 30) chunks.push(variants.slice(i, i + 30));
    const idSets = await Promise.all(['phone', 'verifiedPhone', 'phoneNumber'].flatMap((field) => chunks.map((chunk) => (
      getDocs(query(collection(db, 'customers'), where(field, 'in', chunk)))
        .then((snap) => snap.docs.map((d) => d.id)).catch(() => [])
    ))));
    setTestCustomerIds(new Set(idSets.flat()));
  }, []);

  useEffect(() => {
    loadOrders();
    const id = setInterval(() => { if (!document.hidden) loadOrders(); }, ORDERS_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadOrders]);

  useEffect(() => {
    loadStatic();
    loadLive();
    const id = setInterval(() => { if (!document.hidden) loadLive(); }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadStatic, loadLive]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadOrders(), loadLive(), loadStatic()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders, loadLive, loadStatic]);

  return {
    orders, cities, services, providers, pricing, config, testCustomerIds, openEscalations, approvals, updatedAt,
    refreshing, reload, reloadLive: loadLive, setConfig,
  };
}

const Card = ({ className = '', children }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, subtitle, tone = 'bg-amber-50 text-amber-600', action }) => (
  <div className="flex items-start justify-between gap-2 mb-4">
    <div className="flex items-center gap-2.5">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
      <div>
        <h2 className="text-base font-black text-gray-900">{title}</h2>
        {subtitle ? <p className="text-xs text-gray-400">{subtitle}</p> : null}
      </div>
    </div>
    {action}
  </div>
);

const Delta = ({ value, suffix }) => {
  if (value == null) return <span className="text-gray-400">لا مقارنة</span>;
  const cls = value > 0 ? 'text-emerald-600 bg-emerald-50' : value < 0 ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100';
  return <span className={`inline-block rounded-md px-1.5 py-0.5 font-bold ${cls}`}>{value > 0 ? '+' : ''}{value}{suffix}</span>;
};

const KPI_TONES = {
  amber: { stripe: 'border-r-amber-500', icon: 'bg-amber-50 text-amber-600' },
  teal: { stripe: 'border-r-teal-500', icon: 'bg-teal-50 text-teal-600' },
  green: { stripe: 'border-r-emerald-500', icon: 'bg-emerald-50 text-emerald-600' },
  red: { stripe: 'border-r-red-500', icon: 'bg-red-50 text-red-500' },
};

const KpiCard = ({ icon: Icon, title, value, footer, tone, onClick }) => (
  <button type="button" onClick={onClick}
    className={`text-right bg-white rounded-2xl border border-gray-100 border-r-4 ${KPI_TONES[tone].stripe} shadow-sm p-4 hover:shadow-md transition-shadow w-full`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-bold text-gray-500">{title}</span>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${KPI_TONES[tone].icon}`}><Icon className="w-5 h-5" /></span>
    </div>
    <div className="text-2xl sm:text-3xl font-black text-gray-900 mt-1 tabular-nums">{value}</div>
    <div className="text-[11px] sm:text-xs text-gray-500 mt-2 leading-relaxed">{footer}</div>
  </button>
);

/** اتجاه يومي بأعمدة خفيفة (بلا مكتبة رسوم) */
const TrendBars = memo(({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.needs));
  const showEvery = days.length > 14 ? Math.ceil(days.length / 7) : 1;
  return (
    <div>
      <div className="flex items-end gap-[3px] h-36" dir="ltr">
        {days.map((d) => (
          <div key={d.dayMs} className="flex-1 h-full flex flex-col justify-end"
            title={`${new Date(d.dayMs).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' })}: ${d.needs} احتياج · ${d.served} مكتمل · ${d.lost} فقد`}>
            <div className="w-full rounded-t bg-amber-100 relative" style={{ height: `${(d.needs / max) * 100}%` }}>
              <div className="absolute bottom-0 inset-x-0 rounded-t bg-teal-500" style={{ height: d.needs ? `${(d.served / d.needs) * 100}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1" dir="ltr">
        {days.map((d, i) => (
          <div key={d.dayMs} className="flex-1 text-center text-[9px] text-gray-400 overflow-hidden whitespace-nowrap">
            {i % showEvery === 0 ? new Date(d.dayMs).getDate() : ''}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200" /> احتياجات</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> مكتمل</span>
      </div>
    </div>
  );
});

/** نقاط الطلبات الضائعة على خلفية بسيطة — بلا مكتبة خرائط */
const LossMiniMap = memo(({ points, highlights }) => {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pad = 0.0001;
  const x = (lng) => 8 + ((lng - minLng) / (maxLng - minLng + pad)) * 184;
  const y = (lat) => 8 + ((maxLat - lat) / (maxLat - minLat + pad)) * 84;
  const colors = ['#ef4444', '#f97316', '#f59e0b'];
  return (
    <svg viewBox="0 0 200 100" className="w-full h-28 rounded-xl bg-gray-50" role="img" aria-label="مواقع الطلبات غير المخدومة">
      {points.slice(0, 400).map((p, i) => <circle key={i} cx={x(p.lng)} cy={y(p.lat)} r="1.6" fill="#fca5a5" />)}
      {highlights.filter((h) => h.lat != null).map((h, i) => (
        <circle key={h.key} cx={x(h.lng)} cy={y(h.lat)} r="4" fill={colors[i]} stroke="#fff" strokeWidth="1.5" />
      ))}
    </svg>
  );
});

/** لوحة جانبية: الطلبات خلف أي رقم (تُعرض على دفعات) */
const DrillPanel = ({ drill, onClose, areaOf, onMarkTest, navigate }) => {
  const [visible, setVisible] = useState(DRILL_PAGE);
  useEffect(() => setVisible(DRILL_PAGE), [drill]);
  const orders = useMemo(() => (drill ? [...drill.orders].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)) : []), [drill]);
  if (!drill) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-gray-50 flex flex-col shadow-xl">
        <div className="flex items-start justify-between gap-3 p-4 bg-white border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base font-black text-gray-900">{drill.title}</h3>
            {drill.subtitle ? <p className="text-xs text-gray-500 mt-1 leading-relaxed">{drill.subtitle}</p> : null}
            <p className="text-xs font-bold text-amber-600 mt-1">{orders.length} طلب</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orders.length === 0 ? <p className="text-center text-gray-400 text-sm py-10">لا توجد طلبات</p> : null}
          {orders.slice(0, visible).map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-gray-900 tabular-nums">#{order.orderNumber ?? order.id.slice(-6)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600">{STATUS_LABELS[order.status] || order.status}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{order.serviceName || '—'} · {fmtDate(toMs(order.createdAt))}</div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">{areaOf(order).label}</div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => navigate(`/admin/orders?q=${order.orderNumber ?? order.id}`)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-400 text-gray-900 hover:bg-amber-500">فتح الطلب</button>
                <button type="button" onClick={() => onMarkTest(order)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5" /> اختبار — استبعده
                </button>
              </div>
            </div>
          ))}
          {orders.length > visible ? (
            <button type="button" onClick={() => setVisible((v) => v + DRILL_PAGE)}
              className="w-full py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-bold text-teal-600 hover:bg-teal-50">
              عرض المزيد ({orders.length - visible})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** الأهداف وأرقام الاختبار — تحفظ في settings/decisionCenter */
const TargetsEditor = ({ config, onSaved, onClose }) => {
  const [draft, setDraft] = useState({
    arrivalTargetMinutes: config.targets.arrivalTargetMinutes,
    acceptanceTargetPercent: config.targets.acceptanceTargetPercent,
    completionTargetPercent: config.targets.completionTargetPercent,
    testPhones: config.testPhones.filter((p) => !DEFAULT_TEST_PHONES.includes(p)).join('، '),
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const targets = {
        arrivalTargetMinutes: Number(draft.arrivalTargetMinutes) || DEFAULT_TARGETS.arrivalTargetMinutes,
        acceptanceTargetPercent: Number(draft.acceptanceTargetPercent) || DEFAULT_TARGETS.acceptanceTargetPercent,
        completionTargetPercent: Number(draft.completionTargetPercent) || DEFAULT_TARGETS.completionTargetPercent,
      };
      const testPhones = String(draft.testPhones).split(/[,،\s]+/).map((p) => p.trim()).filter((p) => phoneKey(p).length === 9);
      await setDoc(doc(db, 'settings', 'decisionCenter'), { targets, testPhones, updatedAt: serverTimestamp() }, { merge: true });
      onSaved();
      onClose();
    } catch (e) {
      alert(`تعذر الحفظ: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };
  const field = (key, label, unit) => (
    <label className="block">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <input type="number" value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-amber-400" />
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 space-y-4 shadow-xl">
        <h3 className="text-lg font-black text-gray-900">الأهداف وبيانات الاختبار</h3>
        <div className="grid grid-cols-3 gap-3">
          {field('arrivalTargetMinutes', 'زمن الوصول', 'د')}
          {field('acceptanceTargetPercent', 'القبول', '%')}
          {field('completionTargetPercent', 'الإنجاز', '%')}
        </div>
        <label className="block">
          <span className="text-xs font-bold text-gray-600">جوالات عملاء الاختبار (تُستبعد طلباتهم)</span>
          <textarea value={draft.testPhones} onChange={(e) => setDraft((d) => ({ ...d, testPhones: e.target.value }))} rows={2}
            placeholder="05xxxxxxxx، 05xxxxxxxx" className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
          <span className="text-[11px] text-gray-400">تُستبعد دائماً: {DEFAULT_TEST_PHONES.join('، ')} وطلبات مختبر الطلبات وما علّمته «اختبار».</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-bold">إلغاء</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-amber-400 text-gray-900 text-sm font-black hover:bg-amber-500 disabled:opacity-50">
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
};

const selectCls = 'bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:border-amber-400';

export const DecisionCenter = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = PERIODS.some((p) => p.id === searchParams.get('period')) ? searchParams.get('period') : 'today';
  const city = searchParams.get('city') || '';
  const service = searchParams.get('service') || '';
  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  // الصفحة المفتوحة طوال الليل: «اليوم» ينتقل بعد منتصف الليل، والمقارنة تتقدم مع الوقت
  const [clockTick, setClockTick] = useState(() => Math.floor(Date.now() / (5 * 60 * 1000)));
  useEffect(() => {
    const id = setInterval(() => setClockTick(Math.floor(Date.now() / (5 * 60 * 1000))), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const range = useMemo(() => resolvePeriod(period), [period, clockTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // الاتجاه يعرض 7 أيام على الأقل، والدمج يحتاج يوماً قبل الفترة السابقة (محاولات تعبر حدّها)
  const trendFromMs = Math.min(range.fromMs, range.toMs - 7 * DAY_MS);
  const fetchFromMs = Math.min(range.prevFromMs, trendFromMs) - DAY_MS;
  const data = useDecisionData(fetchFromMs);
  const [drill, setDrill] = useState(null);
  const [agentOpen, setAgentOpen] = useState(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [approving, setApproving] = useState(false);
  const [locallyExcluded, setLocallyExcluded] = useState(() => new Set());

  // 1) التنظيف والاحتياجات — يتغير فقط بتغير الطلبات أو الفلاتر
  const base = useMemo(() => {
    if (!data.orders) return null;
    const testIds = new Set(data.orders
      .filter((o) => isTestOrder(o, data.testCustomerIds) || locallyExcluded.has(o.id))
      .map((o) => o.id));
    const clean = filterOrders(data.orders.filter((o) => !testIds.has(o.id)), { city, service }, data.cities);
    return {
      clean,
      needs: buildNeeds(clean),
      testExcludedCount: data.orders.filter((o) => testIds.has(o.id) && toMs(o.createdAt) >= range.fromMs).length,
      areaOf: buildAreaResolver(clean, data.cities),
    };
  }, [data.orders, data.testCustomerIds, data.cities, city, service, locallyExcluded, range.fromMs]);

  // 2) المؤشرات والاستنتاجات
  const model = useMemo(() => {
    if (!base) return null;
    const kpis = computeKpis(needsInRange(base.needs, range.fromMs, range.toMs));
    const prevKpis = computeKpis(needsInRange(base.needs, range.prevFromMs, range.prevToMs));
    const areas = topLostAreas(kpis.groups.lost, data.cities, 3, base.clean);
    const live = analyzeLiveOrders(base.clean, data.config.targets);
    const inCity = (p) => !city || filterOrders([{ id: `p:${p.id}`, coordinates: p.location }], { city }, data.cities).length > 0;
    const reach = data.providers.filter(inCity).map((p) => providerDispatchReach(p, data.pricing));
    const availableProviders = reach.filter((r) => r === 'fresh').length;
    const backupProviders = reach.filter((r) => r === 'backup').length;
    const issues = buildUrgentIssues({
      live, kpis, areas, targets: data.config.targets, availableProviders, backupProviders, openEscalations: data.openEscalations,
    });
    const agentsResult = buildAgentFindings({ kpis, prevKpis, live, areas, availableProviders, targets: data.config.targets });
    return {
      kpis, prevKpis, areas, live, availableProviders, backupProviders, issues, agentsResult,
      trend: dailyTrend(base.needs, trendFromMs, range.toMs),
      lostPoints: kpis.groups.lost.map((n) => requestCoords(n.representative)).filter(Boolean),
    };
  }, [base, range, trendFromMs, data.cities, data.providers, data.pricing, data.config, data.openEscalations, city]);

  const openDrill = useCallback((title, orders, subtitle) => setDrill({ title, orders: orders || [], subtitle }), []);
  const needOrders = (needs) => needs.map((n) => n.representative);

  const markTest = async (order) => {
    if (!window.confirm(`تعليم الطلب #${order.orderNumber ?? order.id} كاختبار؟ يُستبعد من كل مؤشرات مركز القرار.`)) return;
    try {
      await updateDoc(doc(db, 'requests', order.id), { isTest: true, isTestMarkedBy: auth.currentUser?.email || null });
      setLocallyExcluded((prev) => new Set([...prev, order.id]));
      setDrill((d) => (d ? { ...d, orders: d.orders.filter((o) => o.id !== order.id) } : d));
    } catch (e) {
      alert(`تعذر التعليم: ${e?.message || e}`);
    }
  };

  const recommendation = model?.agentsResult.recommendation;
  const approvedToday = recommendation && data.approvals.find((a) => a.title === recommendation.title);
  const approveRecommendation = async () => {
    if (!recommendation) return;
    if (approvedToday) {
      navigate(recommendation.action.path);
      return;
    }
    if (!window.confirm(`اعتماد التوصية: «${recommendation.title}»؟ سيُسجَّل الاعتماد باسمك ثم تُفتح صفحة التنفيذ.`)) return;
    setApproving(true);
    try {
      await addDoc(collection(db, 'decision_log'), {
        dayKey: todayKey(),
        title: recommendation.title,
        reason: recommendation.reason,
        effect: recommendation.effect,
        actionPath: recommendation.action.path,
        evidenceOrderIds: recommendation.evidence.slice(0, 50).map((o) => o.id),
        filters: { period, city, service },
        approvedBy: auth.currentUser?.email || null,
        approvedAt: serverTimestamp(),
        status: 'approved',
      });
      await data.reloadLive();
      navigate(recommendation.action.path);
    } catch (e) {
      alert(`تعذر الاعتماد: ${e?.message || e}`);
    } finally {
      setApproving(false);
    }
  };

  const k = model?.kpis;
  const pk = model?.prevKpis;
  const targets = data.config.targets;
  const periodLabel = PERIODS.find((p) => p.id === period)?.label;
  const systemHealthy = model && model.live.stuckSearching.length === 0 && (model.availableProviders + model.backupProviders) > 0;

  return (
    <div className="space-y-4 sm:space-y-5" dir="rtl">
      {/* الرأس + الفلاتر الموحّدة */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">مركز القرار</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">ماذا يحدث، وأين المشكلة، وما القرار — أرقام فعلية بعد استبعاد الاختبار ودمج التكرار</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => setFilter('period', p.id === 'today' ? '' : p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${period === p.id ? 'bg-amber-400 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <select value={city} onChange={(e) => setFilter('city', e.target.value)} aria-label="المدينة" className={selectCls}>
            <option value="">كل المدن</option>
            {data.cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={service} onChange={(e) => setFilter('service', e.target.value)} aria-label="الخدمة" className={selectCls}>
            <option value="">كل الخدمات</option>
            {data.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" onClick={data.reload} disabled={data.refreshing} title="تحديث الآن"
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${data.refreshing ? 'animate-spin' : ''}`} />
            {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </button>
          <button type="button" onClick={() => setEditingTargets(true)} title="الأهداف وبيانات الاختبار" aria-label="الأهداف وبيانات الاختبار"
            className="bg-white border border-gray-200 rounded-xl p-2 text-gray-500 hover:text-gray-900"><Settings2 className="w-4 h-4" /></button>
        </div>
      </div>

      {!model ? (
        <div className="flex items-center justify-center py-32 text-gray-400 gap-2"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /> جارٍ تحميل البيانات…</div>
      ) : (
        <>
          {/* المؤشرات الأربعة */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard tone="amber" icon={ClipboardList} title="احتياجات فعلية" value={fmtNum(k.needs)}
              footer={`${fmtNum(k.attempts)} طلب ← ${fmtNum(k.needs)} احتياج بعد دمج التكرار`}
              onClick={() => openDrill('الاحتياجات الفعلية', needOrders([...k.groups.served, ...k.groups.active, ...k.groups.lost, ...k.groups.cancelled]), `${periodLabel} — محاولة ممثلة لكل احتياج`)} />
            <KpiCard tone="teal" icon={CheckCircle2} title="مكتملة" value={fmtNum(k.served)}
              footer={<><Delta value={compareKpi(k.served, pk.served)} suffix="%" /> عن الفترة السابقة</>}
              onClick={() => openDrill('الاحتياجات المكتملة', needOrders(k.groups.served))} />
            <KpiCard tone="green" icon={Target} title="نسبة الإنجاز" value={k.completionRate == null ? '—' : `${k.completionRate}%`}
              footer={<><Delta value={compareKpi(k.completionRate, pk.completionRate, { isRate: true })} suffix=" نقطة" /> · الهدف {targets.completionTargetPercent}%</>}
              onClick={() => openDrill('المنتهية (أساس نسبة الإنجاز)', needOrders([...k.groups.served, ...k.groups.lost, ...k.groups.cancelled]), 'الجاري لا يدخل النسبة حتى ينتهي')} />
            <KpiCard tone="red" icon={Ban} title="فقد التغطية" value={fmtNum(k.lost)}
              footer={`${k.coverageLossRate ?? '—'}% من الاحتياجات`}
              onClick={() => openDrill('فقد التغطية', needOrders(k.groups.lost), Object.entries(k.lossBreakdown).map(([t, n]) => `${LOSS_TYPE_LABELS[t]}: ${n}`).join(' · '))} />
          </div>

          {/* ما استُبعد وصُنّف — شفافية الأرقام */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => openDrill('جارية الآن (خارج نسبة الإنجاز)', needOrders(k.groups.active))}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600 hover:border-amber-300 flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-teal-600" /> جارية: {k.active}</button>
            <button type="button" onClick={() => openDrill('ملغاة بعد القبول', needOrders(k.groups.cancelled), Object.entries(k.cancelBreakdown).map(([t, n]) => `${CANCEL_TYPE_LABELS[t]}: ${n}`).join(' · '))}
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600 hover:border-amber-300">
              ملغاة بعد القبول: {k.cancelled}{Object.keys(k.cancelBreakdown).length ? ` (${Object.entries(k.cancelBreakdown).map(([t, n]) => `${CANCEL_TYPE_LABELS[t]} ${n}`).join('، ')})` : ''}
            </button>
            <span className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-500 flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> تكرار مدمج: {k.repeatedAttempts}</span>
            <span className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-500 flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" /> اختبارات مستبعدة: {base.testExcludedCount}</span>
          </div>

          {/* تحتاج تدخلك + أين نخسر */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="p-4 sm:p-5 lg:col-span-3">
              <SectionTitle icon={AlertTriangle} tone="bg-red-50 text-red-500" title="تحتاج تدخلك الآن" subtitle="أهم 3 مشكلات مرتبة بالخطورة" />
              {model.issues.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm py-8 justify-center font-bold"><ShieldCheck className="w-5 h-5" /> لا مشكلات عاجلة الآن</div>
              ) : (
                <div className="space-y-2.5">
                  {model.issues.map((issue, i) => (
                    <div key={issue.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-black text-gray-700 text-sm flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-gray-900">{issue.title}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${SEVERITY_STYLE[issue.severity].cls}`}>{SEVERITY_STYLE[issue.severity].label}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{issue.detail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {issue.orders.length ? (
                          <button type="button" onClick={() => openDrill(issue.title, issue.orders, issue.detail)}
                            className="text-xs font-bold px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:border-gray-300">التفاصيل</button>
                        ) : null}
                        <button type="button" onClick={() => navigate(issue.action.path)}
                          className="text-xs font-black px-3 py-2 rounded-xl bg-amber-400 text-gray-900 hover:bg-amber-500 flex items-center gap-1">
                          {issue.action.label} <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-5 lg:col-span-2">
              <SectionTitle icon={MapIcon} title="أين نخسر الطلبات؟" subtitle="أعلى 3 مناطق باحتياجات غير مخدومة" />
              <LossMiniMap points={model.lostPoints} highlights={model.areas} />
              <div className="space-y-2 mt-3">
                {model.areas.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">لا احتياجات ضائعة في الفترة</p> : null}
                {model.areas.map((area, i) => (
                  <button key={area.key} type="button"
                    onClick={() => openDrill(area.label, area.needs.map((n) => n.representative),
                      Object.entries(area.reasons).map(([t, n]) => `${LOSS_TYPE_LABELS[t]}: ${n}`).join(' · '))}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 text-right hover:border-amber-300 transition-colors">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${['bg-red-500', 'bg-orange-500', 'bg-amber-500'][i]}`}>{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 text-sm truncate">{area.label}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{LOSS_TYPE_LABELS[area.mainReason] || '—'}</span>
                    </span>
                    <span className="text-lg font-black text-gray-900 tabular-nums">{area.count}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => navigate('/admin/providers-map')}
                className="w-full mt-3 rounded-xl border border-amber-300 text-amber-700 py-2 text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-50">
                <MapIcon className="w-4 h-4" /> عرض خريطة التغطية
              </button>
            </Card>
          </div>

          {/* التوصية + الوكلاء + الاتجاه */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 sm:p-5 border-r-4 border-r-amber-400">
              <SectionTitle icon={Target} title="توصية اليوم" subtitle="تُنفّذ بعد اعتمادك" />
              {recommendation ? (
                <>
                  <h3 className="font-black text-gray-900">{recommendation.title}</h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{recommendation.reason}</p>
                  <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-2.5 py-1.5 mt-2 inline-block">الأثر المتوقع: {recommendation.effect}</p>
                  {approvedToday ? (
                    <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> اعتمدها اليوم {approvedToday.approvedBy || 'مدير'}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button type="button" onClick={() => openDrill(recommendation.title, recommendation.evidence, recommendation.reason)}
                      className="rounded-xl border border-gray-200 text-gray-700 py-2 text-sm font-bold flex items-center justify-center gap-1 hover:border-gray-300">
                      <Search className="w-4 h-4" /> الأدلة
                    </button>
                    <button type="button" onClick={approveRecommendation} disabled={approving}
                      className="rounded-xl bg-amber-400 text-gray-900 py-2 text-sm font-black flex items-center justify-center gap-1 hover:bg-amber-500 disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4" /> {approvedToday ? 'فتح التنفيذ' : 'اعتماد التنفيذ'}
                    </button>
                  </div>
                </>
              ) : <p className="text-center text-gray-400 text-sm py-8">لا توصية — المؤشرات ضمن الأهداف</p>}
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle icon={Sparkles} title="وكلاء فزاعين" subtitle="تحليل البيانات — كل استنتاج بدليله" />
              <div className="space-y-2">
                {AGENTS.map((agent) => {
                  const findings = model.agentsResult.agents[agent.id];
                  return (
                    <button key={agent.id} type="button" onClick={() => setAgentOpen(agent.id)}
                      className="w-full flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 text-right hover:border-amber-300 transition-colors">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${agent.tone}`}><agent.icon className="w-5 h-5" /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-gray-900 text-sm">{agent.title}</span>
                        <span className="block text-[11px] text-gray-400 truncate">{findings[0]?.title || agent.sub}</span>
                      </span>
                      <span className={`min-w-6 h-6 px-1.5 rounded-full text-xs font-black flex items-center justify-center ${findings.length ? 'bg-amber-400 text-gray-900' : 'bg-gray-100 text-gray-400'}`}>{findings.length}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle icon={TrendingUp} tone="bg-teal-50 text-teal-600" title="اتجاه الطلبات" subtitle="يومياً" />
              <TrendBars days={model.trend} />
            </Card>
          </div>

          {/* صحة التشغيل */}
          <Card className="p-4 sm:p-5">
            <SectionTitle icon={Gauge} tone="bg-teal-50 text-teal-600" title="صحة التشغيل" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  icon: Clock, label: 'متوسط زمن الوصول', value: k.avgArrivalMinutes == null ? '—' : `${k.avgArrivalMinutes} د`,
                  good: k.avgArrivalMinutes != null && k.avgArrivalMinutes <= targets.arrivalTargetMinutes,
                  hint: `فعلي (دخول 500م) · ${k.arrivalSamples} طلب · الهدف ${targets.arrivalTargetMinutes} د`,
                  onClick: () => openDrill('المكتمل (أساس زمن الوصول)', needOrders(k.groups.served)),
                },
                {
                  icon: Repeat, label: 'قبول الطلبات', value: k.acceptanceRate == null ? '—' : `${k.acceptanceRate}%`,
                  good: k.acceptanceRate != null && k.acceptanceRate >= targets.acceptanceTargetPercent,
                  hint: `مما وصل لمزود · الهدف ${targets.acceptanceTargetPercent}%`,
                  onClick: () => openDrill('وصلت للمزودين ولم يقبلها أحد', needOrders(k.groups.lost.filter((n) => n.representative.notifiedProviders?.length && !String(n.representative.status).startsWith('canceled_by_client')))),
                },
                {
                  icon: Users, label: 'المتاحون الآن', value: fmtNum(model.availableProviders),
                  good: model.availableProviders > 0,
                  hint: `متصل بموقع ≤3س ورصيد · +${model.backupProviders} بديل`,
                  onClick: () => navigate('/admin/providers-map'),
                },
                {
                  icon: ShieldCheck, label: 'حالة النظام', value: systemHealthy ? 'سليم' : 'تحقق',
                  good: systemHealthy,
                  hint: model.live.stuckSearching.length ? `${model.live.stuckSearching.length} طلب عالق في البحث` : `${model.live.searchingNow} يبحث · ${model.live.activeCount} جارٍ`,
                  onClick: () => (model.live.stuckSearching.length ? openDrill('طلبات عالقة في البحث', model.live.stuckSearching) : navigate('/admin/dispatch-diagnostics')),
                },
              ].map((m) => (
                <button key={m.label} type="button" onClick={m.onClick} className="text-right rounded-xl border border-gray-100 p-3 hover:border-amber-300 transition-colors">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500"><m.icon className="w-4 h-4" /> {m.label}</div>
                  <div className={`inline-block mt-2 rounded-lg px-2.5 py-0.5 text-lg font-black ${m.good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{m.value}</div>
                  <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">{m.hint}</div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {agentOpen && model ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setAgentOpen(null)} />
          <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black text-gray-900">{AGENTS.find((a) => a.id === agentOpen)?.title}</h3>
              <button type="button" onClick={() => setAgentOpen(null)} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            {model.agentsResult.agents[agentOpen].length === 0 ? <p className="text-gray-400 text-sm py-6 text-center">لا استنتاجات في هذه الفترة</p> : null}
            <div className="space-y-2">
              {model.agentsResult.agents[agentOpen].map((f) => (
                <div key={f.title} className="rounded-xl border border-gray-100 p-3">
                  <div className="font-black text-gray-900">{f.title}</div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.reason}</p>
                  <p className="text-[11px] text-teal-700 mt-1">الأثر: {f.effect}</p>
                  <div className="flex gap-2 mt-2">
                    {f.evidence.length ? (
                      <button type="button" onClick={() => { setAgentOpen(null); openDrill(f.title, f.evidence, f.reason); }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">الأدلة ({f.evidence.length})</button>
                    ) : null}
                    <button type="button" onClick={() => navigate(f.action.path)}
                      className="text-xs font-black px-3 py-1.5 rounded-lg bg-amber-400 text-gray-900 hover:bg-amber-500">{f.action.label}</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-4">الاستنتاجات من قواعد على بياناتك الفعلية، ولا يُنفّذ أي إجراء إلا من صفحته بعد قرارك.</p>
          </div>
        </div>
      ) : null}

      <DrillPanel drill={drill} onClose={() => setDrill(null)} areaOf={base?.areaOf || (() => ({ label: '—' }))} onMarkTest={markTest} navigate={navigate} />
      {editingTargets ? (
        <TargetsEditor config={data.config} onClose={() => setEditingTargets(false)} onSaved={data.reload} />
      ) : null}
    </div>
  );
};

export default DecisionCenter;
