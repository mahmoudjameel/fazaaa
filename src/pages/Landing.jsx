import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  Zap, MapPin, Clock, Star, ChevronDown,
  CheckCircle, Mail, Menu, X,
  Battery, Wrench, Key, AlertTriangle, Users, Award,
  Download, Globe, Smartphone, Phone, ArrowLeft
} from 'lucide-react';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { db } from '../services/firebase';

const SCROLL_LINKS = [
  { label: 'الرئيسية',    href: '#hero' },
  { label: 'خدماتنا',    href: '#services' },
  { label: 'كيف يعمل',   href: '#how' },
  { label: 'التطبيقات',  href: '#apps' },
  { label: 'تواصل معنا', href: '#contact' },
];

const PAGE_LINKS = [
  { label: 'سياسة الخصوصية', to: '/privacy' },
  { label: 'الشروط والأحكام', to: '/terms' },
];

const NAV_LINKS = SCROLL_LINKS;
const DEFAULT_LANDING_CONTENT = {
  header: {
    siteName: 'فزاعين',
    logoUrl: '/fzaeen-logo.jpeg',
    adminButtonText: 'لوحة التحكم',
    scrollLinks: SCROLL_LINKS,
    pageLinks: PAGE_LINKS,
  },
  hero: {
    badge: 'خدمة مساعدة الطريق داخل المدينة',
    titleLine1: 'عطلت سيارتك؟',
    titleLine2: 'احنا جاهزين',
    description: 'فزاعين يوصّلك بأقرب مزود خدمة في منطقتك - سواء بنشر، بطارية، أو نسيت مفتاحك. كل شيء من التطبيق مباشرة.',
    primaryButtonText: 'حمّل التطبيق',
    secondaryButtonText: 'كيف يشتغل؟',
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
    primary: '#fbbf24',
    heroBg: '#111827',
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

export const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [customLanding, setCustomLanding] = useState(null);
  const [landingContent, setLandingContent] = useState(DEFAULT_LANDING_CONTENT);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const loadLandingContent = async () => {
      try {
        const [htmlSnap, contentSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'landingPage')),
          getDoc(doc(db, 'settings', 'landingContent')),
        ]);
        if (htmlSnap.exists()) {
          const data = htmlSnap.data();
          if (data?.useCustomHtml && data?.htmlContent) {
            setCustomLanding(data.htmlContent);
          }
        }
        if (contentSnap.exists()) {
          const data = contentSnap.data();
          setLandingContent((prev) => ({
            ...prev,
            ...data,
            header: { ...prev.header, ...(data.header || {}) },
            hero: { ...prev.hero, ...(data.hero || {}) },
            services: { ...prev.services, ...(data.services || {}) },
            how: { ...prev.how, ...(data.how || {}) },
            apps: { ...prev.apps, ...(data.apps || {}) },
            stats: { ...prev.stats, ...(data.stats || {}) },
            why: { ...prev.why, ...(data.why || {}) },
            testimonials: { ...prev.testimonials, ...(data.testimonials || {}) },
            contact: { ...prev.contact, ...(data.contact || {}) },
            colors: { ...prev.colors, ...(data.colors || {}) },
            footer: { ...prev.footer, ...(data.footer || {}) },
          }));
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
  const headerLinks = landingContent.header?.scrollLinks || SCROLL_LINKS;
  const pageLinks = landingContent.header?.pageLinks || PAGE_LINKS;
  const serviceCards = landingContent.services?.cards || DEFAULT_LANDING_CONTENT.services.cards;
  const howSteps = landingContent.how?.steps || DEFAULT_LANDING_CONTENT.how.steps;
  const testimonialItems = landingContent.testimonials?.items || DEFAULT_LANDING_CONTENT.testimonials.items;
  const statsItems = landingContent.stats?.items || DEFAULT_LANDING_CONTENT.stats.items;
  const whyFeatures = landingContent.why?.features || DEFAULT_LANDING_CONTENT.why.features;
  const theme = landingContent.colors || DEFAULT_LANDING_CONTENT.colors;

  if (customLanding) {
    return (
      <div dir="rtl">
        <div dangerouslySetInnerHTML={{ __html: customLanding }} />
        <WhatsAppFloat />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900" dir="rtl" style={{ backgroundColor: theme.cardBg }}>

      {/* ── Navbar ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-gray-950/98 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2.5">
              <img src={landingContent.header?.logoUrl || '/fzaeen-logo.jpeg'} alt="فزاعين"
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover shadow-md" />
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight">{landingContent.header?.siteName || 'فزاعين'}</span>
            </div>
            <nav className="hidden md:flex items-center gap-5 lg:gap-7">
              {headerLinks.map(l => (
                <button key={l.href} onClick={() => scrollTo(l.href)}
                  className="font-semibold text-sm text-white/70 hover:text-amber-400 transition-colors">
                  {l.label}
                </button>
              ))}
              {/* Divider */}
              <span className="h-4 w-px bg-white/10" />
              {pageLinks.map(l => (
                <Link key={l.to} to={l.to}
                  className="font-semibold text-sm text-white/50 hover:text-amber-400 transition-colors">
                  {l.label}
                </Link>
              ))}
              <Link to="/admin"
                className="text-gray-950 font-black px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg"
                style={{ backgroundColor: theme.primary }}>
                {landingContent.header?.adminButtonText || 'لوحة التحكم'}
              </Link>
            </nav>
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-gray-950 border-t border-white/10">
            <div className="px-4 py-4 flex flex-col gap-1">
              {headerLinks.map(l => (
                <button key={l.href} onClick={() => scrollTo(l.href)}
                  className="text-white/70 font-semibold py-3 text-right hover:text-amber-400 transition-colors border-b border-white/5">
                  {l.label}
                </button>
              ))}
              <div className="pt-1 pb-1">
                <div className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-1 py-2">قانوني</div>
                {pageLinks.map(l => (
                  <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                    className="block text-white/50 font-semibold py-2.5 text-right hover:text-amber-400 transition-colors border-b border-white/5">
                    {l.label}
                  </Link>
                ))}
              </div>
              <Link to="/admin" onClick={() => setMenuOpen(false)}
                className="text-gray-950 font-black px-4 py-3 rounded-xl text-center text-sm mt-3"
                style={{ backgroundColor: theme.primary }}>
                {landingContent.header?.adminButtonText || 'لوحة التحكم'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden" style={{ backgroundColor: theme.heroBg }}>
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/8 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-3xl translate-y-1/4" />
          {/* Subtle grid */}
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Text */}
            <div className="space-y-7 text-center lg:text-right order-2 lg:order-1">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: `${theme.primary}1A`, border: `1px solid ${theme.primary}55`, color: theme.primary }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.primary }} />
                {landingContent.hero?.badge || DEFAULT_LANDING_CONTENT.hero.badge}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight text-white">
                {landingContent.hero?.titleLine1 || DEFAULT_LANDING_CONTENT.hero.titleLine1}
                <span className="block mt-1" style={{ color: theme.primary }}>{landingContent.hero?.titleLine2 || DEFAULT_LANDING_CONTENT.hero.titleLine2}</span>
              </h1>
              <p className="text-white/55 text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0">
                {landingContent.hero?.description || DEFAULT_LANDING_CONTENT.hero.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-end">
                <a href="#apps" onClick={(e) => { e.preventDefault(); scrollTo('#apps'); }}
                  className="group text-gray-950 font-black px-8 py-4 rounded-2xl text-base hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2.5"
                  style={{ backgroundColor: theme.primary }}>
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {landingContent.hero?.primaryButtonText || DEFAULT_LANDING_CONTENT.hero.primaryButtonText}
                </a>
                <button onClick={() => scrollTo('#how')}
                  className="bg-white/6 border border-white/12 text-white font-bold px-8 py-4 rounded-2xl text-base hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2">
                  {landingContent.hero?.secondaryButtonText || DEFAULT_LANDING_CONTENT.hero.secondaryButtonText}
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center lg:justify-end gap-0 pt-1 divide-x divide-x-reverse divide-white/10 bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                {[
                  { num: '+٣٠٠',  label: 'طلب منجز',   sub: 'ومتزايد' },
                  { num: '+٤٠',   label: 'مزود معتمد',  sub: 'في المنطقة' },
                  { num: '٤.٧★',  label: 'تقييم المتجر', sub: 'من ٥' },
                ].map(s => (
                  <div key={s.label} className="flex-1 text-center px-4 py-3">
                    <div className="text-xl sm:text-2xl font-black text-amber-400 leading-none">{s.num}</div>
                    <div className="text-white/50 text-[10px] sm:text-xs font-semibold mt-1">{s.label}</div>
                    <div className="text-white/20 text-[9px] mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* App mockup */}
            <div className="relative flex justify-center items-center order-1 lg:order-2">
              <div className="relative w-60 sm:w-72 lg:w-80">
                {/* Glow behind card */}
                <div className="absolute inset-0 bg-amber-400/10 rounded-[2.5rem] blur-2xl scale-105" />
                <div className="relative bg-gray-900 border border-white/10 rounded-[2.5rem] p-5 shadow-2xl">
                  {/* Status bar */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                      <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    </div>
                    <div className="text-white/30 text-[10px]">9:41</div>
                  </div>
                  {/* App header */}
                  <div className="flex items-center gap-3 mb-4">
                    <img src="/fzaeen-logo.jpeg" alt="فزاعين" className="w-10 h-10 rounded-xl object-cover" />
                    <div>
                      <div className="text-white font-black text-sm">فزاعين</div>
                      <div className="text-white/40 text-xs">مساعدة على الطريق</div>
                    </div>
                  </div>
                  {/* Service picker */}
                  <div className="bg-gray-800/70 rounded-2xl p-3.5 mb-3">
                    <div className="text-amber-400 font-bold text-xs mb-3">وش عندك؟</div>
                    {[
                      { label: 'بنشر إطار', icon: Wrench, active: true },
                      { label: 'بطارية فارغة', icon: Battery, active: false },
                      { label: 'نسيت المفتاح', icon: Key, active: false },
                    ].map(s => (
                      <div key={s.label}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl mb-1.5 last:mb-0 ${s.active ? 'bg-amber-400/15 border border-amber-400/30' : 'border border-transparent'}`}>
                        <s.icon className={`w-4 h-4 flex-shrink-0 ${s.active ? 'text-amber-400' : 'text-white/25'}`} />
                        <span className={`text-xs font-semibold ${s.active ? 'text-amber-300' : 'text-white/35'}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* CTA */}
                  <div className="bg-amber-400 rounded-xl py-3 text-center mb-3">
                    <span className="text-gray-950 font-black text-sm">أرسل الطلب</span>
                  </div>
                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 bg-emerald-500/10 rounded-xl py-2.5 border border-emerald-500/20">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-xs font-semibold">نحدد موقعك...</span>
                  </div>
                </div>
                {/* Floating badges */}
                <div className="absolute -top-4 -left-4 bg-gray-900 border border-white/10 rounded-2xl shadow-xl px-3.5 py-2.5 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">وصول خلال ١٥ دقيقة</span>
                </div>
                <div className="absolute -bottom-4 -right-3 bg-gray-900 border border-white/10 rounded-2xl shadow-xl px-3.5 py-2.5 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-white">٤.٩ من ٥</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/25" />
        </div>
      </section>

      {/* ── Features strip ── */}
      <section className="border-y border-white/5 py-10 sm:py-14" style={{ backgroundColor: theme.darkSectionBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
            {[
              { icon: Zap,    title: 'استجابة سريعة',  desc: 'متوسط الوصول أقل من ٢٠ دقيقة' },
              { icon: MapPin, title: 'تتبع مباشر',     desc: 'شوف المزود وين على الخريطة' },
              { icon: Award,  title: 'مزودون موثوقون', desc: 'كل مزود موثق ومقيّم من عملاء سابقين' },
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
                badge: 'الأكثر طلبًا',
                badgeBg: 'bg-amber-50 text-amber-600',
                title: 'بنشر الإطارات',
                desc: 'سواء كان الإطار فاضي أو طاح كلياً، المزود يجي عندك بالعدة اللازمة.',
                features: ['تغيير الإطار الكامل', 'تركيب الاستبني', 'ضخ هواء', 'فحص باقي الإطارات'],
              },
              {
                icon: Battery,
                iconBg: 'bg-blue-50',
                iconColor: 'text-blue-600',
                borderColor: 'border-blue-100',
                accentColor: 'text-blue-600',
                badge: null,
                title: 'خدمات البطارية',
                desc: 'ما تشغّلت سيارتك؟ نوصّل مزود يشحن البطارية أو يبدّلها في موقعك.',
                features: ['شحن البطارية', 'تشغيل من بطارية ثانية', 'تبديل البطارية', 'فحص الكهرباء'],
              },
              {
                icon: Key,
                iconBg: 'bg-emerald-50',
                iconColor: 'text-emerald-700',
                borderColor: 'border-emerald-100',
                accentColor: 'text-emerald-700',
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
                className={`bg-white rounded-2xl border ${s.borderColor} p-6 sm:p-7 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 relative`}>
                {s.badge && (
                  <span className={`absolute top-5 left-5 text-xs font-bold px-2.5 py-1 rounded-full ${s.badgeBg}`}>
                    {s.badge}
                  </span>
                )}
                <div className={`w-12 h-12 ${s.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                  <s.icon className={`w-6 h-6 ${s.iconColor}`} />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2">
                  {s.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className={`w-4 h-4 ${s.accentColor} flex-shrink-0`} />
                      <span className="text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
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
                appleHref: landingContent.apps?.appleHref || DEFAULT_LANDING_CONTENT.apps.appleHref,
                googleHref: landingContent.apps?.googleHref || DEFAULT_LANDING_CONTENT.apps.googleHref,
              },
              {
                tag: 'للمزودين',
                tagStyle: 'bg-white/8 text-white/60 border border-white/10',
                cardStyle: 'border-white/6',
                icon: Wrench,
                iconBg: 'bg-white/6',
                iconColor: 'text-white/60',
                title: landingContent.apps?.providerTitle || DEFAULT_LANDING_CONTENT.apps.providerTitle,
                desc: landingContent.apps?.providerDesc || DEFAULT_LANDING_CONTENT.apps.providerDesc,
                features: ['استقبال الطلبات فوري', 'إدارة حالة الطلبات', 'تتبع الأرباح'],
                appleHref: landingContent.apps?.appleHref || DEFAULT_LANDING_CONTENT.apps.appleHref,
                googleHref: landingContent.apps?.googleHref || DEFAULT_LANDING_CONTENT.apps.googleHref,
              },
            ].map(app => (
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
                <div className="flex flex-col sm:flex-row gap-3">
                  {[
                    {
                      href: app.appleHref,
                      label: 'App Store',
                      sub: 'Download on the',
                      svg: <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />,
                    },
                    {
                      href: app.googleHref,
                      label: 'Google Play',
                      sub: 'Get it on',
                      svg: <path d="M3.18 23.76a2.5 2.5 0 0 1-1.18-2.22V2.46A2.5 2.5 0 0 1 3.18.24l11.37 11.76-11.37 11.76zm13.09-8.04L4.02 23.4l10.5-6.06 1.75-1.62zm2.96-4.16c.64.37 1.03.99 1.03 1.67s-.39 1.3-1.03 1.67l-2.61 1.51-2.02-2.09 2.02-2.09 2.61 1.33zm-15.2-9.15 12.25 7.68-1.75 1.62-10.5-6.06z" />,
                    },
                  ].map(btn => (
                    <a key={btn.label} href={btn.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-4 py-3 rounded-xl hover:bg-gray-100 transition-all hover:shadow-lg group flex-1">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" fill="currentColor">
                        {btn.svg}
                      </svg>
                      <div className="text-right">
                        <div className="text-[9px] text-gray-500 leading-none">{btn.sub}</div>
                        <div className="text-sm font-black leading-tight">{btn.label}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-white/25 text-sm mt-8 flex items-center justify-center gap-2">
            <Globe className="w-4 h-4" />
            مجاني على iOS و Android
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-14 sm:py-20 border-y border-gray-100" style={{ backgroundColor: theme.cardBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { icon: Users },
              { icon: Wrench },
              { icon: CheckCircle },
              { icon: Clock },
            ].map((iconItem, idx) => {
              const s = statsItems[idx] || DEFAULT_LANDING_CONTENT.stats.items[idx];
              const IconComp = iconItem.icon;
              return (
              <div key={s.label} className="flex flex-col items-center gap-3">
                <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                  <IconComp className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-gray-900">{s.num}</div>
                <div className="text-gray-400 text-sm font-medium">{s.label}</div>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* ── Why Fzaeen ── */}
      <section className="py-20 sm:py-28 relative overflow-hidden" style={{ backgroundColor: theme.darkSectionBg }}>
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

          {/* Feature cards – 2×2 grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-16 sm:mb-20">
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
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 bg-amber-400/10 border border-amber-400/15 rounded-xl flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                    <f.icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-white/10 group-hover:text-amber-400/20 transition-colors">
                    {f.num}
                  </span>
                </div>
                <h3 className="text-white font-black text-base mb-2">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            )})}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-12 sm:mb-14">
            <div className="flex-1 h-px bg-white/6" />
            <div className="flex items-center gap-2 text-white/25 text-xs font-semibold">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              {landingContent.testimonials?.title || DEFAULT_LANDING_CONTENT.testimonials.title}
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>
            <div className="flex-1 h-px bg-white/6" />
          </div>

          {/* Testimonials – 3 col */}
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
            {[
              { icon: Wrench },
              { icon: Battery, featured: true },
              { icon: Key },
            ].map((iconItem, idx) => {
              const base = testimonialItems[idx] || DEFAULT_LANDING_CONTENT.testimonials.items[idx];
              const initials = (base.name || '').split(' ').slice(0, 2).map((w) => w[0]).join(' ') || 'ع';
              const r = { ...base, initials, icon: iconItem.icon, featured: iconItem.featured };
              return (
              <div key={r.name}
                className={`relative rounded-2xl p-6 border flex flex-col gap-4 ${
                  r.featured
                    ? 'bg-amber-400/8 border-amber-400/25'
                    : 'bg-white/4 border-white/8'
                }`}>
                {r.featured && (
                  <div className="absolute top-4 left-4">
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                      مميز
                    </span>
                  </div>
                )}
                {/* Stars */}
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                {/* Comment */}
                <p className="text-white/65 text-sm leading-relaxed flex-1">
                  "{r.comment}"
                </p>
                {/* Reviewer */}
                <div className="flex items-center gap-3 pt-3 border-t border-white/6">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 text-xs font-black">{r.initials}</span>
                  </div>
                  <div>
                    <div className="text-white font-black text-sm">{r.name}</div>
                    <div className="flex items-center gap-1 text-white/35 text-xs mt-0.5">
                      <r.icon className="w-3 h-3" />
                      {r.service}
                    </div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-16 sm:py-24" style={{ backgroundColor: theme.cardBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">{landingContent.contact?.title || DEFAULT_LANDING_CONTENT.contact.title}</h2>
          <p className="text-gray-400 text-base mb-10">{landingContent.contact?.subtitle || DEFAULT_LANDING_CONTENT.contact.subtitle}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <a href="mailto:support@fzaeen.com"
              className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex items-center gap-4 hover:border-amber-300 hover:bg-amber-50/30 transition-all duration-300 group text-right">
              <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors flex-shrink-0">
                <Mail className="w-5 h-5 text-gray-500 group-hover:text-amber-600 transition-colors" />
              </div>
              <div>
                <div className="font-black text-gray-900 text-sm">البريد الإلكتروني</div>
                <div className="text-amber-500 text-sm font-medium mt-0.5">support@fzaeen.com</div>
              </div>
            </a>
            <Link to="/privacy"
              className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex items-center gap-4 hover:border-amber-300 hover:bg-amber-50/30 transition-all duration-300 group text-right">
              <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors flex-shrink-0">
                <Award className="w-5 h-5 text-gray-500 group-hover:text-amber-600 transition-colors" />
              </div>
              <div>
                <div className="font-black text-gray-900 text-sm">سياسة الخصوصية</div>
                <div className="text-gray-400 text-sm mt-0.5">الشروط وسياسة الاستخدام</div>
              </div>
            </Link>
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
                {[
                  {
                    label: 'App Store',
                    sub: 'Download on the',
                    href: 'https://apps.apple.com',
                    svg: <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />,
                  },
                  {
                    label: 'Google Play',
                    sub: 'Get it on',
                    href: 'https://play.google.com',
                    svg: <path d="M3.18 23.76a2.5 2.5 0 0 1-1.18-2.22V2.46A2.5 2.5 0 0 1 3.18.24l11.37 11.76-11.37 11.76zm13.09-8.04L4.02 23.4l10.5-6.06 1.75-1.62zm2.96-4.16c.64.37 1.03.99 1.03 1.67s-.39 1.3-1.03 1.67l-2.61 1.51-2.02-2.09 2.02-2.09 2.61 1.33zm-15.2-9.15 12.25 7.68-1.75 1.62-10.5-6.06z" />,
                  },
                ].map(btn => (
                  <a key={btn.label} href={btn.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl px-3 py-2.5 flex-1">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/70 flex-shrink-0" fill="currentColor">
                      {btn.svg}
                    </svg>
                    <div>
                      <div className="text-[8px] text-white/30 leading-none">{btn.sub}</div>
                      <div className="text-[11px] text-white font-bold leading-tight mt-0.5">{btn.label}</div>
                    </div>
                  </a>
                ))}
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
                  { label: 'سياسة الخصوصية', to: '/privacy' },
                  { label: 'الشروط والأحكام', to: '/terms' },
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
              <a href={`mailto:${landingContent.footer?.email || DEFAULT_LANDING_CONTENT.footer.email}`} className="text-white/25 text-xs hover:text-white/50 transition-colors">
                الدعم
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <WhatsAppFloat />
    </div>
  );
};
