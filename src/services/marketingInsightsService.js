import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';

export async function getLatestMarketingSnapshot() {
  const metaSnap = await getDoc(doc(db, 'analytics_meta', 'latest'));
  if (!metaSnap.exists()) {
    return { success: true, snapshot: null, meta: null };
  }
  const meta = metaSnap.data();
  const snapshotId = meta?.snapshotId;
  if (!snapshotId) {
    return { success: true, snapshot: null, meta };
  }
  const snap = await getDoc(doc(db, 'analytics_snapshots', snapshotId));
  return {
    success: true,
    meta,
    snapshot: snap.exists() ? { id: snap.id, ...snap.data() } : null,
  };
}

export async function refreshMarketingInsights(periodDays = 30) {
  const fn = httpsCallable(functions, 'refreshMarketingInsights');
  const res = await fn({ periodDays });
  return res.data;
}

export function formatCoverageStatus(status) {
  const map = {
    no_coverage: { label: 'بدون تغطية', cls: 'bg-red-50 text-red-700 border-red-200' },
    low_providers: { label: 'مزودون قليلون', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    high_demand: { label: 'طلب مرتفع', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    healthy: { label: 'متوازن', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    low_data: { label: 'بيانات قليلة', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  };
  return map[status] || { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
}

export function channelLabel(channel) {
  const map = {
    organic: 'بحث عضوي',
    paid: 'إعلانات مدفوعة',
    social: 'سوشيال ميديا',
    direct: 'مباشر',
    referral: 'إحالة',
    email: 'بريد إلكتروني',
    campaign: 'حملة UTM',
    internal: 'داخلي',
  };
  return map[channel] || channel;
}

export function sourceLabel(source) {
  const map = {
    direct: 'مباشر (بدون referrer)',
    google: 'Google',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    twitter: 'Twitter / X',
    snapchat: 'Snapchat',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    internal: 'داخلي (نفس الموقع)',
    referral: 'إحالة عامة',
  };
  return map[source] || source;
}

export function mediumLabel(medium) {
  const map = {
    none: 'بدون وسيط',
    organic: 'عضوي',
    social: 'سوشيال',
    cpc: 'إعلانات (CPC)',
    paid: 'مدفوع',
    email: 'بريد',
    referral: 'إحالة',
    utm: 'UTM',
  };
  return map[medium] || medium;
}

export function downloadSectionLabel(section) {
  const map = {
    hero_primary: 'زر التحميل الرئيسي (Hero)',
    hero_store_badge: 'شارات المتجر — Hero',
    header_provider: 'انضم كمزود — الهيدر',
    menu_cta: 'تحميل التطبيق — القائمة',
    menu_provider: 'انضم كمزود — القائمة',
    apps_card_mobile: 'بطاقة التطبيق — زر الجوال',
    apps_card_apple: 'بطاقة التطبيق — App Store',
    apps_card_google: 'بطاقة التطبيق — Google Play',
    footer: 'الفوتر',
  };
  return map[section] || section;
}

export const DOWNLOAD_MATRIX_ROWS = [
  { key: 'customer_apple', label: 'تطبيق العميل — App Store', app: 'customer', store: 'apple' },
  { key: 'customer_google', label: 'تطبيق العميل — Google Play', app: 'customer', store: 'google' },
  { key: 'provider_apple', label: 'تطبيق المزود — App Store', app: 'provider', store: 'apple' },
  { key: 'provider_google', label: 'تطبيق المزود — Google Play', app: 'provider', store: 'google' },
];
