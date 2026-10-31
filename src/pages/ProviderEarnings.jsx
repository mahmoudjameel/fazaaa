import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Landmark, Loader2, RefreshCw, X } from 'lucide-react';
import { ResponsiveTable } from '../components/ResponsiveTable';
import { getAllProviders } from '../services/adminService';
import {
  createSettlement,
  listProviderEarnings,
  listProviderSettlements,
  reverseSettlement,
  reviewEarning,
} from '../services/membershipsService';

const SETTLEMENT_STATUS = {
  pending_confirmation: 'بانتظار تأكيد المزود',
  confirmed: 'أكد الاستلام',
  disputed: 'اعتراض',
  reversed: 'معكوسة',
};

const inputCls = 'w-full min-w-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';
const primaryCls = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50';
const TABS = [{ id: 'review', label: 'مراجعة اللوحات' }, { id: 'statements', label: 'كشوف المزودين' }, { id: 'settlements', label: 'التسويات' }];

const providerName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ') || p?.name || 'مزود';

const StatementCard = ({ statement, onPaid }) => {
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState({});
  const [transfer, setTransfer] = useState({ transferRef: '', transferDate: '' });
  const [proofFile, setProofFile] = useState(null);
  const [state, setState] = useState({ busy: false, error: '' });
  const payable = statement.earnings.filter((e) => e.status === 'approved' && e.amount > e.paidAmount);
  const allocations = payable
    .map((e) => ({ earningId: e.id, amount: Number(amounts[e.id] ?? (e.amount - e.paidAmount)) }))
    .filter((a) => a.amount > 0);
  const total = allocations.reduce((sum, a) => sum + a.amount, 0);

  const pay = async () => {
    setState({ busy: true, error: '' });
    try {
      await createSettlement({ providerId: statement.providerId, allocations, ...transfer, proofFile });
      await onPaid();
      setState({ busy: false, error: '' });
    } catch (e) {
      console.error(e);
      setState({ busy: false, error: e?.message || 'تعذر تنفيذ الصرف' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full p-4 flex flex-wrap items-center justify-between gap-2 text-right">
        <span className="font-black text-gray-900 min-w-0 break-words">{statement.name}</span>
        <span className="text-sm text-gray-600">مستحق {statement.approved} · مصروف {statement.paid} · <b className="text-gray-900">متبقي {statement.left} ر.س</b></span>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <ResponsiveTable
            rowKey={(e) => e.id}
            rows={statement.earnings}
            empty="لا توجد طلبات."
            columns={[
              { header: 'الطلب', render: (e) => `#${e.orderNumber ?? ''} ${e.serviceName || ''}` },
              { header: 'القيمة', render: (e) => `${e.amount} ر.س` },
              { header: 'المصروف', render: (e) => `${e.paidAmount} ر.س` },
              { header: 'الحالة', render: (e) => ({ pending_review: 'بانتظار المراجعة', approved: 'معتمد', rejected: 'مرفوض' }[e.status]) },
              {
                header: 'يُصرف الآن',
                render: (e) => (e.status === 'approved' && e.amount > e.paidAmount ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label={`مبلغ الطلب ${e.orderNumber}`}
                    value={amounts[e.id] ?? (e.amount - e.paidAmount)}
                    onChange={(event) => setAmounts({ ...amounts, [e.id]: event.target.value })}
                    className={`${inputCls} max-w-[110px]`}
                  />
                ) : '—'),
              },
            ]}
          />
          {payable.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={transfer.transferRef} onChange={(e) => setTransfer({ ...transfer, transferRef: e.target.value })} placeholder="رقم التحويل" className={inputCls} />
                <input type="date" value={transfer.transferDate} onChange={(e) => setTransfer({ ...transfer, transferDate: e.target.value })} aria-label="تاريخ التحويل" className={inputCls} />
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} aria-label="إثبات التحويل" className={inputCls} />
              </div>
              {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
              <button type="button" disabled={state.busy || !proofFile || !transfer.transferRef.trim() || total <= 0} onClick={pay} className={primaryCls}>
                تأكيد صرف {total} ر.س
              </button>
              <p className="text-xs text-gray-500">الصرف لا يعني الاستلام: تبقى التسوية بانتظار تأكيد المزود.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ProviderEarnings = () => {
  const [tab, setTab] = useState('review');
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setFailed(false);
    try {
      const [earnings, settlements, { providers }] = await Promise.all([
        listProviderEarnings(), listProviderSettlements(), getAllProviders(),
      ]);
      setData({ earnings, settlements, providers: new Map(providers.map((p) => [p.id, p])) });
    } catch (e) {
      console.error('ProviderEarnings load:', e);
      setFailed(true);
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (action) => {
    setActionError('');
    try {
      await action();
      await load();
    } catch (e) {
      console.error(e);
      setActionError(e?.message || 'تعذر تنفيذ العملية');
    }
  };

  const statements = useMemo(() => {
    if (!data) return [];
    const byProvider = new Map();
    data.earnings.forEach((earning) => {
      const list = byProvider.get(earning.providerId) || [];
      list.push(earning);
      byProvider.set(earning.providerId, list);
    });
    return [...byProvider.entries()].map(([providerId, earnings]) => {
      const counted = earnings.filter((e) => e.status === 'approved');
      const approved = counted.reduce((sum, e) => sum + e.amount, 0);
      const paid = counted.reduce((sum, e) => sum + e.paidAmount, 0);
      return { providerId, name: providerName(data.providers.get(providerId)), earnings, approved, paid, left: approved - paid };
    }).sort((a, b) => b.left - a.left);
  }, [data]);

  const pendingReview = data?.earnings.filter((e) => e.status === 'pending_review') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0"><Landmark className="w-6 h-6" /></div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">مستحقات المزودين</h1>
            <p className="text-sm text-gray-500">طلبات الباقات فقط. الطلب العادي لا ينشئ مستحقاً على فزاعين</p>
          </div>
        </div>
        <button type="button" onClick={load} aria-label="تحديث" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-teal-600"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap ${tab === t.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>{t.label}</button>
        ))}
      </div>
      {actionError && <p className="text-sm font-bold text-red-600">{actionError}</p>}
      {failed ? (
        <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
          <p className="text-gray-700 font-semibold">تعذر تحميل البيانات.</p>
          <button type="button" onClick={load} className={`${primaryCls} mt-3`}>إعادة المحاولة</button>
        </div>
      ) : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {tab === 'review' && (
            <ResponsiveTable
              rowKey={(e) => e.id}
              rows={pendingReview}
              empty="لا توجد طلبات بانتظار المراجعة."
              columns={[
                { header: 'الطلب', render: (e) => `#${e.orderNumber ?? ''} ${e.serviceName || ''}` },
                { header: 'المزود', render: (e) => providerName(data.providers.get(e.providerId)) },
                { header: 'القيمة', render: (e) => `${e.amount} ر.س` },
                { header: 'اللوحة المسجلة', render: (e) => <b>{e.plateExpected || '—'}</b> },
                {
                  header: 'صورة اللوحة',
                  render: (e) => (e.plateImage ? (
                    <a href={e.plateImage} target="_blank" rel="noreferrer"><img src={e.plateImage} alt={`لوحة الطلب ${e.orderNumber}`} className="w-28 aspect-video object-cover rounded-lg" /></a>
                  ) : <span className="text-red-700 font-bold">لا توجد صورة</span>),
                },
                {
                  header: 'القرار',
                  render: (e) => (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const note = e.plateImage ? '' : window.prompt('لا توجد صورة لوحة. سبب الاعتماد؟');
                          if (e.plateImage || note?.trim()) act(() => reviewEarning({ earningId: e.id, approved: true, note }));
                        }}
                        className={primaryCls}
                      >
                        <Check className="w-4 h-4" /> مطابقة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const note = window.prompt('سبب الرفض (القرار نهائي ولا يُصرف للمزود)');
                          if (note?.trim()) act(() => reviewEarning({ earningId: e.id, approved: false, note }));
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-red-200 text-red-700 text-sm font-bold"
                      >
                        <X className="w-4 h-4" /> غير مطابقة
                      </button>
                    </span>
                  ),
                },
              ]}
            />
          )}
          {tab === 'statements' && (
            <div className="space-y-3">
              {statements.length === 0 && <p className="text-sm text-gray-500 text-center py-8">لا توجد مستحقات.</p>}
              {statements.map((s) => <StatementCard key={s.providerId} statement={s} onPaid={load} />)}
            </div>
          )}
          {tab === 'settlements' && (
            <ResponsiveTable
              rowKey={(s) => s.id}
              rows={[...data.settlements].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))}
              empty="لا توجد تسويات."
              columns={[
                { header: 'الرقم', render: (s) => <span dir="ltr">{s.number}</span> },
                { header: 'المزود', render: (s) => providerName(data.providers.get(s.providerId)) },
                { header: 'المبلغ', render: (s) => `${s.total} ر.س` },
                { header: 'الطلبات', render: (s) => s.lines.map((l) => `#${l.orderNumber}`).join('، ') },
                { header: 'التحويل', render: (s) => <a href={s.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 font-bold"><ExternalLink className="w-3.5 h-3.5" />{s.transferRef}</a> },
                { header: 'الحالة', render: (s) => <span><b>{SETTLEMENT_STATUS[s.status]}</b>{s.providerResponse?.note ? <span className="block text-xs text-gray-500">{s.providerResponse.note}</span> : null}</span> },
                { header: 'بواسطة', render: (s) => <span className="break-all">{s.byEmail}</span> },
                {
                  header: 'تصحيح',
                  render: (s) => (s.status === 'reversed' ? '—' : (
                    <button
                      type="button"
                      className="text-xs font-bold text-red-700"
                      onClick={() => {
                        const reason = window.prompt('سبب عكس التسوية');
                        if (reason?.trim()) act(() => reverseSettlement({ settlementId: s.id, reason }));
                      }}
                    >
                      عكس
                    </button>
                  )),
                },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
};
