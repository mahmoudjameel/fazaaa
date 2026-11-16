import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Ban, History, Link2, Loader2, Phone, Search, ShoppingBag, TimerOff, User, Wrench,
} from 'lucide-react';
import { findAccounts, loadAccountHistory, toMs } from '../services/accountHistoryService';
import { TRACKED_FIELD_LABELS, formatPhoneLocal } from '../utils/accountChangeLog';
import AccountNumberUnifyPanel from '../components/AccountNumberUnifyPanel';

/**
 * سجل الحساب: ابحث برقم مرجعي (C14044 / P10023) أو بأي جوال حالي أو سابق،
 * وتظهر كل الأرقام التي حملها صاحبه، وتعديلاته، وحساباته المرتبطة، وطلباته.
 */
const KIND_LABEL = { customers: 'عميل', providers: 'مزود' };

const STATUS_LABEL = {
  searching: 'جاري البحث', assigned: 'مقبول', en_route: 'في الطريق', arrived: 'وصل',
  in_progress: 'قيد التنفيذ', pending_legal_docs: 'بانتظار السند', pending_client_confirmation: 'بانتظار تأكيد العميل',
  pending_review: 'بانتظار التقييم', completed: 'مكتمل', timed_out: 'لا يوجد مزود',
  canceled_by_client: 'ألغاه العميل', canceled_by_client_with_reason: 'ألغاه العميل',
  canceled_by_provider: 'ألغاه المزود', canceled_by_provider_with_reason: 'ألغاه المزود',
  canceled_by_admin: 'ألغته الإدارة', escalated_to_city_manager: 'مُصعّد',
};

const SOURCE_LABEL = {
  admin_edit: 'تعديل من لوحة التحكم',
  profile_change_request: 'طلب تعديل بيانات من المزود',
};

const REQUEST_STATUS_LABEL = { pending: 'بانتظار المراجعة', approved: 'مقبول', rejected: 'مرفوض' };

const fmtMs = (ms) => (ms ? format(new Date(ms), 'dd MMM yyyy، HH:mm', { locale: ar }) : '—');

const nameOf = (account) => {
  const d = account?.data || {};
  return d.fullName || [d.firstName, d.lastName].filter(Boolean).join(' ') || d.name || '—';
};
const numberOf = (account) => account?.data?.providerNumber || account?.data?.customerNumber || '—';

