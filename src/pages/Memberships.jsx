import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Copy, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { ResponsiveTable } from '../components/ResponsiveTable';
import {
  authorizeRenter,
  confirmPartnerPayment,
  createPartner,
  getMembershipPlan,
  listMembershipPayments,
  listMemberships,
  listPartnerLedger,
  listPartners,
  recordPartnerPayment,
  registerPartnerVehicles,
  saveMembershipPlan,
  setPartnerStatus,
} from '../services/membershipsService';

const TABS = [
  { id: 'memberships', label: 'السيارات المغطاة' },
  { id: 'payments', label: 'دفعات العضويات' },
  { id: 'partners', label: 'الشركات والمعارض' },
  { id: 'plan', label: 'إعداد الباقة' },
];

const STATUS_LABELS = {
  pending_payment: 'بانتظار الدفع',
  pending_activation: 'بانتظار التفعيل',
  active: 'مفعّلة',
  expired: 'منتهية',
  cancelled: 'ملغاة',
};

const PARTNER_TYPES = { rental: 'شركة تأجير', dealer: 'معرض سيارات', corporate: 'مؤسسة لموظفيها' };

const inputCls = 'w-full min-w-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';
const primaryCls = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50';

const formatMs = (ms) => (ms ? format(new Date(ms), 'yyyy/MM/dd HH:mm') : '—');

const paymentStage = (payment, nowMs) => {
  if (payment.state !== 'PAID') return payment.kind === 'partner_membership' ? 'بانتظار تأكيد الدفع' : 'بانتظار الدفع';
  if (payment.activationState === 'activated') return 'تم التفعيل';
  if (payment.activationState === 'refund_required') return 'مدفوعة مرتين: يلزم الاسترداد';
  return payment.activatesAtMs <= nowMs ? 'مستحق للتفعيل (متأخر)' : 'بانتظار مرور 24 ساعة';
};

const useAction = (reload) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload?.();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر تنفيذ العملية');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
};

const MembershipsTab = ({ memberships, reload }) => {
  const [search, setSearch] = useState('');
  const [renter, setRenter] = useState({ id: null, phone: '', until: '' });
  const { busy, error, run } = useAction(reload);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return memberships;
    return memberships.filter((m) => [m.vehicle?.plate, m.vehicle?.plateKey, m.beneficiaryPhone, m.beneficiaryName, m.partnerName]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [memberships, search]);

  const remainingText = (m) => (m.services || [])
    .map((s) => `${s.label} ${(m.remaining?.[s.key] ?? 0) - (m.reserved?.[s.key] ?? 0)}`).join(' · ') || '—';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باللوحة أو الجوال أو الجهة" className={`${inputCls} pr-9`} />
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <ResponsiveTable
        rowKey={(m) => m.id}
        rows={visible}
        empty="لا توجد عضويات."
        columns={[
          { header: 'السيارة', render: (m) => <span className="font-bold">{[m.vehicle?.make, m.vehicle?.model, m.vehicle?.color].filter(Boolean).join(' ')} · {m.vehicle?.plate}</span> },
          { header: 'المستفيد', render: (m) => <span><span className="block">{m.beneficiaryName || '—'}</span><span dir="ltr">{m.beneficiaryPhone || ''}</span></span> },
          { header: 'الجهة', render: (m) => m.partnerName || 'فرد' },
          { header: 'الحالة', render: (m) => STATUS_LABELS[m.status] || m.status },
          { header: 'المتبقي', render: remainingText },
          { header: 'التفعيل', render: (m) => <span dir="ltr">{formatMs(m.activatesAtMs)}</span> },
          { header: 'الانتهاء', render: (m) => <span dir="ltr">{formatMs(m.expiresAtMs)}</span> },
          {
            header: 'المستأجر',
            render: (m) => {
              if (m.partnerType !== 'rental') return '—';
              const current = m.authorizedRenters?.[0];
              if (renter.id !== m.id) {
                return (
                  <button type="button" onClick={() => setRenter({ id: m.id, phone: current?.phone || '', until: '' })} className="text-teal-700 font-bold">
                    {current ? `${current.phone} حتى ${current.until.slice(0, 10)}` : 'اعتماد مستأجر'}
                  </button>
                );
              }
              return (
                <span className="flex flex-col gap-2 min-w-[180px]">
                  <input value={renter.phone} onChange={(e) => setRenter({ ...renter, phone: e.target.value })} placeholder="جوال المستأجر" className={inputCls} dir="ltr" />
                  <input type="date" value={renter.until} onChange={(e) => setRenter({ ...renter, until: e.target.value })} aria-label="نهاية العقد" className={inputCls} />
                  <button
                    type="button"
                    disabled={busy}
                    className={primaryCls}
                    onClick={() => run(async () => {
                      await authorizeRenter({ membershipId: m.id, phone: renter.phone, until: `${renter.until}T23:59:59` });
                      setRenter({ id: null, phone: '', until: '' });
                    })}
                  >
                    حفظ
                  </button>
                </span>
              );
            },
          },
        ]}
      />
    </div>
  );
};

