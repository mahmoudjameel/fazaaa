import { resolveRequestCityName, requestCoords } from './noCoverage';
import { diagnoseLostRequest, isLostRequest } from './lossDiagnosis';

export const PRIORITY_CITY_NAMES = ['مكة المكرمة', 'المدينة المنورة', 'الرياض', 'جدة', 'الدمام', 'الخبر', 'بريدة', 'الجبيل'];

const UNKNOWN_AREA = 'غير محدد';
const ACTIVE_STATUSES = ['searching', 'assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs', 'pending_client_confirmation', 'pending_review'];
const riyadhHour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' });

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** الحي من العنوان إن ذُكر، وإلا أول جزء غير رقمي (شارع أو منطقة) */
export const resolveAreaName = (location) => {
  if (typeof location !== 'string' || !location.trim()) return UNKNOWN_AREA;
  const district = location.match(/(?:^|[\s,،-])حي\s+([^,،\d-]+?)(?=\s+(?:شارع|طريق)\s|[,،\d-]|$)/);
  if (district) return `حي ${district[1].trim()}`;
  const firstPart = location.split(/[،,]/).map((part) => part.trim()).find((part) => part && !/^[\d\s–-]+$/.test(part));
  return firstPart || UNKNOWN_AREA;
};

const classifyOutcome = (order) => {
  if (order.status === 'completed') return 'completed';
  if (isLostRequest(order)) return 'lost';
  return ACTIVE_STATUSES.includes(order.status) ? 'active' : 'cancelled';
};

const increment = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);
const sortedEntries = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);

export const buildCityReport = (orders, cityName, cities, auditsById) => {
  const inCity = orders.filter((order) => resolveRequestCityName(order, cities) === cityName);
  const report = {
    total: inCity.length, completed: 0, cancelled: 0, lost: 0, active: 0,
    hours: Array.from({ length: 24 }, () => ({ total: 0, lost: 0 })),
    points: [], approximateLost: 0,
  };
  const services = new Map();
  const lostReasons = new Map();
  const areas = new Map();
  let availabilitySum = 0;
  let availabilityCount = 0;

  inCity.forEach((order) => {
    const outcome = classifyOutcome(order);
    report[outcome] += 1;
    increment(services, order.serviceName || order.serviceType || 'خدمة');

    const rawAreaName = resolveAreaName(order.location);
    const areaName = rawAreaName === cityName ? UNKNOWN_AREA : rawAreaName; // العنوان لم يذكر غير المدينة
    const area = areas.get(areaName) || { name: areaName, total: 0, lost: 0 };
    area.total += 1;
    if (outcome === 'lost') area.lost += 1;
    areas.set(areaName, area);

    const created = toDate(order.createdAt);
    const hour = created ? Number(riyadhHour.format(created)) % 24 : null;
    if (hour != null) {
      report.hours[hour].total += 1;
      if (outcome === 'lost') report.hours[hour].lost += 1;
    }

    const audit = auditsById.get(order.id);
    if (audit) {
      availabilitySum += (audit.summary?.eligible_fresh || 0) + (audit.summary?.eligible_backup || 0);
      availabilityCount += 1;
    }
    if (outcome === 'lost') {
      const { reason, approximate } = diagnoseLostRequest(order, audit);
      increment(lostReasons, reason);
      if (approximate) report.approximateLost += 1;
    }

    const position = requestCoords(order);
    if (position) report.points.push({ id: order.id, ...position, outcome, service: order.serviceName, areaName });
  });

  return {
    ...report,
    services: sortedEntries(services),
    lostReasons: sortedEntries(lostReasons),
    areas: [...areas.values()].sort((a, b) => b.total - a.total),
    averageAvailable: availabilityCount ? availabilitySum / availabilityCount : null,
    auditedOrders: availabilityCount,
  };
};
