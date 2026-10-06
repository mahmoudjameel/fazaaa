import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Image as ImageIcon, Upload, Trash2, ExternalLink, Loader2, Search, CheckSquare, Square,
  MessageCircle, ChevronDown, ArrowRight, SkipForward, Check, History,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../services/firebase';
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

const DEFAULT_MANUAL_MESSAGE =
  'السلام عليكم {name}، معك فريق فزاعين.\n{title}\nالملف: {link}';

const AUDIENCES = [
  { value: 'all', label: 'كل المعتمدين' },
  { value: 'active', label: 'النشطون الآن' },
  { value: 'inactive', label: 'غير النشطين' },
];

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

const Card = ({ step, title, children, right }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {step && <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-sm font-black flex items-center justify-center">{step}</span>}
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
      </div>
      {right}
    </div>
    {children}
  </div>
);

export const ProviderDocuments = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [audience, setAudience] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [excluded, setExcluded] = useState(() => new Set());

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
      if (q) {
        const nameHit = providerName(p).toLowerCase().includes(q);
        const phoneHit = qDigits.length >= 3 && String(p.phone).includes(qDigits);
        if (!nameHit && !phoneHit) return false;
      }
      return true;
    });
  }, [providers, audience, cityFilter, search]);

  const recipients = audienceList.filter((p) => !excluded.has(p.id));
  const toggleRecipient = (id) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const id = await uploadProviderDocument(uploadFile, uploadTitle || uploadFile.name.replace(/\.[^.]+$/, ''));
      setSelectedDocId(id);
      setUploadFile(null);
      setUploadTitle('');
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

  const startManualCampaign = async () => {
    if (!selectedDoc || recipients.length === 0) return;
    try {
      const ids = recipients.map((p) => p.id);
      const id = await createManualCampaign({
        documentId: selectedDoc.id,
        documentTitle: selectedDoc.title,
        message: manualMessage,
        providerIds: ids,
      });
      setManualCampaign({ id, documentId: selectedDoc.id, message: manualMessage, providerIds: ids, results: {} });
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

  const openManualWhatsApp = (p) => {
    const text = buildManualText(p, manualDoc, liveManual.message || DEFAULT_MANUAL_MESSAGE);
    window.open(`https://wa.me/${intlPhone(p.phone)}?text=${encodeURIComponent(text)}`, 'fz_whatsapp');
  };

  const markManual = async (p, status) => {
    try {
      await markManualCampaignResult(liveManual.id, p.id, status, manualResults[p.id]?.status);
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'تعذر حفظ الحالة' });
    }
  };

  const selectCls =
    'w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer';
  const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">إرسال الوثائق للمزودين</h1>
            <p className="text-sm text-gray-500">ارفع PDF أو صورة وأرسلها للمزودين عبر واتساب</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/providers')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600 hover:text-teal-600"
        >
          <ArrowRight className="w-4 h-4" /> المزودون
        </button>
      </div>

      <Card step="1" title="الملف">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="text-sm file:ml-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-teal-50 file:text-teal-700 file:font-bold"
          />
          <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="عنوان الملف (مثال: نموذج التعهد)" className={inputCls} />
          <button
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-black disabled:opacity-40"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} رفع
          </button>
        </div>
        <p className="text-xs text-gray-400">PDF حتى 16MB · صورة JPG/PNG حتى 5MB</p>
        {documents.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">لا توجد ملفات بعد — ارفع أول ملف</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((d) => {
              const active = d.id === selectedDocId;
              const Icon = d.kind === 'image' ? ImageIcon : FileText;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDocId(d.id)}
                  className={`cursor-pointer rounded-xl border p-3 flex items-center gap-3 transition ${active ? 'border-teal-400 ring-2 ring-teal-100 bg-teal-50/40' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  {d.kind === 'image'
                    ? <img src={d.url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0"><Icon className="w-6 h-6" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{d.title}</div>
                    <div className="text-xs text-gray-400">{d.kind === 'image' ? 'صورة' : 'PDF'} · {formatSize(d.size)} · {fmtDate(d.createdAt)}</div>
                  </div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-gray-400 hover:text-teal-600" title="فتح">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(d); }} className="p-1.5 text-gray-400 hover:text-rose-600" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        step="2"
        title="المستلمون"
        right={<span className="text-sm text-gray-500"><span className="font-black text-gray-900">{recipients.length}</span> / {audienceList.length} مزود</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                onClick={() => { setAudience(a.value); setExcluded(new Set()); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${audience === a.value ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setExcluded(new Set()); }} className={selectCls}>
              <option value="all">كل المدن</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم" className={`${inputCls} pr-9`} />
          </div>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <button onClick={() => setExcluded(new Set())} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">تحديد الكل</button>
          <button onClick={() => setExcluded(new Set(audienceList.map((p) => p.id)))} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">إلغاء الكل</button>
        </div>
        {loadingProviders ? (
          <div className="flex justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
            {audienceList.map((p) => {
              const on = !excluded.has(p.id);
              return (
                <button key={p.id} onClick={() => toggleRecipient(p.id)} className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-gray-50">
                  {on ? <CheckSquare className="w-4 h-4 text-teal-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-800">{providerName(p)}</span>
                  <span className="text-xs text-gray-400">{providerCityLabel(p)}</span>
                  <span className="text-xs text-gray-500 w-24 text-left" dir="ltr">{localPhone(p.phone)}</span>
                </button>
              );
            })}
            {audienceList.length === 0 && <div className="text-sm text-gray-400 text-center py-6">لا يوجد مزودون بهذه الفلاتر</div>}
          </div>
        )}
      </Card>

      <div id="fz-send-card" />
      <Card step="3" title="الإرسال عبر واتساب">
        {!selectedDoc && <div className="text-sm text-amber-700 font-bold">اختر ملفاً من الخطوة 1</div>}

        {!liveManual && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              يفتح محادثة كل مزود بالرسالة جاهزة ومعها رابط الملف — تضغط إرسال في واتساب ثم «التالي». المتغيرات:
              <span dir="ltr" className="font-mono"> {'{name} {title} {link}'}</span>
            </p>
            <textarea value={manualMessage} onChange={(e) => setManualMessage(e.target.value)} rows={4} className={inputCls} />
            <button
              onClick={startManualCampaign}
              disabled={!selectedDoc || recipients.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-black disabled:opacity-40"
            >
              <MessageCircle className="w-4 h-4" /> ابدأ الإرسال لـ {recipients.length} مزود
            </button>
          </div>
        )}

        {liveManual && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-700">«{liveManual.documentTitle || manualDoc?.title}»</span>
              <span className="text-gray-500">{manualDone} / {manualQueue.length}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${manualQueue.length ? (manualDone / manualQueue.length) * 100 : 0}%` }} />
            </div>
            {manualCurrent ? (
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-3">
                <div>
                  <div className="font-black text-gray-900">{providerName(manualCurrent)}</div>
                  <div className="text-xs text-gray-500"><span dir="ltr">{localPhone(manualCurrent.phone)}</span> · {providerCityLabel(manualCurrent)}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => openManualWhatsApp(manualCurrent)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-black">
                    <MessageCircle className="w-4 h-4" /> فتح واتساب
                  </button>
                  <button onClick={() => markManual(manualCurrent, 'sent')} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-black">
                    <Check className="w-4 h-4" /> أُرسل — التالي
                  </button>
                  <button onClick={() => markManual(manualCurrent, 'skipped')} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">
                    <SkipForward className="w-4 h-4" /> تخطي
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-green-50 text-green-700 font-black text-center py-4">اكتملت الحملة ✓</div>
            )}
            <button onClick={() => setManualCampaign(null)} className="text-xs font-bold text-gray-500 hover:text-gray-800">إغلاق الحملة (يمكن متابعتها لاحقاً من السجل)</button>
          </div>
        )}
      </Card>

      <Card title="سجل الإرسال" right={<History className="w-5 h-5 text-gray-400" />}>
        {campaigns.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">لا توجد حملات بعد</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {campaigns.map((c) => {
              const total = (c.providerIds || []).length;
              const done = Object.keys(c.results || {}).length;
              return (
                <div key={c.id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-bold text-gray-800 flex-1 min-w-0 truncate">{c.documentTitle || '—'}</span>
                  <span className="text-green-700 font-bold">أُرسل {Number(c.sent) || 0}</span>
                  <span className="text-gray-500">{done} / {total}</span>
                  <span className="text-xs text-gray-400" dir="ltr">{fmtDate(c.createdAt)}</span>
                  {done < total && (
                    <button
                      onClick={() => {
                        setManualCampaign(c);
                        document.getElementById('fz-send-card')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-xs font-black text-teal-700"
                    >
                      متابعة
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${toast.type === 'ok' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};