function Section({ icon: Icon, title, count, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <h2 className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 font-bold text-gray-900">
        <Icon className="w-5 h-5 text-teal-600" />
        {title}
        {count != null && <span className="text-xs font-semibold text-gray-400">({count})</span>}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function AccountChip({ account, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(account)}
      className="w-full text-right flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50/40"
    >
      <span className="flex items-center gap-2">
        {account.kind === 'providers' ? <Wrench className="w-4 h-4 text-amber-600" /> : <User className="w-4 h-4 text-sky-600" />}
        <span className="font-bold text-gray-800">{nameOf(account)}</span>
        <span className="text-xs text-gray-500">{KIND_LABEL[account.kind]}</span>
        {account.data.mergedInto && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">مدموج</span>}
      </span>
      <span className="font-mono text-xs text-gray-600" dir="ltr">
        {numberOf(account)} · {formatPhoneLocal(account.data.phone || account.data.phoneNumber)}
      </span>
    </button>
  );
}

export default function AccountHistory() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  const openAccount = useCallback(async (account) => {
    setSelected(account);
    setHistory(null);
    setLoadingHistory(true);
    try {
      setHistory(await loadAccountHistory(account));
    } catch (e) {
      setError(e?.message || 'تعذر تحميل السجل');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const runSearch = useCallback(async (value) => {
    const q = String(value || '').trim();
    if (!q) return;
    setSearching(true);
    setError('');
    setSelected(null);
    setHistory(null);
    try {
      const found = await findAccounts(q);
      setResults(found);
      const active = found.filter((a) => !a.data.mergedInto);
      if (found.length === 1) openAccount(found[0]);
      else if (active.length === 1) openAccount(active[0]);
    } catch (e) {
      setError(e?.message || 'تعذر البحث');
    } finally {
      setSearching(false);
    }
  }, [openAccount]);

  useEffect(() => {
    const q = params.get('q');
    if (q) runSearch(q);
    // البحث الأول فقط من الرابط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    setParams(term.trim() ? { q: term.trim() } : {});
    runSearch(term);
  };

  const requests = history?.requests || [];
  const isProvider = selected?.kind === 'providers';
  const canceledByThem = requests.filter((r) => String(r.status).startsWith(isProvider ? 'canceled_by_provider' : 'canceled_by_client')).length;
  const completed = requests.filter((r) => r.status === 'completed').length;
  const blockedUntilMs = toMs(history?.cancelLimits?.blockedUntil);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-7 h-7 text-teal-600" />
          سجل الحساب
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          ابحث بالرقم المرجعي (مثل C14044 أو P10023) أو بأي رقم جوال حالي أو سابق.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="C14044 أو 05xxxxxxxx"
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-60"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بحث'}
        </button>
      </form>

      {!selected && !results && <AccountNumberUnifyPanel />}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && results.length === 0 && !searching && (
        <p className="text-sm text-gray-500">لا يوجد حساب بهذا الرقم.</p>
      )}

      {results && results.length > 1 && !selected && (
        <Section icon={Search} title="نتائج البحث" count={results.length}>
          <div className="space-y-2">
            {results.map((a) => <AccountChip key={`${a.kind}/${a.id}`} account={a} onOpen={openAccount} />)}
          </div>
        </Section>
      )}

      {selected && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-teal-700" dir="ltr">{numberOf(selected)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{KIND_LABEL[selected.kind]}</span>
                {selected.data.approvalStatus && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{selected.data.approvalStatus}</span>
                )}
              </div>
              <div className="text-xl font-bold text-gray-900 mt-1">{nameOf(selected)}</div>
              <div className="text-sm text-gray-500 mt-0.5" dir="ltr">
                {formatPhoneLocal(selected.data.phone || selected.data.phoneNumber)}
                {selected.data.city ? ` · ${selected.data.city}` : ''}
              </div>
            </div>
            {history && (
              <div className="flex gap-4 text-center">
                <div><div className="text-2xl font-black text-gray-900">{requests.length}</div><div className="text-xs text-gray-500">طلب</div></div>
                <div><div className="text-2xl font-black text-emerald-600">{completed}</div><div className="text-xs text-gray-500">مكتمل</div></div>
                <div><div className="text-2xl font-black text-red-600">{canceledByThem}</div><div className="text-xs text-gray-500">ألغاه بنفسه</div></div>
              </div>
            )}
            {results?.length > 1 && (
              <button type="button" onClick={() => { setSelected(null); setHistory(null); }} className="text-sm text-teal-700 font-bold">
                رجوع للنتائج
              </button>
            )}
          </div>

          {loadingHistory && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

          {history && (
            <>
              {(history.blockedPhones.length > 0 || blockedUntilMs > Date.now() || selected.data.approvalStatus === 'suspended') && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-1 text-sm text-red-800">
                  {history.blockedPhones.map((p) => (
                    <div key={p} className="flex items-center gap-2"><Ban className="w-4 h-4" /> الرقم {formatPhoneLocal(p)} محظور</div>
                  ))}
                  {blockedUntilMs > Date.now() && (
                    <div className="flex items-center gap-2"><TimerOff className="w-4 h-4" /> موقوف عن الطلب لتكرار الإلغاء حتى {fmtMs(blockedUntilMs)}</div>
                  )}
                  {selected.data.approvalStatus === 'suspended' && (
                    <div className="flex items-center gap-2"><TimerOff className="w-4 h-4" /> المزود موقوف مؤقتاً{selected.data.suspension?.reason ? `: ${selected.data.suspension.reason}` : ''}</div>
                  )}
                </div>
              )}

              <Section icon={Phone} title="أرقام الجوال" count={history.phones.length}>
                <div className="space-y-2">
                  {history.phones.map((p) => (
                    <div key={p.phone} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50">
                      <span className="font-mono font-bold text-gray-800" dir="ltr">{formatPhoneLocal(p.phone)}</span>
                      <span className="text-xs">
                        {p.isCurrent
                          ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">الحالي</span>
                          : <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-bold">سابق</span>}
                      </span>
                      {p.events.length > 0 && (
                        <div className="w-full text-xs text-gray-500">
                          {p.events.map((ev, i) => (
                            <div key={i}>
                              {ev.type === 'added' ? 'أصبح الرقم الحالي' : 'استُبدل'} في {fmtMs(ev.atMs)}
                              {ev.source ? ` · ${SOURCE_LABEL[ev.source] || ev.source}` : ''}
                              {ev.by ? ` · ${ev.by}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={Link2} title="حسابات أخرى لنفس الشخص" count={history.linked.length}>
                {history.linked.length === 0 ? (
                  <p className="text-sm text-gray-500">لا توجد حسابات أخرى بنفس الأرقام.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">حسابات تحمل (أو حملت) أحد أرقام هذا الحساب، أو دُمجت معه.</p>
                    {history.linked.map((a) => (
                      <AccountChip key={`${a.kind}/${a.id}`} account={a} onOpen={openAccount} />
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={History} title="سجل تعديل البيانات" count={history.changeLog.length + history.profileRequests.length}>
                {history.changeLog.length + history.profileRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">لا توجد تعديلات مسجّلة. التسجيل يعمل من 16 نوفمبر 2026، وما قبله يظهر من طلبات تعديل المزودين فقط.</p>
                ) : (
                  <div className="space-y-3">
                    {history.changeLog.map((entry) => (
                      <div key={entry.id} className="border-r-4 border-teal-400 pr-3">
                        <div className="text-xs text-gray-500">
                          {fmtMs(entry.atMs)} · {SOURCE_LABEL[entry.source] || entry.source}{entry.by ? ` · ${entry.by}` : ''}
                        </div>
                        {entry.changes.map((c) => (
                          <div key={c.field} className="text-sm text-gray-800">
                            <span className="font-bold">{TRACKED_FIELD_LABELS[c.field] || c.field}:</span>{' '}
                            <span className="line-through text-gray-400">{c.field === 'phone' ? formatPhoneLocal(c.from) : (c.from || '—')}</span>
                            {' ← '}
                            <span>{c.field === 'phone' ? formatPhoneLocal(c.to) : (c.to || '—')}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {history.profileRequests.map((r) => (
                      <div key={r.id} className="border-r-4 border-amber-300 pr-3">
                        <div className="text-xs text-gray-500">
                          {fmtMs(r.requestedAtMs)} · طلب تعديل من المزود · {REQUEST_STATUS_LABEL[r.status] || r.status}
                        </div>
                        {Object.keys(r.requestedChanges || {})
                          .filter((f) => String(r.requestedChanges[f] ?? '') !== String(r.currentData?.[f] ?? ''))
                          .map((f) => (
                            <div key={f} className="text-sm text-gray-800">
                              <span className="font-bold">{TRACKED_FIELD_LABELS[f] || f}:</span>{' '}
                              <span className="line-through text-gray-400">{f === 'phone' ? formatPhoneLocal(r.currentData?.[f]) : (r.currentData?.[f] || '—')}</span>
                              {' ← '}
                              <span>{f === 'phone' ? formatPhoneLocal(r.requestedChanges[f]) : (r.requestedChanges[f] || '—')}</span>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {Array.isArray(selected.data.suspensionHistory) && selected.data.suspensionHistory.length > 0 && (
                <Section icon={TimerOff} title="سجل الإيقاف" count={selected.data.suspensionHistory.length}>
                  <div className="space-y-1 text-sm text-gray-700">
                    {selected.data.suspensionHistory.map((s, i) => (
                      <div key={i}>{fmtMs(toMs(s.at || s.suspendedAt))} · {s.reason || '—'}{s.byEmail ? ` · ${s.byEmail}` : ''}</div>
                    ))}
                  </div>
                </Section>
              )}

              <Section icon={ShoppingBag} title="الطلبات" count={requests.length}>
                {requests.length === 0 ? (
                  <p className="text-sm text-gray-500">لا توجد طلبات.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-500 bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-right">رقم الطلب</th>
                          <th className="px-3 py-2 text-right">التاريخ</th>
                          <th className="px-3 py-2 text-right">الخدمة</th>
                          <th className="px-3 py-2 text-right">الحالة</th>
                          <th className="px-3 py-2 text-right">سبب الإلغاء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {requests.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2 font-mono">{r.orderNumber || r.id.slice(0, 8)}</td>
                            <td className="px-3 py-2 text-gray-600">{fmtMs(r.createdAtMs)}</td>
                            <td className="px-3 py-2">{r.serviceName || '—'}</td>
                            <td className="px-3 py-2">{STATUS_LABEL[r.status] || r.status}</td>
                            <td className="px-3 py-2 text-gray-500">{r.cancelReason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
