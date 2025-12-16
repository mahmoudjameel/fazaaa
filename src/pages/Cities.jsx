import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, MapPin, Users as UsersIcon, CheckCircle, XCircle, Settings } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Cities = () => {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    isActive: true,
    coordinates: { lat: '', lng: '' },
    managerId: '',
    managerName: '',
    managerPhone: '',
    serviceRadius: 50,
    priority: 'medium'
  });

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const citiesRef = collection(db, 'cities');
      const querySnapshot = await getDocs(citiesRef);
      const citiesList = [];
      querySnapshot.forEach((doc) => {
        citiesList.push({ id: doc.id, ...doc.data() });
      });
      setCities(citiesList);
    } catch (error) {
      console.error('Error fetching cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCities = cities.filter(city =>
    city.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    city.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    city.managerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cityData = {
        ...formData,
        coordinates: {
          lat: parseFloat(formData.coordinates.lat),
          lng: parseFloat(formData.coordinates.lng)
        },
        serviceRadius: parseInt(formData.serviceRadius),
        updatedAt: new Date().toISOString()
      };

      if (selectedCity) {
        // Update existing city
        const cityRef = doc(db, 'cities', selectedCity.id);
        await updateDoc(cityRef, cityData);
        setCities(cities.map(c => c.id === selectedCity.id ? { ...c, ...cityData } : c));
      } else {
        // Add new city
        const citiesRef = collection(db, 'cities');
        const docRef = await addDoc(citiesRef, {
          ...cityData,
          createdAt: new Date().toISOString()
        });
        setCities([...cities, { id: docRef.id, ...cityData, createdAt: new Date().toISOString() }]);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving city:', error);
    }
  };

  const handleDelete = async (cityId) => {
    if (confirm('هل أنت متأكد من حذف هذه المدينة؟')) {
      try {
        await deleteDoc(doc(db, 'cities', cityId));
        setCities(cities.filter(c => c.id !== cityId));
      } catch (error) {
        console.error('Error deleting city:', error);
      }
    }
  };

  const toggleCityStatus = async (cityId, isActive) => {
    try {
      const cityRef = doc(db, 'cities', cityId);
      await updateDoc(cityRef, { 
        isActive,
        updatedAt: new Date().toISOString()
      });
      setCities(cities.map(c => c.id === cityId ? { ...c, isActive, updatedAt: new Date().toISOString() } : c));
    } catch (error) {
      console.error('Error updating city status:', error);
    }
  };

  const openEditModal = (city) => {
    setSelectedCity(city);
    setFormData({
      name: city.name || '',
      nameEn: city.nameEn || '',
      isActive: city.isActive !== false,
      coordinates: { 
        lat: city.coordinates?.lat || '', 
        lng: city.coordinates?.lng || '' 
      },
      managerId: city.managerId || '',
      managerName: city.managerName || '',
      managerPhone: city.managerPhone || '',
      serviceRadius: city.serviceRadius || 50,
      priority: city.priority || 'medium'
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setSelectedCity(null);
    setFormData({
      name: '',
      nameEn: '',
      isActive: true,
      coordinates: { lat: '', lng: '' },
      managerId: '',
      managerName: '',
      managerPhone: '',
      serviceRadius: 50,
      priority: 'medium'
    });
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: { text: 'منخفض', color: 'bg-gray-100 text-gray-700' },
      medium: { text: 'متوسط', color: 'bg-yellow-100 text-yellow-700' },
      high: { text: 'مرتفع', color: 'bg-red-100 text-red-700' },
    };
    return badges[priority] || badges.medium;
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة المدن</h1>
          <p className="text-gray-600">إضافة وتعديل المدن وتعيين مديري المدن</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
        >
          <Plus size={20} />
          إضافة مدينة جديدة
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="text-blue-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي المدن</span>
          </div>
          <p className="text-3xl font-black text-gray-800">{cities.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-green-500" size={24} />
            <span className="text-sm text-gray-600">مدن نشطة</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {cities.filter(c => c.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="text-purple-500" size={24} />
            <span className="text-sm text-gray-600">مديرو المدن</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {cities.filter(c => c.managerId).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Settings className="text-orange-500" size={24} />
            <span className="text-sm text-gray-600">متوسط نطاق الخدمة</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {cities.length > 0 
              ? (cities.reduce((sum, c) => sum + (c.serviceRadius || 0), 0) / cities.length).toFixed(1)
              : 0} كم
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن مدينة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Cities List */}
      <div className="space-y-4">
        {filteredCities.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد مدن</p>
          </div>
        ) : (
          filteredCities.map((city) => {
            const priorityBadge = getPriorityBadge(city.priority);
            return (
              <div
                key={city.id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 rounded-full">
                      <MapPin className="text-white" size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{city.name}</h3>
                        <span className="text-sm text-gray-500">({city.nameEn})</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityBadge.color}`}>
                          {priorityBadge.text}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          city.isActive !== false 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {city.isActive !== false ? 'نشط' : 'معطل'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {city.managerName && (
                          <div className="flex items-center gap-2">
                            <UsersIcon size={16} />
                            <span>مدير المدينة: {city.managerName}</span>
                            {city.managerPhone && <span> - {city.managerPhone}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin size={16} />
                          <span>نطاق الخدمة: {city.serviceRadius || 50} كم</span>
                        </div>
                        {city.coordinates && (
                          <div className="flex items-center gap-2">
                            <MapPin size={16} />
                            <span>الإحداثيات: {city.coordinates.lat}, {city.coordinates.lng}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(city)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => toggleCityStatus(city.id, city.isActive === false)}
                      className={`p-2 rounded-lg transition-all ${
                        city.isActive !== false
                          ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {city.isActive !== false ? '⏸️' : '▶️'}
                    </button>
                    <button
                      onClick={() => handleDelete(city.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedCity ? 'تعديل المدينة' : 'إضافة مدينة جديدة'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المدينة (عربي)</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                    placeholder="أدخل اسم المدينة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المدينة (إنجليزي)</label>
                  <input
                    type="text"
                    required
                    value={formData.nameEn}
                    onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                    placeholder="Enter city name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">خط العرض</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.coordinates.lat}
                    onChange={(e) => setFormData({...formData, coordinates: {...formData.coordinates, lat: e.target.value}})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                    placeholder="24.7136"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">خط الطول</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.coordinates.lng}
                    onChange={(e) => setFormData({...formData, coordinates: {...formData.coordinates, lng: e.target.value}})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                    placeholder="46.6753"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">مدير المدينة</label>
                <input
                  type="text"
                  value={formData.managerName}
                  onChange={(e) => setFormData({...formData, managerName: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                  placeholder="اسم مدير المدينة"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">هاتف مدير المدينة</label>
                <input
                  type="tel"
                  value={formData.managerPhone}
                  onChange={(e) => setFormData({...formData, managerPhone: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                  placeholder="رقم هاتف مدير المدينة"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">نطاق الخدمة (كم)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={formData.serviceRadius}
                    onChange={(e) => setFormData({...formData, serviceRadius: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الأولوية</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="low">منخفض</option>
                    <option value="medium">متوسط</option>
                    <option value="high">مرتفع</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">
                  المدينة نشطة
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  {selectedCity ? 'تحديث المدينة' : 'إضافة المدينة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
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
