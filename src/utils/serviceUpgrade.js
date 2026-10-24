/**
 * تعديل/ترقية الخدمة على الطلب — من الطلب الأصلي إلى النهائي، ومن عدّله ومتى.
 *
 * المصادر (بالأولوية):
 *  - originalService: يكتبه السيرفر مرة واحدة عند إنشاء الطلب (onRequestCreated).
 *  - history: كل اقتراح/موافقة/رفض/تعديل إداري/تعديل سعر.
 *  - providerServiceModificationRequest: آخر اقتراح من المزود (يُستبدل عند اقتراح ثانٍ).
 *  - serviceModificationRequest: تعديل يطلبه العميل ويوافق عليه المزود.
 */

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

const toPrice = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const sameService = (a, b) =>
  !!a && !!b
  && String(a.name || '').trim() === String(b.name || '').trim()
  && toPrice(a.price) === toPrice(b.price);

const TERMINAL_STATUSES = new Set([
  'completed', 'timed_out', 'canceled_by_client', 'canceled_by_client_with_reason',
  'canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_admin',
  'escalated_to_city_manager', 'pending_review',
]);

const PROPOSAL_ACTIONS = new Set(['provider_proposed_service_change']);
const APPROVAL_ACTIONS = new Set(['provider_service_change_approved', 'service_modification_approved']);
const REJECTION_ACTIONS = new Set(['provider_service_change_rejected', 'service_modification_rejected']);
const DIRECT_CHANGE_ACTIONS = new Set(['admin_service_change', 'price_updated']);

/** هل سجل history يخص تعديل الخدمة أو السعر؟ */
export const isServiceChangeHistoryEntry = (h) =>
  !!h && (
    PROPOSAL_ACTIONS.has(h.action)
    || APPROVAL_ACTIONS.has(h.action)
    || REJECTION_ACTIONS.has(h.action)
    || DIRECT_CHANGE_ACTIONS.has(h.action)
    || h.action === 'service_modification_requested'
    || (h.oldService && h.newService)
  );

const byLabel = (by) => (
  by === 'admin' ? 'الإدارة'
    : by === 'provider' ? 'المزود'
      : by === 'customer' || by === 'client' ? 'العميل'
        : by || 'النظام'
);

/** الخدمة القديمة المذكورة في سجل history (إن وُجدت) */
const oldServiceFromEntry = (h) => {
  if (h.oldService?.name != null || h.oldService?.price != null) {
    return { name: h.oldService.name || '', price: toPrice(h.oldService.price) };
  }
  if (h.action === 'price_updated' && (h.previousServiceName != null || h.previousPrice != null)) {
    return { name: h.previousServiceName || null, price: toPrice(h.previousPrice) };
  }
  if (h.action === 'admin_service_change' && h.changes?.previousServiceName != null) {
    return { name: h.changes.previousServiceName, price: toPrice(h.changes.previousServicePrice) };
  }
  return null;
};

/**
 * @returns {null | {
 *   original: {id?: string, name: string, price: number|null},
 *   final: {name: string, price: number|null},
 *   changed: boolean,          // الخدمة أو السعر النهائي يختلف عن الأصلي
 *   isUpgrade: boolean,        // السعر النهائي أعلى من الأصلي
 *   priceDiff: number|null,
 *   pendingProposal: boolean,  // اقتراح مزود بانتظار رد العميل (الطلب ما زال جارياً)
 *   unansweredProposal: boolean, // اقتراح بقي بلا رد حتى انتهى الطلب
 *   proposedService: {name, price}|null, // آخر خدمة اقترحها المزود
 *   changedByRole: 'admin'|'provider'|'customer'|null, // من طبّق آخر تعديل فعلي
 *   proposals: number, approvals: number, rejections: number,
 *   proposedBy: string|null,   // معرّف المزود الذي اقترح آخر تعديل
 *   proposedAt: number, approvedAt: number, approvedBy: string|null,
 *   events: Array<{ action: string, message: string, by: string, at: number, oldService?: object, newService?: object }>,
 * }}
 */
