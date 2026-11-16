import { addDoc, arrayUnion, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

/**
 * سجل تعديلات الحساب (account_change_log) — يحفظ القيمة القديمة والجديدة لكل حقل مهم
 * حتى يُتابَع صاحب الرقم المرجعي (C…/P…) عبر أرقام جواله السابقة. صفحة العرض: /admin/account-history.
 */
export const ACCOUNT_CHANGE_LOG = 'account_change_log';

export const TRACKED_FIELD_LABELS = {
  phone: 'الجوال',
  firstName: 'الاسم الأول',
  lastName: 'اسم العائلة',
  fullName: 'الاسم',
  name: 'الاسم',
  email: 'البريد',
  nationality: 'الجنسية',
  city: 'المدينة',
  providerType: 'نوع المزود',
  shopName: 'اسم المنشأة',
  freelanceDocumentNumber: 'رقم وثيقة العمل الحر',
  nationalId: 'رقم الهوية',
  iqamaNumber: 'رقم الإقامة',
  iban: 'الآيبان',
};

/** 966XXXXXXXXX — نفس صيغة التخزين في providers/customers */
export function normalizePhone966(phone) {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('00966')) return clean.slice(2);
  if (clean.startsWith('966')) return clean;
  if (clean.startsWith('05') && clean.length === 10) return `966${clean.slice(1)}`;
  if (clean.startsWith('5') && clean.length === 9) return `966${clean}`;
  return clean;
}

/** كل الصيغ التي قد يكون الرقم خُزّن بها */
export function phoneVariants(phone) {
  const n = normalizePhone966(phone);
  if (!n) return [];
  const local = n.startsWith('966') ? `0${n.slice(3)}` : n;
  return [...new Set([n, local, `+${n}`, String(phone || '').trim()].filter(Boolean))];
}

export function formatPhoneLocal(phone) {
  const n = normalizePhone966(phone);
  return n.startsWith('966') && n.length >= 12 ? `0${n.slice(3)}` : (phone || '');
}

const sameValue = (field, a, b) => (
  field === 'phone'
    ? normalizePhone966(a) === normalizePhone966(b)
    : String(a ?? '').trim() === String(b ?? '').trim()
);

export function diffTrackedFields(before = {}, updates = {}) {
  return Object.keys(TRACKED_FIELD_LABELS)
    .filter((field) => updates[field] !== undefined && !sameValue(field, before[field], updates[field]))
    .map((field) => ({ field, from: before[field] ?? null, to: updates[field] ?? null }));
}

/**
 * يسجّل التعديل إن غيّر حقلاً متابَعاً. فشل التسجيل لا يُفشل الحفظ نفسه.
 * @param {'providers'|'customers'} kind
 */
export async function recordAccountChange({ kind, accountId, before, updates, source, note = null }) {
  const changes = diffTrackedFields(before, updates);
  if (!changes.length) return;
  const phoneChange = changes.find((c) => c.field === 'phone');
  const phones = phoneChange
    ? [normalizePhone966(phoneChange.from), normalizePhone966(phoneChange.to)].filter(Boolean)
    : [];
  try {
    await addDoc(collection(db, ACCOUNT_CHANGE_LOG), {
      kind,
      accountId,
      accountNumber: before?.providerNumber || before?.customerNumber || null,
      changes,
      phones,
      source,
      note,
      by: auth.currentUser?.email || auth.currentUser?.uid || null,
      at: serverTimestamp(),
    });
    if (phoneChange?.from) {
      await updateDoc(doc(db, kind, accountId), {
        previousPhones: arrayUnion(normalizePhone966(phoneChange.from)),
      });
    }
  } catch (e) {
    console.warn('recordAccountChange failed:', e?.message || e);
  }
}
