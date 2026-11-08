/**
 * مركز القرار — كل المؤشرات من بيانات الطلبات الفعلية (دوال نقية، تُختبر بلا Firestore).
 *
 * قواعد صحة البيانات:
 * - الاختبار مستبعد: طلبات مختبر اللوحة، أو طلب علّمته الإدارة اختباراً، أو عميل بجوال اختبار.
 * - الاحتياج لا الطلب: محاولات نفس العميل لنفس القسم خلال 3 ساعات و2 كم = احتياج واحد (customerDemand).
 * - الجاري منفصل: لا يدخل نسبة الإنجاز حتى ينتهي.
 * - الإلغاء مصنّف: قبل القبول (فقد تغطية) / بعده من العميل / من المزود / من الإدارة.
 */
import { groupOrdersIntoNeeds } from './customerDemand';
import { isLostRequest } from './lossDiagnosis';
import { isNetworkTimeoutRequest, requestCoords, resolveRequestCityName } from './noCoverage';
import { resolveAreaName } from './cityReport';
import { DELAY_MULTIPLIER, formatCancelReasonLabel, resolveActualArrivalMinutes, toMs } from './providerPerformance';
import { canReceiveRequestsWithWallet } from './providerPricing';

export const DEFAULT_TARGETS = {
  arrivalTargetMinutes: 30, // فوقه يُعد الطلب الجاري متأخراً (أو ضعف المتوقع أيهما أكبر)
  acceptanceTargetPercent: 70,
  completionTargetPercent: 60,
};

// أرقام الاختبار المعروفة (verifyOTP) — تُضاف إليها قائمة settings/decisionCenter.testPhones
export const DEFAULT_TEST_PHONES = ['966500000000', '966511111111'];

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const PROVIDER_FRESH_LOCATION_MIN = 180; // نفس شرط التوزيع للموقع الحديث
const BACKUP_LOCATION_MIN = 24 * 60; // البدلاء في التوزيع
const STUCK_SEARCH_GRACE_MS = 3 * MINUTE;
const MAX_VALID_ARRIVAL_MIN = 180;

const SERVED_STATUSES = ['completed', 'pending_client_confirmation', 'pending_review'];
const IN_FIELD_STATUSES = ['assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs'];
const ON_THE_WAY_STATUSES = ['assigned', 'en_route'];

export const NEED_OUTCOME_LABELS = {
  served: 'مكتمل',
  active: 'جارٍ',
  lost: 'فقد تغطية',
  cancelled: 'ملغى بعد القبول',
};

export const LOSS_TYPE_LABELS = {
  no_coverage: 'لم يصل لأي مزود',
  not_accepted: 'وصل للمزودين ولم يقبل أحد',
  customer_left: 'ألغاه العميل قبل القبول',
  closed_by_admin: 'أُغلق من الإدارة قبل القبول',
};

export const CANCEL_TYPE_LABELS = {
  customer_after_accept: 'العميل بعد القبول',
  provider: 'المزود',
  admin: 'الإدارة',
  other: 'أخرى',
};

/** آخر 9 أرقام — يطابق 05xxxxxxxx و9665xxxxxxxx و5xxxxxxxx */
export const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-9);

export const isTestOrder = (order, testCustomerIds = new Set()) => order?.isTest === true
  || order?.source === 'admin_test_lab'
  || Boolean(order?.testTargetProviderId)
  || testCustomerIds.has(order?.customerId || order?.userId);

export const isActiveOrder = (order) => IN_FIELD_STATUSES.includes(order?.status)
  || (order?.status === 'searching' && !isNetworkTimeoutRequest(order));

const wasAccepted = (order) => Boolean(order?.assignedAt || order?.providerId);
const wasNotified = (order) => Array.isArray(order?.notifiedProviders) && order.notifiedProviders.length > 0;

export const needOutcome = (need) => {
  if (need.some((o) => SERVED_STATUSES.includes(o.status))) return 'served';
  if (need.some(isActiveOrder)) return 'active';
  if (isLostRequest(need[need.length - 1]) || !need.some(wasAccepted)) return 'lost';
  return 'cancelled';
};

