import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  deleteDoc,
  deleteField,
  addDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  collectionGroup,
} from 'firebase/firestore';
import { auth, db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { normalizeDocumentsForStorage } from '../utils/documentUtils';
import { withNormalizedProviderWallet } from '../utils/providerWallet';
import { diagnoseProviderForRequest, evaluateProviderEligibility } from '../utils/dispatchDiagnostics';

// Providers Management
export const getAllProviders = async () => {
  try {
    const providersRef = collection(db, 'providers');
    const q = query(providersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const providers = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // إخفاء السجلات المدمجة (المكررة) من لوحة الإدارة
      if (data?.mergedInto) return;
      // id: doc.id يجب أن يكون أخيراً لضمان استخدام Firestore document ID دائماً
      // وعدم تجاوزه بحقل id داخل بيانات المستند
      providers.push(withNormalizedProviderWallet({ ...data, id: doc.id }));
    });
    return { success: true, providers };
  } catch (error) {
    console.error('Get providers error:', error);
    throw error;
  }
};

const normalizePhoneTo966 = (phone) => {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('966')) return clean;
  if (clean.startsWith('0')) return '966' + clean.slice(1);
  if (clean.startsWith('5') && clean.length === 9) return '966' + clean;
  return clean.length >= 9 ? '966' + clean.slice(-9) : '966' + clean;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * إصلاح شامل للمزوّدين المكررين حسب رقم الهاتف
 * - اختيار سجل أساسي (approved أولاً ثم الأحدث)
 * - دمج بيانات مهمة في السجل الأساسي
 * - تحويل السجلات المكررة إلى merged وعدم السماح بمطابقتها برقم الهاتف
 */
export const repairDuplicateProviders = async () => {
  const providersRef = collection(db, 'providers');
  const allSnap = await getDocs(providersRef);
  const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const groups = new Map();
  all.forEach((p) => {
    if (p?.mergedInto) return; // متجاوز مسبقاً
    const key = normalizePhoneTo966(p.phone);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });

  const statusOrder = { approved: 0, pending: 1, rejected: 2 };
  const result = {
    scanned: all.length,
    duplicateGroups: 0,
    mergedRecords: 0,
    fixedRequests: 0,
    keepers: [],
  };

  for (const [phoneKey, records] of groups.entries()) {
    if (records.length <= 1) continue;
    result.duplicateGroups++;

    const sorted = [...records].sort((a, b) => {
      const aStatus = a.approvalStatus || a.status;
      const bStatus = b.approvalStatus || b.status;
      const oa = statusOrder[aStatus] ?? 9;
      const ob = statusOrder[bStatus] ?? 9;
      if (oa !== ob) return oa - ob;
      return toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt);
    });

    const keeper = sorted[0];
    const duplicates = sorted.slice(1);
    result.keepers.push(keeper.id);

    let mergedServices = { ...(keeper.services || {}) };
    let mergedDocs = { ...(keeper.documents || {}) };
    let pushToken = keeper.pushToken || null;

    for (const dup of duplicates) {
      mergedServices = { ...(dup.services || {}), ...mergedServices };
      mergedDocs = { ...(dup.documents || {}), ...mergedDocs };
      if (!pushToken && dup.pushToken) pushToken = dup.pushToken;

      const requestsQ = query(collection(db, 'requests'), where('providerId', '==', dup.id));
      const requestsSnap = await getDocs(requestsQ);
      for (const req of requestsSnap.docs) {
        await updateDoc(req.ref, {
          providerId: keeper.id,
          providerName: keeper.fullName || `${keeper.firstName || ''} ${keeper.lastName || ''}`.trim() || 'مزود',
          providerPhone: keeper.phone || '',
          updatedAt: new Date().toISOString(),
        });
        result.fixedRequests++;
      }

      // تحويل السجل المكرر إلى merged بدل حذفه (أكثر أماناً)
      await updateDoc(doc(db, 'providers', dup.id), {
        mergedInto: keeper.id,
        mergedAt: new Date().toISOString(),
        isActive: false,
        isOnline: false,
        approvalStatus: 'rejected',
        status: 'rejected',
        phone: `merged_${dup.id}_${dup.phone || ''}`,
        updatedAt: new Date().toISOString(),
      });
      result.mergedRecords++;
    }

    await updateDoc(doc(db, 'providers', keeper.id), {
      services: mergedServices,
      documents: mergedDocs,
      ...(pushToken ? { pushToken } : {}),
      phone: phoneKey, // توحيد الرقم على صيغة 966
      deduplicatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true, ...result };
};

export const createManualProvider = async (providerData) => {
  try {
    const providersRef = collection(db, 'providers');

    // تنسيق رقم الهاتف (يجب أن يكون 9665XXXXXXXX)
    let phone = (providerData.phone || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('05')) {
      phone = '966' + phone.substring(1);
    } else if (phone.startsWith('5') && !phone.startsWith('966')) {
      phone = '966' + phone;
    } else if (!phone.startsWith('966')) {
      phone = '966' + phone;
    }

    // التحقق من تكرار رقم الجوال (سواء مُخزَّن بصيغة 9665xxx أو 05xxx أو 5xxx)
    const canonical = phone;
    const withZero = canonical.startsWith('966') ? '0' + canonical.slice(3) : '';
    const withoutCountry = canonical.startsWith('966') ? canonical.slice(3) : canonical;
    const q1 = query(providersRef, where('phone', '==', canonical));
    const q2 = withZero ? query(providersRef, where('phone', '==', withZero)) : null;
    const q3 = withoutCountry ? query(providersRef, where('phone', '==', withoutCountry)) : null;
    const [snap1, snap2, snap3] = await Promise.all([
      getDocs(q1),
      q2 ? getDocs(q2) : Promise.resolve({ empty: true }),
      q3 ? getDocs(q3) : Promise.resolve({ empty: true }),
    ]);
    if (!snap1.empty || (snap2 && !snap2.empty) || (snap3 && !snap3.empty)) {
      return { success: false, error: 'duplicate_phone' };
    }

    // تجهيز الخدمات
    const services = {};
    if (providerData.services && Array.isArray(providerData.services)) {
      providerData.services.forEach(serviceId => {
        services[serviceId] = {
          status: 'approved',
          requestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });
    }

    const newProvider = {
      firstName: (providerData.firstName || '').trim() || 'مزود',
      lastName: (providerData.lastName || '').trim() || '',
      fullName: [providerData.firstName, providerData.lastName].filter(Boolean).map(s => (s || '').trim()).join(' ').trim() || 'مزود',
      phone: phone,
      email: providerData.email || null,
      nationality: providerData.nationality || '',
      city: providerData.city || '',
      services: services,
      status: 'approved',
      approvalStatus: 'approved',
      isActive: true,
      isOnline: false,
      registrationMethod: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        totalOrders: 0,
        rating: 0,
        earnings: 0,
      },
      wallet: {
        balance: 50.0,
        lastUpdated: new Date().toISOString(),
        initialBalance: 50.0,
      },
      hasSeenWelcomeAlert: false,
      // تمت إضافة الرصيد الابتدائي يدويًا من لوحة التحكم، لذلك نعتبر بونص الاعتماد مستلمًا
      // حتى لا يقوم التطبيق بإضافته مرة ثانية عند أول دخول.
      hasReceivedApprovalBonus: true,
    };

    // توحيد المفاتيح مع تطبيق المزود (carPhotoFront, idImage, ...)
    newProvider.documents = normalizeDocumentsForStorage(providerData.documents || {});

    const docRef = await addDoc(providersRef, newProvider);
    // تحديث المستند بـ uid ليتوافق مع هيكلة التطبيق
    await updateDoc(doc(db, 'providers', docRef.id), {
      uid: docRef.id
    });

    // إضافة سجل المعاملة الأولية
    const transactionsRef = collection(db, 'providers', docRef.id, 'transactions');
    await addDoc(transactionsRef, {
      type: 'initial',
      amount: 50.0,
      balance: 50.0,
      reason: 'رصيد ابتدائي عند التسجيل (يدوي)',
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Create manual provider error:', error);
    throw error;
  }
};

// جلب بيانات مزود محدد
export const getProviderById = async (providerId) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);

    if (!providerSnap.exists()) {
      return { success: false, error: 'المزود غير موجود' };
    }

    return { success: true, provider: withNormalizedProviderWallet({ ...providerSnap.data(), id: providerSnap.id }) };
  } catch (error) {
    console.error('Get provider by ID error:', error);
    throw error;
  }
};

/**
 * تشخيص: لماذا لم يصل طلب لمزود معيّن؟ (نفس منطق performStagedSearch)
 */
