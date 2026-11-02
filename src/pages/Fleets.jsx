import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Plus, Search, Upload } from 'lucide-react';
import { PartnerFleetUpload, readFleetSheet } from '../components/PartnerFleetUpload';
import { ReplacePlateCell } from '../components/ReplacePlateCell';
import { exportTable } from '../utils/exportTable';
import {
  cancelPartnerPayment,
  confirmPartnerPayment,
  createPartner,
  getMembershipPlan,
  listFleetChanges,
  listFleetMemberships,
  listMembershipPayments,
  listPackagePlans,
  listPartners,
  registerPartnerVehicles,
  replaceFleetVehicles,
  setFleetVehiclesSuspended,
  updatePartnerContract,
} from '../services/membershipsService';

const VEHICLES_PAGE_SIZE = 50;
const SEATED_STATUSES = ['active', 'pending_activation', 'pending_payment'];
const STATUS_LABELS = {
  active: 'مفعّلة',
  pending_activation: 'بانتظار التفعيل',
  pending_payment: 'بانتظار الدفع',
  suspended: 'موقوفة',
  expired: 'منتهية',
  cancelled: 'ملغاة',
};
const CHANGE_LABELS = { added: 'إضافة', replaced: 'استبدال', suspended: 'إيقاف', resumed: 'إعادة تشغيل', payment_cancelled: 'إلغاء دفعة' };
const REPLACE_COLUMNS = [
  { key: 'currentPlate', header: 'اللوحة الحالية' },
  { key: 'plate', header: 'اللوحة الجديدة' },
  { key: 'make', header: 'النوع' },
  { key: 'model', header: 'الموديل' },
  { key: 'color', header: 'اللون' },
  { key: 'reason', header: 'السبب' },
];
const EMPTY_COMPANY = { name: '', slug: '', type: 'rental', settlement: 'prepaid', planId: '', maxVehicles: '', coverageStart: '', coverageEnd: '' };
const EMPTY_VEHICLE = { plate: '', make: '', model: '', color: '' };

const inputCls = 'w-full min-w-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';
const primaryCls = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50';
const secondaryCls = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 disabled:opacity-50';

// تواريخ العقد بتوقيت السعودية مهما كان توقيت جهاز الأدمن
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const toContractDate = (iso) => (iso ? new Date(Date.parse(iso) + RIYADH_OFFSET_MS).toISOString().slice(0, 10) : '');
const planTotal = (plan) => Math.round(plan.priceSar * (100 + (Number(plan.taxPercent) || 0))) / 100;
const formatMs = (ms) => (ms ? format(new Date(ms), 'yyyy/MM/dd') : '—');
const remainingText = (m) => (m.services || [])
  .map((s) => `${s.label} ${(m.remaining?.[s.key] ?? 0) - (m.reserved?.[s.key] ?? 0)}`).join(' · ') || '—';

const contractFields = ({ planId, maxVehicles, coverageStart, coverageEnd }) => ({
  planId: planId || null,
  maxVehicles: Number(maxVehicles) || null,
  coverageStartIso: coverageStart ? new Date(`${coverageStart}T00:00:00+03:00`).toISOString() : null,
  coverageEndIso: coverageEnd ? new Date(`${coverageEnd}T23:59:59+03:00`).toISOString() : null,
});

const useAction = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر تنفيذ العملية');
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run };
};

const ContractFields = ({ form, setForm, plans }) => (
  <>
    <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} aria-label="الباقة" className={inputCls}>
      <option value="">الباقة الافتراضية</option>
      {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.priceSar} ر.س)</option>)}
    </select>
    <input type="number" min="1" value={form.maxVehicles} onChange={(e) => setForm({ ...form, maxVehicles: e.target.value })} placeholder="عدد السيارات" className={inputCls} />
    <label className="text-xs font-bold text-gray-600">بداية التغطية
      <input type="date" value={form.coverageStart} onChange={(e) => setForm({ ...form, coverageStart: e.target.value })} className={`${inputCls} mt-1`} />
    </label>
    <label className="text-xs font-bold text-gray-600">نهاية التغطية
      <input type="date" value={form.coverageEnd} onChange={(e) => setForm({ ...form, coverageEnd: e.target.value })} className={`${inputCls} mt-1`} />
    </label>
  </>
);