export const lossTypeOf = (order) => {
  const status = String(order?.status || '');
  if (status.startsWith('canceled_by_client')) return 'customer_left';
  if (status === 'canceled_by_admin' || status === 'escalated_to_city_manager') return 'closed_by_admin';
  return wasNotified(order) ? 'not_accepted' : 'no_coverage';
};

export const cancelTypeOf = (order) => {
  const status = String(order?.status || '');
  if (status.startsWith('canceled_by_client')) return 'customer_after_accept';
  if (status.startsWith('canceled_by_provider')) return 'provider';
  if (status === 'canceled_by_admin') return 'admin';
  return 'other';
};

/** المحاولة الممثلة للاحتياج: المكتملة إن وُجدت، وإلا الأخيرة */
export const representativeOf = (need) => need.find((o) => SERVED_STATUSES.includes(o.status)) || need[need.length - 1];

const firstCreatedMs = (need) => toMs(need[0]?.createdAt);

/** فلاتر موحّدة: المدينة (من الإحداثيات) والقسم */
export const filterOrders = (orders, { city = '', service = '' } = {}, cities = []) => orders.filter((order) => {
  if (service && ![order.parentServiceId, order.serviceCategory, order.serviceId].some((v) => v && String(v) === service)
    && !String(order.serviceId || '').startsWith(`${service}_`)) return false;
  if (city && resolveRequestCityName(order, cities) !== city) return false;
  return true;
});

/**
 * احتياجات فترة: تُجمع المحاولات أولاً على كل الطلبات ثم يُختار ما بدأ داخل الفترة
 * (حتى لا تنقسم محاولات احتياج على حدّ الفترة).
 */
export const buildNeeds = (orders) => groupOrdersIntoNeeds(orders).map((attempts) => ({
  id: attempts[0].id,
  attempts,
  outcome: needOutcome(attempts),
  representative: representativeOf(attempts),
  startedAtMs: firstCreatedMs(attempts),
}));

export const needsInRange = (needs, fromMs, toMsExclusive) => needs
  .filter((need) => need.startedAtMs >= fromMs && need.startedAtMs < toMsExclusive);

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** مؤشرات فترة واحدة */
export const computeKpis = (needs) => {
  const by = { served: [], active: [], lost: [], cancelled: [] };
  needs.forEach((need) => by[need.outcome].push(need));
  const closed = needs.length - by.active.length;

  const lossBreakdown = {};
  by.lost.forEach((need) => {
    const type = lossTypeOf(need.representative);
    lossBreakdown[type] = (lossBreakdown[type] || 0) + 1;
  });
  const cancelBreakdown = {};
  by.cancelled.forEach((need) => {
    const type = cancelTypeOf(need.representative);
    cancelBreakdown[type] = (cancelBreakdown[type] || 0) + 1;
  });

  // قبول المزودين: من الاحتياجات التي وصلت لمزود، كم قبله أحد
  // الجاري الذي ما زال يرن لم يُرفض بعد — يدخل فقط إن قُبل
  const reachedProviders = needs.filter((need) => need.attempts.some(wasNotified)
    && (need.outcome !== 'active' || need.attempts.some(wasAccepted)));
  const accepted = reachedProviders.filter((need) => need.attempts.some(wasAccepted));

  const arrivals = by.served
    .map((need) => resolveActualArrivalMinutes(need.representative))
    .filter((m) => m != null && m >= 0 && m <= MAX_VALID_ARRIVAL_MIN);
  const avgArrival = arrivals.length ? Math.round(arrivals.reduce((s, m) => s + m, 0) / arrivals.length) : null;

  const attempts = needs.reduce((sum, need) => sum + need.attempts.length, 0);
  return {
    needs: needs.length,
    served: by.served.length,
    active: by.active.length,
    lost: by.lost.length,
    cancelled: by.cancelled.length,
    closed,
    attempts,
    repeatedAttempts: attempts - needs.length,
    completionRate: percent(by.served.length, closed),
    coverageLossRate: percent(by.lost.length, needs.length),
    acceptanceRate: percent(accepted.length, reachedProviders.length),
    avgArrivalMinutes: avgArrival,
    arrivalSamples: arrivals.length,
    lossBreakdown,
    cancelBreakdown,
    groups: by,
  };
};

