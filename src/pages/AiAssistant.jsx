import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Bot, Check, ChevronDown, Loader2, MessageSquarePlus, Search, Send, ShieldCheck, Wrench, X,
} from 'lucide-react';
import { auth, db, functions } from '../services/firebase';
import SimpleMarkdown from '../components/SimpleMarkdown';

/**
 * مساعد الإدارة بالذكاء الاصطناعي (Claude) — functions/lib/adminAssistant.
 * يقرأ قاعدة البيانات والسجلات بنفسه، وأي تعديل يظهر هنا «اقتراحاً» لا يُنفَّذ إلا بزر التأكيد.
 */
const SUGGESTIONS = [
  'شخّص الطلب 100005246 وقل لي ليش راح لمزود غير المحدد',
  'ملخص آخر 7 أيام: الطلبات والإلغاءات والمدن الأضعف',
  'مين المزودين الموقوفين حالياً ولماذا؟',
  'عملاء موقوفين حالياً بسبب تكرار الإلغاء',
  'طلبات اليوم اللي انتهت بلا مزود — وين كانت وليش؟',
  'افتح ملف الحساب P10014 وأعطني ملاحظاتك',
];

const TOOL_LABEL = {
  diagnose_request: 'تشخيص طلب',
  account_lookup: 'ملف حساب',
  stats_overview: 'أرقام عامة',
  query_collection: 'استعلام',
  get_document: 'قراءة مستند',
  count_documents: 'عدّ',
  search_function_logs: 'سجلات السيرفر',
  propose_update_document: 'اقتراح تعديل',
  propose_delete_document: 'اقتراح حذف',
  propose_cancel_request: 'اقتراح إلغاء طلب',
  propose_suspend_provider: 'اقتراح إيقاف مزود',
  propose_lift_provider_suspension: 'اقتراح رفع إيقاف مزود',
  propose_lift_customer_block: 'اقتراح رفع إيقاف عميل',
};

const ACTION_STATUS = {
  pending: { text: 'بانتظار تأكيدك', cls: 'bg-amber-100 text-amber-800' },
  executing: { text: 'جارٍ التنفيذ…', cls: 'bg-sky-100 text-sky-700' },
  executed: { text: 'نُفّذ', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: 'مرفوض', cls: 'bg-gray-100 text-gray-600' },
  expired: { text: 'انتهت صلاحيته', cls: 'bg-gray-100 text-gray-600' },
  failed: { text: 'فشل التنفيذ', cls: 'bg-red-100 text-red-700' },
};

const fmtTime = (ms) => (ms ? format(new Date(ms), 'dd MMM، HH:mm', { locale: ar }) : '');

