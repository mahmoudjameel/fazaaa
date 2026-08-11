/**
 * عرض ETA/المسافة — نفس منطق providers-app/src/services/providerEtaService.js
 * (buildDistanceInfoFromRequest + sanitizeEtaMinutes)
 */

export const MAX_ETA_MINUTES = 180;

export function sanitizeEtaMinutes(minutes) {
  if (minutes == null || minutes === '') return null;
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n) || n < 1 || n > MAX_ETA_MINUTES) return null;
  return n;
}

/**
 * نفس buildDistanceInfoFromRequest — يقرأ providerPreview* أولاً كما في CallStyleRequestModal
 */
export function buildDistanceInfoFromRequest(request) {
  const duration = sanitizeEtaMinutes(request?.providerPreviewEtaMinutes);
  if (duration == null) return null;

  const kmRaw = request?.providerPreviewDistanceKm;
  if (kmRaw == null || !Number.isFinite(Number(kmRaw))) return null;

  const kmNum = Number(kmRaw);
  const source =
    request?.providerPreviewEtaSource ||
    request?.providerAcceptedEtaSource ||
    'preview';

  return {
    distance: kmNum.toFixed(1),
    duration,
    distanceKm: kmNum,
    source,
  };
}

/** fallback عند غياب providerPreview* — بعد القبول يُحدَّثان معاً عادةً */
export function buildDistanceInfoFromAcceptedFields(request) {
  const duration = sanitizeEtaMinutes(request?.providerAcceptedDurationMin);
  if (duration == null) return null;

  const kmRaw = request?.providerAcceptedDistanceKm;
  if (kmRaw == null || !Number.isFinite(Number(kmRaw))) return null;

  const kmNum = Number(kmRaw);
  return {
    distance: kmNum.toFixed(1),
    duration,
    distanceKm: kmNum,
    source: request?.providerAcceptedEtaSource || 'estimate',
  };
}

const ACTIVE_ARRIVAL_STATUSES = ['assigned', 'en_route', 'arrived', 'in_progress'];

export function hasAcceptedProviderForEta(order, displayStatus = order?.status) {
  if (!order) return false;
  if (order.providerId) return true;
  if (ACTIVE_ARRIVAL_STATUSES.includes(displayStatus)) return true;
  if (
    order.providerAcceptedDurationMin != null ||
    order.providerPreviewEtaMinutes != null
  ) {
    if (order.assignedAt != null) return true;
    if (
      Array.isArray(order.history) &&
      order.history.some((h) => h?.status === 'assigned' || h?.action === 'assigned')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * وصول متوقع للعرض في لوحة التحكم — نفس الأرقام التي يراها المزود من Firestore
 */
export function resolveProviderAppArrival(order, displayStatus) {
  if (!order || !hasAcceptedProviderForEta(order, displayStatus)) return null;
  return buildDistanceInfoFromRequest(order) || buildDistanceInfoFromAcceptedFields(order);
}

export function formatProviderAppArrivalLabel(arrival) {
  if (!arrival?.duration) return null;
  const { duration, distance, source } = arrival;
  const isGoogle = source === 'google' || source === 'google_traffic';
  return {
    exceeded: duration > 15,
    isGoogle,
    label: `وصول متوقع: ${duration} د (${distance} km)`,
    title: isGoogle
      ? 'نفس مسافة/وقت Google Maps المحفوظة في الطلب — كما يظهر لتطبيق المزود'
      : 'تقدير محفوظ في الطلب — كما يظهر لتطبيق المزود',
  };
}