/** فرق المؤشر عن الفترة السابقة: نسبة مئوية للأعداد، ونقاط للنِّسب */
export const compareKpi = (current, previous, { isRate = false } = {}) => {
  if (current == null || previous == null) return null;
  if (isRate) return Math.round((current - previous) * 10) / 10;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
};

// خلية ~1.5 كم لتسمية الطلبات التي لا يذكر عنوانها الحي
const AREA_CELL_DEG = 0.015;
const NON_LOCALITY = /^(?:[\d\s–-]+|.*(?:Region|منطقة|المنطقة).*|(?:شارع|طريق)\s.*|.*\b(?:St|Rd|Road|Street)\b.*)$/i;

const districtOf = (location) => {
  const area = resolveAreaName(location);
  return area.startsWith('حي ') ? area : null;
};
const cellOf = (order) => {
  const pos = requestCoords(order);
  return pos ? `${Math.round(pos.lat / AREA_CELL_DEG)},${Math.round(pos.lng / AREA_CELL_DEG)}` : null;
};
/** البلدة من العنوان «شارع، البلدة، المنطقة» — للطلبات خارج الأحياء المعروفة */
const localityOf = (location) => {
  if (typeof location !== 'string') return null;
  const parts = location.split(/[،,]/).map((p) => p.trim()).filter(Boolean);
  return parts.slice(1).find((p) => !NON_LOCALITY.test(p)) || null;
};

/** «المدينة - الحي» كما يُعرض للمدير */
export const areaLabel = (city, area) => (city && area && city !== area ? `${city} - ${area}` : area || city || 'غير محدد');

/**
 * اسم المنطقة: الحي من العنوان، وإلا أكثر حي تكراراً في نفس الخلية (من كل الطلبات)،
 * وإلا البلدة من العنوان. المدينة من الإحداثيات، وخارج المدن تُستخدم البلدة.
 */
export const buildAreaResolver = (allOrders, cities) => {
  const cellDistricts = new Map();
  allOrders.forEach((order) => {
    const district = districtOf(order.location);
    const cell = cellOf(order);
    if (!district || !cell) return;
    if (!cellDistricts.has(cell)) cellDistricts.set(cell, new Map());
    const counts = cellDistricts.get(cell);
    counts.set(district, (counts.get(district) || 0) + 1);
  });
  const dominantDistrict = (cell) => {
    const counts = cell && cellDistricts.get(cell);
    return counts ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  };
  return (order) => {
    const locality = localityOf(order.location);
    const resolvedCity = resolveRequestCityName(order, cities);
    const cityKnown = Boolean(resolvedCity) && resolvedCity !== 'خارج المدن';
    const city = cityKnown ? resolvedCity : (locality || 'خارج المدن');
    const district = districtOf(order.location) || dominantDistrict(cellOf(order));
    if (district) return { key: `${city}|${district}`, area: district, city, label: areaLabel(city, district) };
    // بلا حي: البلدة إن اختلفت عن المدينة، وإلا «قرب» أول شارع في العنوان (مجمّعة بالخلية)
    const cell = cellOf(order);
    // خارج المدن المسجلة: البلدة نفسها هي المدينة، فتكفي وحدها اسماً
    if (locality && (!cityKnown || locality !== city)) {
      return { key: `${city}|${locality}`, area: locality, city, label: areaLabel(city, locality) };
    }
    const street = typeof order.location === 'string'
      ? order.location.split(/[،,]/).map((p) => p.trim())
        .find((p) => p && !/^[\d\s–-]+$/.test(p) && p !== city && !/Region|منطقة|المنطقة/.test(p))
      : null;
    const area = street ? `قرب ${street}` : 'موقع بلا حي محدد';
    return { key: `${city}|cell:${cell || area}`, area, city, label: areaLabel(city, area) };
  };
};

