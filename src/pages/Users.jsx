import { useEffect, useState } from 'react';
import { Search, Users as UsersIcon, Mail, Phone, Calendar, MapPin, Filter, Loader2, UserCheck } from 'lucide-react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';


export const Users = () => {
  const [usersList, setUsersList] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [usersList, searchTerm, statusFilter]);

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
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.phone?.includes(searchTerm)
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
        <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة المستخدمين</h1>
        <p className="text-gray-600">عرض ومتابعة جميع المستخدمين المسجلين</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-blue-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي المستخدمين</span>
          </div>
          <p className="text-3xl font-black text-gray-800">{usersList.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-green-500" size={24} />
            <span className="text-sm text-gray-600">نشطون</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {usersList.filter((u) => u.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-gray-500" size={24} />
            <span className="text-sm text-gray-600">غير نشطون</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {usersList.filter((u) => u.status === 'inactive').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-red-500" size={24} />
            <span className="text-sm text-gray-600">محظورون</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {usersList.filter((u) => u.status === 'banned').length}
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
              placeholder="ابحث عن مستخدم..."
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
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 rounded-full">
                      <UsersIcon className="text-white" size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{user.name || 'غير محدد'}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}
                        >
                          {statusBadge.text}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {user.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={16} />
                            <span>{user.email}</span>
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={16} />
                            <span>{user.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
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
                  <div className="text-left ml-4">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-sm font-semibold"
                    >
                      <Filter size={16} />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">تفاصيل المستخدم</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الاسم</h3>
                <p className="text-gray-800">{selectedUser.name || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">البريد الإلكتروني</h3>
                <p className="text-gray-800">{selectedUser.email || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">رقم الهاتف</h3>
                <p className="text-gray-800">{selectedUser.phone || 'غير محدد'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الحالة</h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    getStatusBadge(selectedUser.status).color
                  }`}
                >
                  {getStatusBadge(selectedUser.status).text}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">تاريخ التسجيل</h3>
                <p className="text-gray-800">
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
                  <h3 className="font-semibold text-gray-700 mb-2">الموقع</h3>
                  <p className="text-gray-800">{selectedUser.location}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
