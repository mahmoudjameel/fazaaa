import React, { useEffect, useState } from 'react';
import {
    CheckCircle,
    UserPlus,
    X,
    Plus,
    Tag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    createManualProvider,
} from '../services/adminService';
import { collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { NATIONALITIES } from './Providers';

export const AddProvider = () => {
    const navigate = useNavigate();
    const [mainServices, setMainServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [idImageFile, setIdImageFile] = useState(null);
    const [providerFormData, setProviderFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        nationality: '',
        services: [],
    });

    useEffect(() => {
        fetchMainServices();
    }, []);

    const fetchMainServices = async () => {
        try {
            const servicesRef = collection(db, 'emergency-services');
            const querySnapshot = await getDocs(servicesRef);
            const services = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.isActive !== false) {
                    services.push({
                        id: doc.id,
                        name: data.name || '',
                    });
                }
            });
            setMainServices(services);
        } catch (error) {
            console.error('Error fetching main services:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProvider = async (e) => {
        e.preventDefault();

        if (!providerFormData.firstName || !providerFormData.lastName || !providerFormData.phone) {
            alert('يرجى إكمال جميع الحقول المطلوبة (الاسم والرقم)');
            return;
        }

        if (providerFormData.services.length === 0) {
            alert('يرجى اختيار خدمة واحدة على الأقل');
            return;
        }

        if (!providerFormData.nationality) {
            alert('يرجى اختيار الجنسية');
            return;
        }

        setIsUploading(true);
        let idImageUrl = '';

        if (idImageFile) {
            try {
                const storageRef = ref(storage, `providers/${Date.now()}_${idImageFile.name}`);
                await uploadBytes(storageRef, idImageFile);
                idImageUrl = await getDownloadURL(storageRef);
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError);
                alert('فشل رفع الصورة، سيتم إضافة المزود بدون صورة');
            }
        }

        try {
            const result = await createManualProvider({
                ...providerFormData,
                idImage: idImageUrl
            });

            if (!result.success && result.error === 'duplicate_phone') {
                setIsUploading(false);
                alert('رقم الجوال هذا مستخدم بالفعل لمزود آخر');
                return;
            }

            alert('تم إضافة المزود بنجاح');
            navigate('/providers');
        } catch (error) {
            console.error('Error adding provider:', error);
            alert('فشل إضافة المزود');
        } finally {
            setIsUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-gray-500">جاري تحميل الخدمات...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <UserPlus className="text-blue-500" />
                        إضافة مزود جديد يدوياً
                    </h1>
                    <p className="text-gray-500 mt-1">أدخل بيانات المزود لتسجيله مباشرة في النظام</p>
                </div>
                <button
                    onClick={() => navigate('/providers')}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X size={24} className="text-gray-400" />
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <form onSubmit={handleCreateProvider} className="p-8 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-700 border-r-4 border-blue-500 pr-3">المعلومات الأساسية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الأول *</label>
                                <input
                                    type="text"
                                    required
                                    value={providerFormData.firstName}
                                    onChange={(e) => setProviderFormData({ ...providerFormData, firstName: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 focus:outline-none transition-all"
                                    placeholder="الاسم الأول"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الأخير *</label>
                                <input
                                    type="text"
                                    required
                                    value={providerFormData.lastName}
                                    onChange={(e) => setProviderFormData({ ...providerFormData, lastName: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 focus:outline-none transition-all"
                                    placeholder="الاسم الأخير"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الهاتف * (بدون +966)</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        required
                                        value={providerFormData.phone}
                                        onChange={(e) => setProviderFormData({ ...providerFormData, phone: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 focus:outline-none transition-all text-left pr-16"
                                        placeholder="5XXXXXXXX"
                                        dir="ltr"
                                    />
                                    <div className="absolute right-0 top-0 bottom-0 flex items-center px-4 bg-gray-100 rounded-r-xl border-l-2 border-gray-100 text-gray-500 font-bold" dir="ltr">
                                        +966
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">الجنسية *</label>
                                <select
                                    required
                                    value={providerFormData.nationality}
                                    onChange={(e) => setProviderFormData({ ...providerFormData, nationality: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 focus:outline-none transition-all"
                                >
                                    <option value="">اختر الجنسية</option>
                                    {NATIONALITIES.map((nat) => (
                                        <option key={nat.value} value={nat.value}>
                                            {nat.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني (اختياري)</label>
                            <input
                                type="email"
                                value={providerFormData.email}
                                onChange={(e) => setProviderFormData({ ...providerFormData, email: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 focus:outline-none transition-all"
                                placeholder="example@email.com"
                            />
                        </div>
                    </div>

                    {/* Services Selection */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-700 border-r-4 border-blue-500 pr-3">الخدمات المتاحة</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {mainServices.map((service) => (
                                <label
                                    key={service.id}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${providerFormData.services.includes(service.id)
                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                        : 'border-gray-100 bg-white hover:border-blue-200'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${providerFormData.services.includes(service.id)
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-200 bg-white'
                                        }`}>
                                        {providerFormData.services.includes(service.id) && <Plus size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={providerFormData.services.includes(service.id)}
                                        onChange={(e) => {
                                            const updatedServices = e.target.checked
                                                ? [...providerFormData.services, service.id]
                                                : providerFormData.services.filter(id => id !== service.id);
                                            setProviderFormData({ ...providerFormData, services: updatedServices });
                                        }}
                                    />
                                    <span className={`font-semibold ${providerFormData.services.includes(service.id) ? 'text-blue-700' : 'text-gray-600'}`}>
                                        {service.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* ID Document */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-700 border-r-4 border-blue-500 pr-3">المستندات الثبوتية</h3>
                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 bg-gray-50 hover:bg-white hover:border-blue-400 transition-all text-center group">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setIdImageFile(e.target.files[0])}
                                className="hidden"
                                id="id-image-upload-standalone"
                            />
                            <label htmlFor="id-image-upload-standalone" className="cursor-pointer flex flex-col items-center justify-center">
                                {idImageFile ? (
                                    <div className="space-y-3">
                                        <div className="w-20 h-20 mx-auto bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                                            <CheckCircle size={40} />
                                        </div>
                                        <div>
                                            <span className="block font-bold text-gray-800">{idImageFile.name}</span>
                                            <span className="text-sm text-gray-500">تم اختيار الملف بنجاح</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setIdImageFile(null);
                                            }}
                                            className="text-red-500 text-sm font-bold hover:underline"
                                        >
                                            إزالة واستبدال
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <span className="text-3xl">🪪</span>
                                        </div>
                                        <span className="text-lg font-bold text-gray-700">اضغط لرفع صورة الإقامة أو الهوية</span>
                                        <span className="text-gray-400 mt-2">يمكنك رفع ملف JPG أو PNG حتى حجم 5 ميجابايت (اختياري)</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="pt-8 border-t border-gray-100 flex gap-4">
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="flex-1 bg-blue-500 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    جاري الحفظ...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={24} />
                                    إضافة المزود الآن
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/providers')}
                            className="px-8 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold text-lg hover:bg-gray-200 transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddProvider;
