import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { isPhoneBlocked } from './adminService';
import { ACCOUNT_CHANGE_LOG, normalizePhone966, phoneVariants } from '../utils/accountChangeLog';

/**
 * سجل الحساب: من رقم مرجعي (C…/P…) أو جوال (حالي أو سابق) إلى كل ما يخص صاحبه.
 * صفحة العرض: pages/AccountHistory.jsx
 */
const KIND_BY_PREFIX = { C: 'customers', P: 'providers' };
const NUMBER_FIELD = { customers: 'customerNumber', providers: 'providerNumber' };
const PREVIOUS_NUMBER_FIELD = { customers: 'previousCustomerNumbers', providers: 'previousProviderNumbers' };

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

const docsOf = async (q) => (await getDocs(q).catch(() => ({ docs: [] }))).docs;

const accountOf = (kind, snap) => ({ kind, id: snap.id, data: snap.data() });

function dedupeAccounts(list) {
  const seen = new Map();
  list.forEach((a) => { if (a && !seen.has(`${a.kind}/${a.id}`)) seen.set(`${a.kind}/${a.id}`, a); });
  return [...seen.values()];
}

async function accountsByPhones(phones) {
  const variants = [...new Set(phones.flatMap(phoneVariants))].slice(0, 30);
  const normalized = [...new Set(phones.map(normalizePhone966).filter(Boolean))].slice(0, 30);
  if (!variants.length) return [];

  const [provCurrent, custCurrent, provPrev, custPrev, logs] = await Promise.all([
    docsOf(query(collection(db, 'providers'), where('phone', 'in', variants))),
    docsOf(query(collection(db, 'customers'), where('phone', 'in', variants))),
    docsOf(query(collection(db, 'providers'), where('previousPhones', 'array-contains-any', normalized))),
    docsOf(query(collection(db, 'customers'), where('previousPhones', 'array-contains-any', normalized))),
    docsOf(query(collection(db, ACCOUNT_CHANGE_LOG), where('phones', 'array-contains-any', normalized))),
  ]);

  const fromLogs = await Promise.all(logs.map(async (l) => {
    const { kind, accountId } = l.data();
    if (!kind || !accountId) return null;
    const snap = await getDoc(doc(db, kind, accountId)).catch(() => null);
    return snap?.exists() ? accountOf(kind, snap) : null;
  }));

  return dedupeAccounts([
    ...provCurrent.map((s) => accountOf('providers', s)),
    ...custCurrent.map((s) => accountOf('customers', s)),
    ...provPrev.map((s) => accountOf('providers', s)),
    ...custPrev.map((s) => accountOf('customers', s)),
    ...fromLogs,
  ]);
}

