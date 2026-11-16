import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Bug, ChevronDown, Loader2, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { db } from '../services/firebase';

/**
 * أعطال تطبيق المزود (providers-app/src/services/crashReporter.js → app_error_logs).
 * مجمّعة بالرسالة: أكثر عطل تكراراً أولاً، وكل حالة بجهازها ونسختها وآخر خطواتها.
 */
const TYPE_LABEL = {
  js_fatal: { text: 'إغلاق بسبب خطأ', cls: 'bg-red-100 text-red-700' },
  js_error: { text: 'خطأ', cls: 'bg-amber-100 text-amber-800' },
  unexpected_exit: { text: 'إغلاق مفاجئ', cls: 'bg-purple-100 text-purple-700' },
};

const ACTION_LABEL = {
  navigate_to_customer_pressed: 'ضغط «التوجيه إلى موقع العميل»',
  open_maps_link: 'فتح الخرائط (رابط)',
  open_maps_intent: 'فتح الخرائط (Intent)',
  open_maps_link_failed: 'فشل فتح الرابط',
  open_maps_intent_failed: 'فشل فتح Intent',
  app_start: 'فتح التطبيق',
  app_active: 'رجع للتطبيق',
  app_background: 'خرج للخلفية',
  app_inactive: 'غير نشط',
  acceptRequest: 'قبول طلب',
  rejectRequest: 'رفض طلب',
  updateRequestToEnRoute: 'في الطريق',
  updateRequestToArrived: 'وصلت',
  updateRequestToInProgress: 'بدء التنفيذ',
  completeRequest: 'إكمال الطلب',
  cancelRequestByProvider: 'إلغاء من المزود',
};

const fmtMs = (ms) => (ms ? format(new Date(ms), 'dd MMM، HH:mm:ss', { locale: ar }) : '—');
const actionText = (a) => (a.startsWith('screen:') ? `شاشة ${a.slice(7)}` : ACTION_LABEL[a] || a);
const deviceText = (d = {}) => [d.brand, d.model, d.platform === 'android' ? `Android ${d.osVersion || ''}` : d.platform === 'ios' ? `iOS ${d.osVersion || ''}` : null]
  .filter(Boolean).join(' · ');

function LogDetails({ log, onDelete }) {
  return (
    <div className="border-t border-gray-100 pt-3 mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>{fmtMs(log.occurredAtMs)}</span>
        <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" />{deviceText(log.device)}</span>
        <span>نسخة {log.device?.appVersion || '—'} ({log.device?.buildNumber || '—'})</span>
        {log.screen && <span>الشاشة: {log.screen}</span>}
        {log.uid && (
          <Link to={`/admin/account-history?q=${log.uid}`} className="text-teal-700 underline decoration-dotted">المزود</Link>
        )}
      </div>
      {log.breadcrumbs?.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-500 mb-1">آخر الخطوات قبل العطل</div>
          <ol className="space-y-0.5 text-xs text-gray-700">
            {log.breadcrumbs.slice(-12).map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-gray-400 shrink-0">{fmtMs(b.at).split('، ')[1]}</span>
                <span>{actionText(b.action)}</span>
                {b.data && <span className="text-gray-400 truncate" dir="ltr">{b.data}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {log.stack && (
        <pre className="text-[11px] leading-snug bg-gray-50 rounded-lg p-2 overflow-x-auto max-h-48 whitespace-pre-wrap" dir="ltr">{log.stack}</pre>
      )}
      <button type="button" onClick={() => onDelete(log)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
        <Trash2 className="w-3.5 h-3.5" /> حذف
      </button>
    </div>
  );
}

export default function AppErrors() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [openGroup, setOpenGroup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(query(collection(db, 'app_error_logs'), orderBy('createdAt', 'desc'), limit(300)));
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(e?.message || 'تعذر التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    logs.filter((l) => typeFilter === 'all' || l.type === typeFilter).forEach((l) => {
      const key = `${l.type}|${l.message}`;
      if (!map.has(key)) map.set(key, { key, type: l.type, message: l.message, items: [] });
      map.get(key).items.push(l);
    });
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [logs, typeFilter]);

  const removeLog = async (log) => {
    if (!window.confirm('حذف هذا السجل؟')) return;
    await deleteDoc(doc(db, 'app_error_logs', log.id)).catch((e) => window.alert(e?.message));
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bug className="w-7 h-7 text-red-600" />
            أعطال تطبيق المزود
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            كل خطأ أو إغلاق مفاجئ مع الجهاز والنسخة وآخر خطوات المزود قبله. الإغلاق المفاجئ يُرسل عند فتح التطبيق مرة ثانية.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['all', 'الكل'], ['js_fatal', 'إغلاق بسبب خطأ'], ['unexpected_exit', 'إغلاق مفاجئ'], ['js_error', 'أخطاء']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${typeFilter === key ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-6 text-center">
          لا توجد أعطال مسجّلة. تبدأ بالظهور بعد تثبيت المزودين للنسخة الجديدة من التطبيق.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const latest = g.items[0];
            const isOpen = openGroup === g.key;
            const devices = new Set(g.items.map((l) => `${l.device?.brand || ''} ${l.device?.model || ''}`.trim())).size;
            return (
              <div key={g.key} className="bg-white rounded-2xl border border-gray-200 p-4">
                <button type="button" onClick={() => setOpenGroup(isOpen ? null : g.key)} className="w-full text-right">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${TYPE_LABEL[g.type]?.cls || 'bg-gray-100'}`}>
                      {TYPE_LABEL[g.type]?.text || g.type}
                    </span>
                    <span className="text-xs font-bold text-gray-700">{g.items.length} مرة</span>
                    <span className="text-xs text-gray-500">{devices} جهاز · آخرها {fmtMs(latest.occurredAtMs)}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 mr-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="mt-2 font-semibold text-gray-900 break-words" dir="auto">{g.message}</div>
                </button>
                {isOpen && g.items.slice(0, 20).map((log) => <LogDetails key={log.id} log={log} onDelete={removeLog} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
