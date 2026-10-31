import { resolveProviderAppArrival } from './providerEtaDisplay';

/**
 * مؤشر أداء المزود — يقارن بعدل بين من نفّذ كثيراً ومن نفّذ قليلاً.
 * كل نسبة تُنعَّم بمتوسط المنصة (Bayesian): المزود يبدأ كأنه نفّذ SMOOTHING_ORDERS طلبات
 * بأداء متوسط، فلا تحكم حالتان على مزود جديد، وتتغلب بياناته كلما زادت طلباته.
 */
export const DELAY_MULTIPLIER = 2; // متأخر عند ضعف الوقت المتوقع فأكثر: المتوقع 10 د → 19 د مقبول و20 د متأخر
export const MIN_DELAYS_TO_FLAG = 3;
export const MIN_ORDERS_TO_SCORE = 5;
const PRIOR_RATINGS = 5;

/** الوزن = أثر العامل على الدرجة، worst = القيمة التي يُخصم عندها الوزن كاملاً */
export const RATING_FULL_DEDUCTION_STARS = 3;
export const SMOOTHING_ORDERS = 10;

export const SCORE_FACTORS = {
  providerCancel: { label: 'إلغاء من المزود', weight: 35, worst: 0.25 },
  rating: { label: 'التقييم', weight: 25 },
  delay: { label: 'التأخير', weight: 20, worst: 0.8 },
  clientCancel: { label: 'إلغاء العميل', weight: 20, worst: 0.6 }, // وزن أقل: قد لا يكون ذنب المزود
};
const RATING_NO_PENALTY = 5;

export const SCORE_LEVELS = {
  good: { min: 70, label: 'جيد' },
  watch: { min: 55, label: 'يحتاج متابعة' },
  poor: { min: 0, label: 'عليه ملاحظات' },
};

const PROVIDER_CANCELLED_STATUSES = ['canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_client', 'canceled_by_client_with_reason', 'canceled_by_admin', 'timed_out'];
const PROVIDER_ACTIVE_STATUSES = ['searching', 'accepted', 'assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs', 'arriving', 'pending_client_confirmation', 'pending_review'];

export const toMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const historyOf = (order) => (Array.isArray(order?.history) ? order.history : Object.values(order?.history || {}));

/** آخر وقت لحالة في history — إلغاء المزود يعيد الطلب للبحث فيتكرر assigned */
const findLastHistoryStatusMs = (order, status, beforeMs = Infinity) =>
  historyOf(order).reduce((latest, h) => {
    if (h?.status !== status) return latest;
    const ms = toMs(h.timestamp);
    return ms && ms <= beforeMs && ms > latest ? ms : latest;
  }, 0);

/** الوصول الفعلي بالدقائق: من قبول المزود حتى ضغطه «وصلت» — null إن نقص أحد الوقتين */
export const resolveActualArrivalMinutes = (order) => {
  const arrivedMs = toMs(order?.arrivedAt) || findLastHistoryStatusMs(order, 'arrived');
  const assignedMs = toMs(order?.assignedAt) || findLastHistoryStatusMs(order, 'assigned', arrivedMs || Infinity);
  if (!assignedMs || !arrivedMs || arrivedMs < assignedMs) return null;
  return Math.round((arrivedMs - assignedMs) / 60000);
};

/**
 * نتيجة الطلب بالنسبة لهذا المزود تحديداً:
 * طلب اعتذر عنه المزود ثم أكمله مزود آخر = «اعتذار» لهذا المزود وليس «مكتمل».
 */
export const resolveProviderOrderOutcome = (order, providerId) => {
  const pid = String(providerId || '');
  const isCurrentProvider = String(order?.providerId || '') === pid;
  const history = historyOf(order);
  const providerCancelledIt =
    String(order?.cancelledBy || '') === pid ||
    String(order?.previousProviderId || '') === pid ||
    history.some((h) => String(h?.providerId || '') === pid && (
      h?.action === 'provider_cancellation' ||
      h?.status === 'canceled_by_provider' ||
      h?.status === 'canceled_by_provider_with_reason'
    ));

  if (!isCurrentProvider) return providerCancelledIt ? 'provider_cancelled' : 'other';
  if (order.status === 'completed') return 'completed';
  if (order.status === 'canceled_by_provider' || order.status === 'canceled_by_provider_with_reason') return 'provider_cancelled';
  if (order.status === 'canceled_by_client' || order.status === 'canceled_by_client_with_reason') return 'client_cancelled';
  if (PROVIDER_CANCELLED_STATUSES.includes(order.status)) return 'other_cancelled';
  if (PROVIDER_ACTIVE_STATUSES.includes(order.status)) return 'active';
  return 'other';
};

/** الطلب المكتمل متأخر إذا بلغ الوقت الفعلي ضعف المتوقع — null إن نقصت البيانات */
export const resolveOrderDelay = (order) => {
  const expectedMinutes = resolveProviderAppArrival(order, order?.status)?.duration;
  const actualMinutes = resolveActualArrivalMinutes(order);
  if (!expectedMinutes || actualMinutes == null) return null;
  return {
    expectedMinutes,
    actualMinutes,
    delayedFromMinutes: expectedMinutes * DELAY_MULTIPLIER,
    isDelayed: actualMinutes >= expectedMinutes * DELAY_MULTIPLIER,
  };
};

const orderRating = (order) => {
  const stars = Math.round(Number(order?.rating));
  return order?.rating != null && stars >= 1 && stars <= 5 ? stars : null;
};

