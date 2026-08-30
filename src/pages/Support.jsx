import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowRight,
  Headphones,
  Mail,
  MessageCircle,
  FileText,
  Shield,
  ChevronLeft,
} from 'lucide-react';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { MarketingPageTracker } from '../components/MarketingPageTracker';
import { SeoHead } from '../components/SeoHead';
import { PAGE_SEO } from '../seo/config';
import { db } from '../services/firebase';

const DEFAULT_SUPPORT = {
  whatsappNumber: '966551780608',
  whatsappDisplay: '+966 55 178 0608',
  email: 'fzaeen@fzaeen.com',
};

const FAQ = [
  {
    q: 'كيف أطلب خدمة مساعدة على الطريق؟',
    a: 'حمّل تطبيق فزاعين للعملاء، سجّل برقم جوالك، اختر نوع الخدمة (بنشر، بطارية، أو فتح سيارة)، وأرسل الطلب. أقرب مزود متاح يوصلك.',
  },
  {
    q: 'كيف أنضم كمزود خدمة؟',
    a: 'حمّل تطبيق فزاعين للمزودين، أكمل التسجيل وارفع المستندات المطلوبة. بعد موافقة الإدارة يمكنك استقبال الطلبات.',
  },
  {
    q: 'كم يستغرق وصول المزود؟',
    a: 'يختلف حسب موقعك وتوفر المزودين. عادةً يكون الوصول خلال دقائق، وتتابع الموقع مباشرة من التطبيق.',
  },
  {
    q: 'كيف أحذف حسابي؟',
    a: 'يمكنك تقديم طلب حذف الحساب من صفحة حذف الحساب على الموقع بعد التحقق برقم الجوال.',
  },
];

export const Support = () => {
  const [support, setSupport] = useState(DEFAULT_SUPPORT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'support'));
        if (!cancelled && snap.exists()) {
          const data = snap.data() || {};
          setSupport({
            whatsappNumber: data.whatsappNumber || DEFAULT_SUPPORT.whatsappNumber,
            whatsappDisplay: data.whatsappDisplay || DEFAULT_SUPPORT.whatsappDisplay,
            email: data.email || DEFAULT_SUPPORT.email,
          });
        }
      } catch (e) {
        console.error('Error loading support settings:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const waLink = `https://wa.me/${support.whatsappNumber}?text=${encodeURIComponent('مرحباً، أحتاج مساعدة من فزاعين')}`;
  const mailHref = `mailto:${support.email}`;

  return (
    <div className="min-h-screen bg-gray-50 relative" dir="rtl" style={{ fontFamily: "'Cairo', system-ui, sans-serif" }}>
      <MarketingPageTracker pagePath="/support" pageTitle={PAGE_SEO.support?.title} />
      <SeoHead {...PAGE_SEO.support} />
      <WhatsAppFloat />

      <div className="bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 text-white pt-16 pb-20 sm:pt-20 sm:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-300/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl flex items-center justify-center">
              <Headphones className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs sm:text-sm font-medium">فزّاعين</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black">الدعم والمساعدة</h1>
            </div>
          </div>
          <p className="text-white/85 text-sm sm:text-base max-w-2xl">
            فريق الدعم جاهز يساعدك — تواصل عبر واتساب أو البريد، أو تصفّح الأسئلة الشائعة أدناه.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 pb-16 sm:pb-24 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-10 lg:p-14 space-y-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
              <p className="text-sm text-gray-500">جاري التحميل...</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-black text-gray-900 mb-4">تواصل معنا</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <div className="text-right min-w-0">
                      <div className="font-black text-gray-900 text-sm">واتساب الدعم</div>
                      <div className="text-emerald-700 font-semibold text-sm mt-0.5 dir-ltr text-right">
                        {support.whatsappDisplay}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">اضغط للمحادثة فوراً</div>
                    </div>
                  </a>

                  <a
                    href={mailHref}
                    className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-5 hover:bg-amber-50 hover:border-amber-200 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div className="text-right min-w-0">
                      <div className="font-black text-gray-900 text-sm">البريد الإلكتروني</div>
                      <div className="text-amber-700 font-semibold text-sm mt-0.5 break-all">
                        {support.email}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">نرد في أقرب وقت ممكن</div>
                    </div>
                  </a>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-gray-900 mb-4">أسئلة شائعة</h2>
                <div className="space-y-3">
                  {FAQ.map((item) => (
                    <details
                      key={item.q}
                      className="group rounded-2xl border border-gray-100 bg-gray-50/80 open:bg-white open:shadow-sm open:border-gray-200 transition-all"
                    >
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-4 sm:p-5 font-bold text-gray-900 text-sm sm:text-base">
                        <span>{item.q}</span>
                        <ChevronLeft className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-open:-rotate-90" />
                      </summary>
                      <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-gray-600 text-sm leading-relaxed -mt-1">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-gray-900 mb-4">صفحات مفيدة</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Link
                    to="/terms"
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 hover:border-amber-200 hover:bg-amber-50/40 transition-all"
                  >
                    <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                    <span className="text-sm font-bold text-gray-800">الشروط والأحكام</span>
                  </Link>
                  <Link
                    to="/privacy"
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 hover:border-amber-200 hover:bg-amber-50/40 transition-all"
                  >
                    <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                    <span className="text-sm font-bold text-gray-800">سياسة الخصوصية</span>
                  </Link>
                  <Link
                    to="/delete-account"
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 hover:border-amber-200 hover:bg-amber-50/40 transition-all"
                  >
                    <Headphones className="w-5 h-5 text-amber-600 shrink-0" />
                    <span className="text-sm font-bold text-gray-800">حذف الحساب</span>
                  </Link>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-xs">© {new Date().getFullYear()} فزّاعين – جميع الحقوق محفوظة</p>
            <Link to="/" className="text-emerald-600 text-sm font-medium hover:underline">
              الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
