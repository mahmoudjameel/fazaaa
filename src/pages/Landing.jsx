import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  Zap, MapPin, Clock, ChevronDown,
  CheckCircle, Mail, Menu, X,
  Battery, Wrench, Key, AlertTriangle, Users, Award,
  Download, Globe, Smartphone, Phone, ArrowLeft, FileText, MessageCircle, Send, Loader2
} from 'lucide-react';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { LandingSplash } from '../components/LandingSplash';
import { LandingSeoSection } from '../components/LandingSeoSection';
import { LandingArticlesSection } from '../components/LandingArticlesSection';
import { SeoHead } from '../components/SeoHead';
import { buildHomeJsonLd, PAGE_SEO } from '../seo/config';
import { db } from '../services/firebase';
import { useMarketingPageView } from '../hooks/useMarketingPageView';
import { useLandingDownloadTracking } from '../hooks/useLandingDownloadTracking';

const SCROLL_LINKS = [
  { label: 'الرئيسية', href: '#hero' },
  { label: 'خدماتنا', href: '#services' },
  { label: 'نبذة عنا', href: '#why' },
  { label: 'المقالات', to: '/blog' },
  { label: 'التطبيقات', href: '#apps' },
  { label: 'تواصل معنا', href: '#contact' },
];

const PAGE_LINKS = [
  { label: 'المقالات', to: '/blog' },
  { label: 'سياسة الخصوصية', to: '/privacy' },
  { label: 'الشروط والأحكام', to: '/terms' },
  { label: 'الدعم', to: '/support' },
  { label: 'طلب حذف الحساب', to: '/delete-account' },
];

const NAV_LINKS = SCROLL_LINKS;

const ARTICLES_NAV = { label: 'المقالات', to: '/blog' };

/** يضمن ظهور تاب المقالات حتى لو روابط Firestore قديمة بدونها */
function withArticlesNav(links) {
  const list = Array.isArray(links) && links.length ? links.map((l) => ({ ...l })) : [...SCROLL_LINKS];
  const isArticles = (l) =>
    l?.to === '/blog' ||
    l?.href === '#articles' ||
    l?.href === '/blog' ||
    l?.label === 'المقالات' ||
    l?.label === 'مقالات';

  const idx = list.findIndex(isArticles);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...ARTICLES_NAV };
    return list;
  }

  const contactIdx = list.findIndex((l) => l.href === '#contact' || l.label === 'تواصل معنا');
  if (contactIdx >= 0) list.splice(contactIdx, 0, ARTICLES_NAV);
  else list.push(ARTICLES_NAV);
  return list;
}

const DEFAULT_HERO_BG = '/landing-hero.jpg';

const DEFAULT_LANDING_CONTENT = {
  header: {
    siteName: 'فزاعين',
    logoUrl: '/fzaeen-logo.jpeg',
    adminButtonText: 'لوحة التحكم',
    joinProviderText: 'انضم إلينا كمزود',
    contactButtonText: 'تواصل معنا',
    scrollLinks: SCROLL_LINKS,
    pageLinks: PAGE_LINKS,
  },
  hero: {
    badge: '',
    titleLine1: 'سيارتك تستاهل',
    titleLine2: '',
    description: 'مع فزاعين كل خدماتك في مكان واحد',
    primaryButtonText: 'حمل التطبيق الآن!',
    secondaryButtonText: 'كيف يشتغل؟',
    backgroundImage: DEFAULT_HERO_BG,
    chips: ['بنشر', 'بطارية', 'فتح سيارة'],
  },
  services: {
    badge: 'الخدمات',
    title: 'ثلاث خدمات طوارئ للسيارات في السعودية',
    subtitle: 'بنشر متنقل، بطارية، وفتح سيارة — كلها من تطبيق واحد في أنحاء المملكة',
    cards: [
      {
        title: 'بنشر الإطارات المتنقل',
        desc: 'بنشر متنقل في موقعك: نفخ كفر، تغيير الاحتياطي، رقعة كفر خارجية، وتغيير الكفر عند البنشر.',
        features: ['نفخ كفر', 'تغيير الاحتياطي', 'رقعة كفر خارجية', 'تغيير الكفر عند البنشر'],
      },
      {
        title: 'خدمات البطارية المتنقلة',
        desc: 'اشتراك بطارية أو تبديل بطارية في موقعك داخل السعودية عبر مزود معتمد من فزاعين.',
        features: ['اشتراك بطارية', 'تبديل بطارية'],
      },
      {
        title: 'فتح السيارة المقفلة',
        desc: 'نسيت المفتاح جوّا؟ متخصصون يفتحون سيارتك بأمان قدر الإمكان في أنحاء المملكة.',
        features: ['فتح إلكتروني', 'فتح تقليدي', 'استخراج المفاتيح', 'ضمان بدون ضرر'],
      },
    ],
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
    providerTitle: 'تطبيق فزاعين - مزود الخدمة',
    providerDesc: 'انضم لشبكة فزاعين وابدأ تستقبل طلبات في منطقتك. شغّل وقتك ووسّع دخلك.',
    appleHref: 'https://apps.apple.com/sa/app/fzaeen-%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86/id6748981486',
    googleHref: 'https://play.google.com/store/apps/details?id=com.londonerazooz.app',
    providerGoogleHref: 'https://play.google.com/store/apps/details?id=com.fazaa.provider',
    providerAppleHref: 'https://apps.apple.com/sa/app/%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86-%D8%A7%D9%84%D9%85%D8%B2%D9%88%D8%AF-fzaeen-provider/id6761298718',
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
    subtitle: 'فزاعين وسيط تقني ذكي. شبكة مزودين موثقين في أنحاء المملكة، يصلونك في أقصر وقت.',
    features: [
      { title: 'شبكة واسعة', desc: 'شبكة مزودين موثقين في أنحاء المملكة، كل واحد موثق بهويته وأدواته.' },
      { title: 'شفافية تامة', desc: 'تعرف السعر قبل ما تؤكد الطلب - لا مفاجآت ولا رسوم مخفية.' },
      { title: 'تتبع مباشر', desc: 'الخريطة تتحدث لحظة بلحظة، تشوف المزود وهو يقترب منك.' },
      { title: 'دعم دائم', desc: 'فريق دعم جاهز يرد عليك في أي وقت إذا صار أي شيء.' },
    ],
  },
  contact: {
    title: 'عندك سؤال؟',
    subtitle: 'تواصل معنا',
    formHint: 'زوّدنا ببياناتك بالنموذج أدناه، وفريقنا يتواصل معك خلال ٢٤ ساعة.',
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
    brandDescription: 'منصة تقنية للمساعدة على الطريق - نوصّلك بأقرب مزود خدمة معتمد في لحظات.',
    email: 'fzaeen@fzaeen.com',
    copyrightText: 'فزاعين - جميع الحقوق محفوظة',
  },
};

