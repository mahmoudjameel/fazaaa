import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { setCompanySaas } from '../services/membershipsService';

const inputCls = 'w-full min-w-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';
const MODE_OPTIONS = [
  { value: 'free_forever', label: 'مجاني دائماً' },
  { value: 'free_until', label: 'مجاني حتى تاريخ' },
  { value: 'paid', label: 'مدفوع حتى تاريخ' },
];
const DEFAULT_PRICE_SAR = 199;
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const toDateInput = (iso) => (iso ? new Date(Date.parse(iso) + RIYADH_OFFSET_MS).toISOString().slice(0, 10) : '');

/** يتحكم في اشتراك لوحة الشركة الشهري ومن يدخلها، وهو مستقل عن باقة السيارات */
export const CompanySaasEditor = ({ partner, onSaved }) => {
  const saas = partner.saas;
  const [mode, setMode] = useState(saas?.mode || 'free_forever');
  const [endDate, setEndDate] = useState(toDateInput(saas?.paidUntilIso || saas?.freeUntilIso));
  const [priceSar, setPriceSar] = useState(saas?.priceSar ?? DEFAULT_PRICE_SAR);
  const [members, setMembers] = useState(partner.members || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateMember = (index, field, value) => setMembers((list) => list.map((m, i) => (i === index ? { ...m, [field]: value } : m)));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await setCompanySaas({ partnerId: partner.id, saas: { mode, endDate, priceSar }, members });
      await onSaved();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-gray-800">اشتراك لوحة الشركة</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <label className="text-sm font-bold text-gray-700">نوع الاشتراك
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={`${inputCls} mt-1`}>
            {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {mode !== 'free_forever' && (
          <label className="text-sm font-bold text-gray-700">ينتهي في
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        )}
        <label className="text-sm font-bold text-gray-700">السعر الشهري (ر.س)
          <input type="number" min="0" value={priceSar} onChange={(e) => setPriceSar(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
      </div>
      <p className="text-sm font-bold text-gray-700">من يدخل لوحة الشركة</p>
      {members.map((member, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input aria-label="الاسم" placeholder="الاسم" value={member.name} onChange={(e) => updateMember(index, 'name', e.target.value)} className={inputCls} />
          <input aria-label="الجوال" placeholder="05xxxxxxxx" dir="ltr" value={member.phone} onChange={(e) => updateMember(index, 'phone', e.target.value)} className={inputCls} />
          <button type="button" aria-label="حذف المستخدم" onClick={() => setMembers((list) => list.filter((_, i) => i !== index))} className="p-2 text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setMembers((list) => [...list, { name: '', phone: '' }])} className="inline-flex items-center gap-1 text-sm font-bold text-teal-700">
        <Plus className="w-4 h-4" /> إضافة مستخدم
      </button>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button type="button" disabled={busy || (mode !== 'free_forever' && !endDate)} onClick={save} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} حفظ الاشتراك
      </button>
      <p className="text-xs text-gray-500">عند انتهاء التاريخ يتوقف دخول الشركة تلقائياً. رابط الدخول: /company</p>
    </div>
  );
};