const PaymentsTab = ({ payments, reload }) => {
  const { busy, error, run } = useAction(reload);
  const nowMs = Date.now();
  const sorted = useMemo(() => [...payments].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), [payments]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">دفعات العضويات منفصلة عن شحن محافظ المزودين. لا تفعيل مبكر، والـ24 ساعة تبدأ من تأكيد الدفع.</p>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <ResponsiveTable
        rowKey={(p) => p.id}
        rows={sorted}
        empty="لا توجد دفعات."
        columns={[
          { header: 'النوع', render: (p) => (p.kind === 'partner_membership' ? 'عضوية شركة' : 'عضوية عميل') },
          { header: 'المشتري', render: (p) => <span><span className="block">{p.payerName || '—'}</span><span dir="ltr">{p.payerPhone || ''}</span></span> },
          { header: 'المبلغ', render: (p) => `${p.amount} ر.س` },
          { header: 'المرجع', render: (p) => <span dir="ltr">{p.trackId || p.id.slice(-8)}</span> },
          { header: 'وقت الدفع', render: (p) => <span dir="ltr">{formatMs(p.paidAtMs)}</span> },
          { header: 'موعد التفعيل', render: (p) => <span dir="ltr">{formatMs(p.activatesAtMs)}</span> },
          { header: 'الحالة', render: (p) => <span className="font-bold">{paymentStage(p, nowMs)}</span> },
          {
            header: 'إجراء',
            render: (p) => (p.kind === 'partner_membership' && p.state !== 'PAID' ? (
              <button type="button" disabled={busy} onClick={() => run(() => confirmPartnerPayment(p.id))} className={primaryCls}>تأكيد الدفع</button>
            ) : '—'),
          },
        ]}
      />
    </div>
  );
};

