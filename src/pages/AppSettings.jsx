import React, { useState, useEffect } from 'react';
import { Save, FileText, Info, Phone, Loader2, ShieldCheck, RefreshCw, Smartphone, UserCog } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-all text-gray-800 placeholder-gray-400';

const TABS = [
  { id: 'terms', label: 'الشروط والأحكام', icon: FileText },
  { id: 'about', label: 'من نحن', icon: Info },
  { id: 'privacy', label: 'سياسة الخصوصية', icon: ShieldCheck },
  { id: 'support', label: 'إعدادات الدعم', icon: Phone },
  { id: 'appVersion', label: 'تحديث التطبيق', icon: RefreshCw },
  { id: 'dualPhones', label: 'أرقام مزدوجة', icon: UserCog },
];

const normalizeExceptionPhone = (phone) => {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('966')) return clean;
  if (clean.startsWith('05') && clean.length === 10) return `966${clean.slice(1)}`;
  if (clean.startsWith('5') && clean.length === 9) return `966${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `966${clean.slice(1)}`;
  return clean;
};

const DEFAULT_APP_VERSION = {
  customer: {
    minVersion: '8.5.0',
    latestVersion: '8.5.0',
    forceUpdate: false,
    androidUrl: 'https://play.google.com/store/apps/details?id=com.londonerazooz.app',
    iosUrl: 'https://apps.apple.com/sa/app/fzaeen-%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86/id6748981486',
    message: 'يتوفر إصدار جديد من التطبيق. يرجى التحديث للمتابعة.',
  },
  provider: {
    minVersion: '3.6.2',
    latestVersion: '3.6.2',
    forceUpdate: false,
    androidUrl: 'https://play.google.com/store/apps/details?id=com.fazaa.provider',
    iosUrl: 'https://apps.apple.com/sa/app/%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86-%D8%A7%D9%84%D9%85%D8%B2%D9%88%D8%AF-fzaeen-provider/id6761298718',
    message: 'يتوفر إصدار جديد من التطبيق. يرجى التحديث للمتابعة.',
  },
};

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
  const [appVersion, setAppVersion] = useState(DEFAULT_APP_VERSION);
  const [dualPhones, setDualPhones] = useState([]);
  const [newDualPhone, setNewDualPhone] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [termsSnap, aboutSnap, privacySnap, supportSnap, appVersionSnap, dualSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'termsAndConditions')),
        getDoc(doc(db, 'settings', 'aboutUs')),
        getDoc(doc(db, 'settings', 'privacyPolicy')),
        getDoc(doc(db, 'settings', 'support')),
        getDoc(doc(db, 'settings', 'appVersion')),
        getDoc(doc(db, 'settings', 'phoneAccountExceptions')),
      ]);
      if (termsSnap.exists()) setTerms(termsSnap.data());
      if (aboutSnap.exists()) setAbout(aboutSnap.data());
      if (privacySnap.exists()) setPrivacy(privacySnap.data());
      if (supportSnap.exists()) setSupport((prev) => ({ ...prev, ...supportSnap.data() }));
      if (appVersionSnap.exists()) {
        const data = appVersionSnap.data();
        setAppVersion((prev) => ({
          customer: { ...prev.customer, ...(data.customer || {}) },
          provider: { ...prev.provider, ...(data.provider || {}) },
        }));
      }
      if (dualSnap.exists()) {
        const phones = Array.isArray(dualSnap.data()?.phones) ? dualSnap.data().phones : [];
        setDualPhones(phones.map(normalizeExceptionPhone).filter(Boolean));
      } else {
        setDualPhones([]);
      }
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
      } else if (activeTab === 'appVersion') {
        await setDoc(doc(db, 'settings', 'appVersion'), { ...appVersion, lastUpdated: new Date().toISOString() });
        alert('تم حفظ إعدادات تحديث التطبيق بنجاح');
      } else if (activeTab === 'dualPhones') {
        const phones = [...new Set(dualPhones.map(normalizeExceptionPhone).filter(Boolean))];
        await setDoc(doc(db, 'settings', 'phoneAccountExceptions'), {
          phones,
          lastUpdated: new Date().toISOString(),
        });
        setDualPhones(phones);
        alert('تم حفظ أرقام الاستثناء (حساب عميل + مزود)');
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
        <p className="text-gray-500 mt-1 text-sm">
          إدارة الشروط وسياسة الخصوصية للموقع (اللاندينغ) والتطبيقات — نفس المحتوى يظهر في الاثنين
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
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

        {activeTab === 'appVersion' && (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-blue-800 text-sm">إجبار تحديث التطبيق</h3>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">
                عند تفعيل «إجبار التحديث»، أي مستخدم يفتح التطبيق بإصدار أقدم من «أقل إصدار مسموح» سيظهر له
                حاجز لا يمكن تجاوزه مع زر يفتح المتجر للتحديث.
              </p>
            </div>

            {[
              { key: 'customer', label: 'تطبيق العميل', accent: 'amber' },
              { key: 'provider', label: 'تطبيق المزود', accent: 'teal' },
            ].map(({ key, label }) => {
              const cfg = appVersion[key] || {};
              const update = (patch) =>
                setAppVersion((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
              return (
                <div key={key} className="border border-gray-200 rounded-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">{label}</h3>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-sm font-semibold text-gray-600">إجبار التحديث</span>
                      <input
                        type="checkbox"
                        checked={!!cfg.forceUpdate}
                        onChange={(e) => update({ forceUpdate: e.target.checked })}
                        className="w-5 h-5 accent-amber-500"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">أقل إصدار مسموح</label>
                      <input
                        type="text"
                        value={cfg.minVersion || ''}
                        onChange={(e) => update({ minVersion: e.target.value.trim() })}
                        className={inputClass}
                        placeholder="مثال: 8.5.0"
                        dir="ltr"
                        style={{ textAlign: 'left' }}
                      />
                      <p className="text-xs text-gray-400 mt-1">من يستخدم إصداراً أقل منه يُجبر على التحديث</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">أحدث إصدار (اختياري)</label>
                      <input
                        type="text"
                        value={cfg.latestVersion || ''}
                        onChange={(e) => update({ latestVersion: e.target.value.trim() })}
                        className={inputClass}
                        placeholder="مثال: 8.6.0"
                        dir="ltr"
                        style={{ textAlign: 'left' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">رابط متجر Google Play</label>
                      <input
                        type="text"
                        value={cfg.androidUrl || ''}
                        onChange={(e) => update({ androidUrl: e.target.value.trim() })}
                        className={inputClass}
                        placeholder="https://play.google.com/store/apps/details?id=..."
                        dir="ltr"
                        style={{ textAlign: 'left' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">رابط متجر App Store (iOS)</label>
                      <input
                        type="text"
                        value={cfg.iosUrl || ''}
                        onChange={(e) => update({ iosUrl: e.target.value.trim() })}
                        className={inputClass}
                        placeholder="https://apps.apple.com/app/id..."
                        dir="ltr"
                        style={{ textAlign: 'left' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">رسالة التحديث</label>
                    <textarea
                      value={cfg.message || ''}
                      onChange={(e) => update({ message: e.target.value })}
                      className={inputClass + ' resize-none'}
                      placeholder="يتوفر إصدار جديد من التطبيق. يرجى التحديث للمتابعة."
                      rows="2"
                      dir="rtl"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'dualPhones' && (
          <div className="p-6 space-y-5">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-950 leading-relaxed">
              بشكل افتراضي: الرقم الواحد إما <strong>عميل</strong> أو <strong>مزود</strong> فقط.
              الأرقام هنا يُسمح لها بإنشاء/استخدام الحسابين معاً (للاختبار أو حالات خاصة).
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                value={newDualPhone}
                onChange={(e) => setNewDualPhone(e.target.value)}
                className={inputClass}
                placeholder="9665XXXXXXXX أو 05XXXXXXXX"
                dir="ltr"
                style={{ textAlign: 'left' }}
              />
              <button
                type="button"
                onClick={() => {
                  const n = normalizeExceptionPhone(newDualPhone);
                  if (!n || n.length < 12) {
                    alert('أدخل رقم سعودي صحيح');
                    return;
                  }
                  if (dualPhones.includes(n)) {
                    alert('الرقم موجود مسبقاً');
                    return;
                  }
                  setDualPhones((prev) => [...prev, n]);
                  setNewDualPhone('');
                }}
                className="shrink-0 px-5 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800"
              >
                إضافة رقم
              </button>
            </div>
            {dualPhones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">لا توجد أرقام استثناء حالياً</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {dualPhones.map((phone) => (
                  <li key={phone} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                    <span className="font-mono text-sm text-gray-800" dir="ltr">
                      {phone}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDualPhones((prev) => prev.filter((p) => p !== phone))}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-400">بعد التعديل اضغط «حفظ التغييرات» لتفعيل القائمة على السيرفر.</p>
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
      {activeTab !== 'support' && activeTab !== 'appVersion' && activeTab !== 'dualPhones' && (
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
