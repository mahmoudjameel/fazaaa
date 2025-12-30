import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Eye,
  MapPin,
  Clock,
  DollarSign,
  Star,
  AlertCircle,
  XCircle,
  User,
  Phone,
  Package,
  CheckCircle,
  X,
  Mail,
  Filter,
  ShoppingBag,
  ChevronRight,
  Target,
  Calculator,
  AlertTriangle,
  UserPlus,
  Trash2,
  Edit,
  Plus,
  Info
} from 'lucide-react';
import {
  listenToAllRequests,
  getProviderById,
  getUsersBySearch,
  createManualOrder,
  updateOrderDetails
} from '../services/adminService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Orders = () => {
  const location = useLocation();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [mainServices, setMainServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [cities, setCities] = useState([]);
  const [services, setServices] = useState([]);

  // Manual Order State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomerForOrder, setSelectedCustomerForOrder] = useState(null);
  const [newOrderData, setNewOrderData] = useState({
    serviceId: '',
    serviceName: '',
    price: '',
    location: '',
    cityId: '',
    notes: ''
  });

  // Edit Order State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderData, setEditOrderData] = useState({
    serviceName: '',
    price: '',
    location: '',
    cancelReason: '',
    status: ''
  });

  useEffect(() => {
    // استخدام real-time listener بدلاً من fetch
    const unsubscribe = listenToAllRequests((data) => {
      setRequests(data);
      setLoading(false);
    });

    // جلب الخدمات الرئيسية
    fetchMainServices();
    fetchCities();
    fetchServices();

    // Deep linking from Dashboard
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status) {
      if (status === 'active') {
        setStatusFilter('active');
      } else {
        setStatusFilter(status);
      }
    }

    return () => unsubscribe();
  }, [location.search]);

  const fetchCities = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'cities'));
      const citiesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCities(citiesList);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'emergency-services'));
      const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(servicesList);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchMainServices = async () => {
    try {
      const servicesRef = collection(db, 'emergency-services');
      const querySnapshot = await getDocs(servicesRef);
      const servicesList = [];
      querySnapshot.forEach((doc) => {
        servicesList.push({
          id: doc.id,
          serviceId: doc.data().id || doc.id,
          name: doc.data().name || '',
          ...doc.data()
        });
      });
      setMainServices(servicesList);
    } catch (error) {
      console.error('Error fetching main services:', error);
    }
  };

  useEffect(() => {
    filterOrders();
  }, [requests, searchTerm, statusFilter, cityFilter, serviceFilter]);

  // جلب بيانات العميل عند فتح Modal تفاصيل الطلب
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!selectedRequest) {
        setSelectedCustomer(null);
        return;
      }

      const userId = selectedRequest.userId || selectedRequest.customerId || selectedRequest.uid;
      if (!userId) {
        setSelectedCustomer(null);
        return;
      }

      setLoadingCustomer(true);
      try {
        const customerRef = doc(db, 'customers', userId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
          setSelectedCustomer({ id: customerSnap.id, ...customerSnap.data() });
        } else {
          setSelectedCustomer(null);
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        setSelectedCustomer(null);
      } finally {
        setLoadingCustomer(false);
      }
    };

    fetchCustomer();
  }, [selectedRequest]);

  const handleProviderClick = async (order, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    console.log('Order data:', order); // للتتبع

    // محاولة جلب providerId بطرق مختلفة
    let providerId = order.providerId || order.provider?.id;

    // إذا لم يكن موجوداً مباشرة، نبحث في history
    if (!providerId && order.history && Array.isArray(order.history)) {
      const assignedEvent = order.history.find(h =>
        (h.status === 'assigned' && h.providerId) ||
        h.providerId
      );
      if (assignedEvent && assignedEvent.providerId) {
        providerId = assignedEvent.providerId;
      }
    }

    console.log('Provider ID found:', providerId); // للتتبع

    if (!providerId) {
      // إذا لم يكن هناك providerId، نبحث عن المزود بالاسم
      if (order.providerName) {
        console.warn('Provider ID not found for provider:', order.providerName);
        alert('معرف المزود غير متوفر في بيانات الطلب. يرجى البحث عن المزود من صفحة إدارة المزودين.');
        return;
      }
      alert('بيانات المزود غير متوفرة');
      return;
    }

    setLoadingProvider(true);
    try {
      const result = await getProviderById(providerId);
      if (result.success) {
        setSelectedProvider(result.provider);
      } else {
        alert(result.error || 'فشل جلب بيانات المزود');
      }
    } catch (error) {
      console.error('Error fetching provider:', error);
      alert('حدث خطأ أثناء جلب بيانات المزود: ' + error.message);
    } finally {
      setLoadingProvider(false);
    }
  };

  const filterOrders = () => {
    let filtered = requests;

    // Filter by Service
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(req => req.serviceId === serviceFilter || req.serviceType === serviceFilter);
    }

    // Filter by City
    if (cityFilter !== 'all') {
      filtered = filtered.filter(req => req.cityId === cityFilter || req.city === cityFilter);
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter((r) => ['searching', 'assigned', 'en_route', 'arrived', 'in_progress'].includes(r.status));
      } else if (statusFilter === 'cancelled') {
        filtered = filtered.filter((r) => r.status?.includes('canceled'));
      } else if (statusFilter === 'cancelled_by_customer') {
        filtered = filtered.filter((r) => r.status === 'canceled_by_client' || r.status === 'canceled_by_client_with_reason');
      } else if (statusFilter === 'cancelled_by_provider') {
        filtered = filtered.filter((r) => r.status === 'canceled_by_provider' || r.status === 'canceled_by_provider_with_reason');
      } else if (statusFilter === 'no_providers_timeout') {
        // فلترة خاصة لعدم وجود مزودين وانتهاء المهلة
        filtered = filtered.filter(o => {
          if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') {
            return false;
          }

          const wasAccepted = o.assignedAt ||
            (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));

          if (wasAccepted) {
            return false;
          }

          const cancelReason = o.cancelReason || '';
          const historyCancelReason = Array.isArray(o.history)
            ? o.history.find(h => h.cancelReason)?.cancelReason || ''
            : '';

          const reason = cancelReason || historyCancelReason;

          const timeoutReasons = [
            'لا يوجد مزودين متاحين',
            'ضغط على الشبكة',
            'انتهى وقت البحث',
            'نعتذر لايوجد شبكة متاحة في منطقتكم',
            'نعتذر يوجد ضغط على الشبكة في الوقت الحالي'
          ];

          return timeoutReasons.some(r => reason.includes(r));
        });
      } else {
        filtered = filtered.filter((r) => r.status === statusFilter);
      }
    }

    // Filter by Search Term (Customer Name, Phone, Provider Name, ID)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.id?.toLowerCase().includes(searchLower) ||
          r.customerName?.toLowerCase().includes(searchLower) ||
          r.customerPhone?.includes(searchTerm) ||
          r.providerName?.toLowerCase().includes(searchLower) ||
          r.providerPhone?.includes(searchTerm) ||
          r.serviceName?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleCustomerSearch = async (term) => {
    setCustomerSearchTerm(term);
    if (term.length < 3) {
      setCustomerSearchResults([]);
      return;
    }

    setIsSearchingCustomer(true);
    try {
      const result = await getUsersBySearch(term);
      if (result.success) {
        setCustomerSearchResults(result.users);
      }
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleCreateManualOrder = async (e) => {
    e.preventDefault();
    if (!selectedCustomerForOrder) {
      alert('الرجاء اختيار عميل أولاً');
      return;
    }

    if (!newOrderData.serviceId || !newOrderData.price) {
      alert('الرجاء تعبئة بيانات الخدمة والسعر');
      return;
    }

    try {
      const selectedService = services.find(s => s.id === newOrderData.serviceId);
      const orderPayload = {
        customerId: selectedCustomerForOrder.id,
        customerName: selectedCustomerForOrder.name || `${selectedCustomerForOrder.firstName || ''} ${selectedCustomerForOrder.lastName || ''}`.trim(),
        customerPhone: selectedCustomerForOrder.phone,
        serviceId: newOrderData.serviceId,
        serviceName: selectedService?.name || newOrderData.serviceName,
        serviceType: selectedService?.id || '',
        price: Number(newOrderData.price),
        location: newOrderData.location,
        cityId: newOrderData.cityId,
        notes: newOrderData.notes,
        status: 'searching'
      };

      const result = await createManualOrder(orderPayload);
      if (result.success) {
        alert('تم إنشاء الطلب بنجاح');
        setIsManualModalOpen(false);
        setNewOrderData({ serviceId: '', serviceName: '', price: '', location: '', cityId: '', notes: '' });
        setSelectedCustomerForOrder(null);
        setCustomerSearchTerm('');
      }
    } catch (error) {
      alert('حدث خطأ أثناء إنشاء الطلب: ' + error.message);
    }
  };

  const handleEditClick = (order, e) => {
    if (e) e.stopPropagation();
    setEditingOrder(order);
    setEditOrderData({
      serviceName: order.serviceName || '',
      price: order.price || '',
      location: order.location || '',
      cancelReason: order.cancelReason || '',
      status: order.status || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    try {
      const result = await updateOrderDetails(editingOrder.id, {
        serviceName: editOrderData.serviceName,
        price: Number(editOrderData.price),
        location: editOrderData.location,
        cancelReason: editOrderData.cancelReason,
        status: editOrderData.status
      });
      if (result.success) {
        alert('تم تحديث الطلب بنجاح');
        setIsEditModalOpen(false);
      }
    } catch (error) {
      alert('حدث خطأ أثناء تحديث الطلب: ' + error.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      searching: { text: 'جاري البحث', color: 'bg-yellow-100 text-yellow-700' },
      assigned: { text: 'مقبول', color: 'bg-teal-100 text-teal-700' },
      en_route: { text: 'في الطريق', color: 'bg-blue-100 text-blue-700' },
      arrived: { text: 'وصل', color: 'bg-purple-100 text-purple-700' },
      in_progress: { text: 'قيد التنفيذ', color: 'bg-orange-100 text-orange-700' },
      pending_client_confirmation: { text: 'بانتظار العميل', color: 'bg-yellow-100 text-yellow-700' },
      completed: { text: 'مكتمل', color: 'bg-green-100 text-green-700' },
      canceled_by_client: { text: 'ملغي من العميل', color: 'bg-red-100 text-red-700' },
      canceled_by_provider: { text: 'ملغي من المزود', color: 'bg-red-100 text-red-700' },
      canceled_by_client_with_reason: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
      canceled_by_provider_with_reason: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const getServiceIcon = (serviceType) => {
    const icons = {
      tires: '🚗',
      battery: '🔋',
      locksmith: '🔐',
    };
    return icons[serviceType] || '📦';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 md:mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mb-1 sm:mb-2">إدارة الطلبات</h1>
          <p className="text-sm sm:text-base text-gray-600">عرض ومتابعة جميع الطلبات</p>
        </div>
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary-teal text-white rounded-xl hover:bg-teal-600 transition-all font-bold shadow-lg"
        >
          <Plus size={20} />
          إنشاء طلب يدوي
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-yellow-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">قيد التنفيذ</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {requests.filter((o) => ['searching', 'assigned', 'en_route', 'arrived', 'in_progress'].includes(o.status)).length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-green-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">مكتملة</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {requests.filter((o) => o.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">إجمالي الطلبات</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">{requests.length}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-teal-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">إجمالي الإيرادات</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {requests
              .filter((o) => o.status === 'completed')
              .reduce((sum, o) => sum + (o.price || 0), 0)
              .toLocaleString()}{' '}
            ر.س
          </p>
        </div>
      </div>

      {/* No Providers / Timeout - Alert Section */}
      {(() => {
        const noProvidersTimeoutOrders = requests.filter(o => {
          // التحقق من أن الطلب ملغي من العميل
          if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') {
            return false;
          }

          // التحقق من أن الطلب لم يتم قبوله (لا يوجد assignedAt)
          const wasAccepted = o.assignedAt ||
            (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));

          if (wasAccepted) {
            return false; // تم قبوله، لا نعرضه هنا
          }

          // التحقق من سبب الإلغاء
          const cancelReason = o.cancelReason || '';
          const historyCancelReason = Array.isArray(o.history)
            ? o.history.find(h => h.cancelReason)?.cancelReason || ''
            : '';

          const reason = cancelReason || historyCancelReason;

          // الأسباب المتعلقة بعدم وجود مزودين أو انتهاء المهلة
          const timeoutReasons = [
            'لا يوجد مزودين متاحين',
            'ضغط على الشبكة',
            'انتهى وقت البحث',
            'نعتذر لايوجد شبكة متاحة في منطقتكم',
            'نعتذر يوجد ضغط على الشبكة في الوقت الحالي'
          ];

          return timeoutReasons.some(r => reason.includes(r));
        });

        if (noProvidersTimeoutOrders.length > 0) {
          return (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <XCircle className="text-purple-600 w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-purple-800">عدم وجود مزودين وانتهاء المهلة المحددة</h3>
                    <p className="text-xs sm:text-sm text-purple-600">طلبات تم إلغاؤها بسبب عدم وجود مزودين أو انتهاء وقت البحث</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-base sm:text-lg font-bold">
                    {noProvidersTimeoutOrders.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {noProvidersTimeoutOrders.slice(0, 6).map((order) => {
                  const cancelReason = order.cancelReason ||
                    (Array.isArray(order.history)
                      ? order.history.find(h => h.cancelReason)?.cancelReason
                      : '') ||
                    'لم يتم تحديد السبب';

                  // تحديد نوع السبب
                  let reasonType = 'غير محدد';
                  let reasonColor = 'text-purple-700';

                  if (cancelReason.includes('لا يوجد مزودين') || cancelReason.includes('لايوجد شبكة')) {
                    reasonType = 'لا يوجد مزودين في المنطقة';
                    reasonColor = 'text-red-700';
                  } else if (cancelReason.includes('ضغط على الشبكة') || cancelReason.includes('ضغط على الشبكة')) {
                    reasonType = 'ضغط على الشبكة';
                    reasonColor = 'text-orange-700';
                  } else if (cancelReason.includes('انتهى وقت البحث')) {
                    reasonType = 'انتهى وقت البحث';
                    reasonColor = 'text-yellow-700';
                  }

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-lg p-4 border-l-4 border-purple-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 mb-1">
                            {order.serviceName || order.serviceType || 'خدمة'}
                          </p>
                          <p className="text-xs text-gray-600 mb-1">
                            الموقع: <span className="font-semibold">{order.location || 'غير محدد'}</span>
                          </p>
                          <p className={`text-xs font-semibold mt-2 ${reasonColor}`}>
                            ⚠️ {reasonType}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(() => {
                              if (!order.createdAt) return '-';
                              let date;
                              if (order.createdAt?.toMillis) {
                                date = new Date(order.createdAt.toMillis());
                              } else if (order.createdAt?.toDate) {
                                date = order.createdAt.toDate();
                              } else if (order.createdAt?.seconds) {
                                date = new Date(order.createdAt.seconds * 1000);
                              } else {
                                date = new Date(order.createdAt);
                              }
                              return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                            })()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedRequest(order)}
                          className="text-purple-600 hover:text-purple-800 text-xs font-semibold"
                        >
                          عرض التفاصيل
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {noProvidersTimeoutOrders.length > 6 && (
                <p className="text-sm text-purple-600 mt-2 text-center">
                  و {noProvidersTimeoutOrders.length - 6} حالة أخرى...
                </p>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Rejections After Acceptance - Alert Section */}
      {(() => {
        const providerRejectionsAfterAccept = requests.filter(
          o => {
            if (o.status !== 'canceled_by_provider' && o.status !== 'canceled_by_provider_with_reason') {
              return false;
            }
            // التحقق من أن الطلب تم قبوله أولاً
            const wasAccepted = o.assignedAt ||
              (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
            return wasAccepted;
          }
        );

        const clientRejectionsAfterAccept = requests.filter(
          o => {
            if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') {
              return false;
            }
            // التحقق من أن الطلب تم قبوله أولاً
            const wasAccepted = o.assignedAt ||
              (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
            return wasAccepted;
          }
        );

        const allRejections = [...providerRejectionsAfterAccept, ...clientRejectionsAfterAccept];

        if (allRejections.length > 0) {
          return (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-600" size={24} />
                  <div>
                    <h3 className="text-lg font-bold text-red-800">الرفض والإلغاء بعد قبول الطلبات</h3>
                    <p className="text-sm text-red-600">حالات رفض المزود أو العميل بعد قبول الطلب</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-600 text-white px-4 py-2 rounded-full text-lg font-bold">
                    {providerRejectionsAfterAccept.length} مزود
                  </span>
                  <span className="bg-orange-600 text-white px-4 py-2 rounded-full text-lg font-bold">
                    {clientRejectionsAfterAccept.length} عميل
                  </span>
                </div>
              </div>

              {/* Provider Rejections */}
              {providerRejectionsAfterAccept.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <h4 className="font-semibold text-red-800">رفض المزودين ({providerRejectionsAfterAccept.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {providerRejectionsAfterAccept.slice(0, 4).map((order) => {
                      const cancelEvent = Array.isArray(order.history)
                        ? order.history.find(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                        : null;
                      const reason = order.cancelReason || cancelEvent?.cancelReason || 'لم يتم تحديد السبب';

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-lg p-4 border-l-4 border-red-500"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 mb-1">
                                {order.serviceName || order.serviceType || 'خدمة'}
                              </p>
                              <p className="text-xs text-gray-600 mb-1">
                                المزود: {order.providerName ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleProviderClick(order, e)}
                                    className="font-semibold text-teal-600 hover:text-teal-700 underline decoration-dotted cursor-pointer"
                                  >
                                    {order.providerName}
                                  </button>
                                ) : (
                                  <span className="font-semibold">غير محدد</span>
                                )}
                              </p>
                              <p className="text-xs text-red-700 font-semibold mt-2">
                                ⚠️ السبب: {reason}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedRequest(order)}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold"
                            >
                              عرض التفاصيل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {providerRejectionsAfterAccept.length > 4 && (
                    <p className="text-sm text-red-600 mt-2 text-center">
                      و {providerRejectionsAfterAccept.length - 4} حالة أخرى...
                    </p>
                  )}
                </div>
              )}

              {/* Client Rejections */}
              {clientRejectionsAfterAccept.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
                    <h4 className="font-semibold text-orange-800">إلغاء العملاء ({clientRejectionsAfterAccept.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {clientRejectionsAfterAccept.slice(0, 4).map((order) => {
                      const cancelEvent = Array.isArray(order.history)
                        ? order.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                        : null;
                      const reason = order.cancelReason || cancelEvent?.cancelReason || 'لم يتم تحديد السبب';

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-lg p-4 border-l-4 border-orange-500"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 mb-1">
                                {order.serviceName || order.serviceType || 'خدمة'}
                              </p>
                              <p className="text-xs text-gray-600 mb-1">
                                المزود: {order.providerName ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleProviderClick(order, e)}
                                    className="font-semibold text-teal-600 hover:text-teal-700 underline decoration-dotted cursor-pointer"
                                  >
                                    {order.providerName}
                                  </button>
                                ) : (
                                  <span className="font-semibold">غير محدد</span>
                                )}
                              </p>
                              <p className="text-xs text-orange-700 font-semibold mt-2">
                                ⚠️ السبب: {reason}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedRequest(order)}
                              className="text-orange-600 hover:text-orange-800 text-xs font-semibold"
                            >
                              عرض التفاصيل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {clientRejectionsAfterAccept.length > 4 && (
                    <p className="text-sm text-orange-600 mt-2 text-center">
                      و {clientRejectionsAfterAccept.length - 4} حالة أخرى...
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن طلب (الاسم، الهاتف، المزود، الخدمة، رقم الطلب)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-teal-400 focus:outline-none font-semibold text-gray-700"
          >
            <option value="all">كل الحالات</option>
            <option value="active">قيد التنفيذ</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة (الكل)</option>
            <option value="cancelled_by_customer">ملغاة من العميل</option>
            <option value="cancelled_by_provider">ملغاة من المزود</option>
            <option value="searching">جاري البحث</option>
            <option value="assigned">مقبول</option>
            <option value="en_route">في الطريق</option>
            <option value="arrived">وصل</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="no_providers_timeout">عدم وجود مزودين وانتهاء المهلة</option>
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-teal-400 focus:outline-none font-semibold text-gray-700"
          >
            <option value="all">كل المدن</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-teal-400 focus:outline-none font-semibold text-gray-700"
          >
            <option value="all">كل الخدمات</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد طلبات</p>
          </div>
        ) : (
          filteredRequests.map((order) => {
            const statusBadge = getStatusBadge(order.status);
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-4xl">{getServiceIcon(order.serviceType)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">
                          {order.serviceName || order.serviceType || 'خدمة'}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}
                        >
                          {statusBadge.text}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {order.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={16} />
                            <span>{order.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock size={16} />
                          <span>
                            {(() => {
                              if (!order.createdAt) return '-';

                              // التعامل مع Firebase Timestamp
                              let date;
                              if (order.createdAt?.toMillis) {
                                date = new Date(order.createdAt.toMillis());
                              } else if (order.createdAt?.toDate) {
                                date = order.createdAt.toDate();
                              } else if (order.createdAt?.seconds) {
                                date = new Date(order.createdAt.seconds * 1000);
                              } else {
                                date = new Date(order.createdAt);
                              }

                              return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                            })()}
                          </span>
                        </div>
                        {order.providerName && (
                          <div className="text-xs">
                            <span className="text-gray-600">مزود: </span>
                            <button
                              type="button"
                              onClick={(e) => handleProviderClick(order, e)}
                              className="text-teal-600 hover:text-teal-700 font-semibold underline decoration-dotted cursor-pointer"
                            >
                              {order.providerName}
                            </button>
                          </div>
                        )}
                        {/* Provider Cancellation */}
                        {(order.status === 'canceled_by_provider' || order.status === 'canceled_by_provider_with_reason') && (order.cancelReason || order.history) && (
                          (() => {
                            const cancelEvent = Array.isArray(order.history)
                              ? order.history.find(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                              : null;
                            const reason = order.cancelReason || cancelEvent?.cancelReason;
                            const wasAccepted = order.assignedAt || (Array.isArray(order.history) && order.history.some(h => h.status === 'assigned'));

                            if (reason && wasAccepted) {
                              return (
                                <div className="mt-2 p-2 bg-red-50 border-r-4 border-red-500 rounded">
                                  <p className="text-xs text-red-700 font-semibold">
                                    ⚠️ رفض المزود بعد القبول
                                  </p>
                                  <p className="text-xs text-red-600 mt-1">
                                    السبب: {reason}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()
                        )}

                        {/* Client Cancellation */}
                        {(order.status === 'canceled_by_client' || order.status === 'canceled_by_client_with_reason') && (order.cancelReason || order.history) && (
                          (() => {
                            const cancelEvent = Array.isArray(order.history)
                              ? order.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                              : null;
                            const reason = order.cancelReason || cancelEvent?.cancelReason;
                            const wasAccepted = order.assignedAt || (Array.isArray(order.history) && order.history.some(h => h.status === 'assigned'));

                            if (reason && wasAccepted) {
                              return (
                                <div className="mt-2 p-2 bg-orange-50 border-r-4 border-orange-500 rounded">
                                  <p className="text-xs text-orange-700 font-semibold">
                                    ⚠️ إلغاء العميل بعد القبول
                                  </p>
                                  <p className="text-xs text-orange-600 mt-1">
                                    السبب: {reason}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left ml-4">
                    <div className="mb-2">
                      <p className="text-2xl font-black text-green-600">{order.price || 0} ر.س</p>
                      {order.status === 'completed' && (
                        <p className="text-xs font-bold text-teal-600">العمولة: {order.commission || 0} ر.س</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setSelectedRequest(order)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-blue/10 text-primary-blue rounded-lg hover:bg-primary-blue/20 transition-all text-sm font-semibold"
                      >
                        <Eye size={16} />
                        التفاصيل
                      </button>
                      <button
                        onClick={(e) => handleEditClick(order, e)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all text-sm font-semibold"
                      >
                        <Edit size={16} />
                        تعديل
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Order Details Modal */}
      {
        selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    تفاصيل الطلب
                    <span className="text-sm font-normal text-gray-500">#{selectedRequest.id?.substring(0, 8)}</span>
                  </h2>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
                {/* تفاصيل العميل */}
                {loadingCustomer ? (
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500">جاري تحميل بيانات العميل...</p>
                  </div>
                ) : selectedCustomer ? (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 border border-blue-200 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="text-white w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                          {selectedCustomer.firstName || ''} {selectedCustomer.lastName || ''}
                        </h3>
                        <p className="text-sm text-gray-600">العميل</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {selectedCustomer.phone && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Phone className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">رقم الجوال</h4>
                          </div>
                          <p className="text-sm text-gray-800">{selectedCustomer.phone}</p>
                        </div>
                      )}
                      {selectedCustomer.email && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">البريد الإلكتروني</h4>
                          </div>
                          <p className="text-sm text-gray-800 break-words">{selectedCustomer.email}</p>
                        </div>
                      )}
                      {selectedCustomer.city && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">المدينة</h4>
                          </div>
                          <p className="text-sm text-gray-800">{selectedCustomer.city}</p>
                        </div>
                      )}
                      {selectedCustomer.carModel && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">نوع السيارة</h4>
                          </div>
                          <p className="text-sm text-gray-800">{selectedCustomer.carModel}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">نوع الخدمة</h3>
                  <p className="text-sm sm:text-base text-gray-800">{selectedRequest.serviceType}</p>
                </div>
                {selectedRequest.serviceOption && (
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الخدمة المحددة</h3>
                    <p className="text-sm sm:text-base text-gray-800">{selectedRequest.serviceOption}</p>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الموقع</h3>
                  <p className="text-sm sm:text-base text-gray-800">{selectedRequest.location || 'غير محدد'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-600 mb-1">سعر الخدمة</h3>
                    <p className="text-lg font-bold text-green-600">{selectedRequest.price || selectedRequest.servicePrice || 0} ر.س</p>
                  </div>
                  {selectedRequest.status === 'completed' && (
                    <div>
                      <h3 className="font-semibold text-xs sm:text-sm text-gray-600 mb-1">العمولة المستقطعة</h3>
                      <p className="text-lg font-bold text-teal-600">{selectedRequest.commission || 0} ر.س</p>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الحالة</h3>
                  <span
                    className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${getStatusBadge(selectedRequest.status).color
                      }`}
                  >
                    {getStatusBadge(selectedRequest.status).text}
                  </span>
                  {/* Provider Cancellation */}
                  {(selectedRequest.status === 'canceled_by_provider' || selectedRequest.status === 'canceled_by_provider_with_reason') && (
                    (() => {
                      const cancelEvent = Array.isArray(selectedRequest.history)
                        ? selectedRequest.history.find(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                        : null;
                      const reason = selectedRequest.cancelReason || cancelEvent?.cancelReason;
                      const wasAccepted = selectedRequest.assignedAt || (Array.isArray(selectedRequest.history) && selectedRequest.history.some(h => h.status === 'assigned'));

                      if (wasAccepted) {
                        return (
                          <div className="mt-3 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg">
                            <p className="text-sm font-semibold text-red-800 mb-2">
                              ⚠️ رفض المزود بعد قبول الطلب
                            </p>
                            {reason && (
                              <p className="text-sm text-red-700">
                                <span className="font-semibold">السبب:</span> {reason}
                              </p>
                            )}
                            {selectedRequest.cancelledBy && (
                              <p className="text-xs text-red-600 mt-2">
                                معرف المزود: {selectedRequest.cancelledBy}
                              </p>
                            )}
                            {selectedRequest.cancelledAt && (
                              <p className="text-xs text-red-600 mt-1">
                                وقت الإلغاء: {(() => {
                                  const date = selectedRequest.cancelledAt?.toMillis
                                    ? new Date(selectedRequest.cancelledAt.toMillis())
                                    : new Date(selectedRequest.cancelledAt);
                                  return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                })()}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}

                  {/* Client Cancellation */}
                  {(selectedRequest.status === 'canceled_by_client' || selectedRequest.status === 'canceled_by_client_with_reason') && (
                    (() => {
                      const cancelEvent = Array.isArray(selectedRequest.history)
                        ? selectedRequest.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                        : null;
                      const reason = selectedRequest.cancelReason || cancelEvent?.cancelReason;
                      const wasAccepted = selectedRequest.assignedAt || (Array.isArray(selectedRequest.history) && selectedRequest.history.some(h => h.status === 'assigned'));

                      if (wasAccepted) {
                        return (
                          <div className="mt-3 p-3 bg-orange-50 border-r-4 border-orange-500 rounded-lg">
                            <p className="text-sm font-semibold text-orange-800 mb-2">
                              ⚠️ إلغاء العميل بعد قبول الطلب
                            </p>
                            {reason && (
                              <p className="text-sm text-orange-700">
                                <span className="font-semibold">السبب:</span> {reason}
                              </p>
                            )}
                            {selectedRequest.cancelledBy && (
                              <p className="text-xs text-orange-600 mt-2">
                                معرف العميل: {selectedRequest.cancelledBy}
                              </p>
                            )}
                            {selectedRequest.cancelledAt && (
                              <p className="text-xs text-orange-600 mt-1">
                                وقت الإلغاء: {(() => {
                                  const date = selectedRequest.cancelledAt?.toMillis
                                    ? new Date(selectedRequest.cancelledAt.toMillis())
                                    : new Date(selectedRequest.cancelledAt);
                                  return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                })()}
                              </p>
                            )}
                          </div>
                        );
                      }

                      // عرض حالة عدم وجود مزودين وانتهاء المهلة
                      if (!wasAccepted && reason) {
                        const timeoutReasons = [
                          'لا يوجد مزودين متاحين',
                          'ضغط على الشبكة',
                          'انتهى وقت البحث',
                          'نعتذر لايوجد شبكة متاحة في منطقتكم',
                          'نعتذر يوجد ضغط على الشبكة في الوقت الحالي'
                        ];

                        const isTimeoutReason = timeoutReasons.some(r => reason.includes(r));

                        if (isTimeoutReason) {
                          let reasonType = 'غير محدد';
                          let bgColor = 'bg-purple-50';
                          let borderColor = 'border-purple-500';
                          let textColor = 'text-purple-800';
                          let reasonTextColor = 'text-purple-700';

                          if (reason.includes('لا يوجد مزودين') || reason.includes('لايوجد شبكة')) {
                            reasonType = 'لا يوجد مزودين في المنطقة';
                            bgColor = 'bg-red-50';
                            borderColor = 'border-red-500';
                            textColor = 'text-red-800';
                            reasonTextColor = 'text-red-700';
                          } else if (reason.includes('ضغط على الشبكة')) {
                            reasonType = 'ضغط على الشبكة';
                            bgColor = 'bg-orange-50';
                            borderColor = 'border-orange-500';
                            textColor = 'text-orange-800';
                            reasonTextColor = 'text-orange-700';
                          } else if (reason.includes('انتهى وقت البحث')) {
                            reasonType = 'انتهى وقت البحث';
                            bgColor = 'bg-yellow-50';
                            borderColor = 'border-yellow-500';
                            textColor = 'text-yellow-800';
                            reasonTextColor = 'text-yellow-700';
                          }

                          return (
                            <div className={`mt-3 p-3 ${bgColor} border-r-4 ${borderColor} rounded-lg`}>
                              <p className={`text-sm font-semibold ${textColor} mb-2`}>
                                ⚠️ عدم وجود مزودين وانتهاء المهلة المحددة
                              </p>
                              <p className={`text-sm ${reasonTextColor} mb-2`}>
                                <span className="font-semibold">نوع السبب:</span> {reasonType}
                              </p>
                              <p className={`text-sm ${reasonTextColor}`}>
                                <span className="font-semibold">السبب الكامل:</span> {reason}
                              </p>
                              {selectedRequest.cancelledAt && (
                                <p className={`text-xs ${reasonTextColor} mt-2`}>
                                  وقت الإلغاء: {(() => {
                                    const date = selectedRequest.cancelledAt?.toMillis
                                      ? new Date(selectedRequest.cancelledAt.toMillis())
                                      : new Date(selectedRequest.cancelledAt);
                                    return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                  })()}
                                </p>
                              )}
                            </div>
                          );
                        }
                      }

                      return null;
                    })()
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">السعر</h3>
                  <p className="text-xl sm:text-2xl font-black text-green-600">
                    {selectedRequest.servicePrice || selectedRequest.price || 0} ر.س
                  </p>
                </div>
                {/* Timeline Section */}
                <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-200">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    <span>الخط الزمني للطلب</span>
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* وقت الإنشاء */}
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex flex-col items-center pt-0.5 sm:pt-1 flex-shrink-0">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                        <div className="w-0.5 h-full bg-gray-300 mt-1"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base mb-1">وقت الإنشاء</p>
                        <p className="text-gray-600 text-xs sm:text-sm break-words">
                          {(() => {
                            if (!selectedRequest.createdAt) return '-';

                            let date;
                            if (selectedRequest.createdAt?.toMillis) {
                              date = new Date(selectedRequest.createdAt.toMillis());
                            } else if (selectedRequest.createdAt?.toDate) {
                              date = selectedRequest.createdAt.toDate();
                            } else if (selectedRequest.createdAt?.seconds) {
                              date = new Date(selectedRequest.createdAt.seconds * 1000);
                            } else {
                              date = new Date(selectedRequest.createdAt);
                            }

                            return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* وقت قبول المزود */}
                    {(() => {
                      const assignedAt = selectedRequest.assignedAt ||
                        (Array.isArray(selectedRequest.history)
                          ? selectedRequest.history.find(h => h.status === 'assigned' || h.action === 'assigned')?.timestamp
                          : null);

                      if (!assignedAt) return null;

                      let assignedDate;
                      if (assignedAt?.toMillis) {
                        assignedDate = new Date(assignedAt.toMillis());
                      } else if (assignedAt?.toDate) {
                        assignedDate = assignedAt.toDate();
                      } else if (assignedAt?.seconds) {
                        assignedDate = new Date(assignedAt.seconds * 1000);
                      } else {
                        assignedDate = new Date(assignedAt);
                      }

                      if (isNaN(assignedDate.getTime())) return null;

                      return (
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex flex-col items-center pt-0.5 sm:pt-1 flex-shrink-0">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                            <div className="w-0.5 h-full bg-gray-300 mt-1"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base mb-1">وقت قبول المزود</p>
                            <p className="text-gray-600 text-xs sm:text-sm break-words">
                              {format(assignedDate, 'dd MMM yyyy, HH:mm:ss', { locale: ar })}
                            </p>
                            {selectedRequest.createdAt && (() => {
                              let createdDate;
                              if (selectedRequest.createdAt?.toMillis) {
                                createdDate = new Date(selectedRequest.createdAt.toMillis());
                              } else if (selectedRequest.createdAt?.toDate) {
                                createdDate = selectedRequest.createdAt.toDate();
                              } else if (selectedRequest.createdAt?.seconds) {
                                createdDate = new Date(selectedRequest.createdAt.seconds * 1000);
                              } else {
                                createdDate = new Date(selectedRequest.createdAt);
                              }
                              if (!isNaN(createdDate.getTime())) {
                                const diffMinutes = Math.round((assignedDate - createdDate) / (1000 * 60));
                                return (
                                  <p className="text-xs text-gray-500 mt-1">
                                    (بعد {diffMinutes} دقيقة من الإنشاء)
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    })()}

                    {/* وقت التنفيذ / الإكمال */}
                    {(() => {
                      const completedAt = selectedRequest.completedAt ||
                        (Array.isArray(selectedRequest.history)
                          ? selectedRequest.history.find(h => h.status === 'completed' || h.action === 'completed')?.timestamp
                          : null);

                      if (!completedAt) return null;

                      let completedDate;
                      if (completedAt?.toMillis) {
                        completedDate = new Date(completedAt.toMillis());
                      } else if (completedAt?.toDate) {
                        completedDate = completedAt.toDate();
                      } else if (completedAt?.seconds) {
                        completedDate = new Date(completedAt.seconds * 1000);
                      } else {
                        completedDate = new Date(completedAt);
                      }

                      if (isNaN(completedDate.getTime())) return null;

                      return (
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex flex-col items-center pt-0.5 sm:pt-1 flex-shrink-0">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-teal-500 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base mb-1">وقت التنفيذ</p>
                            <p className="text-gray-600 text-xs sm:text-sm break-words">
                              {format(completedDate, 'dd MMM yyyy, HH:mm:ss', { locale: ar })}
                            </p>
                            {selectedRequest.createdAt && (() => {
                              let createdDate;
                              if (selectedRequest.createdAt?.toMillis) {
                                createdDate = new Date(selectedRequest.createdAt.toMillis());
                              } else if (selectedRequest.createdAt?.toDate) {
                                createdDate = selectedRequest.createdAt.toDate();
                              } else if (selectedRequest.createdAt?.seconds) {
                                createdDate = new Date(selectedRequest.createdAt.seconds * 1000);
                              } else {
                                createdDate = new Date(selectedRequest.createdAt);
                              }
                              if (!isNaN(createdDate.getTime())) {
                                const diffMinutes = Math.round((completedDate - createdDate) / (1000 * 60));
                                const diffHours = Math.floor(diffMinutes / 60);
                                const remainingMinutes = diffMinutes % 60;
                                const timeText = diffHours > 0
                                  ? `${diffHours} ساعة و ${remainingMinutes} دقيقة`
                                  : `${diffMinutes} دقيقة`;
                                return (
                                  <p className="text-xs text-gray-500 mt-1">
                                    (بعد {timeText} من الإنشاء)
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Rating Section */}
                {selectedRequest.rated && (
                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                    <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Star className="text-yellow-500 fill-yellow-500" size={20} />
                      تقييم العميل
                    </h3>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={20}
                          className={`${i < selectedRequest.rating
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                            }`}
                        />
                      ))}
                      <span className="mr-2 font-bold text-gray-700">
                        ({selectedRequest.rating}/5)
                      </span>
                    </div>
                    {selectedRequest.ratingComment && (
                      <p className="text-gray-600 text-sm bg-white p-3 rounded-lg border border-yellow-100 italic">
                        "{selectedRequest.ratingComment}"
                      </p>
                    )}
                  </div>
                )}

                {/* Car Plate Image */}
                {selectedRequest.carPlateImage && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">صورة لوحة السيارة</h3>
                    <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-teal-400 transition-all">
                      <img
                        src={selectedRequest.carPlateImage}
                        alt="لوحة السيارة"
                        className="w-full h-auto object-cover cursor-pointer"
                        onClick={() => window.open(selectedRequest.carPlateImage, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                        <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                      </div>
                    </div>
                    {selectedRequest.carPlateImageTimestamp && (
                      <p className="text-xs text-gray-500 mt-2">
                        تم الرفع: {format(new Date(selectedRequest.carPlateImageTimestamp), 'dd MMM yyyy, HH:mm', { locale: ar })}
                      </p>
                    )}
                  </div>
                )}

                {/* Service Documentation Images (Before/After) */}
                {(selectedRequest.serviceDocumentationBefore || selectedRequest.serviceDocumentationAfter) && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">صور توثيق الخدمة</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before Image */}
                      {selectedRequest.serviceDocumentationBefore && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">قبل الخدمة</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-orange-400 transition-all">
                            <img
                              src={selectedRequest.serviceDocumentationBefore}
                              alt="قبل الخدمة"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.serviceDocumentationBefore, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.serviceDocumentationBeforeTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.serviceDocumentationBeforeTimestamp), 'HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* After Image */}
                      {selectedRequest.serviceDocumentationAfter && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">بعد الخدمة</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-green-400 transition-all">
                            <img
                              src={selectedRequest.serviceDocumentationAfter}
                              alt="بعد الخدمة"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.serviceDocumentationAfter, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.serviceDocumentationAfterTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.serviceDocumentationAfterTimestamp), 'HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No Images Message */}
                {!selectedRequest.carPlateImage && !selectedRequest.serviceDocumentationBefore && !selectedRequest.serviceDocumentationAfter && (
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <p className="text-gray-500 text-sm">لا توجد صور توثيق لهذا الطلب</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Provider Details Modal */}
      {
        selectedProvider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">تفاصيل المزود</h2>
                  <button
                    onClick={() => setSelectedProvider(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 space-y-4">
                {loadingProvider ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">جاري التحميل...</p>
                  </div>
                ) : (
                  <>
                    {/* الاسم */}
                    <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl p-4 sm:p-5 border border-teal-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
                          <User className="text-white w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                            {selectedProvider.firstName || ''} {selectedProvider.lastName || ''}
                          </h3>
                          <p className="text-sm text-gray-600">المزود</p>
                        </div>
                      </div>
                    </div>

                    {/* معلومات التواصل */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-5 h-5 text-gray-600" />
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700">رقم الجوال</h4>
                        </div>
                        <p className="text-sm sm:text-base text-gray-800">{selectedProvider.phone || 'غير محدد'}</p>
                      </div>

                      {selectedProvider.email && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-5 h-5 text-gray-600" />
                            <h4 className="font-semibold text-sm sm:text-base text-gray-700">البريد الإلكتروني</h4>
                          </div>
                          <p className="text-sm sm:text-base text-gray-800 break-words">{selectedProvider.email}</p>
                        </div>
                      )}
                    </div>

                    {/* الحالة */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-gray-600" />
                        <h4 className="font-semibold text-sm sm:text-base text-gray-700">حالة الموافقة</h4>
                      </div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${selectedProvider.approvalStatus === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : selectedProvider.approvalStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : selectedProvider.approvalStatus === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                        {selectedProvider.approvalStatus === 'approved' ? 'موافق عليه' :
                          selectedProvider.approvalStatus === 'pending' ? 'قيد الانتظار' :
                            selectedProvider.approvalStatus === 'rejected' ? 'مرفوض' : 'غير محدد'}
                      </span>
                    </div>

                    {/* الخدمات */}
                    {selectedProvider.services && Object.keys(selectedProvider.services).length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="w-5 h-5 text-gray-600" />
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700">الخدمات</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(selectedProvider.services).map(([serviceId, serviceData]) => {
                            const isActive = serviceData === true || (serviceData && serviceData.isActive !== false);
                            // البحث عن اسم الخدمة من mainServices
                            const service = mainServices.find(s =>
                              s.id === serviceId ||
                              s.serviceId === serviceId ||
                              s.id?.toLowerCase() === serviceId?.toLowerCase()
                            );
                            const serviceName = service?.name || serviceId;

                            return (
                              <div
                                key={serviceId}
                                className={`p-3 rounded-lg border ${isActive
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-gray-50 border-gray-200'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-800 block truncate">
                                      {serviceName}
                                    </span>
                                    {service && serviceName !== serviceId && (
                                      <span className="text-xs text-gray-500 block mt-0.5 truncate">
                                        {serviceId}
                                      </span>
                                    )}
                                  </div>
                                  {isActive ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mr-2" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* النوع والمجموعة */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedProvider.type && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700 mb-2">النوع</h4>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${selectedProvider.type === 'vip'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                            }`}>
                            {selectedProvider.type === 'vip' ? 'VIP' : 'عام'}
                          </span>
                        </div>
                      )}

                      {selectedProvider.createdAt && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700 mb-2">تاريخ التسجيل</h4>
                          <p className="text-sm text-gray-600">
                            {(() => {
                              let date;
                              if (selectedProvider.createdAt?.toMillis) {
                                date = new Date(selectedProvider.createdAt.toMillis());
                              } else if (selectedProvider.createdAt?.toDate) {
                                date = selectedProvider.createdAt.toDate();
                              } else if (selectedProvider.createdAt?.seconds) {
                                date = new Date(selectedProvider.createdAt.seconds * 1000);
                              } else {
                                date = new Date(selectedProvider.createdAt);
                              }
                              return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy', { locale: ar });
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Manual Order Modal */}
      {
        isManualModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">إنشاء طلب يدوي جديد</h2>
                <button onClick={() => setIsManualModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateManualOrder} className="p-6 space-y-6">
                {/* Customer Search Section */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">البحث عن عميل</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو الهاتف (3 أحرف على الأقل)..."
                      value={customerSearchTerm}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                    />
                    {isSearchingCustomer && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-primary-teal border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Search Results */}
                  {customerSearchResults.length > 0 && !selectedCustomerForOrder && (
                    <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                      {customerSearchResults.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomerForOrder(customer);
                            setCustomerSearchTerm(customer.name || customer.phone);
                            setCustomerSearchResults([]);
                          }}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-gray-800">{customer.name || 'مستخدم'}</p>
                            <p className="text-xs text-gray-500">{customer.phone}</p>
                          </div>
                          <UserPlus size={16} className="text-primary-teal" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Customer Card */}
                  {selectedCustomerForOrder && (
                    <div className="mt-2 p-3 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-teal-900">{selectedCustomerForOrder.name || 'مستخدم'}</p>
                          <p className="text-xs text-teal-700">{selectedCustomerForOrder.phone}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerForOrder(null);
                          setCustomerSearchTerm('');
                        }}
                        className="text-teal-600 hover:text-teal-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Service Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">نوع الخدمة</label>
                    <select
                      required
                      value={newOrderData.serviceId}
                      onChange={(e) => setNewOrderData({ ...newOrderData, serviceId: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                    >
                      <option value="">اختر الخدمة...</option>
                      {services.map(service => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">السعر (ر.س)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={newOrderData.price}
                      onChange={(e) => setNewOrderData({ ...newOrderData, price: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">الموقع</label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="أدخل الموقع يدوياً..."
                      value={newOrderData.location}
                      onChange={(e) => setNewOrderData({ ...newOrderData, location: e.target.value })}
                      className="w-full pr-10 pl-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">ملاحظات إضافية (اختياري)</label>
                  <textarea
                    placeholder="أي تفاصيل أخرى..."
                    value={newOrderData.notes}
                    onChange={(e) => setNewOrderData({ ...newOrderData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all h-24 resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary-teal text-white rounded-xl font-bold hover:bg-teal-600 transition-all shadow-lg shadow-teal-100"
                  >
                    إنشاء الطلب
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Order Modal */}
      {
        isEditModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">تعديل الطلب #{editingOrder?.id?.substring(0, 8)}</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateOrder} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">اسم الخدمة</label>
                    <input
                      type="text"
                      required
                      value={editOrderData.serviceName}
                      onChange={(e) => setEditOrderData({ ...editOrderData, serviceName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">السعر (ر.س)</label>
                    <input
                      type="number"
                      required
                      value={editOrderData.price}
                      onChange={(e) => setEditOrderData({ ...editOrderData, price: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">الموقع</label>
                  <input
                    type="text"
                    required
                    value={editOrderData.location}
                    onChange={(e) => setEditOrderData({ ...editOrderData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">الحالة</label>
                  <select
                    value={editOrderData.status}
                    onChange={(e) => setEditOrderData({ ...editOrderData, status: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                  >
                    <option value="searching">جاري البحث</option>
                    <option value="assigned">تم التعيين</option>
                    <option value="en_route">في الطريق</option>
                    <option value="arrived">وصل</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="completed">مكتمل</option>
                    <option value="canceled_by_client">ملغي من العميل</option>
                    <option value="canceled_by_provider">ملغي من المزود</option>
                    <option value="canceled_by_client_with_reason">ملغي من العميل (بسبب)</option>
                    <option value="canceled_by_provider_with_reason">ملغي من المزود (بسبب)</option>
                  </select>
                </div>

                {editOrderData.status.includes('canceled') && (
                  <div className="space-y-2 animate-fadeIn">
                    <label className="block text-sm font-semibold text-red-700 font-bold">سبب الإلغاء</label>
                    <textarea
                      required
                      placeholder="اكتب سبب الإلغاء بالتفصيل..."
                      value={editOrderData.cancelReason}
                      onChange={(e) => setEditOrderData({ ...editOrderData, cancelReason: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-red-100 rounded-xl focus:border-red-400 outline-none transition-all h-24 resize-none"
                    ></textarea>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
                  >
                    حفظ التغييرات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

