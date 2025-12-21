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
    // تحديث approvalStatus (حالة الموافقة) وليس status (حالة الاتصال)
    // status قد يحتوي على "online"/"offline" لذلك نستخدم approvalStatus
    await updateDoc(providerRef, {
      approvalStatus: status, // حالة الموافقة: pending, approved, rejected
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
      activeProviders: providers.filter((p) => p.status === 'approved' && p.isOnline).length,
      pendingProviders: providers.filter((p) => p.status === 'pending').length,
      totalOrders: orders.length,
      completedOrders: orders.filter((o) => o.status === 'completed').length,
      activeOrders: orders.filter((o) => ['searching', 'accepted', 'arriving'].includes(o.status)).length,
      totalRevenue: orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + (o.price || 0), 0),
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