const CreateCompanyForm = ({ plans, onCreated }) => {
  const [form, setForm] = useState(EMPTY_COMPANY);
  const { busy, error, run } = useAction();
  const hasValidCoverage = form.coverageEnd && (!form.coverageStart || form.coverageStart < form.coverageEnd);
  const canSave = form.name.trim() && form.slug && form.maxVehicles && hasValidCoverage;
  return (
    <section className="bg-white rounded-2xl shadow p-4 space-y-3">
      <h2 className="font-black text-gray-800">حساب شركة جديد</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الشركة" className={inputCls} />
        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="الرابط (بالإنجليزية)" className={inputCls} dir="ltr" />
        <select value={form.settlement} onChange={(e) => setForm({ ...form, settlement: e.target.value })} aria-label="طريقة الدفع" className={inputCls}>
          <option value="prepaid">دفع مقدم</option>
          <option value="deferred">بالآجل</option>
        </select>
        <ContractFields form={form} setForm={setForm} plans={plans} />
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || !canSave}
        className={primaryCls}
        onClick={() => run(async () => {
          const { name, slug, type, settlement } = form;
          if ((await listPartners()).some((partner) => partner.slug === slug)) throw new Error('هذا الرابط مستخدم لجهة أخرى');
          await createPartner({ name: name.trim(), slug, type, settlement, ...contractFields(form) });
          setForm(EMPTY_COMPANY);
          await onCreated();
        })}
      >
        <Plus className="w-4 h-4" /> إنشاء الحساب
      </button>
    </section>
  );
};

const BulkReplaceButton = ({ partner, reload }) => {
  const [failures, setFailures] = useState([]);
  const { busy, error, run } = useAction();

  const onFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    run(async () => {
      const replacements = await readFleetSheet(file, REPLACE_COLUMNS, 'currentPlate');
      const { results } = await replaceFleetVehicles({ partnerId: partner.id, replacements });
      setFailures(results.filter((result) => result.error));
      await reload();
    });
  };

  const downloadTemplate = () => exportTable({
    baseName: 'fazaeen-fleet-replacements',
    columns: REPLACE_COLUMNS.map((c) => ({ header: c.header, value: (row) => row[c.key] })),
    rows: [{ currentPlate: '1234 ABJ', plate: '5678 ABJ', make: 'تويوتا', model: 'كامري 2023', color: 'أبيض', reason: 'خرجت من الخدمة' }],
  });

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <label className={`${secondaryCls} cursor-pointer`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} ملف استبدال
          <input type="file" accept=".xlsx" disabled={busy} onChange={onFileChosen} className="sr-only" />
        </label>
        <button type="button" onClick={downloadTemplate} className="text-sm font-bold text-teal-700">قالب الاستبدال</button>
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {failures.length > 0 && (
        <ul className="max-h-40 overflow-auto text-sm text-red-700">
          {failures.map((failure) => <li key={failure.line}>سطر {failure.line} · {failure.plate}: {failure.error}</li>)}
        </ul>
      )}
    </div>
  );
};

const AddVehicleForm = ({ partner, reload }) => {
  const [vehicle, setVehicle] = useState(EMPTY_VEHICLE);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-gray-800">إضافة سيارة واحدة</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[['plate', 'اللوحة'], ['make', 'النوع'], ['model', 'الموديل'], ['color', 'اللون']].map(([key, label]) => (
          <input key={key} value={vehicle[key]} onChange={(e) => setVehicle({ ...vehicle, [key]: e.target.value })} placeholder={label} className={inputCls} />
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="w-4 h-4" />
        الشركة وافقت على شروط الباقة
      </label>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || !termsAccepted}
        className={primaryCls}
        onClick={() => run(async () => {
          await registerPartnerVehicles({ partnerId: partner.id, vehicles: [vehicle], termsAccepted });
          setVehicle(EMPTY_VEHICLE);
          await reload();
        })}
      >
        <Plus className="w-4 h-4" /> إضافة
      </button>
    </div>
  );
};

