import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Edit2, Plus, Trash2 } from 'lucide-react';

const ALLOWED_SCREENS = [
  { value: 'Home', label: 'الرئيسية (Home)' },
  { value: 'Profile', label: 'الملف الشخصي (Profile)' },
  { value: 'Orders', label: 'الطلبات (Orders)' },
  { value: 'TodayOrders', label: 'طلبات اليوم (TodayOrders)' },
  { value: 'Earnings', label: 'رصيدك اليوم (Earnings)' },
  { value: 'Wallet', label: 'سجل الرصيد (Wallet)' },
  { value: 'ChatsList', label: 'المحادثات (ChatsList)' },
  { value: 'Notifications', label: 'الإشعارات (Notifications)' },
  { value: 'Terms', label: 'الشروط (Terms)' },
  { value: 'AboutUs', label: 'من نحن (AboutUs)' },
  { value: 'Support', label: 'الدعم (Support)' },
  { value: 'Settings', label: 'الإعدادات (Settings)' },
];

const ICONS = [
  { value: 'home', label: 'home' },
  { value: 'person', label: 'person' },
  { value: 'receipt', label: 'receipt' },
  { value: 'stats-chart', label: 'stats-chart' },
  { value: 'wallet', label: 'wallet' },
  { value: 'chatbubbles', label: 'chatbubbles' },
  { value: 'notifications', label: 'notifications' },
  { value: 'document-text', label: 'document-text' },
  { value: 'information-circle', label: 'information-circle' },
  { value: 'logo-whatsapp', label: 'logo-whatsapp' },
  { value: 'settings', label: 'settings' },
  { value: 'help-circle', label: 'help-circle' },
];

const LEGACY_DRAWER_CONTROL_PREFIX = 'legacy_drawer_control_';

const FIXED_DRAWER_ITEMS = [
  { kind: 'screen', screen: 'Home', label: 'الرئيسية', icon: 'home' },
  { kind: 'screen', screen: 'Profile', label: 'الملف الشخصي', icon: 'person' },
  { kind: 'screen', screen: 'Orders', label: 'الطلبات', icon: 'receipt' },
  { kind: 'screen', screen: 'Earnings', label: 'رصيدك اليوم', icon: 'stats-chart' },
  { kind: 'screen', screen: 'Wallet', label: 'سجل الرصيد', icon: 'wallet' },
  { kind: 'screen', screen: 'ChatsList', label: 'المحادثات', icon: 'chatbubbles' },
  { kind: 'screen', screen: 'Notifications', label: 'الإشعارات', icon: 'notifications' },
  { kind: 'screen', screen: 'Terms', label: 'الشروط', icon: 'document-text' },
  { kind: 'screen', screen: 'AboutUs', label: 'من نحن', icon: 'information-circle' },
  { kind: 'screen', screen: 'Support', label: 'الدعم', icon: 'chatbubbles' },
  { kind: 'screen', screen: 'Settings', label: 'الإعدادات', icon: 'settings' },
  // WhatsApp action - it doesn't have a screen, we hide it by `key`.
  { kind: 'key', key: 'WhatsApp', label: 'واتساب', icon: 'logo-whatsapp' },
];

