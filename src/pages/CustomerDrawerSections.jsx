import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Edit2, Trash2 } from 'lucide-react';

const CUSTOMER_DRAWER_COLLECTION = 'customer_drawer_sections';
const LEGACY_CONTROL_PREFIX = 'legacy_drawer_control_customer_';

const ICONS = [
  { value: 'home', label: 'home' },
  { value: 'list', label: 'list' },
  { value: 'wallet', label: 'wallet' },
  { value: 'person', label: 'person' },
  { value: 'notifications', label: 'notifications' },
  { value: 'help-circle', label: 'help-circle' },
  { value: 'document-text', label: 'document-text' },
  { value: 'information-circle', label: 'information-circle' },
  { value: 'chatbubbles', label: 'chatbubbles' },
  { value: 'alert-circle', label: 'alert-circle' },
  { value: 'settings', label: 'settings' },
  { value: 'help-circle-outline', label: 'help-circle-outline' },
];

const FIXED_DRAWER_ITEMS = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'requests', label: 'طلباتي' },
  { key: 'notifications', label: 'الإشعارات' },
  { key: 'profile', label: 'حسابي' },
  { key: 'terms', label: 'الشروط والأحكام' },
  { key: 'privacy', label: 'سياسة الخصوصية' },
  { key: 'about', label: 'من نحن' },
  { key: 'help', label: 'مركز المساعدة' },
  { key: 'contact', label: 'تواصل معنا' },
  { key: 'complaints', label: 'الشكاوى' },
  { key: 'logout', label: 'تسجيل الخروج' },
];

