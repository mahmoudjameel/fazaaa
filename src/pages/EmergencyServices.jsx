import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Package, Upload, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
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
    name: '',
    nameEn: '',
    description: '',
    imageUrl: '',
    isActive: true,
    requiresLegalVerification: false,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [subServiceFormData, setSubServiceFormData] = useState({
    name: '',
    nameEn: '',
    price: '',
    description: '',
    imageUrl: '',
    requiresLegalVerification: false,
  });
  const [subServiceImageFile, setSubServiceImageFile] = useState(null);
  const [subServiceImagePreview, setSubServiceImagePreview] = useState('');

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
        const firebaseDocId = docSnap.id;
        const serviceId = data.id || `service-${firebaseDocId}`;

        const subServices = (data.subServices || []).map((sub, subIndex) => {
          const subId = sub.id || `sub-${firebaseDocId}-${subIndex}`;
          return {
            id: subId,
            name: sub.name || '',
            nameEn: sub.nameEn || '',
            price: sub.price || 0,
            description: sub.description || '',
            imageUrl: sub.imageUrl || '',
            requiresLegalVerification: sub.requiresLegalVerification === true,
            parentServiceId: sub.parentServiceId || firebaseDocId
          };
        });

        servicesList.push({
          id: firebaseDocId,
          serviceId: serviceId,
          name: data.name || '',
          nameEn: data.nameEn || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          isActive: data.isActive !== false,
          requiresLegalVerification: data.requiresLegalVerification === true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          subServices: subServices
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
        name: formData.name,
        nameEn: formData.nameEn || '',
        description: formData.description || '',
        imageUrl: imageUrl || formData.imageUrl || '',
        isActive: formData.isActive !== false,
        requiresLegalVerification: formData.requiresLegalVerification === true,
        updatedAt: serverTimestamp(),
      };

      if (selectedService) {
        // Update existing service - use Firebase document ID
        const firebaseDocId = selectedService.id; // This is the Firebase document ID
        const serviceRef = doc(db, 'emergency-services', firebaseDocId);

        // Preserve existing serviceId and subServices
        const existingService = mainServices.find(s => s.id === firebaseDocId);
        const serviceId = existingService?.serviceId || selectedService.serviceId || `service-${firebaseDocId}`;

        // Get current data from Firebase to preserve subServices
        const currentDoc = await getDoc(serviceRef);
        const currentData = currentDoc.data() || {};

        const updateData = {
          ...serviceData,
          id: serviceId, // Keep the service ID
          // Preserve subServices from Firebase (most up-to-date)
          subServices: currentData.subServices || existingService?.subServices || selectedService.subServices || [],
        };

        await updateDoc(serviceRef, updateData);
        setMainServices(mainServices.map(s =>
          s.id === firebaseDocId ? {
            ...s,
            name: updateData.name,
            description: updateData.description,
            imageUrl: updateData.imageUrl,
            isActive: updateData.isActive,
            requiresLegalVerification: updateData.requiresLegalVerification,
            updatedAt: updateData.updatedAt,
            // Keep existing subServices
            subServices: s.subServices || []
          } : s
        ));
      } else {
        // Add new service - generate ID automatically
        const autoId = `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const serviceDataWithTimestamp = {
          ...serviceData,
          id: autoId,
          subServices: [],
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'emergency-services'), serviceDataWithTimestamp);
        // Use Firebase document ID as the main id, and serviceId for the generated ID
        // IMPORTANT: Don't spread serviceDataWithTimestamp as it contains id: autoId
        // Instead, explicitly set id to Firebase document ID
        setMainServices([...mainServices, {
          id: docRef.id, // Firebase document ID - this is the primary identifier
          serviceId: autoId, // Service ID for reference
          name: serviceData.name,
          description: serviceData.description || '',
          imageUrl: serviceData.imageUrl || '',
          isActive: serviceData.isActive !== false,
          requiresLegalVerification: serviceData.requiresLegalVerification === true,
          subServices: [],
          createdAt: serviceDataWithTimestamp.createdAt,
          updatedAt: serviceDataWithTimestamp.updatedAt
        }]);
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
      let imageUrl = subServiceFormData.imageUrl;

      // رفع الصورة الجديدة إن وجدت
      if (subServiceImageFile) {
        const uploadedUrl = await handleImageUpload(subServiceImageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;

          // حذف الصورة القديمة إن وجدت
          if (selectedSubService?.imageUrl && selectedSubService.imageUrl !== uploadedUrl && selectedSubService.imageUrl.includes('firebasestorage')) {
            try {
              const url = new URL(selectedSubService.imageUrl);
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

      // استخدام Firebase document ID
      // IMPORTANT: selectedService.id should be Firebase document ID, not serviceId
      // If it's not, find the service by serviceId and use its Firebase document ID
      let firebaseDocId = selectedService.id;
      let service = mainServices.find(s => s.id === firebaseDocId);

      // If not found by id, try to find by serviceId (for backward compatibility)
      if (!service && selectedService.serviceId) {
        service = mainServices.find(s => s.serviceId === selectedService.serviceId);
        if (service) {
          firebaseDocId = service.id; // Use Firebase document ID
        }
      }

      if (!service) {
        alert('الخدمة الرئيسية غير موجودة');
        return;
      }

      // Generate stable ID for new sub-service
      // Use only Firebase document ID (not serviceId) to avoid duplication
      const existingSubServices = service.subServices || [];
      const newSubServiceId = selectedSubService
        ? selectedSubService.id
        : `sub-${firebaseDocId}-${existingSubServices.length}-${Date.now()}`;

      const subService = {
        id: newSubServiceId,
        name: subServiceFormData.name,
        nameEn: subServiceFormData.nameEn || '',
        price: parseFloat(subServiceFormData.price),
        description: subServiceFormData.description || '',
        imageUrl: imageUrl || subServiceFormData.imageUrl || '',
        requiresLegalVerification: subServiceFormData.requiresLegalVerification === true,
        parentServiceId: firebaseDocId, // Link to parent service using Firebase document ID
      };

      if (!service) {
        alert('الخدمة الرئيسية غير موجودة');
        return;
      }

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
      const serviceRef = doc(db, 'emergency-services', firebaseDocId);

      // Use updateDoc instead of setDoc to ensure we only update subServices
      // This preserves all other fields automatically
      await updateDoc(serviceRef, {
        subServices: updatedSubServices, // Update only subServices
        updatedAt: serverTimestamp(),
      });

      // Update local state - preserve all existing data
      setMainServices(mainServices.map(s =>
        s.id === firebaseDocId ? {
          ...s,
          subServices: updatedSubServices,
          updatedAt: new Date().toISOString()
        } : s
      ));

      setIsSubServiceModalOpen(false);
      resetSubServiceForm();
      setSubServiceImageFile(null);
      setSubServiceImagePreview('');
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
        // Use updateDoc to preserve all other fields
        await updateDoc(serviceRef, {
          subServices: updatedSubServices,
          updatedAt: serverTimestamp(),
        });

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

  const handleSeedStandardServices = async () => {
    if (!confirm('هل تريد إضافة حزمة الخدمات القياسية (بناشر، بطاريات، وقود، سطحات)؟')) return;

    try {
      setLoading(true);
      const standardServices = [
        {
          id: 'tires',
          name: 'بناشر متنقلة',
          nameEn: 'Mobile Tires',
          icon: '🛞',
          gradient: ['#FF9A8B', '#FF6A88'],
          isActive: true,
          requiresLegalVerification: true,
          subServices: [
            { id: 'tire_patch', name: 'رقعة مسمار', nameEn: 'Tire Patch', price: 50 },
            { id: 'tire_replacement', name: 'تغيير إطار بالكامل', nameEn: 'Full Tire Replacement', price: 150 },
            { id: 'tire_air', name: 'تعبئة هواء', nameEn: 'Air Refill', price: 30 }
          ]
        },
        {
          id: 'battery',
          name: 'خدمة البطاريات',
          nameEn: 'Battery Service',
          icon: '🔋',
          gradient: ['#FAD961', '#F76B1C'],
          isActive: true,
          requiresLegalVerification: false,
          subServices: [
            { id: 'battery_jumpstart', name: 'اشتراك بطارية', nameEn: 'Battery Jumpstart', price: 40 },
            { id: 'battery_test', name: 'فحص البطارية والدينامو', nameEn: 'Battery & Alternator Test', price: 60 },
            { id: 'battery_replacement', name: 'تغيير بطارية جديدة', nameEn: 'New Battery Replacement', price: 200 }
          ]
        },
        {
          id: 'fuel',
          name: 'توصيل وقود',
          nameEn: 'Fuel Delivery',
          icon: '⛽',
          gradient: ['#00DBDE', '#FC00FF'],
          isActive: true,
          requiresLegalVerification: false,
          subServices: [
            { id: 'fuel_91', name: 'توصيل وقود 91', nameEn: 'Fuel 91 Delivery', price: 20 },
            { id: 'fuel_95', name: 'توصيل وقود 95', nameEn: 'Fuel 95 Delivery', price: 25 },
            { id: 'fuel_diesel', name: 'توصيل ديزل', nameEn: 'Diesel Delivery', price: 30 }
          ]
        }
      ];

      for (const service of standardServices) {
        const serviceRef = doc(db, 'emergency-services', service.id);
        await setDoc(serviceRef, {
          ...service,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await fetchMainServices();
      alert('تم إضافة الخدمات القياسية بنجاح!');
    } catch (error) {
      console.error('Error seeding services:', error);
      alert('حدث خطأ أثناء إضافة الخدمات');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (service) => {
    setSelectedService(service);
    setFormData({
      name: service.name || '',
      nameEn: service.nameEn || '',
      description: service.description || '',
      imageUrl: service.imageUrl || '',
      isActive: service.isActive !== false,
      requiresLegalVerification: service.requiresLegalVerification === true,
    });
    setImagePreview(service.imageUrl || '');
    setIsModalOpen(true);
  };

  const openSubServiceModal = (service, subService = null) => {
    setSelectedService(service);
    setSelectedSubService(subService);
    if (subService) {
      setSubServiceFormData({
        name: subService.name || '',
        nameEn: subService.nameEn || '',
        price: subService.price || '',
        description: subService.description || '',
        imageUrl: subService.imageUrl || '',
        requiresLegalVerification: subService.requiresLegalVerification === true,
      });
      setSubServiceImagePreview(subService.imageUrl || '');
    } else {
      resetSubServiceForm();
      setSubServiceImagePreview('');
    }
    setSubServiceImageFile(null);
    setIsSubServiceModalOpen(true);
  };

  const resetForm = () => {
    setSelectedService(null);
    setFormData({
      name: '',
      nameEn: '',
      description: '',
      imageUrl: '',
      isActive: true,
      requiresLegalVerification: false,
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
      name: '',
      nameEn: '',
      price: '',
      description: '',
      imageUrl: '',
      requiresLegalVerification: false,
    });
  };

  const handleSubServiceImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSubServiceImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSubServiceImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة خدمات الطوارئ</h1>
          <p className="text-gray-600">إضافة وتعديل الخدمات الرئيسية والخدمات الفرعية</p>
        </div>
        <div className="flex gap-3">
          {mainServices.length === 0 && (
            <button
              onClick={handleSeedStandardServices}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
            >
              <Package size={20} />
              إضافة الخدمات القياسية
            </button>
          )}
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
      <div className="space-y-6">
        {mainServices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد خدمات رئيسية. ابدأ بإضافة خدمة جديدة.</p>
          </div>
        ) : (
          mainServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-100 hover:border-gray-300 transition-all"
            >
              {/* Main Service Header */}
              <div
                className="p-6 relative bg-gray-50 border-r-4 border-blue-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Service Icon/Image */}
                    <div className="relative">
                      {service.imageUrl ? (
                        <img
                          src={service.imageUrl}
                          alt={service.name}
                          className="w-20 h-20 rounded-xl object-cover border-4 border-white shadow-lg"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-20 h-20 rounded-xl flex items-center justify-center text-3xl text-white shadow-lg ${service.imageUrl ? 'hidden' : ''}`}
                        style={{
                          background: `linear-gradient(135deg, ${service.gradient?.[0] || '#EF4444'}, ${service.gradient?.[1] || '#DC2626'})`
                        }}
                      >
                        {service.icon || '📦'}
                      </div>
                    </div>

                    {/* Service Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-black text-gray-800">
                          {service.name}
                          {service.nameEn && <span className="text-sm font-normal text-gray-400 ml-2">({service.nameEn})</span>}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${service.isActive !== false
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                          }`}>
                          {service.isActive !== false ? '✓ نشط' : '✗ معطل'}
                        </span>
                      </div>
                      <p className="text-base text-gray-600 mb-3">{service.description}</p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
                          <Package className="text-blue-600" size={18} />
                          <span className="text-sm font-bold text-gray-700">
                            {service.subServices?.length || 0} خدمة فرعية
                          </span>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
                          <span className="text-xs text-gray-500 font-semibold">ID:</span>
                          <span className="text-xs text-gray-700 font-mono font-bold">
                            {service.serviceId || service.id || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setExpandedService(expandedService === service.id ? null : service.id);
                      }}
                      className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-all border-2 border-gray-200 font-semibold flex items-center gap-2"
                    >
                      {expandedService === (service.id || `service-${serviceIndex}`) ? (
                        <>
                          <ChevronUp size={18} />
                          <span>إخفاء</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={18} />
                          <span>عرض الخدمات الفرعية</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md"
                      title="تعديل الخدمة الرئيسية"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(service)}
                      className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md"
                      title="حذف الخدمة الرئيسية"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub Services List */}
              {expandedService === (service.id || `service-${serviceIndex}`) && (
                <div className="border-t-4 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
                      <h4 className="text-xl font-black text-gray-800">الخدمات الفرعية</h4>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                        {service.subServices?.length || 0}
                      </span>
                    </div>
                    <button
                      onClick={() => openSubServiceModal(service)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-bold"
                    >
                      <Plus size={18} />
                      إضافة خدمة فرعية جديدة
                    </button>
                  </div>

                  {service.subServices?.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                      <Package className="mx-auto text-gray-400 mb-3" size={48} />
                      <p className="text-gray-500 font-semibold">لا توجد خدمات فرعية</p>
                      <p className="text-sm text-gray-400 mt-2">ابدأ بإضافة خدمة فرعية جديدة</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {service.subServices?.map((subService, index) => (
                        <div
                          key={`${service.id}-${subService.id}-${index}`}
                          className="bg-white rounded-xl p-5 shadow-md border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all relative group"
                        >

                          {/* Connection Line Visual */}
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-bl-full opacity-20"></div>

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              {/* Sub Service Image/Icon */}
                              {subService.imageUrl ? (
                                <img
                                  src={subService.imageUrl}
                                  alt={subService.name}
                                  className="w-14 h-14 rounded-lg object-cover border-2 border-gray-200 shadow-sm"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center shadow-sm">
                                  <ImageIcon size={24} className="text-gray-400" />
                                </div>
                              )}

                              {/* Sub Service Info */}
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-gray-800 text-lg mb-1 truncate">
                                  {subService.name}
                                  {subService.nameEn && <span className="text-[10px] font-normal text-gray-400 block mt-0.5">{subService.nameEn}</span>}
                                </h5>
                                {subService.description && (
                                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                                    {subService.description}
                                  </p>
                                )}
                                <div className="mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-500 font-semibold">ID:</span>
                                    <span className="text-xs text-gray-700 font-mono bg-gray-100 px-2 py-1 rounded">
                                      {subService.id || 'N/A'}
                                    </span>
                                    {subService.parentServiceId && (
                                      <>
                                        <span className="text-xs text-gray-500 font-semibold">الخدمة الرئيسية:</span>
                                        <span className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                                          {subService.parentServiceId}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-500 font-semibold">السعر:</span>
                                  <span className="text-lg font-black text-green-600">
                                    {subService.price} ر.س
                                  </span>
                                </div>
                              </div>
                              {subService.requiresLegalVerification && (
                                <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg w-fit">
                                  <AlertTriangle size={12} className="text-blue-600" />
                                  <span className="text-[10px] font-bold text-blue-700">يتطلب سند قانوني</span>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openSubServiceModal(service, subService)}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                                title="تعديل"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteSubService(service.id, subService.id)}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                                title="حذف"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الخدمة (بالعربية)</label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الخدمة (بالانجليزية)</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                    placeholder="Example: Tire Services"
                  />
                </div>
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requiresLegalVerification"
                  checked={formData.requiresLegalVerification}
                  onChange={(e) => setFormData({ ...formData, requiresLegalVerification: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="requiresLegalVerification" className="text-sm font-semibold text-gray-700">
                  يتطلب السند القانوني (تحقق الهوية، إثبات الملكية، نموذج إخلاء المسؤولية)
                </label>
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
        </div >
      )}

      {/* Sub Service Modal */}
      {
        isSubServiceModalOpen && (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الخدمة الفرعية (بالعربية)</label>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الخدمة الفرعية (بالانجليزية)</label>
                    <input
                      type="text"
                      value={subServiceFormData.nameEn}
                      onChange={(e) => setSubServiceFormData({ ...subServiceFormData, nameEn: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                      placeholder="Example: Quick Tire Change"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الوصف</label>
                  <textarea
                    value={subServiceFormData.description}
                    onChange={(e) => setSubServiceFormData({ ...subServiceFormData, description: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:ring-green-500 outline-none"
                    rows={3}
                    placeholder="مثال: خدمة تبديل الإطارات بسرعة في موقعك"
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

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="subRequiresLegalVerification"
                    checked={subServiceFormData.requiresLegalVerification}
                    onChange={(e) => setSubServiceFormData({ ...subServiceFormData, requiresLegalVerification: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="subRequiresLegalVerification" className="text-sm font-semibold text-gray-700">
                    يتطلب السند القانوني لهذه الخدمة الفرعية
                  </label>
                </div>

                {/* Sub Service Image Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">صورة الخدمة الفرعية</label>
                  <div className="space-y-3">
                    {(subServiceImagePreview || subServiceFormData.imageUrl) && (
                      <div className="relative">
                        <img
                          src={subServiceImagePreview || subServiceFormData.imageUrl}
                          alt="Preview"
                          className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200"
                        />
                        {subServiceFormData.imageUrl && !subServiceImageFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubServiceImagePreview('');
                              setSubServiceFormData({ ...subServiceFormData, imageUrl: '' });
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
                        {subServiceImageFile ? subServiceImageFile.name : 'اختر صورة للخدمة الفرعية'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSubServiceImageChange}
                        className="hidden"
                      />
                    </label>
                    {uploadingImage && (
                      <div className="text-sm text-blue-600">جاري رفع الصورة...</div>
                    )}
                  </div>
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
        )
      }
    </div >
  );
};