/** أعلى المناطق خسارةً (احتياجات بلا خدمة) */
export const topLostAreas = (lostNeeds, cities, limit = 3, allOrders = []) => {
  const resolveArea = buildAreaResolver(allOrders.length ? allOrders : lostNeeds.map((n) => n.representative), cities);
  const areas = new Map();
  lostNeeds.forEach((need) => {
    const order = need.representative;
    const { key, area, city, label } = resolveArea(order);
    if (!areas.has(key)) areas.set(key, { key, city, area, label, count: 0, reasons: {}, needs: [], lat: 0, lng: 0, points: 0 });
    const entry = areas.get(key);
    entry.count += 1;
    entry.needs.push(need);
    const type = lossTypeOf(order);
    entry.reasons[type] = (entry.reasons[type] || 0) + 1;
    const pos = requestCoords(order);
    if (pos) { entry.lat += pos.lat; entry.lng += pos.lng; entry.points += 1; }
  });
  return [...areas.values()]
    .map((a) => ({
      ...a,
      lat: a.points ? a.lat / a.points : null,
      lng: a.points ? a.lng / a.points : null,
      mainReason: Object.entries(a.reasons).sort((x, y) => y[1] - x[1])[0]?.[0] || null,
    }))
    .sort((x, y) => y.count - x.count)
    .slice(0, limit);
};

/** الطلبات الجارية الآن (بلا فلتر فترة): المتأخرة والعالقة في البحث */
export const analyzeLiveOrders = (orders, targets = DEFAULT_TARGETS, nowMs = Date.now()) => {
  const late = [];
  const stuckSearching = [];
  orders.forEach((order) => {
    if (ON_THE_WAY_STATUSES.includes(order.status) && !order.actual_geofence_arrival_at) {
      const assignedMs = toMs(order.assignedAt);
      if (!assignedMs) return;
      const expected = Number(order.providerAcceptedDurationMin) || 0;
      const thresholdMin = Math.max(targets.arrivalTargetMinutes, expected * DELAY_MULTIPLIER);
      const elapsedMin = (nowMs - assignedMs) / MINUTE;
      if (elapsedMin > thresholdMin) late.push({ order, elapsedMin: Math.round(elapsedMin), thresholdMin });
    }
    if (order.status === 'searching') {
      const endsMs = toMs(order.searchEndsAt);
      if (endsMs && endsMs + STUCK_SEARCH_GRACE_MS < nowMs) stuckSearching.push(order);
    }
  });
  late.sort((a, b) => b.elapsedMin - a.elapsedMin);
  return {
    late,
    stuckSearching,
    activeCount: orders.filter(isActiveOrder).length,
    searchingNow: orders.filter((o) => o.status === 'searching' && !isNetworkTimeoutRequest(o)).length,
  };
};

/**
 * من يصله الطلب الآن حسب قواعد التوزيع: 'fresh' متصل بموقع ≤3س، 'backup' بديل بموقع ≤24س
 * (لم يوقف نفسه يدوياً)، وإلا null. معتمد ورصيد كافٍ في الحالتين.
 */
export const providerDispatchReach = (provider, pricing, nowMs = Date.now()) => {
  const approval = provider?.approvalStatus || provider?.status;
  if (approval !== 'approved' || provider?.isActive === false) return null;
  if (!canReceiveRequestsWithWallet(provider?.wallet || {}, pricing)) return null;
  if (provider?.availabilityStatus === 'busy') return null;
  const locMs = toMs(provider?.locationUpdatedAt || provider?.location?.timestamp);
  if (!locMs) return null;
  const ageMin = (nowMs - locMs) / MINUTE;
  const manuallyOff = ['paused', 'offline'].includes(provider?.availabilityStatus) && provider?.offlineReason !== 'stale_heartbeat';
  if (manuallyOff) return null;
  if (ageMin <= PROVIDER_FRESH_LOCATION_MIN && (provider?.availabilityStatus === 'available' || provider?.isOnline === true)) return 'fresh';
  return ageMin <= BACKUP_LOCATION_MIN ? 'backup' : null;
};

/** المتاحون فعلياً الآن: معتمد، «متاح»، موقع حديث (شرط التوزيع)، رصيد كافٍ */
export const isProviderReallyAvailable = (provider, pricing, nowMs = Date.now()) => {
  const approval = provider?.approvalStatus || provider?.status;
  if (approval !== 'approved' || provider?.isActive === false) return false;
  if (provider?.availabilityStatus !== 'available' && provider?.isOnline !== true) return false;
  if (provider?.availabilityStatus === 'paused' || provider?.availabilityStatus === 'busy') return false;
  const locMs = toMs(provider?.locationUpdatedAt || provider?.location?.timestamp);
  if (!locMs || nowMs - locMs > PROVIDER_FRESH_LOCATION_MIN * MINUTE) return false;
  return canReceiveRequestsWithWallet(provider?.wallet || {}, pricing);
};

