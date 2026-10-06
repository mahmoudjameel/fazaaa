import { useEffect, useMemo, useState } from 'react';
import {
  WifiOff, Loader2, ChevronDown, ChevronUp, Phone, MapPin, Clock, RefreshCw, Search,
  MessageCircle, Bell, Copy, Download, CheckSquare, Square, X, Send, Smartphone, Wallet, AlertTriangle,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { formatDistanceToNow, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '../services/firebase';
import { sendAdminPushToProviders } from '../services/adminService';

/** السيرفر يستبعد المزود من التوزيع إذا كان موقعه أقدم من 30 دقيقة (functions: MAX_PROVIDER_LOCATION_AGE_MINUTES) */
const DISPATCH_STALE_MIN = 30;

const PERIODS = [
  { value: 30, label: 'أكثر من 30 دقيقة' },
  { value: 180, label: 'أكثر من 3 ساعات' },
  { value: 1440, label: 'أكثر من 24 ساعة' },
  { value: 4320, label: 'أكثر من 3 أيام' },
  { value: 10080, label: 'أكثر من أسبوع' },
  { value: 43200, label: 'أكثر من شهر' },
];

const STATUS_META = {
  ghost: { label: 'متاح بالاسم — لا تصله طلبات', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  auto: { label: 'متوقف تلقائياً (انقطع الموقع)', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  manual: { label: 'أوقف نفسه', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  balance: { label: 'متوقف — رصيد غير كافٍ', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  never: { label: 'لم يرسل موقعاً أبداً', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
};

/** حالات تظهر في البحث فقط (البحث يشمل كل المزودين) */
const SEARCH_ONLY_STATUS_META = {
  active: { label: 'نشط — تصله الطلبات', cls: 'bg-green-100 text-green-700 border-green-200' },
  not_approved: { label: 'غير معتمد', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  disabled: { label: 'حساب معطّل', cls: 'bg-red-100 text-red-700 border-red-200' },
};
const ALL_STATUS_META = { ...STATUS_META, ...SEARCH_ONLY_STATUS_META };

const approvalOf = (p) =>
  p.approvalStatus || (['pending', 'approved', 'rejected'].includes(p.status) ? p.status : null);

const PUSH_TEMPLATES = [
  {
    id: 'stale',
    label: 'توقف الموقع',
    title: 'توقفت عن استقبال الطلبات',
    message: 'توقفت عن استقبال الطلبات لأن جوالك أوقف التطبيق — افتح التطبيق واضغط متاح',
  },
  {
    id: 'battery',
    label: 'إعدادات البطارية',
    title: 'لا تفوتك الطلبات',
    message: 'حتى تصلك الطلبات باستمرار: إعدادات الجوال ← التطبيقات ← فزاعين ← البطارية ← بدون قيود، والموقع ← السماح طوال الوقت',
  },
  {
    id: 'demand',
    label: 'طلبات قريبة',
    title: 'فيه طلبات قريبة منك',
    message: 'العملاء يطلبون في منطقتك الآن — افتح فزاعين واضغط متاح لتصلك الطلبات',
  },
];

const DEFAULT_WA_TEXT =
  'السلام عليكم {name}، معك فريق فزاعين. لاحظنا أن التطبيق متوقف عندك ولا تصلك الطلبات.\n' +
  '1) افتح التطبيق واضغط «متاح»\n' +
  '2) إعدادات الجوال ← التطبيقات ← فزاعين ← البطارية ← «بدون قيود»\n' +
  '3) الموقع ← «السماح طوال الوقت»\n' +
  '4) لا تقفل التطبيق بالسحب من قائمة التطبيقات المفتوحة';
const WA_TEXT_KEY = 'inactive_providers_wa_text';

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (v.toMillis) return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

const providerName = (p) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || p.name || 'بدون اسم';
const providerCityLabel = (p) => p.cityName || p.city || 'غير محدد';
const localPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return `0${digits.slice(3)}`;
  return digits.startsWith('0') ? digits : `0${digits}`;
};
const intlPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return digits;
  return `966${digits.replace(/^0/, '')}`;
};
const ago = (ms) => (ms ? formatDistanceToNow(new Date(ms), { addSuffix: true, locale: ar }) : '—');
const fullDate = (ms) => (ms ? format(new Date(ms), 'yyyy/MM/dd HH:mm') : '—');
const platformLabel = (p) => (p.pushPlatform === 'ios' ? 'آيفون' : p.pushPlatform === 'android' ? 'أندرويد' : 'غير معروف');

function classify(p, now) {
  const locationMs = toMs(p.locationUpdatedAt);
  const heartbeatMs = toMs(p.lastHeartbeat);
  const lastSeenMs = Math.max(locationMs, heartbeatMs);
  const staleMin = locationMs ? (now - locationMs) / 60000 : Infinity;
  let status;
  if (approvalOf(p) !== 'approved') status = 'not_approved';
  else if (p.isActive === false) status = 'disabled';
  else if (!locationMs) status = 'never';
  else if (staleMin <= DISPATCH_STALE_MIN) status = 'active';
  else if (p.availabilityStatus === 'available' || (!p.availabilityStatus && p.isOnline === true)) status = 'ghost';
  else if (p.offlineReason === 'stale_heartbeat') status = 'auto';
  else if (p.offlineReason === 'insufficient_balance') status = 'balance';
  else status = 'manual';
  return { locationMs, heartbeatMs, lastSeenMs, staleMin, status };
}

export const InactiveProviders = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [reloadKey, setReloadKey] = useState(0);

  const [period, setPeriod] = useState(30);
  const [statusFilter, setStatusFilter] = useState('actionable');
  const [cityFilter, setCityFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const [pushOpen, setPushOpen] = useState(false);
  const [pushTargets, setPushTargets] = useState([]);
  const [pushTitle, setPushTitle] = useState(PUSH_TEMPLATES[0].title);
  const [pushMessage, setPushMessage] = useState(PUSH_TEMPLATES[0].message);
  const [pushSending, setPushSending] = useState(false);
  const [toast, setToast] = useState(null);

  const [waText, setWaText] = useState(() => {
    try { return localStorage.getItem(WA_TEXT_KEY) || DEFAULT_WA_TEXT; } catch (_) { return DEFAULT_WA_TEXT; }
  });
  const [waEditOpen, setWaEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // كل المزودين — البحث يشملهم جميعاً، والقائمة الافتراضية تُفلتر للمعتمدين غير النشطين
        const snap = await getDocs(collection(db, 'providers'));
        if (cancelled) return;
        setProviders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadedAt(Date.now());
      } catch (e) {
        console.error('InactiveProviders load:', e);
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const allRows = useMemo(
    () => providers.map((p) => ({ ...p, ...classify(p, loadedAt) })),
    [providers, loadedAt]
  );
  const rows = useMemo(() => allRows.filter((r) => STATUS_META[r.status]), [allRows]);

  const counts = useMemo(() => {
    const c = { all: rows.length, ghost: 0, auto: 0, manual: 0, balance: 0, never: 0 };
    rows.forEach((r) => { c[r.status] += 1; });
    return c;
  }, [rows]);

  const cityOptions = useMemo(() => [...new Set(rows.map((r) => providerCityLabel(r)))].sort(), [rows]);

  const searchQuery = search.trim().toLowerCase();
  const searching = searchQuery.length > 0;

  const visible = useMemo(() => {
    const q = searchQuery;
    const qDigits = q.replace(/\D/g, '').replace(/^0/, '');
    const matches = (r) => {
      const nameHit = providerName(r).toLowerCase().includes(q);
      const phoneHit = qDigits.length >= 3 && String(r.phone || '').includes(qDigits);
      return nameHit || phoneHit;
    };
    // البحث يتجاهل كل الفلاتر ويشمل كل المزودين (نشط، غير نشط، غير معتمد، معطّل)
    const list = searching ? allRows.filter(matches) : rows.filter((r) => {
      if (r.staleMin < period) return false;
      if (statusFilter === 'actionable' && !['ghost', 'auto'].includes(r.status)) return false;
      if (!['all', 'actionable'].includes(statusFilter) && r.status !== statusFilter) return false;
      if (cityFilter !== 'all' && providerCityLabel(r) !== cityFilter) return false;
      if (platformFilter !== 'all' && (r.pushPlatform || 'unknown') !== platformFilter) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sortBy === 'oldest') return a.locationMs - b.locationMs;
      if (sortBy === 'balance') return (Number(b.wallet?.balance) || 0) - (Number(a.wallet?.balance) || 0);
      return b.locationMs - a.locationMs;
    });
  }, [allRows, rows, searching, searchQuery, period, statusFilter, cityFilter, platformFilter, sortBy]);

  const visibleIds = visible.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedRows = visible.filter((r) => selected.has(r.id));

  const toggleOne = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    return next;
  });

  const openWhatsApp = (r) => {
    const text = waText.replace(/\{name\}/g, providerName(r).split(' ')[0] || '');
    window.open(`https://wa.me/${intlPhone(r.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const copyText = async (text, okMsg) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: 'ok', text: okMsg });
    } catch (_) {
      setToast({ type: 'err', text: 'تعذر النسخ' });
    }
  };

  const openPush = (targets) => {
    setPushTargets(targets);
    setPushOpen(true);
  };

  const sendPush = async () => {
    setPushSending(true);
    try {
      const res = await sendAdminPushToProviders({
        title: pushTitle,
        message: pushMessage,
        providerIds: pushTargets.map((r) => r.id),
        source: 'inactive_providers',
      });
      setToast({ type: 'ok', text: `تم إرسال الإشعار إلى ${res.count} مزود` });
      setPushOpen(false);
      setSelected(new Set());
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'فشل الإرسال' });
    } finally {
      setPushSending(false);
    }
  };

  const exportCsv = () => {
    const header = ['الاسم', 'الجوال', 'المدينة', 'الجهاز', 'الحالة', 'آخر تحديث موقع', 'آخر اتصال للتطبيق', 'آخر تغيير حالة', 'آخر تسجيل دخول', 'الرصيد', 'تذكيرات تلقائية'];
    const lines = visible.map((r) => [
      providerName(r), localPhone(r.phone), providerCityLabel(r), platformLabel(r), ALL_STATUS_META[r.status].label,
      fullDate(r.locationMs), fullDate(r.heartbeatMs), fullDate(toMs(r.statusUpdatedAt)), fullDate(toMs(r.lastLoginAt)),
      Number(r.wallet?.balance) || 0, Number(r.staleLocationPushCount) || 0,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([`﻿${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inactive-providers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectCls =
    'w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer';

  const statTiles = [
    { key: 'actionable', label: 'يحتاجون تواصل', value: counts.ghost + counts.auto, cls: 'text-rose-600' },
    { key: 'ghost', label: 'متاح بالاسم', value: counts.ghost, cls: 'text-amber-600' },
    { key: 'auto', label: 'متوقف تلقائياً', value: counts.auto, cls: 'text-rose-600' },
    { key: 'manual', label: 'أوقف نفسه', value: counts.manual, cls: 'text-gray-700' },
    { key: 'all', label: 'الكل', value: counts.all, cls: 'text-gray-900' },
  ];

  const pushWithToken = pushTargets.filter((r) => r.pushToken).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">المزودون غير النشطين</h1>
            <p className="text-sm text-gray-500">
              مزودون معتمدون موقعهم لم يتحدث منذ أكثر من {DISPATCH_STALE_MIN} دقيقة — لا تصلهم طلبات
            </p>
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statTiles.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`bg-white rounded-2xl border p-3 text-right transition ${statusFilter === t.key ? 'border-teal-400 ring-2 ring-teal-100' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className={`text-2xl font-black ${t.cls}`}>{loading ? '—' : t.value}</div>
            <div className="text-xs font-bold text-gray-500 mt-0.5">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الجوال"
            className="w-full pr-9 pl-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
          />
          {searching && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label="مسح البحث">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searching && (
          <div className="text-xs font-bold text-teal-700 bg-teal-50 rounded-xl px-3 py-2">
            البحث يشمل كل المزودين ({allRows.length}) بكل الحالات — الفلاتر لا تُطبّق أثناء البحث
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-5 gap-3 ${searching ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="relative">
            <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className={selectCls}>
              {PERIODS.map((p) => <option key={p.value} value={p.value}>آخر موقع: {p.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="actionable">يحتاجون تواصل (متاح بالاسم + متوقف تلقائياً)</option>
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
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
          <div className="relative">
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className={selectCls}>
              <option value="all">كل الأجهزة</option>
              <option value="android">أندرويد</option>
              <option value="ios">آيفون</option>
              <option value="unknown">غير معروف</option>
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls}>
              <option value="recent">الأحدث انقطاعاً أولاً</option>
              <option value="oldest">الأقدم انقطاعاً أولاً</option>
              <option value="balance">الأعلى رصيداً أولاً</option>
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={toggleAllVisible} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 hover:border-teal-300">
            {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-teal-600" /> : <Square className="w-4 h-4" />}
            تحديد الكل ({visible.length})
          </button>
          <button
            disabled={selectedRows.length === 0}
            onClick={() => openPush(selectedRows)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-40"
          >
            <Bell className="w-4 h-4" /> إشعار للمحددين ({selectedRows.length})
          </button>
          <button
            disabled={selectedRows.length === 0}
            onClick={() => copyText(selectedRows.map((r) => localPhone(r.phone)).join('\n'), `تم نسخ ${selectedRows.length} رقم`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 disabled:opacity-40"
          >
            <Copy className="w-4 h-4" /> نسخ الأرقام
          </button>
          <button onClick={exportCsv} disabled={visible.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 disabled:opacity-40">
            <Download className="w-4 h-4" /> تصدير Excel
          </button>
          <button onClick={() => setWaEditOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-green-200 text-sm font-bold text-green-700">
            <MessageCircle className="w-4 h-4" /> نص رسالة الواتساب
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-500 font-semibold">
          {searching ? 'لا يوجد مزود بهذا الاسم أو الرقم' : 'لا يوجد مزودون بهذه الفلاتر 👍'}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">يعرض <span className="font-black text-gray-900">{visible.length}</span> مزود</div>
          {visible.map((r) => {
            const open = expanded === r.id;
            const meta = ALL_STATUS_META[r.status];
            const checked = selected.has(r.id);
            const lat = r.location?.latitude;
            const lng = r.location?.longitude;
            const details = [
              ['آخر تحديث للموقع', r.locationMs],
              ['آخر اتصال للتطبيق بالسيرفر', r.heartbeatMs],
              ['آخر تغيير حالة (فتح التطبيق يدوياً)', toMs(r.statusUpdatedAt)],
              ['آخر تسجيل دخول', toMs(r.lastLoginAt)],
              ['إيقاف تلقائي من السيرفر', toMs(r.autoOfflineAt)],
              ['آخر تذكير تلقائي (بوش)', toMs(r.staleLocationPushAt)],
              ['تاريخ التسجيل', toMs(r.createdAt)],
            ];
            return (
              <div key={r.id} className={`bg-white rounded-2xl border overflow-hidden ${checked ? 'border-teal-300' : 'border-gray-100'}`}>
                <div className="p-4 flex items-start gap-3">
                  <button onClick={() => toggleOne(r.id)} className="mt-1 text-gray-400 hover:text-teal-600" aria-label="تحديد">
                    {checked ? <CheckSquare className="w-5 h-5 text-teal-600" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-gray-900">{providerName(r)}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /><span dir="ltr">{localPhone(r.phone)}</span></span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{providerCityLabel(r)}</span>
                      <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" />{platformLabel(r)}</span>
                      <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />{Number(r.wallet?.balance) || 0} ر.س</span>
                      <span className={`flex items-center gap-1 font-bold ${r.status === 'active' ? 'text-green-700' : 'text-rose-600'}`}>
                        <Clock className="w-3.5 h-3.5" />
                        آخر موقع {r.locationMs ? ago(r.locationMs) : 'لا يوجد'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => openWhatsApp(r)} className="p-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100" title="واتساب">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <a href={`tel:+${intlPhone(r.phone)}`} className="p-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100" title="اتصال">
                      <Phone className="w-4 h-4" />
                    </a>
                    <button onClick={() => openPush([r])} className="p-2 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100" title="إشعار">
                      <Bell className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExpanded(open ? null : r.id)} className="p-2 rounded-xl text-gray-400 hover:text-gray-700" title="التفاصيل">
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {details.map(([label, ms]) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-bold text-gray-800 text-left">
                          {ms ? <>{ago(ms)} <span className="text-xs text-gray-400 font-normal" dir="ltr">({fullDate(ms)})</span></> : '—'}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">حالة التطبيق آخر مرة</span>
                      <span className="font-bold text-gray-800">{r.clientAppState === 'active' ? 'مفتوح' : r.clientAppState === 'background' ? 'في الخلفية' : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">الإشعارات</span>
                      <span className={`font-bold ${r.pushToken && r.pushNotificationsEnabled !== false ? 'text-green-700' : 'text-rose-600'}`}>
                        {r.pushToken && r.pushNotificationsEnabled !== false ? 'مفعّلة' : 'لا تصله إشعارات'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">تذكيرات تلقائية أُرسلت</span>
                      <span className="font-bold text-gray-800">{Number(r.staleLocationPushCount) || 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-500">الخدمات</span>
                      <span className="font-bold text-gray-800 truncate">{Object.keys(r.services || {}).length} خدمة</span>
                    </div>
                    {lat && lng && (
                      <a
                        href={`https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sm:col-span-2 flex items-center gap-1.5 text-teal-700 font-bold"
                      >
                        <MapPin className="w-4 h-4" /> آخر موقع معروف على الخريطة
                      </a>
                    )}
                    {r.status === 'never' && (
                      <div className="sm:col-span-2 flex items-center gap-1.5 text-amber-700 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4" /> لم يرسل التطبيق أي موقع — غالباً لم يمنح إذن الموقع أو لم يفعّل نفسه أبداً
                      </div>
                    )}
                    <button
                      onClick={() => copyText(localPhone(r.phone), 'تم نسخ الرقم')}
                      className="sm:col-span-2 flex items-center gap-1.5 text-gray-600 font-bold text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> نسخ الرقم
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pushOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !pushSending && setPushOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">إشعار مخصص</h2>
              <button onClick={() => setPushOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-sm text-gray-600">
              إلى <span className="font-black text-gray-900">{pushTargets.length}</span> مزود
              {pushTargets.length === 1 && <> — {providerName(pushTargets[0])}</>}
              {pushWithToken < pushTargets.length && (
                <div className="text-xs text-amber-700 font-bold mt-1">
                  {pushTargets.length - pushWithToken} منهم بدون رمز إشعارات — يصلهم في صندوق الإشعارات داخل التطبيق فقط
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PUSH_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setPushTitle(t.title); setPushMessage(t.message); }}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-xs font-bold text-gray-700 hover:bg-teal-50 hover:text-teal-700"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              placeholder="العنوان"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-teal-400"
            />
            <textarea
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
              rows={4}
              placeholder="نص الإشعار"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
            />
            <button
              onClick={sendPush}
              disabled={pushSending || !pushTitle.trim() || !pushMessage.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white font-black disabled:opacity-50"
            >
              {pushSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال
            </button>
          </div>
        </div>
      )}

      {waEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setWaEditOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">نص رسالة الواتساب</h2>
              <button onClick={() => setWaEditOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">اكتب <span dir="ltr" className="font-bold">{'{name}'}</span> ليُستبدل باسم المزود. يُحفظ على هذا المتصفح.</p>
            <textarea
              value={waText}
              onChange={(e) => setWaText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  try { localStorage.setItem(WA_TEXT_KEY, waText); } catch (_) {}
                  setWaEditOpen(false);
                  setToast({ type: 'ok', text: 'تم حفظ نص الرسالة' });
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-black"
              >
                حفظ
              </button>
              <button onClick={() => setWaText(DEFAULT_WA_TEXT)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold">
                النص الافتراضي
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${toast.type === 'ok' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};
