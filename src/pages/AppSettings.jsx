import React, { useState, useEffect } from 'react';
import { Save, FileText, Info, Phone, Loader2, ShieldCheck } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-all text-gray-800 placeholder-gray-400';

const TABS = [
  { id: 'terms', label: 'الشروط والأحكام', icon: FileText },
  { id: 'about', label: 'من نحن', icon: Info },
  { id: 'privacy', label: 'سياسة الخصوصية', icon: ShieldCheck },
  { id: 'support', label: 'إعدادات الدعم', icon: Phone },
];

export default function AppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('terms');

  const [terms, setTerms] = useState({ title: 'الشروط والأحكام', content: '', lastUpdated: null });
  const [about, setAbout] = useState({ title: 'من نحن', content: '', lastUpdated: null });
  const [privacy, setPrivacy] = useState({ title: 'سياسة الخصوصية', content: '', lastUpdated: null });
  const [support, setSupport] = useState({
    whatsappNumber: '966551780608',
    whatsappDisplay: '+966 55 178 0608',
    providerChargeWhatsappNumber: '966539741002',
    providerChargeWhatsappDisplay: '+966 53 974 1002',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [termsSnap, aboutSnap, privacySnap, supportSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'termsAndConditions')),
        getDoc(doc(db, 'settings', 'aboutUs')),
        getDoc(doc(db, 'settings', 'privacyPolicy')),
        getDoc(doc(db, 'settings', 'support')),
      ]);
      if (termsSnap.exists()) setTerms(termsSnap.data());
      if (aboutSnap.exists()) setAbout(aboutSnap.data());
      if (privacySnap.exists()) setPrivacy(privacySnap.data());
      if (supportSnap.exists()) setSupport((prev) => ({ ...prev, ...supportSnap.data() }));
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'terms') {
        await setDoc(doc(db, 'settings', 'termsAndConditions'), { ...terms, lastUpdated: new Date().toISOString() });
        alert('تم حفظ الشروط والأحكام بنجاح');
      } else if (activeTab === 'about') {
        await setDoc(doc(db, 'settings', 'aboutUs'), { ...about, lastUpdated: new Date().toISOString() });
        alert('تم حفظ بيانات "من نحن" بنجاح');
      } else if (activeTab === 'privacy') {
        await setDoc(doc(db, 'settings', 'privacyPolicy'), { ...privacy, lastUpdated: new Date().toISOString() });
        alert('تم حفظ سياسة الخصوصية بنجاح');
      } else if (activeTab === 'support') {
        await setDoc(doc(db, 'settings', 'support'), { ...support, lastUpdated: new Date().toISOString() });
        alert('تم حفظ إعدادات الدعم بنجاح');
      }
      loadData();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('فشل حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent" />
        <p className="text-sm text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  const currentLastUpdated =
    activeTab === 'terms'
      ? terms.lastUpdated
      : activeTab === 'about'
        ? about.lastUpdated
        : activeTab === 'privacy'
          ? privacy.lastUpdated
          : support.lastUpdated;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إعدادات المحتوى</h1>
        <p className="text-gray-500 mt-1 text-sm">إدارة الشروط والأحكام ومعلومات "من نحن" في التطبيق</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === id
                ? 'bg-amber-400 text-gray-950 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {activeTab === 'terms' && (
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان الصفحة</label>
              <input
                type="text"
                value={terms.title}
                onChange={(e) => setTerms((p) => ({ ...p, title: e.target.value }))}
                className={inputClass}
                placeholder="مثال: الشروط والأحكام"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">محتوى الشروط والأحكام</label>
              <textarea
                value={terms.content}
                onChange={(e) => setTerms((p) => ({ ...p, content: e.target.value }))}
                className={inputClass + ' resize-none'}
                placeholder="اكتب الشروط والأحكام هنا..."
                rows="14"
                dir="rtl"
                style={{ lineHeight: '1.8' }}
              />
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان الصفحة</label>
              <input
                type="text"
                value={about.title}
                onChange={(e) => setAbout((p) => ({ ...p, title: e.target.value }))}
                className={inputClass}
                placeholder="مثال: من نحن"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">معلومات عن التطبيق</label>
              <textarea
                value={about.content}
                onChange={(e) => setAbout((p) => ({ ...p, content: e.target.value }))}
                className={inputClass + ' resize-none'}
                placeholder="اكتب معلومات عن التطبيق هنا..."
                rows="14"
                dir="rtl"
                style={{ lineHeight: '1.8' }}
              />
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان الصفحة</label>
              <input
                type="text"
                value={privacy.title}
                onChange={(e) => setPrivacy((p) => ({ ...p, title: e.target.value }))}
                className={inputClass}
                placeholder="مثال: سياسة الخصوصية"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">محتوى سياسة الخصوصية</label>
              <textarea
                value={privacy.content}
                onChange={(e) => setPrivacy((p) => ({ ...p, content: e.target.value }))}
                className={inputClass + ' resize-none'}
                placeholder="اكتب سياسة الخصوصية هنا..."
                rows="14"
                dir="rtl"
                style={{ lineHeight: '1.8' }}
              />
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="p-6 space-y-6">
            {/* Customer Support */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-amber-800 text-sm">رقم واتساب الدعم</h3>
              </div>
              <p className="text-xs text-amber-700">هذا الرقم سيظهر في شاشة الدعم في تطبيق العميل</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الواتساب (بدون +، مع كود الدولة)</label>
                <input
                  type="text"
                  value={support.whatsappNumber}
                  onChange={(e) => setSupport((p) => ({ ...p, whatsappNumber: e.target.value }))}
                  className={inputClass}
                  placeholder="966551780608"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
                <p className="text-xs text-gray-400 mt-1">مثال: 966551780608</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الرقم كما يظهر للعميل</label>
                <input
                  type="text"
                  value={support.whatsappDisplay}
                  onChange={(e) => setSupport((p) => ({ ...p, whatsappDisplay: e.target.value }))}
                  className={inputClass}
                  placeholder="+966 55 178 0608"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
              </div>
            </div>

            {/* Provider Charge */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-gray-600" />
                <h3 className="font-bold text-gray-800 text-sm">رقم واتساب شحن محفظة المزود</h3>
              </div>
              <p className="text-xs text-gray-600">
                يستخدم عند الضغط على زر <span className="font-mono bg-gray-200 px-1 rounded">طلب إضافة رصيد</span> في تطبيق المزود
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الواتساب (بدون +، مع كود الدولة)</label>
                <input
                  type="text"
                  value={support.providerChargeWhatsappNumber}
                  onChange={(e) => setSupport((p) => ({ ...p, providerChargeWhatsappNumber: e.target.value }))}
                  className={inputClass}
                  placeholder="966539741002"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
                <p className="text-xs text-gray-400 mt-1">مثال: 966539741002</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الرقم كما يظهر للمزود (اختياري)</label>
                <input
                  type="text"
                  value={support.providerChargeWhatsappDisplay}
                  onChange={(e) => setSupport((p) => ({ ...p, providerChargeWhatsappDisplay: e.target.value }))}
                  className={inputClass}
                  placeholder="+966 53 974 1002"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          {currentLastUpdated ? (
            <p className="text-xs text-gray-400">
              آخر تحديث:{' '}
              {new Date(currentLastUpdated).toLocaleString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : (
            <span />
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 text-gray-950 rounded-xl font-bold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* Preview - only for terms and about */}
      {activeTab !== 'support' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">معاينة المحتوى</h2>
          </div>
          <div className="p-6 bg-gray-50">
            <div className="bg-white p-6 rounded-xl border border-gray-200 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold text-amber-500 mb-4 text-center border-b border-amber-200 pb-3">
                {activeTab === 'terms' ? terms.title : activeTab === 'about' ? about.title : privacy.title}
              </h3>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-right text-sm" dir="rtl">
                {(activeTab === 'terms' ? terms.content : activeTab === 'about' ? about.content : privacy.content) || (
                  <span className="text-gray-300 italic">لا يوجد محتوى بعد...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
