import React, { useEffect, useState } from 'react';
import { Save, Loader2, LayoutTemplate, Link2, Mail, Wrench, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-all text-gray-800 placeholder-gray-400';

const DEFAULT_CONTENT = {
  header: {
    siteName: 'فزاعين',
    logoUrl: '/fzaeen-logo.jpeg',
    adminButtonText: 'لوحة التحكم',
    scrollLinks: [
      { label: 'الرئيسية', href: '#hero' },
      { label: 'خدماتنا', href: '#services' },
      { label: 'نبذة عنا', href: '#why' },
      { label: 'التطبيقات', href: '#apps' },
      { label: 'تواصل معنا', href: '#contact' },
    ],
    pageLinks: [
      { label: 'سياسة الخصوصية', to: '/privacy' },
      { label: 'الشروط والأحكام', to: '/terms' },
    ],
  },
  services: {
    badge: 'الخدمات',
    title: 'ثلاث خدمات تغطي أكثر الأعطال شيوعًا',
    subtitle: 'كلها متاحة في تطبيق واحد - اختر ما تحتاجه وأرسل الطلب',
    cards: [
      {
        title: 'بنشر الإطارات',
        desc: 'سواء كان الإطار فاضي أو طاح كلياً، المزود يجي عندك بالعدة اللازمة.',
        features: ['تغيير الإطار الكامل', 'تركيب الاستبني', 'ضخ هواء', 'فحص باقي الإطارات'],
      },
      {
        title: 'خدمات البطارية',
        desc: 'ما تشغّلت سيارتك؟ نوصّل مزود يشحن البطارية أو يبدّلها في موقعك.',
        features: ['شحن البطارية', 'تشغيل من بطارية ثانية', 'تبديل البطارية', 'فحص الكهرباء'],
      },
      {
        title: 'فتح السيارة',
        desc: 'نسيت المفتاح جوّا؟ متخصصون عندهم أدوات يفتحون سيارتك بأمان.',
        features: ['فتح إلكتروني', 'فتح تقليدي', 'استخراج المفاتيح', 'ضمان بدون ضرر'],
      },
    ],
  },
  hero: {
    badge: '',
    titleLine1: 'سيارتك تستاهل',
    titleLine2: '',
    description: 'مع فزاعين كل خدماتك في مكان واحد',
    primaryButtonText: 'حمل التطبيق الآن!',
    secondaryButtonText: 'كيف يشتغل؟',
    backgroundImage: '/landing-hero.jpg',
    chips: ['بنشر', 'بطارية', 'فتح سيارة'],
  },
  how: {
    badge: 'كيف يشتغل',
    title: 'من التطبيق لباب سيارتك بأربع خطوات',
    steps: [
      { title: 'افتح التطبيق', desc: 'حمّل فزاعين وسجّل دخولك، ما يأخذ أكثر من دقيقتين' },
      { title: 'اختر المشكلة', desc: 'اضغط على نوع الخدمة اللي تحتاجها من القائمة' },
      { title: 'أرسل الطلب', desc: 'يحدد موقعك تلقائيًا ويرسل لأقرب مزود متاح' },
      { title: 'استقبل المزود', desc: 'تابعه على الخريطة حتى يوصل ويُنهي الخدمة' },
    ],
  },
  apps: {
    badge: 'التطبيقات',
    title: 'تطبيقان لكل طرف',
    subtitle: 'عميل يحتاج مساعدة؟ أو مزود يريد يشتغل؟',
    customerTitle: 'تطبيق فزاعين - العملاء',
    customerDesc: 'احتجت مساعدة على الطريق؟ اطلب من التطبيق وراقب المزود على الخريطة وهو يقترب.',
    providerTitle: 'تطبيق فزاعين - المزودون',
    providerDesc: 'انضم لشبكة فزاعين وابدأ تستقبل طلبات في منطقتك. شغّل وقتك ووسّع دخلك.',
    appleHref: 'https://apps.apple.com',
    googleHref: 'https://play.google.com',
  },
  stats: {
    items: [
      { num: '+٥٠٠٠', label: 'مستخدم' },
      { num: '+٢٠٠', label: 'مزود معتمد' },
      { num: '٩٨٪', label: 'رضا العملاء' },
      { num: '١٥ د', label: 'متوسط الوصول' },
    ],
  },
  why: {
    badge: 'ليش فزاعين؟',
    title: 'ما نحن اللي ننفذ - نحن من يوصّلك بمن ينفذ',
    subtitle: 'فزاعين وسيط تقني ذكي. شبكة مزودين موثقين في مناطق مختلفة، يصلونك في أقصر وقت.',
    features: [
      { num: '٢٠٠+', title: 'شبكة واسعة', desc: 'أكثر من ٢٠٠ مزود في أنحاء المدينة، كل واحد موثق بهويته وأدواته.' },
      { num: '٠', title: 'شفافية تامة', desc: 'تعرف السعر قبل ما تؤكد الطلب - لا مفاجآت ولا رسوم مخفية.' },
      { num: '°٣٦٠', title: 'تتبع مباشر', desc: 'الخريطة تتحدث لحظة بلحظة، تشوف المزود وهو يتقرب منك.' },
      { num: '٢٤/٧', title: 'دعم دائم', desc: 'فريق دعم جاهز يرد عليك في أي وقت إذا صار أي شيء.' },
    ],
  },
  testimonials: {
    title: 'ماذا يقول عملاؤنا',
    items: [
      { name: 'أحمد م.', service: 'بنشر إطار', comment: 'وصل المزود خلال ١٢ دقيقة. غيّر الإطار وراح. سريع وما فيه تعقيد.' },
      { name: 'سارة ع.', service: 'بطارية فارغة', comment: 'كانت السيارة ما تشتغل في منطقة مظلمة. فزاعين أنقذني بالحرف الواحد.' },
      { name: 'محمد الشمري', service: 'فتح سيارة', comment: 'نسيت المفتاح جوّا. فتحوا بدون أي خدش والحمد لله. شكرًا جزيلًا.' },
    ],
  },
  contact: {
    title: 'عندك سؤال؟',
    subtitle: 'راسلنا وبنرد عليك بأسرع وقت',
  },
  colors: {
    primary: '#DC2626',
    heroBg: '#0a0a0a',
    darkSectionBg: '#111827',
    lightSectionBg: '#f9fafb',
    footerBg: '#111827',
    cardBg: '#ffffff',
  },
  footer: {
    brandDescription: 'منصة تقنية لمساعدة الطريق - نوصّلك بأقرب مزود خدمة معتمد في لحظات.',
    email: 'support@fzaeen.com',
    copyrightText: 'فزاعين - جميع الحقوق محفوظة',
  },
};

export default function LandingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLegal, setSavingLegal] = useState(false);
  const [legalTab, setLegalTab] = useState('privacy');
  const [content, setContent] = useState({ ...DEFAULT_CONTENT, lastUpdated: null });
  const [privacy, setPrivacy] = useState({ title: 'سياسة الخصوصية', content: '', lastUpdated: null });
  const [terms, setTerms] = useState({ title: 'الشروط والأحكام', content: '', lastUpdated: null });

  const loadData = async () => {
    setLoading(true);
    try {
      const [snap, privacySnap, termsSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'landingContent')),
        getDoc(doc(db, 'settings', 'privacyPolicy')),
        getDoc(doc(db, 'settings', 'termsAndConditions')),
      ]);
      if (snap.exists()) {
        const d = snap.data();
        setContent({
          ...DEFAULT_CONTENT,
          ...d,
          header: { ...DEFAULT_CONTENT.header, ...(d.header || {}) },
          services: { ...DEFAULT_CONTENT.services, ...(d.services || {}) },
          hero: { ...DEFAULT_CONTENT.hero, ...(d.hero || {}) },
          how: { ...DEFAULT_CONTENT.how, ...(d.how || {}) },
          apps: { ...DEFAULT_CONTENT.apps, ...(d.apps || {}) },
          stats: { ...DEFAULT_CONTENT.stats, ...(d.stats || {}) },
          why: { ...DEFAULT_CONTENT.why, ...(d.why || {}) },
          testimonials: { ...DEFAULT_CONTENT.testimonials, ...(d.testimonials || {}) },
          contact: { ...DEFAULT_CONTENT.contact, ...(d.contact || {}) },
          colors: { ...DEFAULT_CONTENT.colors, ...(d.colors || {}) },
          footer: { ...DEFAULT_CONTENT.footer, ...(d.footer || {}) },
          lastUpdated: d.lastUpdated || null,
        });
      }
      if (privacySnap.exists()) setPrivacy((prev) => ({ ...prev, ...privacySnap.data() }));
      if (termsSnap.exists()) setTerms((prev) => ({ ...prev, ...termsSnap.data() }));
    } catch (error) {
      console.error('Error loading landing settings:', error);
      alert('فشل تحميل إعدادات الصفحة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'landingContent'), {
        ...content,
        lastUpdated: new Date().toISOString(),
      });
      alert('تم حفظ محتوى اللاندنق بيج بنجاح');
      await loadData();
    } catch (error) {
      console.error('Error saving landing settings:', error);
      alert('فشل حفظ المحتوى');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLegal = async () => {
    setSavingLegal(true);
    try {
      if (legalTab === 'privacy') {
        await setDoc(doc(db, 'settings', 'privacyPolicy'), {
          ...privacy,
          lastUpdated: new Date().toISOString(),
        });
        alert('تم حفظ سياسة الخصوصية — تظهر في الموقع والتطبيق');
      } else {
        await setDoc(doc(db, 'settings', 'termsAndConditions'), {
          ...terms,
          lastUpdated: new Date().toISOString(),
        });
        alert('تم حفظ الشروط والأحكام — تظهر في الموقع والتطبيق');
      }
      await loadData();
    } catch (error) {
      console.error('Error saving legal content:', error);
      alert('فشل حفظ المحتوى القانوني');
    } finally {
      setSavingLegal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent" />
        <p className="text-sm text-gray-500">جاري تحميل إعدادات الصفحة...</p>
      </div>
    );
  }

  const setHeader = (patch) => setContent((p) => ({ ...p, header: { ...p.header, ...patch } }));
  const setFooter = (patch) => setContent((p) => ({ ...p, footer: { ...p.footer, ...patch } }));
  const setServices = (patch) => setContent((p) => ({ ...p, services: { ...p.services, ...patch } }));
  const setHero = (patch) => setContent((p) => ({ ...p, hero: { ...p.hero, ...patch } }));
  const setHow = (patch) => setContent((p) => ({ ...p, how: { ...p.how, ...patch } }));
  const setApps = (patch) => setContent((p) => ({ ...p, apps: { ...p.apps, ...patch } }));
  const setStats = (patch) => setContent((p) => ({ ...p, stats: { ...p.stats, ...patch } }));
  const setWhy = (patch) => setContent((p) => ({ ...p, why: { ...p.why, ...patch } }));
  const setTestimonials = (patch) => setContent((p) => ({ ...p, testimonials: { ...p.testimonials, ...patch } }));
  const setContact = (patch) => setContent((p) => ({ ...p, contact: { ...p.contact, ...patch } }));
  const setColors = (patch) => setContent((p) => ({ ...p, colors: { ...p.colors, ...patch } }));

  const updateScrollLink = (idx, key, value) => {
    const links = [...(content.header.scrollLinks || [])];
    links[idx] = { ...links[idx], [key]: value };
    setHeader({ scrollLinks: links });
  };

  const updateServiceCard = (idx, key, value) => {
    const cards = [...(content.services.cards || [])];
    cards[idx] = { ...cards[idx], [key]: value };
    setServices({ cards });
  };

  const updateStatItem = (idx, key, value) => {
    const items = [...(content.stats.items || [])];
    items[idx] = { ...items[idx], [key]: value };
    setStats({ items });
  };

  const updateWhyFeature = (idx, key, value) => {
    const features = [...(content.why.features || [])];
    features[idx] = { ...features[idx], [key]: value };
    setWhy({ features });
  };

  const updateHowStep = (idx, key, value) => {
    const steps = [...(content.how.steps || [])];
    steps[idx] = { ...steps[idx], [key]: value };
    setHow({ steps });
  };

  const updateTestimonial = (idx, key, value) => {
    const items = [...(content.testimonials.items || [])];
    items[idx] = { ...items[idx], [key]: value };
    setTestimonials({ items });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إعدادات اللاندنق بيج</h1>
        <p className="text-gray-500 mt-1 text-sm">
          عدّل الهيدر، الخدمات، الفوتر، وسياسة الخصوصية والشروط من هنا. التغييرات تظهر مباشرة في الموقع.
        </p>
      </div>

      {/* Legal pages for landing website */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              سياسة الخصوصية والشروط والأحكام
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              المحتوى يظهر في صفحات الموقع <span className="font-mono text-xs">/privacy</span> و{' '}
              <span className="font-mono text-xs">/terms</span> — وأيضاً في التطبيقات.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={legalTab === 'privacy' ? '/privacy' : '/terms'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl hover:bg-amber-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              معاينة الصفحة
            </a>
          </div>
        </div>

        <div className="px-6 pt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLegalTab('privacy')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              legalTab === 'privacy' ? 'bg-amber-400 text-gray-950' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            سياسة الخصوصية
          </button>
          <button
            type="button"
            onClick={() => setLegalTab('terms')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              legalTab === 'terms' ? 'bg-amber-400 text-gray-950' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            الشروط والأحكام
          </button>
        </div>

        <div className="p-6 space-y-5">
          {legalTab === 'privacy' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان الصفحة</label>
                <input
                  type="text"
                  value={privacy.title || ''}
                  onChange={(e) => setPrivacy((p) => ({ ...p, title: e.target.value }))}
                  className={inputClass}
                  placeholder="سياسة الخصوصية"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">محتوى سياسة الخصوصية</label>
                <textarea
                  value={privacy.content || ''}
                  onChange={(e) => setPrivacy((p) => ({ ...p, content: e.target.value }))}
                  className={`${inputClass} resize-y min-h-[280px]`}
                  placeholder="اكتب سياسة الخصوصية هنا..."
                  rows={14}
                  dir="rtl"
                  style={{ lineHeight: '1.8' }}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان الصفحة</label>
                <input
                  type="text"
                  value={terms.title || ''}
                  onChange={(e) => setTerms((p) => ({ ...p, title: e.target.value }))}
                  className={inputClass}
                  placeholder="الشروط والأحكام"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">محتوى الشروط والأحكام</label>
                <textarea
                  value={terms.content || ''}
                  onChange={(e) => setTerms((p) => ({ ...p, content: e.target.value }))}
                  className={`${inputClass} resize-y min-h-[280px]`}
                  placeholder="اكتب الشروط والأحكام هنا..."
                  rows={14}
                  dir="rtl"
                  style={{ lineHeight: '1.8' }}
                />
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-gray-400">
              {(legalTab === 'privacy' ? privacy.lastUpdated : terms.lastUpdated)
                ? `آخر حفظ: ${new Date(legalTab === 'privacy' ? privacy.lastUpdated : terms.lastUpdated).toLocaleString('ar-SA')}`
                : 'لم يُحفظ محتوى مخصص بعد — الموقع يعرض النص الافتراضي'}
            </p>
            <button
              type="button"
              onClick={handleSaveLegal}
              disabled={savingLegal}
              className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-60"
            >
              {savingLegal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ {legalTab === 'privacy' ? 'سياسة الخصوصية' : 'الشروط والأحكام'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 text-gray-800 font-bold">
          <LayoutTemplate className="w-5 h-5 text-amber-500" />
          محتوى الهيدر
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input className={inputClass} value={content.header.siteName || ''} onChange={(e) => setHeader({ siteName: e.target.value })} placeholder="اسم الموقع" />
          <input className={inputClass} value={content.header.logoUrl || ''} onChange={(e) => setHeader({ logoUrl: e.target.value })} placeholder="رابط الشعار" />
          <input className={inputClass} value={content.header.adminButtonText || ''} onChange={(e) => setHeader({ adminButtonText: e.target.value })} placeholder="نص زر لوحة التحكم" />
        </div>

        <div className="flex items-center gap-2 text-gray-800 font-bold mt-4">
          <Link2 className="w-5 h-5 text-amber-500" />
          روابط القائمة الرئيسية
        </div>
        <div className="space-y-3">
          {(content.header.scrollLinks || []).map((link, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className={inputClass} value={link.label || ''} onChange={(e) => updateScrollLink(idx, 'label', e.target.value)} placeholder="اسم الرابط" />
              <input className={inputClass} value={link.href || ''} onChange={(e) => updateScrollLink(idx, 'href', e.target.value)} placeholder="#hero" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 text-gray-800 font-bold">
          <Wrench className="w-5 h-5 text-amber-500" />
          محتوى قسم الخدمات
        </div>
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className={inputClass} value={content.services.badge || ''} onChange={(e) => setServices({ badge: e.target.value })} placeholder="Badge" />
            <input className={inputClass} value={content.services.title || ''} onChange={(e) => setServices({ title: e.target.value })} placeholder="عنوان القسم" />
            <input className={inputClass} value={content.services.subtitle || ''} onChange={(e) => setServices({ subtitle: e.target.value })} placeholder="وصف القسم" />
          </div>
        </div>
        <div className="space-y-4">
          {(content.services.cards || []).map((card, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="font-semibold text-sm text-gray-700">خدمة {idx + 1}</div>
              <input className={inputClass} value={card.title || ''} onChange={(e) => updateServiceCard(idx, 'title', e.target.value)} placeholder="عنوان الخدمة" />
              <textarea className={inputClass + ' resize-none'} rows={3} value={card.desc || ''} onChange={(e) => updateServiceCard(idx, 'desc', e.target.value)} placeholder="وصف الخدمة" />
              <textarea
                className={inputClass + ' resize-none'}
                rows={4}
                value={(card.features || []).join('\n')}
                onChange={(e) => updateServiceCard(idx, 'features', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))}
                placeholder={'ميزة 1\nميزة 2\nميزة 3'}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="font-bold text-gray-800">Hero (أول شاشة + زر التحميل)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={inputClass} value={content.hero.titleLine1 || ''} onChange={(e) => setHero({ titleLine1: e.target.value })} placeholder="العنوان الرئيسي" />
          <input className={inputClass} value={content.hero.titleLine2 || ''} onChange={(e) => setHero({ titleLine2: e.target.value })} placeholder="سطر عنوان إضافي (اختياري)" />
          <input className={inputClass} value={content.hero.primaryButtonText || ''} onChange={(e) => setHero({ primaryButtonText: e.target.value })} placeholder="نص زر التحميل" />
          <input className={inputClass} value={(content.hero.chips || []).join('، ')} onChange={(e) => setHero({ chips: e.target.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean) })} placeholder="شارات الخدمات (مفصولة بفاصلة): بنشر، بطارية، فتح سيارة" />
        </div>
        <textarea className={inputClass + ' resize-none'} rows={2} value={content.hero.description || ''} onChange={(e) => setHero({ description: e.target.value })} placeholder="الوصف تحت العنوان" />
        <input className={inputClass} value={content.hero.backgroundImage || ''} onChange={(e) => setHero({ backgroundImage: e.target.value })} placeholder="رابط صورة خلفية الهيرو (full-bleed)" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="font-bold text-gray-800">How It Works</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={inputClass} value={content.how.badge || ''} onChange={(e) => setHow({ badge: e.target.value })} placeholder="Badge" />
          <input className={inputClass} value={content.how.title || ''} onChange={(e) => setHow({ title: e.target.value })} placeholder="عنوان القسم" />
        </div>
        <div className="space-y-3">
          {(content.how.steps || []).map((step, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-gray-200 rounded-xl p-3">
              <input className={inputClass} value={step.title || ''} onChange={(e) => updateHowStep(idx, 'title', e.target.value)} placeholder={`خطوة ${idx + 1} - العنوان`} />
              <input className={inputClass} value={step.desc || ''} onChange={(e) => updateHowStep(idx, 'desc', e.target.value)} placeholder={`خطوة ${idx + 1} - الوصف`} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="font-bold text-gray-800">Apps</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={inputClass} value={content.apps.badge || ''} onChange={(e) => setApps({ badge: e.target.value })} placeholder="Badge" />
          <input className={inputClass} value={content.apps.title || ''} onChange={(e) => setApps({ title: e.target.value })} placeholder="عنوان القسم" />
          <input className={inputClass} value={content.apps.subtitle || ''} onChange={(e) => setApps({ subtitle: e.target.value })} placeholder="وصف القسم" />
        </div>
        <input className={inputClass} value={content.apps.customerTitle || ''} onChange={(e) => setApps({ customerTitle: e.target.value })} placeholder="عنوان تطبيق العملاء" />
        <textarea className={inputClass + ' resize-none'} rows={2} value={content.apps.customerDesc || ''} onChange={(e) => setApps({ customerDesc: e.target.value })} placeholder="وصف تطبيق العملاء" />
        <input className={inputClass} value={content.apps.providerTitle || ''} onChange={(e) => setApps({ providerTitle: e.target.value })} placeholder="عنوان تطبيق المزودين" />
        <textarea className={inputClass + ' resize-none'} rows={2} value={content.apps.providerDesc || ''} onChange={(e) => setApps({ providerDesc: e.target.value })} placeholder="وصف تطبيق المزودين" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={inputClass} value={content.apps.appleHref || ''} onChange={(e) => setApps({ appleHref: e.target.value })} placeholder="رابط App Store" />
          <input className={inputClass} value={content.apps.googleHref || ''} onChange={(e) => setApps({ googleHref: e.target.value })} placeholder="رابط Google Play" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-gray-800 font-bold">
          <Mail className="w-5 h-5 text-amber-500" />
          محتوى الفوتر
        </div>
        <textarea className={inputClass + ' resize-none'} rows={3} value={content.footer.brandDescription || ''} onChange={(e) => setFooter({ brandDescription: e.target.value })} placeholder="وصف الفوتر" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={inputClass} value={content.footer.email || ''} onChange={(e) => setFooter({ email: e.target.value })} placeholder="البريد" />
          <input className={inputClass} value={content.footer.copyrightText || ''} onChange={(e) => setFooter({ copyrightText: e.target.value })} placeholder="نص الحقوق" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-gray-800 font-bold">إحصائيات الصفحة</div>
        <p className="text-xs text-gray-500">تعديل (+٥٠٠٠ مستخدم، +٢٠٠ مزود...) من هنا مباشرة.</p>
        <div className="space-y-3">
          {(content.stats.items || []).map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-gray-200 rounded-xl p-3">
              <input className={inputClass} value={item.num || ''} onChange={(e) => updateStatItem(idx, 'num', e.target.value)} placeholder="القيمة (مثال: +٥٠٠٠)" />
              <input className={inputClass} value={item.label || ''} onChange={(e) => updateStatItem(idx, 'label', e.target.value)} placeholder="الوصف (مثال: مستخدم)" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-gray-800 font-bold">قسم "ليش فزاعين؟"</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={inputClass} value={content.why.badge || ''} onChange={(e) => setWhy({ badge: e.target.value })} placeholder="Badge" />
          <input className={inputClass} value={content.why.title || ''} onChange={(e) => setWhy({ title: e.target.value })} placeholder="العنوان" />
          <input className={inputClass} value={content.why.subtitle || ''} onChange={(e) => setWhy({ subtitle: e.target.value })} placeholder="الوصف" />
        </div>
        <div className="space-y-3">
          {(content.why.features || []).map((f, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-3">
              <div className="font-semibold text-sm text-gray-700">ميزة {idx + 1}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputClass} value={f.num || ''} onChange={(e) => updateWhyFeature(idx, 'num', e.target.value)} placeholder="الرقم" />
                <input className={inputClass} value={f.title || ''} onChange={(e) => updateWhyFeature(idx, 'title', e.target.value)} placeholder="العنوان" />
              </div>
              <textarea className={inputClass + ' resize-none'} rows={3} value={f.desc || ''} onChange={(e) => updateWhyFeature(idx, 'desc', e.target.value)} placeholder="الوصف" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="font-bold text-gray-800">Testimonials</div>
        <input className={inputClass} value={content.testimonials.title || ''} onChange={(e) => setTestimonials({ title: e.target.value })} placeholder="عنوان قسم آراء العملاء" />
        <div className="space-y-3">
          {(content.testimonials.items || []).map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-3">
              <div className="font-semibold text-sm text-gray-700">رأي {idx + 1}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputClass} value={item.name || ''} onChange={(e) => updateTestimonial(idx, 'name', e.target.value)} placeholder="اسم العميل" />
                <input className={inputClass} value={item.service || ''} onChange={(e) => updateTestimonial(idx, 'service', e.target.value)} placeholder="نوع الخدمة" />
              </div>
              <textarea className={inputClass + ' resize-none'} rows={3} value={item.comment || ''} onChange={(e) => updateTestimonial(idx, 'comment', e.target.value)} placeholder="تعليق العميل" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="font-bold text-gray-800">Contact</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={inputClass} value={content.contact.title || ''} onChange={(e) => setContact({ title: e.target.value })} placeholder="عنوان التواصل" />
          <input className={inputClass} value={content.contact.subtitle || ''} onChange={(e) => setContact({ subtitle: e.target.value })} placeholder="وصف التواصل" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="font-bold text-gray-800">ألوان اللاندنق بيج</div>
        <p className="text-xs text-gray-500">أي تغيير هنا ينعكس مباشرة على الصفحة.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700">
            اللون الأساسي
            <input type="color" className="w-full h-10 mt-2 rounded-lg border border-gray-200" value={content.colors?.primary || '#fbbf24'} onChange={(e) => setColors({ primary: e.target.value })} />
          </label>
          <label className="text-sm text-gray-700">
            خلفية Hero
            <input type="color" className="w-full h-10 mt-2 rounded-lg border border-gray-200" value={content.colors?.heroBg || '#111827'} onChange={(e) => setColors({ heroBg: e.target.value })} />
          </label>
          <label className="text-sm text-gray-700">
            خلفية الأقسام الداكنة
            <input type="color" className="w-full h-10 mt-2 rounded-lg border border-gray-200" value={content.colors?.darkSectionBg || '#111827'} onChange={(e) => setColors({ darkSectionBg: e.target.value })} />
          </label>
          <label className="text-sm text-gray-700">
            خلفية الأقسام الفاتحة
            <input type="color" className="w-full h-10 mt-2 rounded-lg border border-gray-200" value={content.colors?.lightSectionBg || '#f9fafb'} onChange={(e) => setColors({ lightSectionBg: e.target.value })} />
          </label>
          <label className="text-sm text-gray-700">
            خلفية الفوتر
            <input type="color" className="w-full h-10 mt-2 rounded-lg border border-gray-200" value={content.colors?.footerBg || '#111827'} onChange={(e) => setColors({ footerBg: e.target.value })} />
          </label>
          <label className="text-sm text-gray-700">
            خلفية البطاقات
            <input type="color" className="w-full h-10 mt-2 rounded-lg border border-gray-200" value={content.colors?.cardBg || '#ffffff'} onChange={(e) => setColors({ cardBg: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {content.lastUpdated ? `آخر تحديث: ${new Date(content.lastUpdated).toLocaleString('ar-SA')}` : 'لم يتم الحفظ بعد'}
        </div>
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
  );
}

