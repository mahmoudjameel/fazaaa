import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Image as ImageIcon, Plus, Trash2, ExternalLink, Loader2, Search, CheckSquare, Square,
  MessageCircle, ChevronDown, ChevronUp, ArrowRight, Check, RotateCcw,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../services/firebase';
import { getProviderIdsWithCompletedOrders } from '../services/adminService';
import {
  ACCEPTED_TYPES,
  listenToProviderDocuments,
  uploadProviderDocument,
  deleteProviderDocument,
  listenToWhatsAppCampaigns,
  createManualCampaign,
  markManualCampaignResult,
} from '../services/providerDocumentsService';

const DISPATCH_STALE_MIN = 30;

/** على الجوال نفتح تطبيق واتساب مباشرة؛ على الكمبيوتر نعيد استخدام نفس التبويب لكل مزود */
const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const POPUP_BLOCKED_MSG = 'المتصفح منع فتح واتساب — اسمح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع ثم أعد المحاولة';

const DEFAULT_MANUAL_MESSAGE =
  'السلام عليكم {name}، معك فريق فزاعين.\n{title}\nالملف: {link}';

const AUDIENCES = [
  { value: 'all', label: 'كل المعتمدين' },
  { value: 'active', label: 'النشطون الآن' },
  { value: 'inactive', label: 'غير النشطين' },
];

const ORDER_FILTERS = [
  { value: 'all', label: 'كل المزودين (الطلبات)' },
  { value: '2', label: 'نفّذ أكثر من طلب' },
  { value: '1', label: 'نفّذ طلباً واحداً على الأقل' },
  { value: '0', label: 'لم ينفّذ أي طلب' },
];

const NATIONALITY_FILTERS = [
  { value: 'all', label: 'كل الجنسيات' },
  { value: 'non_saudi', label: 'غير سعودي' },
  { value: 'saudi', label: 'سعودي' },
];

