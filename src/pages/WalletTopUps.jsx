import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Search,
  Eye,
  RefreshCw,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  Copy,
  Wallet,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { providerOrdersPath } from '../utils/providerLinks';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  getWalletTopUps,
  findWalletTopUpsByReference,
  getProviderWalletTopUps,
  watchWalletTopUpChanges,
  getTopUpStateMeta,
  WALLET_TOPUP_STATES,
} from '../services/walletTopupsService';
import { WalletPackagesManager } from '../components/WalletPackagesManager';
import { DailySettlementSummary } from '../components/DailySettlementSummary';
import { RepairTopupReferences } from '../components/RepairTopupReferences';
import { relatedTopUps, topUpCaseVerdict } from '../utils/topUpCase';

const formatDt = (value) => {
  if (!value) return '—';
  try {
    return format(value instanceof Date ? value : new Date(value), 'dd MMM yyyy، HH:mm', { locale: ar });
  } catch {
    return '—';
  }
};

const VERDICT_STYLES = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warn: 'bg-amber-50 border-amber-200 text-amber-800',
  bad: 'bg-red-50 border-red-200 text-red-800',
};

/** ملف حالة: كل عمليات المزود حول العملية التي بحث عنها الأدمن + حكم واضح */
const TopUpCaseCard = ({ caseData, onSelect }) => {
  const { match, related, verdict } = caseData;
  return (
    <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-gray-900">
          ملف الحالة: {match.providerName}
          <span className="text-gray-500 font-normal text-sm mr-2" dir="ltr">{match.providerPhone}</span>
        </div>
        {match.providerId && (
          <Link to={providerOrdersPath(match.providerId)} className="text-xs font-bold text-teal-700 hover:underline">
            صفحة المزود
          </Link>
        )}
      </div>
      {verdict && (
        <div className={`rounded-xl border px-3 py-2 text-sm font-bold ${VERDICT_STYLES[verdict.tone]}`}>{verdict.text}</div>
      )}
      <div className="text-xs text-gray-500">عمليات المزود خلال 24 ساعة من العملية:</div>
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
        {related.map((row) => {
          const meta = getTopUpStateMeta(row.state);
          const isMatch = row.id === match.id;
          const isPaidMatch = verdict?.paidRow?.id === row.id && !isMatch;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className={`w-full text-right px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs hover:bg-gray-50 ${isMatch ? 'bg-teal-50' : ''}`}
            >
              <span className="text-gray-700 min-w-[9rem]">{formatDt(row.createdAt)}</span>
              <span className={`px-2 py-0.5 rounded-full font-bold ${meta.color}`}>{meta.label}</span>
              <span className="font-bold text-gray-800">{row.amount} ر.س</span>
              <span className="font-mono text-gray-600" dir="ltr">{row.trackId || row.referenceNumber || row.id}</span>
              {row.ref && <span className="font-mono text-gray-500" dir="ltr">RRN {row.ref}</span>}
              {isMatch && <span className="font-bold text-teal-700">← الرقم الذي بحثت عنه</span>}
              {isPaidMatch && <span className="font-bold text-emerald-700">← الشحن الناجح</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, colorClass }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <div className={`text-2xl font-black mb-1 ${colorClass || 'text-gray-800'}`}>{value}</div>
    <div className="text-sm text-gray-500">{label}</div>
    {sub ? <div className="text-xs text-gray-400 mt-1">{sub}</div> : null}
  </div>
);

const StateBadge = ({ state }) => {
  const meta = getTopUpStateMeta(state);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
};

/** شحن الإدارة (رصيد يدوي/تعويض) يُسجَّل بـ source='admin_panel' — الباقي دفع فعلي عبر بوابة البنك */
const isAdminTopUp = (r) => r?.source === 'admin_panel';

const TOPUPS_LOAD_LIMIT = 300;

const SOURCE_FILTERS = [
  { key: 'all', label: 'كل المصادر' },
  { key: 'bank', label: 'عبر البنك (دفع فعلي)' },
  { key: 'admin', label: 'من الإدارة' },
];

const copyText = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(String(text));
  } catch (_) {
    /* ignore */
  }
};

export default function WalletTopUps() {
  const loadVersion = useRef(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [stateFilter, setStateFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);
  // نتائج البحث المباشر في Firestore بالرقم المرجعي (العملية قد تكون خارج آخر 300 محمّلة)
  const [referenceMatches, setReferenceMatches] = useState({ term: '', rows: [] });
  const [referenceSearching, setReferenceSearching] = useState(false);
  const [topUpCase, setTopUpCase] = useState(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      // نجلب الكل ثم نفلتر محلياً لتجنب الاعتماد على فهرس مركّب لكل حالة
      const data = await getWalletTopUps({ state: 'all', max: TOPUPS_LOAD_LIMIT });
      if (version === loadVersion.current) {
        setRows(data);
        setSelected((current) => current ? data.find((row) => row.id === current.id) || current : null);
      }
    } catch (e) {
      if (version !== loadVersion.current) return;
      console.error('WalletTopUps load:', e);
      setLoadError(e?.message || 'فشل تحميل عمليات الشحن');
      setRows([]);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = watchWalletTopUpChanges(load, (e) => { setLoadError(e.message); setLoading(false); });
    return () => { loadVersion.current++; unsubscribe(); };
  }, [load]);

  const sourceRows = useMemo(() => {
    if (sourceFilter === 'bank') return rows.filter((r) => !isAdminTopUp(r));
    if (sourceFilter === 'admin') return rows.filter(isAdminTopUp);
    return rows;
  }, [rows, sourceFilter]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 6) {
      setReferenceMatches({ term: '', rows: [] });
      setReferenceSearching(false);
      return undefined;
    }
    let cancelled = false;
    setReferenceSearching(true);
    const timer = setTimeout(() => {
      findWalletTopUpsByReference(term)
        .then((found) => { if (!cancelled) setReferenceMatches({ term, rows: found }); })
        .catch((e) => console.warn('findWalletTopUpsByReference:', e?.message || e))
        .finally(() => { if (!cancelled) setReferenceSearching(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm]);

  // رقم مرجعي مطابق لعملية واحدة → ملف حالة لمزودها (يحل «أرسل أرقام المحاولة الفاشلة»)
  useEffect(() => {
    const providerIds = [...new Set(referenceMatches.rows.map((r) => r.providerId).filter(Boolean))];
    const match = referenceMatches.rows[0];
    if (providerIds.length !== 1 || !match) {
      setTopUpCase(null);
      return undefined;
    }
    let cancelled = false;
    getProviderWalletTopUps(providerIds[0])
      .then((providerRows) => {
        if (cancelled) return;
        const related = relatedTopUps(match, providerRows.some((r) => r.id === match.id) ? providerRows : [match, ...providerRows]);
        setTopUpCase({ term: referenceMatches.term, match, related, verdict: topUpCaseVerdict(match, related) });
      })
      .catch((e) => console.warn('getProviderWalletTopUps:', e?.message || e));
    return () => { cancelled = true; };
  }, [referenceMatches]);

  const filtered = useMemo(() => {
    let list = sourceRows;
    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm && referenceMatches.term === trimmedTerm && referenceMatches.rows.length) {
      const loadedIds = new Set(list.map((r) => r.id));
      const extra = referenceMatches.rows.filter((r) => !loadedIds.has(r.id)
        && (sourceFilter === 'all' || (sourceFilter === 'admin') === isAdminTopUp(r)));
      list = [...extra, ...list];
    }
    if (stateFilter !== 'all') {
      list = list.filter((r) => String(r.state || '').toUpperCase() === stateFilter);
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((r) => {
        // رقم الجوال: مطابقة آخر 9 أرقام حتى يعمل 05… و 9665… و +966…
        const termDigits = term.replace(/\D/g, '');
        const phoneDigits = String(r.providerPhone || '').replace(/\D/g, '');
        if (termDigits.length >= 6 && phoneDigits && phoneDigits.slice(-9).includes(termDigits.slice(-9))) {
          return true;
        }
        const hay = [
          r.id,
          r.referenceNumber,
          r.reason,
          r.providerName,
          r.providerPhone,
          r.providerId,
          r.trackId,
          r.paymentId,
          r.transId,
          r.ref,
          r.packageId,
          r.gatewayResult,
          r.gatewayError,
          r.gatewayErrorText,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      });
    }
    return list;
  }, [sourceRows, stateFilter, searchTerm, referenceMatches, sourceFilter]);

  // الإحصائيات تتبع فلتر المصدر — «مبالغ ناجحة» مع «عبر البنك» = ما دفعه المزودون فعلاً
  const stats = useMemo(() => {
    const rows = sourceRows;
    const paid = rows.filter((r) => String(r.state).toUpperCase() === 'PAID');
    const failed = rows.filter((r) =>
      ['FAILED', 'CANCELLED', 'VOIDED'].includes(String(r.state || '').toUpperCase())
    );
    const pending = rows.filter((r) =>
      ['CREATED', 'PENDING_PAYMENT', 'PROCESSING'].includes(String(r.state || '').toUpperCase())
    );
    const paidAmount = paid.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const paidCredits = paid.reduce((s, r) => s + (Number(r.serviceCredits) || 0), 0);
    return {
      total: rows.length,
      paid: paid.length,
      failed: failed.length,
      pending: pending.length,
      paidAmount,
      paidCredits,
    };
  }, [sourceRows]);

  const FILTERS = [
    { key: 'all', label: 'الكل' },
    { key: 'PAID', label: 'مدفوع' },
    { key: 'COMPENSATED', label: 'تعويض إداري' },
    { key: 'PENDING_PAYMENT', label: 'بانتظار الدفع' },
    { key: 'PROCESSING', label: 'قيد المعالجة' },
    { key: 'FAILED', label: 'فشل' },
    { key: 'CANCELLED', label: 'ملغي' },
    { key: 'CREATED', label: 'أُنشئت' },
    { key: 'VOIDED', label: 'Void' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
        للمطابقة مع neoleap: مرجع فزّاعين (FZ…) يُرسل للبوابة كـ Track ID وهو الأسهل للبحث. Trans ID في العمليات السابقة خُزّن مقرّباً (آخر خانتين أو ثلاث مختلفة عن البوابة) فلا تعتمد عليه فيها؛ يطابق البوابة في العمليات بعد تحديث الربط. RRN رقم شبكة البطاقات (مدى/فيزا) ويظهر في تفاصيل العملية وكشف البنك.
        حالة «مدفوع / مشحون» تعني تأكيد الدفع وإضافة الرصيد، ولا تؤكد وصول التسوية للحساب البنكي. المبلغ هنا قبل رسوم البنك.
      </div>
      <RepairTopupReferences />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">عمليات شحن المزودين</h1>
          <p className="text-gray-500 mt-1 text-sm">
            كل عمليات الدفع عبر بوابة الراجحي / Neoleap — ناجحة وفاشلة ومعلّقة مع المعرّفات والتواريخ
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <WalletPackagesManager />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="إجمالي العمليات" value={stats.total} />
        <StatCard label="مدفوعة / مشحونة" value={stats.paid} colorClass="text-emerald-600" />
        <StatCard label="معلّقة" value={stats.pending} colorClass="text-amber-600" />
        <StatCard label="فاشلة / ملغاة" value={stats.failed} colorClass="text-red-600" />
        <StatCard
          label="مبالغ ناجحة"
          value={`${stats.paidAmount.toLocaleString('ar-SA')}`}
          sub="ر.س"
          colorClass="text-teal-700"
        />
        <StatCard label="خدمات مشحونة" value={stats.paidCredits} colorClass="text-indigo-600" />
      </div>

      <DailySettlementSummary rows={rows} rowsLimit={TOPUPS_LOAD_LIMIT} onSelect={setSelected} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالجوال أو أي رقم مرجعي: RRN · Track ID · Payment ID · Trans ID…"
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setSourceFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                sourceFilter === f.key
                  ? f.key === 'admin' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStateFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                stateFilter === f.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.key !== 'all' && WALLET_TOPUP_STATES[f.key] ? '' : ''}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {topUpCase && topUpCase.term === searchTerm.trim() && <TopUpCaseCard caseData={topUpCase} onSelect={setSelected} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            جاري تحميل عمليات الشحن...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            {referenceSearching ? 'جاري البحث في كل العمليات…' : 'لا توجد عمليات مطابقة'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold">التاريخ</th>
                  <th className="px-4 py-3 font-bold">المزود</th>
                  <th className="px-4 py-3 font-bold">الباقة</th>
                  <th className="px-4 py-3 font-bold">المبلغ</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                  <th className="px-4 py-3 font-bold">نتيجة البنك</th>
                  <th className="px-4 py-3 font-bold">مراجع العملية</th>
                  <th className="px-4 py-3 font-bold">تفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      <div className="font-semibold">{formatDt(row.createdAt)}</div>
                      {row.paidAt ? (
                        <div className="text-[11px] text-emerald-600 mt-0.5">شُحن: {formatDt(row.paidAt)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {row.providerId ? (
                        <Link
                          to={providerOrdersPath(row.providerId)}
                          className="font-bold text-gray-800 hover:text-teal-700 hover:underline"
                          title="ملف المزود — الطلبات المنفذة وتفاصيلها"
                        >
                          {row.providerName || '—'}
                        </Link>
                      ) : (
                        <div className="font-bold text-gray-800">{row.providerName}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-0.5" dir="ltr">
                        {row.providerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">
                        {row.serviceCredits != null ? `${row.serviceCredits} خدمات` : '—'}
                      </div>
                      {row.source === 'admin_panel' ? (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                          {row.adjustmentType === 'compensation' ? 'تعويض من الإدارة' : 'شحن من الإدارة'}
                        </span>
                      ) : (
                        <div className="text-[11px] text-gray-400">{row.packageId || '—'}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-black text-gray-900 whitespace-nowrap">
                      {row.amount != null ? `${Number(row.amount).toLocaleString('ar-SA')} ر.س` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={row.state} />
                    </td>
                    <td className="px-4 py-3">
                      {row.gatewayResult ? (
                        <span
                          className={`font-mono text-xs font-bold ${
                            String(row.gatewayResult).toUpperCase() === 'CAPTURED'
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {row.gatewayResult}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {row.gatewayError ? (
                        <div className="text-[10px] text-red-500 mt-1 max-w-[140px] truncate" title={row.gatewayErrorText || row.gatewayError}>
                          {row.gatewayError}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                      <div className="text-gray-400">مرجع فزّاعين</div>
                      <div className="flex items-center gap-1" dir="ltr">
                        <span className="truncate max-w-[120px]" title={row.trackId || ''}>
                          {row.trackId || '—'}
                        </span>
                        {row.trackId ? (
                          <button type="button" onClick={() => copyText(row.trackId)} className="text-gray-400 hover:text-teal-600">
                            <Copy className="w-3 h-3" />
                          </button>
                        ) : null}
                      </div>
                      <div className="truncate max-w-[140px] text-gray-400 mt-0.5" title={row.paymentId || ''}>
                        معرّف الدفع: {row.paymentId || '—'}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-gray-800" dir="ltr">
                        <span>RRN: {row.ref || '—'}</span>
                        {row.ref ? (
                          <button type="button" onClick={() => copyText(row.ref)} className="text-gray-400 hover:text-teal-600">
                            <Copy className="w-3 h-3" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">تفاصيل عملية الشحن</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{selected.id}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge state={selected.state} />
                {selected.gatewayResult ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    <CreditCard className="w-3.5 h-3.5" />
                    {selected.gatewayResult}
                  </span>
                ) : null}
              </div>

              {selected.providerId ? (
                <Link
                  to={providerOrdersPath(selected.providerId)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
                >
                  <UserRound className="w-4 h-4" />
                  فتح ملف المزود — الطلبات المنفذة وتفاصيلها
                </Link>
              ) : null}

              <DetailGrid
                items={[
                  { label: 'المزود', value: selected.providerName },
                  { label: 'الهاتف', value: selected.providerPhone, ltr: true },
                  { label: 'معرّف المزود', value: selected.providerId, mono: true },
                  { label: 'الباقة', value: selected.packageId },
                  {
                    label: 'عدد الخدمات',
                    value: selected.serviceCredits != null ? String(selected.serviceCredits) : '—',
                  },
                  {
                    label: 'المبلغ',
                    value: selected.amount != null ? `${selected.amount} ر.س` : '—',
                  },
                  { label: 'مرجع الشحن في فزّاعين', value: selected.referenceNumber || selected.trackId, mono: true, copy: true },
                  ...(selected.source === 'admin_panel'
                    ? [
                        { label: 'نوع العملية', value: selected.adjustmentType === 'compensation' ? 'تعويض من الإدارة' : 'شحن من الإدارة' },
                        { label: 'السبب', value: selected.reason || '—' },
                        { label: 'بواسطة', value: selected.adminEmail || '—', ltr: true },
                      ]
                    : []),
                  { label: 'معرّف الدفع Payment ID', value: selected.paymentId, mono: true, copy: true },
                  { label: 'معرّف عملية البوابة Trans ID', value: selected.transId, mono: true, copy: true },
                  { label: 'الرقم المرجعي RRN (Ref)', value: selected.ref, mono: true, copy: true },
                  { label: 'تاريخ الإنشاء', value: formatDt(selected.createdAt) },
                  { label: 'آخر تحديث', value: formatDt(selected.updatedAt) },
                  { label: 'وقت الشحن', value: formatDt(selected.paidAt) },
                  { label: 'مصدر آخر تحديث', value: selected.lastSource || '—' },
                  { label: 'خطأ البوابة', value: selected.gatewayError || '—' },
                  { label: 'نص الخطأ', value: selected.gatewayErrorText || '—' },
                  {
                    label: 'الخدمات قبل/بعد',
                    value:
                      selected.previousTotalServices != null || selected.newTotalServices != null
                        ? `${selected.previousTotalServices ?? '—'} → ${selected.newTotalServices ?? '—'}`
                        : '—',
                  },
                  { label: 'بوابة الدفع', value: selected.gateway || 'alrajhi' },
                ]}
              />

              {selected.attachment?.url ? (
                <a
                  href={selected.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-100 p-3 text-sm font-bold text-teal-700 hover:bg-teal-100"
                >
                  <CreditCard className="w-4 h-4" />
                  {selected.attachment.type === 'pdf' ? 'عرض المستند المرفق (PDF)' : 'عرض الإيصال المرفق'}
                </a>
              ) : null}

              {selected.paymentUrl ? (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-500 mb-1">رابط صفحة الدفع</p>
                  <p className="text-[11px] font-mono text-slate-700 break-all" dir="ltr">
                    {selected.paymentUrl}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                {String(selected.state).toUpperCase() === 'PAID' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5" /> تم إضافة الرصيد للمحفظة
                  </span>
                ) : null}
                {['FAILED', 'CANCELLED', 'VOIDED'].includes(String(selected.state || '').toUpperCase()) ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                    <XCircle className="w-3.5 h-3.5" /> لم يُشحن الرصيد
                  </span>
                ) : null}
                {['PENDING_PAYMENT', 'PROCESSING', 'CREATED'].includes(String(selected.state || '').toUpperCase()) ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                    <Clock className="w-3.5 h-3.5" /> بانتظار اكتمال / تحقق
                  </span>
                ) : null}
                {selected.gatewayResult === 'CAPTURED' && String(selected.state).toUpperCase() !== 'PAID' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5" /> CAPTURED بدون شحن — يحتاج مراجعة
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailGrid({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
          <div className="text-[11px] font-bold text-gray-400 mb-0.5">{item.label}</div>
          <div className="flex items-start gap-1">
            <div
              className={`text-sm font-semibold text-gray-800 break-all flex-1 ${item.mono ? 'font-mono text-xs' : ''}`}
              dir={item.ltr || item.mono ? 'ltr' : undefined}
            >
              {item.value || '—'}
            </div>
            {item.copy && item.value && item.value !== '—' ? (
              <button
                type="button"
                onClick={() => copyText(item.value)}
                className="text-gray-400 hover:text-teal-600 shrink-0 mt-0.5"
                title="نسخ"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
