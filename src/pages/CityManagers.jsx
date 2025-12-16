import { useEffect, useState } from 'react';
import { Search, Users as UsersIcon, MapPin, Phone, Mail, Calendar, CheckCircle, XCircle, Star, TrendingUp, Eye, Edit2 } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const CityManagers = () => {
  const [managersList, setManagersList] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterData();
  }, [managersList, cities, searchTerm, statusFilter]);

  const fetchData = async () => {
    try {
      // Fetch all cities to get manager assignments
      const citiesRef = collection(db, 'cities');
      const citiesSnapshot = await getDocs(citiesRef);
      const citiesList = [];
      citiesSnapshot.forEach((doc) => {
        citiesList.push({ id: doc.id, ...doc.data() });
      });
      setCities(citiesList);

      // Fetch all users who are city managers
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'cityManager'), orderBy('createdAt', 'desc'));
      const usersSnapshot = await getDocs(q);
      const managersData = [];
      usersSnapshot.forEach((doc) => {
        managersData.push({ id: doc.id, ...doc.data() });
      });
      setManagersList(managersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    // This is handled in the render function
  };

  const getManagerStats = (managerId) => {
    const managerCities = cities.filter(city => city.managerId === managerId);
    return {
      citiesCount: managerCities.length,
      activeCities: managerCities.filter(city => city.isActive !== false).length,
      totalProviders: managerCities.reduce((sum, city) => sum + (city.providersCount || 0), 0),
      totalOrders: managerCities.reduce((sum, city) => sum + (city.ordersCount || 0), 0)
    };
  };

  const toggleManagerStatus = async (managerId, isActive) => {
    try {
      const managerRef = doc(db, 'users', managerId);
      await updateDoc(managerRef, { 
        isActive,
        updatedAt: new Date().toISOString()
      });
      setManagersList(managersList.map(m => m.id === managerId ? { ...m, isActive, updatedAt: new Date().toISOString() } : m));
    } catch (error) {
      console.error('Error updating manager status:', error);
      alert('فشل تحديث حالة مدير المدينة');
    }
  };

  const getStatusBadge = (isActive) => {
    return isActive !== false 
      ? { text: 'نشط', color: 'bg-green-100 text-green-700' }
      : { text: 'معطل', color: 'bg-red-100 text-red-700' };
  };

  const getPerformanceBadge = (performance) => {
    if (performance >= 4.5) return { text: 'مميز', color: 'bg-purple-100 text-purple-700' };
    if (performance >= 3.5) return { text: 'جيد', color: 'bg-blue-100 text-blue-700' };
    if (performance >= 2.5) return { text: 'متوسط', color: 'bg-yellow-100 text-yellow-700' };
    return { text: 'ضعيف', color: 'bg-red-100 text-red-700' };
  };

  const filteredManagers = managersList.filter(manager => {
    const matchesSearch = 
      manager.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && manager.isActive !== false) ||
      (statusFilter === 'inactive' && manager.isActive === false);
    
    return matchesSearch && matchesStatus;
  });

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
        <h1 className="text-3xl font-black text-gray-800 mb-2">بيانات مديري المدن</h1>
        <p className="text-gray-600">عرض وإدارة بيانات وأداء مديري المدن</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-blue-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي المديرين</span>
          </div>
          <p className="text-3xl font-black text-gray-800">{managersList.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-green-500" size={24} />
            <span className="text-sm text-gray-600">مديرين نشطون</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {managersList.filter(m => m.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="text-purple-500" size={24} />
            <span className="text-sm text-gray-600">مدن تحت الإدارة</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {cities.filter(city => city.managerId).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Star className="text-yellow-500" size={24} />
            <span className="text-sm text-gray-600">متوسط التقييم</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {managersList.length > 0 
              ? (managersList.reduce((sum, m) => sum + (m.rating || 0), 0) / managersList.length).toFixed(1)
              : 0}
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
              placeholder="ابحث عن مدير مدينة..."
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
            <option value="inactive">معطل</option>
          </select>
        </div>
      </div>

      {/* Managers List */}
      <div className="space-y-4">
        {filteredManagers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد نتائج</p>
          </div>
        ) : (
          filteredManagers.map((manager) => {
            const stats = getManagerStats(manager.id);
            const statusBadge = getStatusBadge(manager.isActive);
            const performanceBadge = getPerformanceBadge(manager.rating || 0);
            const managerCities = cities.filter(city => city.managerId === manager.id);

            return (
              <div
                key={manager.id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 rounded-full">
                      <UsersIcon className="text-white" size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{manager.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}>
                          {statusBadge.text}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${performanceBadge.color}`}>
                          {performanceBadge.text}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {manager.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={16} />
                            <span>{manager.email}</span>
                          </div>
                        )}
                        {manager.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={16} />
                            <span>{manager.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span>
                            {manager.createdAt
                              ? (() => {
                                  const date = new Date(manager.createdAt);
                                  return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                })()
                              : '-'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Cities Managed */}
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">المدن تحت الإدارة:</p>
                        <div className="flex flex-wrap gap-2">
                          {managerCities.length > 0 ? (
                            managerCities.map((city) => (
                              <span
                                key={city.id}
                                className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium"
                              >
                                📍 {city.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">لا توجد مدن مخصصة</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-left ml-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">{stats.citiesCount}</p>
                        <p className="text-xs text-gray-600">مدن</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">{stats.totalProviders}</p>
                        <p className="text-xs text-gray-600">مزود</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">{stats.totalOrders}</p>
                        <p className="text-xs text-gray-600">طلبات</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-800">{manager.rating || 0}</p>
                        <p className="text-xs text-gray-600">تقييم</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedManager(manager)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-sm font-semibold"
                      >
                        <Eye size={16} />
                        التفاصيل
                      </button>
                      <button
                        onClick={() => toggleManagerStatus(manager.id, manager.isActive === false)}
                        className={`px-4 py-2 rounded-lg transition-all text-sm font-semibold ${
                          manager.isActive !== false
                            ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {manager.isActive !== false ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manager Details Modal */}
      {selectedManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">تفاصيل مدير المدينة</h2>
                <button
                  onClick={() => setSelectedManager(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">الاسم</h3>
                  <p className="text-gray-800">{selectedManager.name}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">البريد الإلكتروني</h3>
                  <p className="text-gray-800">{selectedManager.email}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">رقم الهاتف</h3>
                  <p className="text-gray-800">{selectedManager.phone}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">الحالة</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(selectedManager.isActive).color}`}>
                    {getStatusBadge(selectedManager.isActive).text}
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">المدن تحت الإدارة</h3>
                <div className="space-y-2">
                  {cities.filter(city => city.managerId === selectedManager.id).length > 0 ? (
                    cities.filter(city => city.managerId === selectedManager.id).map((city) => (
                      <div key={city.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{city.name}</p>
                            <p className="text-sm text-gray-600">نطاق الخدمة: {city.serviceRadius || 50} كم</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            city.isActive !== false 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {city.isActive !== false ? 'نشط' : 'معطل'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">لا توجد مدن مخصصة لهذا المدير</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الإحصائيات</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-800">
                      {cities.filter(city => city.managerId === selectedManager.id).length}
                    </p>
                    <p className="text-sm text-gray-600">مدن</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-800">
                      {cities.filter(city => city.managerId === selectedManager.id)
                        .reduce((sum, city) => sum + (city.providersCount || 0), 0)}
                    </p>
                    <p className="text-sm text-gray-600">مزود</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-800">
                      {cities.filter(city => city.managerId === selectedManager.id)
                        .reduce((sum, city) => sum + (city.ordersCount || 0), 0)}
                    </p>
                    <p className="text-sm text-gray-600">طلبات</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-800">{selectedManager.rating || 0}</p>
                    <p className="text-sm text-gray-600">تقييم</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">تاريخ الانضمام</h3>
                <p className="text-gray-800">
                  {selectedManager.createdAt
                    ? (() => {
                        const date = new Date(selectedManager.createdAt);
                        return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                      })()
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
