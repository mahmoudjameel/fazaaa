import React, { useEffect, useState } from 'react';
import {
    CheckCircle,
    UserPlus,
    X,
    Plus,
    Tag,
    FileImage,
    Wrench,
    Car,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    createManualProvider,
} from '../services/adminService';
import { collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { NATIONALITIES } from './Providers';
import SAUDI_CITIES_RAW from '../services/cities.json';

// نفس تصنيفات المستندات كما في تسجيل المزود الجديد (DocumentsScreen)
const DOCUMENT_FIELDS = [
    { key: 'idImage', title: 'الهوية / الإقامة', subtitle: 'صورة الهوية الوطنية أو الإقامة', icon: FileImage },
    { key: 'equipmentPhoto', title: 'صورة العدة', subtitle: 'العدة والأدوات التي تعمل بها', icon: Wrench },
    { key: 'carFront', title: 'السيارة - صورة أمامية', subtitle: 'صورة واضحة للسيارة من الأمام', icon: Car },
    { key: 'carSide', title: 'السيارة - صورة جانبية', subtitle: 'صورة واضحة للسيارة من الجانب', icon: Car },
    { key: 'licensePhoto', title: 'رخصة القيادة', subtitle: 'صورة أو ملف PDF أو Word', icon: FileText },
    { key: 'registrationPhoto', title: 'استمارة السيارة', subtitle: 'صورة أو ملف PDF أو Word', icon: FileText },
];

const SAUDI_CITIES = [...SAUDI_CITIES_RAW]
    .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ar'))
    .map((city) => ({
        value: city.id,
        label: city.name,
    }));

export const AddProvider = () => {
    const navigate = useNavigate();
    const [mainServices, setMainServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [documentFiles, setDocumentFiles] = useState({
        idImage: null,
        equipmentPhoto: null,
        carFront: null,
        carSide: null,
        licensePhoto: null,
        registrationPhoto: null,
    });
    const [providerFormData, setProviderFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        nationality: '',
        city: '',
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

        // الإلزامي فقط: الاسم (الأول + الأخير) ورقم الهاتف
        const firstName = (providerFormData.firstName || '').trim();
        const lastName = (providerFormData.lastName || '').trim();
        const phone = (providerFormData.phone || '').trim();
        if (!firstName || !lastName) {
            alert('يرجى إدخال الاسم الأول والأخير');
            return;
        }
        if (!phone) {
            alert('يرجى إدخال رقم الهاتف');
            return;
        }
        if (!providerFormData.city) {
            alert('يرجى اختيار مدينة العمل');
            return;
        }
        if (!providerFormData.services || providerFormData.services.length === 0) {
            alert('يرجى اختيار خدمة واحدة على الأقل');
            return;
        }

        setIsUploading(true);
        const prefix = `providers/${Date.now()}`;
        const uploadOne = async (file, key) => {
            if (!file) return '';
            const storageRef = ref(storage, `${prefix}_${key}_${file.name}`);
            await uploadBytes(storageRef, file);
            return getDownloadURL(storageRef);
        };
        let documentUrls = {};
        try {
            const wrapUrl = (url) => (url ? { url, type: 'image' } : null);
            documentUrls = {
                idImage: wrapUrl(await uploadOne(documentFiles.idImage, 'id')),
                equipmentPhoto: wrapUrl(await uploadOne(documentFiles.equipmentPhoto, 'equipment')),
                carPhotoFront: wrapUrl(await uploadOne(documentFiles.carFront, 'car_front')),
                carPhotoSide: wrapUrl(await uploadOne(documentFiles.carSide, 'car_side')),
                licensePhoto: wrapUrl(await uploadOne(documentFiles.licensePhoto, 'license')),
                registrationPhoto: wrapUrl(await uploadOne(documentFiles.registrationPhoto, 'registration')),
            };
            Object.keys(documentUrls).forEach((k) => {
                if (!documentUrls[k]) delete documentUrls[k];
            });
        } catch (uploadError) {
            console.error('Document upload failed:', uploadError);
            alert('فشل رفع أحد المستندات. تأكد من حجم الملفات وحاول مرة أخرى.');
            setIsUploading(false);
            return;
        }

        try {
            const result = await createManualProvider({
                ...providerFormData,
                firstName: firstName,
                lastName: lastName,
                phone: phone,
                documents: documentUrls
            });

            if (!result.success) {
                setIsUploading(false);
                if (result.error === 'duplicate_phone') {
                    alert('المزود مسجل مسبقاً. رقم الجوال هذا مستخدم لمزود آخر.');
                    return;
                }
                alert(result.error || 'فشل إضافة المزود');
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الهاتف *</label>
                                <div className="flex items-stretch rounded-xl border-2 border-gray-100 overflow-hidden bg-gray-50 focus-within:border-blue-400 focus-within:bg-white transition-all" dir="ltr">
                                    <span className="flex items-center px-4 bg-gray-100 border-l-2 border-gray-200 text-gray-700 font-bold text-lg" aria-label="مفتاح الدولة">
                                        +966
                                    </span>
                                    <input
                                        type="tel"
                                        required
                                        value={providerFormData.phone}
                                        onChange={(e) => setProviderFormData({ ...providerFormData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                                        className="flex-1 min-w-0 px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-0"
                                        placeholder="5XXXXXXXX"
                                        dir="ltr"
                                        maxLength={9}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">أدخل الرقم بدون مفتاح الدولة (مثال: 512345678 أو 0512345678)</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">الجنسية (اختياري)</label>
                                <select
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">مدينة العمل *</label>
                                <select
                                    required
                                    value={providerFormData.city}
                                    onChange={(e) => setProviderFormData({ ...providerFormData, city: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 focus:outline-none transition-all"
                                >
                                    <option value="">اختر مدينة العمل</option>
                                    {SAUDI_CITIES.map((city) => (
                                        <option key={city.value} value={city.value}>
                                            {city.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">المقصود المدينة التي سيعمل فيها المزود ويستقبل منها الطلبات.</p>
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

                    {/* Services Selection - مطلوب */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-700 border-r-4 border-blue-500 pr-3">الخدمات المتاحة *</h3>
                        <p className="text-sm text-gray-500">اختر خدمة واحدة على الأقل</p>
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

                    {/* المستندات الثبوتية - واضحة مثل تسجيل المزود الجديد */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-700 border-r-4 border-blue-500 pr-3">المستندات الثبوتية</h3>
                            <p className="text-sm text-gray-500 mt-1">يمكنك رفع صور (JPG, PNG) أو ملفات PDF أو Word — جميع الحقول اختيارية</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {DOCUMENT_FIELDS.map((field) => {
                                const file = documentFiles[field.key];
                                const Icon = field.icon;
                                return (
                                    <div
                                        key={field.key}
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-white hover:border-blue-300 transition-all"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                <Icon className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-800">{field.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{field.subtitle}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf,.doc,.docx"
                                                        onChange={(e) => {
                                                            const f = e.target.files?.[0];
                                                            if (f) setDocumentFiles((prev) => ({ ...prev, [field.key]: f }));
                                                        }}
                                                        className="hidden"
                                                        id={`doc-${field.key}`}
                                                    />
                                                    <label
                                                        htmlFor={`doc-${field.key}`}
                                                        className="cursor-pointer text-sm font-medium text-blue-600 hover:underline"
                                                    >
                                                        {file ? 'تغيير الملف' : 'رفع ملف'}
                                                    </label>
                                                    {file && (
                                                        <>
                                                            <span className="text-sm text-gray-600 truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDocumentFiles((prev) => ({ ...prev, [field.key]: null }))}
                                                                className="text-red-500 text-xs font-bold hover:underline"
                                                            >
                                                                إزالة
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {file && (
                                                <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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
