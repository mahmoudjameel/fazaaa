import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Loader2, Merge } from 'lucide-react';
import { functions } from '../services/firebase';
import { formatPhoneLocal } from '../utils/accountChangeLog';

/**
 * توحيد الرقم المرجعي لمستندات الجوال الواحد (functions: adminUnifyAccountNumbers).
 * معاينة أولاً، ثم تطبيق بعد التأكيد.
 */
const KIND_LABEL = { customers: 'العملاء', providers: 'المزودون' };

export default function AccountNumberUnifyPanel() {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const run = async (apply) => {
    setBusy(true);
    setError('');
    try {
      const res = await httpsCallable(functions, 'adminUnifyAccountNumbers', { timeout: 300000 })({ apply });
      if (apply) {
        setDone(res.data);
        setPreview(null);
      } else {
        setPreview(res.data);
        setDone(null);
      }
    } catch (e) {
      setError(e?.message || 'تعذر التنفيذ');
    } finally {
      setBusy(false);
    }
  };

  const total = (data) => (data?.results || []).reduce((s, r) => s + r.totalUpdates, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Merge className="w-5 h-5 text-teal-600" />
            توحيد الأرقام المرجعية المكررة
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            نفس الجوال المسجّل بأكثر من حساب يأخذ رقماً واحداً (الأقدم). النسخ القديمة من العملاء تُخفى من قائمة العملاء
            وتبقى ظاهرة هنا، والرقم المستبدل يبقى قابلاً للبحث.
          </p>
        </div>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={busy}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy && !preview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'فحص'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="space-y-3">
          {preview.results.map((r) => (
            <div key={r.collection} className="text-sm">
              <div className="font-bold text-gray-800">
                {KIND_LABEL[r.collection]}: {r.groups} شخص مكرر · {r.totalUpdates} حساب سيتغير (من {r.scanned})
              </div>
              {r.updates.length > 0 && (
                <div className="mt-1 max-h-48 overflow-y-auto text-xs text-gray-600 space-y-0.5">
                  {r.updates.map((u) => (
                    <div key={u.id} dir="rtl">
                      <span dir="ltr">{formatPhoneLocal(u.phone)}</span>: {u.from || 'بلا رقم'} ← <b>{u.to}</b>
                      {u.mergedInto ? ' · نسخة قديمة (تُخفى)' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {total(preview) > 0 ? (
            <button
              type="button"
              onClick={() => { if (window.confirm(`توحيد ${total(preview)} حساب؟`)) run(true); }}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تطبيق التوحيد'}
            </button>
          ) : (
            <p className="text-sm text-emerald-700">لا يوجد تكرار.</p>
          )}
        </div>
      )}

      {done && (
        <p className="text-sm text-emerald-700 font-bold">
          تم: {done.results.map((r) => `${KIND_LABEL[r.collection]} ${r.totalUpdates}`).join(' · ')} حساب.
        </p>
      )}
    </div>
  );
}
