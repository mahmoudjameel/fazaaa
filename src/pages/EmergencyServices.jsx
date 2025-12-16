import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Package, Upload, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../services/firebase';

export const EmergencyServices = () => {
  const [mainServices, setMainServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubServiceModalOpen, setIsSubServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSubService, setSelectedSubService] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    icon: '',
    imageUrl: '',
    gradient: ['#EF4444', '#DC2626'],
    isActive: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [subServiceFormData, setSubServiceFormData] = useState({
    id: '',
    name: '',
    price: '',
    icon: '',
  });

  useEffect(() => {
    fetchMainServices();
  }, []);

  const fetchMainServices = async () => {
    try {
      const servicesRef = collection(db, 'emergency-services');
      const querySnapshot = await getDocs(servicesRef);
      const servicesList = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        servicesList.push({
          id: docSnap.id, // Firebase document ID
          serviceId: data.id || docSnap.id, // Service ID from data
          ...data,
          subServices: data.subServices || []
        });
      });
      setMainServices(servicesList);
    } catch (error) {
      console.error('Error fetching main services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return null;

    setUploadingImage(true);
    try {
      const timestamp = Date.now();
      const fileName = `services/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('حدث خطأ أثناء رفع الصورة');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = formData.imageUrl;

      // رفع الصورة الجديدة إن وجدت
      if (imageFile) {
        const uploadedUrl = await handleImageUpload(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;

          // حذف الصورة القديمة إن وجدت
          if (selectedService?.imageUrl && selectedService.imageUrl !== uploadedUrl && selectedService.imageUrl.includes('firebasestorage')) {
            try {
              const url = new URL(selectedService.imageUrl);
              const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
              if (pathMatch) {
                const decodedPath = decodeURIComponent(pathMatch[1]);
                const oldImageRef = ref(storage, decodedPath);
                await deleteObject(oldImageRef);
              }
            } catch (error) {
              console.warn('Error deleting old image:', error);
            }
          }
        }
      }

      const serviceData = {
        ...formData,
        imageUrl: imageUrl || formData.imageUrl || '',
        gradient: formData.gradient,
        isActive: formData.isActive !== false,
        updatedAt: serverTimestamp(),
      };

      if (selectedService) {
        // Update existing service
        const serviceRef = doc(db, 'emergency-services', selectedService.id);
        await updateDoc(serviceRef, serviceData);
        setMainServices(mainServices.map(s =>
          s.id === selectedService.id ? { ...s, ...serviceData } : s
        ));
      } else {
        // Add new service
        const serviceDataWithTimestamp = {
          ...serviceData,
          subServices: [],
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'emergency-services'), serviceDataWithTimestamp);
        setMainServices([...mainServices, { id: docRef.id, ...serviceDataWithTimestamp }]);
      }

      setIsModalOpen(false);
      resetForm();
      alert('تم حفظ الخدمة بنجاح');
    } catch (error) {
      console.error('Error saving service:', error);
      alert('حدث خطأ أثناء حفظ الخدمة: ' + error.message);
    }
  };

  const handleSubServiceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedService) return;

    try {
      const subService = {
        id: subServiceFormData.id || `sub-${Date.now()}`,
        name: subServiceFormData.name,
        price: parseFloat(subServiceFormData.price),
        icon: subServiceFormData.icon,
      };

      // استخدام Firebase document ID (وليس service.id)
      const firebaseDocId = selectedService.id;
      const service = mainServices.find(s => s.id === firebaseDocId);
      let updatedSubServices = [...(service.subServices || [])];

      if (selectedSubService) {
        // Update existing sub-service
        updatedSubServices = updatedSubServices.map(sub =>
          sub.id === selectedSubService.id ? subService : sub
        );
      } else {
        // Add new sub-service
        updatedSubServices.push(subService);
      }

      // Update service in Firebase - استخدام Firebase document ID
      console.log('Updating document:', firebaseDocId, 'with subServices:', updatedSubServices);
      const serviceRef = doc(db, 'emergency-services', firebaseDocId);
      await setDoc(serviceRef, {
        subServices: updatedSubServices,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setMainServices(mainServices.map(s =>
        s.id === firebaseDocId ? { ...s, subServices: updatedSubServices } : s
      ));

      setIsSubServiceModalOpen(false);
      resetSubServiceForm();
      alert('تم حفظ الخدمة الفرعية بنجاح');
    } catch (error) {
      console.error('Error saving sub-service:', error);
      alert('حدث خطأ أثناء حفظ الخدمة الفرعية: ' + error.message);
    }
  };

  const handleDelete = async (service) => {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة الرئيسية؟ سيتم حذف جميع الخدمات الفرعية أيضاً.')) {
      try {
        // استخدام doc.id (Firebase document ID) للحذف
        const docId = service.id;
        await deleteDoc(doc(db, 'emergency-services', docId));

        // حذف الصورة من Storage إن وجدت
        if (service.imageUrl && service.imageUrl.includes('firebasestorage')) {
          try {
            // استخراج path من URL الكامل
            const url = new URL(service.imageUrl);
            const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
            if (pathMatch) {
              const decodedPath = decodeURIComponent(pathMatch[1]);
              const imageRef = ref(storage, decodedPath);
              await deleteObject(imageRef);
            }
          } catch (storageError) {
            console.warn('Error deleting image from storage:', storageError);
          }
        }

        setMainServices(mainServices.filter(s => s.id !== docId));
        alert('تم حذف الخدمة بنجاح');
      } catch (error) {
        console.error('Error deleting service:', error);
        alert('حدث خطأ أثناء حذف الخدمة: ' + error.message);
      }
    }
  };

  const handleDeleteSubService = async (serviceId, subServiceId) => {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة الفرعية؟')) {
      try {
        const service = mainServices.find(s => s.id === serviceId);
        const updatedSubServices = service.subServices.filter(sub => sub.id !== subServiceId);

        const serviceRef = doc(db, 'emergency-services', serviceId);
        await setDoc(serviceRef, {
          subServices: updatedSubServices,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setMainServices(mainServices.map(s =>
          s.id === serviceId ? { ...s, subServices: updatedSubServices } : s
        ));
        alert('تم حذف الخدمة الفرعية بنجاح');
      } catch (error) {
        console.error('Error deleting sub-service:', error);
        alert('حدث خطأ أثناء حذف الخدمة الفرعية: ' + error.message);
      }
    }
  };

  const handleDeleteAll = async () => {
    const confirmMessage = 'هل أنت متأكد من حذف جميع الخدمات؟ هذا الإجراء لا يمكن التراجع عنه!';
    if (confirm(confirmMessage)) {
      try {
        const servicesRef = collection(db, 'emergency-services');
        const querySnapshot = await getDocs(servicesRef);

        console.log(`Found ${querySnapshot.size} documents to delete`);

        // حذف جميع المستندات
        const deletePromises = [];
        querySnapshot.forEach((document) => {
          deletePromises.push(deleteDoc(doc(db, 'emergency-services', document.id)));
          console.log(`Deleting: ${document.id}`);
        });

        await Promise.all(deletePromises);

        setMainServices([]);
        alert(`تم حذف ${querySnapshot.size} خدمة بنجاح!`);
      } catch (error) {
        console.error('Error deleting all services:', error);
        alert('حدث خطأ أثناء حذف الخدمات: ' + error.message);
      }
    }
  };

  const openEditModal = (service) => {
    setSelectedService(service);
    setFormData({
      id: service.id || '',
      name: service.name || '',
      description: service.description || '',
      icon: service.icon || '',
      gradient: service.gradient || ['#EF4444', '#DC2626'],
      isActive: service.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const openSubServiceModal = (service, subService = null) => {
    setSelectedService(service);
    setSelectedSubService(subService);
    if (subService) {
      setSubServiceFormData({
        id: subService.id,
        name: subService.name || '',
        price: subService.price || '',
        icon: subService.icon || '',
      });
    } else {
      resetSubServiceForm();
    }
    setIsSubServiceModalOpen(true);
  };

  const resetForm = () => {
    setSelectedService(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      icon: '',
      imageUrl: '',
      gradient: ['#EF4444', '#DC2626'],
      isActive: true,
    });
    setImageFile(null);
    setImagePreview('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetSubServiceForm = () => {
    setSelectedSubService(null);
    setSubServiceFormData({
      id: '',
      name: '',
      price: '',
      icon: '',
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة خدمات الطوارئ</h1>
          <p className="text-gray-600">إضافة وتعديل الخدمات الرئيسية والخدمات الفرعية</p>
        </div>
        <div className="flex gap-3">
          {mainServices.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
            >
              <AlertTriangle size={20} />
              حذف جميع الخدمات
            </button>
          )}
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            <Plus size={20} />
            إضافة خدمة رئيسية جديدة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-blue-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي الخدمات الرئيسية</span>
          </div>
          <p className="text-3xl font-black text-gray-800">{mainServices.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-green-500" size={24} />
            <span className="text-sm text-gray-600">إجمالي الخدمات الفرعية</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {mainServices.reduce((sum, s) => sum + (s.subServices?.length || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-yellow-500" size={24} />
            <span className="text-sm text-gray-600">متوسط الخدمات الفرعية</span>
          </div>
          <p className="text-3xl font-black text-gray-800">
            {mainServices.length > 0
              ? (mainServices.reduce((sum, s) => sum + (s.subServices?.length || 0), 0) / mainServices.length).toFixed(1)
              : 0}
          </p>
        </div>
      </div>

      {/* Main Services List */}
      <div className="space-y-4">
        {mainServices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد خدمات رئيسية. ابدأ بإضافة خدمة جديدة.</p>
          </div>
        ) : (
          mainServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden"
            >
              {/* Main Service Header */}
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {service.imageUrl ? (
                      <img
                        src={service.imageUrl}
                        alt={service.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`p-4 rounded-full text-white text-2xl ${service.imageUrl ? 'hidden' : ''}`}
                      style={{
                        background: `linear-gradient(135deg, ${service.gradient?.[0] || '#EF4444'}, ${service.gradient?.[1] || '#DC2626'})`
                      }}
                    >
                      {service.icon || '📦'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800">{service.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-600">
                          {service.subServices?.length || 0} خدمة فرعية
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${service.isActive !== false
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {service.isActive !== false ? 'نشط' : 'معطل'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setExpandedService(expandedService === service.id ? null : service.id);
                      }}
                      className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
                    >
                      {expandedService === service.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(service)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub Services List */}
              {expandedService === service.id && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-gray-800">الخدمات الفرعية</h4>
                    <button
                      onClick={() => openSubServiceModal(service)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold"
                    >
                      <Plus size={16} />
                      إضافة خدمة فرعية
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {service.subServices?.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        لا توجد خدمات فرعية
                      </div>
                    ) : (
                      service.subServices?.map((subService) => (
                        <div
                          key={subService.id}
                          className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{subService.icon || '🔧'}</div>
                              <div>
                                <h5 className="font-semibold text-gray-800">{subService.name}</h5>
                                <p className="text-sm text-green-600 font-bold">
                                  {subService.price} ر.س
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openSubServiceModal(service, subService)}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteSubService(service.id, subService.id)}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Main Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedService ? 'تعديل الخدمة الرئيسية' : 'إضافة خدمة رئيسية جديدة'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">معرف الخدمة (ID)</label>
                <input
                  type="text"
                  required
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="مثال: tires, battery, locks"
                  disabled={!!selectedService}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الخدمة الرئيسية</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="مثال: خدمات الكفرات"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الوصف</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  rows={3}
                  placeholder="مثال: تبديل وإصلاح الإطارات في موقعك"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الأيقونة (Ionicons)</label>
                <input
                  type="text"
                  required
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="مثال: car-sport, flash, key"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">صورة الخدمة</label>
                <div className="space-y-3">
                  {(imagePreview || formData.imageUrl) && (
                    <div className="relative">
                      <img
                        src={imagePreview || formData.imageUrl}
                        alt="Preview"
                        className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200"
                      />
                      {formData.imageUrl && !imageFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview('');
                            setFormData({ ...formData, imageUrl: '' });
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 transition-all">
                    <Upload size={20} className="text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {imageFile ? imageFile.name : 'اختر صورة للخدمة'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  {uploadingImage && (
                    <div className="text-sm text-blue-600">جاري رفع الصورة...</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اللون الأول (Gradient Start)</label>
                <input
                  type="text"
                  required
                  value={formData.gradient[0]}
                  onChange={(e) => setFormData({ ...formData, gradient: [e.target.value, formData.gradient[1]] })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="#EF4444"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اللون الثاني (Gradient End)</label>
                <input
                  type="text"
                  required
                  value={formData.gradient[1]}
                  onChange={(e) => setFormData({ ...formData, gradient: [formData.gradient[0], e.target.value] })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="#DC2626"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">
                  الخدمة نشطة
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  {selectedService ? 'تحديث الخدمة' : 'إضافة الخدمة'}
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

      {/* Sub Service Modal */}
      {isSubServiceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedSubService ? 'تعديل الخدمة الفرعية' : 'إضافة خدمة فرعية جديدة'}
                </h2>
                <button
                  onClick={() => setIsSubServiceModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleSubServiceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الخدمة الفرعية</label>
                <input
                  type="text"
                  required
                  value={subServiceFormData.name}
                  onChange={(e) => setSubServiceFormData({ ...subServiceFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="مثال: تبديل إطار فوري"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">السعر (ر.س)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={subServiceFormData.price}
                  onChange={(e) => setSubServiceFormData({ ...subServiceFormData, price: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="80"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الأيقونة (Ionicons)</label>
                <input
                  type="text"
                  required
                  value={subServiceFormData.icon}
                  onChange={(e) => setSubServiceFormData({ ...subServiceFormData, icon: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                  placeholder="مثال: repeat, build, speedometer"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  {selectedSubService ? 'تحديث الخدمة' : 'إضافة الخدمة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSubServiceModalOpen(false)}
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