export default function ProviderDrawerSections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fixedVisibility, setFixedVisibility] = useState({});

  const emptyForm = useMemo(
    () => ({
      label: '',
      mode: 'custom_content', // custom_content | legacy_screen
      screen: 'Home', // فقط لو legacy_screen
      icon: 'help-circle',
      order: 100,
      enabled: true,
      contentTitle: '',
      contentBody: '',
      contentImageUrl: '',
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'provider_drawer_sections'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // لا نعرض عناصر التحكم بالثوابت في قائمة الأقسام (نعرضها في كارد منفصل)
      const filtered = all
        .filter((d) => !d.id?.startsWith(LEGACY_DRAWER_CONTROL_PREFIX))
        .filter((d) => d?.type === 'custom_content' || d?.contentType === 'custom_content' || d?.mode === 'custom_content');
      setItems(filtered);
    } catch (e) {
      console.error('Failed to load provider drawer sections:', e);
      alert('فشل تحميل الأقسام');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const fixedControlId = (item) => {
    if (item.kind === 'screen') return `${LEGACY_DRAWER_CONTROL_PREFIX}${item.screen}`;
    return `${LEGACY_DRAWER_CONTROL_PREFIX}key_${item.key}`;
  };

  const fixedStateId = (item) => (item.kind === 'screen' ? `screen:${item.screen}` : `key:${item.key}`);

  useEffect(() => {
    let cancelled = false;
    const loadFixedVisibility = async () => {
      try {
        const next = {};
        await Promise.all(
          FIXED_DRAWER_ITEMS.map(async (it) => {
            const id = fixedControlId(it);
            const ref = doc(db, 'provider_drawer_sections', id);
            const snap = await getDoc(ref);
            const enabled = snap.exists() ? snap.data().enabled !== false : true; // default = visible
            next[fixedStateId(it)] = enabled;
          })
        );
        if (!cancelled) setFixedVisibility(next);
      } catch (e) {
        console.error('Failed to load fixed drawer visibility:', e);
      }
    };

    loadFixedVisibility();
    return () => {
      cancelled = true;
    };
  }, []);

  const setFixedVisible = async (item, enabled) => {
    const id = fixedControlId(item);
    const ref = doc(db, 'provider_drawer_sections', id);

    // نخزن فقط بيانات ما يحتاجه التطبيق:
    // - للأقسام التي لها screen: screen + enabled=false
    // - للواتساب: key + enabled=false
    const payload =
      item.kind === 'screen'
        ? { mode: 'legacy_screen', screen: item.screen, icon: item.icon, enabled }
        : { key: item.key, icon: item.icon, enabled };

    await setDoc(ref, payload, { merge: true });
    setFixedVisibility((prev) => ({ ...prev, [fixedStateId(item)]: enabled }));
  };

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
    const isCustomContent = it?.type === 'custom_content' || it?.contentType === 'custom_content';
    setForm({
      label: it.label || it.title || '',
      mode: isCustomContent ? 'custom_content' : 'legacy_screen',
      screen: it.screen || 'Home',
      icon: it.icon || 'help-circle',
      order: typeof it.order === 'number' ? it.order : getNextOrder(),
      enabled: it.enabled !== false,
      contentTitle: it.contentTitle || it.content_title || it.label || '',
      contentBody: it.contentBody || it.content_body || it.content || '',
      contentImageUrl: it.contentImageUrl || it.imageUrl || '',
    });
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      alert('الرجاء إدخال اسم القسم');
      return;
    }

    if (form.mode === 'legacy_screen') {
      if (!form.screen) {
        alert('الرجاء اختيار الشاشة');
        return;
      }
    }

    try {
      if (editingId) {
        const ref = doc(db, 'provider_drawer_sections', editingId);
        const payload = {
          label: form.label.trim(),
          icon: (form.icon || '').trim(),
          order: Number(form.order) || 0,
          enabled: !!form.enabled,

          ...(form.mode === 'custom_content'
            ? {
                type: 'custom_content',
                contentTitle: (form.contentTitle || '').trim(),
                contentBody: form.contentBody || '',
                contentImageUrl: (form.contentImageUrl || '').trim(),
              }
            : {
                // وضع فتح شاشة موجودة (legacy). لا نضع type كي لا يعتبر custom_content.
                screen: form.screen,
              }),
        };

        await updateDoc(ref, payload);
      } else {
        const payload = {
          label: form.label.trim(),
          icon: (form.icon || '').trim(),
          order: Number(form.order) || 0,
          enabled: !!form.enabled,
          ...(form.mode === 'custom_content'
            ? {
                type: 'custom_content',
                contentTitle: (form.contentTitle || '').trim(),
                contentBody: form.contentBody || '',
                contentImageUrl: (form.contentImageUrl || '').trim(),
              }
            : {
                screen: form.screen,
              }),
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'provider_drawer_sections'), payload);
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
      await deleteDoc(doc(db, 'provider_drawer_sections', id));
      await loadItems();
      alert('تم الحذف');
    } catch (e) {
      console.error('Delete error:', e);
      alert('فشل الحذف');
    }
  };

  useEffect(() => {
    // بعد أول تحميل، حدّث order تلقائيًا إذا كانت الشاشة فاضية
    if (items.length && !editingId) {
      setForm((prev) => ({ ...prev, order: prev.order ? prev.order : getNextOrder() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">أقسام Drawer للمزود</h1>
        <p className="text-gray-600 mt-1">
          أضف أقسام جديدة بدون المساس بالعناصر القديمة. إذا أنشأت قسم بوضع <span className="font-mono">legacy_screen</span> واخترت <span className="font-mono">enabled=false</span> لشاشة موجودة، سيتم إخفاء هذا العنصر القديم من الـ drawer.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">تحكم بالأقسام الثابتة في الـ Drawer</h2>
          <div className="text-sm text-gray-500">Default: كل شيء ظاهر</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIXED_DRAWER_ITEMS.map((it) => {
            const sid = fixedStateId(it);
            const isEnabled = fixedVisibility[sid] !== false; // إذا ما خلص تحميل، اعتبره visible
            return (
              <label
                key={sid}
                className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50"
              >
                <div>
                  <div className="font-bold text-gray-900">{it.label}</div>
                  <div className="text-xs text-gray-500">
                    {it.kind === 'screen' ? `screen: ${it.screen}` : `key: ${it.key}`}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!isEnabled}
                  onChange={(e) => setFixedVisible(it, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'تعديل قسم' : 'إضافة قسم جديد'}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع القسم</label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                value={form.mode}
                onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}
              >
                <option value="custom_content">محتوى مخصص (يظهر داخل شاشة قسم)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم القسم</label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="مثال: خدماتي"
              />
            </div>

            {form.mode === 'legacy_screen' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الشاشة (Screen)</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                  value={form.screen}
                  onChange={(e) => setForm((p) => ({ ...p, screen: e.target.value }))}
                >
                  {ALLOWED_SCREENS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
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

            {form.mode === 'custom_content' ? (
              <>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">صورة (Image URL) - اختياري</label>
                  <input
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    value={form.contentImageUrl}
                    onChange={(e) => setForm((p) => ({ ...p, contentImageUrl: e.target.value }))}
                    placeholder="https://.../image.png"
                  />
                </div>
              </>
            ) : null}

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

          {items.length === 0 ? (
            <div className="text-gray-500">لا توجد أقسام بعد.</div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-gray-900">{it.label || it.title}</div>
                      <div className="text-sm text-gray-600">
                        mode: <span className="font-mono">{it.type === 'custom_content' ? 'custom_content' : 'legacy_screen'}</span> | order:{' '}
                        <span className="font-mono">{it.order}</span> | icon:{' '}
                        <span className="font-mono">{it.icon || '-'}</span>
                      </div>
                      {it.type === 'custom_content' ? (
                        <div className="text-sm text-gray-500">
                          محتوى: {it.contentBody ? <span className="text-green-600 font-bold">متوفر</span> : 'غير موجود'} | صورة:{' '}
                          {it.contentImageUrl ? <span className="text-green-600 font-bold">متوفرة</span> : 'غير موجودة'}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          screen: <span className="font-mono">{it.screen}</span>
                        </div>
                      )}
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

