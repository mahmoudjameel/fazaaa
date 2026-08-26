import { useEffect, useState } from 'react';
import { Settings, MapPin, Clock, Users, Save, AlertTriangle, CheckCircle, Plus, Trash2, Star, ShieldOff, Loader2, RefreshCw } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getAllRejectBlocks, unblockProviderForCustomer, BLOCK_REASON_LABELS } from '../services/adminService';

// القيم الافتراضية فقط عند غياب إعدادات Firestore — السيناريو الفعلي من لوحة التحكم
const DEFAULT_STAGES = [
  { maxRadius: 5,  waitTime: 20, maxProviders: 8, vipOnly: false },
  { maxRadius: 7,  waitTime: 20, maxProviders: 5, vipOnly: false },
  { maxRadius: 10, waitTime: 20, maxProviders: 4, vipOnly: false },
  { maxRadius: 13, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 16, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 19, waitTime: 40, maxProviders: 3, vipOnly: false },
  { maxRadius: 19, waitTime: 40, maxProviders: 3, vipOnly: false },
];

export const DistributionSettings = () => {
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [vipEnabled, setVipEnabled] = useState(false);
  const [rejectBlockMinutes, setRejectBlockMinutes] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [unblockingKey, setUnblockingKey] = useState(null);
  const [showExpiredBlocks, setShowExpiredBlocks] = useState(false);

  useEffect(() => { fetchSettings(); fetchBlocks(); }, []);

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'distribution'));
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d.searchStages) && d.searchStages.length > 0) {
          setStages(d.searchStages.map(s => ({
            maxRadius:    typeof s.maxRadius    === 'number' ? s.maxRadius    : 15,
            waitTime:     typeof s.waitTime     === 'number' ? s.waitTime     : 20,
            maxProviders: typeof s.maxProviders === 'number' ? s.maxProviders : 3,
            vipOnly:      s.vipOnly === true,
          })));
        }
        if (typeof d.vipEnabled === 'boolean') setVipEnabled(d.vipEnabled);
        if (d.rejectBlockMinutes === 0 || Number.isFinite(Number(d.rejectBlockMinutes))) {
          const n = Number(d.rejectBlockMinutes);
          setRejectBlockMinutes(Number.isFinite(n) && n >= 0 ? n : 60);
        }
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocks = async () => {
    setLoadingBlocks(true);
    try {
      const result = await getAllRejectBlocks();
      setBlocks(result.success ? (result.blocks || []) : []);
    } catch (e) {
      console.error('Error fetching reject blocks:', e);
      setBlocks([]);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const formatBlockUntil = (block) => {
    if (!block?.blockedUntilMs) return '—';
    const d = new Date(block.blockedUntilMs);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const handleUnblock = async (customerId, providerId) => {
    const key = `${customerId}:${providerId}`;
    if (!window.confirm('رفع الحظر؟ سيصل هذا المزود طلبات هذا العميل فوراً.')) return;
    setUnblockingKey(key);
    try {
      await unblockProviderForCustomer(customerId, providerId);
      setBlocks((prev) => prev.filter((b) => !(b.customerId === customerId && b.providerId === providerId)));
    } catch (e) {
      alert(e?.message || 'فشل رفع الحظر');
    } finally {
      setUnblockingKey(null);
    }
  };

  const validateStages = () => {
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.maxRadius < 1 || s.maxRadius > 100)
        return `المرحلة ${i + 1}: الحد الأقصى للمسافة يجب أن يكون بين 1 و100 كم`;
      if (s.waitTime < 5 || s.waitTime > 300)
        return `المرحلة ${i + 1}: وقت الانتظار يجب أن يكون بين 5 و300 ثانية`;
      if (s.maxProviders < 1 || s.maxProviders > 20)
        return `المرحلة ${i + 1}: عدد المزودين يجب أن يكون بين 1 و20`;
    }
    if (!Number.isFinite(Number(rejectBlockMinutes)) || rejectBlockMinutes < 0 || rejectBlockMinutes > 1440) {
      return 'مدة حظر الرفض يجب أن تكون بين 0 و1440 دقيقة (0 = بدون حظر)';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validateStages();
    if (validationError) { setError(validationError); return; }
    setError('');
    setSaving(true);
    try {
      const stageMax = Math.max(...stages.map((s) => Number(s.maxRadius) || 0), 0);
      await setDoc(doc(db, 'settings', 'distribution'), {
        searchStages: stages,
        vipEnabled,
        rejectBlockMinutes: Number(rejectBlockMinutes) || 0,
        // سقف التوزيع = أعلى مرحلة في السيناريو (تتغير إذا زِدت مراحل من اللوحة)
        maxSearchRadiusKm: stageMax,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Error saving settings:', e);
      alert('فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = (index, field, value) => {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addStage = () => {
    const last = stages[stages.length - 1];
    setStages(prev => [...prev, {
      maxRadius:    Math.min((last?.maxRadius ?? 15) + 3, 100),
      waitTime:     last?.waitTime     ?? 20,
      maxProviders: last?.maxProviders ?? 3,
      vipOnly:      false,
    }]);
  };

  const removeStage = (index) => {
    if (stages.length <= 1) return;
    setStages(prev => prev.filter((_, i) => i !== index));
  };

  const totalSeconds = stages.reduce((s, r) => s + (r.waitTime || 0), 0);
  const maxRadius    = stages.length > 0 ? Math.max(...stages.map(s => s.maxRadius || 0)) : 0;
  const totalMinutes = (totalSeconds / 60).toFixed(1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent" />
        <p className="text-sm text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات توزيع الطلبات</h1>
          <p className="text-gray-500 mt-1 text-sm">تحكم كامل في مراحل البحث، المسافات، والأوقات.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 text-gray-950 rounded-xl hover:bg-amber-500 transition-all font-bold text-sm shadow-sm disabled:opacity-50"
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ ✓' : 'حفظ التغييرات'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700 text-sm font-medium">
          <AlertTriangle size={18} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-black text-amber-500 mb-1">{stages.length}</div>
          <div className="text-sm text-gray-500">مراحل البحث</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-black text-blue-600 mb-1">{totalMinutes} د</div>
          <div className="text-sm text-gray-500">إجمالي وقت البحث ({totalSeconds}ث)</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-black text-purple-600 mb-1">{maxRadius} كم</div>
          <div className="text-sm text-gray-500">أقصى نطاق للبحث</div>
        </div>
      </div>

      {/* Stages Editor */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-amber-500" />
            <h3 className="font-bold text-gray-800">مراحل البحث المتدرج</h3>
          </div>
          <button
            onClick={addStage}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors text-sm font-semibold"
          >
            <Plus size={16} />
            إضافة مرحلة
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          كل مرحلة تستهدف <strong className="text-gray-600">حلقتها الجغرافية فقط</strong> (من حد المرحلة السابقة إلى حد هذه المرحلة).
          عند الرفض يُستبدل المزود فوراً من <strong className="text-gray-600">نفس الحلقة</strong> حتى يكتمل العدد النشط.
          مزودو المراحل السابقة يبقون نشطين ويمكنهم القبول في أي وقت.
        </p>

        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 transition-colors ${stage.vipOnly ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                {/* Stage number */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 ${stage.vipOnly ? 'bg-amber-400 text-white' : 'bg-gray-800 text-white'}`}>
                  {i + 1}
                </div>

                {/* Max Radius */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 whitespace-nowrap">حد أقصى</span>
                  <input
                    type="number"
                    value={stage.maxRadius}
                    min={1} max={100}
                    onChange={e => updateStage(i, 'maxRadius', Number(e.target.value))}
                    className="w-16 px-2 py-1 text-center border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-amber-400 bg-white"
                  />
                  <span className="text-xs text-gray-500">كم</span>
                </div>

                {/* Wait Time */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                  <Clock size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 whitespace-nowrap">انتظار</span>
                  <input
                    type="number"
                    value={stage.waitTime}
                    min={5} max={300}
                    onChange={e => updateStage(i, 'waitTime', Number(e.target.value))}
                    className="w-16 px-2 py-1 text-center border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-amber-400 bg-white"
                  />
                  <span className="text-xs text-gray-500">ثانية</span>
                </div>

                {/* Max Providers */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                  <Users size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 whitespace-nowrap">مزودين</span>
                  <input
                    type="number"
                    value={stage.maxProviders}
                    min={1} max={20}
                    onChange={e => updateStage(i, 'maxProviders', Number(e.target.value))}
                    className="w-14 px-2 py-1 text-center border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-amber-400 bg-white"
                  />
                </div>

                {/* VIP Only toggle */}
                {vipEnabled && (
                  <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={stage.vipOnly}
                      onChange={e => updateStage(i, 'vipOnly', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-8 h-4 rounded-full transition-colors relative ${stage.vipOnly ? 'bg-amber-400' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${stage.vipOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs font-semibold text-amber-600 flex items-center gap-0.5">
                      <Star size={11} />
                      VIP
                    </span>
                  </label>
                )}

                {/* Delete */}
                <button
                  onClick={() => removeStage(i)}
                  disabled={stages.length <= 1}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Row */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 text-sm text-gray-500">
          <span>إجمالي: <strong className="text-gray-700">{totalSeconds}ث ({totalMinutes} دقيقة)</strong></span>
          <span>أقصى نطاق: <strong className="text-gray-700">{maxRadius} كم</strong> <span className="text-xs text-gray-400">(من أعلى مرحلة — المزودون الأبعد لا يُشعَرون)</span></span>
          <span>أقصى مزودين: <strong className="text-gray-700">{stages.reduce((s, r) => s + (r.maxProviders || 0), 0)}</strong></span>
        </div>
      </div>

      {/* Reject block duration */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-[220px]">
            <div className="p-2 rounded-xl bg-orange-50">
              <Clock size={22} className="text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">حظر المزود بعد رفض الطلب</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
                إذا رفض المزود طلباً، لا تصله طلبات <strong>نفس العميل</strong> لمدة محددة.
                لا يؤثر على عملاء آخرين. القيمة <strong>0</strong> تلغي الحظر بالكامل.
                الطلب الحالي يستمر بالبحث عن مزودين آخرين حتى لو رُفض.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={1440}
              value={rejectBlockMinutes}
              onChange={(e) => setRejectBlockMinutes(Number(e.target.value))}
              className="w-24 px-3 py-2 text-center border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-400"
            />
            <span className="text-sm text-gray-500 font-medium">دقيقة</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          الحالي: {Number(rejectBlockMinutes) === 0
            ? 'الحظر معطّل'
            : Number(rejectBlockMinutes) >= 60
              ? `${rejectBlockMinutes} دقيقة (${(rejectBlockMinutes / 60).toFixed(rejectBlockMinutes % 60 === 0 ? 0 : 1)} ساعة)`
              : `${rejectBlockMinutes} دقيقة`}
          {' '}— الافتراضي السابق كان 60 دقيقة.
        </p>
      </div>

      {/* Active reject blocks */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="font-bold text-gray-800">المزودون المحظورون بعد الرفض</h3>
            <p className="text-xs text-gray-500 mt-1">
              قائمة من رُفض طلبهم فحُجبوا عن نفس العميل. رفع الحظر يعيد وصول الطلبات فوراً.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">
              {blocks.filter((b) => b.isActive).length} نشط
            </span>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showExpiredBlocks}
                onChange={(e) => setShowExpiredBlocks(e.target.checked)}
              />
              إظهار المنتهي
            </label>
            <button
              type="button"
              onClick={fetchBlocks}
              disabled={loadingBlocks}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              title="تحديث"
            >
              <RefreshCw size={16} className={loadingBlocks ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loadingBlocks ? (
          <div className="flex items-center gap-2 text-gray-500 py-6">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">جاري تحميل المحظورين...</span>
          </div>
        ) : (showExpiredBlocks ? blocks : blocks.filter((b) => b.isActive)).length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
            {showExpiredBlocks ? 'لا يوجد أي سجل حظر.' : 'لا يوجد حظر نشط حالياً.'}
          </p>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {(showExpiredBlocks ? blocks : blocks.filter((b) => b.isActive)).map((block) => {
              const key = `${block.customerId}:${block.providerId}`;
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 ${block.isActive ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 text-sm">
                        المزود: {block.providerName || 'غير معروف'}
                        {block.providerPhone && (
                          <span className="text-gray-500 font-normal mr-2" dir="ltr">
                            ({block.providerPhone})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        العميل: {block.customerName || 'غير معروف'}
                        {block.customerPhone && (
                          <span className="text-gray-500 mr-2" dir="ltr">
                            ({block.customerPhone})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        السبب: {BLOCK_REASON_LABELS[block.reason] || block.reason || '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        ينتهي: {formatBlockUntil(block)}
                        {!block.isActive && <span className="mr-2 text-gray-400">(منتهٍ)</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${block.isActive ? 'bg-amber-200 text-amber-900' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {block.isActive ? 'نشط' : 'منتهٍ'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnblock(block.customerId, block.providerId)}
                        disabled={unblockingKey === key}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                      >
                        {unblockingKey === key ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
                        فك الحظر
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VIP Setting */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${vipEnabled ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <Star size={22} className={vipEnabled ? 'text-amber-500' : 'text-gray-400'} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">أولوية VIP</h3>
              <p className="text-xs text-gray-500">
                {vipEnabled
                  ? 'المراحل المحددة بـ VIP تُشعر فقط المزودين ذوي الأولوية'
                  : 'عند التفعيل يمكنك تخصيص مرحلة لإشعار مزودي VIP فقط'}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="sr-only"
              checked={vipEnabled}
              onChange={e => setVipEnabled(e.target.checked)}
            />
            <div className={`w-12 h-6 rounded-full transition-colors relative ${vipEnabled ? 'bg-amber-400' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${vipEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-sm font-semibold ${vipEnabled ? 'text-amber-600' : 'text-gray-400'}`}>
              {vipEnabled ? 'مفعّل' : 'معطّل'}
            </span>
          </label>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
        <div>
          <h3 className="font-semibold text-amber-800 mb-1">كيف يعمل النظام؟</h3>
          <p className="text-amber-700 text-sm leading-relaxed">
            يبدأ البحث من المرحلة الأولى وينتظر الوقت المحدد لكل مرحلة.
            إذا لم يقبل أحد، يتوسع للمرحلة التالية.
            كل مزود يستقبل إشعاراً واحداً فقط طوال عمر الطلب.
            الإعدادات تُحدَّث فوراً دون الحاجة لإعادة نشر الكود.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DistributionSettings;
