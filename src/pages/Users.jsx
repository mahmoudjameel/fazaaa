import { useEffect, useState } from 'react';
import { Search, Users as UsersIcon, Mail, Phone, Calendar, MapPin, Filter, Loader2, UserCheck, Package, Clock, AlertCircle, CheckCircle, XCircle, Plus } from 'lucide-react';
import { collection, getDocs, query, orderBy, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';


export const Users = () => {
  const [usersList, setUsersList] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [isAddingUser, setIsAddingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [usersList, searchTerm, statusFilter]);

  // جلب طلبات المستخدم عند فتح Modal
  useEffect(() => {
    const fetchUserOrders = async () => {
      if (!selectedUser) {
        setUserOrders([]);
        return;
      }

      const userId = selectedUser.id || selectedUser.uid;
      if (!userId) {
        setUserOrders([]);
        return;
      }

      setLoadingOrders(true);
      try {
        const requestsRef = collection(db, 'requests');
        const q = query(
          requestsRef,
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const ordersList = [];
        querySnapshot.forEach((doc) => {
          ordersList.push({ id: doc.id, ...doc.data() });
        });
        setUserOrders(ordersList);
      } catch (error) {
        console.error('Error fetching user orders:', error);
        // إذا فشل مع userId، جرب customerId
        try {
          const requestsRef = collection(db, 'requests');
          const q = query(
            requestsRef,
            where('customerId', '==', userId),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const ordersList = [];
          querySnapshot.forEach((doc) => {
            ordersList.push({ id: doc.id, ...doc.data() });
          });
          setUserOrders(ordersList);
        } catch (error2) {
          console.error('Error fetching user orders with customerId:', error2);
          setUserOrders([]);
        }
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchUserOrders();
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const usersData = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsersList(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = usersList;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.phone?.includes(searchTerm) ||
          u.firstName?.toLowerCase().includes(searchLower) ||
          u.lastName?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredUsers(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { text: 'نشط', color: 'bg-green-100 text-green-700' },
      inactive: { text: 'غير نشط', color: 'bg-gray-100 text-gray-700' },
      banned: { text: 'محظور', color: 'bg-red-100 text-red-700' },
    };
    return badges[status] || { text: status, color: 'bg-blue-100 text-blue-700' };
  };

  const getOrderStatusBadge = (status) => {
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
      canceled_by_client_with_reason: { text: 'ملغي من العميل', color: 'bg-red-100 text-red-700' },
      canceled_by_provider_with_reason: { text: 'ملغي من المزود', color: 'bg-red-100 text-red-700' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsAddingUser(true);

    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        userFormData.email,
        userFormData.password
      );
      const user = userCredential.user;

      // 2. Create User Document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        status: 'active',
        createdAt: serverTimestamp(),
        role: 'user',
        uid: user.uid
      });

      alert('تم إضافة المستخدم بنجاح');
      fetchUsers();
      setIsAddUserModalOpen(false);
      setUserFormData({
        name: '',
        email: '',
        phone: '',
        password: ''
      });
    } catch (error) {
      console.error('Error adding user:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('البريد الإلكتروني مستخدم بالفعل');
      } else {
        alert('حدث خطأ أثناء إضافة المستخدم: ' + error.message);
      }
    } finally {
      setIsAddingUser(false);
    }
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
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mb-1 sm:mb-2">إدارة المستخدمين</h1>
          <p className="text-sm sm:text-base text-gray-600">عرض ومتابعة جميع المستخدمين المسجلين</p>
        </div>
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-all font-bold shadow-lg"
        >
          <Plus size={20} />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">إجمالي المستخدمين</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">{usersList.length}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-green-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">نشطون</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {usersList.filter((u) => u.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-gray-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">غير نشطون</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {usersList.filter((u) => u.status === 'inactive').length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-red-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">محظورون</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {usersList.filter((u) => u.status === 'banned').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="ابحث بالاسم، البريد الإلكتروني، أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 sm:pr-10 pl-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm sm:text-base"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm sm:text-base"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
            <option value="banned">محظور</option>
          </select>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد مستخدمين</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const statusBadge = getStatusBadge(user.status);
            return (
              <div
                key={user.id}
                className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 sm:p-3 rounded-full flex-shrink-0">
                      <UsersIcon className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate">{user.name || 'غير محدد'}</h3>
                        <span
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color} whitespace-nowrap`}
                        >
                          {statusBadge.text}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                        {user.email && (
                          <div className="flex items-center gap-2 truncate">
                            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>
                            {user.createdAt
                              ? (() => {
                                const date = new Date(user.createdAt);
                                return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                              })()
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right sm:ml-4">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-xs sm:text-sm font-semibold w-full sm:w-auto"
                    >
                      <Filter className="w-4 h-4" />
                      التفاصيل
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">تفاصيل المستخدم</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الاسم</h3>
                <p className="text-sm sm:text-base text-gray-800">{selectedUser.name || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">البريد الإلكتروني</h3>
                <p className="text-sm sm:text-base text-gray-800 break-all">{selectedUser.email || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">رقم الهاتف</h3>
                <p className="text-sm sm:text-base text-gray-800">{selectedUser.phone || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الحالة</h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${getStatusBadge(selectedUser.status).color
                    }`}
                >
                  {getStatusBadge(selectedUser.status).text}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">تاريخ التسجيل</h3>
                <p className="text-sm sm:text-base text-gray-800">
                  {selectedUser.createdAt
                    ? (() => {
                      const date = new Date(selectedUser.createdAt);
                      return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                    })()
                    : '-'}
                </p>
              </div>
              {selectedUser.location && (
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الموقع</h3>
                  <p className="text-sm sm:text-base text-gray-800">{selectedUser.location}</p>
                </div>
              )}

              {/* قائمة الطلبات */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-base sm:text-lg text-gray-700">طلبات المستخدم</h3>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">
                    {userOrders.length}
                  </span>
                </div>

                {loadingOrders ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">جاري تحميل الطلبات...</p>
                  </div>
                ) : userOrders.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">لا توجد طلبات لهذا المستخدم</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {userOrders.map((order) => {
                      const orderStatusBadge = getOrderStatusBadge(order.status);
                      const isCanceled = order.status?.includes('canceled');
                      const cancelReason = order.cancelReason ||
                        (Array.isArray(order.history)
                          ? order.history.find(h => h.cancelReason)?.cancelReason
                          : null);

                      // تحديد تاريخ الإنشاء
                      let createdAt = null;
                      if (order.createdAt) {
                        if (order.createdAt?.toMillis) {
                          createdAt = new Date(order.createdAt.toMillis());
                        } else if (order.createdAt?.toDate) {
                          createdAt = order.createdAt.toDate();
                        } else if (order.createdAt?.seconds) {
                          createdAt = new Date(order.createdAt.seconds * 1000);
                        } else {
                          createdAt = new Date(order.createdAt);
                        }
                      }

                      // تحديد تاريخ الإلغاء إن وجد
                      let canceledAt = null;
                      if (order.cancelledAt) {
                        if (order.cancelledAt?.toMillis) {
                          canceledAt = new Date(order.cancelledAt.toMillis());
                        } else if (order.cancelledAt?.toDate) {
                          canceledAt = order.cancelledAt.toDate();
                        } else if (order.cancelledAt?.seconds) {
                          canceledAt = new Date(order.cancelledAt.seconds * 1000);
                        } else {
                          canceledAt = new Date(order.cancelledAt);
                        }
                      }

                      return (
                        <div
                          key={order.id}
                          className={`bg-white rounded-lg p-4 border ${isCanceled
                            ? 'border-red-200 bg-red-50'
                            : order.status === 'completed'
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Package className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                <h4 className="font-semibold text-sm text-gray-800 truncate">
                                  {order.serviceName || order.serviceType || 'خدمة'}
                                </h4>
                              </div>
                              {order.location && (
                                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{order.location}</span>
                                </div>
                              )}
                              {createdAt && !isNaN(createdAt.getTime()) && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>تاريخ الطلب: {format(createdAt, 'dd MMM yyyy, HH:mm', { locale: ar })}</span>
                                </div>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${orderStatusBadge.color}`}>
                              {orderStatusBadge.text}
                            </span>
                          </div>

                          {/* تفاصيل الإلغاء */}
                          {isCanceled && (
                            <div className="mt-3 pt-3 border-t border-red-200">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-red-800 mb-1">تفاصيل الإلغاء:</p>
                                  {cancelReason && (
                                    <p className="text-xs text-red-700 mb-1">
                                      <span className="font-semibold">السبب:</span> {cancelReason}
                                    </p>
                                  )}
                                  {canceledAt && !isNaN(canceledAt.getTime()) && (
                                    <p className="text-xs text-red-600">
                                      <span className="font-semibold">تاريخ الإلغاء:</span> {format(canceledAt, 'dd MMM yyyy, HH:mm', { locale: ar })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* معلومات إضافية */}
                          {order.price && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs text-gray-600">
                                <span className="font-semibold">السعر:</span> {order.price} ر.س
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">إضافة مستخدم جديد</h2>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <XCircle size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
                    placeholder="اسم المستخدم"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
                    placeholder="05XXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
                  placeholder="******"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-bold hover:bg-teal-600 transition-colors disabled:opacity-50"
                >
                  {isAddingUser ? 'جاري الإضافة...' : 'حفظ المستخدم'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
