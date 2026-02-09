import React, { useState, useEffect } from 'react';
import {
  getBanners,
  addBanner,
  updateBanner,
  deleteBanner,
  getBannersConfig,
  updateBannersConfig,
} from '../services/adminService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import {
  ImagePlus,
  Pencil,
  Trash2,
  GripVertical,
  ExternalLink,
  Link,
  Save,
  Settings,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const LINK_TYPES = [
  { value: 'none', label: 'بدون ربط' },
  { value: 'internal', label: 'صفحة داخلية' },
  { value: 'external', label: 'رابط خارجي' },
];

const INTERNAL_SCREENS = [
  { value: 'Home', label: 'الرئيسية' },
  { value: 'AllServices', label: 'جميع الخدمات' },
  { value: 'Requests', label: 'طلباتي' },
  { value: 'Wallet', label: 'المحفظة' },
  { value: 'Profile', label: 'حسابي' },
  { value: 'Notifications', label: 'الإشعارات' },
  { value: 'ContactUs', label: 'تواصل معنا' },
  { value: 'HelpCenter', label: 'مركز المساعدة' },
  { value: 'AboutUs', label: 'من نحن' },
  { value: 'Terms', label: 'الشروط والأحكام' },
];

const defaultForm = {
  imageUrl: '',
  linkType: 'none',
  linkValue: '',
  title: '',
  subtitle: '',
  active: true,
};

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [config, setConfig] = useState({ autoPlaySeconds: 5 });
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageSource, setImageSource] = useState('url'); // 'url' | 'file'

  const load = async () => {
    setLoading(true);
    try {
      const [list, cfg] = await Promise.all([getBanners(), getBannersConfig()]);
      setBanners(list);
      setConfig(cfg || { autoPlaySeconds: 5 });
    } catch (e) {
      console.error(e);
      alert('فشل تحميل البانرات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setImageSource('url');
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({
      imageUrl: b.imageUrl || '',
      linkType: b.linkType || 'none',
      linkValue: b.linkValue || '',
      title: b.title || '',
      subtitle: b.subtitle || '',
      active: b.active !== false,
    });
    setImageSource(b.imageUrl?.startsWith('http') ? 'url' : 'file');
    setModalOpen(true);
  };

  const handleSaveConfig = async () => {
    const sec = parseInt(config.autoPlaySeconds, 10);
    if (isNaN(sec) || sec < 2 || sec > 30) {
      alert('مدة العرض يجب أن تكون بين 2 و 30 ثانية');
      return;
    }
    setSavingConfig(true);
    try {
      await updateBannersConfig({ autoPlaySeconds: sec });
      setConfig((c) => ({ ...c, autoPlaySeconds: sec }));
      alert('تم حفظ إعدادات البانر');
    } catch (e) {
      alert('فشل الحفظ');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleImageFile = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `banners/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((f) => ({ ...f, imageUrl: url }));
      setImageSource('file');
    } catch (err) {
      console.error(err);
      alert('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveBanner = async () => {
    if (!form.imageUrl?.trim()) {
      alert('يرجى إدخال رابط الصورة أو رفع صورة');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateBanner(editingId, form);
        alert('تم تحديث البانر');
      } else {
        await addBanner(form);
        alert('تم إضافة البانر');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      alert('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا البانر؟')) return;
    try {
      await deleteBanner(id);
      load();
    } catch (e) {
      alert('فشل الحذف');
    }
  };

  const moveOrder = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= banners.length) return;
    const reordered = [...banners];
    const a = reordered[index];
    const b = reordered[next];
    reordered[index] = { ...b, order: a.order };
    reordered[next] = { ...a, order: b.order };
    try {
      await updateBanner(a.id, { order: b.order });
      await updateBanner(b.id, { order: a.order });
      setBanners(reordered.sort((x, y) => (x.order ?? 0) - (y.order ?? 0)));
    } catch (e) {
      alert('فشل تغيير الترتيب');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">بانر الشاشة الرئيسية</h1>
        <p className="text-gray-600 mt-1">إدارة صور البانر في تطبيق العميل (الرئيسية) — صورة من الجهاز أو رابط، ربط بصفحة داخلية أو رابط خارجي، وسرعة العرض.</p>
      </div>

      {/* إعدادات سرعة العرض */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-gray-800">سرعة انتقال العرض</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-gray-700 font-medium">مدة عرض كل بانر (ثانية)</label>
            <input
              type="number"
              min={2}
              max={30}
              value={config.autoPlaySeconds ?? 5}
              onChange={(e) => setConfig((c) => ({ ...c, autoPlaySeconds: e.target.value }))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            حفظ
          </button>
        </div>
      </div>

      {/* قائمة البانرات */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">البانرات</h2>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-orange text-white rounded-lg font-bold hover:opacity-90"
          >
            <ImagePlus className="w-4 h-4" />
            إضافة بانر
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {banners.length === 0 ? (
            <div className="p-12 text-center text-gray-500">لا توجد بانرات. أضف بانراً من الزر أعلاه.</div>
          ) : (
            banners.map((b, index) => (
              <div
                key={b.id}
                className="p-4 flex items-center gap-4 hover:bg-gray-50"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveOrder(index, -1)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-teal-600 disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveOrder(index, 1)}
                    disabled={index === banners.length - 1}
                    className="p-1 text-gray-400 hover:text-teal-600 disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-24 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">بدون صورة</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{b.title || '—'}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {b.linkType === 'internal' && <Link className="w-3.5 h-3.5" />}
                    {b.linkType === 'external' && <ExternalLink className="w-3.5 h-3.5" />}
                    {b.linkType === 'none' && '—'}
                    {b.linkType === 'internal' && INTERNAL_SCREENS.find((s) => s.value === b.linkValue)?.label || b.linkValue}
                    {b.linkType === 'external' && (b.linkValue ? 'رابط خارجي' : '—')}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${b.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                >
                  {b.active ? 'نشط' : 'غير نشط'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg"
                    title="تعديل"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal إضافة/تعديل */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">{editingId ? 'تعديل البانر' : 'إضافة بانر'}</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* مصدر الصورة */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الصورة</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="imgSource"
                      checked={imageSource === 'url'}
                      onChange={() => setImageSource('url')}
                    />
                    <span>رابط URL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="imgSource"
                      checked={imageSource === 'file'}
                      onChange={() => setImageSource('file')}
                    />
                    <span>رفع من الجهاز</span>
                  </label>
                </div>
                {imageSource === 'url' ? (
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFile}
                      disabled={uploading}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-teal-50 file:text-teal-700"
                    />
                    {uploading && <span className="text-sm text-gray-500">جاري الرفع...</span>}
                    {form.imageUrl && imageSource === 'file' && (
                      <div className="mt-2 w-32 h-20 rounded overflow-hidden bg-gray-100">
                        <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان (اختياري)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="عنوان البانر"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">وصف (اختياري)</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="وصف قصير"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الربط</label>
                <select
                  value={form.linkType}
                  onChange={(e) => setForm((f) => ({ ...f, linkType: e.target.value, linkValue: '' }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {LINK_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {form.linkType === 'internal' && (
                  <select
                    value={form.linkValue}
                    onChange={(e) => setForm((f) => ({ ...f, linkValue: e.target.value }))}
                    className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">اختر الصفحة</option>
                    {INTERNAL_SCREENS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
                {form.linkType === 'external' && (
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.linkValue}
                    onChange={(e) => setForm((f) => ({ ...f, linkValue: e.target.value }))}
                    className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                )}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                <span className="font-medium text-gray-700">بانر نشط (يظهر في التطبيق)</span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveBanner}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