function ProposalCard({ proposal }) {
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(
    doc(db, 'ai_pending_actions', proposal.actionId),
    (snap) => setLive(snap.exists() ? snap.data() : null),
    () => {},
  ), [proposal.actionId]);

  const status = live?.status || 'pending';
  const expired = status === 'pending' && live?.expiresAtMs && Date.now() > live.expiresAtMs;
  const shown = ACTION_STATUS[expired ? 'expired' : status] || ACTION_STATUS.pending;

  const resolve = async (approve) => {
    if (approve && !window.confirm(`تنفيذ: ${proposal.summary}؟`)) return;
    setBusy(true);
    setError('');
    try {
      await httpsCallable(functions, 'adminAssistantAction')({ actionId: proposal.actionId, approve });
    } catch (e) {
      setError(e?.message || 'تعذر التنفيذ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-gray-900">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          {TOOL_LABEL[proposal.type] || proposal.type}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${shown.cls}`}>{shown.text}</span>
      </div>
      <p className="mt-1.5 text-gray-800">{proposal.summary}</p>
      {proposal.before && (
        <details className="mt-1.5">
          <summary className="text-xs text-gray-500 cursor-pointer">القيم الحالية قبل التعديل</summary>
          <pre className="mt-1 text-[11px] bg-white rounded-lg p-2 overflow-x-auto max-h-40" dir="ltr">
            {JSON.stringify(proposal.before, null, 2)}
          </pre>
        </details>
      )}
      {live?.error && <p className="mt-1 text-xs text-red-600">{live.error}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {status === 'pending' && !expired && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => resolve(true)}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            تأكيد التنفيذ
          </button>
          <button
            type="button"
            onClick={() => resolve(false)}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-60"
          >
            <X className="w-3.5 h-3.5" /> رفض
          </button>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ message }) {
  const [showTools, setShowTools] = useState(false);
  const tools = message.toolsUsed || [];
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 shrink-0 rounded-full bg-teal-600 text-white flex items-center justify-center"><Bot className="w-4 h-4" /></div>
      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl rounded-tr-sm px-4 py-3">
        <SimpleMarkdown text={message.text} />
        {(message.proposals || []).map((p) => <ProposalCard key={p.actionId} proposal={p} />)}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
          {tools.length > 0 && (
            <button type="button" onClick={() => setShowTools((v) => !v)} className="inline-flex items-center gap-1 hover:text-gray-600">
              <Search className="w-3 h-3" /> فحص {tools.length} مرة
              <ChevronDown className={`w-3 h-3 transition-transform ${showTools ? 'rotate-180' : ''}`} />
            </button>
          )}
          <span>{fmtTime(message.atMs)}</span>
        </div>
        {showTools && (
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-500">
            {tools.map((t, i) => (
              <li key={i} className="flex gap-1.5">
                <Wrench className={`w-3 h-3 mt-0.5 shrink-0 ${t.ok ? 'text-gray-400' : 'text-red-400'}`} />
                <span className="font-bold">{TOOL_LABEL[t.name] || t.name}</span>
                <span className="truncate" dir="ltr">{t.input}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [display, setDisplay] = useState([]);
  const [pendingUserText, setPendingUserText] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const snap = await getDocs(query(collection(db, 'ai_conversations'), where('adminUid', '==', uid))).catch(() => null);
    if (!snap) return;
    const list = snap.docs.map((d) => ({ id: d.id, title: d.data().title, updatedAtMs: d.data().updatedAt?.toMillis?.() || 0 }));
    list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    setConversations(list.slice(0, 40));
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!activeId) { setDisplay([]); return undefined; }
    return onSnapshot(doc(db, 'ai_conversations', activeId), (snap) => {
      const items = snap.exists() ? (snap.data().display || []) : [];
      setDisplay([...items].sort((a, b) => (a.atMs || 0) - (b.atMs || 0)));
    }, () => {});
  }, [activeId]);

  const shown = useMemo(() => (
    pendingUserText ? [...display, { role: 'user', text: pendingUserText, atMs: Date.now(), pending: true }] : display
  ), [display, pendingUserText]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [shown.length, sending]);

  const send = async (textArg) => {
    const text = String(textArg ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    setInput('');
    setPendingUserText(text);
    try {
      const res = await httpsCallable(functions, 'adminAssistantChat', { timeout: 540000 })({ conversationId: activeId, message: text });
      if (!activeId) {
        setActiveId(res.data.conversationId);
        loadConversations();
      }
    } catch (e) {
      setError(e?.message || 'تعذر الرد');
      setInput(text);
    } finally {
      setPendingUserText('');
      setSending(false);
    }
  };

  const newConversation = () => {
    setActiveId(null);
    setError('');
    setInput('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-7rem)] min-h-[560px]">
      <aside className="lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden max-h-56 lg:max-h-none">
        <div className="p-3 border-b border-gray-100">
          <button
            type="button"
            onClick={newConversation}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
          >
            <MessageSquarePlus className="w-4 h-4" /> محادثة جديدة
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && <p className="text-xs text-gray-400 p-2">لا توجد محادثات بعد</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`w-full text-right px-3 py-2 rounded-lg text-sm ${activeId === c.id ? 'bg-teal-50 text-teal-800 font-bold' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <div className="truncate">{c.title || 'محادثة'}</div>
              <div className="text-[11px] text-gray-400">{fmtTime(c.updatedAtMs)}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
        <header className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-2">
          <Bot className="w-5 h-5 text-teal-600" />
          <div>
            <h1 className="font-bold text-gray-900">مساعد الإدارة</h1>
            <p className="text-[11px] text-gray-500">يقرأ قاعدة البيانات والسجلات مباشرة. أي تعديل يظهر لك للتأكيد قبل تنفيذه.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {shown.length === 0 && !sending && (
            <div className="max-w-2xl mx-auto text-center pt-8">
              <Bot className="w-10 h-10 text-teal-600 mx-auto" />
              <p className="mt-2 font-bold text-gray-900">اسأل عن أي شيء في النظام</p>
              <p className="text-sm text-gray-500">طلب، مزود، عميل، شكوى، أرقام، أو مشكلة تحتاج تشخيص.</p>
              <div className="mt-5 grid sm:grid-cols-2 gap-2 text-right">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:border-teal-400 hover:bg-teal-50/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {shown.map((m, i) => (m.role === 'user' ? (
            <div key={`${m.atMs}-${i}`} className="flex justify-start">
              <div className={`max-w-[85%] bg-teal-600 text-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm whitespace-pre-wrap ${m.pending ? 'opacity-80' : ''}`}>
                {m.text}
              </div>
            </div>
          ) : (
            <AssistantMessage key={`${m.atMs}-${i}`} message={m} />
          )))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              يفحص البيانات… الأسئلة المعقدة قد تأخذ دقيقة أو أكثر
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <p className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t border-red-100">{error}</p>}

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="p-3 bg-white border-t border-gray-100 flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder="اكتب سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)"
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-10 w-10 shrink-0 rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-50"
            aria-label="إرسال"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -scale-x-100" />}
          </button>
        </form>
      </section>
    </div>
  );
}
