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
  addDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';

// Providers Management
export const getAllProviders = async () => {
  try {
    const providersRef = collection(db, 'providers');
    const q = query(providersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const providers = [];
    querySnapshot.forEach((doc) => {
      providers.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, providers };
  } catch (error) {
    console.error('Get providers error:', error);
    throw error;
  }
};

export const createManualProvider = async (providerData) => {
  try {
    const providersRef = collection(db, 'providers');

    // تنسيق رقم الهاتف (يجب أن يكون 9665XXXXXXXX)
    let phone = providerData.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('05')) {
      phone = '966' + phone.substring(1);
    } else if (phone.startsWith('5')) {
      phone = '966' + phone;
    } else if (!phone.startsWith('966')) {
      phone = '966' + phone;
    }

    // التحقق من تكرار رقم الجوال
    const q = query(collection(db, 'providers'), where('phone', '==', phone));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
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
    };

    // إضافة الوثائق (نفس المفاتيح المستخدمة في تسجيل المزود الجديد)
    const docs = providerData.documents || {};
    newProvider.documents = {
      id_photo: docs.id_photo || providerData.idImage || '',
      equipment_photo: docs.equipment_photo || '',
      driver_license: docs.driver_license || '',
      car_registration: docs.car_registration || '',
      car_front: docs.car_front || '',
      car_side: docs.car_side || ''
    };

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

    return { success: true, provider: { id: providerSnap.id, ...providerSnap.data() } };
  } catch (error) {
    console.error('Get provider by ID error:', error);
    throw error;
  }
};

export const updateProviderStatus = async (providerId, status) => {
  try {
    const providerRef = doc(db, 'providers', providerId);
    // تحديث كلاً من approvalStatus و status للتوافق
    // approvalStatus: حالة الموافقة (pending, approved, rejected)
    // status: نحدثها أيضاً لضمان التوافق مع الكود القديم
    await updateDoc(providerRef, {
      approvalStatus: status, // حالة الموافقة
      status: status, // تحديث status أيضاً للتوافق
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Update provider status error:', error);
    throw error;
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

// Statistics
export const getDashboardStats = async () => {
  try {
    const [providersSnapshot, ordersSnapshot] = await Promise.all([
      getDocs(collection(db, 'providers')),
      getDocs(collection(db, 'orders')),
    ]);

    const providers = [];
    const orders = [];

    providersSnapshot.forEach((doc) => {
      providers.push({ id: doc.id, ...doc.data() });
    });

    ordersSnapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    const stats = {
      totalProviders: providers.length,
      // استخدام approvalStatus بدلاً من status (دعم التسجيل بالهاتف)
      activeProviders: providers.filter((p) => {
        const approvalStatus = p.approvalStatus || p.status;
        return approvalStatus === 'approved' && p.isOnline;
      }).length,
      pendingProviders: providers.filter((p) => {
        const approvalStatus = p.approvalStatus || p.status;
        return approvalStatus === 'pending';
      }).length,
      totalOrders: orders.length,
      completedOrders: orders.filter((o) => o.status === 'completed').length,
      activeOrders: orders.filter((o) => ['searching', 'accepted', 'arriving'].includes(o.status)).length,
      totalRevenue: orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + (o.price || 0), 0),
      totalCommission: orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + (o.commission || 0), 0),
      todayOrders: orders.filter((o) => {
        const today = new Date();
        const orderDate = new Date(o.createdAt);
        return orderDate.toDateString() === today.toDateString();
      }).length,
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



// ✅ Manual Order Management

/**
 * البحث عن مستخدمين بالاسم أو الهاتف في مجموعتي users و customers
 * @param {string} term - كلمة البحث
 * @returns {Promise<Object>}
 */
export const getUsersBySearch = async (term) => {
  try {
    const searchLower = term.toLowerCase().trim();
    const normalize = (val) => String(val || '').replace(/\D/g, '');
    const searchDigits = normalize(term);

    // نجلب عينة من المجموعتين للتصفية (Firestore محدود في البحث النصي)
    const [usersSnap, customersSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(100))),
      getDocs(query(collection(db, 'customers'), limit(100)))
    ]);

    const resultsMap = new Map();

    const processDoc = (doc) => {
      const data = doc.data();
      const phoneMatch = searchDigits && normalize(data.phone).includes(searchDigits);
      const textMatch = data.name?.toLowerCase().includes(searchLower) ||
        data.firstName?.toLowerCase().includes(searchLower) ||
        data.lastName?.toLowerCase().includes(searchLower) ||
        data.email?.toLowerCase().includes(searchLower);

      if (phoneMatch || textMatch) {
        resultsMap.set(doc.id, { id: doc.id, ...data });
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
        providers.push({ id: doc.id, ...data });
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
    }

    await updateDoc(orderRef, updatePayload);
    return { success: true };
  } catch (error) {
    console.error('Update order details error:', error);
    throw error;
  }
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

      const currentBalance = providerDoc.data().wallet?.balance || 0;
      let newBalance = currentBalance;

      if (type === 'addition' || type === 'compensation') {
        newBalance += Number(amount);
      } else if (type === 'deduction') {
        newBalance -= Number(amount);
      }

      transaction.update(providerRef, {
        'wallet.balance': newBalance,
        'wallet.lastUpdated': serverTimestamp()
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
    const requestsRef = collection(db, 'requests');
    const q = query(requestsRef, where('providerId', '==', providerId));
    const querySnapshot = await getDocs(q);

    let completed = 0;
    let cancelled = 0;
    const orders = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'completed') completed++;
      if (data.status?.includes('canceled')) cancelled++;
      orders.push({ id: doc.id, ...data });
    });

    return { success: true, completed, cancelled, total: orders.length, orders };
  } catch (error) {
    console.error('Get provider order stats error:', error);
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
    const requested = data.requestedChanges || {};
    const updates = {
      firstName: requested.firstName,
      lastName: requested.lastName,
      phone: requested.phone,
      email: requested.email ?? null,
      nationality: requested.nationality,
      fullName: [requested.firstName, requested.lastName].filter(Boolean).join(' ').trim() || data.providerName,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(providerRef, updates);
    await updateDoc(requestRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
    });
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