/** بحث برقم مرجعي أو جوال أو معرّف المستند */
export async function findAccounts(term) {
  const raw = String(term || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const numberMatch = upper.match(/^([CP])\s*-?\s*(\d+)$/);
  if (numberMatch) {
    const kind = KIND_BY_PREFIX[numberMatch[1]];
    const number = `${numberMatch[1]}${numberMatch[2]}`;
    const [current, previous] = await Promise.all([
      docsOf(query(collection(db, kind), where(NUMBER_FIELD[kind], '==', number))),
      docsOf(query(collection(db, kind), where(PREVIOUS_NUMBER_FIELD[kind], 'array-contains', number))),
    ]);
    // الحساب النشط أولاً (المدموج في غيره بعده)
    return dedupeAccounts([...current, ...previous].map((s) => accountOf(kind, s)))
      .sort((a, b) => Number(!!a.data.mergedInto) - Number(!!b.data.mergedInto));
  }
  if (/^[+\d\s-]{9,}$/.test(raw)) return accountsByPhones([raw]);

  const [p, c] = await Promise.all([
    getDoc(doc(db, 'providers', raw)).catch(() => null),
    getDoc(doc(db, 'customers', raw)).catch(() => null),
  ]);
  return [p?.exists() && accountOf('providers', p), c?.exists() && accountOf('customers', c)].filter(Boolean);
}

/** كل الأرقام التي حملها الحساب مع أول ظهور لكل منها */
function collectPhones(account, changeLog, profileRequests) {
  const phones = new Map();
  const add = (phone, info) => {
    const n = normalizePhone966(phone);
    if (!n) return;
    const prev = phones.get(n) || { phone: n, events: [] };
    if (info) prev.events.push(info);
    phones.set(n, prev);
  };
  add(account.data.phone || account.data.phoneNumber, null);
  (account.data.previousPhones || []).forEach((p) => add(p, null));
  changeLog.forEach((entry) => {
    entry.changes?.filter((c) => c.field === 'phone').forEach((c) => {
      add(c.from, { type: 'replaced', atMs: entry.atMs, by: entry.by, source: entry.source });
      add(c.to, { type: 'added', atMs: entry.atMs, by: entry.by, source: entry.source });
    });
  });
  profileRequests.filter((r) => r.status === 'approved').forEach((r) => {
    const from = r.currentData?.phone;
    const to = r.requestedChanges?.phone;
    if (from && to && normalizePhone966(from) !== normalizePhone966(to)) {
      add(from, { type: 'replaced', atMs: r.reviewedAtMs || r.requestedAtMs, source: 'profile_change_request' });
      add(to, { type: 'added', atMs: r.reviewedAtMs || r.requestedAtMs, source: 'profile_change_request' });
    }
  });
  const current = normalizePhone966(account.data.phone || account.data.phoneNumber);
  return [...phones.values()].map((p) => ({ ...p, isCurrent: p.phone === current }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}

export async function loadAccountHistory(account) {
  const { kind, id, data } = account;
  const isProvider = kind === 'providers';

  const [logSnaps, profileSnaps, requestSnaps, mergedSnaps, limitsSnap] = await Promise.all([
    docsOf(query(collection(db, ACCOUNT_CHANGE_LOG), where('accountId', '==', id))),
    isProvider
      ? docsOf(query(collection(db, 'providerProfileChangeRequests'), where('providerId', '==', id)))
      : Promise.resolve([]),
    docsOf(query(collection(db, 'requests'), where(isProvider ? 'providerId' : 'customerId', '==', id))),
    docsOf(query(collection(db, kind), where('mergedInto', '==', id))),
    isProvider ? Promise.resolve(null) : getDoc(doc(db, 'customer_request_limits', id)).catch(() => null),
  ]);

  const changeLog = logSnaps.map((s) => ({ id: s.id, ...s.data(), atMs: toMs(s.data().at) }))
    .sort((a, b) => b.atMs - a.atMs);
  const profileRequests = profileSnaps.map((s) => ({
    id: s.id, ...s.data(), requestedAtMs: toMs(s.data().requestedAt), reviewedAtMs: toMs(s.data().reviewedAt),
  })).sort((a, b) => b.requestedAtMs - a.requestedAtMs);

  const phones = collectPhones(account, changeLog, profileRequests);

  const linked = dedupeAccounts([
    ...(await accountsByPhones(phones.map((p) => p.phone))),
    ...mergedSnaps.map((s) => accountOf(kind, s)),
  ]).filter((a) => !(a.kind === kind && a.id === id));
  if (data.mergedInto) {
    const keeper = await getDoc(doc(db, kind, data.mergedInto)).catch(() => null);
    if (keeper?.exists() && !linked.some((a) => a.id === keeper.id)) linked.push(accountOf(kind, keeper));
  }

  // طلبات النسخ المدموجة في هذا الحساب (نفس الشخص بمعرّف قديم)
  const mergedRequestSnaps = (await Promise.all(mergedSnaps.map((m) => docsOf(query(
    collection(db, 'requests'), where(isProvider ? 'providerId' : 'customerId', '==', m.id),
  ))))).flat();
  const requests = [...new Map([...requestSnaps, ...mergedRequestSnaps].map((s) => [s.id, s])).values()]
    .map((s) => ({ id: s.id, ...s.data(), createdAtMs: toMs(s.data().createdAt) }))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  const blockedPhones = (await Promise.all(
    phones.map(async (p) => ((await isPhoneBlocked(p.phone).catch(() => false)) ? p.phone : null)),
  )).filter(Boolean);

  return {
    phones,
    changeLog,
    profileRequests,
    linked,
    requests,
    blockedPhones,
    cancelLimits: limitsSnap?.exists() ? limitsSnap.data() : null,
  };
}

export { toMs };