const VehiclesTable = ({ partner, vehicles, reload }) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(VEHICLES_PAGE_SIZE);
  const [failures, setFailures] = useState([]);
  const { busy, error, run } = useAction();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter((m) => [m.vehicle?.plate, m.vehicle?.plateKey, m.vehicle?.make, m.vehicle?.model]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [vehicles, search]);

  const toggleSelected = (id) => setSelectedIds((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const setSuspended = (suspended) => {
    const reason = window.prompt(suspended ? 'سبب الإيقاف:' : 'سبب إعادة التشغيل:', '');
    if (!reason?.trim()) return;
    run(async () => {
      const { results } = await setFleetVehiclesSuspended({ partnerId: partner.id, membershipIds: [...selectedIds], suspended, reason });
      setFailures(results.filter((result) => result.error));
      setSelectedIds(new Set());
      await reload();
    });
  };

  const plateOf = (membershipId) => vehicles.find((m) => m.id === membershipId)?.vehicle?.plate;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(VEHICLES_PAGE_SIZE); }} placeholder="بحث باللوحة أو النوع" className={`${inputCls} pr-9`} />
        </div>
        <button type="button" disabled={busy || selectedIds.size === 0} onClick={() => setSuspended(true)} className={secondaryCls}>إيقاف ({selectedIds.size})</button>
        <button type="button" disabled={busy || selectedIds.size === 0} onClick={() => setSuspended(false)} className={secondaryCls}>إعادة تشغيل ({selectedIds.size})</button>
        <button type="button" onClick={() => setSelectedIds(new Set(filtered.map((m) => m.id)))} className="text-sm font-bold text-teal-700">تحديد الكل ({filtered.length})</button>
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {failures.length > 0 && (
        <ul className="max-h-40 overflow-auto text-sm text-red-700">
          {failures.map((failure) => <li key={failure.membershipId}>{plateOf(failure.membershipId)}: {failure.error}</li>)}
        </ul>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="p-2"><span className="sr-only">تحديد</span></th>
              <th className="p-2">السيارة</th>
              <th className="p-2">الحالة</th>
              <th className="p-2">المتبقي</th>
              <th className="p-2">التغطية</th>
              <th className="p-2">استبدال اللوحة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, visibleCount).map((m) => (
              <tr key={m.id} className="border-t border-gray-100 align-top">
                <td className="p-2">
                  <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelected(m.id)} aria-label={`تحديد ${m.vehicle?.plate}`} className="w-4 h-4" />
                </td>
                <td className="p-2 font-bold">{m.vehicle?.plate}<span className="block text-xs font-normal text-gray-500">{[m.vehicle?.make, m.vehicle?.model, m.vehicle?.color].filter(Boolean).join(' ')}</span></td>
                <td className="p-2">{STATUS_LABELS[m.status] || m.status}</td>
                <td className="p-2">{remainingText(m)}</td>
                <td className="p-2 whitespace-nowrap" dir="ltr">{formatMs(m.activatesAtMs)} – {formatMs(m.expiresAtMs ?? m.fixedExpiresAtMs)}</td>
                <td className="p-2"><ReplacePlateCell membership={m} busy={busy} run={(action) => run(async () => { await action(); await reload(); })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="text-sm text-gray-500 text-center py-4">لا توجد سيارات.</p>}
      {visibleCount < filtered.length && (
        <button type="button" onClick={() => setVisibleCount((count) => count + VEHICLES_PAGE_SIZE)} className={`${secondaryCls} w-full`}>
          عرض المزيد ({visibleCount} من {filtered.length})
        </button>
      )}
    </div>
  );
};

const ChangeLog = ({ changes }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-black text-gray-800">سجل التغييرات</h3>
    {changes.length === 0 && <p className="text-sm text-gray-500">لا توجد تغييرات.</p>}
    <ul className="max-h-72 overflow-auto divide-y divide-gray-100 text-sm">
      {changes.map((change) => (
        <li key={change.id} className="py-2">
          <b>{CHANGE_LABELS[change.action] || change.action}</b>
          {' · '}{change.plates?.length > 2 ? `${change.plates.length} سيارة` : change.plates?.join(' ← ')}
          {change.reason ? ` · ${change.reason}` : ''}
          <span className="block text-xs text-gray-500">{change.byEmail} · {change.at?.toMillis ? format(change.at.toMillis(), 'yyyy/MM/dd HH:mm') : ''}</span>
        </li>
      ))}
    </ul>
  </div>
);

const ContractEditor = ({ partner, plans, onSaved }) => {
  const [form, setForm] = useState({
    planId: partner.planId || '',
    maxVehicles: partner.maxVehicles || '',
    coverageStart: toContractDate(partner.coverageStartIso),
    coverageEnd: toContractDate(partner.coverageEndIso),
  });
  const { busy, error, run } = useAction();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-gray-800">العقد</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        <ContractFields form={form} setForm={setForm} plans={plans} />
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button type="button" disabled={busy || (form.coverageStart && form.coverageEnd && form.coverageStart >= form.coverageEnd)} className={secondaryCls} onClick={() => run(async () => { await updatePartnerContract(partner.id, contractFields(form)); await onSaved(); })}>
        حفظ العقد
      </button>
      <p className="text-xs text-gray-500">التواريخ تسري على السيارات المسجلة بعد الحفظ، ولا تغيّر تغطية المسجلة قبلها.</p>
    </div>
  );
};

