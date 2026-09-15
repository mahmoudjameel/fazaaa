import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  getWalletTopUps,
  getTopUpStateMeta,
  WALLET_TOPUP_STATES,
} from '../services/walletTopupsService';

const formatDt = (value) => {
  if (!value) return '—';
  try {
    return format(value instanceof Date ? value : new Date(value), 'dd MMM yyyy، HH:mm', { locale: ar });
  } catch {
    return '—';
  }
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

const copyText = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(String(text));
  } catch (_) {
    /* ignore */
  }
};

export default function WalletTopUps() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [stateFilter, setStateFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // نجلب الكل ثم نفلتر محلياً لتجنب الاعتماد على فهرس مركّب لكل حالة
      const data = await getWalletTopUps({ state: 'all', max: 300 });
      setRows(data);
    } catch (e) {
      console.error('WalletTopUps load:', e);
      setLoadError(e?.message || 'فشل تحميل عمليات الشحن');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (stateFilter !== 'all') {
      list = list.filter((r) => String(r.state || '').toUpperCase() === stateFilter);
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((r) => {
        const hay = [
          r.id,
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
  }, [rows, stateFilter, searchTerm]);

  const stats = useMemo(() => {
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
  }, [rows]);

  const FILTERS = [
    { key: 'all', label: 'الكل' },
    { key: 'PAID', label: 'مدفوع' },
    { key: 'PENDING_PAYMENT', label: 'بانتظار الدفع' },
    { key: 'PROCESSING', label: 'قيد المعالجة' },
    { key: 'FAILED', label: 'فشل' },
    { key: 'CANCELLED', label: 'ملغي' },
    { key: 'CREATED', label: 'أُنشئت' },
    { key: 'VOIDED', label: 'Void' },
  ];

  return (
    <div className="space-y-6">
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث: اسم المزود، الهاتف، Track ID، Payment ID، الباقة..."
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            جاري تحميل عمليات الشحن...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            لا توجد عمليات مطابقة
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
                  <th className="px-4 py-3 font-bold">Track / Payment</th>
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
                      <div className="font-bold text-gray-800">{row.providerName}</div>
                      <div className="text-xs text-gray-500 mt-0.5" dir="ltr">
                        {row.providerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">
                        {row.serviceCredits != null ? `${row.serviceCredits} خدمات` : '—'}
                      </div>
                      <div className="text-[11px] text-gray-400">{row.packageId || '—'}</div>
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
                      <div className="flex items-center gap-1">
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
                        {row.paymentId || '—'}
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
                  { label: 'Track ID', value: selected.trackId, mono: true, copy: true },
                  { label: 'Payment ID', value: selected.paymentId, mono: true, copy: true },
                  { label: 'Trans ID', value: selected.transId, mono: true, copy: true },
                  { label: 'المرجع Ref', value: selected.ref, mono: true },
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