const PartnerCard = ({ partner, plan, reload }) => {
  const [open, setOpen] = useState(false);
  const [ledger, setLedger] = useState([]);
  const [vehicle, setVehicle] = useState({ plate: '', make: '', model: '', color: '', ownerName: '', ownerPhone: '' });
  const [payment, setPayment] = useState({ amount: '', reference: '' });
  const [qr, setQr] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const link = `${window.location.origin}/p/${partner.slug}`;
  const { busy, error, run } = useAction(reload);

  useEffect(() => {
    if (!open) return;
    listPartnerLedger(partner.id).then(setLedger).catch((e) => console.error(e));
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr).catch((e) => console.error(e));
  }, [open, partner.id, link, partner.balanceDue]);

  const isDeferred = partner.settlement === 'deferred';
  const totalDebt = ledger.filter((l) => l.type === 'debt').reduce((sum, l) => sum + l.amount, 0);
  const totalPaid = ledger.filter((l) => l.type === 'payment').reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full p-4 flex flex-wrap items-center justify-between gap-2 text-right">
        <span className="min-w-0">
          <span className="block font-black text-gray-900 break-words">{partner.name}</span>
          <span className="text-xs text-gray-500">{PARTNER_TYPES[partner.type]} · {isDeferred ? 'بالآجل' : 'دفع مقدم'} · {partner.status === 'active' ? 'نشطة' : 'موقوفة'}</span>
        </span>
        {isDeferred && <span className="text-sm font-black text-red-700">المتبقي {partner.balanceDue || 0} ر.س</span>}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {qr && <img src={qr} alt={`باركود ${partner.name}`} className="w-32 h-32 flex-shrink-0" />}
            <div className="min-w-0 space-y-2">
              <p className="text-xs text-gray-500">الرابط يفتح صفحة الطلب فقط، ولا يثبت الاستحقاق.</p>
              <button type="button" onClick={() => navigator.clipboard?.writeText(link)} className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 min-w-0">
                <Copy className="w-4 h-4 flex-shrink-0" /><span className="break-all" dir="ltr">{link}</span>
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => setPartnerStatus(partner.id, partner.status === 'active' ? 'suspended' : 'active'))} className="block text-xs font-bold text-gray-600">
                {partner.status === 'active' ? 'إيقاف الجهة' : 'تفعيل الجهة'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-black text-gray-800">تسجيل سيارة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[['plate', 'اللوحة (عربي أو إنجليزي)'], ['make', 'النوع'], ['model', 'الموديل'], ['color', 'اللون'], ['ownerName', 'اسم المستفيد'], ['ownerPhone', 'جوال المستفيد']].map(([key, label]) => (
                <input key={key} value={vehicle[key]} onChange={(e) => setVehicle({ ...vehicle, [key]: e.target.value })} placeholder={label} className={inputCls} />
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 w-4 h-4 flex-shrink-0" />
              <span>الجهة وافقت على الشروط: {plan?.laborOnlyNotice}</span>
            </label>
            <button
              type="button"
              disabled={busy || !termsAccepted}
              className={primaryCls}
              onClick={() => run(async () => {
                await registerPartnerVehicles({ partnerId: partner.id, planId: plan?.id, vehicles: [vehicle], termsAccepted });
                setVehicle({ plate: '', make: '', model: '', color: '', ownerName: '', ownerPhone: '' });
              })}
            >
              <Plus className="w-4 h-4" /> تسجيل ({plan?.totalSar ?? '—'} ر.س)
            </button>
          </div>

          {isDeferred && (
            <div className="space-y-2">
              <h3 className="text-sm font-black text-gray-800">كشف الحساب</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-gray-50 rounded-xl p-2"><div className="text-[11px] text-gray-500">المطلوب</div><b>{totalDebt}</b></div>
                <div className="bg-gray-50 rounded-xl p-2"><div className="text-[11px] text-gray-500">المدفوع</div><b>{totalPaid}</b></div>
                <div className="bg-gray-50 rounded-xl p-2"><div className="text-[11px] text-gray-500">المتبقي</div><b>{partner.balanceDue || 0}</b></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input type="number" inputMode="decimal" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} placeholder="المبلغ المدفوع" className={inputCls} />
                <input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} placeholder="مرجع الدفع" className={inputCls} />
                <button
                  type="button"
                  disabled={busy}
                  className={primaryCls}
                  onClick={() => run(async () => {
                    await recordPartnerPayment({ partnerId: partner.id, ...payment });
                    setPayment({ amount: '', reference: '' });
                  })}
                >
                  تسجيل دفعة
                </button>
              </div>
              <ul className="text-xs text-gray-600 space-y-1">
                {ledger.map((entry) => (
                  <li key={entry.id} className="break-words">
                    {entry.type === 'debt' ? 'مديونية' : `دفعة (${entry.reference})`}: {entry.amount} ر.س · {entry.note || ''} · {entry.byEmail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
};

const PartnersTab = ({ partners, plan, reload }) => {
  const [form, setForm] = useState({ name: '', slug: '', type: 'rental', settlement: 'prepaid' });
  const { busy, error, run } = useAction(reload);
  const slugTaken = partners.some((p) => p.slug === form.slug);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-black text-gray-800">إضافة جهة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الجهة" className={inputCls} />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="رابط إنجليزي مثل hertz" className={inputCls} dir="ltr" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, settlement: e.target.value === 'rental' ? 'prepaid' : 'deferred' })} aria-label="نوع الجهة" className={inputCls}>
            {Object.entries(PARTNER_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={form.settlement} onChange={(e) => setForm({ ...form, settlement: e.target.value })} aria-label="طريقة الدفع" className={inputCls}>
            <option value="prepaid">دفع مقدم</option>
            <option value="deferred">بالآجل</option>
          </select>
        </div>
        {slugTaken && <p className="text-xs font-bold text-red-600">هذا الرابط مستخدم.</p>}
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy || !form.name.trim() || !form.slug || slugTaken}
          className={primaryCls}
          onClick={() => run(async () => {
            await createPartner(form);
            setForm({ name: '', slug: '', type: 'rental', settlement: 'prepaid' });
          })}
        >
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>
      {partners.length === 0 && <p className="text-sm text-gray-500 text-center py-6">لا توجد جهات.</p>}
      {partners.map((partner) => <PartnerCard key={partner.id} partner={partner} plan={plan} reload={reload} />)}
    </div>
  );
};

const PlanTab = ({ plan, reload }) => {
  const [form, setForm] = useState(plan);
  const { busy, error, run } = useAction(reload);
  useEffect(() => setForm(plan), [plan]);
  if (!form) return null;
  const updateService = (index, count) => setForm({
    ...form,
    services: form.services.map((s, i) => (i === index ? { ...s, count: Number(count) } : s)),
  });
  const numericFields = [['priceSar', 'السعر (ر.س)'], ['taxPercent', 'الضريبة %'], ['validityDays', 'المدة بالأيام'], ['activationHours', 'التفعيل بعد (ساعة)']];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4 max-w-2xl">
      <label className="block text-sm font-semibold text-gray-700">اسم الباقة
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} mt-1`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {numericFields.map(([key, label]) => (
          <label key={key} className="block text-sm font-semibold text-gray-700">{label}
            <input type="number" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={`${inputCls} mt-1`} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {form.services.map((service, index) => (
          <label key={service.key} className="block text-sm font-semibold text-gray-700">{service.label}
            <input type="number" min="0" value={service.count} onChange={(e) => updateService(index, e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        ))}
      </div>
      <label className="block text-sm font-semibold text-gray-700">نص الموافقة قبل الشراء
        <textarea value={form.laborOnlyNotice} onChange={(e) => setForm({ ...form, laborOnlyNotice: e.target.value })} rows={3} className={`${inputCls} mt-1`} />
      </label>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">التعديل يسري على المشتريات الجديدة، والعضويات القائمة تبقى بشروطها.</p>
      <button type="button" disabled={busy} className={primaryCls} onClick={() => run(() => saveMembershipPlan(form))}>حفظ</button>
    </div>
  );
};

export const Memberships = () => {
  const [tab, setTab] = useState('memberships');
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setFailed(false);
    try {
      const [memberships, payments, partners, plan] = await Promise.all([
        listMemberships(), listMembershipPayments(), listPartners(), getMembershipPlan(),
      ]);
      setData({ memberships, payments, partners, plan });
    } catch (e) {
      console.error('Memberships load:', e);
      setFailed(true);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">باقات العضوية</h1>
            <p className="text-sm text-gray-500">الأفراد والشركات والمعارض</p>
          </div>
        </div>
        <button type="button" onClick={load} aria-label="تحديث" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-teal-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap ${tab === t.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {failed ? (
        <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
          <p className="text-gray-700 font-semibold">تعذر تحميل البيانات.</p>
          <button type="button" onClick={load} className={`${primaryCls} mt-3`}>إعادة المحاولة</button>
        </div>
      ) : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {tab === 'memberships' && <MembershipsTab memberships={data.memberships} reload={load} />}
          {tab === 'payments' && <PaymentsTab payments={data.payments} reload={load} />}
          {tab === 'partners' && <PartnersTab partners={data.partners} plan={data.plan} reload={load} />}
          {tab === 'plan' && <PlanTab plan={data.plan} reload={load} />}
        </>
      )}
    </div>
  );
};
