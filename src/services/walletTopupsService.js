import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const TOPUPS_COLLECTION = 'wallet_topups';
const PROVIDERS_COLLECTION = 'providers';
const DEFAULT_PAGE_SIZE = 200;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const providerDisplayName = (data = {}) => {
  const name =
    data.name ||
    data.fullName ||
    [data.firstName, data.lastName].filter(Boolean).join(' ') ||
    data.businessName ||
    '';
  return String(name).trim() || 'مزود';
};

/**
 * جلب عمليات شحن محفظة المزودين عبر الراجحي/Neoleap
 * @param {{ state?: string, max?: number }} opts
 */
export async function getWalletTopUps({ state = 'all', max = DEFAULT_PAGE_SIZE } = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(Math.min(Math.max(max, 20), 500))];
  if (state && state !== 'all') {
    constraints.unshift(where('state', '==', state));
  }

  let snap;
  try {
    snap = await getDocs(query(collection(db, TOPUPS_COLLECTION), ...constraints));
  } catch (e) {
    // فهرس مركّب قد يكون غير موجود — رجوع بدون فلتر الحالة ثم فلترة محلياً
    console.warn('getWalletTopUps indexed query failed, fallback:', e?.message || e);
    snap = await getDocs(
      query(collection(db, TOPUPS_COLLECTION), orderBy('createdAt', 'desc'), limit(Math.min(Math.max(max, 20), 500)))
    );
  }

  const rows = snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      paidAt: toDate(data.paidAt),
    };
  });

  const filtered =
    state && state !== 'all' ? rows.filter((r) => String(r.state || '') === state) : rows;

  const providerIds = [...new Set(filtered.map((r) => r.uid || r.providerId).filter(Boolean))];
  const providersMap = {};
  await Promise.all(
    providerIds.map(async (providerId) => {
      try {
        const pSnap = await getDoc(doc(db, PROVIDERS_COLLECTION, providerId));
        if (!pSnap.exists()) {
          providersMap[providerId] = { name: 'مزود محذوف', phone: '—' };
          return;
        }
        const p = pSnap.data() || {};
        providersMap[providerId] = {
          name: providerDisplayName(p),
          phone: p.phone || p.phoneNumber || p.mobile || '—',
          approvalStatus: p.approvalStatus || null,
        };
      } catch (_) {
        providersMap[providerId] = { name: '—', phone: '—' };
      }
    })
  );

  return filtered.map((row) => {
    const pid = row.uid || row.providerId;
    const provider = (pid && providersMap[pid]) || {};
    return {
      ...row,
      providerId: pid || null,
      providerName: provider.name || '—',
      providerPhone: provider.phone || '—',
      providerApprovalStatus: provider.approvalStatus || null,
    };
  });
}

export const WALLET_TOPUP_STATES = {
  CREATED: { label: 'أُنشئت', color: 'bg-slate-100 text-slate-700' },
  PENDING_PAYMENT: { label: 'بانتظار الدفع', color: 'bg-amber-100 text-amber-800' },
  PROCESSING: { label: 'قيد المعالجة', color: 'bg-blue-100 text-blue-800' },
  PAID: { label: 'مدفوع / مشحون', color: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'فشل', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'ملغي', color: 'bg-gray-100 text-gray-700' },
  VOIDED: { label: 'ملغى (Void)', color: 'bg-purple-100 text-purple-800' },
};

export function getTopUpStateMeta(state) {
  const key = String(state || '').toUpperCase();
  return WALLET_TOPUP_STATES[key] || { label: state || 'غير معروف', color: 'bg-gray-100 text-gray-600' };
}