/** يومياً: الاحتياجات والمكتمل */
export const dailyTrend = (needs, fromMs, toMsExclusive) => {
  const days = [];
  for (let start = fromMs; start < toMsExclusive; start += DAY) {
    const dayNeeds = needs.filter((n) => n.startedAtMs >= start && n.startedAtMs < start + DAY);
    days.push({
      dayMs: start,
      needs: dayNeeds.length,
      served: dayNeeds.filter((n) => n.outcome === 'served').length,
      lost: dayNeeds.filter((n) => n.outcome === 'lost').length,
    });
  }
  return days;
};

/** أكثر أسباب الإلغاء تكراراً كما كتبها العميل/المزود — دليل التوصية */
const topReasonsText = (needs, limit = 2) => {
  const counts = new Map();
  needs.forEach((need) => {
    const raw = need.representative?.cancelReason;
    const label = raw ? formatCancelReasonLabel(typeof raw === 'object' ? (raw.label || raw.id) : raw) : null;
    if (label) counts.set(label, (counts.get(label) || 0) + 1);
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return top.length ? ` — أكثر الأسباب: ${top.map(([label, n]) => `«${label}» (${n})`).join('، ')}` : '';
};

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

/**
 * أهم المشكلات العاجلة — مرتبة بالخطورة ثم الحجم. كل مشكلة بسبب ودليل وإجراء.
 * action: { label, path } — الصفحة الموجودة التي يُتخذ منها الإجراء
 */
export const buildUrgentIssues = ({ live, kpis, areas, targets, availableProviders, backupProviders = 0, openEscalations = 0 }) => {
  const issues = [];
  if (live.stuckSearching.length) {
    issues.push({
      id: 'stuck_search', severity: 'high', size: live.stuckSearching.length,
      title: 'طلبات عالقة في البحث',
      detail: `${live.stuckSearching.length} طلب تجاوز وقت البحث ولم يُغلق — العميل ينتظر بلا رد`,
      orders: live.stuckSearching,
      action: { label: 'عرض الطلبات', path: '/admin/orders' },
    });
  }
  if (live.late.length) {
    issues.push({
      id: 'late', severity: 'high', size: live.late.length,
      title: 'طلبات متأخرة الآن',
      detail: `${live.late.length} طلب تجاوز زمن الوصول المستهدف (${targets.arrivalTargetMinutes} د أو ضعف المتوقع)`,
      orders: live.late.map((l) => l.order),
      action: { label: 'عرض الطلبات', path: '/admin/orders' },
    });
  }
  if (areas[0] && areas[0].count >= 2) {
    const top = areas[0];
    issues.push({
      id: 'coverage_gap', severity: top.count >= 5 ? 'high' : 'medium', size: top.count,
      title: 'نقص تغطية',
      detail: `${top.label} — ${top.count} احتياج غير مخدوم، أغلبها: ${LOSS_TYPE_LABELS[top.mainReason] || '—'}`,
      orders: top.needs.map((n) => n.representative),
      action: { label: 'تعزيز التغطية', path: '/admin/providers-map' },
    });
  }
  if (kpis.acceptanceRate != null && kpis.acceptanceRate < targets.acceptanceTargetPercent) {
    issues.push({
      id: 'low_acceptance', severity: kpis.acceptanceRate < targets.acceptanceTargetPercent - 20 ? 'medium' : 'low',
      size: targets.acceptanceTargetPercent - kpis.acceptanceRate,
      title: 'انخفاض قبول المزودين',
      detail: `معدل القبول ${kpis.acceptanceRate}% (الهدف ${targets.acceptanceTargetPercent}%)`,
      orders: kpis.groups.lost.filter((n) => lossTypeOf(n.representative) === 'not_accepted').map((n) => n.representative),
      action: { label: 'تشخيص السبب', path: '/admin/dispatch-diagnostics' },
    });
  }
  if (availableProviders === 0) {
    const noBackups = !backupProviders;
    issues.push({
      id: 'no_providers', severity: noBackups ? 'high' : 'medium', size: 1,
      title: 'لا مزود متصل فعلياً الآن',
      detail: noBackups
        ? 'لا متصل ولا بديل برصيد كافٍ — أي طلب جديد سيضيع'
        : `لا متصل بموقع حديث؛ الطلبات تعتمد على ${backupProviders} بديل (موقع حتى 24 ساعة)`,
      orders: [],
      action: { label: 'المزودون غير النشطين', path: '/admin/inactive-providers' },
    });
  }
  if (openEscalations > 0) {
    issues.push({
      id: 'escalations', severity: openEscalations >= 5 ? 'medium' : 'low', size: openEscalations,
      title: 'تصعيدات مفتوحة',
      detail: `${openEscalations} تصعيد لم يُعالج`,
      orders: [],
      action: { label: 'التصعيدات', path: '/admin/escalations' },
    });
  }
  return issues
    .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.size - a.size)
    .slice(0, 3);
};

/**
 * الوكلاء الثلاثة: تحليل قواعد على البيانات (كل استنتاج بدليله الرقمي).
 * التوصية اليومية = أعلى أثر بين استنتاجاتهم، ولا تُنفّذ إلا باعتماد المدير.
 */
export const buildAgentFindings = ({ kpis, prevKpis, live, areas, availableProviders, targets }) => {
  const coverage = [];
  const operations = [];
  const quality = [];

  areas.forEach((area, index) => {
    coverage.push({
      impact: area.count * (index === 0 ? 1 : 0.8),
      title: `تعزيز تغطية ${area.label}`,
      reason: `${area.count} احتياج غير مخدوم في ${area.label} — أغلبها «${LOSS_TYPE_LABELS[area.mainReason] || '—'}»`,
      effect: 'رفع نسبة الإنجاز وتقليل فقد التغطية',
      evidence: area.needs.map((n) => n.representative),
      action: { label: 'خريطة المزودين', path: '/admin/providers-map' },
    });
  });
  if ((kpis.lossBreakdown.no_coverage || 0) > 0) {
    coverage.push({
      impact: kpis.lossBreakdown.no_coverage * 0.3,
      title: 'مزودون خارج الخدمة قرب الطلبات الضائعة',
      reason: `${kpis.lossBreakdown.no_coverage} احتياج لم يصل لأي مزود — راجع المزودين غير النشطين في هذه المناطق`,
      effect: 'إعادة مزودين موجودين للخدمة بدل تجنيد جدد',
      evidence: kpis.groups.lost.filter((n) => lossTypeOf(n.representative) === 'no_coverage').map((n) => n.representative),
      action: { label: 'المزودون غير النشطين', path: '/admin/inactive-providers' },
    });
  }

  if (live.late.length) {
    operations.push({
      impact: live.late.length * 2,
      title: 'متابعة الطلبات المتأخرة الآن',
      reason: `${live.late.length} طلب جارٍ تجاوز زمن الوصول المستهدف — أطولها ${live.late[0].elapsedMin} د`,
      effect: 'منع الإلغاء بعد القبول والتقييم السلبي',
      evidence: live.late.map((l) => l.order),
      action: { label: 'الطلبات', path: '/admin/orders' },
    });
  }
  if (kpis.acceptanceRate != null && kpis.acceptanceRate < targets.acceptanceTargetPercent) {
    operations.push({
      impact: (kpis.lossBreakdown.not_accepted || 0) * 0.3,
      title: 'رفع قبول المزودين',
      reason: `القبول ${kpis.acceptanceRate}% مقابل هدف ${targets.acceptanceTargetPercent}% — ${kpis.lossBreakdown.not_accepted || 0} احتياج وصل للمزودين ولم يقبله أحد`,
      effect: 'تحويل طلبات وصلت للمزودين إلى طلبات مخدومة',
      evidence: kpis.groups.lost.filter((n) => lossTypeOf(n.representative) === 'not_accepted').map((n) => n.representative),
      action: { label: 'تشخيص التوزيع', path: '/admin/dispatch-diagnostics' },
    });
  }
  if (availableProviders < 3) {
    operations.push({
      impact: (3 - availableProviders) * 5,
      title: 'عدد المتاحين فعلياً منخفض',
      reason: `${availableProviders} مزود متاح بموقع حديث ورصيد كافٍ الآن`,
      effect: 'تقليل الطلبات التي لا تجد مزوداً',
      evidence: [],
      action: { label: 'المزودون غير النشطين', path: '/admin/inactive-providers' },
    });
  }

  const providerCancels = kpis.cancelBreakdown.provider || 0;
  const prevProviderCancels = prevKpis?.cancelBreakdown?.provider || 0;
  if (providerCancels > 0) {
    quality.push({
      impact: providerCancels * 0.5 + Math.max(0, providerCancels - prevProviderCancels) * 0.5,
      title: 'مراجعة إلغاءات المزودين',
      reason: `${providerCancels} احتياج ألغاه المزود بعد القبول (الفترة السابقة ${prevProviderCancels})${topReasonsText(kpis.groups.cancelled.filter((n) => cancelTypeOf(n.representative) === 'provider'))}`,
      effect: 'رفع الثقة وتقليل الاحتياجات الضائعة بعد القبول',
      evidence: kpis.groups.cancelled.filter((n) => cancelTypeOf(n.representative) === 'provider').map((n) => n.representative),
      action: { label: 'إلغاءات المزودين', path: '/admin/provider-cancellations' },
    });
  }
  const customerCancels = kpis.cancelBreakdown.customer_after_accept || 0;
  if (customerCancels > 0) {
    quality.push({
      impact: customerCancels * 0.3,
      title: 'إلغاء العملاء بعد القبول',
      reason: `${customerCancels} احتياج ألغاه العميل بعد قبول المزود${topReasonsText(kpis.groups.cancelled.filter((n) => cancelTypeOf(n.representative) === 'customer_after_accept'))}`,
      effect: 'تحويل طلبات مقبولة إلى مكتملة',
      evidence: kpis.groups.cancelled.filter((n) => cancelTypeOf(n.representative) === 'customer_after_accept').map((n) => n.representative),
      action: { label: 'الطلبات', path: '/admin/orders' },
    });
  }
  if (kpis.repeatedAttempts > 0) {
    quality.push({
      impact: kpis.repeatedAttempts * 0.05,
      title: 'عملاء يكررون نفس الطلب',
      reason: `${kpis.repeatedAttempts} محاولة مكررة لنفس الاحتياج — العميل لم يجد مزوداً من أول مرة`,
      effect: 'تجربة أوضح للعميل وبيانات أدق',
      evidence: kpis.groups.lost.concat(kpis.groups.served).filter((n) => n.attempts.length > 1).map((n) => n.representative),
      action: { label: 'الطلبات', path: '/admin/orders' },
    });
  }

  const sortByImpact = (list) => list.sort((a, b) => b.impact - a.impact);
  const agents = {
    coverage: sortByImpact(coverage),
    operations: sortByImpact(operations),
    quality: sortByImpact(quality),
  };
  const recommendation = sortByImpact([...coverage, ...operations, ...quality])[0] || null;
  return { agents, recommendation };
};

/** الفترة المختارة → [من, إلى) + الفترة السابقة بنفس الطول */
export const resolvePeriod = (periodKey, nowMs = Date.now()) => {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const spans = { today: 1, '7d': 7, '30d': 30 };
  const days = spans[periodKey] || 30;
  const fromMs = periodKey === 'today' ? todayMs : todayMs - (days - 1) * DAY;
  const toMsExclusive = todayMs + DAY;
  const length = toMsExclusive - fromMs;
  // الفترة الحالية لم تكتمل: نقارن بنفس المدة المنقضية من الفترة السابقة (اليوم حتى الآن ↔ أمس حتى نفس الساعة)
  const elapsed = Math.min(length, Math.max(0, nowMs - fromMs));
  const prevFromMs = fromMs - length;
  return { fromMs, toMs: toMsExclusive, prevFromMs, prevToMs: prevFromMs + elapsed, days };
};
