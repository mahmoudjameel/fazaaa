import { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    Shield,
    Check,
    X
} from 'lucide-react';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../services/firebase';

export const Admins = () => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'admin', // super_admin or admin
        permissions: []
    });
    const [processing, setProcessing] = useState(false);

    const PERMISSIONS_LIST = [
        { id: 'dashboard', label: 'لوحة التحكم' },
        { id: 'emergency_services', label: 'إدارة خدمات الطوارئ' },
        { id: 'providers', label: 'إدارة المزودين' },
        { id: 'orders', label: 'إدارة الطلبات' },
        { id: 'users', label: 'العملاء' },
        { id: 'cities', label: 'إدارة المدن' },
        { id: 'city_managers', label: 'مديري المدن' },
        { id: 'complaints', label: 'الشكاوي' },
        { id: 'withdrawal_requests', label: 'طلبات السحب' },
        { id: 'distribution', label: 'توزيع الطلبات' },
        { id: 'bank_settings', label: 'إعدادات البنك' },
        { id: 'app_settings', label: 'إعدادات التطبيق' },
    ];

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'app_admins'));
            const adminsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAdmins(adminsList);
        } catch (error) {
            console.error('Error fetching admins:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionChange = (permId) => {
        setFormData(prev => {
            const newPermissions = prev.permissions.includes(permId)
                ? prev.permissions.filter(p => p !== permId)
                : [...prev.permissions, permId];
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setProcessing(true);

        try {
            // 1. Create User in Firebase Auth (using secondary app to avoid logout)
            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.password
            );
            const user = userCredential.user;

            // 2. Create Admin Document in Firestore
            await setDoc(doc(db, 'app_admins', user.uid), {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                permissions: formData.permissions,
                createdAt: serverTimestamp(),
                isActive: true
            });

            alert('تم إضافة المدير بنجاح');
            fetchAdmins();
            setIsModalOpen(false);
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'admin',
                permissions: []
            });
        } catch (error) {
            console.error('Error adding admin:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('البريد الإلكتروني مستخدم بالفعل');
            } else {
                alert('حدث خطأ أثناء إضافة المدير: ' + error.message);
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا المدير؟')) return;

        try {
            await deleteDoc(doc(db, 'app_admins', id));
            // Note: We cannot delete from Auth from client SDK easily without Cloud Functions
            // But removing from Firestore denies access.
            alert('تم حذف صلاحيات المدير');
            fetchAdmins();
        } catch (error) {
            console.error('Error deleting admin:', error);
            alert('فشل الحذف');
        }
    };

    const filteredAdmins = admins.filter(admin =>
        admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Shield className="text-red-500" />
                        إدارة المديرين والصلاحيات
                    </h1>
                    <p className="text-gray-500 mt-1">إضافة مديرين جدد وتحديد صلاحياتهم</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-bold shadow-lg shadow-red-500/20"
                >
                    <Plus size={20} />
                    إضافة مدير جديد
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Search */}
                <div className="p-6 border-b border-gray-100">
                    <div className="relative max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="بحث بالاسم أو البريد..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-red-500 focus:outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-right text-sm font-bold text-gray-500">الاسم</th>
                                <th className="px-6 py-4 text-right text-sm font-bold text-gray-500">البريد الإلكتروني</th>
                                <th className="px-6 py-4 text-right text-sm font-bold text-gray-500">الصلاحية</th>
                                <th className="px-6 py-4 text-right text-sm font-bold text-gray-500">الأقسام المتاحة</th>
                                <th className="px-6 py-4 text-right text-sm font-bold text-gray-500">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">جاري التحميل...</td>
                                </tr>
                            ) : filteredAdmins.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">لا يوجد مديرين</td>
                                </tr>
                            ) : (
                                filteredAdmins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-800">{admin.name}</td>
                                        <td className="px-6 py-4 text-gray-600">{admin.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${admin.role === 'super_admin'
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {admin.role === 'super_admin' ? 'مدير عام' : 'مدير محدد'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {admin.role === 'super_admin' ? (
                                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">كل الصلاحيات</span>
                                                ) : (
                                                    admin.permissions?.map(p => {
                                                        const label = PERMISSIONS_LIST.find(pl => pl.id === p)?.label || p;
                                                        return (
                                                            <span key={p} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                                {label}
                                                            </span>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {admin.role !== 'super_admin' && ( // Don't allow deleting super admins easily
                                                <button
                                                    onClick={() => handleDelete(admin.id)}
                                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Admin Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800">إضافة مدير جديد</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none"
                                        placeholder="اسم المدير"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">نوع الحساب</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none"
                                    >
                                        <option value="admin">مدير بصلاحيات محددة</option>
                                        <option value="super_admin">مدير عام (كل الصلاحيات)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none"
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none"
                                        placeholder="******"
                                    />
                                </div>
                            </div>

                            {formData.role === 'admin' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-4">تحديد الصلاحيات</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {PERMISSIONS_LIST.map((perm) => (
                                            <label
                                                key={perm.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.permissions.includes(perm.id)
                                                        ? 'border-red-500 bg-red-50'
                                                        : 'border-gray-200 hover:border-red-200'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.permissions.includes(perm.id)
                                                        ? 'bg-red-500 border-red-500'
                                                        : 'border-gray-300 bg-white'
                                                    }`}>
                                                    {formData.permissions.includes(perm.id) && <Check size={12} className="text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={formData.permissions.includes(perm.id)}
                                                    onChange={() => handlePermissionChange(perm.id)}
                                                />
                                                <span className={`text-sm font-medium ${formData.permissions.includes(perm.id) ? 'text-red-700' : 'text-gray-600'
                                                    }`}>
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    {processing ? 'جاري الإضافة...' : 'حفظ المدير'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
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

export default Admins;
