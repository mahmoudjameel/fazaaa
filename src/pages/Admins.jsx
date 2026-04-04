import { useState, useEffect } from 'react';
import { Users, Plus, Search, Trash2, Shield, Check, X, Loader2 } from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../services/firebase';

const PERMISSIONS_LIST = [
  { id: 'dashboard',               label: 'لوحة التحكم' },
  { id: 'emergency_services',      label: 'إدارة الخدمات' },
  { id: 'providers',               label: 'إدارة المزودين' },
  { id: 'add_provider',            label: 'إضافة مزود يدوي' },
  { id: 'orders',                  label: 'إدارة الطلبات' },
  { id: 'users',                   label: 'العملاء' },
  { id: 'cities',                  label: 'إدارة المدن' },
  { id: 'city_managers',           label: 'مديري المدن' },
  { id: 'complaints',              label: 'الشكاوي' },
  { id: 'withdrawal_requests',     label: 'طلبات السحب' },
  { id: 'distribution',            label: 'توزيع الطلبات' },
  { id: 'bank_settings',           label: 'إعدادات البنك' },
  { id: 'app_settings',            label: 'إعدادات التطبيق' },
  { id: 'provider_drawer_sections',label: 'أقسام Drawer المزود' },
  { id: 'customer_drawer_sections',label: 'أقسام Drawer العميل' },
];

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-all text-sm';

export const Admins = () => {
  const [admins, setAdmins]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModal]   = useState(false);
  const [searchTerm, setSearch]     = useState('');
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData]     = useState({
    name: '', email: '', password: '', role: 'admin', permissions: [],
  });

  useEffect(() => { fetchAdmins(); }, []);

  const fetchAdmins = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'app_admins'));
      setAdmins(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const { user } = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      await setDoc(doc(db, 'app_admins', user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        permissions: formData.permissions,
        createdAt: serverTimestamp(),
        isActive: true,
      });
      alert('تم إضافة المدير بنجاح');
      fetchAdmins();
      closeModal();
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        alert('البريد الإلكتروني مستخدم بالفعل');
      } else {
        alert('حدث خطأ: ' + error.message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المدير؟')) return;
    try {
      await deleteDoc(doc(db, 'app_admins', id));
      alert('تم حذف صلاحيات المدير');
      fetchAdmins();
    } catch {
      alert('فشل الحذف');
    }
  };

  const closeModal = () => {
    setIsModal(false);
    setFormData({ name: '', email: '', password: '', role: 'admin', permissions: [] });
  };

  const filtered = admins.filter(
    (a) =>
      a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-500" />
            إدارة المديرين والصلاحيات
          </h1>
          <p className="text-gray-500 mt-1 text-sm">إضافة مديرين جدد وتحديد صلاحياتهم</p>
        </div>
        <button
          onClick={() => setIsModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-gray-950 rounded-xl hover:bg-amber-500 transition-all font-bold shadow-sm text-sm"
        >
          <Plus size={18} />
          إضافة مدير جديد
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-5 border-b border-gray-100">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="بحث بالاسم أو البريد..."
              value={searchTerm}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-sm transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['الاسم', 'البريد الإلكتروني', 'الصلاحية', 'الأقسام المتاحة', 'إجراءات'].map((h) => (
                  <th key={h} className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-amber-400" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">لا يوجد مديرون</td>
                </tr>
              ) : (
                filtered.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-gray-800 text-sm">{admin.name}</td>
                    <td className="px-5 py-4 text-gray-500 text-sm">{admin.email}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        admin.role === 'super_admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {admin.role === 'super_admin' ? 'مدير عام' : 'مدير محدد'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {admin.role === 'super_admin' ? (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">كل الصلاحيات</span>
                        ) : (
                          admin.permissions?.map((p) => {
                            const label = PERMISSIONS_LIST.find((pl) => pl.id === p)?.label || p;
                            return (
                              <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                {label}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {admin.role !== 'super_admin' && (
                        <button
                          onClick={() => handleDelete(admin.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
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
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">إضافة مدير جديد</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-200 rounded-lg transition-all">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass} placeholder="اسم المدير"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">نوع الحساب</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className={inputClass}
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
                    type="email" required value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass} placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
                  <input
                    type="password" required minLength={6} value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={inputClass} placeholder="6 أحرف على الأقل"
                  />
                </div>
              </div>

              {formData.role === 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">تحديد الصلاحيات</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {PERMISSIONS_LIST.map((perm) => {
                      const active = formData.permissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            active ? 'border-amber-400 bg-amber-50' : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              active ? 'bg-amber-400 border-amber-400' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {active && <Check size={11} className="text-gray-950" />}
                          </div>
                          <input
                            type="checkbox" className="hidden"
                            checked={active} onChange={() => togglePermission(perm.id)}
                          />
                          <span className={`text-xs font-medium ${active ? 'text-amber-800' : 'text-gray-600'}`}>
                            {perm.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="submit" disabled={processing}
                  className="flex-1 bg-amber-400 text-gray-950 py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing && <Loader2 size={16} className="animate-spin" />}
                  {processing ? 'جاري الإضافة...' : 'حفظ المدير'}
                </button>
                <button
                  type="button" onClick={closeModal}
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
