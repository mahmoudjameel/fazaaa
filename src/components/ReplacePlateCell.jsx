import { useState } from 'react';
import { replacePartnerVehicle } from '../services/membershipsService';

const INPUT_CLS = 'w-full min-w-0 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';
const PRIMARY_CLS = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50';

const EMPTY_REPLACEMENT = { plate: '', make: '', model: '', color: '', reason: '' };

export const ReplacePlateCell = ({ membership, busy, run }) => {
  const [form, setForm] = useState(null);
  const history = membership.vehicleHistory || [];
  if (!form) {
    return (
      <span className="block min-w-[120px]">
        <button type="button" onClick={() => setForm(EMPTY_REPLACEMENT)} className="text-teal-700 font-bold">استبدال</button>
        {history.map((change) => (
          <span key={change.at} className="block text-xs text-gray-500">{change.from?.plate} ← {change.to?.plate} · {change.reason} · {change.at.slice(0, 10)}</span>
        ))}
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-2 min-w-[180px]">
      {[['plate', 'اللوحة الجديدة'], ['make', 'النوع'], ['model', 'الموديل'], ['color', 'اللون'], ['reason', 'سبب الاستبدال']].map(([key, label]) => (
        <input key={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} className={INPUT_CLS} />
      ))}
      <button
        type="button"
        disabled={busy}
        className={PRIMARY_CLS}
        onClick={() => run(async () => {
          const { reason, ...vehicle } = form;
          await replacePartnerVehicle({ membershipId: membership.id, vehicle, reason });
          setForm(null);
        })}
      >
        حفظ
      </button>
      <button type="button" onClick={() => setForm(null)} className="text-xs font-bold text-gray-600">إلغاء</button>
    </span>
  );
};
