import { distanceKm, requestCoords } from './noCoverage';

/**
 * المحاولات مقابل الاحتياج الفعلي: عميل لم يجد مزوداً يعيد الطلب عدة مرات،
 * فعدد الطلبات يبالغ في الطلب الحقيقي. التجميع للتحليل فقط: المحاولات لا تُحذف ولا تتغيّر.
 * الطلب محاولة لنفس الاحتياج فقط إذا كان: نفس العميل، نفس القسم، خلال 3 ساعات من
 * المحاولة السابقة، ضمن 2 كم منها، والمحاولة السابقة لم تكتمل.
 */
const SAME_NEED_GAP_MS = 3 * 60 * 60 * 1000;
const SAME_NEED_DISTANCE_KM = 2;

const toMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const customerKeyOf = (order) => order?.customerId || order?.userId || order?.customerPhone || `order:${order?.id}`;

const serviceGroupOf = (order) => order?.parentServiceId || order?.serviceCategory || order?.serviceId || order?.serviceName || '';

const isSameLocation = (a, b) => {
  const first = requestCoords(a);
  const second = requestCoords(b);
  if (!first || !second) return true; // بلا إحداثيات: يكفي الوقت والقسم
  return distanceKm(first.lat, first.lng, second.lat, second.lng) <= SAME_NEED_DISTANCE_KM;
};

const continuesNeed = (previous, order) =>
  previous.status !== 'completed'
  && toMs(order.createdAt) - toMs(previous.createdAt) <= SAME_NEED_GAP_MS
  && serviceGroupOf(previous) === serviceGroupOf(order)
  && isSameLocation(previous, order);

/** يقسم طلبات العميل إلى احتياجات منفصلة */
const splitIntoNeeds = (orders) => {
  const sorted = [...orders].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  const needs = [];
  sorted.forEach((order) => {
    const matching = needs.find((need) => continuesNeed(need[need.length - 1], order));
    if (matching) matching.push(order);
    else needs.push([order]);
  });
  return needs;
};

const groupByCustomer = (orders) => {
  const customers = new Map();
  orders.forEach((order) => {
    const key = customerKeyOf(order);
    if (!customers.has(key)) customers.set(key, []);
    customers.get(key).push(order);
  });
  return customers;
};

export const summarizeCustomerDemand = (orders) => {
  const customers = groupByCustomer(orders);
  const needs = [...customers.values()].flatMap(splitIntoNeeds);
  const servedNeeds = needs.filter((need) => need.some((order) => order.status === 'completed')).length;
  return {
    attempts: orders.length,
    uniqueCustomers: customers.size,
    needs: needs.length,
    servedNeeds,
    repeatedNeeds: needs.filter((need) => need.length > 1).length,
  };
};

/** @returns {Map<string, { attempt: number, needAttempts: number }>} ترتيب كل طلب داخل احتياجه */
export const buildAttemptLookup = (orders) => {
  const lookup = new Map();
  groupByCustomer(orders).forEach((customerOrders) => {
    splitIntoNeeds(customerOrders).forEach((need) => {
      need.forEach((order, index) => lookup.set(order.id, { attempt: index + 1, needAttempts: need.length }));
    });
  });
  return lookup;
};
