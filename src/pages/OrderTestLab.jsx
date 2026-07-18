import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FlaskConical,
  Send,
  Loader2,
  User,
  Users,
  MapPin,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Unlock,
  Stethoscope,
  Copy,
  Check,
  Clock,
  Ban,
} from 'lucide-react';
import { collection, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getUsersBySearch,
  getAllProviders,
  getProviderById,
  createTestDispatchOrder,
  runDispatchDiagnostics,
  validateProviderForTestDispatch,
  releaseProviderBusy,
  cancelRequestAsCustomer,
} from '../services/adminService';
import { getProviderCoords } from '../utils/dispatchDiagnostics';

const RIYADH = { latitude: 24.7136, longitude: 46.6753 };
const DEFAULT_SEARCH_SECONDS = 160;

function tsToMs(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') return Date.parse(value);
  return null;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const STATUS_LABELS = {
  searching: 'جاري البحث عن مزود',
  assigned: 'تم قبول الطلب',
  timed_out: 'انتهى وقت البحث',
  canceled_by_client: 'أُلغي من العميل',
  canceled_by_client_with_reason: 'أُلغي من العميل',
  canceled_by_provider: 'أُلغي من المزود',
  canceled_by_provider_with_reason: 'أُلغي من المزود',
};

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

export const OrderTestLab = () => {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');

  const [services, setServices] = useState([]);
  const [serviceKey, setServiceKey] = useState('');

  const [locationMode, setLocationMode] = useState('provider');
  const [customLat, setCustomLat] = useState(String(RIYADH.latitude));
  const [customLng, setCustomLng] = useState(String(RIYADH.longitude));
  const [price, setPrice] = useState('49');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [createdRequestId, setCreatedRequestId] = useState('');
  const [createdOrderNumber, setCreatedOrderNumber] = useState(null);
  const [liveRequest, setLiveRequest] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null);
  const [releasingBusy, setReleasingBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_SEARCH_SECONDS);
  const [searchTotalSeconds, setSearchTotalSeconds] = useState(DEFAULT_SEARCH_SECONDS);
  const [searchTimerActive, setSearchTimerActive] = useState(false);
  const searchEndsRef = useRef(null);

  const unsubRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const [provRes] = await Promise.all([
        getAllProviders(),
        (async () => {
          const snap = await getDocs(collection(db, 'emergency-services'));
          const flat = [];
          snap.docs.forEach((d) => {
            const data = d.data();
            flat.push({
              key: d.id,
              id: d.id,
              name: data.name || d.id,
              price: data.basePrice ?? data.price ?? 49,
              parentServiceId: null,
            });
            (data.subServices || []).forEach((sub, i) => {
              const sid = sub.id || `sub-${d.id}-${i}`;
              flat.push({
                key: sid,
                id: sid,
                name: `${data.name || d.id} — ${sub.name || sid}`,
                price: sub.price ?? data.basePrice ?? 49,
                parentServiceId: d.id,
                parentName: data.name,
              });
            });
          });
          setServices(flat);
          if (flat.length > 0) setServiceKey(flat[0].key);
        })(),
      ]);
      setProviders(provRes?.providers || []);
    };
    load();
  }, []);

  useEffect(() => {
    const term = customerSearch.trim();
    if (term.length < 2) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const res = await getUsersBySearch(term);
        setCustomerResults(res.users || []);
      } catch {
        setCustomerResults([]);
      } finally {
        setSearchingCustomers(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);
  const selectedService = services.find((s) => s.key === serviceKey);

  const resolveCoordinates = useCallback(async () => {
    if (locationMode === 'riyadh') return { ...RIYADH };
    if (locationMode === 'custom') {
      const lat = parseFloat(customLat);
      const lng = parseFloat(customLng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('إحداثيات غير صالحة');
      return { latitude: lat, longitude: lng };
    }
    if (!selectedProviderId) throw new Error('اختر مزوداً لاستخدام موقعه');
    const res = await getProviderById(selectedProviderId);
    if (!res.success || !res.provider) throw new Error('لم يُعثر على المزود');
    const coords = getProviderCoords(res.provider);
    if (!coords) throw new Error('لا يوجد موقع محفوظ لهذا المزود في Firestore — فعّل GPS أو heartbeat');
    return coords;
  }, [locationMode, customLat, customLng, selectedProviderId]);

  const runDiagnostics = async (requestId, providerId) => {
    if (!requestId || !providerId) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const res = await runDispatchDiagnostics(requestId, providerId);
      if (!res.success) {
        setSubmitError(res.error || 'فشل التشخيص');
        return;
      }
      setDiagResult(res);
    } catch (e) {
      setSubmitError(e.message || 'فشل التشخيص');
    } finally {
      setDiagLoading(false);
    }
  };

  const watchRequest = (requestId) => {
    if (unsubRef.current) unsubRef.current();
    const ref = doc(db, 'requests', requestId);
    unsubRef.current = onSnapshot(ref, (snap) => {
      if (snap.exists()) setLiveRequest({ id: snap.id, ...snap.data() });
    });
  };

  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current();
  }, []);

  // عداد الانتظار — نفس منطق WaitingProviderScreen (من searchEndsAt)
  useEffect(() => {
    if (!liveRequest) return;

    const total = liveRequest.searchTotalSeconds ?? DEFAULT_SEARCH_SECONDS;
    setSearchTotalSeconds(total);

    if (liveRequest.status === 'timed_out' || liveRequest.searchAbortedEarly === true) {
      searchEndsRef.current = Date.now();
      setSearchTimerActive(false);
      setTimeRemaining(0);
      return;
    }

    const endMs = tsToMs(liveRequest.searchEndsAt);
    if (endMs && liveRequest.status === 'searching') {
      searchEndsRef.current = endMs;
      setSearchTimerActive(true);
      setTimeRemaining(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    } else if (liveRequest.status !== 'searching') {
      setSearchTimerActive(false);
    }
  }, [liveRequest?.id, liveRequest?.status, liveRequest?.searchEndsAt, liveRequest?.searchTotalSeconds, liveRequest?.searchAbortedEarly]);

  useEffect(() => {
    if (!searchTimerActive || !searchEndsRef.current) return undefined;
    const tick = setInterval(() => {
      const endMs = searchEndsRef.current;
      if (!endMs) return;
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setTimeRemaining(remaining);
    }, 1000);
    return () => clearInterval(tick);
  }, [searchTimerActive, createdRequestId]);

  const handleCancelRequest = async () => {
    if (!createdRequestId || !liveRequest) return;
    if (liveRequest.status !== 'searching') {
      alert('الطلب لم يعد في حالة البحث');
      return;
    }
    if (!window.confirm('إلغاء الطلب التجريبي؟ (نفس سيناريو إلغاء العميل — يوقف الرنين عند المزودين)')) return;

    setCancelling(true);
    try {
      await cancelRequestAsCustomer(createdRequestId);
    } catch (e) {
      alert(e.message || 'فشل الإلغاء');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setDiagResult(null);
    setLiveRequest(null);
    setCreatedRequestId('');
    setCreatedOrderNumber(null);
    searchEndsRef.current = null;
    setSearchTimerActive(false);
    setTimeRemaining(DEFAULT_SEARCH_SECONDS);

    if (!selectedCustomer?.id) {
      setSubmitError('اختر عميلاً');
      return;
    }
    if (!selectedProviderId) {
      setSubmitError('اختر المزود المتوقع استقبال الطلب');
      return;
    }
    if (!selectedService) {
      setSubmitError('اختر الخدمة');
      return;
    }

    setSubmitting(true);
    try {
      const coordinates = await resolveCoordinates();
      const customerName =
        selectedCustomer.name ||
        `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() ||
        'عميل';

      const preflight = await validateProviderForTestDispatch(selectedProviderId, {
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        serviceCategory: selectedService.parentName || selectedService.name,
        parentServiceId: selectedService.parentServiceId || null,
        coordinates,
      });

      if (!preflight.eligible) {
        setSubmitError(
          preflight.error ||
            'المزود غير مؤهل للبحث — تأكد من: الاعتماد، الرصيد ≥ 5، غير مشغول، موقع معروف في Firestore، وتطابق الخدمة'
        );
        setDiagResult({
          success: true,
          report: { checks: preflight.checks || [] },
        });
        return;
      }

      const payload = {
        customerId: selectedCustomer.id,
        customerName,
        customerPhone: selectedCustomer.phone || selectedCustomer.phoneNumber || '',
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        serviceCategory: selectedService.parentName || selectedService.name,
        parentServiceId: selectedService.parentServiceId || null,
        servicePrice: Number(price) || selectedService.price || 49,
        price: Number(price) || selectedService.price || 49,
        location:
          locationMode === 'provider'
            ? `موقع المزود (${selectedProvider?.firstName || selectedProviderId.slice(-6)})`
            : locationMode === 'riyadh'
              ? 'الرياض (اختبار)'
              : `اختبار ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
        coordinates,
        notes: `اختبار مختبر التوزيع — مزود مستهدف: ${selectedProviderId}`,
        testTargetProviderId: selectedProviderId,
      };

      const result = await createTestDispatchOrder(payload);
      if (!result.success) throw new Error('فشل إنشاء الطلب');

      setCreatedRequestId(result.id);
      watchRequest(result.id);

      setTimeout(async () => {
        const snap = await getDoc(doc(db, 'requests', result.id));
        if (snap.exists() && snap.data().orderNumber != null) {
          setCreatedOrderNumber(snap.data().orderNumber);
        }
      }, 800);

      setTimeout(() => runDiagnostics(result.id, selectedProviderId), 4000);
    } catch (err) {
      setSubmitError(err.message || 'فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseBusy = async () => {
    if (!selectedProviderId) return;
    if (!window.confirm('تحرير المزود من isBusy و activeRequestId؟')) return;
    setReleasingBusy(true);
    try {
      const res = await releaseProviderBusy(selectedProviderId);
      alert(
        `تم التحرير.\nقبل: isBusy=${res.previous.isBusy}, activeRequestId=${res.previous.activeRequestId || '—'}`
      );
      if (createdRequestId) await runDiagnostics(createdRequestId, selectedProviderId);
    } catch (e) {
      alert(e.message || 'فشل التحرير');
    } finally {
      setReleasingBusy(false);
    }
  };

  const providerInNotified =
    liveRequest?.notifiedProviders?.includes(selectedProviderId) ?? false;
  const report = diagResult?.report;
  const isSearching = liveRequest?.status === 'searching';
  const timerDisplay = searchTimerActive ? formatTime(timeRemaining) : '--:--';
  const timerLabel = searchTimerActive
    ? 'الوقت المحدد لانتظار المزود'
    : isSearching
      ? 'جاري التحقق من المزودين القريبين...'
      : 'انتهى البحث';
  const progressPercent = searchTimerActive
    ? Math.max(0, Math.min(100, (timeRemaining / Math.max(searchTotalSeconds, 1)) * 100))
    : isSearching
      ? 15
      : 0;
  const stageEndsMs = tsToMs(liveRequest?.stageEndsAt);
  const stageRemainingSec =
    stageEndsMs && isSearching ? Math.max(0, Math.floor((stageEndsMs - Date.now()) / 1000)) : null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 rounded-2xl bg-teal-100 text-teal-800">
          <FlaskConical className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مختبر اختبار الطلبات</h1>
          <p className="text-gray-600 mt-1 text-sm">
            أنشئ طلب searching حقيقي (يشغّل Cloud Function) وتابع هل وصل للمزود المختار
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <User className="w-4 h-4" /> العميل
            </label>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              placeholder="بحث بالاسم أو الجوال..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setSelectedCustomer(null);
              }}
            />
            {searchingCustomers && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> جاري البحث...
              </p>
            )}
            {selectedCustomer && (
              <p className="text-xs text-teal-700 mt-2 font-medium">
                ✓ {selectedCustomer.name || selectedCustomer.phone} — {selectedCustomer.id.slice(-8)}
              </p>
            )}
            {customerResults.length > 0 && !selectedCustomer && (
              <ul className="mt-2 max-h-36 overflow-y-auto border border-gray-100 rounded-xl divide-y">
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-right px-3 py-2 text-sm hover:bg-teal-50"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch(c.name || c.phone || c.id);
                        setCustomerResults([]);
                      }}
                    >
                      {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'} —{' '}
                      <span dir="ltr">{c.phone || c.phoneNumber || ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Users className="w-4 h-4" /> المزود (المتوقع أن يستقبل)
            </label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
            >
              <option value="">اختر مزوداً...</option>
              {providers.map((p) => {
                const label = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName || p.phone || p.id;
                const busy = p.isBusy || p.activeRequestId ? ' ⚠️ مشغول' : '';
                const bal = p.wallet?.balance ?? 0;
                return (
                  <option key={p.id} value={p.id}>
                    {label} — رصيد {bal} — {p.isOnline ? 'متصل' : 'غير متصل'}
                    {busy}
                  </option>
                );
              })}
            </select>
            {selectedProvider && (
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <p>
                  isBusy: <strong>{String(selectedProvider.isBusy)}</strong> | activeRequestId:{' '}
                  <span className="font-mono">{selectedProvider.activeRequestId?.slice(-8) || '—'}</span>
                </p>
                <button
                  type="button"
                  onClick={handleReleaseBusy}
                  disabled={releasingBusy}
                  className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-1 rounded-lg hover:bg-amber-200"
                >
                  {releasingBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                  تحرير من الانشغال
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Package className="w-4 h-4" /> الخدمة
            </label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">السعر (ر.س)</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> موقع الطلب (إحداثيات العميل)
          </label>
          <div className="flex flex-wrap gap-3 mb-2">
            {[
              { id: 'provider', label: 'نفس موقع المزود' },
              { id: 'riyadh', label: 'الرياض (افتراضي)' },
              { id: 'custom', label: 'إحداثيات يدوية' },
            ].map((opt) => (
              <label key={opt.id} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="loc"
                  checked={locationMode === opt.id}
                  onChange={() => setLocationMode(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {locationMode === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
                placeholder="latitude"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                dir="ltr"
              />
              <input
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
                placeholder="longitude"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                dir="ltr"
              />
            </div>
          )}
        </div>

        {submitError && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">{submitError}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          إرسال طلب تجريبي (searching)
        </button>
      </form>

      {createdRequestId && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-lg mb-3">متابعة مباشرة</h2>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded" dir="ltr">
                {createdRequestId}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(createdRequestId);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                className="text-xs inline-flex items-center gap-1 bg-gray-200 px-2 py-1 rounded-lg"
              >
                {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                نسخ
              </button>
              {createdOrderNumber != null && (
                <span className="text-sm text-gray-500">رقم الطلب: {createdOrderNumber}</span>
              )}
              <Link
                to={`/admin/orders`}
                className="text-xs text-teal-600 underline"
              >
                فتح الطلبات
              </Link>
            </div>

            {liveRequest ? (
              <>
                {/* عداد الانتظار — مطابق لتطبيق العميل */}
                <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-orange-900">
                      <Clock className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium">{timerLabel}</span>
                    </div>
                    <span className="text-2xl font-bold tabular-nums text-orange-700" dir="ltr">
                      {timerDisplay}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-orange-200 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {searchTimerActive && (
                    <p className="text-xs text-orange-800/80 mt-2">
                      إجمالي مدة البحث: {formatTime(searchTotalSeconds)} — متبقٍ: {formatTime(timeRemaining)}
                    </p>
                  )}
                </div>

                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">الحالة</dt>
                  <dd className="font-semibold">
                    {STATUS_LABELS[liveRequest.status] || liveRequest.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">آخر مرحلة بحث</dt>
                  <dd>{liveRequest.lastSearchStage ?? '—'}</dd>
                </div>
                {liveRequest.stageWaitSeconds != null && (
                  <div>
                    <dt className="text-gray-500">مدة المرحلة الحالية</dt>
                    <dd>{liveRequest.stageWaitSeconds} ث</dd>
                  </div>
                )}
                {stageRemainingSec != null && (
                  <div>
                    <dt className="text-gray-500">متبقٍ في المرحلة</dt>
                    <dd className="font-mono" dir="ltr">{formatTime(stageRemainingSec)}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">notifiedProviders ({(liveRequest.notifiedProviders || []).length})</dt>
                  <dd className="font-mono text-xs mt-1">
                    {(liveRequest.notifiedProviders || []).length
                      ? (liveRequest.notifiedProviders || []).join(', ')
                      : 'لا أحد بعد — انتظر Cloud Function (~10–60 ث)'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">المزود المستهدف</dt>
                  <dd
                    className={`font-semibold mt-1 ${providerInNotified ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    {providerInNotified
                      ? '✅ وصل ضمن notifiedProviders'
                      : '❌ لم يُضف بعد إلى notifiedProviders'}
                  </dd>
                </div>
              </dl>

                {isSearching && (
                  <button
                    type="button"
                    onClick={handleCancelRequest}
                    disabled={cancelling}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 border-2 border-red-300 bg-red-50 text-red-700 py-3 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50"
                  >
                    {cancelling ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Ban className="w-5 h-5" />
                    )}
                    إلغاء الطلب (مثل العميل)
                  </button>
                )}

                {!isSearching && liveRequest.status && (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
                      liveRequest.status === 'assigned'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                  >
                    {liveRequest.status === 'assigned'
                      ? '✅ قبل مزود الطلب — توقّف البحث والرنين'
                      : `⏹ انتهى السيناريو: ${STATUS_LABELS[liveRequest.status] || liveRequest.status}`}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> جاري الاتصال بالطلب...
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => runDiagnostics(createdRequestId, selectedProviderId)}
                disabled={diagLoading}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {diagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                تشخيص الآن
              </button>
              <Link
                to={`/admin/dispatch-diagnostics?requestId=${encodeURIComponent(createdRequestId)}&providerId=${encodeURIComponent(selectedProviderId)}`}
                className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200"
              >
                تشخيص مفصّل
              </Link>
            </div>
          </div>

          {report && (
            <div className="space-y-4">
              <div
                className={`rounded-2xl border p-5 ${
                  report.evaluation.eligible && providerInNotified
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <p className="font-bold text-lg">{report.notifyVerdict}</p>
                {report.failureSummary && (
                  <p className="text-sm font-medium text-amber-900 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                    {report.failureSummary.title}: {report.failureSummary.detail}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  مؤهلون: {report.totalEligible} | ترتيب المزود: {report.rankIndex ?? '—'} | في notified:{' '}
                  {report.wasNotified ? 'نعم' : 'لا'}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold mb-3">فحص الشروط</h3>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
