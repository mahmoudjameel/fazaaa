import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, MapPin, Clock, Star, ChevronDown,
  CheckCircle, Mail, Menu, X,
  Battery, Wrench, Key, AlertTriangle, Users, Award,
  Download, Globe
} from 'lucide-react';

const Logo = ({ size = 'md', rounded = '2xl' }) => {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' };
  return (
    <img
      src="/fzaeen-logo.jpeg"
      alt="فزاعين"
      className={`${sizes[size]} rounded-${rounded} object-cover shadow-md`}
    />
  );
};

const NAV_LINKS = [
  { label: 'الرئيسية', href: '#hero' },
  { label: 'خدماتنا', href: '#services' },
  { label: 'كيف يعمل', href: '#how' },
  { label: 'التطبيقات', href: '#apps' },
  { label: 'تواصل معنا', href: '#contact' },
];

export const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900" dir="rtl">

      {/* Navbar */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-amber-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2.5">
              <Logo size="md" rounded="xl" />
              <span className={`text-xl sm:text-2xl font-black tracking-tight ${scrolled ? 'text-gray-900' : 'text-white'}`}>فزاعين</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {NAV_LINKS.map(l => (
                <button key={l.href} onClick={() => scrollTo(l.href)}
                  className={`font-semibold text-sm lg:text-base transition-colors hover:text-amber-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
                  {l.label}
                </button>
              ))}
              <Link to="/admin"
                className="bg-black text-amber-400 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-900 transition-all hover:shadow-lg border border-amber-400/30">
                لوحة التحكم
              </Link>
            </nav>
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen
                ? <X className={`w-6 h-6 ${scrolled ? 'text-gray-900' : 'text-white'}`} />
                : <Menu className={`w-6 h-6 ${scrolled ? 'text-gray-900' : 'text-white'}`} />
              }
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-xl">
            <div className="px-4 py-4 flex flex-col gap-3">
              {NAV_LINKS.map(l => (
                <button key={l.href} onClick={() => scrollTo(l.href)}
                  className="text-gray-800 font-semibold py-2 text-right hover:text-amber-500 transition-colors border-b border-gray-50">
                  {l.label}
                </button>
              ))}
              <Link to="/admin" onClick={() => setMenuOpen(false)}
                className="bg-black text-amber-400 font-bold px-4 py-3 rounded-xl text-center text-sm mt-1">
                لوحة التحكم
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #FFBB00 0%, #FF9500 60%, #FF6B00 100%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-yellow-300/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-black/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left text */}
            <div className="text-black space-y-6 sm:space-y-8 text-center lg:text-right order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 bg-black/10 backdrop-blur-sm px-4 py-2 rounded-full border border-black/10 text-sm font-bold text-black">
                <Zap className="w-4 h-4 text-black" />
                <span>خدمة مساعدة الطريق – داخل المدينة</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight text-black">
                عطلت سيارتك؟
                <span className="block mt-1" style={{ color: '#1a1a1a' }}>احنا جاهزين لك</span>
              </h1>
              <p className="text-black/75 text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
                فزاعين يوصّلك بأقرب مزود خدمة في منطقتك – سواء بنشر، بطارية، أو نسيت مفتاحك. كل شيء من التطبيق مباشرة.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-end">
                <a href="#apps" onClick={(e) => { e.preventDefault(); scrollTo('#apps'); }}
                  className="group bg-black text-amber-400 font-bold px-8 py-4 rounded-2xl text-base hover:bg-gray-900 hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2.5">
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  حمّل التطبيق
                </a>
                <button onClick={() => scrollTo('#how')}
                  className="bg-white/25 backdrop-blur-sm border border-black/20 text-black font-bold px-8 py-4 rounded-2xl text-base hover:bg-white/40 transition-all duration-300 flex items-center justify-center gap-2">
                  كيف يشتغل؟
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center lg:justify-end gap-10 pt-2">
                {[
                  { num: '+٥٠٠٠', label: 'طلب منجز' },
                  { num: '+٢٠٠', label: 'مزود خدمة' },
                  { num: '٤.٩★', label: 'في المتجر' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-black">{s.num}</div>
                    <div className="text-black/65 text-xs sm:text-sm font-semibold mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right mockup */}
            <div className="relative flex justify-center items-center order-1 lg:order-2">
              <div className="relative w-60 sm:w-72 lg:w-80">
                <div className="absolute inset-0 bg-black/10 rounded-[2.5rem] blur-2xl scale-105" />
                <div className="relative bg-white/20 backdrop-blur-md border border-white/40 rounded-[2.5rem] p-4 sm:p-5 shadow-2xl">
                  <div className="bg-gray-950 rounded-[2rem] p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center gap-3">
                      <img src="/fzaeen-logo.jpeg" alt="فزاعين" className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <div className="text-white font-black text-sm">فزاعين</div>
                        <div className="text-gray-400 text-xs">مساعدة على الطريق</div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <div className="text-amber-400 font-bold text-xs mb-2.5">وش عندك؟</div>
                      {[
                        { label: 'بنشر إطار', active: true },
                        { label: 'بطارية فارغة', active: false },
                        { label: 'نسيت المفتاح', active: false },
                      ].map(s => (
                        <div key={s.label} className={`flex items-center gap-2.5 py-2 px-2.5 rounded-lg mb-1 ${s.active ? 'bg-amber-500/20 border border-amber-400/40' : ''}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.active ? 'bg-amber-400' : 'bg-gray-600'}`} />
                          <span className={`text-xs font-semibold ${s.active ? 'text-amber-300' : 'text-gray-500'}`}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-amber-500 rounded-xl py-3 text-center">
                      <span className="text-black font-black text-sm">أرسل الطلب ←</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-green-500/15 rounded-lg py-2.5 border border-green-500/20">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-green-400 text-xs font-bold">نحدد موقعك...</span>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-xl px-3.5 py-2.5 flex items-center gap-2 border border-amber-100">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-gray-800">وصول خلال ١٥ دقيقة</span>
                </div>
                <div className="absolute -bottom-4 -right-3 bg-white rounded-2xl shadow-xl px-3.5 py-2.5 flex items-center gap-1.5 border border-amber-100">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-black text-gray-800">٤.٩ من ٥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-7 h-7 text-black/40" />
        </div>
      </section>

      {/* Features Strip */}
      <section className="bg-black text-white py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { icon: Zap, title: 'استجابة سريعة', desc: 'متوسط وصول المزود أقل من ٢٠ دقيقة' },
              { icon: MapPin, title: 'تتبع مباشر', desc: 'شوف المزود وين على الخريطة' },
              { icon: Award, title: 'مزودون معتمدون', desc: 'كل مزود موثق ومقيّم من عملاء سابقين' },
              { icon: Clock, title: 'متاح دايمًا', desc: 'الخدمة شغّالة ٢٤ ساعة، ٧ أيام' },
            ].map(f => (
              <div key={f.title} className="flex flex-col items-center lg:items-end text-center lg:text-right gap-3 group">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-black" />
                </div>
                <div>
                  <div className="font-black text-base sm:text-lg text-white">{f.title}</div>
                  <div className="text-gray-400 text-xs sm:text-sm mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-amber-200">
              <Wrench className="w-4 h-4" />
              الخدمات
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              ثلاث خدمات، <span className="text-amber-500">كل ما تحتاجه</span>
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto">
              الخدمات الأكثر طلبًا عند أعطال الطريق – كلها متاحة في تطبيق واحد
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Wrench,
                color: 'bg-amber-500',
                border: 'border-amber-200',
                accent: 'text-amber-600',
                title: 'بنشر الإطارات',
                desc: 'سواء كان الإطار فاضي أو طاح كلياً، المزود يجي عندك بالعدة اللازمة ويصلح المشكلة في موقعك.',
                features: ['تغيير الإطار الكامل', 'تركيب الاستبني', 'ضخ هواء', 'فحص باقي الإطارات'],
              },
              {
                icon: Battery,
                color: 'bg-blue-600',
                border: 'border-blue-200',
                accent: 'text-blue-600',
                title: 'خدمات البطارية',
                desc: 'إذا ما شغّلت سيارتك أو البطارية ضعيفة، نوصّل لك مزود يشحنها أو يبدّلها بالكامل.',
                features: ['شحن البطارية', 'تشغيل من بطارية ثانية', 'تبديل البطارية', 'فحص الكهرباء'],
              },
              {
                icon: Key,
                color: 'bg-emerald-600',
                border: 'border-emerald-200',
                accent: 'text-emerald-600',
                title: 'فتح السيارة',
                desc: 'نسيت المفتاح جوّا؟ مزودونا عندهم أدوات متخصصة يفتحون سيارتك بأمان ودون أي خدش.',
                features: ['فتح القفل الإلكتروني', 'فتح القفل العادي', 'استخراج المفاتيح', 'ضمان بدون ضرر'],
              },
            ].map(s => (
              <div key={s.title} className={`bg-white rounded-3xl border-2 ${s.border} p-6 sm:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
                <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center mb-6 shadow-md`}>
                  <s.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm sm:text-base leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2.5">
                  {s.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className={`w-4 h-4 ${s.accent} flex-shrink-0`} />
                      <span className="text-gray-700 font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 sm:mt-10 bg-red-50 border-2 border-red-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-1">حالات الطوارئ</h3>
              <p className="text-gray-600 text-sm sm:text-base">في الحالات الحرجة، طلبك يحصل على أولوية ويُوجَّه لأقرب مزود متاح مباشرة.</p>
            </div>
            <div className="sm:mr-auto flex-shrink-0">
              <span className="bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 shadow">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                أولوية قصوى
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-amber-200">
              <Zap className="w-4 h-4" />
              خطوات بسيطة
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              من التطبيق لباب سيارتك <span className="text-amber-500">بأربع خطوات</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 relative">
            <div className="hidden lg:block absolute top-14 right-[12.5%] left-[12.5%] h-0.5 bg-gradient-to-l from-amber-200 to-amber-400" />
            {[
              { num: '١', icon: '📱', title: 'افتح التطبيق', desc: 'حمّل فزاعين وسجّل دخولك، ما يأخذ دقيقتين' },
              { num: '٢', icon: '🔧', title: 'اختر المشكلة', desc: 'اضغط على نوع الخدمة اللي تحتاجها' },
              { num: '٣', icon: '📍', title: 'أرسل الطلب', desc: 'يحدد موقعك تلقائيًا ويرسل لأقرب مزود' },
              { num: '٤', icon: '✅', title: 'استقبل المزود', desc: 'تابعه على الخريطة حتى يوصل لك' },
            ].map((step) => (
              <div key={step.num} className="relative flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg z-10 relative text-3xl">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-black text-amber-400 text-xs font-black rounded-full flex items-center justify-center border-2 border-white shadow">
                    {step.num}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-1.5">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Download */}
      <section id="apps" className="py-16 sm:py-24 bg-black relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-400 px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-amber-500/25">
              <Download className="w-4 h-4" />
              التطبيقات
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
              تطبيقان لكل طرف
            </h2>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
              عميل يحتاج مساعدة؟ أو مزود يريد يشتغل؟ عندنا تطبيق لكل واحد
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {[
              {
                emoji: '🚗',
                tag: 'للعملاء',
                title: 'تطبيق فزاعين – العملاء',
                desc: 'احتجت مساعدة على الطريق؟ اطلب من تطبيقك وراقب المزود وهو يقترب منك على الخريطة.',
                border: 'border-amber-500/30',
                glow: 'bg-amber-500/10',
                features: ['طلب سريع بنقرتين', 'تتبع مباشر للمزود', 'تقييم الخدمة بعد الانتهاء'],
                appleHref: 'https://apps.apple.com',
                googleHref: 'https://play.google.com',
              },
              {
                emoji: '🔧',
                tag: 'للمزودين',
                title: 'تطبيق فزاعين – المزودون',
                desc: 'انضم لشبكة فزاعين وابدأ تستقبل طلبات في منطقتك. شغّل وقتك ووسّع دخلك.',
                border: 'border-gray-600',
                glow: 'bg-gray-800/50',
                features: ['استقبال الطلبات فوري', 'إدارة حالة كل طلب', 'تتبع الأرباح والمدفوعات'],
                appleHref: 'https://apps.apple.com',
                googleHref: 'https://play.google.com',
              },
            ].map(app => (
              <div key={app.tag} className={`${app.glow} border ${app.border} rounded-3xl p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{app.emoji}</span>
                  <span className="bg-amber-500 text-black font-bold text-xs px-3 py-1 rounded-full">{app.tag}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-3">{app.title}</h3>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-5">{app.desc}</p>
                <ul className="space-y-2 mb-6">
                  {app.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a href={app.appleHref} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-5 py-3 rounded-2xl hover:bg-gray-100 transition-all duration-200 hover:shadow-lg group flex-1">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0 group-hover:scale-110 transition-transform" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 leading-none">Download on the</div>
                      <div className="text-sm font-black leading-tight">App Store</div>
                    </div>
                  </a>
                  <a href={app.googleHref} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-5 py-3 rounded-2xl hover:bg-gray-100 transition-all duration-200 hover:shadow-lg group flex-1">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0 group-hover:scale-110 transition-transform" fill="currentColor">
                      <path d="M3.18 23.76a2.5 2.5 0 0 1-1.18-2.22V2.46A2.5 2.5 0 0 1 3.18.24l11.37 11.76-11.37 11.76zm13.09-8.04L4.02 23.4l10.5-6.06 1.75-1.62zm2.96-4.16c.64.37 1.03.99 1.03 1.67s-.39 1.3-1.03 1.67l-2.61 1.51-2.02-2.09 2.02-2.09 2.61 1.33zm-15.2-9.15 12.25 7.68-1.75 1.62-10.5-6.06z" />
                    </svg>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 leading-none">Get it on</div>
                      <div className="text-sm font-black leading-tight">Google Play</div>
                    </div>
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-600 text-sm mt-8 flex items-center justify-center gap-2">
            <Globe className="w-4 h-4" />
            مجاني على iOS و Android
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: 'linear-gradient(135deg, #FFBB00 0%, #FF9500 100%)' }} className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { icon: Users, num: '+٥٠٠٠', label: 'مستخدم' },
              { icon: Wrench, num: '+٢٠٠', label: 'مزود معتمد' },
              { icon: CheckCircle, num: '٩٨٪', label: 'رضا العملاء' },
              { icon: Clock, num: '١٥ د', label: 'متوسط الوصول' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/15 rounded-2xl flex items-center justify-center">
                  <s.icon className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-black">{s.num}</div>
                <div className="text-black/65 text-sm sm:text-base font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us / Testimonials */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-amber-200">
                <Award className="w-4 h-4" />
                ليش فزاعين؟
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-5 leading-tight">
                ما نحن اللي ننفذ الخدمة –<br />
                <span className="text-amber-500">نحن من يوصّلك بمن ينفذها</span>
              </h2>
              <p className="text-gray-600 text-base leading-relaxed mb-8">
                فزاعين وسيط تقني ذكي. ما عندنا موظفين في الميدان، لكن عندنا شبكة مزودين موثقين وجاهزين في مناطق مختلفة من المدينة.
              </p>
              <div className="space-y-5">
                {[
                  { title: 'شبكة واسعة', desc: 'أكثر من ٢٠٠ مزود في أنحاء المدينة، كل واحد موثق بهويته وأدواته' },
                  { title: 'شفافية تامة', desc: 'تعرف السعر قبل ما تؤكد الطلب – لا مفاجآت' },
                  { title: 'تتبع حقيقي', desc: 'الخريطة تتحدث لحظة بلحظة، تشوف المزود وهو يتحرك' },
                  { title: 'دعم فعلي', desc: 'فريق دعم يرد عليك بسرعة إذا صار أي شيء' },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-4">
                    <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <div className="font-black text-gray-900 text-sm sm:text-base">{f.title}</div>
                      <div className="text-gray-500 text-sm mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { name: 'أحمد م.', service: 'بنشر إطار', rating: 5, comment: 'وصل المزود خلال ١٢ دقيقة. غيّر الإطار وراح. سريع وما فيه تعقيد.' },
                { name: 'سارة ع.', service: 'بطارية', rating: 5, comment: 'كانت السيارة ما تشتغل في منطقة مظلمة. فزاعين أنقذني بالحرف.' },
                { name: 'محمد الشمري', service: 'فتح سيارة', rating: 5, comment: 'نسيت المفتاح جوّا. فتحوا بدون أي خدش والحمد لله. شكرًا جزيلًا.' },
              ].map((r, i) => (
                <div key={r.name} className={`bg-gray-50 rounded-2xl p-5 border border-gray-100 ${i === 1 ? 'lg:mr-8' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-black text-gray-900 text-sm">{r.name}</div>
                      <div className="text-amber-600 text-xs font-bold mt-0.5">{r.service}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: r.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">"{r.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">عندك سؤال؟</h2>
          <p className="text-gray-500 text-base sm:text-lg mb-10">راسلنا وبنرد عليك بأسرع وقت</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <a href="mailto:support@fzaeen.com"
              className="bg-white border-2 border-gray-100 rounded-2xl p-6 flex items-center gap-4 hover:shadow-lg transition-all duration-300 hover:border-amber-300 group">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-500 transition-colors flex-shrink-0">
                <Mail className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-right">
                <div className="font-black text-gray-900">البريد الإلكتروني</div>
                <div className="text-amber-500 text-sm font-bold mt-0.5">support@fzaeen.com</div>
              </div>
            </a>
            <Link to="/privacy"
              className="bg-white border-2 border-gray-100 rounded-2xl p-6 flex items-center gap-4 hover:shadow-lg transition-all duration-300 hover:border-amber-300 group">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-500 transition-colors flex-shrink-0">
                <Award className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-right">
                <div className="font-black text-gray-900">سياسة الخصوصية</div>
                <div className="text-gray-400 text-sm mt-0.5">اقرأ شروط الخدمة والخصوصية</div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex items-center gap-3">
                <img src="/fzaeen-logo.jpeg" alt="فزاعين" className="w-10 h-10 rounded-xl object-cover" />
                <span className="text-white text-xl font-black">فزاعين</span>
              </div>
              <p className="text-sm text-center md:text-right max-w-xs text-gray-500">مساعدة طريق سريعة – داخل المدينة</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 text-sm text-center md:text-right">
              <div className="space-y-2.5">
                <div className="text-white font-black mb-3">روابط</div>
                {NAV_LINKS.map(l => (
                  <button key={l.href} onClick={() => scrollTo(l.href)}
                    className="block hover:text-amber-400 transition-colors mx-auto md:mr-0">
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2.5">
                <div className="text-white font-black mb-3">قانوني</div>
                <Link to="/privacy" className="block hover:text-amber-400 transition-colors">سياسة الخصوصية</Link>
                <Link to="/terms" className="block hover:text-amber-400 transition-colors">الشروط والأحكام</Link>
              </div>
              <div className="space-y-2.5">
                <div className="text-white font-black mb-3">للإدارة</div>
                <Link to="/admin" className="block hover:text-amber-400 transition-colors">لوحة التحكم</Link>
                <a href="mailto:support@fzaeen.com" className="block hover:text-amber-400 transition-colors">الدعم</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm">
            <p>© {new Date().getFullYear()} فزاعين – جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
