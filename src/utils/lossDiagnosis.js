import { isNetworkTimeoutRequest } from './noCoverage';

/**
 * لماذا ضاع الطلب؟ التشخيص الدقيق من لقطة dispatch_audits (من يوم تفعيلها).
 * الطلبات الأقدم بلا لقطة: نعتمد ما سُجّل في الطلب نفسه ويُعلَّم تقديرياً.
 */
export const LOSS_REASONS = {
  no_providers: 'لا مزودين في المنطقة',
  idle: 'مزودون خاملون',
  low_balance: 'نقص رصيد',
  unavailable: 'أوقفوا أنفسهم',
  busy: 'مشغولون بطلبات',
  no_response: 'وصلهم ولم يتفاعل أحد',
  rejected: 'رفضوه',
  dispatch_gap: 'مؤهلون ولم يُرسل لهم',
  excluded: 'مستبعدون من هذا الطلب',
  customer_left: 'تركه العميل قبل القبول',
  not_notified: 'لم يصل لأحد (تقديري)',
};

export const AUDIT_STATUS_LABELS = {
  eligible_fresh: 'مؤهل',
  eligible_backup: 'مؤهل (بديل)',
  idle: 'خامل',
  stale_location: 'موقع قديم',
  low_balance: 'رصيد غير كافٍ',
  manual_off: 'أوقف نفسه',
  busy: 'في طلب',
  customer_blocked: 'محظور من العميل',
  rejected_before: 'رفض سابقاً',
};

const BLOCKER_TO_REASON = {
  idle: 'idle',
  stale_location: 'idle',
  low_balance: 'low_balance',
  manual_off: 'unavailable',
  busy: 'busy',
  customer_blocked: 'excluded',
  rejected_before: 'excluded',
};

const wasAccepted = (order) => Boolean(order?.assignedAt)
  || (Array.isArray(order?.history) && order.history.some((h) => h?.status === 'assigned'));

/** طلب انتهى بلا خدمة: انتهت مهلته، أو تركه العميل قبل أن يقبله أحد */
export const isLostRequest = (order) => {
  if (order?.status === 'completed') return false;
  if (isNetworkTimeoutRequest(order)) return true;
  return String(order?.status || '').startsWith('canceled_by_client') && !wasAccepted(order);
};

const largestBlocker = (summary) => {
  const totals = {};
  Object.entries(summary || {}).forEach(([status, count]) => {
    const reason = BLOCKER_TO_REASON[status];
    if (reason) totals[reason] = (totals[reason] || 0) + count;
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export const diagnoseLostRequest = (order, audit) => {
  // العميل أوقف البحث بنفسه، فلا يُنسب للمزودين أو التوزيع
  if (String(order?.status || '').startsWith('canceled_by_client')) return { reason: 'customer_left', approximate: false };

  const notifiedCount = Array.isArray(order?.notifiedProviders) ? order.notifiedProviders.length : 0;
  const rejectedCount = Array.isArray(order?.rejectedProviders) ? order.rejectedProviders.length : 0;
  if (notifiedCount > 0) {
    return { reason: rejectedCount > 0 ? 'rejected' : 'no_response', approximate: false };
  }
  if (!audit) return { reason: 'not_notified', approximate: true };
  if (audit.nearbyCount === 0) return { reason: 'no_providers', approximate: false };
  const eligible = (audit.summary?.eligible_fresh || 0) + (audit.summary?.eligible_backup || 0);
  if (eligible > 0) return { reason: 'dispatch_gap', approximate: false };
  return { reason: largestBlocker(audit.summary) || 'no_providers', approximate: false };
};

export const CANCEL_PARTIES = {
  provider: 'المزود',
  customer: 'العميل',
  external: 'ظرف خارجي',
  unknown: 'غير محدد',
};

/** من ضغط الإلغاء — يختلف عن المسؤول الذي تحدده الإدارة */
export const resolveCancelActor = (order) => {
  const status = String(order?.status || '');
  if (status.startsWith('canceled_by_client')) return 'العميل';
  if (status === 'canceled_by_admin') return 'الإدارة';
  if (status.startsWith('canceled_by_provider')) return 'المزود';
  if (status === 'timed_out') return 'انتهاء المهلة (لا يُحسب على مزود)';
  return null;
};