export const runDispatchDiagnostics = async (requestId, providerId) => {
  if (!requestId?.trim() || !providerId?.trim()) {
    return { success: false, error: 'أدخل معرّف الطلب ومعرّف المزود' };
  }

  const [requestSnap, providerSnap, settingsSnap, onlineSnap] = await Promise.all([
    getDoc(doc(db, 'requests', requestId.trim())),
    getDoc(doc(db, 'providers', providerId.trim())),
    getDoc(doc(db, 'settings', 'distribution')),
    getDocs(query(collection(db, 'providers'), where('isOnline', '==', true))),
  ]);

  if (!requestSnap.exists()) {
    return { success: false, error: 'الطلب غير موجود' };
  }
  if (!providerSnap.exists()) {
    return { success: false, error: 'المزود غير موجود' };
  }

  const request = { id: requestSnap.id, ...requestSnap.data() };
  const provider = { id: providerSnap.id, ...providerSnap.data() };
  const distributionSettings = settingsSnap.exists() ? settingsSnap.data() : {};

  const onlineProviders = [];
  onlineSnap.forEach((d) => {
    onlineProviders.push({ id: d.id, data: d.data() });
  });

  const report = diagnoseProviderForRequest(
    provider.id,
    provider,
    request,
    onlineProviders,
    distributionSettings
  );

  return {
    success: true,
    request,
    provider,
    distributionSettings,
    onlineCount: onlineSnap.size,
    report,
  };
};

/**
 * حذف مزود نهائياً (Cloud Function — مدير عام فقط)
 */
export const permanentlyDeleteProvider = async (providerId) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
  }
  await user.getIdToken(true);

  const fn = httpsCallable(functions, 'adminDeleteProviderPermanently');
  try {
    const result = await fn({ providerId, confirm: true });
    return result.data;
  } catch (error) {
    const code = error?.code || '';
    if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
      throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
    }
    throw error;
  }
};

/**
 * حذف عميل/مستخدم نهائياً مع سجلاته (Cloud Function — مدير عام فقط)
 */
export const permanentlyDeleteCustomer = async (userId) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
  }
  await user.getIdToken(true);

  const fn = httpsCallable(functions, 'adminDeleteCustomerPermanently');
  try {
    const result = await fn({ userId, confirm: true });
    return result.data;
  } catch (error) {
    const code = error?.code || '';
    if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
      throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
    }
    const message = error?.message || error?.details || 'فشل الحذف';
    throw new Error(message);
  }
};

/**
 * تحديث كلمة مرور مدير لوحة التحكم (مدير عام فقط)
 */
export const updateDashboardAdminPassword = async (adminId, newPassword) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
  }
  await user.getIdToken(true);

  const fn = httpsCallable(functions, 'adminUpdateDashboardAdminPassword');
  try {
    const result = await fn({ adminId, newPassword });
    return result.data;
  } catch (error) {
    const code = error?.code || '';
    if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
      throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
    }
    throw new Error(error?.message || 'فشل تحديث كلمة المرور');
  }
};

/**
 * حذف مدير لوحة التحكم من Auth + Firestore (مدير عام فقط)
 */
export const deleteDashboardAdmin = async (adminId) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
  }
  await user.getIdToken(true);

  const fn = httpsCallable(functions, 'adminDeleteDashboardAdmin');
  try {
    const result = await fn({ adminId, confirm: true });
    return result.data;
  } catch (error) {
    const code = error?.code || '';
    if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
      throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد');
    }
    throw new Error(error?.message || 'فشل حذف المدير');
  }
};

/**
 * بناء كائن services بكل الخدمات معتمدة (للتوافق مع تطبيق المزود و Cloud Functions)
 */
const buildApprovedServicesMap = (currentServices, nowIso = new Date().toISOString()) => {
  const approvedServices = {};

  if (Array.isArray(currentServices)) {
    currentServices.forEach((entry) => {
      const serviceId = typeof entry === 'string' ? entry : entry?.id || entry?.serviceId;
      if (!serviceId) return;
      const key = String(serviceId);
      approvedServices[key] = {
        ...(typeof entry === 'object' && entry !== null ? entry : {}),
        status: 'approved',
        approved: true,
        requestedAt: entry?.requestedAt || nowIso,
        updatedAt: nowIso,
      };
    });
    return approvedServices;
  }

  if (currentServices && typeof currentServices === 'object') {
    Object.entries(currentServices).forEach(([serviceId, serviceData]) => {
      const key = String(serviceId);
      if (serviceData && typeof serviceData === 'object' && !Array.isArray(serviceData)) {
        approvedServices[key] = {
          ...serviceData,
          status: 'approved',
          approved: true,
          updatedAt: nowIso,
        };
      } else if (serviceData === true) {
        approvedServices[key] = {
          status: 'approved',
          approved: true,
          requestedAt: nowIso,
          updatedAt: nowIso,
        };
      } else {
        approvedServices[key] = {
          status: 'approved',
          approved: true,
          requestedAt: nowIso,
          updatedAt: nowIso,
        };
      }
    });
  }

  return approvedServices;
};

export const updateProviderStatus = async (providerId, status) => {
  try {
    if (status === 'approved') {
      return await approveProviderWithAllServices(providerId);
    }

    const providerRef = doc(db, 'providers', providerId);
    await updateDoc(providerRef, {
      approvalStatus: status,
      status,
      isOnline: false,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Update provider status error:', error);
    throw error;
  }
};

/**
 * اعتماد المزود واعتماد جميع خدماته دفعة واحدة
 */
export const approveProviderWithAllServices = async (providerId) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);
    if (!providerSnap.exists()) {
      throw new Error('المزود غير موجود');
    }

    const providerData = providerSnap.data() || {};
    const nowIso = new Date().toISOString();
    const approvedServices = buildApprovedServicesMap(providerData.services || {}, nowIso);

    await updateDoc(providerRef, {
      approvalStatus: 'approved',
      status: 'approved',
      isActive: true,
      services: approvedServices,
      accountActivatedAt: nowIso,
      approvedAt: nowIso,
      notificationsStartAt: nowIso,
      // يمنع تطبيق المزود من إضافة رصيد ترحيبي 50 ر.س عند أول دخول بعد الاعتماد
      hasReceivedApprovalBonus: true,
      updatedAt: nowIso,
    });

    return { success: true, services: approvedServices };
  } catch (error) {
    console.error('Approve provider with all services error:', error);
    throw error;
  }
};

/**
 * إصلاح المزودين المعتمدين مسبقاً وخدماتهم ما زالت pending
 */
export const repairApprovedProvidersPendingServices = async () => {
  const { providers } = await getAllProviders();
  let fixed = 0;

  for (const provider of providers) {
    const approvalStatus = provider.approvalStatus || provider.status;
    if (approvalStatus !== 'approved') continue;

    const services = provider.services || {};
    const entries = Array.isArray(services)
      ? services.map((s) => ({ id: typeof s === 'string' ? s : s?.id, data: s }))
      : Object.entries(services).map(([id, data]) => ({ id, data }));

    const hasPending = entries.some(({ data }) => {
      if (!data) return false;
      if (typeof data !== 'object') return data !== true;
      const st = data.status;
      return st !== 'approved' && st !== 'rejected';
    });

    if (hasPending) {
      await approveProviderWithAllServices(provider.id);
      fixed += 1;
    }
  }

  return { success: true, fixed, scanned: providers.length };
};

// Cities Management
export const getAllCities = async () => {
  try {
    const citiesRef = collection(db, 'cities');
    const querySnapshot = await getDocs(citiesRef);
    const cities = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      cities.push({
        ...data,
        id: docSnap.id,
        slug: data.slug || data.id || docSnap.id,
      });
    });
    cities.sort((a, b) => {
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });
    return { success: true, cities };
  } catch (error) {
    console.error('Get cities error:', error);
    return { success: false, error: error.message };
  }
};

// إدارة الخدمات للمزود
export const updateProviderServiceStatus = async (providerId, serviceId, status) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);

    if (!providerSnap.exists()) {
      throw new Error('المزود غير موجود');
    }

    const providerData = providerSnap.data();
    const services = providerData.services || {};

    // تحديث حالة الخدمة
    if (services[serviceId]) {
      services[serviceId] = {
        ...services[serviceId],
        status, // pending, approved, rejected
        updatedAt: new Date().toISOString(),
      };
    } else {
      // إذا كانت الخدمة غير موجودة، إضافتها
      services[serviceId] = {
        status,
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    await updateDoc(providerRef, {
      services,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Update provider service status error:', error);
    throw error;
  }
};

/**
 * تحديث بيانات المزود (الاسم، الهاتف، البريد، الجنسية، إلخ)
 */
export const updateProvider = async (providerId, data) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);
    if (!providerSnap.exists()) {
      throw new Error('المزود غير موجود');
    }
    const updates = {
      updatedAt: new Date().toISOString(),
    };
    if (data.firstName !== undefined) updates.firstName = data.firstName;
    if (data.lastName !== undefined) updates.lastName = data.lastName;
    if (data.fullName !== undefined) {
      updates.fullName = data.fullName;
    } else if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = providerSnap.data();
      const first = data.firstName !== undefined ? data.firstName : current.firstName;
      const last = data.lastName !== undefined ? data.lastName : current.lastName;
      updates.fullName = [first, last].filter(Boolean).join(' ').trim() || current.fullName || 'مزود';
    }
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.nationality !== undefined) updates.nationality = data.nationality;
    if (data.city !== undefined) updates.city = data.city;
    if (data.providerType !== undefined) {
      updates.providerType = data.providerType === 'non_saudi' ? 'non_saudi' : 'saudi';
    }
    if (data.shopName !== undefined) updates.shopName = String(data.shopName || '').trim();
    if (data.freelanceDocumentNumber !== undefined) {
      updates.freelanceDocumentNumber = String(data.freelanceDocumentNumber || '').trim();
    }
    await updateDoc(providerRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Update provider error:', error);
    throw error;
  }
};

