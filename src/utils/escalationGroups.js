import { isUnresolvedEscalation } from './escalationStatus';

/**
 * دمج تصعيدات الطلب الواحد المكرر: العميل يعيد إرسال نفس الطلب بعد «لا يوجد مزودون»
 * فينشأ طلب جديد وتصعيد جديد لكل محاولة. نفس العميل + نفس الخدمة + موقع قريب
 * خلال ساعة من المحاولة السابقة = طلب فعلي واحد.
 * تأخر الوصول (late_arrival) لا يُدمج: له مزود وطلب حقيقي قائم.
 */
export const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;
export const DUPLICATE_MAX_DISTANCE_M = 1000;

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

const coordsOf = (e) => {
  const c = e?.coordinates;
  const lat = Number(c?.latitude ?? c?.lat);
  const lng = Number(c?.longitude ?? c?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null;
};

const distanceM = (a, b) => {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const norm = (s) => String(s || '').trim();

const sameSpot = (a, b) => {
  const ca = coordsOf(a);
  const cb = coordsOf(b);
  if (ca && cb) return distanceM(ca, cb) <= DUPLICATE_MAX_DISTANCE_M;
  return norm(a.location) !== '' && norm(a.location) === norm(b.location);
};

const isMergeable = (e) => e?.type !== 'late_arrival' && !!e?.customerId;

/**
 * @returns {{ key: string, primary: object, members: object[] }[]} الأحدث أولاً؛
 * primary = أحدث محاولة، members = كل المحاولات (الأحدث أولاً)
 */
export function groupDuplicateEscalations(escalations) {
  const sorted = [...(escalations || [])].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const groups = [];
  const openByCustomer = new Map(); // customerId → مجموعات قابلة للدمج
  sorted.forEach((e) => {
    if (isMergeable(e)) {
      const candidates = openByCustomer.get(e.customerId) || [];
      const target = candidates.find((g) => {
        const oldest = g.members[g.members.length - 1];
        // سلسلة: الفرق مع أقدم محاولة في المجموعة (الأقرب زمنياً لهذه) ≤ ساعة
        return toMs(oldest.createdAt) - toMs(e.createdAt) <= DUPLICATE_WINDOW_MS
          && norm(oldest.serviceName) === norm(e.serviceName)
          && sameSpot(oldest, e);
      });
      if (target) {
        target.members.push(e);
        return;
      }
      const g = { key: e.id, primary: e, members: [e] };
      groups.push(g);
      openByCustomer.set(e.customerId, [...candidates, g]);
      return;
    }
    groups.push({ key: e.id, primary: e, members: [e] });
  });
  return groups;
}

export const isUnresolvedGroup = (g) => g.members.some((e) => isUnresolvedEscalation(e));
export const unresolvedIdsOfGroup = (g) => g.members.filter((e) => isUnresolvedEscalation(e)).map((e) => e.id);
