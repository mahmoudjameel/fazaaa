import { useEffect, useState } from 'react';
import { Search, Eye, MapPin, Clock, DollarSign, Star } from 'lucide-react';
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
      filtered = filtered.filter((o) => o.status === statusFilter);
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
                            {order.createdAt
                              ? (() => {
                                const date = new Date(order.createdAt);
                                return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                              })()
                              : '-'}
                          </span>
                        </div>
                        {order.providerName && (
                          <div className="text-xs text-teal-600 font-semibold">
                            مزود: {order.providerName}
                          </div>
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
                  {selectedOrder.createdAt
                    ? (() => {
                      const date = new Date(selectedOrder.createdAt);
                      return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                    })()
                    : '-'}
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