/**
 * حذف مستند/صورة واحدة من مستندات المزود
 */
export const removeProviderDocument = async (providerId, documentKey) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);
    if (!providerSnap.exists()) {
      throw new Error('المزود غير موجود');
    }
    const providerData = providerSnap.data();
    const documents = { ...(providerData.documents || {}) };
    delete documents[documentKey];
    await updateDoc(providerRef, {
      documents,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Remove provider document error:', error);
    throw error;
  }
};

/**
 * إضافة أو تحديث مستند/صورة للمزود
 * @param {string} providerId
 * @param {string} documentKey - مثلاً idImage, equipmentPhoto, licensePhoto, registrationPhoto, carPhotoFront, carPhotoSide
 * @param {string|{url: string, type?: string}} value - رابط فقط أو { url, type: 'image'|'pdf'|'word' }
 */
export const addOrUpdateProviderDocument = async (providerId, documentKey, value) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);
    if (!providerSnap.exists()) {
      throw new Error('المزود غير موجود');
    }
    const providerData = providerSnap.data();
    const documents = { ...(providerData.documents || {}) };
    documents[documentKey] = typeof value === 'string' ? value : value;
    await updateDoc(providerRef, {
      documents,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Add/update provider document error:', error);
    throw error;
  }
};

/**
 * إزالة خدمة من مزود (حذف الخدمة من قائمة خدمات المزود)
 */
export const removeProviderService = async (providerId, serviceId) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);
    if (!providerSnap.exists()) {
      throw new Error('المزود غير موجود');
    }
    const providerData = providerSnap.data();
    const services = { ...(providerData.services || {}) };
    delete services[serviceId];
    // دعم المفتاح القديم serviceId إذا كان مستخدماً
    const altKey = Object.keys(services).find(k => services[k]?.serviceId === serviceId);
    if (altKey) delete services[altKey];
    await updateDoc(providerRef, {
      services,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Remove provider service error:', error);
    throw error;
  }
};

export const BLOCK_REASON_LABELS = {
  provider_rejected_request: 'رفض الطلب من المزود',
  provider_cancelled_request: 'إلغاء الطلب من المزود',
};

function parseBlockedUntilMs(blockedUntil) {
  if (!blockedUntil) return 0;
  if (typeof blockedUntil.toMillis === 'function') return blockedUntil.toMillis();
  if (blockedUntil.seconds) return blockedUntil.seconds * 1000;
  return new Date(blockedUntil).getTime();
}

function normalizeBlockDoc(docSnap, customerIdOverride = null) {
  const customerId = customerIdOverride || docSnap.ref.parent?.parent?.id;
  const data = docSnap.data();
  const blockedUntilMs = parseBlockedUntilMs(data.blockedUntil);
  const now = Date.now();
  return {
    id: docSnap.id,
    providerId: data.providerId || docSnap.id,
    customerId,
    requestId: data.requestId || null,
    reason: data.reason || null,
    blockedAt: data.blockedAt || null,
    blockedUntil: data.blockedUntil || null,
    blockedUntilMs,
    isActive: blockedUntilMs > now,
  };
}

/**
 * جلب جميع السجلات التي تحظر هذا المزود من جميع العملاء
 * @param {string} providerId
 */
export const getProviderBlocks = async (providerId) => {
  try {
    let blocks = [];
    try {
      const blockedQuery = query(
        collectionGroup(db, 'blocked_providers'),
        where('providerId', '==', providerId)
      );
      const snapshot = await getDocs(blockedQuery);
      snapshot.forEach((docSnap) => {
        blocks.push(normalizeBlockDoc(docSnap));
      });
    } catch (groupErr) {
      console.warn('collectionGroup blocked_providers failed, skipping:', groupErr?.message);
    }

    const customerIds = [...new Set(blocks.map((b) => b.customerId).filter(Boolean))];
    const customerMap = {};
    await Promise.all(
      customerIds.map(async (cid) => {
        try {
          const snap = await getDoc(doc(db, 'customers', cid));
          if (snap.exists()) customerMap[cid] = snap.data();
        } catch (_) { /* ignore */ }
      })
    );

    blocks = blocks.map((b) => ({
      ...b,
      customerName: customerMap[b.customerId]?.name || customerMap[b.customerId]?.fullName || null,
      customerPhone: customerMap[b.customerId]?.phone || null,
    }));

    blocks.sort((a, b) => (b.blockedUntilMs || 0) - (a.blockedUntilMs || 0));
    return { success: true, blocks };
  } catch (error) {
    console.error('Get provider blocks error:', error);
    return { success: false, error: error.message, blocks: [] };
  }
};

/**
 * جلب المزودين المحظورين لعميل معيّن
 * @param {string} customerId
 */
export const getCustomerBlockedProviders = async (customerId) => {
  try {
    const blockedRef = collection(db, 'customers', customerId, 'blocked_providers');
    const snapshot = await getDocs(blockedRef);
    let blocks = snapshot.docs.map((docSnap) => normalizeBlockDoc(docSnap, customerId));

    const providerIds = [...new Set(blocks.map((b) => b.providerId).filter(Boolean))];
    const providerMap = {};
    await Promise.all(
      providerIds.map(async (pid) => {
        try {
          const snap = await getDoc(doc(db, 'providers', pid));
          if (snap.exists()) providerMap[pid] = snap.data();
        } catch (_) { /* ignore */ }
      })
    );

    blocks = blocks.map((b) => {
      const p = providerMap[b.providerId];
      const name = p
        ? [p.firstName, p.lastName].filter(Boolean).join(' ') || p.fullName || p.name
        : null;
      return { ...b, providerName: name, providerPhone: p?.phone || null };
    });

    blocks.sort((a, b) => (b.blockedUntilMs || 0) - (a.blockedUntilMs || 0));
    return { success: true, blocks };
  } catch (error) {
    console.error('Get customer blocked providers error:', error);
    return { success: false, error: error.message, blocks: [] };
  }
};

/**
 * رفع الحظر عن مزود لعميل معين
 * @param {string} customerId
 * @param {string} providerId
 */
export const unblockProviderForCustomer = async (customerId, providerId) => {
  try {
    const blockRef = doc(db, 'customers', customerId, 'blocked_providers', providerId);
    await deleteDoc(blockRef);
    return { success: true };
  } catch (error) {
    console.error('Unblock provider error:', error);
    throw error;
  }
};

