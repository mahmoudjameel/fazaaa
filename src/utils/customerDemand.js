/**
 * المحاولات مقابل الاحتياج الفعلي: عميل لم يجد مزوداً يعيد الطلب عدة مرات،
 * فعدد الطلبات يبالغ في الطلب الحقيقي. طلبات العميل المتقاربة = احتياج واحد.
 */
const SAME_NEED_GAP_MS = 3 * 60 * 60 * 1000;

const toMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const customerKeyOf = (order) => order?.customerId || order?.userId || order?.customerPhone || `order:${order?.id}`;

/** يقسم طلبات العميل إلى احتياجات: طلب بعد فاصل أكبر من 3 ساعات يبدأ احتياجاً جديداً */
const splitIntoNeeds = (orders) => {
  const sorted = [...orders].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  const needs = [];
  sorted.forEach((order) => {
    const current = needs[needs.length - 1];
    const lastMs = current ? toMs(current[current.length - 1].createdAt) : 0;
    if (current && toMs(order.createdAt) - lastMs <= SAME_NEED_GAP_MS) current.push(order);
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