export const resolveServiceChange = (order) => {
  if (!order) return null;

  const history = Array.isArray(order.history) ? order.history : [];
  const entries = history
    .filter(isServiceChangeHistoryEntry)
    .map((h) => ({ ...h, _at: toMs(h.timestamp) }))
    .sort((a, b) => a._at - b._at);

  const psm = order.providerServiceModificationRequest || null;
  const csm = order.serviceModificationRequest || null;

  if (!order.originalService && entries.length === 0 && !psm && !csm) return null;

  // الأصلي: ما كتبه السيرفر، وإلا أقدم «خدمة قديمة» في السجل، وإلا القديمة في آخر اقتراح
  let original = null;
  if (order.originalService?.name || order.originalService?.price != null) {
    original = {
      id: order.originalService.id || null,
      name: order.originalService.name || '',
      price: toPrice(order.originalService.price),
    };
  }
  if (!original) {
    const fromHistory = entries.map(oldServiceFromEntry).find(Boolean);
    if (fromHistory) original = fromHistory;
  }
  if (!original && psm?.oldService) {
    original = { id: psm.oldService.id || null, name: psm.oldService.name || '', price: toPrice(psm.oldService.price) };
  }
  if (!original && csm?.oldService) {
    original = { id: csm.oldService.id || null, name: csm.oldService.name || '', price: toPrice(csm.oldService.price) };
  }

  const final = {
    name: order.serviceName || '',
    price: toPrice(order.price) ?? toPrice(order.servicePrice),
  };
  if (!original) original = { ...final };
  if (original.name == null) original.name = final.name;

  const proposals = entries.filter((h) => PROPOSAL_ACTIONS.has(h.action)).length;
  const approvals = entries.filter((h) => APPROVAL_ACTIONS.has(h.action)).length;
  const rejections = entries.filter((h) => REJECTION_ACTIONS.has(h.action)).length;

  const lastProposal = [...entries].reverse().find((h) => PROPOSAL_ACTIONS.has(h.action));
  const lastApproval = [...entries].reverse().find((h) => APPROVAL_ACTIONS.has(h.action));
  const lastDirect = [...entries].reverse().find((h) => DIRECT_CHANGE_ACTIONS.has(h.action));

  const proposedBy = psm?.requestedBy || lastProposal?.providerId || lastDirect?.providerId || null;
  const proposedAt = toMs(psm?.requestedAt) || lastProposal?._at || 0;
  const approvedAt = toMs(psm?.approvedAt) || lastApproval?._at || 0;
  const approvedBy = lastApproval ? byLabel(lastApproval.updatedBy) : null;

  const priceDiff = original.price != null && final.price != null ? final.price - original.price : null;
  const changed = !sameService(original, final);
  const openProposal = psm?.status === 'pending' && !!psm.newService
    && !sameService(psm.newService, final);
  const isTerminal = TERMINAL_STATUSES.has(order.status);
  const pendingProposal = openProposal && !isTerminal;
  const unansweredProposal = openProposal && isTerminal;
  const proposedService = psm?.newService
    ? { name: psm.newService.name || '', price: toPrice(psm.newService.price) }
    : null;

  // من طبّق آخر تعديل: الإدارة مباشرة، أو العميل بموافقته على اقتراح المزود، أو المزود بتعديل السعر
  const lastApplied = [...entries].reverse().find((h) =>
    APPROVAL_ACTIONS.has(h.action) || DIRECT_CHANGE_ACTIONS.has(h.action));
  let changedByRole = null;
  if (lastApplied?.action === 'admin_service_change') changedByRole = 'admin';
  else if (lastApplied?.action === 'price_updated') changedByRole = 'provider';
  else if (lastApplied) changedByRole = lastApplied.updatedBy === 'provider' ? 'provider' : 'customer';
  else if (psm?.status === 'approved') changedByRole = 'customer';

  const events = entries.map((h) => ({
    action: h.action || '',
    message: h.message || '',
    by: byLabel(h.updatedBy),
    at: h._at,
    oldService: h.oldService || null,
    newService: h.newService || null,
  }));

  return {
    original,
    final,
    changed,
    isUpgrade: changed && priceDiff != null && priceDiff > 0,
    priceDiff,
    pendingProposal,
    unansweredProposal,
    proposedService,
    changedByRole,
    proposals,
    approvals,
    rejections,
    proposedBy,
    proposedAt,
    approvedAt,
    approvedBy,
    events,
  };
};

/** للقائمة والفلتر: «مُعدّل» إذا تغيّرت الخدمة/السعر فعلاً، أو هناك اقتراح معلّق */
export const serviceChangeBadge = (order) => {
  const info = resolveServiceChange(order);
  if (!info) return null;
  if (info.changed) return info.isUpgrade ? 'upgraded' : 'changed';
  if (info.pendingProposal) return 'pending';
  if (info.unansweredProposal) return 'unanswered';
  return null;
};

/**
 * تجميع لكل مزود: كم اقترح تعديلاً، كم قبل العميل، كم رفض أو تُرك بلا رد،
 * والمبلغ المضاف من الترقيات المقبولة. الطلب يُنسب لمن اقترح (أو المزود المعيّن).
 * @returns {Record<string, {
 *   proposals: number, accepted: number, upgrades: number, rejected: number,
 *   unanswered: number, pending: number, adminApplied: number, valueAdded: number,
 *   lastAt: number, orders: Array<{ id, orderNumber, status, original, final, priceDiff, outcome, at }>
 * }>}
 */
export const aggregateProviderServiceChanges = (orders) => {
  const result = {};
  (orders || []).forEach((order) => {
    const info = resolveServiceChange(order);
    if (!info || info.proposals === 0) return;
    const pid = info.proposedBy || order.providerId;
    if (!pid) return;
    const key = String(pid);
    if (!result[key]) {
      result[key] = {
        proposals: 0, accepted: 0, upgrades: 0, rejected: 0,
        unanswered: 0, pending: 0, adminApplied: 0, valueAdded: 0, lastAt: 0, orders: [],
      };
    }
    const row = result[key];
    row.proposals += info.proposals;
    row.rejected += info.rejections;

    let outcome = 'other';
    if (info.changed && info.changedByRole === 'customer') {
      outcome = 'accepted';
      row.accepted += 1;
      if (info.isUpgrade) {
        row.upgrades += 1;
        row.valueAdded += info.priceDiff || 0;
      }
    } else if (info.changed && info.changedByRole === 'admin') {
      outcome = 'admin';
      row.adminApplied += 1;
    } else if (info.pendingProposal) {
      outcome = 'pending';
      row.pending += 1;
    } else if (info.unansweredProposal) {
      outcome = 'unanswered';
      row.unanswered += 1;
    } else if (info.rejections > 0) {
      outcome = 'rejected';
    }

    const at = info.approvedAt || info.proposedAt || 0;
    if (at > row.lastAt) row.lastAt = at;
    row.orders.push({
      id: order.id,
      orderNumber: order.orderNumber ?? null,
      status: order.status || '',
      original: info.original,
      final: info.final,
      proposed: info.proposedService,
      priceDiff: info.priceDiff,
      outcome,
      at,
    });
  });
  return result;
};