const GooglePlayIcon = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden>
    <path fill="#4285F4" d="M1.71 23.1c-.22-.22-.35-.52-.35-.85V1.75c0-.33.13-.63.35-.85L12.29 12 1.71 23.1z" />
    <path fill="#34A853" d="M21.24 10.86 17.41 8.65l-3.63 3.63 3.63 3.63 3.83-2.21c1.01-.66 1.01-2.1 0-2.84z" />
    <path fill="#FBBC04" d="m16.12 15.71-11.36 6.61 8.32-8.32 3.04 1.71z" />
    <path fill="#EA4335" d="m16.12 8.29-3.04 3.03L4.76 1.68l11.36 6.61z" />
  </svg>
);

/** يختار رابط المتجر حسب نظام الجهاز (آيفون / أندرويد) */
const getStoreHrefForDevice = (appleHref, googleHref) => {
  if (typeof navigator === 'undefined') return googleHref;
  const ua = navigator.userAgent || navigator.vendor || '';
  // iPadOS قد يظهر كـ Mac
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return appleHref;
  if (/android/i.test(ua)) return googleHref;
  // سطح المكتب: Google Play افتراضياً (شارات المتجرين تحت الزر)
  return googleHref;
};

const StoreBadge = ({ type, href, appRole = 'customer', section = 'hero_store_badge' }) => {
  if (type === 'apple') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-download-section={section}
        data-download-app={appRole}
        data-download-store="apple"
        className="inline-flex items-center gap-2.5 bg-black text-white rounded-xl px-4 py-2.5 border border-white/20 hover:bg-neutral-900 transition-colors shadow-lg"
        aria-label="App Store"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current shrink-0" aria-hidden>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        <div className="text-left leading-tight" dir="ltr">
          <div className="text-[10px] text-white/70">Download on the</div>
          <div className="text-sm font-bold -mt-0.5">App Store</div>
        </div>
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-download-section={section}
      data-download-app={appRole}
      data-download-store="google"
      className="inline-flex items-center gap-2.5 bg-black text-white rounded-xl px-4 py-2.5 border border-white/20 hover:bg-neutral-900 transition-colors shadow-lg"
      aria-label="Google Play"
    >
      <GooglePlayIcon className="w-7 h-7" />
      <div className="text-left leading-tight" dir="ltr">
        <div className="text-[10px] text-white/70">GET IT ON</div>
        <div className="text-sm font-bold -mt-0.5">Google Play</div>
      </div>
    </a>
  );
};

