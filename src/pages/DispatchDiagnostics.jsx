import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Stethoscope,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Package,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getAllProviders, runDispatchDiagnostics } from '../services/adminService';
import { resolveDistributionSettings } from '../utils/dispatchDiagnostics';

const statusIcon = (status) => {
  if (status === 'pass') return <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
  return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
};

const statusBg = (status) => {
  if (status === 'pass') return 'bg-emerald-50 border-emerald-100';
  if (status === 'fail') return 'bg-red-50 border-red-100';
  return 'bg-amber-50 border-amber-100';
};

export const DispatchDiagnostics = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requestId, setRequestId] = useState(searchParams.get('requestId') || '');
  const [providerId, setProviderId] = useState(searchParams.get('providerId') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [recentSearching, setRecentSearching] = useState([]);
  const [providers, setProviders] = useState([]);
  const [showEligible, setShowEligible] = useState(true);
  const [showStages, setShowStages] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(
          collection(db, 'requests'),
          where('status', '==', 'searching'),
          orderBy('createdAt', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        setRecentSearching(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        const snap = await getDocs(query(collection(db, 'requests'), limit(20)));
        setRecentSearching(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => r.status === 'searching')
            .slice(0, 15)
        );
      }
      const { providers: list } = await getAllProviders();
      setProviders(list || []);
    };
    load();
  }, []);

  const handleRun = async (e) => {
    e?.preventDefault();
    setError('');
    setResult(null);
    if (!requestId.trim() || !providerId.trim()) {
      setError('أدخل معرّف الطلب ومعرّف المزود');
      return;
    }
    setLoading(true);
    try {
      const res = await runDispatchDiagnostics(requestId.trim(), providerId.trim());
      if (!res.success) {
        setError(res.error || 'فشل التشخيص');
        return;
      }
      setResult(res);
      setSearchParams({ requestId: requestId.trim(), providerId: providerId.trim() });
    } catch (err) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const report = result?.report;
  const dist = result?.distributionSettings
    ? resolveDistributionSettings(result.distributionSettings)
    : null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-700">
          <Stethoscope className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تشخيص التوزيع</h1>
          <p className="text-gray-600 mt-1 text-sm">
            يفحص لماذا لم يصل طلب لمزود — نفس شروط Cloud Function (performStagedSearch)
          </p>
        </div>
      </div>

      <form onSubmit={handleRun} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">معرّف الطلب (Request ID)</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="abc123..."
            />
            {recentSearching.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {recentSearching.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRequestId(r.id)}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-indigo-100 rounded-lg font-mono"
                  >
                    …{r.id.slice(-8)} ({r.serviceName || 'طلب'})
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">معرّف المزود (Provider UID)</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="Firebase UID"
            />
            <select
              className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              value=""
              onChange={(e) => e.target.value && setProviderId(e.target.value)}
            >
              <option value="">اختر مزوداً من القائمة…</option>
              {providers.slice(0, 200).map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.fullName || p.firstName || p.phone || p.id).toString().slice(0, 40)} — …{p.id.slice(-6)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          تشغيل التشخيص
        </button>
      </form>

      {result && report && (
        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-5 ${
              report.evaluation.eligible ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <p className="font-bold text-lg text-gray-900">{report.notifyVerdict}</p>
            {report.failureSummary && (
              <p className="text-sm font-medium text-amber-900 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                {report.failureSummary.title}: {report.failureSummary.detail}
              </p>
            )}
            <p className="text-sm text-gray-600 mt-2">
              مزودون متصلون في Firestore: {result.onlineCount} | مؤهلون للطلب: {report.totalEligible}
              {report.rankIndex != null && ` | ترتيب هذا المزود: ${report.rankIndex}`}
              {report.wasNotified && ' | ✅ في notifiedProviders'}
            </p>
            {dist && (
              <p className="text-xs text-gray-500 mt-1">
                المرحلة 1: أول {result.distributionSettings?.searchStages?.[0]?.maxProviders ?? 3} ضمن{' '}
                {result.distributionSettings?.searchStages?.[0]?.maxRadius ?? 4} كم — حد أقصى{' '}
                {dist.maxDispatchRadiusKm} كم
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-indigo-600" />
              الطلب
            </h2>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500">الخدمة</dt>
                <dd>{result.request.serviceName || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">serviceId</dt>
                <dd className="font-mono text-xs">{result.request.serviceId || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">parentServiceId</dt>
                <dd className="font-mono text-xs">{result.request.parentServiceId || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">notifiedProviders</dt>
                <dd className="font-mono text-xs">
                  {(result.request.notifiedProviders || []).length
                    ? (result.request.notifiedProviders || []).map((id) => id.slice(-6)).join(', ')
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-indigo-600" />
              المزود
            </h2>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500">الاسم</dt>
                <dd>{result.provider.fullName || result.provider.firstName || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">الجوال</dt>
                <dd dir="ltr">{result.provider.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">isOnline</dt>
                <dd>{String(result.provider.isOnline)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">الرصيد</dt>
                <dd>{result.provider.wallet?.balance ?? 0} ر.س</dd>
              </div>
            </dl>
            {report.evaluation.metrics && (
              <p className="mt-3 text-sm flex items-center gap-1 text-gray-700">
                <MapPin className="w-4 h-4" />
                مسافة: {report.evaluation.metrics.distanceKm.toFixed(2)} كم | score:{' '}
                {report.evaluation.metrics.sortScore.toFixed(2)} (عقوبة قِدَم: +
                {report.evaluation.metrics.freshnessPenalty} كم)
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold mb-3">فحص الشروط (مثل السيرفر)</h2>
            <ul className="space-y-2">
              {report.evaluation.checks.map((c) => (
                <li
                  key={c.id}
                  className={`flex gap-3 items-start border rounded-xl px-3 py-2 ${statusBg(c.status)}`}
                >
                  {statusIcon(c.status)}
                  <div>
                    <p className="font-medium text-gray-900">{c.label}</p>
                    <p className="text-sm text-gray-600">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 font-semibold hover:bg-gray-50"
              onClick={() => setShowEligible(!showEligible)}
            >
              <span>المؤهلون مرتبون ({report.eligibleAll.length})</span>
              {showEligible ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showEligible && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-right p-2">#</th>
                      <th className="text-right p-2">المزود</th>
                      <th className="text-right p-2">كم</th>
                      <th className="text-right p-2">score</th>
                      <th className="text-right p-2">موقع منذ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.eligibleAll.map((p, i) => (
                      <tr
                        key={p.id}
                        className={p.id === result.provider.id ? 'bg-indigo-50 font-medium' : ''}
                      >
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-mono text-xs">
                          {p.name} …{p.id.slice(-6)}
                        </td>
                        <td className="p-2">{p.distanceKm.toFixed(2)}</td>
                        <td className="p-2">{p.sortScore.toFixed(2)}</td>
                        <td className="p-2">{p.locationAgeMin != null ? `${p.locationAgeMin} د` : '—'}</td>
                      </tr>
                    ))}
                    {report.eligibleAll.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">
                          لا يوجد مزود مؤهل
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 font-semibold hover:bg-gray-50"
              onClick={() => setShowStages(!showStages)}
            >
              <span>محاكاة المراحل</span>
              {showStages ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showStages &&
              report.simulation.stageResults.map((st) => (
                <div key={st.stage} className="border-t border-gray-100 p-4">
                  <p className="font-medium text-gray-800">
                    المرحلة {st.stage}: 0–{st.maxRadius} كم — يُشعَر {st.notified.length} من {st.candidateCount}{' '}
                    مرشح (هدف {st.targetCount})
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    المُشعَرون:{' '}
                    {st.notified.length
                      ? st.notified
                          .map((p) => `${p.name || ''} …${p.id.slice(-6)} (${p.distance.toFixed(1)}كم)`)
                          .join(' · ')
                      : 'لا أحد'}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
