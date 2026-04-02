import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Zap, MapPin, Clock, Star, ChevronDown,
  CheckCircle, Phone, Mail, Menu, X, ArrowLeft,
  Battery, Wrench, Key, AlertTriangle, Users, Award,
  Download, Smartphone, Globe
} from 'lucide-react';

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
  const [activeSection, setActiveSection] = useState('hero');

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
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className={`text-xl sm:text-2xl font-black ${scrolled ? 'text-gray-900' : 'text-white'}`}>فزّاعين</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {NAV_LINKS.map(l => (
                <button key={l.href} onClick={() => scrollTo(l.href)}
                  className={`font-semibold text-sm lg:text-base transition-colors hover:text-orange-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
                  {l.label}
                </button>
              ))}
              <Link to="/admin" className="bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold px-4 py-2 rounded-xl text-sm hover:shadow-lg transition-all hover:scale-105">
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
                  className="text-gray-800 font-semibold py-2 text-right hover:text-orange-500 transition-colors">
                  {l.label}
                </button>
              ))}
              <Link to="/admin" onClick={() => setMenuOpen(false)}
                className="bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold px-4 py-2.5 rounded-xl text-center text-sm mt-1">
                لوحة التحكم
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="hero" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 sm:w-96 sm:h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-64 h-64 sm:w-80 sm:h-80 bg-amber-300/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-t from-black/20 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-0 w-full">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center min-h-screen lg:min-h-0 lg:py-32">
            <div className="text-white space-y-6 sm:space-y-8 text-center lg:text-right order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30 text-sm font-semibold">
                <Zap className="w-4 h-4 text-amber-200" />
                <span>مساعدة طريق سريعة بالقرب منك</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight">
                عالق على الطريق؟
                <span className="block text-amber-200 mt-1">نحن هنا لك!</span>
              </h1>
              <p className="text-white/85 text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0">
                فزّاعين يربطك بأقرب مزود خدمة متاح في ثوانٍ. بنشر، بطارية، أو فتح سيارة – كل ما تحتاجه بضغطة واحدة.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-end">
                <a href="#apps" onClick={(e) => { e.preventDefault(); scrollTo('#apps'); }}
                  className="group bg-white text-orange-600 font-bold px-7 py-3.5 rounded-2xl text-base hover:bg-amber-50 hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2">
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  حمّل التطبيق الآن
                </a>
                <button onClick={() => scrollTo('#how')}
                  className="bg-white/15 backdrop-blur-sm border border-white/40 text-white font-bold px-7 py-3.5 rounded-2xl text-base hover:bg-white/25 transition-all duration-300 flex items-center justify-center gap-2">
                  كيف يعمل؟
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center lg:justify-end gap-8 pt-2">
                {[
                  { num: '٥٠٠٠+', label: 'طلب مكتمل' },
                  { num: '٢٠٠+', label: 'مزود خدمة' },
                  { num: '٤.٩', label: 'تقييم المتجر' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-amber-200">{s.num}</div>
                    <div className="text-white/75 text-xs sm:text-sm font-medium mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative flex justify-center items-center order-1 lg:order-2">
              <div className="relative w-56 sm:w-72 lg:w-80">
                <div className="absolute inset-0 bg-white/20 rounded-[2.5rem] blur-xl scale-110" />
                <div className="relative bg-white/15 backdrop-blur-sm border border-white/30 rounded-[2.5rem] p-4 sm:p-6 shadow-2xl">
                  <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-[2rem] p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">فزّاعين</div>
                        <div className="text-gray-400 text-xs">مساعدة الطريق</div>
                      </div>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-3">
                      <div className="text-amber-400 font-bold text-xs mb-2">اختر الخدمة</div>
                      {['بنشر إطارات', 'شحن بطارية', 'فتح سيارة'].map((s, i) => (
                        <div key={s} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1 ${i === 0 ? 'bg-orange-500/20 border border-orange-500/40' : ''}`}>
                          <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-orange-400' : 'bg-gray-600'}`} />
                          <span className={`text-xs font-medium ${i === 0 ? 'text-orange-300' : 'text-gray-400'}`}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-orange-500 rounded-xl py-2.5 text-center">
                      <span className="text-white font-bold text-sm">إرسال الطلب ←</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-green-500/20 rounded-lg py-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-green-400 text-xs font-semibold">جاري تحديد موقعك...</span>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-gray-800">متوسط الوصول ١٥ دقيقة</span>
                </div>
                <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-gray-800">٤.٩ من ٥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-7 h-7 text-white/60" />
        </div>
      </section>

      {/* Features Strip */}
      <section className="bg-gray-950 text-white py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { icon: Zap, title: 'خدمة سريعة', desc: 'متوسط وصول المزود ١٥ دقيقة' },
              { icon: MapPin, title: 'تتبع مباشر', desc: 'تابع موقع المزود لحظة بلحظة' },
              { icon: Shield, title: 'مزودون موثوقون', desc: 'مدققو الهوية ومقيّمون' },
              { icon: Clock, title: 'خدمة ٢٤/٧', desc: 'متاح في أي وقت تحتاجه' },
            ].map(f => (
              <div key={f.title} className="flex flex-col items-center lg:items-end text-center lg:text-right gap-3 group">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-base sm:text-lg">{f.title}</div>
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
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
              <Wrench className="w-4 h-4" />
              خدماتنا
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              كل ما تحتاجه <span className="text-orange-500">على الطريق</span>
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
              نوفر خدمات شاملة لمشاكل السيارات الأكثر شيوعاً، عبر مزودين محترفين قريبين منك
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Wrench,
                gradient: 'from-orange-500 to-amber-400',
                bg: 'bg-orange-50',
                border: 'border-orange-200',
                title: 'خدمات البنشر',
                desc: 'تغيير وإصلاح الإطارات بجميع أنواعها. مزودون معهم أدوات متكاملة للوصول إليك أينما كنت.',
                features: ['تغيير الإطار التالف', 'تركيب الاستبني', 'ضخ هواء الإطارات', 'فحص الإطارات'],
              },
              {
                icon: Battery,
                gradient: 'from-blue-500 to-indigo-500',
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                title: 'خدمات البطارية',
                desc: 'إعادة تشغيل سيارتك أو تبديل البطارية القديمة بأخرى جديدة في موقعك مباشرة.',
                features: ['شحن البطارية', 'تشغيل السيارة بالبطارية', 'تبديل البطارية', 'فحص النظام الكهربائي'],
              },
              {
                icon: Key,
                gradient: 'from-emerald-500 to-teal-500',
                bg: 'bg-emerald-50',
                border: 'border-emerald-200',
                title: 'فتح السيارة',
                desc: 'نسيت مفاتيحك داخل السيارة؟ مزودونا المتخصصون يصلون إليك بسرعة لفتح سيارتك بأمان.',
                features: ['فتح القفل الإلكتروني', 'فتح القفل التقليدي', 'استخراج المفاتيح', 'دون أي ضرر للسيارة'],
              },
            ].map(s => (
              <div key={s.title} className={`bg-white rounded-3xl border ${s.border} p-6 sm:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
                <div className={`w-14 h-14 bg-gradient-to-br ${s.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                  <s.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm sm:text-base leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2.5">
                  {s.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 sm:mt-12 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">خدمات الطوارئ</h3>
              <p className="text-gray-600 text-sm sm:text-base">في حالات الطوارئ الحرجة، يتم توجيه طلبك بأولوية قصوى لأقرب مزود متاح مع وقت استجابة مضمون.</p>
            </div>
            <div className="sm:mr-auto flex-shrink-0">
              <span className="bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2">
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
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
              <Zap className="w-4 h-4" />
              كيف يعمل
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              ٤ خطوات بسيطة <span className="text-orange-500">للمساعدة</span>
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
              من لحظة طلبك حتى وصول المزود – كل شيء سلس وسريع
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 relative">
            <div className="hidden lg:block absolute top-16 right-[12.5%] left-[12.5%] h-0.5 bg-gradient-to-l from-orange-200 via-orange-300 to-orange-200" />
            {[
              { num: '١', icon: Smartphone, title: 'افتح التطبيق', desc: 'حمّل فزّاعين وافتحه فور حدوث العطل' },
              { num: '٢', icon: Wrench, title: 'اختر المشكلة', desc: 'حدد نوع الخدمة التي تحتاجها بضغطة واحدة' },
              { num: '٣', icon: MapPin, title: 'أرسل الطلب', desc: 'يتم تحديد موقعك تلقائياً وإرسال الطلب' },
              { num: '٤', icon: CheckCircle, title: 'استقبل المزود', desc: 'تابع وصول المزود على الخريطة مباشرة' },
            ].map((step, i) => (
              <div key={step.num} className="relative flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg z-10 relative">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-gray-900 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white">
                    {step.num}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1.5">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps Download */}
      <section id="apps" className="py-16 sm:py-24 bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-orange-500/30">
              <Download className="w-4 h-4" />
              التطبيقات
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
              حمّل التطبيق المناسب لك
            </h2>
            <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
              سواء كنت عميلاً تبحث عن مساعدة، أو مزود خدمة تريد تنمية أعمالك
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {[
              {
                type: 'customer',
                emoji: '🚗',
                gradient: 'from-orange-500 to-amber-400',
                gradientLight: 'from-orange-500/20 to-amber-400/20',
                border: 'border-orange-500/30',
                title: 'تطبيق العملاء',
                titleEn: 'Customer App',
                desc: 'احصل على المساعدة التي تحتاجها في أسرع وقت. اطلب خدمة بنشر، بطارية، أو فتح سيارة من مزودين قريبين ومعتمدين.',
                features: ['طلب سريع وسهل', 'تتبع المزود على الخريطة', 'تقييم الخدمة بعد الانتهاء'],
                appleHref: 'https://apps.apple.com',
                googleHref: 'https://play.google.com',
                appleLabel: 'App Store',
                googleLabel: 'Google Play',
              },
              {
                type: 'provider',
                emoji: '🔧',
                gradient: 'from-blue-500 to-indigo-500',
                gradientLight: 'from-blue-500/20 to-indigo-500/20',
                border: 'border-blue-500/30',
                title: 'تطبيق المزودين',
                titleEn: 'Provider App',
                desc: 'انضم إلى شبكة فزّاعين وابدأ باستقبال طلبات الخدمة في منطقتك. زِد دخلك وأعمالك بسهولة.',
                features: ['استقبال الطلبات فورياً', 'إدارة حالة الطلب', 'تتبع الأرباح والمدفوعات'],
                appleHref: 'https://apps.apple.com',
                googleHref: 'https://play.google.com',
                appleLabel: 'App Store',
                googleLabel: 'Google Play',
              },
            ].map(app => (
              <div key={app.type} className={`bg-gradient-to-br ${app.gradientLight} border ${app.border} rounded-3xl p-6 sm:p-8 backdrop-blur-sm`}>
                <div className="text-5xl mb-4">{app.emoji}</div>
                <div className="mb-1">
                  <span className={`text-xs font-bold bg-gradient-to-r ${app.gradient} bg-clip-text text-transparent uppercase tracking-widest`}>
                    {app.titleEn}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-3">{app.title}</h3>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-5">{app.desc}</p>
                <ul className="space-y-2 mb-6">
                  {app.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
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
                      <div className="text-[10px] text-gray-500 font-normal leading-none">Download on the</div>
                      <div className="text-sm font-bold leading-tight">{app.appleLabel}</div>
                    </div>
                  </a>
                  <a href={app.googleHref} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 bg-white text-gray-900 font-bold px-5 py-3 rounded-2xl hover:bg-gray-100 transition-all duration-200 hover:shadow-lg group flex-1">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0 group-hover:scale-110 transition-transform" fill="currentColor">
                      <path d="M3.18 23.76a2.5 2.5 0 0 1-1.18-2.22V2.46A2.5 2.5 0 0 1 3.18.24l11.37 11.76-11.37 11.76zm13.09-8.04L4.02 23.4l10.5-6.06 1.75-1.62zm2.96-4.16c.64.37 1.03.99 1.03 1.67s-.39 1.3-1.03 1.67l-2.61 1.51-2.02-2.09 2.02-2.09 2.61 1.33zm-15.2-9.15 12.25 7.68-1.75 1.62-10.5-6.06z" />
                    </svg>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 font-normal leading-none">Get it on</div>
                      <div className="text-sm font-bold leading-tight">{app.googleLabel}</div>
                    </div>
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 sm:mt-14 text-center">
            <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
              <Globe className="w-4 h-4" />
              متاح على iOS و Android – مجاني تماماً
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 sm:py-20 bg-gradient-to-r from-orange-500 to-amber-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-white text-center">
            {[
              { icon: Users, num: '٥,٠٠٠+', label: 'مستخدم نشط' },
              { icon: Wrench, num: '٢٠٠+', label: 'مزود خدمة معتمد' },
              { icon: CheckCircle, num: '٩٨٪', label: 'نسبة رضا العملاء' },
              { icon: Clock, num: '١٥', label: 'دقيقة متوسط الوصول' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                  <s.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="text-3xl sm:text-4xl font-black">{s.num}</div>
                <div className="text-white/80 text-sm sm:text-base font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
                <Award className="w-4 h-4" />
                لماذا فزّاعين
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-6 leading-tight">
                نربطك بالمساعدة <br />
                <span className="text-orange-500">لا ننفذها مباشرة</span>
              </h2>
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-8">
                فزّاعين وسيط تقني ذكي يختصر عليك البحث عن المساعدة ويوصلك بأقرب مزود خدمة معتمد ومجرّب.
              </p>
              <div className="space-y-5">
                {[
                  { title: 'شبكة مزودين واسعة', desc: 'أكثر من ٢٠٠ مزود خدمة مُدقق في أنحاء المدينة' },
                  { title: 'دفع آمن ومرن', desc: 'خيارات دفع متعددة داخل التطبيق' },
                  { title: 'تتبع في الوقت الفعلي', desc: 'تابع الطلب من الإرسال حتى الإنهاء' },
                  { title: 'دعم فني متواصل', desc: 'فريق دعم مستعد لمساعدتك ٢٤/٧' },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-4">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm sm:text-base">{f.title}</div>
                      <div className="text-gray-500 text-sm mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gray-50 rounded-3xl p-6 sm:p-8 space-y-4">
                {[
                  { name: 'أحمد المطيري', service: 'خدمة بنشر', rating: 5, comment: 'وصل المزود خلال ١٢ دقيقة! خدمة ممتازة وسريعة جداً.' },
                  { name: 'سارة العتيبي', service: 'شحن بطارية', rating: 5, comment: 'كنت عالقة في موقف مظلم، فزّاعين أنقذني حقاً. شكراً!' },
                  { name: 'محمد الشمري', service: 'فتح سيارة', rating: 5, comment: 'نسيت مفتاحي وفتحوا سيارتي بمهنية عالية خلال وقت قياسي.' },
                ].map((r, i) => (
                  <div key={r.name} className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 ${i === 1 ? 'sm:mr-6' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{r.name}</div>
                        <div className="text-orange-500 text-xs font-medium">{r.service}</div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">"{r.comment}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
            <Phone className="w-4 h-4" />
            تواصل معنا
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            هل لديك سؤال؟
          </h2>
          <p className="text-gray-500 text-base sm:text-lg mb-10">فريق دعمنا جاهز دائماً لمساعدتك</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <a href="mailto:support@fzaeen.com"
              className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-4 hover:shadow-lg transition-all duration-300 hover:border-orange-200 group">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <Mail className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" />
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900 text-base">البريد الإلكتروني</div>
                <div className="text-orange-500 text-sm font-medium mt-0.5">support@fzaeen.com</div>
              </div>
            </a>
            <Link to="/privacy"
              className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-4 hover:shadow-lg transition-all duration-300 hover:border-orange-200 group">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <Shield className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" />
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900 text-base">سياسة الخصوصية</div>
                <div className="text-gray-500 text-sm mt-0.5">اقرأ سياسة الخصوصية والشروط</div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-xl font-black">فزّاعين</span>
              </div>
              <p className="text-sm text-center md:text-right max-w-xs">مساعدة طريق سريعة وموثوقة – في أي وقت وأي مكان</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 text-sm text-center md:text-right">
              <div className="space-y-2">
                <div className="text-white font-bold mb-3">روابط سريعة</div>
                {NAV_LINKS.map(l => (
                  <button key={l.href} onClick={() => scrollTo(l.href)}
                    className="block hover:text-orange-400 transition-colors mx-auto md:mr-0">
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-white font-bold mb-3">قانوني</div>
                <Link to="/privacy" className="block hover:text-orange-400 transition-colors">سياسة الخصوصية</Link>
                <Link to="/terms" className="block hover:text-orange-400 transition-colors">الشروط والأحكام</Link>
              </div>
              <div className="space-y-2">
                <div className="text-white font-bold mb-3">المنصة</div>
                <Link to="/admin" className="block hover:text-orange-400 transition-colors">لوحة التحكم</Link>
                <a href="mailto:support@fzaeen.com" className="block hover:text-orange-400 transition-colors">الدعم الفني</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm">
            <p>© {new Date().getFullYear()} فزّاعين – جميع الحقوق محفوظة</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