export const Landing = () => {
  useMarketingPageView('/', PAGE_SEO.home?.title || 'فزاعين');
  useLandingDownloadTracking();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [customLanding, setCustomLanding] = useState(null);
  const [landingContent, setLandingContent] = useState(DEFAULT_LANDING_CONTENT);
  const [activeNav, setActiveNav] = useState('#hero');
  const [supportInfo, setSupportInfo] = useState({
    whatsappNumber: '966551780608',
    whatsappDisplay: '+966 55 178 0608',
  });
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const loadLandingContent = async () => {
      try {
        const [htmlSnap, contentSnap, supportSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'landingPage')),
          getDoc(doc(db, 'settings', 'landingContent')),
          getDoc(doc(db, 'settings', 'support')),
        ]);
        if (htmlSnap.exists()) {
          const data = htmlSnap.data();
          if (data?.useCustomHtml && data?.htmlContent) {
            setCustomLanding(data.htmlContent);
          }
        }
        if (contentSnap.exists()) {
          const data = contentSnap.data();
          const mergedHero = { ...DEFAULT_LANDING_CONTENT.hero, ...(data.hero || {}) };
          const bg = String(mergedHero.backgroundImage || '');
          // استبدل روابط Unsplash/القديمة بالخلفية المحلية المنظمة
          if (!bg || bg.includes('unsplash.com') || bg.includes('photo-161964') || bg.includes('photo-148600')) {
            mergedHero.backgroundImage = DEFAULT_HERO_BG;
          }
          const mergedFooter = { ...DEFAULT_LANDING_CONTENT.footer, ...(data.footer || {}) };
          if (!mergedFooter.email || mergedFooter.email === 'support@fzaeen.com') {
            mergedFooter.email = DEFAULT_LANDING_CONTENT.footer.email;
          }
          mergedFooter.brandDescription = String(
            mergedFooter.brandDescription || DEFAULT_LANDING_CONTENT.footer.brandDescription
          ).replace(/لمساعدة الطريق/g, 'للمساعدة على الطريق');

          const mergedApps = { ...DEFAULT_LANDING_CONTENT.apps, ...(data.apps || {}) };
          mergedApps.providerTitle = String(
            mergedApps.providerTitle || DEFAULT_LANDING_CONTENT.apps.providerTitle
          ).replace(/المزودون/g, 'مزود الخدمة');

          setLandingContent((prev) => ({
            ...prev,
            ...data,
            header: { ...prev.header, ...(data.header || {}) },
            hero: mergedHero,
            services: { ...prev.services, ...(data.services || {}) },
            how: { ...prev.how, ...(data.how || {}) },
            apps: mergedApps,
            stats: { ...prev.stats, ...(data.stats || {}) },
            why: {
              ...prev.why,
              ...(data.why || {}),
              subtitle: String(data.why?.subtitle || prev.why.subtitle || '')
                .replace(/أنحاء المدينة/g, 'أنحاء المملكة'),
              features: (Array.isArray(data.why?.features) && data.why.features.length
                ? data.why.features
                : prev.why.features
              ).map((f, idx) => ({
                title: f?.title || prev.why.features[idx]?.title || '',
                desc: String(f?.desc || prev.why.features[idx]?.desc || '')
                  .replace(/أنحاء المدينة/g, 'أنحاء المملكة')
                  .replace(/أكثر من\s*[\d٠-٩,]+\s*مزود/g, 'شبكة مزودين')
                  .replace(/يتقرب/g, 'يقترب'),
              })),
            },
            contact: { ...prev.contact, ...(data.contact || {}) },
            colors: { ...prev.colors, ...(data.colors || {}) },
            footer: mergedFooter,
          }));
        }
        if (supportSnap.exists()) {
          const s = supportSnap.data() || {};
          setSupportInfo({
            whatsappNumber: s.whatsappNumber || '966551780608',
            whatsappDisplay: s.whatsappDisplay || '+966 55 178 0608',
          });
        }
      } catch (error) {
        console.error('Error loading landing custom content:', error);
      }
    };
    loadLandingContent();
  }, []);

  const scrollTo = (href) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    const subject = contactForm.subject.trim();
    const message = contactForm.message.trim();
    if (!name || !email || !subject || !message) {
      setContactStatus({ type: 'error', text: 'يرجى تعبئة جميع الحقول' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactStatus({ type: 'error', text: 'يرجى إدخال بريد إلكتروني صحيح' });
      return;
    }
    setContactSubmitting(true);
    setContactStatus(null);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: '',
        userName: name,
        userPhone: '',
        userEmail: email,
        subject,
        message,
        category: 'website',
        status: 'open',
        adminReply: '',
        source: 'website',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setContactStatus({ type: 'success', text: 'تم إرسال رسالتك بنجاح، سنتواصل معك قريباً' });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      setContactStatus({ type: 'error', text: 'تعذر الإرسال، حاول مرة أخرى أو تواصل عبر واتساب' });
    } finally {
      setContactSubmitting(false);
    }
  };
  const headerLinks = withArticlesNav(landingContent.header?.scrollLinks || SCROLL_LINKS);
  const serviceCards = landingContent.services?.cards || DEFAULT_LANDING_CONTENT.services.cards;
  const howSteps = landingContent.how?.steps || DEFAULT_LANDING_CONTENT.how.steps;
  const whyFeatures = landingContent.why?.features || DEFAULT_LANDING_CONTENT.why.features;
  const theme = landingContent.colors || DEFAULT_LANDING_CONTENT.colors;
  const siteName = landingContent.header?.siteName || 'فزاعين';
  const logoUrl = landingContent.header?.logoUrl || '/fzaeen-logo.jpeg';
  const appleHrefRaw = landingContent.apps?.appleHref || DEFAULT_LANDING_CONTENT.apps.appleHref;
  const appleHref =
    !appleHrefRaw ||
    appleHrefRaw === 'https://apps.apple.com' ||
    appleHrefRaw === 'https://apps.apple.com/'
      ? DEFAULT_LANDING_CONTENT.apps.appleHref
      : appleHrefRaw;
  const googleHrefRaw = landingContent.apps?.googleHref || DEFAULT_LANDING_CONTENT.apps.googleHref;
  const googleHref =
    !googleHrefRaw ||
    googleHrefRaw === 'https://play.google.com' ||
    googleHrefRaw === 'https://play.google.com/'
      ? DEFAULT_LANDING_CONTENT.apps.googleHref
      : googleHrefRaw;
  const providerAppleHrefRaw =
    landingContent.apps?.providerAppleHref || DEFAULT_LANDING_CONTENT.apps.providerAppleHref;
  const providerAppleHref =
    !providerAppleHrefRaw ||
    providerAppleHrefRaw === 'https://apps.apple.com' ||
    providerAppleHrefRaw === 'https://apps.apple.com/'
      ? DEFAULT_LANDING_CONTENT.apps.providerAppleHref
      : providerAppleHrefRaw;
  const providerGoogleHref =
    landingContent.apps?.providerGoogleHref || DEFAULT_LANDING_CONTENT.apps.providerGoogleHref;
  const providerStoreHref = getStoreHrefForDevice(providerAppleHref, providerGoogleHref);
  const heroChips = Array.isArray(landingContent.hero?.chips) && landingContent.hero.chips.length
    ? landingContent.hero.chips
    : DEFAULT_LANDING_CONTENT.hero.chips;
  const heroBg =
    landingContent.hero?.backgroundImage || DEFAULT_LANDING_CONTENT.hero.backgroundImage;
  const downloadLabel = landingContent.hero?.primaryButtonText || 'حمل التطبيق الآن!';
  const downloadHref = getStoreHrefForDevice(appleHref, googleHref);
  const contactEmail = landingContent.footer?.email || DEFAULT_LANDING_CONTENT.footer.email;
  const waLink = `https://wa.me/${supportInfo.whatsappNumber}?text=${encodeURIComponent('مرحباً، أحتاج مساعدة من فزاعين')}`;

  if (customLanding) {
    return (
      <div dir="rtl">
        <SeoHead {...PAGE_SEO.home} jsonLd={buildHomeJsonLd()} />
        <LandingSplash logoUrl={logoUrl} siteName={siteName} />
        <div data-custom-landing-root dangerouslySetInnerHTML={{ __html: customLanding }} />
        <WhatsAppFloat />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900" dir="rtl" style={{ backgroundColor: theme.cardBg, fontFamily: "'Cairo', system-ui, sans-serif" }}>
      <SeoHead {...PAGE_SEO.home} jsonLd={buildHomeJsonLd()} />
      <LandingSplash logoUrl={logoUrl} siteName={siteName} />

      {/* ── Navbar ── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-black/85 backdrop-blur-md border-b border-white/10 shadow-lg' : 'bg-gradient-to-b from-black/70 to-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px] gap-3">
            <a href="#hero" onClick={(e) => { e.preventDefault(); scrollTo('#hero'); setActiveNav('#hero'); }} className="flex items-center gap-2.5 shrink-0">
              <img src={logoUrl} alt={`${siteName} — مساعدة الطريق في السعودية`} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-white/20" />
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight">{siteName}</span>
            </a>

            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              {headerLinks.map((l) => {
                const key = l.to || l.href || l.label;
                const routePath = l.to || (typeof l.href === 'string' && l.href.startsWith('/') ? l.href : null);
                const isActive = !routePath && activeNav === l.href;

                if (routePath) {
                  return (
                    <Link
                      key={key}
                      to={routePath}
                      className="px-3 py-2 rounded-lg text-sm font-bold text-white/75 hover:text-white transition-colors"
                    >
                      {l.label}
                    </Link>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { scrollTo(l.href); setActiveNav(l.href); }}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                      isActive ? 'text-white' : 'text-white/75 hover:text-white'
                    }`}
                    style={isActive ? { color: theme.primary } : undefined}
                  >
                    {l.label}
                    {isActive && (
                      <span className="block h-0.5 mt-1 rounded-full mx-auto w-6" style={{ backgroundColor: theme.primary }} />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              <a
                href={providerStoreHref}
                target="_blank"
                rel="noopener noreferrer"
                data-download-section="header_provider"
                data-download-app="provider"
                className="px-4 py-2 rounded-xl text-sm font-bold bg-white hover:bg-gray-50 transition-colors border-2"
                style={{ borderColor: theme.primary, color: theme.primary }}
              >
                {landingContent.header?.joinProviderText || 'انضم إلينا كمزود'}
              </a>
              <button
                type="button"
                onClick={() => scrollTo('#contact')}
                className="px-4 py-2 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 shadow-md"
                style={{ backgroundColor: theme.primary }}
              >
                {landingContent.header?.contactButtonText || 'تواصل معنا'}
              </button>
            </div>

            <button type="button" className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="القائمة">
              {menuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-black/95 border-t border-white/10 backdrop-blur-md">
            <div className="px-4 py-4 flex flex-col gap-1">
              {headerLinks.map((l) => {
                const key = l.to || l.href || l.label;
                const routePath = l.to || (typeof l.href === 'string' && l.href.startsWith('/') ? l.href : null);
                if (routePath) {
                  return (
                    <Link
                      key={key}
                      to={routePath}
                      onClick={() => setMenuOpen(false)}
                      className="text-white/80 font-bold py-3 text-right hover:text-white transition-colors border-b border-white/5"
                    >
                      {l.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { scrollTo(l.href); setActiveNav(l.href); }}
                    className="text-white/80 font-bold py-3 text-right hover:text-white transition-colors border-b border-white/5"
                  >
                    {l.label}
                  </button>
                );
              })}
              <a
                href={providerStoreHref}
                target="_blank"
                rel="noopener noreferrer"
                data-download-section="menu_provider"
                data-download-app="provider"
                className="font-bold py-3 text-right border-b border-white/5"
                style={{ color: theme.primary }}
              >
                {landingContent.header?.joinProviderText || 'انضم إلينا كمزود'}
              </a>
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                data-download-section="menu_cta"
                data-download-app="customer"
                className="mt-3 text-center text-white font-black py-3.5 rounded-xl"
                style={{ backgroundColor: theme.primary }}
              >
                {downloadLabel}
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero: صورة كاملة + تحميل فوري ── */}
      <section id="hero" className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage: `url('${heroBg}')`,
            animation: 'slowZoom 18s ease-in-out infinite alternate',
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 w-full pt-28 pb-16 sm:pt-32 sm:pb-20 text-center">
          <p
            className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 tracking-tight drop-shadow-lg"
            style={{ color: theme.primary, animation: 'fadeUp 0.7s ease-out' }}
          >
            {siteName}
          </p>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.15] drop-shadow-md"
            style={{ animation: 'fadeUp 0.85s ease-out' }}
          >
            {landingContent.hero?.titleLine1 || DEFAULT_LANDING_CONTENT.hero.titleLine1}
            {landingContent.hero?.titleLine2 ? (
              <span className="block mt-1" style={{ color: theme.primary }}>
                {landingContent.hero.titleLine2}
              </span>
            ) : null}
          </h1>

          <p
            className="mt-4 sm:mt-5 text-base sm:text-xl text-white/90 font-semibold max-w-xl mx-auto drop-shadow"
            style={{ animation: 'fadeUp 1s ease-out' }}
          >
            {landingContent.hero?.description || DEFAULT_LANDING_CONTENT.hero.description}
          </p>

          <div
            className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
            style={{ animation: 'fadeUp 1.1s ease-out' }}
          >
            {heroChips.map((chip) => (
              <span
                key={chip}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-bold text-neutral-900 bg-white/85 backdrop-blur-sm shadow-md"
              >
                {chip}
              </span>
            ))}
          </div>

          <div
            id="download"
            className="mt-8 sm:mt-10 flex flex-col items-center gap-4"
            style={{ animation: 'fadeUp 1.2s ease-out' }}
          >
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              data-download-section="hero_primary"
              data-download-app="customer"
              className="group inline-flex items-center justify-center gap-2.5 min-w-[260px] sm:min-w-[320px] px-8 py-4 sm:py-5 rounded-2xl text-lg sm:text-xl font-black text-white shadow-[0_12px_40px_rgba(220,38,38,0.45)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] transition-all duration-300"
              style={{ backgroundColor: theme.primary }}
            >
              <Download className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" />
              {downloadLabel}
            </a>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <StoreBadge type="google" href={googleHref} />
              <StoreBadge type="apple" href={appleHref} />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollTo('#services')}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/70 transition-colors animate-bounce"
          aria-label="المزيد"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slowZoom {
            from { transform: scale(1); }
            to { transform: scale(1.06); }
          }
        `}</style>
      </section>

      {/* ── Features strip ── */}
      <section className="border-y border-white/5 py-10 sm:py-14" style={{ backgroundColor: theme.darkSectionBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
            {[
              { icon: Zap,    title: 'استجابة سريعة',  desc: 'متوسط الوصول في دقائق بسيطة' },
              { icon: MapPin, title: 'تتبع مباشر',     desc: 'شوف المزود وين على الخريطة' },
              { icon: Award,  title: 'مزود الخدمة موثوق', desc: 'كل مزود موثق ومقيّم من عملاء سابقين' },
              { icon: Clock,  title: 'متاح دائمًا',    desc: 'الخدمة شغّالة ٢٤ ساعة، ٧ أيام' },
            ].map(f => (
              <div key={f.title} className="flex flex-col items-center lg:items-end text-center lg:text-right gap-3 group">
                <div className="w-12 h-12 bg-amber-400/10 border border-amber-400/20 rounded-xl flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                  <f.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-black text-base text-white">{f.title}</div>
                  <div className="text-white/40 text-xs sm:text-sm mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-16 sm:py-24" style={{ backgroundColor: theme.cardBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Wrench className="w-4 h-4" />
              {landingContent.services?.badge || 'الخدمات'}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              {landingContent.services?.title || DEFAULT_LANDING_CONTENT.services.title}
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto">
              {landingContent.services?.subtitle || DEFAULT_LANDING_CONTENT.services.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                icon: Wrench,
                iconBg: 'bg-amber-50',
                iconColor: 'text-amber-600',
                borderColor: 'border-amber-100',
                accentColor: 'text-amber-600',
                hideFeatures: true,
                badge: 'الأكثر طلبًا',
                badgeBg: 'bg-amber-50 text-amber-600',
                title: 'بنشر الإطارات',
                desc: 'سواء كان الإطار فاضي أو طاح كلياً، المزود يجي عندك بالعدة اللازمة.',
                features: ['نفخ كفر', 'تغيير الاحتياطي', 'رقعة كفر خارجية', 'تغيير الكفر عند البنشر'],
              },
              {
                icon: Battery,
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-600',
                borderColor: 'border-blue-100',
                accentColor: 'text-blue-600',
                hideFeatures: true,
                badge: null,
                title: 'خدمات البطارية',
                desc: 'ما تشغّلت سيارتك؟ نوصّل مزود يشحن البطارية أو يبدّلها في موقعك.',
                features: ['اشتراك بطارية', 'تبديل بطارية'],
              },
              {
                icon: Key,
                iconBg: 'bg-emerald-50',
                iconColor: 'text-emerald-700',
                borderColor: 'border-emerald-100',
                accentColor: 'text-emerald-700',
                hideFeatures: true,
                badge: null,
                title: 'فتح السيارة',
                desc: 'نسيت المفتاح جوّا؟ متخصصون عندهم أدوات يفتحون سيارتك بأمان.',
                features: ['فتح إلكتروني', 'فتح تقليدي', 'استخراج المفاتيح', 'ضمان بدون ضرر'],
              },
            ].map((styleCard, idx) => {
              const contentCard = serviceCards[idx] || {};
              const s = {
                ...styleCard,
                title: contentCard.title || styleCard.title,
                desc: contentCard.desc || styleCard.desc,
                features: Array.isArray(contentCard.features) && contentCard.features.length > 0
                  ? contentCard.features
                  : styleCard.features,
              };
              return (
              <div key={s.title}
                className={`bg-white rounded-2xl border ${s.borderColor} p-6 sm:p-7 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 relative flex flex-col min-h-[280px]`}>
                {s.badge && (
                  <span className={`absolute top-5 left-5 text-xs font-bold px-2.5 py-1 rounded-full ${s.badgeBg}`}>
                    {s.badge}
                  </span>
                )}
                <div className={`w-12 h-12 ${s.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                  <s.icon className={`w-6 h-6 ${s.iconColor}`} />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-8 flex-1">
                  {s.desc}
                </p>
                {!s.hideFeatures && (
                  <ul className="space-y-2 mt-5">
                    {s.features.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm">
                        <CheckCircle className={`w-4 h-4 ${s.accentColor} flex-shrink-0`} />
                        <span className="text-gray-600">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )})}
          </div>

          {/* Emergency */}
          <div className="mt-5 bg-gray-950 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 bg-red-500/15 border border-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white mb-1">حالات الطوارئ</h3>
              <p className="text-white/45 text-sm">في الحالات الحرجة، طلبك يحصل على أولوية ويُوجَّه لأقرب مزود متاح مباشرة.</p>
            </div>
            <div className="sm:mr-auto flex-shrink-0">
              <span className="bg-red-500/15 border border-red-500/25 text-red-400 font-bold px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                أولوية قصوى
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-16 sm:py-24" style={{ backgroundColor: theme.lightSectionBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Zap className="w-4 h-4" />
              {landingContent.how?.badge || DEFAULT_LANDING_CONTENT.how.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              {landingContent.how?.title || DEFAULT_LANDING_CONTENT.how.title}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-14 right-[12.5%] left-[12.5%] h-px bg-gradient-to-l from-gray-200 via-amber-300 to-gray-200" />

            {[
              { icon: Smartphone },
              { icon: Wrench },
              { icon: MapPin },
              { icon: CheckCircle },
            ].map((iconItem, idx) => {
              const step = howSteps[idx] || DEFAULT_LANDING_CONTENT.how.steps[idx];
              const num = idx + 1;
              const IconComp = iconItem.icon;
              return (
              <div key={idx} className="flex flex-col items-center text-center gap-4 relative z-10">
                <div className="relative">
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-center">
                    <IconComp className="w-7 h-7 text-gray-700" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 text-gray-950 text-xs font-black rounded-full flex items-center justify-center shadow">
                    {num}
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 mb-1.5">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* ── App Download ── */}
      <section id="apps" className="py-16 sm:py-24" style={{ backgroundColor: theme.darkSectionBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Download className="w-4 h-4" />
              {landingContent.apps?.badge || DEFAULT_LANDING_CONTENT.apps.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{landingContent.apps?.title || DEFAULT_LANDING_CONTENT.apps.title}</h2>
            <p className="text-white/40 text-base max-w-md mx-auto">
              {landingContent.apps?.subtitle || DEFAULT_LANDING_CONTENT.apps.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
            {[
              {
                tag: 'للعملاء',
                tagStyle: 'bg-amber-400/15 text-amber-400 border border-amber-400/20',
                cardStyle: 'border-white/8',
                icon: Users,
                iconBg: 'bg-amber-400/10',
                iconColor: 'text-amber-400',
                title: landingContent.apps?.customerTitle || DEFAULT_LANDING_CONTENT.apps.customerTitle,
                desc: landingContent.apps?.customerDesc || DEFAULT_LANDING_CONTENT.apps.customerDesc,
                features: ['طلب سريع بنقرتين', 'تتبع مباشر للمزود', 'تقييم الخدمة بعد الانتهاء'],
                appleHref,
                googleHref,
              },
              {
                tag: 'لمزود الخدمة',
                tagStyle: 'bg-white/8 text-white/60 border border-white/10',
                cardStyle: 'border-white/6',
                icon: Wrench,
                iconBg: 'bg-white/6',
                iconColor: 'text-white/60',
                title: landingContent.apps?.providerTitle || DEFAULT_LANDING_CONTENT.apps.providerTitle,
                desc: landingContent.apps?.providerDesc || DEFAULT_LANDING_CONTENT.apps.providerDesc,
                features: ['استقبال الطلبات فوري', 'إدارة حالة الطلبات', 'تتبع الأرباح'],
                appleHref: providerAppleHref,
                googleHref: providerGoogleHref,
              },
            ].map(app => {
              const preferredHref = getStoreHrefForDevice(app.appleHref, app.googleHref);
              const preferredIsApple = preferredHref === app.appleHref;
              const appRole = app.tag.includes('مزود') ? 'provider' : 'customer';
              return (
              <div key={app.tag} className={`bg-gray-900 border ${app.cardStyle} rounded-2xl p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 ${app.iconBg} rounded-xl flex items-center justify-center`}>
                    <app.icon className={`w-5 h-5 ${app.iconColor}`} />
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${app.tagStyle}`}>{app.tag}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white mb-3">{app.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed mb-5">{app.desc}</p>
                <ul className="space-y-2 mb-6">
                  {app.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-white/55">{f}</span>
                    </li>
                  ))}
                </ul>
                {/* على الموبايل: زر المتجر المناسب للجهاز. على سطح المكتب: الشارتان */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <a href={preferredHref} target="_blank" rel="noopener noreferrer"
                    data-download-section="apps_card_mobile"
                    data-download-app={appRole}
                    data-download-store={preferredIsApple ? 'apple' : 'google'}
                    className="sm:hidden flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-4 py-3 rounded-xl hover:bg-gray-100 transition-all hover:shadow-lg group flex-1">
                    {preferredIsApple ? (
                      <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" fill="currentColor" aria-hidden>
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                    ) : (
                      <span className="group-hover:scale-110 transition-transform inline-flex">
                        <GooglePlayIcon className="w-5 h-5" />
                      </span>
                    )}
                    <div className="text-right">
                      <div className="text-[9px] text-gray-500 leading-none">
                        {preferredIsApple ? 'Download on the' : 'Get it on'}
                      </div>
                      <div className="text-sm font-black leading-tight">
                        {preferredIsApple ? 'App Store' : 'Google Play'}
                      </div>
                    </div>
                  </a>
                  <a href={app.appleHref} target="_blank" rel="noopener noreferrer"
                    data-download-section="apps_card_apple"
                    data-download-app={appRole}
                    data-download-store="apple"
                    className="hidden sm:flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-4 py-3 rounded-xl hover:bg-gray-100 transition-all hover:shadow-lg group flex-1">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" fill="currentColor" aria-hidden>
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <div className="text-right">
                      <div className="text-[9px] text-gray-500 leading-none">Download on the</div>
                      <div className="text-sm font-black leading-tight">App Store</div>
                    </div>
                  </a>
                  <a href={app.googleHref} target="_blank" rel="noopener noreferrer"
                    data-download-section="apps_card_google"
                    data-download-app={appRole}
                    data-download-store="google"
                    className="hidden sm:flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-4 py-3 rounded-xl hover:bg-gray-100 transition-all hover:shadow-lg group flex-1">
                    <span className="group-hover:scale-110 transition-transform inline-flex">
                      <GooglePlayIcon className="w-5 h-5" />
                    </span>
                    <div className="text-right">
                      <div className="text-[9px] text-gray-500 leading-none">Get it on</div>
                      <div className="text-sm font-black leading-tight">Google Play</div>
                    </div>
                  </a>
                </div>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* ── Why Fzaeen ── */}
      <section id="why" className="py-20 sm:py-28 relative overflow-hidden" style={{ backgroundColor: theme.darkSectionBg }}>
        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Heading */}
          <div className="text-center mb-14 sm:mb-20">
            <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              <Award className="w-4 h-4" />
              {landingContent.why?.badge || DEFAULT_LANDING_CONTENT.why.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
              {landingContent.why?.title || DEFAULT_LANDING_CONTENT.why.title}
            </h2>
            <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto">
              {landingContent.why?.subtitle || DEFAULT_LANDING_CONTENT.why.subtitle}
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[
              { icon: Users },
              { icon: CheckCircle },
              { icon: MapPin },
              { icon: Clock },
            ].map((iconItem, idx) => {
              const contentItem = whyFeatures[idx] || DEFAULT_LANDING_CONTENT.why.features[idx];
              const f = { ...contentItem, icon: iconItem.icon };
              return (
              <div key={f.title}
                className="group bg-white/4 border border-white/8 rounded-2xl p-6 hover:bg-white/7 hover:border-amber-400/20 transition-all duration-300">
                <div className="mb-5">
                  <div className="w-10 h-10 bg-amber-400/10 border border-amber-400/15 rounded-xl flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                    <f.icon className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-white font-black text-base mb-2">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* ── SEO: تغطية السعودية + FAQ ── */}
      <LandingSeoSection primaryColor={theme.primary} />

      {/* ── مقالات من لوحة التحكم ── */}
      <LandingArticlesSection primaryColor={theme.primary} />

      {/* ── Contact ── */}
      <section id="contact" className="py-16 sm:py-24" style={{ backgroundColor: theme.lightSectionBg || '#f9fafb' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            {/* Info column */}
            <div className="text-right order-2 lg:order-1">
              <p className="text-gray-500 text-base sm:text-lg mb-2">
                {landingContent.contact?.title || DEFAULT_LANDING_CONTENT.contact.title}
              </p>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 mb-8 sm:mb-10">
                {landingContent.contact?.subtitle || DEFAULT_LANDING_CONTENT.contact.subtitle}
              </h2>

              <div className="space-y-6 mb-8">
                <div>
                  <div className="text-gray-400 text-sm font-medium mb-1">البريد الالكتروني</div>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-lg sm:text-xl font-bold break-all hover:underline"
                    style={{ color: theme.primary }}
                  >
                    {contactEmail}
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform"
                  style={{ backgroundColor: '#25D366' }}
                  aria-label="واتساب"
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
                <a
                  href={`mailto:${contactEmail}`}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform"
                  style={{ backgroundColor: theme.primary }}
                  aria-label="بريد"
                >
                  <Mail className="w-5 h-5" />
                </a>
                <Link
                  to="/support"
                  className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline mr-1"
                >
                  مركز الدعم والأسئلة الشائعة
                </Link>
              </div>
            </div>

            {/* Form column — مثل المنافس + تذاكر الدعم في التطبيق */}
            <div
              className="rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-xl order-1 lg:order-2"
              style={{ backgroundColor: theme.primary }}
            >
              <p className="text-white/90 text-sm sm:text-base leading-relaxed mb-6 font-medium">
                {landingContent.contact?.formHint || DEFAULT_LANDING_CONTENT.contact.formHint}
              </p>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1.5">الاسم بالكامل</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="الاسم بالكامل"
                    className="w-full rounded-xl px-4 py-3 text-gray-900 bg-white border-0 outline-none focus:ring-2 focus:ring-white/50 placeholder:text-gray-400"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1.5">البريد الالكتروني</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="example@email.com"
                    className="w-full rounded-xl px-4 py-3 text-gray-900 bg-white border-0 outline-none focus:ring-2 focus:ring-white/50 placeholder:text-gray-400"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1.5">الموضوع</label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="الموضوع"
                    className="w-full rounded-xl px-4 py-3 text-gray-900 bg-white border-0 outline-none focus:ring-2 focus:ring-white/50 placeholder:text-gray-400"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1.5">الرسالة</label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder="يرجى كتابة رسالتك هنا"
                    rows={4}
                    className="w-full rounded-xl px-4 py-3 text-gray-900 bg-white border-0 outline-none focus:ring-2 focus:ring-white/50 placeholder:text-gray-400 resize-y min-h-[110px]"
                    dir="rtl"
                  />
                </div>

                {contactStatus ? (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      contactStatus.type === 'success'
                        ? 'bg-white/20 text-white'
                        : 'bg-black/20 text-white'
                    }`}
                  >
                    {contactStatus.text}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={contactSubmitting}
                  className="inline-flex items-center justify-center gap-2 bg-white font-black px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-70 min-w-[140px]"
                  style={{ color: theme.primary }}
                >
                  {contactSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      ارسال
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5" style={{ backgroundColor: theme.footerBg }}>
        {/* Main footer body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

            {/* Col 1 – Brand */}
            <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <img src={landingContent.header?.logoUrl || '/fzaeen-logo.jpeg'} alt="فزاعين" className="w-11 h-11 rounded-xl object-cover shadow-md" />
                <span className="text-white text-xl font-black tracking-tight">{landingContent.header?.siteName || 'فزاعين'}</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed max-w-[260px]">
                {landingContent.footer?.brandDescription || DEFAULT_LANDING_CONTENT.footer.brandDescription}
              </p>
              {/* App badges */}
              <div className="flex flex-row gap-2.5 mt-1">
                <a href={appleHref} target="_blank" rel="noopener noreferrer"
                  data-download-section="footer"
                  data-download-app="customer"
                  data-download-store="apple"
                  className="flex items-center gap-2 bg-white/6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl px-3 py-2.5 flex-1">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/70 flex-shrink-0" fill="currentColor" aria-hidden>
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <div className="text-[8px] text-white/30 leading-none">Download on the</div>
                    <div className="text-[11px] text-white font-bold leading-tight mt-0.5">App Store</div>
                  </div>
                </a>
                <a href={googleHref} target="_blank" rel="noopener noreferrer"
                  data-download-section="footer"
                  data-download-app="customer"
                  data-download-store="google"
                  className="flex items-center gap-2 bg-white/6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl px-3 py-2.5 flex-1">
                  <GooglePlayIcon className="w-4 h-4" />
                  <div>
                    <div className="text-[8px] text-white/30 leading-none">Get it on</div>
                    <div className="text-[11px] text-white font-bold leading-tight mt-0.5">Google Play</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Col 2 – Navigation */}
            <div>
              <h4 className="text-white font-black text-sm mb-5 pb-3 border-b border-white/8">
                التنقل السريع
              </h4>
              <ul className="space-y-3">
                {headerLinks.map(l => (
                  <li key={l.href}>
                    <button onClick={() => scrollTo(l.href)}
                      className="text-white/45 text-sm hover:text-amber-400 transition-colors flex items-center gap-1.5 group">
                      <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-amber-400 transition-colors flex-shrink-0" />
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3 – Legal */}
            <div>
              <h4 className="text-white font-black text-sm mb-5 pb-3 border-b border-white/8">
                قانوني
              </h4>
              <ul className="space-y-3">
                {[
                  { label: 'المقالات', to: '/blog' },
                  { label: 'سياسة الخصوصية', to: '/privacy' },
                  { label: 'الشروط والأحكام', to: '/terms' },
                  { label: 'الدعم', to: '/support' },
                  { label: 'طلب حذف الحساب', to: '/delete-account' },
                ].map(item => (
                  <li key={item.to}>
                    <Link to={item.to}
                      className="text-white/45 text-sm hover:text-amber-400 transition-colors flex items-center gap-1.5 group">
                      <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-amber-400 transition-colors flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4 – Contact */}
            <div>
              <h4 className="text-white font-black text-sm mb-5 pb-3 border-b border-white/8">
                تواصل معنا
              </h4>
              <ul className="space-y-4">
                <li>
                  <a href={`mailto:${landingContent.footer?.email || DEFAULT_LANDING_CONTENT.footer.email}`}
                    className="flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-400/15 group-hover:border-amber-400/25 transition-all mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-white/40 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div>
                      <div className="text-white/30 text-[10px] font-medium mb-0.5">البريد الإلكتروني</div>
                      <div className="text-white/60 text-xs font-semibold group-hover:text-amber-400 transition-colors">
                        {landingContent.footer?.email || DEFAULT_LANDING_CONTENT.footer.email}
                      </div>
                    </div>
                  </a>
                </li>
                <li>
                  <Link to="/admin"
                    className="flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-400/15 group-hover:border-amber-400/25 transition-all mt-0.5">
                      <Globe className="w-3.5 h-3.5 text-white/40 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div>
                      <div className="text-white/30 text-[10px] font-medium mb-0.5">لوحة التحكم</div>
                      <div className="text-white/60 text-xs font-semibold group-hover:text-amber-400 transition-colors">
                        دخول المشرفين
                      </div>
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-white/25 text-xs text-center sm:text-right">
              © {new Date().getFullYear()} {landingContent.footer?.copyrightText || DEFAULT_LANDING_CONTENT.footer.copyrightText}
            </p>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="text-white/25 text-xs hover:text-white/50 transition-colors">
                الخصوصية
              </Link>
              <span className="text-white/10">·</span>
              <Link to="/terms" className="text-white/25 text-xs hover:text-white/50 transition-colors">
                الشروط
              </Link>
              <span className="text-white/10">·</span>
              <Link to="/support" className="text-white/25 text-xs hover:text-white/50 transition-colors">
                الدعم
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <WhatsAppFloat />
    </div>
  );
};
