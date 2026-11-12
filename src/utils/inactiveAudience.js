import { canonicalCityName, providerCityName } from './cityLabel';

/**
 * جمهور «المزودون الغائبون» في مركز الإشعارات — نفس مقياس صفحة المزودين غير النشطين:
 * عمر آخر موقع أرسله جوال المزود (التطبيق المتوقف لا يرسل موقعاً)، لا آخر تسجيل دخول.
 */
export const INACTIVITY_OPTIONS = [
  { value: 0, label: 'كل المزودين' },
  { value: 1440, label: 'غائب أكثر من 24 ساعة' },
  { value: 4320, label: 'غائب أكثر من 3 أيام' },
  { value: 10080, label: 'غائب أكثر من أسبوع' },
];

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (v.toMillis) return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

const approvalOf = (p) =>
  p.approvalStatus || (['pending', 'approved', 'rejected'].includes(p.status) ? p.status : null);

export const lastActivityMs = (p) => Math.max(toMs(p.locationUpdatedAt), toMs(p.location?.timestamp));

/**
 * المزودون المعتمدون غير المعطّلين الذين لم يصل موقعهم منذ minMinutes (أو لم يرسلوه أبداً)،
 * ضمن المدن المختارة (فارغة = كل المدن). يعيد قائمة المزودين.
 */
export function selectInactiveProviders(providers, { minMinutes, cityNames = [], now = Date.now() }) {
  const wanted = new Set(cityNames.map(canonicalCityName).filter(Boolean));
  return providers.filter((p) => {
    if (approvalOf(p) !== 'approved' || p.isActive === false || p.mergedInto) return false;
    const lastMs = lastActivityMs(p);
    if (lastMs && (now - lastMs) / 60000 < minMinutes) return false;
    return wanted.size === 0 || wanted.has(providerCityName(p));
  });
}
