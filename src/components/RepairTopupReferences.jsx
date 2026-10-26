import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

const STATUS_LABELS = {
  fix: { text: 'سيُصحَّح', cls: 'bg-amber-50 text-amber-800' },
  ok: { text: 'صحيح', cls: 'bg-green-50 text-green-700' },
  review: { text: 'للمراجعة', cls: 'bg-red-50 text-red-700' },
  error: { text: 'خطأ', cls: 'bg-gray-100 text-gray-700' },
};

/**
 * تصحيح Trans ID / Payment ID المقرّبة في العمليات القديمة من البنك (بـ Track ID).
 * معاينة أولاً بدون كتابة، ثم تطبيق على دفعات حتى تنتهي.
 */
export function RepairTopupReferences() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (apply) => {
    if (apply && !window.confirm('تصحيح الأرقام في سجلات الشحن وحركات المزودين؟ يُكتب فقط ما أكّده البنك.')) return;
    setBusy(true);
    setError('');
    try {
      const fn = httpsCallable(functions, 'adminRepairTopupReferences', { timeout: 300000 });
      const res = await fn({ apply });
      setResult(res.data);
    } catch (e) {
      setError(e?.message || 'تعذر الاتصال');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">تصحيح أرقام العمليات القديمة</p>
          <p className="text-gray-500 mt-0.5">يسأل البنك عن كل عملية مدفوعة بمرجع فزّاعين ويصحّح Trans ID / Payment ID ليطابق البوابة.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" disabled={busy} onClick={() => run(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {busy ? 'جارٍ الفحص…' : 'معاينة'}
          </button>
          {result && !result.apply && result.checked > 0 && (
            <button type="button" disabled={busy} onClick={() => run(true)}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
              تطبيق التصحيح
            </button>
          )}
          {result?.apply && result.remaining > 0 && (
            <button type="button" disabled={busy} onClick={() => run(true)}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
              الدفعة التالية ({result.remaining})
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-gray-700">
            {result.apply ? 'تم التطبيق' : 'معاينة فقط — لم يُكتب شيء'} · فُحص {result.checked} من {result.total}
            {' '}· يحتاج تصحيح {result.fixed} · صحيح {result.alreadyCorrect} · للمراجعة {result.review} · أخطاء {result.errors}
            {result.remaining > 0 ? ` · متبقٍ ${result.remaining}` : ''}
          </p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="p-2 text-right">مرجع فزّاعين</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">Trans ID المخزّن → الصحيح</th>
                  <th className="p-2 text-right">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((it) => {
                  const st = STATUS_LABELS[it.status] || STATUS_LABELS.error;
                  return (
                    <tr key={it.topupId} className="border-t border-gray-100">
                      <td className="p-2 font-mono" dir="ltr">{it.trackId}</td>
                      <td className="p-2"><span className={`px-2 py-0.5 rounded ${st.cls}`}>{st.text}</span></td>
                      <td className="p-2 font-mono" dir="ltr">
                        {it.exactTrans ? `${it.storedTrans || '—'} → ${it.exactTrans}` : '—'}
                      </td>
                      <td className="p-2 text-gray-500">{it.reason || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