const UnpaidBatches = ({ partner, reloadKey, reload }) => {
  const [batches, setBatches] = useState([]);
  const { busy, error, run } = useAction();

  useEffect(() => {
    listMembershipPayments()
      .then((payments) => setBatches(payments.filter((p) => p.partnerId === partner.id && p.state === 'PENDING')))
      .catch((e) => console.error(e));
  }, [partner.id, reloadKey]);

  if (batches.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-gray-800">دفعات بانتظار الدفع</h3>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {batches.map((batch) => (
        <div key={batch.id} className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 rounded-xl p-2">
          <span className="flex-1 min-w-[140px]">{batch.membershipIds?.length} سيارة · {batch.amount} ر.س</span>
          <button type="button" disabled={busy} className={secondaryCls} onClick={() => run(async () => { await confirmPartnerPayment(batch.id); await reload(); })}>تأكيد الدفع</button>
          <button
            type="button"
            disabled={busy}
            className={secondaryCls}
            onClick={() => { if (window.confirm('إلغاء هذه الدفعة وسياراتها؟')) run(async () => { await cancelPartnerPayment(batch.id); await reload(); }); }}
          >
            إلغاء الدفعة
          </button>
        </div>
      ))}
    </div>
  );
};

const CompanyDetails = ({ partner, plan, plans, onPartnerChanged }) => {
  const [vehicles, setVehicles] = useState(null);
  const [changes, setChanges] = useState([]);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [nextVehicles, nextChanges] = await Promise.all([listFleetMemberships(partner.id), listFleetChanges(partner.id)]);
      setVehicles(nextVehicles);
      setChanges(nextChanges);
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'تعذر تحميل الأسطول');
    }
  }, [partner.id]);

  useEffect(() => { reload(); }, [reload]);

  if (loadError) return <p className="text-sm font-bold text-red-600">{loadError}</p>;
  if (!vehicles) return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;

  const seated = vehicles.filter((m) => SEATED_STATUSES.includes(m.status)).length;
  const countOf = (status) => vehicles.filter((m) => m.status === status).length;

  return (
    <section className="bg-white rounded-2xl shadow p-4 space-y-5">
      <div>
        <h2 className="font-black text-gray-800">{partner.name}</h2>
        <p className="text-sm text-gray-600">
          المستخدم {seated} من {partner.maxVehicles || 'بلا حد'} · مفعّلة {countOf('active')} · بانتظار التفعيل {countOf('pending_activation')} · موقوفة {countOf('suspended')} · التغطية {toContractDate(partner.coverageStartIso) || '—'} إلى {toContractDate(partner.coverageEndIso) || '—'}
        </p>
      </div>
      <ContractEditor key={partner.id} partner={partner} plans={plans} onSaved={onPartnerChanged} />
      <FleetUploadSection partner={partner} plan={plan} reload={reload} />
      <UnpaidBatches partner={partner} reloadKey={vehicles} reload={reload} />
      <AddVehicleForm partner={partner} reload={reload} />
      <div className="space-y-2">
        <h3 className="text-sm font-black text-gray-800">السيارات ({vehicles.length})</h3>
        <BulkReplaceButton partner={partner} reload={reload} />
        <VehiclesTable partner={partner} vehicles={vehicles} reload={reload} />
      </div>
      <ChangeLog changes={changes} />
    </section>
  );
};

const FleetUploadSection = ({ partner, plan, reload }) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="w-4 h-4" />
        الشركة وافقت على شروط الباقة
      </label>
      <PartnerFleetUpload partner={partner} plan={plan} termsAccepted={termsAccepted} reload={reload} />
    </div>
  );
};

export const Fleets = () => {
  const [partners, setPartners] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadPartners = useCallback(async () => {
    try {
      setPartners((await listPartners()).filter((partner) => partner.type === 'rental'));
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'تعذر تحميل الشركات');
    }
  }, []);

  useEffect(() => {
    loadPartners();
    getMembershipPlan().then(setPlan).catch((e) => console.error(e));
    listPackagePlans().then(setPlans).catch((e) => console.error(e));
  }, [loadPartners]);

  const selected = partners?.find((partner) => partner.id === selectedId);
  const selectedPlan = plans.find((candidate) => candidate.id === selected?.planId);
  const contractPlan = selectedPlan ? { ...selectedPlan, totalSar: planTotal(selectedPlan) } : plan;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-gray-800">إدارة أساطيل الشركات</h1>
        <p className="text-sm text-gray-600">حسابات شركات التأجير وسياراتها، والمستأجر يطلب الخدمة بلوحة السيارة من رابط الشركة.</p>
      </div>
      {loadError && <p className="text-sm font-bold text-red-600">{loadError}</p>}
      <CreateCompanyForm plans={plans} onCreated={loadPartners} />
      <section className="bg-white rounded-2xl shadow p-4">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="الشركة" className={inputCls}>
          <option value="">اختر شركة ({partners?.length ?? '…'})</option>
          {partners?.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
        </select>
      </section>
      {selected && <CompanyDetails key={selected.id} partner={selected} plan={contractPlan} plans={plans} onPartnerChanged={loadPartners} />}
    </div>
  );
};
