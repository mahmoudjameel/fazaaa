import { useEffect, useState } from 'react';
import { Search, Eye, MapPin, Clock, DollarSign, Star, AlertCircle, XCircle } from 'lucide-react';
import { listenToAllRequests } from '../services/adminService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    // استخدام real-time listener بدلاً من fetch
    const unsubscribe = listenToAllRequests((requests) => {
      setOrders(requests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter]);

  const filterOrders = () => {
    let filtered = orders;

    if (statusFilter !== 'all') {
      if (statusFilter === 'no_providers_timeout') {
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
        filtered = filtered.filter((o) => o.status === statusFilter);
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (o) =>
          o.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.providerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
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
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة الطلبات</h1>
        <p className="text-gray-600">عرض ومتابعة جميع الطلبات</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-yellow-500" size={24} />
            <span className="text-sm text-gray-600">قيد التنفيذ</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {orders.filter((o) => ['searching', 'assigned', 'en_route', 'arrived', 'in_progress'].includes(o.status)).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-green-500" size={24} />
            <span className="text-sm text-gray-600">مكتملة</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {orders.filter((o) => o.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="text-blue-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي الطلبات</span>
          </div>
          <p className="text-3xl font-black text-gray-800">{orders.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-teal-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي الإيرادات</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {orders
              .filter((o) => o.status === 'completed')
              .reduce((sum, o) => sum + (o.price || 0), 0)
              .toLocaleString()}{' '}
            ر.س
          </p>
        </div>
      </div>

      {/* No Providers / Timeout - Alert Section */}
      {(() => {
        const noProvidersTimeoutOrders = orders.filter(o => {
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
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <XCircle className="text-purple-600" size={24} />
                  <div>
                    <h3 className="text-lg font-bold text-purple-800">عدم وجود مزودين وانتهاء المهلة المحددة</h3>
                    <p className="text-sm text-purple-600">طلبات تم إلغاؤها بسبب عدم وجود مزودين أو انتهاء وقت البحث</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white px-4 py-2 rounded-full text-lg font-bold">
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
                          onClick={() => setSelectedOrder(order)}
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
        const providerRejectionsAfterAccept = orders.filter(
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
        
        const clientRejectionsAfterAccept = orders.filter(
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
                                المزود: <span className="font-semibold">{order.providerName || 'غير محدد'}</span>
                              </p>
                              <p className="text-xs text-red-700 font-semibold mt-2">
                                ⚠️ السبب: {reason}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedOrder(order)}
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
                                المزود: <span className="font-semibold">{order.providerName || 'غير محدد'}</span>
                              </p>
                              <p className="text-xs text-orange-700 font-semibold mt-2">
                                ⚠️ السبب: {reason}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedOrder(order)}
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
              placeholder="ابحث عن طلب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
          >
            <option value="all">جميع الحالات</option>
            <option value="searching">جاري البحث</option>
            <option value="assigned">مقبول</option>
            <option value="en_route">في الطريق</option>
            <option value="arrived">وصل</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="completed">مكتمل</option>
            <option value="canceled_by_client">ملغي من العميل</option>
            <option value="canceled_by_provider">ملغي من المزود</option>
            <option value="canceled_by_provider_with_reason">ملغي من المزود (بسبب)</option>
            <option value="no_providers_timeout">عدم وجود مزودين وانتهاء المهلة</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد طلبات</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
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
                          <div className="text-xs text-teal-600 font-semibold">
                            مزود: {order.providerName}
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
                    </div>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all text-sm font-semibold"
                    >
                      <Eye size={16} />
                      التفاصيل
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">تفاصيل الطلب</h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">نوع الخدمة</h3>
                <p className="text-gray-800">{selectedOrder.serviceType}</p>
              </div>
              {selectedOrder.serviceOption && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">الخدمة المحددة</h3>
                  <p className="text-gray-800">{selectedOrder.serviceOption}</p>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الموقع</h3>
                <p className="text-gray-800">{selectedOrder.location || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الحالة</h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(selectedOrder.status).color
                    }`}
                >
                  {getStatusBadge(selectedOrder.status).text}
                </span>
                {/* Provider Cancellation */}
                {(selectedOrder.status === 'canceled_by_provider' || selectedOrder.status === 'canceled_by_provider_with_reason') && (
                  (() => {
                    const cancelEvent = Array.isArray(selectedOrder.history) 
                      ? selectedOrder.history.find(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                      : null;
                    const reason = selectedOrder.cancelReason || cancelEvent?.cancelReason;
                    const wasAccepted = selectedOrder.assignedAt || (Array.isArray(selectedOrder.history) && selectedOrder.history.some(h => h.status === 'assigned'));
                    
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
                          {selectedOrder.cancelledBy && (
                            <p className="text-xs text-red-600 mt-2">
                              معرف المزود: {selectedOrder.cancelledBy}
                            </p>
                          )}
                          {selectedOrder.cancelledAt && (
                            <p className="text-xs text-red-600 mt-1">
                              وقت الإلغاء: {(() => {
                                const date = selectedOrder.cancelledAt?.toMillis 
                                  ? new Date(selectedOrder.cancelledAt.toMillis())
                                  : new Date(selectedOrder.cancelledAt);
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
                {(selectedOrder.status === 'canceled_by_client' || selectedOrder.status === 'canceled_by_client_with_reason') && (
                  (() => {
                    const cancelEvent = Array.isArray(selectedOrder.history) 
                      ? selectedOrder.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                      : null;
                    const reason = selectedOrder.cancelReason || cancelEvent?.cancelReason;
                    const wasAccepted = selectedOrder.assignedAt || (Array.isArray(selectedOrder.history) && selectedOrder.history.some(h => h.status === 'assigned'));
                    
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
                          {selectedOrder.cancelledBy && (
                            <p className="text-xs text-orange-600 mt-2">
                              معرف العميل: {selectedOrder.cancelledBy}
                            </p>
                          )}
                          {selectedOrder.cancelledAt && (
                            <p className="text-xs text-orange-600 mt-1">
                              وقت الإلغاء: {(() => {
                                const date = selectedOrder.cancelledAt?.toMillis 
                                  ? new Date(selectedOrder.cancelledAt.toMillis())
                                  : new Date(selectedOrder.cancelledAt);
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
                            {selectedOrder.cancelledAt && (
                              <p className={`text-xs ${reasonTextColor} mt-2`}>
                                وقت الإلغاء: {(() => {
                                  const date = selectedOrder.cancelledAt?.toMillis 
                                    ? new Date(selectedOrder.cancelledAt.toMillis())
                                    : new Date(selectedOrder.cancelledAt);
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
                <h3 className="font-semibold text-gray-700 mb-2">السعر</h3>
                <p className="text-2xl font-black text-green-600">
                  {selectedOrder.servicePrice || selectedOrder.price || 0} ر.س
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">تاريخ الإنشاء</h3>
                <p className="text-gray-800">
                  {(() => {
                    if (!selectedOrder.createdAt) return '-';
                    
                    // التعامل مع Firebase Timestamp
                    let date;
                    if (selectedOrder.createdAt?.toMillis) {
                      date = new Date(selectedOrder.createdAt.toMillis());
                    } else if (selectedOrder.createdAt?.toDate) {
                      date = selectedOrder.createdAt.toDate();
                    } else if (selectedOrder.createdAt?.seconds) {
                      date = new Date(selectedOrder.createdAt.seconds * 1000);
                    } else {
                      date = new Date(selectedOrder.createdAt);
                    }
                    
                    return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                  })()}
                </p>
              </div>

              {/* Rating Section */}
              {selectedOrder.rated && (
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
                        className={`${i < selectedOrder.rating
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                          }`}
                      />
                    ))}
                    <span className="mr-2 font-bold text-gray-700">
                      ({selectedOrder.rating}/5)
                    </span>
                  </div>
                  {selectedOrder.ratingComment && (
                    <p className="text-gray-600 text-sm bg-white p-3 rounded-lg border border-yellow-100 italic">
                      "{selectedOrder.ratingComment}"
                    </p>
                  )}
                </div>
              )}

              {/* Car Plate Image */}
              {selectedOrder.carPlateImage && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">صورة لوحة السيارة</h3>
                  <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-teal-400 transition-all">
                    <img
                      src={selectedOrder.carPlateImage}
                      alt="لوحة السيارة"
                      className="w-full h-auto object-cover cursor-pointer"
                      onClick={() => window.open(selectedOrder.carPlateImage, '_blank')}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                      <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                    </div>
                  </div>
                  {selectedOrder.carPlateImageTimestamp && (
                    <p className="text-xs text-gray-500 mt-2">
                      تم الرفع: {format(new Date(selectedOrder.carPlateImageTimestamp), 'dd MMM yyyy, HH:mm', { locale: ar })}
                    </p>
                  )}
                </div>
              )}

              {/* Service Documentation Images (Before/After) */}
              {(selectedOrder.serviceDocumentationBefore || selectedOrder.serviceDocumentationAfter) && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">صور توثيق الخدمة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before Image */}
                    {selectedOrder.serviceDocumentationBefore && (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">قبل الخدمة</span>
                        </div>
                        <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-orange-400 transition-all">
                          <img
                            src={selectedOrder.serviceDocumentationBefore}
                            alt="قبل الخدمة"
                            className="w-full h-48 object-cover cursor-pointer"
                            onClick={() => window.open(selectedOrder.serviceDocumentationBefore, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                          </div>
                        </div>
                        {selectedOrder.serviceDocumentationBeforeTimestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(selectedOrder.serviceDocumentationBeforeTimestamp), 'HH:mm', { locale: ar })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* After Image */}
                    {selectedOrder.serviceDocumentationAfter && (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">بعد الخدمة</span>
                        </div>
                        <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-green-400 transition-all">
                          <img
                            src={selectedOrder.serviceDocumentationAfter}
                            alt="بعد الخدمة"
                            className="w-full h-48 object-cover cursor-pointer"
                            onClick={() => window.open(selectedOrder.serviceDocumentationAfter, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                          </div>
                        </div>
                        {selectedOrder.serviceDocumentationAfterTimestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(selectedOrder.serviceDocumentationAfterTimestamp), 'HH:mm', { locale: ar })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Images Message */}
              {!selectedOrder.carPlateImage && !selectedOrder.serviceDocumentationBefore && !selectedOrder.serviceDocumentationAfter && (
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <p className="text-gray-500 text-sm">لا توجد صور توثيق لهذا الطلب</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

