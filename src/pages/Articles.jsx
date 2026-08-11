import { useState, useEffect, useMemo } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import {
  getAllArticles,
  addArticle,
  updateArticle,
  deleteArticle,
  getSeoHashtags,
  addSeoHashtag,
  updateSeoHashtag,
  deleteSeoHashtag,
  slugifyArticleTitle,
  normalizeHashtag,
} from '../services/articlesService';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Hash,
  Save,
  ImagePlus,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';

const emptyArticle = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  hashtags: [],
  keywords: '',
  seoTitle: '',
  seoDescription: '',
  published: true,
  showOnLanding: true,
};

const emptyHashtag = {
  tag: '',
  label: '',
  keywords: '',
  active: true,
};

export default function Articles() {
  const [tab, setTab] = useState('articles'); // articles | hashtags
  const [articles, setArticles] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyArticle);
  const [hashtagForm, setHashtagForm] = useState(emptyHashtag);
  const [editingHashtagId, setEditingHashtagId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [arts, tags] = await Promise.all([getAllArticles(), getSeoHashtags()]);
      setArticles(arts);
      setHashtags(tags);
    } catch (e) {
      console.error(e);
      alert('فشل تحميل المقالات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const blob = [a.title, a.slug, a.excerpt, ...(a.hashtags || []), ...(a.keywords || [])]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [articles, search]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyArticle);
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({
      title: a.title || '',
      slug: a.slug || '',
      excerpt: a.excerpt || '',
      content: a.content || '',
      coverImage: a.coverImage || '',
      hashtags: a.hashtags || [],
      keywords: (a.keywords || []).join(', '),
      seoTitle: a.seoTitle || '',
      seoDescription: a.seoDescription || '',
      published: a.published !== false,
      showOnLanding: a.showOnLanding !== false,
    });
    setModalOpen(true);
  };

  const toggleHashtagOnForm = (tag) => {
    const t = normalizeHashtag(tag);
    setForm((f) => {
      const set = new Set(f.hashtags || []);
      if (set.has(t)) set.delete(t);
      else set.add(t);
      return { ...f, hashtags: [...set] };
    });
  };

  const handleImageFile = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `articles/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((f) => ({ ...f, coverImage: url }));
    } catch (err) {
      console.error(err);
      alert('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!form.title.trim()) {
      alert('أدخل عنوان المقال');
      return;
    }
    if (!form.content.trim()) {
      alert('أدخل محتوى المقال');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugifyArticleTitle(form.title),
        keywords: form.keywords,
        hashtags: form.hashtags,
      };
      if (editingId) {
        await updateArticle(editingId, payload);
        alert('تم تحديث المقال');
      } else {
        await addArticle(payload);
        alert('تم نشر المقال');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      alert(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (id) => {
    if (!window.confirm('حذف هذا المقال نهائياً؟')) return;
    try {
      await deleteArticle(id);
      load();
    } catch (e) {
      alert('فشل الحذف');
    }
  };

  const handleTogglePublish = async (a) => {
    try {
      await updateArticle(a.id, { published: !a.published });
      load();
    } catch (e) {
      alert('فشل التحديث');
    }
  };

  const handleSaveHashtag = async () => {
    const tag = normalizeHashtag(hashtagForm.tag || hashtagForm.label);
    if (!tag) {
      alert('أدخل الهاشتاق');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tag,
        label: hashtagForm.label || tag,
        keywords: hashtagForm.keywords,
        active: hashtagForm.active !== false,
      };
      if (editingHashtagId) {
        await updateSeoHashtag(editingHashtagId, payload);
      } else {
        await addSeoHashtag(payload);
      }
      setHashtagForm(emptyHashtag);
      setEditingHashtagId(null);
      load();
    } catch (e) {
      alert(e.message || 'فشل حفظ الهاشتاق');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHashtag = async (id) => {
    if (!window.confirm('حذف هذا الهاشتاق؟')) return;
    try {
      await deleteSeoHashtag(id);
      load();
    } catch (e) {
      alert('فشل الحذف');
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
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">مقالات اللاندينغ (SEO)</h1>
        <p className="text-gray-600 mt-1">
          أضف مقالات وهاشتاقات تظهر في صفحة الموقع العامة لتحسين الظهور في محركات البحث حسب الكلمات المفتاحية.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('articles')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
            tab === 'articles'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <FileText className="w-4 h-4" /> المقالات ({articles.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('hashtags')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${
            tab === 'hashtags'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Hash className="w-4 h-4" /> الهاشتاقات ({hashtags.length})
          </span>
        </button>
      </div>

      {tab === 'articles' && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 justify-between items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في العنوان / الهاشتاق / الكلمات..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-72"
            />
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              مقال جديد
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredArticles.length === 0 ? (
              <div className="p-12 text-center text-gray-500">لا توجد مقالات بعد.</div>
            ) : (
              filteredArticles.map((a) => (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                  {a.coverImage ? (
                    <img
                      src={a.coverImage}
                      alt=""
                      className="w-full sm:w-28 h-20 object-cover rounded-lg border border-gray-100"
                    />
                  ) : (
                    <div className="w-full sm:w-28 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 truncate">{a.title}</h3>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          a.published
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {a.published ? 'منشور' : 'مسودة'}
                      </span>
                      {a.showOnLanding !== false && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          على اللاندينغ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-2">/blog/{a.slug}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(a.hashtags || []).map((t) => (
                        <span
                          key={t}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-100"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/blog/${a.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="معاينة"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(a)}
                      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      title={a.published ? 'إخفاء' : 'نشر'}
                    >
                      {a.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="p-2 rounded-lg border border-gray-200 text-teal-700 hover:bg-teal-50"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(a.id)}
                      className="p-2 rounded-lg border border-gray-200 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'hashtags' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-5 space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Hash className="w-4 h-4 text-teal-600" />
              {editingHashtagId ? 'تعديل هاشتاق' : 'إضافة هاشتاق SEO'}
            </h2>
            <div>
              <label className="text-sm font-medium text-gray-700">الهاشتاق</label>
              <input
                value={hashtagForm.tag}
                onChange={(e) => setHashtagForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="بنشر_متنقل"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">الاسم الظاهر</label>
              <input
                value={hashtagForm.label}
                onChange={(e) => setHashtagForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="بنشر متنقل"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">كلمات مفتاحية مرتبطة (مفصولة بفاصلة)</label>
              <textarea
                value={hashtagForm.keywords}
                onChange={(e) => setHashtagForm((f) => ({ ...f, keywords: e.target.value }))}
                rows={3}
                placeholder="بنشر، بنشر إطارات، نفخ كفر"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hashtagForm.active !== false}
                onChange={(e) => setHashtagForm((f) => ({ ...f, active: e.target.checked }))}
              />
              نشط
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveHashtag}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-bold disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                حفظ
              </button>
              {editingHashtagId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingHashtagId(null);
                    setHashtagForm(emptyHashtag);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 font-bold text-gray-800">قائمة الهاشتاقات</div>
            <div className="divide-y divide-gray-100">
              {hashtags.length === 0 ? (
                <div className="p-10 text-center text-gray-500">أضف هاشتاقات لتقوية مواضيع SEO.</div>
              ) : (
                hashtags.map((h) => (
                  <div key={h.id} className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-teal-800">#{h.tag}</div>
                      <div className="text-sm text-gray-600">{h.label}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(h.keywords || []).map((k) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHashtagId(h.id);
                          setHashtagForm({
                            tag: h.tag,
                            label: h.label || '',
                            keywords: (h.keywords || []).join(', '),
                            active: h.active !== false,
                          });
                        }}
                        className="p-2 rounded-lg border border-gray-200 text-teal-700"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHashtag(h.id)}
                        className="p-2 rounded-lg border border-gray-200 text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'تعديل المقال' : 'مقال جديد'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-800">
                إغلاق
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">العنوان *</label>
                <input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: editingId ? f.slug : slugifyArticleTitle(title),
                    }));
                  }}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">رابط المقال (slug)</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">/blog/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">مقتطف قصير (للعرض في القائمة و SEO)</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">محتوى المقال *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={10}
                  placeholder="اكتب المقال هنا. كل فقرة في سطر جديد."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg leading-relaxed"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">صورة الغلاف</label>
                <div className="mt-1 flex flex-wrap gap-2 items-center">
                  <input
                    value={form.coverImage}
                    onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    dir="ltr"
                  />
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm font-medium">
                    <ImagePlus className="w-4 h-4" />
                    {uploading ? 'جاري الرفع...' : 'رفع صورة'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} disabled={uploading} />
                  </label>
                </div>
                {form.coverImage && (
                  <img src={form.coverImage} alt="" className="mt-2 h-28 object-cover rounded-lg border" />
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">هاشتاقات SEO</label>
                {hashtags.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                    لا توجد هاشتاقات بعد — أضفها من تبويب الهاشتاقات ثم اربطها بالمقال.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {hashtags.filter((h) => h.active !== false).map((h) => {
                      const selected = (form.hashtags || []).includes(h.tag);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => toggleHashtagOnForm(h.tag)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                            selected
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                          }`}
                        >
                          #{h.tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">كلمات مفتاحية إضافية (مفصولة بفاصلة)</label>
                <input
                  value={form.keywords}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                  placeholder="مساعدة الطريق الرياض، بنشر جدة"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">عنوان SEO (اختياري)</label>
                  <input
                    value={form.seoTitle}
                    onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">وصف SEO (اختياري)</label>
                  <input
                    value={form.seoDescription}
                    onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  />
                  منشور على الموقع
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.showOnLanding}
                    onChange={(e) => setForm((f) => ({ ...f, showOnLanding: e.target.checked }))}
                  />
                  يظهر في قسم المقالات باللاندينغ
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg font-bold disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'جاري الحفظ...' : 'حفظ المقال'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
