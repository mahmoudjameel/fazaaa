import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { getRequestDispatchDetails, setCancelResponsibility } from '../services/adminService';
import {
  AUDIT_STATUS_LABELS,
  CANCEL_PARTIES,
  LOSS_REASONS,
  diagnoseLostRequest,
  isLostRequest,
  resolveCancelActor,
} from '../utils/lossDiagnosis';

const providerResult = (providerEntry, order, notifiedIds) => {
  const id = providerEntry.id;
  if (String(order.providerId || '') === id) return 'قبل';
  if ((order.rejectedProviders || []).map(String).includes(id)) return 'رفض';
  return notifiedIds.has(id) ? 'أُرسل له ولم يرد' : 'لم يُرسل له';
};

const stageNotifiedIds = (stages, order) => new Set([
  ...(order.notifiedProviders || []).map(String),
  ...stages.flatMap((stage) => (stage.notified || []).map((n) => String(n.id))),
]);

const CancelResponsibility = ({ order }) => {
  const actor = resolveCancelActor(order);
  const [saved, setSaved] = useState(order.cancelResponsibility || null);
  const [party, setParty] = useState(order.cancelResponsibility?.party || 'unknown');
  const [note, setNote] = useState(order.cancelResponsibility?.note || '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSaved(order.cancelResponsibility || null);
    setParty(order.cancelResponsibility?.party || 'unknown');
    setNote(order.cancelResponsibility?.note || '');
  }, [order.id]);

  if (!actor) return null;

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      setSaved(await setCancelResponsibility(order.id, { party, note }));
    } catch (e) {
      console.error('setCancelResponsibility:', e);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm"><span className="text-gray-500">من ضغط الإلغاء: </span><span className="font-bold text-gray-900">{actor}</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={party} onChange={(e) => setParty(e.target.value)} aria-label="المسؤول عن الإلغاء" className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          {Object.entries(CANCEL_PARTIES).map(([id, label]) => <option key={id} value={id}>المسؤول: {label}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التحديد (اختياري)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        <button type="button" onClick={save} disabled={saving} className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold disabled:opacity-50">
          {saving ? 'جارٍ الحفظ…' : 'حفظ المسؤول'}
        </button>
      </div>
      {failed && <p className="text-xs font-bold text-red-600">تعذر الحفظ.</p>}
      {saved && (
        <p className="text-xs text-gray-500">
          المحدد: {CANCEL_PARTIES[saved.party]}{saved.byEmail ? ` · بواسطة ${saved.byEmail}` : ''}
          {saved.at ? ` · ${format(new Date(saved.at), 'yyyy/MM/dd HH:mm')}` : ''}
        </p>
      )}
    </div>
  );
};

const DispatchLog = ({ order }) => {
  const [details, setDetails] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setFailed(false);
    getRequestDispatchDetails(order.id)
      .then((result) => { if (!cancelled) setDetails(result); })
      .catch((e) => {
        console.error('getRequestDispatchDetails:', e);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [order.id]);

  if (failed) return <p className="text-sm text-red-600">تعذر تحميل سجل التوزيع.</p>;
  if (!details) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحميل…</div>;

  const { audit, stages } = details;
  const notifiedIds = stageNotifiedIds(stages, order);
  const loss = isLostRequest(order) ? diagnoseLostRequest(order, audit) : null;

  return (
    <div className="space-y-3">
      {loss && (
        <div className="text-sm"><span className="text-gray-500">سبب الضياع: </span><span className="font-black text-red-700">{LOSS_REASONS[loss.reason]}</span></div>
      )}
      {stages.length > 0 && (
        <p className="text-xs text-gray-600">
          الحلقات: {stages.map((s) => `${s.radiusKm ?? '?'} كم (${(s.notified || []).length} مزود)`).join(' ← ')}
        </p>
      )}
      {audit ? (
        <>
          <p className="text-xs text-gray-600">
            مزودون يقدمون الخدمة ضمن نطاق البحث {audit.searchRadiusKm} كم: <b>{audit.nearbyCount}</b>
            {audit.listedCount > audit.providers.length ? ` (يعرض أقرب ${audit.providers.length} حتى ${audit.auditRadiusKm} كم)` : ''}
          </p>
          {audit.providers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    {['المزود', 'المسافة', 'الحالة وقت البحث', 'الرصيد', 'عمر الموقع', 'النتيجة'].map((h) => (
                      <th key={h} className="text-right font-semibold py-1.5 px-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.providers.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="py-1.5 px-2">
                        <Link to={`/admin/providers?highlight=${encodeURIComponent(p.id)}`} className="text-teal-700 font-bold" dir="ltr">…{p.id.slice(-6)}</Link>
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{p.km} كم</td>
                      <td className="py-1.5 px-2 whitespace-nowrap font-semibold text-gray-800">{p.inSearchRange === false ? 'خارج نطاق البحث' : (AUDIT_STATUS_LABELS[p.status] || p.status)}</td>
                      <td className="py-1.5 px-2">{p.balance}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{p.locationAgeMin == null ? '—' : `${p.locationAgeMin} د`}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{providerResult(p, order, notifiedIds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-gray-400">«أُرسل له» يعني أن النظام أرسل الإشعار، ولا يثبت وصوله أو مشاهدته.</p>
        </>
      ) : (
        <p className="text-xs text-gray-500">لا توجد لقطة لهذا الطلب: اللقطات تبدأ من طلبات ما بعد تفعيل السجل.</p>
      )}
    </div>
  );
};

/** تشخيص الطلب: من كان مؤهلاً ومن وصله، ومن ضغط الإلغاء ومن المسؤول */
export const RequestDiagnosticsCard = ({ order }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
    <div className="flex items-center gap-2 font-black text-gray-800 text-sm">
      <ClipboardList className="w-4 h-4 text-teal-600" /> تشخيص الطلب
    </div>
    <CancelResponsibility order={order} />
    <DispatchLog order={order} />
  </div>
);