export default function CustomerDrawerSections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const emptyForm = useMemo(
    () => ({
      label: '',
      icon: 'help-circle',
      iconBgColor: '#14b8a6',
      contentTitle: '',
      contentBody: '',
      contentImageUrl: '',
      order: 100,
      enabled: true,
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [fixedVisibility, setFixedVisibility] = useState({});

  const fixedControlId = (key) => `${LEGACY_CONTROL_PREFIX}${key}`;

  const loadItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, CUSTOMER_DRAWER_COLLECTION), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = all
        .filter((d) => !d.id?.startsWith(LEGACY_CONTROL_PREFIX))
        .filter((d) => d?.type === 'custom_content' || d?.contentType === 'custom_content' || d?.mode === 'custom_content');
      setItems(filtered);
    } catch (e) {
      console.error('Failed to load customer drawer sections:', e);
      alert('فشل تحميل أقسام drawer العميل');
    } finally {
      setLoading(false);
    }
  };

  const loadFixedVisibility = async () => {
    try {
      const entries = await Promise.all(
        FIXED_DRAWER_ITEMS.map(async (it) => {
          const ref = doc(db, CUSTOMER_DRAWER_COLLECTION, fixedControlId(it.key));
          const snap = await getDoc(ref);
          const enabled = snap.exists() ? snap.data().enabled !== false : true;
          return [it.key, enabled];
        })
      );
      setFixedVisibility(Object.fromEntries(entries));
    } catch (e) {
      console.warn('Failed to load fixed drawer visibility:', e?.message || e);
    }
  };

  useEffect(() => {
    loadItems();
    loadFixedVisibility();
  }, []);

  const getNextOrder = () => {
    const maxOrder = items.reduce((m, it) => (typeof it?.order === 'number' ? Math.max(m, it.order) : m), 0);
    return maxOrder + 1;
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm, order: getNextOrder() });
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setForm({
      label: it.label || it.title || '',
      icon: it.icon || 'help-circle',
      iconBgColor: it.iconBgColor || it.color || '#14b8a6',
      contentTitle: it.contentTitle || '',
      contentBody: it.contentBody || it.content || '',
      contentImageUrl: it.contentImageUrl || it.imageUrl || '',
      order: typeof it.order === 'number' ? it.order : getNextOrder(),
      enabled: it.enabled !== false,
    });
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      alert('الرجاء إدخال اسم القسم');
      return;
    }

    try {
      if (editingId) {
        const ref = doc(db, CUSTOMER_DRAWER_COLLECTION, editingId);
        await updateDoc(ref, {
          type: 'custom_content',
          label: form.label.trim(),
          icon: (form.icon || '').trim(),
          iconBgColor: (form.iconBgColor || '').trim(),
          contentTitle: (form.contentTitle || '').trim(),
          contentBody: form.contentBody || '',
          contentImageUrl: (form.contentImageUrl || '').trim(),
          order: Number(form.order) || 0,
          enabled: !!form.enabled,
        });
      } else {
        await addDoc(collection(db, CUSTOMER_DRAWER_COLLECTION), {
          type: 'custom_content',
          label: form.label.trim(),
          icon: (form.icon || '').trim(),
          iconBgColor: (form.iconBgColor || '').trim(),
          contentTitle: (form.contentTitle || '').trim(),
          contentBody: form.contentBody || '',
          contentImageUrl: (form.contentImageUrl || '').trim(),
          order: Number(form.order) || 0,
          enabled: !!form.enabled,
          createdAt: new Date().toISOString(),
        });
      }

      await loadItems();
      resetForm();
      alert(editingId ? 'تم تحديث القسم' : 'تم إضافة القسم');
    } catch (e) {
      console.error('Save error:', e);
      alert('فشل الحفظ');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
      await deleteDoc(doc(db, CUSTOMER_DRAWER_COLLECTION, id));
      await loadItems();
      alert('تم الحذف');
    } catch (e) {
      console.error('Delete error:', e);
      alert('فشل الحذف');
    }
  };

  const setFixedVisible = async (key, enabled) => {
    try {
      const ref = doc(db, CUSTOMER_DRAWER_COLLECTION, fixedControlId(key));
      await setDoc(
        ref,
        {
          enabled: !!enabled,
        },
        { merge: true }
      );
      setFixedVisibility((prev) => ({ ...prev, [key]: !!enabled }));
    } catch (e) {
      console.error('setFixedVisible error:', e);
    }
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">أقسام Drawer للعميل</h1>
        <p className="text-gray-600 mt-1">
          أضف أقسام مخصصة (icon + محتوى) وتتحكم بظهور الأقسام الثابتة من نفس الصفحة.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">تحكم بالأقسام الثابتة</h2>
          <div className="text-sm text-gray-500">Default: كل شيء ظاهر</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIXED_DRAWER_ITEMS.map((it) => (
            <label
              key={it.key}
              className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <div>
                <div className="font-bold text-gray-900">{it.label}</div>
                <div className="text-xs text-gray-500">key: {it.key}</div>
              </div>
              <input
                type="checkbox"
                checked={fixedVisibility[it.key] !== false}
                onChange={(e) => setFixedVisible(it.key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'تعديل قسم' : 'إضافة قسم جديد'}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم القسم</label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="مثال: خدماتي"
              />
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">الأيقونة (Ionicons)</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                  value={form.icon}
                  onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                >
                  {ICONS.map((ic) => (
                    <option key={ic.value} value={ic.value}>
                      {ic.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">لون الأيقونة (hex)</label>
                <input
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  value={form.iconBgColor}
                  onChange={(e) => setForm((p) => ({ ...p, iconBgColor: e.target.value }))}
                  placeholder="#14b8a6"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">عنوان المحتوى (اختياري)</label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={form.contentTitle}
                onChange={(e) => setForm((p) => ({ ...p, contentTitle: e.target.value }))}
                placeholder="إذا تركته فارغ سيظهر اسم القسم"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">محتوى القسم</label>
              <textarea
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-arabic"
                value={form.contentBody}
                onChange={(e) => setForm((p) => ({ ...p, contentBody: e.target.value }))}
                placeholder="اكتب محتوى القسم هنا..."
                rows={8}
                dir="rtl"
                style={{ lineHeight: 1.8 }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة (اختياري) Image URL</label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={form.contentImageUrl}
                onChange={(e) => setForm((p) => ({ ...p, contentImageUrl: e.target.value }))}
                placeholder="https://.../image.png"
              />
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب (order)</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  value={form.order}
                  onChange={(e) => setForm((p) => ({ ...p, order: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <input
                  type="checkbox"
                  checked={!!form.enabled}
                  onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">مفعل</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors"
              >
                {editingId ? 'حفظ التعديل' : 'إضافة'}
              </button>
              <button
                onClick={() => resetForm()}
                className="px-6 py-3 border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">القائمة</h2>
          </div>

          {loading ? (
            <div className="text-gray-500">جاري التحميل...</div>
          ) : items.length === 0 ? (
            <div className="text-gray-500">لا توجد أقسام مضافة.</div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-gray-900">{it.label || it.title}</div>
                      <div className="text-sm text-gray-600">
                        order: <span className="font-mono">{it.order}</span> | icon:{' '}
                        <span className="font-mono">{it.icon || '-'}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        الحالة: {it.enabled !== false ? <span className="text-green-600 font-bold">مفعل</span> : 'غير مفعل'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(it)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        title="تعديل"
                      >
                        <Edit2 className="w-4 h-4 text-teal-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