/** الجنسية مخزنة بأشكال مختلفة: nationality = sa | سعودي | ye…، و providerType = saudi | non_saudi */
const SAUDI_VALUES = new Set(['sa', 'saudi', 'سعودي', 'السعودية', 'سعودية']);
const providerNationalityGroup = (p) => {
  const nat = String(p.nationality || '').trim().toLowerCase();
  if (p.providerType === 'saudi' || SAUDI_VALUES.has(nat)) return 'saudi';
  if (p.providerType === 'non_saudi' || nat) return 'non_saudi';
  return 'unknown';
};

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (v.toMillis) return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};
const providerName = (p) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || p.name || 'بدون اسم';
const providerCityLabel = (p) => p.cityName || p.city || 'غير محدد';
const localPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('966')) return `0${d.slice(3)}`;
  return d.startsWith('0') ? d : `0${d}`;
};
const intlPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('966') ? d : `966${d.replace(/^0/, '')}`;
};
const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil((bytes || 0) / 1024)} KB`);
const fmtDate = (v) => {
  const ms = toMs(v);
  return ms ? format(new Date(ms), 'yyyy/MM/dd HH:mm') : '—';
};

export const ProviderDocuments = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastOpened, setLastOpened] = useState(null);

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [audience, setAudience] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [excluded, setExcluded] = useState(() => new Set());
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const [completedCounts, setCompletedCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  const [manualMessage, setManualMessage] = useState(DEFAULT_MANUAL_MESSAGE);
  const [manualCampaign, setManualCampaign] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => listenToProviderDocuments(setDocuments), []);
  useEffect(() => listenToWhatsAppCampaigns(setCampaigns), []);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'providers'), where('approvalStatus', '==', 'approved')));
        setProviders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.isActive !== false && p.phone));
      } catch (e) {
        console.error('ProviderDocuments providers:', e);
      } finally {
        setLoadingProviders(false);
      }
    })();
  }, []);
  useEffect(() => {
    getProviderIdsWithCompletedOrders()
      .then((res) => setCompletedCounts(res?.counts || {}))
      .catch((e) => console.error('ProviderDocuments completed counts:', e))
      .finally(() => setLoadingCounts(false));
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!selectedDocId && documents.length > 0) setSelectedDocId(documents[0].id);
  }, [documents, selectedDocId]);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  const cityOptions = useMemo(() => [...new Set(providers.map(providerCityLabel))].sort(), [providers]);

  const audienceList = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '').replace(/^0/, '');
    return providers.filter((p) => {
      const fresh = now - toMs(p.locationUpdatedAt) <= DISPATCH_STALE_MIN * 60000;
      if (audience === 'active' && !fresh) return false;
      if (audience === 'inactive' && fresh) return false;
      if (cityFilter !== 'all' && providerCityLabel(p) !== cityFilter) return false;
      if (nationalityFilter !== 'all' && providerNationalityGroup(p) !== nationalityFilter) return false;
      if (ordersFilter !== 'all') {
        const done = completedCounts[String(p.id)] || 0;
        if (ordersFilter === '0' ? done !== 0 : done < Number(ordersFilter)) return false;
      }
      if (q) {
        const nameHit = providerName(p).toLowerCase().includes(q);
        const phoneHit = qDigits.length >= 3 && String(p.phone).includes(qDigits);
        if (!nameHit && !phoneHit) return false;
      }
      return true;
    });
  }, [providers, audience, cityFilter, nationalityFilter, ordersFilter, completedCounts, search]);

  const recipients = audienceList.filter((p) => !excluded.has(p.id));
  const toggleRecipient = (id) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // اختيار الملف يرفعه مباشرة — العنوان = اسم الملف بدون الامتداد
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const id = await uploadProviderDocument(file, file.name.replace(/\.[^.]+$/, ''));
      setSelectedDocId(id);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setToast({ type: 'ok', text: 'تم رفع الملف' });
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'فشل رفع الملف' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`حذف «${d.title}»؟ الروابط المرسلة سابقاً ستتوقف عن العمل.`)) return;
    try {
      await deleteProviderDocument(d);
      if (selectedDocId === d.id) setSelectedDocId(null);
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'فشل الحذف' });
    }
  };

  const buildManualText = (p, docItem, template) => template
    .replace(/\{name\}/g, providerName(p).split(' ')[0] || '')
    .replace(/\{title\}/g, docItem?.title || '')
    .replace(/\{link\}/g, docItem?.url || '');

  const whatsAppUrl = (p, docItem, template) =>
    `https://wa.me/${intlPhone(p.phone)}?text=${encodeURIComponent(buildManualText(p, docItem, template))}`;

  // يجب أن يُستدعى مباشرة داخل الضغطة (قبل أي await) وإلا يمنعه المتصفح كنافذة منبثقة
  const openWhatsAppWindow = (url) => {
    const win = window.open(url, IS_MOBILE ? '_blank' : 'fz_whatsapp');
    if (!win) {
      setToast({ type: 'err', text: POPUP_BLOCKED_MSG });
      return false;
    }
    return true;
  };

  const startManualCampaign = async () => {
    if (!selectedDoc || recipients.length === 0) return;
    const first = recipients[0];
    const opened = openWhatsAppWindow(whatsAppUrl(first, selectedDoc, manualMessage));
    try {
      const ids = recipients.map((p) => p.id);
      const id = await createManualCampaign({
        documentId: selectedDoc.id,
        documentTitle: selectedDoc.title,
        message: manualMessage,
        providerIds: ids,
      });
      setManualCampaign({ id, documentId: selectedDoc.id, message: manualMessage, providerIds: ids, results: {} });
      if (opened) {
        setLastOpened(first);
        await markManualCampaignResult(id, first.id, 'sent');
      }
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'تعذر بدء الحملة' });
    }
  };

  // مزامنة حالة الحملة اليدوية الجارية من السجل (يمكن الإكمال من جهاز آخر)
  const liveManual = manualCampaign ? campaigns.find((c) => c.id === manualCampaign.id) || manualCampaign : null;
  const manualResults = liveManual?.results || {};
  const manualDoc = liveManual ? documents.find((d) => d.id === liveManual.documentId) : null;
  const providersById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const manualQueue = liveManual ? (liveManual.providerIds || []).map((id) => providersById.get(id)).filter(Boolean) : [];
  const manualPending = manualQueue.filter((p) => !manualResults[p.id]);
  const manualCurrent = manualPending[0] || null;
  const manualDone = manualQueue.length - manualPending.length;

  const sendManualTo = (p) => {
    const opened = openWhatsAppWindow(whatsAppUrl(p, manualDoc, liveManual.message || DEFAULT_MANUAL_MESSAGE));
    if (!opened) return;
    setLastOpened(p);
    markManual(p, 'sent');
  };

  const reopenLast = () => {
    if (!lastOpened) return;
    openWhatsAppWindow(whatsAppUrl(lastOpened, manualDoc || selectedDoc, liveManual?.message || manualMessage));
  };

  const markManual = async (p, status) => {
    try {
      await markManualCampaignResult(liveManual.id, p.id, status, manualResults[p.id]?.status);
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'تعذر حفظ الحالة' });
    }
  };

  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';
  const sectionTitle = 'text-sm font-black text-gray-900 mb-3';
  const pendingCampaigns = campaigns.filter((c) => Object.keys(c.results || {}).length < (c.providerIds || []).length);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">إرسال ملف للمزودين</h1>
          <p className="text-sm text-gray-500">صورة أو PDF عبر واتساب — مزود مزود</p>
        </div>
        <button onClick={() => navigate('/admin/providers')} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-teal-600">
          <ArrowRight className="w-4 h-4" /> المزودون
        </button>
      </div>

      {liveManual ? (
        /* ── وضع الإرسال: مزود واحد في الشاشة وزر واحد ── */
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-gray-500 truncate">«{liveManual.documentTitle || manualDoc?.title}»</span>
            <span className="font-black text-gray-900">{manualDone} من {manualQueue.length}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${manualQueue.length ? (manualDone / manualQueue.length) * 100 : 0}%` }} />
          </div>

          {manualCurrent ? (
            <div className="text-center space-y-4 py-2">
              <div>
                <div className="text-2xl font-black text-gray-900">{providerName(manualCurrent)}</div>
                <div className="text-sm text-gray-500 mt-1"><span dir="ltr">{localPhone(manualCurrent.phone)}</span> · {providerCityLabel(manualCurrent)}</div>
              </div>
              <button
                onClick={() => sendManualTo(manualCurrent)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-lg font-black"
              >
                <MessageCircle className="w-5 h-5" /> إرسال عبر واتساب
              </button>
              <button onClick={() => markManual(manualCurrent, 'skipped')} className="text-sm font-bold text-gray-400 hover:text-gray-700">
                تخطي هذا المزود
              </button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-1">
              <div className="w-12 h-12 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Check className="w-6 h-6" /></div>
              <div className="text-lg font-black text-gray-900">تم الإرسال للجميع</div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 text-xs font-bold">
            {lastOpened ? (
              <button onClick={reopenLast} className="flex items-center gap-1 text-green-700">
                <RotateCcw className="w-3.5 h-3.5" /> لم يفتح واتساب لـ {providerName(lastOpened).split(' ')[0]}؟ أعد الفتح
              </button>
            ) : <span />}
            <button onClick={() => { setManualCampaign(null); setLastOpened(null); }} className="text-gray-500 hover:text-gray-800">
              {manualCurrent ? 'إيقاف مؤقت' : 'إنهاء'}
            </button>
          </div>
        </div>
      ) : (
        /* ── التجهيز: ملف ← مستلمون ← إرسال ── */
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          <section className="p-5">
            <h2 className={sectionTitle}>1. الملف</h2>
            <div className="space-y-2">
              {documents.map((d) => {
                const active = d.id === selectedDocId;
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDocId(d.id)}
                    className={`cursor-pointer rounded-xl border px-3 py-2.5 flex items-center gap-3 ${active ? 'border-green-500 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${active ? 'border-green-600 bg-green-600 ring-2 ring-white ring-inset' : 'border-gray-300'}`} />
                    {d.kind === 'image'
                      ? <ImageIcon className="w-5 h-5 text-sky-500 flex-shrink-0" />
                      : <FileText className="w-5 h-5 text-rose-500 flex-shrink-0" />}
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-800">{d.title}</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{formatSize(d.size)}</span>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 text-gray-400 hover:text-teal-600" title="عرض">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(d); }} className="p-1 text-gray-400 hover:text-rose-600" title="حذف">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => handleUpload(e.target.files?.[0])}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-500 hover:border-green-400 hover:text-green-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {uploading ? 'جارٍ الرفع…' : 'رفع ملف جديد (صورة أو PDF)'}
              </button>
            </div>
          </section>

          <section className="p-5">
            <h2 className={sectionTitle}>2. إلى مين؟</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex flex-1 gap-1 bg-gray-50 rounded-xl p-1">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => { setAudience(a.value); setExcluded(new Set()); }}
                    className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold ${audience === a.value ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="relative sm:w-44">
                <select
                  value={cityFilter}
                  onChange={(e) => { setCityFilter(e.target.value); setExcluded(new Set()); }}
                  className="w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">كل المدن</option>
                  {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                [ordersFilter, setOrdersFilter, ORDER_FILTERS],
                [nationalityFilter, setNationalityFilter, NATIONALITY_FILTERS],
              ].map(([value, setValue, options], idx) => (
                <div key={idx} className="relative">
                  <select
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setExcluded(new Set()); }}
                    className={`w-full appearance-none pr-3 pl-7 py-2.5 rounded-xl text-sm font-bold focus:outline-none cursor-pointer ${value !== 'all' ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'}`}
                  >
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-600">
                {loadingProviders || (ordersFilter !== 'all' && loadingCounts)
                  ? 'جارٍ التحميل…'
                  : <><span className="font-black text-gray-900">{recipients.length}</span> مزود</>}
              </span>
              <button onClick={() => setShowList((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-teal-700">
                {showList ? 'إخفاء القائمة' : 'اختيار مزودين محددين'}
                {showList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            {showList && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم" className={`${inputCls} pr-9`} />
                </div>
                <div className="flex gap-3 text-xs font-bold text-gray-500">
                  <button onClick={() => setExcluded(new Set())}>تحديد الكل</button>
                  <button onClick={() => setExcluded(new Set(audienceList.map((p) => p.id)))}>إلغاء الكل</button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {audienceList.map((p) => {
                    const on = !excluded.has(p.id);
                    return (
                      <button key={p.id} onClick={() => toggleRecipient(p.id)} className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-gray-50">
                        {on ? <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                        <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-800">{providerName(p)}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{completedCounts[String(p.id)] || 0} طلب</span>
                        <span className="text-xs text-gray-400" dir="ltr">{localPhone(p.phone)}</span>
                      </button>
                    );
                  })}
                  {audienceList.length === 0 && <div className="text-sm text-gray-400 text-center py-6">لا يوجد مزودون</div>}
                </div>
              </div>
            )}
          </section>

          <section className="p-5 space-y-3">
            <button onClick={() => setShowMessage((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-teal-700">
              {showMessage ? 'إخفاء نص الرسالة' : 'تعديل نص الرسالة'}
              {showMessage ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showMessage && (
              <div className="space-y-1">
                <textarea value={manualMessage} onChange={(e) => setManualMessage(e.target.value)} rows={4} className={inputCls} />
                <p className="text-xs text-gray-400">
                  <span dir="ltr">{'{name}'}</span> الاسم · <span dir="ltr">{'{title}'}</span> عنوان الملف · <span dir="ltr">{'{link}'}</span> رابط الملف
                </p>
              </div>
            )}
            <button
              onClick={startManualCampaign}
              disabled={!selectedDoc || recipients.length === 0}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-lg font-black disabled:opacity-40"
            >
              <MessageCircle className="w-5 h-5" /> ابدأ الإرسال عبر واتساب
            </button>
            <p className="text-xs text-gray-400 text-center">
              {selectedDoc ? 'يفتح واتساب لكل مزود والرسالة جاهزة مع رابط الملف — اضغط إرسال داخل واتساب' : 'ارفع ملفاً أو اختر واحداً أولاً'}
            </p>
          </section>
        </div>
      )}

      {pendingCampaigns.length > 0 && !liveManual && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-sm">
          <span className="font-bold text-amber-800 truncate">
            إرسال غير مكتمل: «{pendingCampaigns[0].documentTitle}» ({Object.keys(pendingCampaigns[0].results || {}).length} من {(pendingCampaigns[0].providerIds || []).length})
          </span>
          <button onClick={() => setManualCampaign(pendingCampaigns[0])} className="font-black text-amber-900 whitespace-nowrap">متابعة</button>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="text-center">
          <button onClick={() => setShowHistory((v) => !v)} className="text-xs font-bold text-gray-400 hover:text-gray-700">
            {showHistory ? 'إخفاء السجل' : `الإرسالات السابقة (${campaigns.length})`}
          </button>
          {showHistory && (
            <div className="mt-2 bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 text-right">
              {campaigns.map((c) => {
                const total = (c.providerIds || []).length;
                const done = Object.keys(c.results || {}).length;
                return (
                  <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0 truncate font-bold text-gray-800">{c.documentTitle || '—'}</span>
                    <span className="text-gray-500">{done} / {total}</span>
                    <span className="text-xs text-gray-400" dir="ltr">{fmtDate(c.createdAt)}</span>
                    {done < total && (
                      <button onClick={() => setManualCampaign(c)} className="text-xs font-black text-teal-700">متابعة</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${toast.type === 'ok' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};