// Provider Groups Management
export const getAllProviderGroups = async () => {
  try {
    const groupsRef = collection(db, 'provider_groups');
    const q = query(groupsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const groups = [];
    querySnapshot.forEach((doc) => {
      groups.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, groups };
  } catch (error) {
    console.error('Get provider groups error:', error);
    throw error;
  }
};

export const createProviderGroup = async (groupData) => {
  try {
    const groupsRef = collection(db, 'provider_groups');
    const newGroup = {
      name: groupData.name,
      description: groupData.description || '',
      color: groupData.color || '#6366F1',
      icon: groupData.icon || 'users',
      isVip: groupData.isVip || false,
      priority: groupData.priority || 0, // أولوية المجموعة في التوزيع
      memberIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(groupsRef, newGroup);
    return { success: true, groupId: docRef.id };
  } catch (error) {
    console.error('Create provider group error:', error);
    throw error;
  }
};

export const updateProviderGroup = async (groupId, groupData) => {
  try {
    const groupRef = doc(db, 'provider_groups', groupId);
    await updateDoc(groupRef, {
      name: groupData.name,
      description: groupData.description,
      color: groupData.color,
      icon: groupData.icon,
      isVip: groupData.isVip,
      priority: groupData.priority,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Update provider group error:', error);
    throw error;
  }
};

export const deleteProviderGroup = async (groupId) => {
  try {
    const groupRef = doc(db, 'provider_groups', groupId);

    // إزالة المجموعة من جميع المزوّدين
    const providersSnapshot = await getDocs(
      query(collection(db, 'providers'), where('groupId', '==', groupId))
    );

    const updatePromises = providersSnapshot.docs.map(async (providerDoc) => {
      await updateDoc(doc(db, 'providers', providerDoc.id), {
        groupId: null,
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);
    await deleteDoc(groupRef);
    return { success: true };
  } catch (error) {
    console.error('Delete provider group error:', error);
    throw error;
  }
};

export const assignProvidersToGroup = async (providerIds, groupId) => {
  try {
    const updatePromises = providerIds.map(async (providerId) => {
      const providerRef = doc(db, 'providers', providerId);
      await updateDoc(providerRef, {
        groupId: groupId || null,
        type: groupId ? 'vip' : 'general', // تحديث النوع حسب المجموعة
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);

    // تحديث قائمة الأعضاء في المجموعة
    if (groupId) {
      const groupRef = doc(db, 'provider_groups', groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const currentMemberIds = groupSnap.data().memberIds || [];
        const updatedMemberIds = [...new Set([...currentMemberIds, ...providerIds])];
        await updateDoc(groupRef, {
          memberIds: updatedMemberIds,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Assign providers to group error:', error);
    throw error;
  }
};

export const removeProviderFromGroup = async (providerId) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    const providerSnap = await getDoc(providerRef);

    if (providerSnap.exists()) {
      const groupId = providerSnap.data().groupId;

      // إزالة المزود من المجموعة
      await updateDoc(providerRef, {
        groupId: null,
        type: 'general',
        updatedAt: serverTimestamp(),
      });

      // إزالة المزود من قائمة أعضاء المجموعة
      if (groupId) {
        const groupRef = doc(db, 'provider_groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const currentMemberIds = groupSnap.data().memberIds || [];
          const updatedMemberIds = currentMemberIds.filter(id => id !== providerId);
          await updateDoc(groupRef, {
            memberIds: updatedMemberIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Remove provider from group error:', error);
    throw error;
  }
};

// Orders Management
export const getAllOrders = async () => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const orders = [];
    querySnapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, orders };
  } catch (error) {
    console.error('Get orders error:', error);
    throw error;
  }
};

export const getOrderById = async (orderId) => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
      return { success: true, order: { id: orderSnap.id, ...orderSnap.data() } };
    }
    return { success: false };
  } catch (error) {
    console.error('Get order error:', error);
    throw error;
  }
};

// Statistics - من مجموعتي requests و orders
const ACTIVE_REQUEST_STATUSES = ['searching', 'accepted', 'assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs', 'arriving'];
const CANCELLED_REQUEST_STATUSES = ['canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_client', 'canceled_by_client_with_reason', 'timed_out'];

function toDate(ts) {
  if (!ts) return null;
  if (ts.toMillis) return new Date(ts.toMillis());
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export const getDashboardStats = async () => {
  try {
    const [providersSnapshot, requestsSnapshot, ordersSnapshot, customersSnapshot] = await Promise.all([
      getDocs(collection(db, 'providers')),
      getDocs(collection(db, 'requests')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'customers')),
    ]);

    const providers = [];
    providersSnapshot.forEach((doc) => providers.push({ ...doc.data(), id: doc.id }));

    const customers = [];
    customersSnapshot.forEach((doc) => customers.push({ ...doc.data(), id: doc.id }));

    // دمج الطلبات من المجموعتين (requests + orders) بدون تكرار
    const allOrdersMap = new Map();
    requestsSnapshot.forEach((doc) => allOrdersMap.set(doc.id, { id: doc.id, ...doc.data() }));
    ordersSnapshot.forEach((doc) => {
      if (!allOrdersMap.has(doc.id)) allOrdersMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    const allOrders = Array.from(allOrdersMap.values());

    const completed = allOrders.filter((o) => o.status === 'completed');
    const activeOrders = allOrders.filter((o) => ACTIVE_REQUEST_STATUSES.includes(o.status));
    const cancelledOrders = allOrders.filter((o) => CANCELLED_REQUEST_STATUSES.includes(o.status));

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const todayOrders = allOrders.filter((o) => { const d = toDate(o.createdAt); return d && d.toDateString() === todayStr; });
    const yesterdayOrders = allOrders.filter((o) => { const d = toDate(o.createdAt); return d && d.toDateString() === yesterdayStr; });

    const todayCompleted = todayOrders.filter((o) => o.status === 'completed');
    const yesterdayCompleted = yesterdayOrders.filter((o) => o.status === 'completed');

    const todayCancelled = todayOrders.filter((o) => CANCELLED_REQUEST_STATUSES.includes(o.status));
    const yesterdayCancelled = yesterdayOrders.filter((o) => CANCELLED_REQUEST_STATUSES.includes(o.status));

    const todayRevenue = todayCompleted.reduce((s, o) => s + (Number(o.price) || Number(o.servicePrice) || 0), 0);
    const yesterdayRevenue = yesterdayCompleted.reduce((s, o) => s + (Number(o.price) || Number(o.servicePrice) || 0), 0);

    const todayCommission = todayCompleted.reduce((s, o) => s + (Number(o.commission) || 0), 0);
    const yesterdayCommission = yesterdayCompleted.reduce((s, o) => s + (Number(o.commission) || 0), 0);

    const calcChange = (current, previous) => {
      if (previous === 0 && current === 0) return '0%';
      if (previous === 0) return `+${current}`;
      const pct = Math.round(((current - previous) / previous) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    const stats = {
      totalProviders: providers.length,
      totalCustomers: customers.length,
      activeProviders: providers.filter((p) => {
        const approvalStatus = p.approvalStatus || p.status;
        return approvalStatus === 'approved' && p.isOnline;
      }).length,
      pendingProviders: providers.filter((p) => {
        const approvalStatus = p.approvalStatus || p.status;
        return approvalStatus === 'pending';
      }).length,
      totalOrders: allOrders.length,
      completedOrders: completed.length,
      activeOrders: activeOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue: completed.reduce((sum, o) => sum + (Number(o.price) || Number(o.servicePrice) || 0), 0),
      totalCommission: completed.reduce((sum, o) => sum + (Number(o.commission) || 0), 0),
      todayOrders: todayOrders.length,
      // نسب التغيير (اليوم مقارنة بالأمس)
      changeProviders: calcChange(providers.length, providers.length),
      changeOrders: calcChange(todayOrders.length, yesterdayOrders.length),
      changeCompleted: calcChange(todayCompleted.length, yesterdayCompleted.length),
      changeCancelled: calcChange(todayCancelled.length, yesterdayCancelled.length),
      changeRevenue: calcChange(todayRevenue, yesterdayRevenue),
      changeCommission: calcChange(todayCommission, yesterdayCommission),
    };

    return { success: true, stats };
  } catch (error) {
    console.error('Get stats error:', error);
    throw error;
  }
};

// Recent Activity
export const getRecentActivity = async () => {
  try {
    // الحصول على الطلبات الأخيرة مع تفاصيل الرفض والإلغاء
    const requestsRef = collection(db, 'requests');
    const q = query(requestsRef, orderBy('updatedAt', 'desc'), limit(20));
    const querySnapshot = await getDocs(q);
    const activities = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const history = Array.isArray(data.history) ? data.history : [];

      // البحث عن أحداث الرفض والإلغاء في history
      const rejectionEvents = history.filter(h =>
        h.action === 'provider_rejection' ||
        h.action === 'provider_cancellation' ||
        ['canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_client', 'canceled_by_client_with_reason'].includes(h.status)
      );

      // إضافة نشاط لكل حدث رفض أو إلغاء
      rejectionEvents.forEach((event, index) => {
        let activityType = 'order';
        let activityTitle = '';

        if (event.action === 'provider_rejection') {
          activityType = 'rejection';
          activityTitle = `رفض من المزود - ${data.serviceName || 'خدمة'}`;
        } else if (event.action === 'provider_cancellation' || ['canceled_by_provider', 'canceled_by_provider_with_reason'].includes(event.status)) {
          // التحقق من أن المزود قبل الطلب أولاً
          const wasAccepted = data.status === 'assigned' ||
            data.status === 'en_route' ||
            data.status === 'arrived' ||
            data.status === 'in_progress' ||
            data.assignedAt ||
            history.some(h => h.status === 'assigned' && h.updatedBy === 'provider');

          if (wasAccepted) {
            activityType = 'provider_cancel_after_accept';
            activityTitle = `رفض المزود بعد قبول الطلب - ${data.serviceName || 'خدمة'}`;
          } else {
            activityType = 'provider_cancel';
            activityTitle = `إلغاء من المزود - ${data.serviceName || 'خدمة'}`;
          }
        } else if (['canceled_by_client', 'canceled_by_client_with_reason'].includes(event.status)) {
          // التحقق من أن العميل ألغى بعد القبول
          const wasAccepted = data.status === 'assigned' ||
            data.status === 'en_route' ||
            data.status === 'arrived' ||
            data.status === 'in_progress' ||
            data.assignedAt ||
            history.some(h => h.status === 'assigned');

          if (wasAccepted) {
            activityType = 'client_cancel_after_accept';
            activityTitle = `إلغاء العميل بعد قبول الطلب - ${data.serviceName || 'خدمة'}`;
          } else {
            activityType = 'client_cancel';
            activityTitle = `إلغاء من العميل - ${data.serviceName || 'خدمة'}`;
          }
        }

        if (activityType !== 'order') {
          // تحديد ما إذا كان الرفض/الإلغاء بعد القبول
          const wasAccepted = data.status === 'assigned' ||
            data.status === 'en_route' ||
            data.status === 'arrived' ||
            data.status === 'in_progress' ||
            data.assignedAt ||
            history.some(h => h.status === 'assigned');

          activities.push({
            id: `${doc.id}-${index}`,
            requestId: doc.id,
            type: activityType,
            title: activityTitle,
            message: event.message || event.reason || event.cancelReason || '',
            location: data.location || 'موقع غير محدد',
            providerName: event.providerName || data.providerName || 'غير محدد',
            customerId: data.customerId,
            status: event.status || data.status,
            timestamp: event.timestamp || data.updatedAt,
            createdAt: event.timestamp || data.updatedAt,
            wasAcceptedAfter: wasAccepted && (
              activityType === 'provider_cancel' ||
              activityType === 'provider_cancel_after_accept' ||
              activityType === 'client_cancel' ||
              activityType === 'client_cancel_after_accept'
            ),
            reason: event.reason || event.cancelReason || '',
          });
        }
      });

      // إضافة الطلب نفسه كأنشطة عادية
      if (data.status && !rejectionEvents.length) {
        activities.push({
          id: doc.id,
          requestId: doc.id,
          type: 'order',
          title: `طلب جديد - ${data.serviceName || 'خدمة'}`,
          location: data.location || 'موقع غير محدد',
          status: data.status,
          createdAt: data.createdAt || data.updatedAt,
        });
      }
    });

    // ترتيب حسب التاريخ
    activities.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() ?? (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const timeB = b.timestamp?.toMillis?.() ?? (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return timeB - timeA;
    });

    return { success: true, activities: activities.slice(0, 10) };
  } catch (error) {
    console.error('Get recent activity error:', error);
    throw error;
  }
};

// ✅ Real-time Listeners for Admin Dashboard

/**
 * الاستماع للطلبات في الوقت الفعلي
 * @param {Function} callback - دالة تُستدعى عند كل تحديث
 * @returns {Function} unsubscribe function
 */
export const listenToAllRequests = (callback) => {
  try {
    const requestsRef = collection(db, 'requests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(requests);
      },
      (error) => {
        console.error('Error listening to requests:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Setup listener error:', error);
    return () => { };
  }
};

/**
 * الاستماع للمزودين الجدد (pending)
 * @param {Function} callback - دالة تُستدعى عند كل تحديث
 * @returns {Function} unsubscribe function
 */
export const listenToPendingProviders = (callback) => {
  try {
    const providersRef = collection(db, 'providers');
    const q = query(providersRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const providers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(providers);
      },
      (error) => {
        console.error('Error listening to pending providers:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Setup listener error:', error);
    return () => { };
  }
};

/**
 * الاستماع لجميع المزودين في الوقت الفعلي
 * @param {Function} callback - دالة تُستدعى عند كل تحديث
 * @returns {Function} unsubscribe function
 */
export const listenToAllProviders = (callback) => {
  try {
    const providersRef = collection(db, 'providers');
    const q = query(providersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const providers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(providers);
      },
      (error) => {
        console.error('Error listening to providers:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Setup listener error:', error);
    return () => { };
  }
};



/**
 * إحصائيات طلبات العملاء من مجموعة requests (customerId أو userId)
 * @param {Array} requests
 * @returns {Map<string, { total: number, completed: number, lastOrderMs: number }>}
 */
export const buildCustomerOrderStats = (requests = []) => {
  const stats = new Map();

  for (const req of requests) {
    const customerId = req.customerId || req.userId;
    if (!customerId) continue;

    const current = stats.get(customerId) || { total: 0, completed: 0, lastOrderMs: 0 };
    current.total += 1;
    if (req.status === 'completed') current.completed += 1;

    const createdMs = req.createdAt?.toMillis?.()
      ?? (req.createdAt ? new Date(req.createdAt).getTime() : 0);
    if (createdMs > current.lastOrderMs) current.lastOrderMs = createdMs;

    stats.set(customerId, current);
  }

  return stats;
};

// ✅ Manual Order Management

/**
 * البحث عن مستخدمين بالاسم أو الهاتف في مجموعتي users و customers
 * @param {string} term - كلمة البحث
 * @returns {Promise<Object>}
 */
export const getUsersBySearch = async (term) => {
  try {
    const cleanTerm = term.trim();
    const searchLower = cleanTerm.toLowerCase();

    // تطبيع رقم الجوال: يزيل المقدمة السعودية +966 / 966 / الصفر البادئ
    const normalizePhone = (val) => {
      let d = String(val || '').replace(/\D/g, '');
      if (d.startsWith('966')) d = d.slice(3);
      else if (d.startsWith('0')) d = d.slice(1);
      return d;
    };

    const searchDigits = normalizePhone(cleanTerm);   // رقم بدون مقدمة
    const rawDigits = cleanTerm.replace(/\D/g, '');   // الأرقام كما هي للمطابقة الجزئية

    // نجلب 500 سجل من كل مجموعة لضمان تغطية قواعد البيانات الكبيرة
    const [usersSnap, customersSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(500))),
      getDocs(query(collection(db, 'customers'), limit(500)))
    ]);

    const resultsMap = new Map();

    const processDoc = (doc) => {
      const data = doc.data();

      // مطابقة الجوال: نطبّع الرقم المخزّن ونقارن بكل الصيغ
      const storedNorm = normalizePhone(data.phone || data.phoneNumber || '');
      const storedRaw  = String(data.phone || data.phoneNumber || '').replace(/\D/g, '');
      const phoneMatch = searchDigits.length >= 3 && (
        storedNorm.includes(searchDigits) ||
        storedNorm.startsWith(searchDigits) ||
        (rawDigits.length >= 3 && storedRaw.includes(rawDigits))
      );

      // مطابقة النص: الاسم + الإيميل + displayName
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').toLowerCase();
      const textMatch =
        data.name?.toLowerCase().includes(searchLower) ||
        data.firstName?.toLowerCase().includes(searchLower) ||
        data.lastName?.toLowerCase().includes(searchLower) ||
        fullName.includes(searchLower) ||
        data.email?.toLowerCase().includes(searchLower) ||
        data.displayName?.toLowerCase().includes(searchLower);

      if (phoneMatch || textMatch) {
        resultsMap.set(doc.id, {
          id: doc.id,
          // توحيد حقل الاسم
          name: data.name ||
                [data.firstName, data.lastName].filter(Boolean).join(' ') ||
                data.displayName ||
                'مستخدم',
          phone: data.phone || data.phoneNumber || '',
          email: data.email || '',
          ...data,
        });
      }
    };

    usersSnap.forEach(processDoc);
    customersSnap.forEach(processDoc);

    return { success: true, users: Array.from(resultsMap.values()) };
  } catch (error) {
    console.error('Search users error:', error);
    throw error;
  }
};

/**
 * البحث عن مزودين بالاسم أو الهاتف
 * @param {string} term - كلمة البحث
 * @returns {Promise<Object>}
 */
export const getProvidersBySearch = async (term) => {
  try {
    const providersRef = collection(db, 'providers');
    const searchLower = term.toLowerCase().trim();
    const normalize = (val) => String(val || '').replace(/\D/g, '');
    const searchDigits = normalize(term);

    const q = query(providersRef, limit(100));
    const querySnapshot = await getDocs(q);

    const providers = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const phoneMatch = searchDigits && normalize(data.phone).includes(searchDigits);
      const textMatch = data.firstName?.toLowerCase().includes(searchLower) ||
        data.lastName?.toLowerCase().includes(searchLower) ||
        data.name?.toLowerCase().includes(searchLower) ||
        data.email?.toLowerCase().includes(searchLower);

      if (phoneMatch || textMatch) {
        providers.push({ ...data, id: doc.id });
      }
    });

    return { success: true, providers };
  } catch (error) {
    console.error('Search providers error:', error);
    throw error;
  }
};

/**
 * إنشاء طلب يدوي جديد (مع رقم طلب متسلسل موحد)
 * @param {Object} orderData - بيانات الطلب
 * @returns {Promise<Object>}
 */
/**
 * تحرير المزود من حالة الانشغال العالقة (isBusy / activeRequestId)
 */
export const releaseProviderBusy = async (providerId) => {
  if (!providerId?.trim()) throw new Error('معرّف المزود مطلوب');
  const providerRef = doc(db, 'providers', providerId.trim());
  const snap = await getDoc(providerRef);
  if (!snap.exists()) throw new Error('المزود غير موجود');
  const before = snap.data();
  await updateDoc(providerRef, {
    isBusy: false,
    activeRequestId: deleteField(),
    updatedAt: serverTimestamp(),
  });
  return {
    success: true,
    previous: {
      isBusy: before.isBusy,
      activeRequestId: before.activeRequestId || null,
    },
  };
};

/**
 * فحص قبل إرسال طلب تجريبي — نفس شروط performStagedSearch (يمنع timed_out الفوري)
 */
export const validateProviderForTestDispatch = async (providerId, orderPreview) => {
  if (!providerId?.trim()) {
    return { eligible: false, error: 'اختر مزوداً', checks: [] };
  }
  const [providerSnap, settingsSnap] = await Promise.all([
    getDoc(doc(db, 'providers', providerId.trim())),
    getDoc(doc(db, 'settings', 'distribution')),
  ]);
  if (!providerSnap.exists()) {
    return { eligible: false, error: 'المزود غير موجود', checks: [] };
  }

  const mockRequest = {
    status: 'searching',
    serviceId: orderPreview.serviceId,
    serviceName: orderPreview.serviceName,
    serviceCategory: orderPreview.serviceCategory,
    parentServiceId: orderPreview.parentServiceId ?? null,
    coordinates: orderPreview.coordinates,
    rejectedProviders: [],
  };

  const result = evaluateProviderEligibility(
    providerId.trim(),
    { id: providerSnap.id, ...providerSnap.data() },
    mockRequest,
    settingsSnap.exists() ? settingsSnap.data() : {}
  );

  return {
    eligible: result.eligible,
    checks: result.checks,
    metrics: result.metrics,
    error: result.eligible
      ? null
      : result.checks.filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.detail}`).join(' — '),
  };
};

/**
 * إنشاء طلب اختبار من لوحة التحكم (searching + تشغيل onRequestCreated)
 */
export const createTestDispatchOrder = async (orderData) => {
  const payload = {
    ...orderData,
    status: 'searching',
    providerIdsToNotify: [],
    notifiedProviders: [],
    source: 'admin_test_lab',
  };
  return createManualOrder(payload);
};

/**
 * إلغاء طلب بحث — نفس مسار تطبيق العميل (canceled_by_client) لتشغيل onRequestUpdated وإيقاف الرنين
 */
export const cancelRequestAsCustomer = async (requestId, cancelReason = null) => {
  if (!requestId) throw new Error('معرف الطلب مطلوب');
  const orderRef = doc(db, 'requests', requestId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) throw new Error('الطلب غير موجود');

  const requestData = snap.data();
  if (requestData.status !== 'searching') {
    throw new Error(`لا يمكن الإلغاء — الحالة: ${requestData.status}`);
  }

  const currentHistory = Array.isArray(requestData.history) ? requestData.history : [];
  const status =
    cancelReason && cancelReason !== 'other'
      ? 'canceled_by_client_with_reason'
      : 'canceled_by_client';

  await updateDoc(orderRef, {
    status,
    cancelReason: cancelReason || 'other',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: [
      ...currentHistory,
      {
        status,
        message: cancelReason ? `تم إلغاء الطلب. السبب: ${cancelReason}` : 'تم إلغاء الطلب',
        timestamp: new Date().toISOString(),
        updatedBy: 'customer',
        cancelReason: cancelReason || null,
      },
    ],
  });

  const freshSnap = await getDoc(orderRef);
  const freshHistoryLen = Array.isArray(freshSnap.data()?.history)
    ? freshSnap.data().history.length
    : 0;
  if (freshHistoryLen) {
    await updateDoc(orderRef, {
      [`history.${freshHistoryLen - 1}.timestamp`]: serverTimestamp(),
    });
  }

  return { success: true, status };
};

export const createManualOrder = async (orderData) => {
  try {
    const requestsRef = collection(db, 'requests');
    const counterRef = doc(db, 'settings', 'orderNumberCounter');

    const orderNumber = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? (snap.data().lastOrderNumber || 0) : 0;
      // ensure starts from 23234
      const next = (current < 23233) ? 23234 : current + 1;
      transaction.set(counterRef, { lastOrderNumber: next }, { merge: true });
      return next;
    });

    const newRequest = {
      ...orderData,
      orderNumber,
      status: 'searching',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'admin_panel',
      history: [
        {
          status: 'searching',
          timestamp: new Date().toISOString(),
          message: 'تم إنشاء الطلب يدوياً عن طريق الإدارة',
          updatedBy: 'admin'
        }
      ]
    };

    const docRef = await addDoc(requestsRef, newRequest);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Create manual order error:', error);
    throw error;
  }
};

/**
 * تحديث تفاصيل طلب موجود
 * @param {string} orderId - معرف الطلب
 * @param {Object} updateData - البيانات المراد تحديثها
 * @returns {Promise<Object>}
 */
const TERMINAL_ORDER_STATUSES = [
  'completed',
  'timed_out',
  'canceled_by_client',
  'canceled_by_client_with_reason',
  'canceled_by_provider',
  'canceled_by_provider_with_reason',
  'escalated_to_city_manager',
];

export const updateOrderDetails = async (orderId, updateData) => {
  try {
    const orderRef = doc(db, 'requests', orderId);

    const updatePayload = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    // إضافة سجل للتغيير في history إذا أردنا
    // سنقوم بجلب المستند أولاً لإضافة التاريخ
    const snap = await getDoc(orderRef);
    if (snap.exists()) {
      const currentData = snap.data();
      const history = Array.isArray(currentData.history) ? currentData.history : [];
      history.push({
        action: 'admin_update',
        timestamp: new Date().toISOString(),
        message: 'تم تحديث تفاصيل الطلب عن طريق الإدارة',
        updatedBy: 'admin',
        changes: updateData
      });
      updatePayload.history = history;

      // عند إلغاء/إكمال الطلب من الأدمن — تحرير انشغال المزود
      if (updateData.status && TERMINAL_ORDER_STATUSES.includes(updateData.status)) {
        const providerId = currentData.providerId;
        if (providerId) {
          await releaseProviderBusy(providerId).catch((e) =>
            console.warn('releaseProviderBusy on admin update:', e?.message)
          );
        }
        const stuckQ = query(
          collection(db, 'providers'),
          where('activeRequestId', '==', orderId)
        );
        const stuckSnap = await getDocs(stuckQ);
        for (const pDoc of stuckSnap.docs) {
          if (pDoc.id !== providerId) {
            await releaseProviderBusy(pDoc.id).catch(() => {});
          }
        }
      }
    }

    await updateDoc(orderRef, updatePayload);
    return { success: true };
  } catch (error) {
    console.error('Update order details error:', error);
    throw error;
  }
};

/**
 * تحديث متوسط تقييم المزود من مجموعة ratings
 */
const recalculateProviderRatingAverage = async (providerId) => {
  if (!providerId) return;
  const ratingsRef = collection(db, 'ratings');
  const q = query(ratingsRef, where('providerId', '==', providerId));
  const querySnapshot = await getDocs(q);

  let totalRating = 0;
  let count = 0;
  querySnapshot.forEach((snap) => {
    const value = Number(snap.data()?.rating) || 0;
    if (value > 0) {
      totalRating += value;
      count += 1;
    }
  });

  const average = count > 0 ? totalRating / count : 0;
  await updateDoc(doc(db, 'providers', providerId), {
    rating: {
      average: parseFloat(average.toFixed(2)),
      count,
      total: totalRating,
    },
    ratingUpdatedAt: serverTimestamp(),
  });
};

/**
 * تعديل أو إضافة تقييم الطلب من لوحة الإدارة
 * يحدّث الطلب + مستند ratings + متوسط تقييم المزود
 */
export const updateRequestRating = async (requestId, { rating, comment = '' } = {}) => {
  const ratingNum = Math.round(Number(rating));
  if (!requestId) throw new Error('معرّف الطلب مطلوب');
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new Error('التقييم يجب أن يكون بين 1 و 5');
  }

  const requestRef = doc(db, 'requests', requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) {
    throw new Error('الطلب غير موجود');
  }

  const requestData = requestSnap.data();
  const providerId = requestData.providerId || null;
  const customerId = requestData.customerId || requestData.userId || null;
  const commentText = String(comment || '').trim();
  const adminMeta = {
    ratingUpdatedByAdmin: true,
    ratingUpdatedAtByAdmin: serverTimestamp(),
    ratingUpdatedBy: localStorage.getItem('admin_email') || localStorage.getItem('admin_name') || 'admin',
  };

  const history = Array.isArray(requestData.history) ? [...requestData.history] : [];
  history.push({
    action: 'admin_rating_update',
    timestamp: new Date().toISOString(),
    message: `تم تعديل التقييم من الإدارة إلى ${ratingNum}/5`,
    updatedBy: 'admin',
    previousRating: requestData.rating ?? null,
    previousComment: requestData.ratingComment ?? null,
    rating: ratingNum,
    comment: commentText,
  });

  await updateDoc(requestRef, {
    rated: true,
    rating: ratingNum,
    ratingComment: commentText,
    ratedAt: requestData.ratedAt || serverTimestamp(),
    history,
    updatedAt: serverTimestamp(),
    ...adminMeta,
  });

  // مزامنة مجموعة ratings (إن وُجد تقييم سابق يُحدَّث، وإلا يُنشأ)
  const ratingsQ = query(collection(db, 'ratings'), where('requestId', '==', requestId), limit(1));
  const ratingsSnap = await getDocs(ratingsQ);
  if (!ratingsSnap.empty) {
    const ratingDoc = ratingsSnap.docs[0];
    await updateDoc(ratingDoc.ref, {
      rating: ratingNum,
      comment: commentText,
      updatedAt: serverTimestamp(),
      updatedByAdmin: true,
    });
    const existingProviderId = ratingDoc.data()?.providerId || providerId;
    if (existingProviderId) {
      await recalculateProviderRatingAverage(existingProviderId);
    }
  } else if (providerId) {
    await addDoc(collection(db, 'ratings'), {
      requestId,
      customerId,
      providerId,
      rating: ratingNum,
      comment: commentText,
      createdAt: serverTimestamp(),
      createdByAdmin: true,
      updatedAt: serverTimestamp(),
    });
    await recalculateProviderRatingAverage(providerId);
  }

  return { success: true, rating: ratingNum, comment: commentText };
};

/**
 * الحصول على سجل محفظة المزود
 * @param {string} providerId - معرف المزود
 * @returns {Promise<Array>}
 */
export const getProviderWalletHistory = async (providerId) => {
  try {
    const transactionsRef = collection(db, 'providers', providerId, 'transactions');
    const q = query(transactionsRef, orderBy('timestamp', 'desc'), limit(100));
    const querySnapshot = await getDocs(q);

    const history = [];
    querySnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, history };
  } catch (error) {
    console.error('Get provider wallet history error:', error);
    throw error;
  }
};

/**
 * تعديل رصيد محفظة المزود
 * @param {string} providerId - معرف المزود
 * @param {number} amount - المبلغ
 * @param {string} type - نوع الحركة (addition, deduction, compensation)
 * @param {string} reason - السبب
 * @returns {Promise<Object>}
 */
export const adjustProviderWallet = async (providerId, amount, type, reason) => {
  try {
    const providerRef = doc(db, 'providers', providerId);

    const result = await runTransaction(db, async (transaction) => {
      const providerDoc = await transaction.get(providerRef);
      if (!providerDoc.exists()) {
        throw new Error('المزود غير موجود');
      }

            const providerData = providerDoc.data();
            const currentBalance = providerData.wallet?.balance ?? providerData.walletBalance ?? 0;
            let newBalance = Number(currentBalance) || 0;

            if (type === 'addition' || type === 'compensation') {
              newBalance += Number(amount);
            } else if (type === 'deduction') {
              newBalance -= Number(amount);
            }

            transaction.update(providerRef, {
              'wallet.balance': newBalance,
              'wallet.lastUpdated': serverTimestamp(),
              walletBalance: deleteField(),
            });

      return { newBalance };
    });

    // إضافة سجل المعاملة
    const transactionsRef = collection(db, 'providers', providerId, 'transactions');
    await addDoc(transactionsRef, {
      type,
      amount: Number(amount),
      balance: result.newBalance,
      reason,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      source: 'admin_panel'
    });

    return { success: true, newBalance: result.newBalance };
  } catch (error) {
    console.error('Adjust provider wallet error:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات طلبات المزود
 * @param {string} providerId - معرف المزود
 * @returns {Promise<Object>}
 */
export const getProviderOrderStats = async (providerId) => {
  try {
    const allOrders = new Map();

    try {
      const q1 = query(collection(db, 'requests'), where('providerId', '==', providerId));
      const snap1 = await getDocs(q1);
      snap1.forEach((d) => allOrders.set(d.id, { id: d.id, ...d.data() }));
    } catch (e) { console.warn('requests query:', e.message); }

    try {
      const q2 = query(collection(db, 'orders'), where('providerId', '==', providerId));
      const snap2 = await getDocs(q2);
      snap2.forEach((d) => { if (!allOrders.has(d.id)) allOrders.set(d.id, { id: d.id, ...d.data() }); });
    } catch (e) { console.warn('orders query:', e.message); }

    const CANCELLED_STATUSES = ['canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_client', 'canceled_by_client_with_reason', 'timed_out'];
    const ACTIVE_STATUSES = ['searching', 'accepted', 'assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs', 'arriving', 'pending_client_confirmation', 'pending_review'];

    let completed = 0;
    let cancelled = 0;
    let active = 0;
    const orders = [];

    allOrders.forEach((data) => {
      if (data.status === 'completed') completed++;
      else if (CANCELLED_STATUSES.includes(data.status)) cancelled++;
      else if (ACTIVE_STATUSES.includes(data.status)) active++;
      orders.push(data);
    });

    orders.sort((a, b) => {
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      return tB - tA;
    });

    return { success: true, completed, cancelled, active, total: orders.length, orders };
  } catch (error) {
    console.error('Get provider order stats error:', error);
    throw error;
  }
};

// مراحل يكتبها المزود بنفسه من التطبيق — وجودها يثبت تنفيذاً فعلياً وليس إغلاقاً إدارياً
const PROVIDER_WORK_STATUSES = new Set([
  'en_route',
  'arrived',
  'in_progress',
  'pending_client_confirmation',
]);

// طوابع زمنية لا تُكتب إلا من تطبيق المزود عند تنفيذ المراحل
const PROVIDER_WORK_TIMESTAMPS = [
  'enRouteAt',
  'arrivedAt',
  'startedAt',
  'providerCompletedAt',
  'pending_client_confirmation_at',
];

/**
 * هل مرّ الطلب فعلياً بمراحل تنفيذ المزود؟
 * يستبعد الطلبات التي وُضعت حالتها "مكتمل" مباشرة من اللوحة أو أُنشئت للتجربة.
 */
function hasProviderExecutionEvidence(data) {
  if (PROVIDER_WORK_TIMESTAMPS.some((field) => data?.[field])) return true;

  const history = Array.isArray(data?.history) ? data.history : [];
  return history.some((entry) => {
    if (PROVIDER_WORK_STATUSES.has(entry?.status)) return true;
    // مسار فتح السيارة ينتقل إلى completed مباشرة لكن بتوقيع المزود
    return entry?.status === 'completed' && entry?.updatedBy === 'provider';
  });
}

/**
 * عدد الطلبات المنفّذة فعلياً لكل مزود
 * لا يُحتسب الطلب إلا إذا كان مكتملاً ومرّ بمراحل تنفيذ المزود من التطبيق.
 * @returns {Promise<{ success: boolean, providerIds: string[], counts: Record<string, number> }>}
 */
export const getProviderIdsWithCompletedOrders = async () => {
  try {
    const seenRequestIds = new Set();
    const counts = {};

    const collectFromSnap = (snap) => {
      snap.forEach((d) => {
        if (seenRequestIds.has(d.id)) return;
        seenRequestIds.add(d.id);

        const data = d.data() || {};
        const providerId = data.providerId ? String(data.providerId) : '';
        if (!providerId) return;
        if (!hasProviderExecutionEvidence(data)) return;

        counts[providerId] = (counts[providerId] || 0) + 1;
      });
    };

    try {
      const requestsSnap = await getDocs(
        query(collection(db, 'requests'), where('status', '==', 'completed'))
      );
      collectFromSnap(requestsSnap);
    } catch (e) {
      console.warn('completed requests query:', e.message);
    }

    try {
      const ordersSnap = await getDocs(
        query(collection(db, 'orders'), where('status', '==', 'completed'))
      );
      collectFromSnap(ordersSnap);
    } catch (e) {
      console.warn('completed orders query:', e.message);
    }

    return { success: true, providerIds: Object.keys(counts), counts };
  } catch (error) {
    console.error('Get providers with completed orders error:', error);
    throw error;
  }
};

/**
 * تبديل حالة VIP للمزود
 * @param {string} providerId - معرف المزود
 * @param {boolean} isVIP - الحالة الجديدة
 * @returns {Promise<Object>}
 */
export const toggleProviderVIP = async (providerId, isVIP) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    await updateDoc(providerRef, {
      isVIP: isVIP,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Toggle provider VIP error:', error);
    throw error;
  }
};

// ——— البانر (شاشة الرئيسية بتطبيق العميل) ———
const BANNERS_COLLECTION = 'banners';
const BANNERS_CONFIG_DOC = 'settings/homeBannersConfig';

export const getBanners = async () => {
  try {
    const q = query(
      collection(db, BANNERS_COLLECTION),
      orderBy('order', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getBanners error:', error);
    throw error;
  }
};

export const addBanner = async (data) => {
  try {
    const bannersRef = collection(db, BANNERS_COLLECTION);
    const snapshot = await getDocs(query(bannersRef, orderBy('order', 'desc'), limit(1)));
    const nextOrder = snapshot.empty ? 0 : (snapshot.docs[0].data().order ?? -1) + 1;
    const docRef = await addDoc(bannersRef, {
      imageUrl: data.imageUrl || '',
      linkType: data.linkType || 'none',
      linkValue: data.linkValue || '',
      title: data.title || '',
      subtitle: data.subtitle || '',
      order: nextOrder,
      active: data.active !== false,
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('addBanner error:', error);
    throw error;
  }
};

export const updateBanner = async (id, data) => {
  try {
    const bannerRef = doc(db, BANNERS_COLLECTION, id);
    const updateData = {};
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.linkType !== undefined) updateData.linkType = data.linkType;
    if (data.linkValue !== undefined) updateData.linkValue = data.linkValue;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.active !== undefined) updateData.active = data.active;
    if (Object.keys(updateData).length) {
      await updateDoc(bannerRef, updateData);
    }
    return { success: true };
  } catch (error) {
    console.error('updateBanner error:', error);
    throw error;
  }
};

export const deleteBanner = async (id) => {
  try {
    await deleteDoc(doc(db, BANNERS_COLLECTION, id));
    return { success: true };
  } catch (error) {
    console.error('deleteBanner error:', error);
    throw error;
  }
};

export const getBannersConfig = async () => {
  try {
    const configRef = doc(db, 'settings', 'homeBannersConfig');
    const snap = await getDoc(configRef);
    if (!snap.exists()) return { autoPlaySeconds: 5 };
    return { ...snap.data(), autoPlaySeconds: snap.data().autoPlaySeconds ?? 5 };
  } catch (error) {
    console.error('getBannersConfig error:', error);
    return { autoPlaySeconds: 5 };
  }
};

export const updateBannersConfig = async (data) => {
  try {
    const [coll, docId] = BANNERS_CONFIG_DOC.split('/');
    const configRef = doc(db, coll, docId);
    await setDoc(configRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('updateBannersConfig error:', error);
    throw error;
  }
};

// طلبات تعديل بيانات المزودين (المعتمدين)
const PROVIDER_PROFILE_CHANGE_REQUESTS = 'providerProfileChangeRequests';

export const getProviderProfileChangeRequests = async (statusFilter = 'all') => {
  try {
    const ref = collection(db, PROVIDER_PROFILE_CHANGE_REQUESTS);
    const q = query(ref, orderBy('requestedAt', 'desc'));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
    if (statusFilter !== 'all') {
      return list.filter((r) => r.status === statusFilter);
    }
    return list;
  } catch (error) {
    console.error('getProviderProfileChangeRequests error:', error);
    throw error;
  }
};

export const approveProviderProfileChange = async (requestId) => {
  try {
    const requestRef = doc(db, PROVIDER_PROFILE_CHANGE_REQUESTS, requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error('طلب غير موجود');
    const data = requestSnap.data();
    if (data.status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً');

    const providerRef = doc(db, 'providers', data.providerId);
    const providerSnap = await getDoc(providerRef);
    const requested = data.requestedChanges || {};
    const updates = {
      firstName: requested.firstName,
      lastName: requested.lastName,
      phone: requested.phone,
      email: requested.email ?? null,
      nationality: requested.nationality,
      city: requested.city ?? '',
      fullName: [requested.firstName, requested.lastName].filter(Boolean).join(' ').trim() || data.providerName,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(providerRef, updates);
    await updateDoc(requestRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
    });

    // إرسال إشعار خارجي للمزود بعد الموافقة
    const pushToken = providerSnap?.data()?.pushToken;
    if (pushToken) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: pushToken,
            sound: 'default',
            title: 'تم اعتماد طلب تعديل بياناتك',
            body: 'تمت الموافقة من الإدارة وسيتم تطبيق التعديل على حسابك الآن.',
            data: {
              type: 'profile_change_approved',
              requestId,
              nationality: requested.nationality,
              city: requested.city ?? '',
            },
            priority: 'high',
            ttl: 3600,
            channelId: 'incoming_requests_v2',
            android: {
              priority: 'max',
              sound: 'default',
              channelId: 'incoming_requests_v2',
            },
            _displayInForeground: true,
          }),
        });
      } catch (e) {
        console.warn('Failed to send expo push after approval:', e?.message || e);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('approveProviderProfileChange error:', error);
    throw error;
  }
};

export const rejectProviderProfileChange = async (requestId) => {
  try {
    const requestRef = doc(db, PROVIDER_PROFILE_CHANGE_REQUESTS, requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error('طلب غير موجود');
    const data = requestSnap.data();
    if (data.status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً');
    await updateDoc(requestRef, {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('rejectProviderProfileChange error:', error);
    throw error;
  }
};

// ─── حظر الأرقام (عميل / مزود) — يمنع OTP لأي تسجيل أو دخول ─────────────────

export const normalizeBanPhone966 = (phone) => {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('966')) return clean;
  if (clean.startsWith('05') && clean.length === 10) return `966${clean.slice(1)}`;
  if (clean.startsWith('5') && clean.length === 9) return `966${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `966${clean.slice(1)}`;
  return clean;
};

const formatBanPhoneDisplay = (phone966) => {
  const clean = String(phone966 || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('966') && clean.length >= 12) return `0${clean.slice(3)}`;
  return clean || phone966;
};

/**
 * جلب كل الأرقام المحظورة
 */
export const getBlockedPhones = async () => {
  try {
    const snap = await getDocs(collection(db, 'blocked_phones'));
    const list = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tb = b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tb - ta;
    });
    return { success: true, blocks: list };
  } catch (error) {
    console.error('getBlockedPhones error:', error);
    return { success: false, error: error.message, blocks: [] };
  }
};

/**
 * التحقق إن الرقم محظور
 */
export const isPhoneBlocked = async (phone) => {
  const key = normalizeBanPhone966(phone);
  if (!key) return false;
  const snap = await getDoc(doc(db, 'blocked_phones', key));
  return snap.exists();
};

/**
 * حظر رقم — يمنع التسجيل/الدخول من تطبيق العميل والمزود
 * @param {{ phone, reason?, accountKind?, relatedUserId?, relatedUserName?, bannedBy?, bannedByName? }} payload
 */
export const banPhoneNumber = async (payload = {}) => {
  const phone = normalizeBanPhone966(payload.phone);
  if (!phone || phone.length < 12) {
    throw new Error('رقم الجوال غير صالح');
  }

  const existing = await getDoc(doc(db, 'blocked_phones', phone));
  if (existing.exists()) {
    throw new Error('هذا الرقم محظور مسبقاً');
  }

  const nowIso = new Date().toISOString();
  const banDoc = {
    phone,
    phoneDisplay: formatBanPhoneDisplay(phone),
    reason: String(payload.reason || '').trim() || null,
    accountKind: payload.accountKind === 'provider' || payload.accountKind === 'customer'
      ? payload.accountKind
      : 'all',
    relatedUserId: payload.relatedUserId || null,
    relatedUserName: payload.relatedUserName || null,
    bannedBy: payload.bannedBy || null,
    bannedByName: payload.bannedByName || null,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'blocked_phones', phone), banDoc);

  // تعليم الحساب المرتبط (إن وُجد) دون حذفه
  const markBanned = async (collectionName, userId) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, collectionName, userId), {
        isBanned: true,
        bannedAt: nowIso,
        bannedReason: banDoc.reason,
        ...(collectionName === 'providers'
          ? { isOnline: false, isActive: false }
          : {}),
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn(`banPhoneNumber: mark ${collectionName}`, e?.message);
    }
  };

  if (payload.relatedUserId && payload.accountKind === 'provider') {
    await markBanned('providers', payload.relatedUserId);
  } else if (payload.relatedUserId && payload.accountKind === 'customer') {
    await markBanned('customers', payload.relatedUserId);
  } else {
    // ابحث عن أي حساب بنفس الرقم وعلّمه
    const variants = [phone];
    if (phone.startsWith('966')) {
      variants.push(`0${phone.slice(3)}`, phone.slice(3));
    }
    for (const col of ['providers', 'customers']) {
      for (const v of variants) {
        try {
          const q = query(collection(db, col), where('phone', '==', v), limit(3));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            await markBanned(col, d.id);
          }
        } catch (_) { /* ignore */ }
      }
    }
  }

  return { success: true, phone, id: phone };
};

/**
 * إلغاء حظر رقم
 */
export const unbanPhoneNumber = async (phoneOrId) => {
  const phone = normalizeBanPhone966(phoneOrId);
  if (!phone) throw new Error('رقم غير صالح');

  const banRef = doc(db, 'blocked_phones', phone);
  const banSnap = await getDoc(banRef);
  if (!banSnap.exists()) {
    throw new Error('الرقم غير موجود في قائمة الحظر');
  }
  const banData = banSnap.data() || {};
  await deleteDoc(banRef);

  const nowIso = new Date().toISOString();
  const clearBan = async (collectionName, userId) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, collectionName, userId), {
        isBanned: false,
        bannedAt: deleteField(),
        bannedReason: deleteField(),
        ...(collectionName === 'providers' ? { isActive: true } : {}),
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn(`unbanPhoneNumber: clear ${collectionName}`, e?.message);
    }
  };

  if (banData.relatedUserId && banData.accountKind === 'provider') {
    await clearBan('providers', banData.relatedUserId);
  } else if (banData.relatedUserId && banData.accountKind === 'customer') {
    await clearBan('customers', banData.relatedUserId);
  } else {
    const variants = [phone];
    if (phone.startsWith('966')) {
      variants.push(`0${phone.slice(3)}`, phone.slice(3));
    }
    for (const col of ['providers', 'customers']) {
      for (const v of variants) {
        try {
          const q = query(collection(db, col), where('phone', '==', v), limit(3));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            await clearBan(col, d.id);
          }
        } catch (_) { /* ignore */ }
      }
    }
  }

  return { success: true, phone };
};
