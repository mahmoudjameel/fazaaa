import { initializeApp } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBLzVh55r-BaJ5cfUwm4q-c0XZKvOkyGOI',
  authDomain: 'fazaproject-c5059.firebaseapp.com',
  databaseURL: 'https://fazaproject-c5059-default-rtdb.firebaseio.com',
  projectId: 'fazaproject-c5059',
  storageBucket: 'fazaproject-c5059.firebasestorage.app',
  messagingSenderId: '939604805877',
  appId: '1:939604805877:web:63efb92f1a5f450c6a9dbc',
  measurementId: 'G-229FL5SZVW',
};

function normalizePhoneTo966(phone) {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('966')) return clean;
  if (clean.startsWith('0')) return `966${clean.slice(1)}`;
  if (clean.startsWith('5') && clean.length === 9) return `966${clean}`;
  return clean.length >= 9 ? `966${clean.slice(-9)}` : `966${clean}`;
}

function toLocal05(phone966) {
  return phone966.startsWith('966') ? `0${phone966.slice(3)}` : phone966;
}

function extractApprovalStatus(provider) {
  const statusFromApproval = provider?.approvalStatus;
  const statusFromLegacy =
    provider?.status && ['approved', 'pending', 'rejected'].includes(provider.status)
      ? provider.status
      : null;
  return statusFromApproval || statusFromLegacy || 'UNKNOWN';
}

function printProvider(provider) {
  const approval = extractApprovalStatus(provider.data);
  const data = provider.data;
  console.log('----------------------------------------');
  console.log(`docId           : ${provider.id}`);
  console.log(`uid field        : ${data.uid || 'N/A'}`);
  console.log(`name             : ${`${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A'}`);
  console.log(`phone            : ${data.phone || 'N/A'}`);
  console.log(`approvalStatus   : ${data.approvalStatus || 'N/A'}`);
  console.log(`status           : ${String(data.status ?? 'N/A')}`);
  console.log(`effective status : ${approval}`);
  console.log(`createdAt        : ${String(data.createdAt || 'N/A')}`);
  console.log(`updatedAt        : ${String(data.updatedAt || 'N/A')}`);
}

async function fetchByExactPhones(db, phones) {
  const hits = [];
  const seen = new Set();
  for (const phone of phones) {
    if (!phone) continue;
    const snap = await getDocs(query(collection(db, 'providers'), where('phone', '==', phone)));
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      hits.push({ id: docSnap.id, data: docSnap.data(), matchedBy: `phone == ${phone}` });
    }
  }
  return hits;
}

async function fetchByEmailCandidates(db, phone966, phone05) {
  const emailCandidates = [`${phone966}@fazaaa.com`, `${phone05}@fazaaa.com`];
  const hits = [];
  const seen = new Set();
  for (const email of emailCandidates) {
    const snap = await getDocs(
      query(collection(db, 'providers'), where('email', '==', email), limit(20))
    );
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      hits.push({ id: docSnap.id, data: docSnap.data(), matchedBy: `email == ${email}` });
    }
  }
  return hits;
}

async function scanByNormalizedPhone(db, phone966) {
  const providersSnap = await getDocs(collection(db, 'providers'));
  const normalizedHits = [];
  for (const docSnap of providersSnap.docs) {
    const data = docSnap.data();
    const p = String(data.phone || '');
    const normalized = normalizePhoneTo966(p);
    if (normalized === phone966) {
      normalizedHits.push({
        id: docSnap.id,
        data,
        matchedBy: `normalized(phone) == ${phone966} (stored phone: "${p}")`,
      });
    }
  }
  return normalizedHits;
}

async function scanCustomersByPhone(db, phones) {
  const hits = [];
  const seen = new Set();
  for (const phone of phones) {
    if (!phone) continue;
    const snap = await getDocs(query(collection(db, 'customers'), where('phone', '==', phone)));
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      hits.push({ id: docSnap.id, data: docSnap.data(), matchedBy: `customer.phone == ${phone}` });
    }
  }
  return hits;
}