/** كل المزودين الذين يخصّهم الطلب: المنفّذ الحالي ومن اعتذر عنه */
const involvedProviderIds = (order) => {
  const ids = [order?.providerId, order?.previousProviderId, order?.cancelledBy];
  historyOf(order).forEach((h) => {
    if (h?.action === 'provider_cancellation' || String(h?.status || '').startsWith('canceled_by_provider')) ids.push(h?.providerId);
  });
  return [...new Set(ids.filter(Boolean).map(String))];
};

const emptyStats = (id) => ({
  id, completed: 0, providerCancelled: 0, clientCancelled: 0,
  ratingSum: 0, ratingCount: 0, measured: 0, delayed: [],
});

const smoothedRate = (bad, total, platformRate) => (bad + platformRate * SMOOTHING_ORDERS) / (total + SMOOTHING_ORDERS);
const ratio = (part, whole) => (whole > 0 ? part / whole : 0);
const penaltyOf = (value, worst) => Math.min(1, value / worst);

const scoreProvider = (stats, platform) => {
  const handled = stats.completed + stats.providerCancelled + stats.clientCancelled;
  const providerCancelRate = smoothedRate(stats.providerCancelled, handled, platform.providerCancelRate);
  const clientCancelRate = smoothedRate(stats.clientCancelled, handled, platform.clientCancelRate);
  const delayRate = smoothedRate(stats.delayed.length, stats.measured, platform.delayRate);
  const smoothedStars = (stats.ratingSum + platform.averageRating * PRIOR_RATINGS) / (stats.ratingCount + PRIOR_RATINGS);
  const ratingPenalty = Math.max(0, Math.min(1, (RATING_NO_PENALTY - smoothedStars) / (RATING_NO_PENALTY - RATING_FULL_DEDUCTION_STARS)));

  const deductions = {
    providerCancel: SCORE_FACTORS.providerCancel.weight * penaltyOf(providerCancelRate, SCORE_FACTORS.providerCancel.worst),
    rating: SCORE_FACTORS.rating.weight * ratingPenalty,
    delay: SCORE_FACTORS.delay.weight * penaltyOf(delayRate, SCORE_FACTORS.delay.worst),
    clientCancel: SCORE_FACTORS.clientCancel.weight * penaltyOf(clientCancelRate, SCORE_FACTORS.clientCancel.worst),
  };
  const score = Math.round(100 - Object.values(deductions).reduce((sum, d) => sum + d, 0));
  // السبب الرئيسي من وقائع فعلية فقط — التنعيم يخصم قليلاً حتى ممن لا سجل عليه
  const occurred = {
    providerCancel: stats.providerCancelled,
    rating: stats.ratingCount,
    delay: stats.delayed.length,
    clientCancel: stats.clientCancelled,
  };
  const mainIssue = Object.entries(deductions)
    .filter(([factor]) => occurred[factor] > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const hasEnoughData = handled >= MIN_ORDERS_TO_SCORE;
  const level = !hasEnoughData
    ? 'insufficient'
    : Object.keys(SCORE_LEVELS).find((key) => score >= SCORE_LEVELS[key].min);

  const factors = [
    { id: 'providerCancel', adjustedValue: `${Math.round(providerCancelRate * 100)}%` },
    { id: 'rating', adjustedValue: smoothedStars.toFixed(1) },
    { id: 'delay', adjustedValue: `${Math.round(delayRate * 100)}%` },
    { id: 'clientCancel', adjustedValue: `${Math.round(clientCancelRate * 100)}%` },
  ].map((factor) => ({ ...factor, points: Math.round(deductions[factor.id] * 10) / 10 }));

  return { ...stats, handled, score, level, mainIssue, factors, averageRating: stats.ratingCount ? stats.ratingSum / stats.ratingCount : null };
};

/**
 * يعيد لكل مزود إحصاءاته ودرجته وطلباته المتأخرة، مع متوسطات المنصة.
 * providerIds: مزودون فعليون فقط — cancelledBy يحمل أيضاً معرّف العميل أو الإدارة.
 */
export const buildProviderPerformance = (orders, providerIds) => {
  const byProvider = new Map();
  const statsFor = (id) => {
    if (!byProvider.has(id)) byProvider.set(id, emptyStats(id));
    return byProvider.get(id);
  };

  orders.forEach((order) => {
    involvedProviderIds(order).filter((id) => providerIds.has(id)).forEach((id) => {
      const outcome = resolveProviderOrderOutcome(order, id);
      const stats = statsFor(id);
      if (outcome === 'provider_cancelled') stats.providerCancelled += 1;
      if (outcome === 'client_cancelled') stats.clientCancelled += 1;
      if (outcome !== 'completed') return;

      stats.completed += 1;
      const stars = orderRating(order);
      if (stars != null) {
        stats.ratingSum += stars;
        stats.ratingCount += 1;
      }
      const delay = resolveOrderDelay(order);
      if (!delay) return;
      stats.measured += 1;
      if (delay.isDelayed) stats.delayed.push({ order, ...delay });
    });
  });

  const all = [...byProvider.values()];
  const sum = (pick) => all.reduce((total, s) => total + pick(s), 0);
  const handledTotal = sum((s) => s.completed + s.providerCancelled + s.clientCancelled);
  const platform = {
    providerCancelRate: ratio(sum((s) => s.providerCancelled), handledTotal),
    clientCancelRate: ratio(sum((s) => s.clientCancelled), handledTotal),
    delayRate: ratio(sum((s) => s.delayed.length), sum((s) => s.measured)),
    averageRating: ratio(sum((s) => s.ratingSum), sum((s) => s.ratingCount)) || RATING_NO_PENALTY,
  };

  return { platform, providers: all.map((stats) => scoreProvider(stats, platform)) };
};
