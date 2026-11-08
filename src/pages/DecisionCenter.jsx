import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  addDoc, collection, doc, getCountFromServer, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import {
  Activity, AlertTriangle, ArrowLeft, Ban, BarChart3, CalendarDays, Car, CheckCircle2, ClipboardList, Clock,
  FlaskConical, Gauge, Loader2, Map as MapIcon, MapPin, RefreshCw, Repeat, Search, Settings2, ShieldCheck,
  Sparkles, Target, TrendingUp, Users, X, Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { auth, db } from '../services/firebase';
import { getAllCities, listenToRequestsSince } from '../services/adminService';
import { normalizePricing, DEFAULT_PRICING } from '../utils/providerPricing';
import {
  CANCEL_TYPE_LABELS, DEFAULT_TARGETS, DEFAULT_TEST_PHONES, LOSS_TYPE_LABELS, NEED_OUTCOME_LABELS,
  analyzeLiveOrders, buildAgentFindings, buildAreaResolver, buildNeeds, buildUrgentIssues, compareKpi,
  computeKpis, dailyTrend, filterOrders, isTestOrder, providerDispatchReach, needsInRange, phoneKey,
  resolvePeriod, topLostAreas,
} from '../utils/decisionCenter';
import { requestCoords } from '../utils/noCoverage';
import { toMs } from '../utils/providerPerformance';

const PERIODS = [
  { id: 'today', label: 'اليوم' },
  { id: '7d', label: 'آخر 7 أيام' },
  { id: '30d', label: 'آخر 30 يوم' },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const PROVIDERS_REFRESH_MS = 5 * 60 * 1000; // المزودون والتصعيدات والاعتمادات فقط؛ الباقي يُحمّل مرة

const STATUS_LABELS = {
  searching: 'جاري البحث', assigned: 'تم القبول', en_route: 'في الطريق', arrived: 'وصل', in_progress: 'قيد التنفيذ',
  pending_legal_docs: 'وثائق قانونية', pending_client_confirmation: 'بانتظار تأكيد العميل', pending_review: 'بانتظار التقييم',
  completed: 'مكتمل', timed_out: 'انتهى البحث', canceled_by_client: 'ألغاه العميل', canceled_by_client_with_reason: 'ألغاه العميل',
  canceled_by_provider: 'ألغاه المزود', canceled_by_provider_with_reason: 'ألغاه المزود', canceled_by_admin: 'ألغته الإدارة',
  escalated_to_city_manager: 'مُصعّد',
};
const SEVERITY_STYLE = {
  high: { label: 'عالية', cls: 'bg-red-500/90 text-white' },
  medium: { label: 'متوسطة', cls: 'bg-amber-500/90 text-black' },
  low: { label: 'منخفضة', cls: 'bg-sky-500/80 text-white' },
};

const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
/** يوم الرياض المحلي (YYYY-MM-DD) — toISOString بتوقيت UTC يخطئ بين 00:00 و03:00 */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** كل بيانات الصفحة: الطلبات حيّة، والباقي يُجلب ويتحدث دورياً */
function useDecisionData(fetchFromMs) {
  const [orders, setOrders] = useState(null);
  const [cities, setCities] = useState([]);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [config, setConfig] = useState({ targets: DEFAULT_TARGETS, testPhones: DEFAULT_TEST_PHONES });
  const [testCustomerIds, setTestCustomerIds] = useState(new Set());
  const [openEscalations, setOpenEscalations] = useState(0);
  const [approvals, setApprovals] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => listenToRequestsSince(fetchFromMs, (list) => {
    setOrders(list);
    setUpdatedAt(Date.now());
  }), [fetchFromMs]);

  /** يتغير طوال اليوم: المزودون والتصعيدات واعتمادات اليوم */
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

  /** نادراً ما يتغير: المدن والخدمات والإعدادات وعملاء الاختبار — مرة عند الفتح وبعد حفظ الأهداف */
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

  const reload = useCallback(() => Promise.all([loadStatic(), loadLive()]), [loadStatic, loadLive]);

  useEffect(() => {
    loadStatic();
    loadLive();
    const id = setInterval(loadLive, PROVIDERS_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadStatic, loadLive]);

  return {
    orders, cities, services, providers, pricing, config, testCustomerIds, openEscalations, approvals, updatedAt,
    reload, setConfig,
  };
}

const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl border border-white/10 bg-[#111a2e] ${className}`} {...rest}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, subtitle, iconClass = 'text-amber-400' }) => (
  <div className="flex items-start gap-2 mb-3">
    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconClass}`} />
    <div>
      <h2 className="text-base sm:text-lg font-black text-white">{title}</h2>
      {subtitle ? <p className="text-xs text-white/50 mt-0.5">{subtitle}</p> : null}
    </div>
  </div>
);

const Delta = ({ value, suffix, invert = false }) => {
  if (value == null) return <span className="text-white/40">لا مقارنة</span>;
  const good = invert ? value < 0 : value > 0;
  const color = value === 0 ? 'text-white/60' : good ? 'text-emerald-400' : 'text-red-400';
  return <span className={`font-black ${color}`}>{value > 0 ? '▲ +' : value < 0 ? '▼ ' : ''}{value}{suffix}</span>;
};

const KpiCard = ({ icon: Icon, title, value, footer, tone, onClick }) => {
  const tones = {
    blue: 'from-[#16233f] to-[#111a2e] border-sky-400/20',
    green: 'from-[#0f2a22] to-[#111a2e] border-emerald-400/25',
    red: 'from-[#3a1218] to-[#1d1420] border-red-400/30',
  };
  return (
    <button type="button" onClick={onClick}
      className={`text-right rounded-2xl border bg-gradient-to-b ${tones[tone]} p-4 sm:p-5 hover:brightness-125 transition w-full`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm sm:text-base font-black text-white">{title}</span>
        <Icon className="w-6 h-6 text-white/80" />
      </div>
      <div className="text-3xl sm:text-4xl font-black text-white mt-2 tabular-nums">{value}</div>
      <div className="mt-3 rounded-xl bg-black/25 px-3 py-1.5 text-xs text-white/70 text-center">{footer}</div>
    </button>
  );
};

/** نقاط الطلبات الضائعة — خريطة مصغرة بلا مكتبة خرائط */
const LossMiniMap = ({ points, highlights }) => {
  if (!points.length) return <div className="h-40 flex items-center justify-center text-white/30 text-sm">لا نقاط في الفترة</div>;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pad = 0.0001;
  const x = (lng) => 10 + ((lng - minLng) / (maxLng - minLng + pad)) * 180;
  const y = (lat) => 10 + ((maxLat - lat) / (maxLat - minLat + pad)) * 120;
  return (
    <svg viewBox="0 0 200 140" className="w-full h-40" role="img" aria-label="مواقع الطلبات غير المخدومة">
      <rect x="2" y="2" width="196" height="136" rx="12" className="fill-white/[0.03] stroke-white/10" />
      {points.map((p, i) => <circle key={i} cx={x(p.lng)} cy={y(p.lat)} r="2" className="fill-red-400/50" />)}
      {highlights.filter((h) => h.lat != null).map((h, i) => (
        <g key={h.key}>
          <circle cx={x(h.lng)} cy={y(h.lat)} r={9 - i * 1.5} className={i === 0 ? 'fill-red-500/30' : 'fill-amber-500/30'} />
          <circle cx={x(h.lng)} cy={y(h.lat)} r="3.5" className={i === 0 ? 'fill-red-500' : 'fill-amber-400'} />
        </g>
      ))}
    </svg>
  );
};

/** لوحة جانبية: الطلبات خلف أي رقم */
const DrillPanel = ({ drill, onClose, areaOf, onMarkTest, navigate }) => {
  if (!drill) return null;
  const orders = [...drill.orders].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-[#0d1526] border-l border-white/10 flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-black text-white">{drill.title}</h3>
            {drill.subtitle ? <p className="text-xs text-white/50 mt-1">{drill.subtitle}</p> : null}
            <p className="text-xs text-amber-400 mt-1">{orders.length} طلب</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10 text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orders.length === 0 ? <p className="text-center text-white/40 text-sm py-10">لا توجد طلبات</p> : null}
          {orders.slice(0, 300).map((order) => {
            const area = areaOf(order);
            return (
              <div key={order.id} className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-white tabular-nums">#{order.orderNumber ?? order.id.slice(-6)}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-white/80">{STATUS_LABELS[order.status] || order.status}</span>
                </div>
                <div className="text-xs text-white/60 mt-1">{order.serviceName || '—'} · {fmtDate(toMs(order.createdAt))}</div>
                <div className="text-xs text-white/40 mt-0.5 truncate">{area.label}</div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => navigate(`/admin/orders?q=${order.orderNumber ?? order.id}`)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-400 text-black hover:bg-amber-300">فتح الطلب</button>
                  <button type="button" onClick={() => onMarkTest(order)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5" /> اختبار — استبعده
                  </button>
                </div>
              </div>
            );
          })}
          {orders.length > 300 ? <p className="text-center text-white/40 text-xs py-2">يظهر أول 300 — افتح صفحة الطلبات للباقي</p> : null}
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
      onSaved({ targets, testPhones: [...new Set([...DEFAULT_TEST_PHONES, ...testPhones])] });
      onClose();
    } catch (e) {
      alert(`تعذر الحفظ: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };
  const field = (key, label, unit) => (
    <label className="block">
      <span className="text-xs font-bold text-white/70">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <input type="number" value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white text-sm" />
        <span className="text-xs text-white/50">{unit}</span>
      </div>
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[#0d1526] border border-white/10 p-5 space-y-4">
        <h3 className="text-lg font-black text-white">الأهداف وبيانات الاختبار</h3>
        <div className="grid grid-cols-3 gap-3">
          {field('arrivalTargetMinutes', 'زمن الوصول', 'د')}
          {field('acceptanceTargetPercent', 'القبول', '%')}
          {field('completionTargetPercent', 'الإنجاز', '%')}
        </div>
        <label className="block">
          <span className="text-xs font-bold text-white/70">جوالات عملاء الاختبار (تُستبعد طلباتهم)</span>
          <textarea value={draft.testPhones} onChange={(e) => setDraft((d) => ({ ...d, testPhones: e.target.value }))} rows={2}
            placeholder="05xxxxxxxx، 05xxxxxxxx" className="w-full mt-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-white text-sm" />
          <span className="text-[11px] text-white/40">تُستبعد دائماً: {DEFAULT_TEST_PHONES.join('، ')} وطلبات مختبر الطلبات وما علّمته «اختبار».</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-white/70 hover:bg-white/10 text-sm font-bold">إلغاء</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-amber-400 text-black text-sm font-black disabled:opacity-50">
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [locallyExcluded, setLocallyExcluded] = useState(new Set());

  const model = useMemo(() => {
    if (!data.orders) return null;
    const allOrders = data.orders;
    const testExcluded = allOrders.filter((o) => isTestOrder(o, data.testCustomerIds) || locallyExcluded.has(o.id));
    const testIds = new Set(testExcluded.map((o) => o.id));
    const clean = filterOrders(allOrders.filter((o) => !testIds.has(o.id)), { city, service }, data.cities);
    const needs = buildNeeds(clean);
    const current = needsInRange(needs, range.fromMs, range.toMs);
    const kpis = computeKpis(current);
    const prevKpis = computeKpis(needsInRange(needs, range.prevFromMs, range.prevToMs));
    const areas = topLostAreas(kpis.groups.lost, data.cities, 3, clean);
    const live = analyzeLiveOrders(clean, data.config.targets);
    const inCity = (p) => !city || filterOrders([{ coordinates: p.location }], { city }, data.cities).length > 0;
    const reach = data.providers.filter(inCity).map((p) => providerDispatchReach(p, data.pricing));
    const availableProviders = reach.filter((r) => r === 'fresh').length;
    const backupProviders = reach.filter((r) => r === 'backup').length;
    const issues = buildUrgentIssues({
      live, kpis, areas, targets: data.config.targets, availableProviders, backupProviders, openEscalations: data.openEscalations,
    });
    const agentsResult = buildAgentFindings({ kpis, prevKpis, live, areas, availableProviders, targets: data.config.targets });
    const trend = dailyTrend(needs, trendFromMs, range.toMs);
    const lostPoints = kpis.groups.lost.map((n) => requestCoords(n.representative)).filter(Boolean);
    return {
      clean, kpis, prevKpis, areas, live, availableProviders, backupProviders, issues, agentsResult, trend, lostPoints,
      testExcludedCount: testExcluded.filter((o) => toMs(o.createdAt) >= range.fromMs).length,
      areaOf: buildAreaResolver(clean, data.cities),
    };
  }, [data.orders, data.testCustomerIds, data.cities, data.providers, data.pricing, data.config, data.openEscalations,
    city, service, range, trendFromMs, locallyExcluded]);

  const openDrill = (title, orders, subtitle) => setDrill({ title, orders: orders || [], subtitle });
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
      await data.reload();
      navigate(recommendation.action.path);
    } catch (e) {
      alert(`تعذر الاعتماد: ${e?.message || e}`);
    } finally {
      setApproving(false);
    }
  };

  const loading = !model;
  const k = model?.kpis;
  const pk = model?.prevKpis;
  const targets = data.config.targets;
  const periodLabel = PERIODS.find((p) => p.id === period)?.label;
  const systemHealthy = model && model.live.stuckSearching.length === 0 && (model.availableProviders + model.backupProviders) > 0;

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-full bg-[#0b1220] text-white" dir="rtl">
      {/* الرأس + الفلاتر الموحّدة */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-black">مركز القرار <span className="text-amber-400">|</span> فزاعين</h1>
          <p className="text-xs sm:text-sm text-white/50">ملخص الأداء • المشكلات • القرارات — أرقام فعلية بعد استبعاد الاختبار ودمج التكرار</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => setFilter('period', p.id === 'today' ? '' : p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1 ${period === p.id ? 'bg-amber-400 text-black' : 'text-white/70 hover:text-white'}`}>
                {p.id === 'today' ? <CalendarDays className="w-4 h-4" /> : null}{p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5">
            <MapPin className="w-4 h-4 text-red-400" />
            <select value={city} onChange={(e) => setFilter('city', e.target.value)} aria-label="المدينة"
              className="bg-transparent text-xs sm:text-sm font-bold text-white outline-none [&>option]:text-black">
              <option value="">كل المدن</option>
              {data.cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5">
            <Car className="w-4 h-4 text-red-400" />
            <select value={service} onChange={(e) => setFilter('service', e.target.value)} aria-label="الخدمة"
              className="bg-transparent text-xs sm:text-sm font-bold text-white outline-none [&>option]:text-black">
              <option value="">كل الخدمات</option>
              {data.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => data.reload()} title="تحديث"
            className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
            <RefreshCw className="w-4 h-4" />
            آخر تحديث: {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </button>
          <button type="button" onClick={() => setEditingTargets(true)} title="الأهداف وبيانات الاختبار"
            className="rounded-xl bg-white/5 border border-white/10 p-2 text-white/60 hover:text-white"><Settings2 className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-white/50 gap-2"><Loader2 className="w-6 h-6 animate-spin" /> جارٍ تحميل البيانات الفعلية…</div>
      ) : (
        <>
          {/* المؤشرات الأربعة */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard tone="blue" icon={ClipboardList} title="احتياجات فعلية" value={fmtNum(k.needs)}
              footer={`${fmtNum(k.attempts)} طلب ← ${fmtNum(k.needs)} احتياج بعد دمج التكرار`}
              onClick={() => openDrill('الاحتياجات الفعلية', needOrders(model.kpis.groups.served.concat(k.groups.active, k.groups.lost, k.groups.cancelled)), `${periodLabel} — محاولة ممثلة لكل احتياج`)} />
            <KpiCard tone="green" icon={CheckCircle2} title="طلبات مكتملة" value={fmtNum(k.served)}
              footer={<><Delta value={compareKpi(k.served, pk.served)} suffix="%" /> مقارنة بالفترة السابقة</>}
              onClick={() => openDrill('الاحتياجات المكتملة', needOrders(k.groups.served))} />
            <KpiCard tone="green" icon={Target} title="نسبة الإنجاز" value={k.completionRate == null ? '—' : `${k.completionRate}%`}
              footer={<><Delta value={compareKpi(k.completionRate, pk.completionRate, { isRate: true })} suffix=" نقطة" /> · الهدف {targets.completionTargetPercent}%</>}
              onClick={() => openDrill('المنتهية (أساس نسبة الإنجاز)', needOrders(k.groups.served.concat(k.groups.lost, k.groups.cancelled)), 'الجاري لا يدخل النسبة حتى ينتهي')} />
            <KpiCard tone="red" icon={Ban} title="فقد التغطية" value={fmtNum(k.lost)}
              footer={`${k.coverageLossRate ?? '—'}% من الاحتياجات`}
              onClick={() => openDrill('فقد التغطية', needOrders(k.groups.lost), Object.entries(k.lossBreakdown).map(([t, n]) => `${LOSS_TYPE_LABELS[t]}: ${n}`).join(' · '))} />
          </div>

          {/* صحة البيانات: ما الذي استُبعد وصُنّف */}
          <div className="flex flex-wrap gap-2 mt-3 text-[11px] sm:text-xs">
            <button type="button" onClick={() => openDrill('جارية الآن (خارج نسبة الإنجاز)', needOrders(k.groups.active))}
              className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/70 hover:text-white flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> جارية: {k.active}</button>
            <button type="button" onClick={() => openDrill('ملغاة بعد القبول', needOrders(k.groups.cancelled), Object.entries(k.cancelBreakdown).map(([t, n]) => `${CANCEL_TYPE_LABELS[t]}: ${n}`).join(' · '))}
              className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/70 hover:text-white">
              ملغاة بعد القبول: {k.cancelled} ({Object.entries(k.cancelBreakdown).map(([t, n]) => `${CANCEL_TYPE_LABELS[t]} ${n}`).join('، ') || '—'})
            </button>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/60 flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> محاولات مكررة مدمجة: {k.repeatedAttempts}</span>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/60 flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" /> اختبارات مستبعدة: {model.testExcludedCount}</span>
          </div>

          {/* أين نخسر + تحتاج تدخلك */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
            <Card className="p-4 sm:p-5 lg:col-span-3">
              <SectionTitle icon={AlertTriangle} title="تحتاج تدخلك الآن" subtitle="أهم 3 مشكلات مرتبة بالخطورة" />
              {model.issues.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm py-6 justify-center"><ShieldCheck className="w-5 h-5" /> لا مشكلات عاجلة الآن</div>
              ) : (
                <div className="space-y-2">
                  {model.issues.map((issue, i) => (
                    <div key={issue.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-white/[0.04] border border-white/5 p-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-amber-400 flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-white">{issue.title}</span>
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${SEVERITY_STYLE[issue.severity].cls}`}>{SEVERITY_STYLE[issue.severity].label}</span>
                          </div>
                          <p className="text-xs text-white/60 mt-1">{issue.detail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {issue.orders.length ? (
                          <button type="button" onClick={() => openDrill(issue.title, issue.orders, issue.detail)}
                            className="text-xs font-bold px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20">التفاصيل</button>
                        ) : null}
                        <button type="button" onClick={() => navigate(issue.action.path)}
                          className="text-xs font-black px-3 py-2 rounded-xl bg-amber-400 text-black hover:bg-amber-300 flex items-center gap-1">
                          {issue.action.label} <ArrowLeft className="w-4 h-4" />
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
              <div className="space-y-2 mt-2">
                {model.areas.length === 0 ? <p className="text-center text-white/40 text-sm py-3">لا احتياجات ضائعة في الفترة</p> : null}
                {model.areas.map((area, i) => (
                  <button key={area.key} type="button"
                    onClick={() => openDrill(area.label, area.needs.map((n) => n.representative),
                      Object.entries(area.reasons).map(([t, n]) => `${LOSS_TYPE_LABELS[t]}: ${n}`).join(' · '))}
                    className="w-full flex items-center gap-3 rounded-xl p-2.5 text-right hover:brightness-125"
                    style={{ background: `linear-gradient(to left, ${['rgba(239,68,68,.35)', 'rgba(234,88,12,.3)', 'rgba(202,138,4,.3)'][i]}, rgba(255,255,255,.03))` }}>
                    <span className="w-6 h-6 rounded-full border border-white/40 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-black text-white truncate">{area.label}</span>
                      <span className="block text-[11px] text-white/60 truncate">{LOSS_TYPE_LABELS[area.mainReason] || '—'}</span>
                    </span>
                    <span className="text-xl font-black tabular-nums">{area.count}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => navigate('/admin/providers-map')}
                className="w-full mt-3 rounded-xl border border-amber-400/60 text-amber-400 py-2 text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-400/10">
                <MapIcon className="w-4 h-4" /> عرض خريطة التغطية <ArrowLeft className="w-4 h-4" />
              </button>
            </Card>
          </div>

          {/* الوكلاء + التوصية + الاتجاه */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <Card className="p-4 sm:p-5">
              <SectionTitle icon={Sparkles} title="وكلاء فزاعين" subtitle="تحليل يومي للبيانات — كل استنتاج بدليله" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'coverage', icon: MapPin, color: 'text-violet-400', title: 'وكيل التغطية', sub: 'تحليل التغطية واقتراح توزيع المزودين' },
                  { id: 'operations', icon: Zap, color: 'text-amber-400', title: 'وكيل التشغيل', sub: 'مراقبة الطلبات وتوقع التأخير' },
                  { id: 'quality', icon: BarChart3, color: 'text-emerald-400', title: 'وكيل الجودة والنمو', sub: 'كشف الأنماط وتحسين الأداء' },
                ].map((agent) => (
                  <button key={agent.id} type="button" onClick={() => setAgentOpen(agent.id)}
                    className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-center hover:bg-white/[0.08] relative">
                    {model.agentsResult.agents[agent.id].length ? (
                      <span className="absolute top-1.5 left-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-black text-[11px] font-black flex items-center justify-center">
                        {model.agentsResult.agents[agent.id].length}
                      </span>
                    ) : null}
                    <agent.icon className={`w-6 h-6 mx-auto ${agent.color}`} />
                    <div className="text-xs sm:text-sm font-black mt-2">{agent.title}</div>
                    <div className="text-[10px] sm:text-[11px] text-white/50 mt-1 leading-snug">{agent.sub}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle icon={Target} title="توصية اليوم" />
              {recommendation ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-white text-base">{recommendation.title}</h3>
                    <span className="text-[11px] rounded-lg bg-emerald-400/15 text-emerald-300 px-2 py-1 text-center flex-shrink-0">الأثر المتوقع<br />{recommendation.effect}</span>
                  </div>
                  <p className="text-xs text-white/60 mt-2 leading-relaxed">{recommendation.reason}</p>
                  {approvedToday ? (
                    <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> اعتمدها اليوم {approvedToday.approvedBy || 'مدير'}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button type="button" onClick={() => openDrill(recommendation.title, recommendation.evidence, recommendation.reason)}
                      className="rounded-xl border border-amber-400/60 text-amber-400 py-2 text-sm font-bold flex items-center justify-center gap-1 hover:bg-amber-400/10">
                      <Search className="w-4 h-4" /> مراجعة التفاصيل
                    </button>
                    <button type="button" onClick={approveRecommendation} disabled={approving}
                      className="rounded-xl bg-amber-400 text-black py-2 text-sm font-black flex items-center justify-center gap-1 hover:bg-amber-300 disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4" /> {approvedToday ? 'فتح التنفيذ' : 'اعتماد التنفيذ'}
                    </button>
                  </div>
                </>
              ) : <p className="text-center text-white/40 text-sm py-8">لا توصية — المؤشرات ضمن الأهداف</p>}
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle icon={TrendingUp} title="اتجاه الطلبات" subtitle="الاحتياجات والمكتمل يومياً" />
              <div className="h-44" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={model.trend.map((d) => ({ ...d, day: new Date(d.dayMs).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }) }))}>
                    <defs>
                      <linearGradient id="dcNeeds" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#facc15" stopOpacity={0.5} /><stop offset="100%" stopColor="#facc15" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 10 }} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0d1526', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, direction: 'rtl' }}
                      formatter={(value, name) => [value, { needs: 'احتياجات', served: 'مكتمل', lost: 'فقد تغطية' }[name] || name]} />
                    <Area type="monotone" dataKey="needs" stroke="#facc15" fill="url(#dcNeeds)" strokeWidth={2} />
                    <Area type="monotone" dataKey="served" stroke="#34d399" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* صحة التشغيل */}
          <Card className="p-4 sm:p-5 mt-4">
            <SectionTitle icon={Gauge} title="صحة التشغيل" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  icon: Clock, label: 'متوسط زمن الوصول', value: k.avgArrivalMinutes == null ? '—' : `${k.avgArrivalMinutes} دقيقة`,
                  good: k.avgArrivalMinutes != null && k.avgArrivalMinutes <= targets.arrivalTargetMinutes,
                  hint: `فعلي (دخول 500م) · ${k.arrivalSamples} طلب · الهدف ${targets.arrivalTargetMinutes} د`,
                  onClick: () => openDrill('المكتمل (أساس زمن الوصول)', needOrders(k.groups.served)),
                },
                {
                  icon: Repeat, label: 'قبول الطلبات', value: k.acceptanceRate == null ? '—' : `${k.acceptanceRate}%`,
                  good: k.acceptanceRate != null && k.acceptanceRate >= targets.acceptanceTargetPercent,
                  hint: `من الاحتياجات التي وصلت لمزود · الهدف ${targets.acceptanceTargetPercent}%`,
                  onClick: () => openDrill('وصلت للمزودين ولم يقبلها أحد', needOrders(k.groups.lost.filter((n) => Array.isArray(n.representative.notifiedProviders) && n.representative.notifiedProviders.length && !String(n.representative.status).startsWith('canceled_by_client')))),
                },
                {
                  icon: Users, label: 'المزودون المتاحون الآن', value: fmtNum(model.availableProviders),
                  good: model.availableProviders > 0,
                  hint: `متصل بموقع ≤3س ورصيد كافٍ · +${model.backupProviders} بديل (≤24س)`,
                  onClick: () => navigate('/admin/providers-map'),
                },
                {
                  icon: ShieldCheck, label: 'حالة النظام', value: systemHealthy ? 'سليم' : 'تحقق',
                  good: systemHealthy,
                  hint: model.live.stuckSearching.length ? `${model.live.stuckSearching.length} طلب عالق في البحث` : `${model.live.searchingNow} يبحث · ${model.live.activeCount} جارٍ`,
                  onClick: () => (model.live.stuckSearching.length ? openDrill('طلبات عالقة في البحث', model.live.stuckSearching) : navigate('/admin/dispatch-diagnostics')),
                },
              ].map((m) => (
                <button key={m.label} type="button" onClick={m.onClick} className="text-right rounded-xl bg-white/[0.03] border border-white/5 p-3 hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70"><m.icon className="w-4 h-4" /> {m.label}</div>
                  <div className={`inline-block mt-2 rounded-xl px-3 py-1 text-lg sm:text-xl font-black ${m.good ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{m.value}</div>
                  <div className="text-[11px] text-white/40 mt-1.5">{m.hint}</div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {agentOpen && model ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAgentOpen(null)} />
          <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0d1526] border border-white/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black">{{ coverage: 'وكيل التغطية', operations: 'وكيل التشغيل', quality: 'وكيل الجودة والنمو' }[agentOpen]}</h3>
              <button type="button" onClick={() => setAgentOpen(null)} aria-label="إغلاق" className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            {model.agentsResult.agents[agentOpen].length === 0 ? <p className="text-white/50 text-sm py-6 text-center">لا استنتاجات في هذه الفترة</p> : null}
            <div className="space-y-2">
              {model.agentsResult.agents[agentOpen].map((f) => (
                <div key={f.title} className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                  <div className="font-black">{f.title}</div>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">{f.reason}</p>
                  <p className="text-[11px] text-emerald-300/80 mt-1">الأثر: {f.effect}</p>
                  <div className="flex gap-2 mt-2">
                    {f.evidence.length ? (
                      <button type="button" onClick={() => { setAgentOpen(null); openDrill(f.title, f.evidence, f.reason); }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">الأدلة ({f.evidence.length})</button>
                    ) : null}
                    <button type="button" onClick={() => navigate(f.action.path)}
                      className="text-xs font-black px-3 py-1.5 rounded-lg bg-amber-400 text-black hover:bg-amber-300">{f.action.label}</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/40 mt-4">الاستنتاجات من قواعد على بياناتك الفعلية، ولا يُنفّذ أي إجراء إلا من صفحته بعد قرارك.</p>
          </div>
        </div>
      ) : null}

      <DrillPanel drill={drill} onClose={() => setDrill(null)} areaOf={model?.areaOf || (() => ({ label: '—' }))} onMarkTest={markTest} navigate={navigate} />
      {editingTargets ? (
        <TargetsEditor config={data.config} onClose={() => setEditingTargets(false)}
          onSaved={(next) => { data.setConfig(next); data.reload(); }} />
      ) : null}
    </div>
  );
};

export default DecisionCenter;