function printDiagnosis(providerHits, normalizedHitsOnly) {
  const all = [...providerHits, ...normalizedHitsOnly];
  if (all.length === 0) {
    console.log('\n⚠️ النتيجة: لا يوجد أي مزود مطابق لهذا الرقم.');
    console.log('السبب المرجح: الرقم غير موجود في providers أو محفوظ بشكل مختلف كلياً.');
    return;
  }

  const statuses = all.map((x) => extractApprovalStatus(x.data));
  if (statuses.includes('rejected')) {
    console.log('\n⚠️ السبب المحتمل: يوجد سجل بحالة rejected (مرفوض).');
  }
  if (statuses.every((s) => s !== 'approved')) {
    console.log('\n⚠️ السبب المحتمل: لا يوجد سجل approved لهذا الرقم (غالباً pending أو حالة غير معروفة).');
  }
  if (normalizedHitsOnly.length > 0 && providerHits.length === 0) {
    console.log('\n⚠️ السبب المؤكد تقريباً: الرقم موجود لكن بتنسيق مختلف،');
    console.log('وتسجيل الدخول يبحث بالمطابقة الحرفية لـ phone (مثل 966... أو 05...) فقط.');
  }

  const duplicateCount = all.length;
  if (duplicateCount > 1) {
    console.log(`\n⚠️ ملاحظة: يوجد ${duplicateCount} سجلات لنفس الرقم (قد يسبب اختيار سجل غير صحيح).`);
  }
}

async function main() {
  const rawPhone = process.argv[2] || '0551780608';
  const phone966 = normalizePhoneTo966(rawPhone);
  const phone05 = toLocal05(phone966);
  const plus966 = `+${phone966}`;

  console.log('========================================');
  console.log('Provider Phone Diagnostic');
  console.log('========================================');
  console.log(`input phone        : ${rawPhone}`);
  console.log(`normalized (966)   : ${phone966}`);
  console.log(`local (05)         : ${phone05}`);
  console.log(`plus format        : ${plus966}`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const exactPhonesToCheck = [rawPhone, phone966, phone05, plus966];
  const providerExactHits = await fetchByExactPhones(db, exactPhonesToCheck);
  const providerEmailHits = await fetchByEmailCandidates(db, phone966, phone05);
  const providerNormalizedHits = await scanByNormalizedPhone(db, phone966);

  const allProviderHitsMap = new Map();
  [...providerExactHits, ...providerEmailHits].forEach((hit) => {
    if (!allProviderHitsMap.has(hit.id)) allProviderHitsMap.set(hit.id, hit);
  });
  const allProviderHits = Array.from(allProviderHitsMap.values());

  const normalizedOnly = providerNormalizedHits.filter(
    (x) => !allProviderHitsMap.has(x.id)
  );

  console.log('\n=== provider matches (exact phone/email) ===');
  if (allProviderHits.length === 0) {
    console.log('No exact matches.');
  } else {
    for (const hit of allProviderHits) {
      console.log(`\nMatched by: ${hit.matchedBy}`);
      printProvider(hit);
    }
  }

  console.log('\n=== provider matches (normalized scan fallback) ===');
  if (normalizedOnly.length === 0) {
    console.log('No normalized-only matches.');
  } else {
    for (const hit of normalizedOnly) {
      console.log(`\nMatched by: ${hit.matchedBy}`);
      printProvider(hit);
    }
  }

  const customerHits = await scanCustomersByPhone(db, exactPhonesToCheck);
  console.log('\n=== customer matches (for collision check) ===');
  if (customerHits.length === 0) {
    console.log('No customer records with same phone.');
  } else {
    for (const c of customerHits) {
      console.log('----------------------------------------');
      console.log(`docId         : ${c.id}`);
      console.log(`matchedBy     : ${c.matchedBy}`);
      console.log(`name          : ${`${c.data.firstName || ''} ${c.data.lastName || ''}`.trim() || 'N/A'}`);
      console.log(`phone         : ${c.data.phone || 'N/A'}`);
    }
  }

  printDiagnosis(allProviderHits, normalizedOnly);
  console.log('\n✅ انتهى الفحص.');
}

main().catch((err) => {
  console.error('\n❌ فشل تشغيل السكربت:', err?.message || err);
  process.exitCode = 1;
});
