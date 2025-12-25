import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, DollarSign, Settings, Package } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';

export const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    basePrice: '',
    description: '',
    isActive: true,
    icon: '',
    imageUrl: '',
    imageFile: null,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const servicesRef = collection(db, 'services');
      const querySnapshot = await getDocs(servicesRef);
      const servicesList = [];
      querySnapshot.forEach((doc) => {
        servicesList.push({ id: doc.id, ...doc.data() });
      });
      setServices(servicesList);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setUploading(true);
      let uploadedImageUrl = formData.imageUrl || selectedService?.imageUrl || '';

      if (formData.imageFile) {
        const file = formData.imageFile;
        const fileRef = ref(storage, `services/${selectedService?.id || Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        uploadedImageUrl = await getDownloadURL(fileRef);
      }

      // إزالة imageFile من الكائن قبل الإرسال
      const { imageFile, ...toFirestore } = formData;
      const serviceData = {
        ...toFirestore,
        imageUrl: uploadedImageUrl,
        basePrice: parseFloat(formData.basePrice) || 0,
        updatedAt: new Date().toISOString()
      };

      if (selectedService) {
        // Update existing service
        const serviceRef = doc(db, 'services', selectedService.id);
        await updateDoc(serviceRef, serviceData);
        setServices(services.map(s => s.id === selectedService.id ? { ...s, ...serviceData } : s));
      } else {
        // Add new service
        const servicesRef = collection(db, 'services');
        const docRef = await addDoc(servicesRef, {
          ...serviceData,
          createdAt: new Date().toISOString()
        });
        setServices([...services, { id: docRef.id, ...serviceData, createdAt: new Date().toISOString() }]);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving service:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (serviceId) => {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
      try {
        await deleteDoc(doc(db, 'services', serviceId));
        setServices(services.filter(s => s.id !== serviceId));
      } catch (error) {
        console.error('Error deleting service:', error);
      }
    }
  };

  const toggleServiceStatus = async (serviceId, isActive) => {
    try {
      const serviceRef = doc(db, 'services', serviceId);
      await updateDoc(serviceRef, { 
        isActive,
        updatedAt: new Date().toISOString()
      });
      setServices(services.map(s => s.id === serviceId ? { ...s, isActive, updatedAt: new Date().toISOString() } : s));
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  };

  const openEditModal = (service) => {
    setSelectedService(service);
    setFormData({
      name: service.name || '',
      category: service.category || '',
      basePrice: service.basePrice || '',
      description: service.description || '',
      isActive: service.isActive !== false,
      icon: service.icon || '',
      imageUrl: service.imageUrl || '',
      imageFile: null,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setSelectedService(null);
    setFormData({
      name: '',
      category: '',
      basePrice: '',
      description: '',
      isActive: true,
      icon: '',
      imageUrl: '',
      imageFile: null,
    });
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
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mb-1 sm:mb-2">إدارة الخدمات والأسعار</h1>
          <p className="text-sm sm:text-base text-gray-600">إضافة وتعديل الخدمات والتحكم في الأسعار</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg active:shadow-md transition-all font-semibold text-sm sm:text-base whitespace-nowrap"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="hidden sm:inline">إضافة خدمة جديدة</span>
          <span className="sm:hidden">إضافة</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">إجمالي الخدمات</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">{services.length}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Settings className="text-green-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">خدمات نشطة</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {services.filter(s => s.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-yellow-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">متوسط السعر</span>
            </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {services.length > 0 
              ? (services.reduce((sum, s) => sum + (s.basePrice || 0), 0) / services.length).toFixed(1)
                : 0} ر.س
            </p>
          </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="ابحث عن خدمة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 sm:pr-10 pl-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none text-sm sm:text-base"
          />
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-4">
        {filteredServices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد خدمات</p>
          </div>
        ) : (
          filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3 sm:gap-4 flex-1">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-gradient-to-r from-green-500 to-green-600 text-white flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                    {service.imageUrl ? (
                      <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      service.icon || '📦'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">{service.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{service.category}</p>
                    {service.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{service.description}</p>
                    )}
                  </div>
                </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end gap-3 sm:gap-4">
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <p className="text-lg sm:text-2xl font-black text-green-600">{service.basePrice || 0} ر.س</p>
                    <span className={`inline-block mt-1 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                      service.isActive !== false 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {service.isActive !== false ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start">
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:bg-blue-200 transition-all flex items-center justify-center"
                      aria-label="تعديل"
                      title="تعديل"
                    >
                      <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => toggleServiceStatus(service.id, service.isActive === false)}
                      className={`p-2 sm:p-2.5 rounded-lg transition-all flex items-center justify-center ${
                        service.isActive !== false
                          ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 active:bg-yellow-200'
                          : 'bg-green-50 text-green-600 hover:bg-green-100 active:bg-green-200'
                      }`}
                      aria-label="تفعيل/تعطيل"
                      title={service.isActive !== false ? 'تعطيل' : 'تفعيل'}
                    >
                      <span className="text-base sm:text-lg">{service.isActive !== false ? '⏸️' : '▶️'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-2 sm:p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 transition-all flex items-center justify-center"
                      aria-label="حذف"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                  {selectedService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">اسم الخدمة</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="أدخل اسم الخدمة"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">الفئة</label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="أدخل فئة الخدمة"
                />
              </div>
                <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">السعر الأساسي (ر.س)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({...formData, basePrice: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none text-sm sm:text-base"
                    placeholder="أدخل السعر الأساسي"
                  />
                </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none text-sm sm:text-base"
                  rows={3}
                  placeholder="أدخل وصف الخدمة"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">الأيقونة (رمز تعبيري)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="🚗 أو 🔋 أو 🔐"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">صورة الخدمة (اختياري)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({
                    ...formData,
                    imageFile: e.target.files?.[0] || null
                  })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none bg-gray-50 text-sm sm:text-base"
                />
                {(formData.imageUrl || formData.imageFile) && (
                  <div className="mt-3">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">معاينة:</p>
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={formData.imageFile ? URL.createObjectURL(formData.imageFile) : formData.imageUrl}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="isActive" className="text-xs sm:text-sm font-semibold text-gray-700">
                  الخدمة نشطة
                </label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-60 text-sm sm:text-base"
                  disabled={uploading}
                >
                  {uploading
                    ? 'جاري الرفع...'
                    : selectedService ? 'تحديث الخدمة' : 'إضافة الخدمة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold text-sm sm:text-base"
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
