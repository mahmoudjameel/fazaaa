import { Link } from 'react-router-dom';
import { Shield, ArrowRight, ChevronRight } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="mb-8 sm:mb-10">
    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-400 rounded-full flex-shrink-0" />
      {title}
    </h2>
    <div className="text-gray-600 leading-relaxed space-y-3 text-sm sm:text-base pr-4">{children}</div>
  </div>
);

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 text-white pt-16 pb-20 sm:pt-20 sm:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-300/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-6 transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs sm:text-sm font-medium">فزّاعين</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black">سياسة الخصوصية</h1>
            </div>
          </div>
          <p className="text-white/80 text-sm sm:text-base max-w-2xl">
            نحن ملتزمون بحماية خصوصيتك وبياناتك الشخصية. هذه السياسة توضح كيف نجمع المعلومات ونستخدمها ونحميها.
          </p>
          <p className="text-white/60 text-xs sm:text-sm mt-3">آخر تحديث: يناير ٢٠٢٥</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 pb-16 sm:pb-24 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-10 lg:p-14">

          <Section title="١. مقدمة">
            <p>
              تطبيق فزّاعين ("التطبيق" أو "نحن") يحترم خصوصية مستخدميه ويلتزم بحماية بياناتهم الشخصية.
              تسري هذه السياسة على جميع المستخدمين سواء كانوا عملاء أو مزودي خدمة.
            </p>
            <p>
              باستخدامك للتطبيق، فإنك توافق على جمع واستخدام معلوماتك وفق ما هو موضح في هذه السياسة.
            </p>
          </Section>

          <Section title="٢. المعلومات التي نجمعها">
            <p className="font-semibold text-gray-800">أ. المعلومات التي تقدمها مباشرةً:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'الاسم الكامل ورقم الجوال وعنوان البريد الإلكتروني',
                'صورة الملف الشخصي (اختيارية)',
                'بيانات المزودين: وثائق الهوية، رخصة القيادة، بيانات المركبة',
                'معلومات الدفع والفوترة',
              ].map(i => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
            <p className="font-semibold text-gray-800 mt-4">ب. المعلومات التي نجمعها تلقائياً:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'بيانات الموقع الجغرافي (عند استخدام التطبيق)',
                'معرّف الجهاز (Device ID) ونظام التشغيل',
                'سجل الطلبات والخدمات',
                'بيانات الاستخدام وسجلات التطبيق',
              ].map(i => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="٣. كيف نستخدم معلوماتك">
            <ul className="list-none space-y-2">
              {[
                'توفير خدمات المساعدة على الطريق وربطك بمزودي الخدمة',
                'التحقق من هوية المستخدمين ومزودي الخدمة',
                'معالجة المدفوعات وإدارة حسابات الأرباح للمزودين',
                'إرسال الإشعارات المتعلقة بحالة الطلبات',
                'تحسين الخدمة وتطوير التطبيق',
                'الامتثال للمتطلبات القانونية والتنظيمية',
                'حل النزاعات والشكاوى',
              ].map(i => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="٤. الموقع الجغرافي">
            <p>
              يستخدم التطبيق بيانات الموقع الجغرافي لربطك بأقرب مزود خدمة متاح. يُطلب إذن الموقع عند
              استخدام التطبيق ويمكنك إلغاؤه من إعدادات جهازك في أي وقت، علماً بأن ذلك قد يؤثر على
              تجربة استخدام التطبيق.
            </p>
            <p>
              لا تُخزَّن بيانات موقعك الدقيق بعد إتمام الخدمة، ويُستخدم فقط موقع الطلب لأغراض السجل
              التشغيلي.
            </p>
          </Section>

          <Section title="٥. مشاركة المعلومات">
            <p className="font-semibold text-gray-800">نشارك معلوماتك فقط في الحالات التالية:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'مع مزودي الخدمة المعتمدين لإتمام طلباتك (الاسم والموقع)',
                'مع مزودي خدمات الدفع لمعالجة المعاملات المالية',
                'مع جهات إنفاذ القانون عند الطلب القانوني الرسمي',
                'مع شركاء تقنيين موثوقين لتشغيل الخدمة (Firebase, إشعارات)',
              ].map(i => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-medium text-gray-800">
              لا نبيع بياناتك الشخصية لأي طرف ثالث بأي حال من الأحوال.
            </p>
          </Section>

          <Section title="٦. أمان البيانات">
            <p>
              نطبق معايير أمان صارمة لحماية بياناتك، تشمل:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'تشفير البيانات أثناء النقل (HTTPS/TLS)',
                'تخزين آمن في خوادم Firebase المشفرة',
                'صلاحيات وصول محدودة لفريق العمل',
                'مراجعات دورية لبروتوكولات الأمان',
              ].map(i => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="٧. حقوقك">
            <p>لديك الحق في:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'الاطلاع على بياناتك الشخصية المخزنة',
                'تصحيح أي بيانات غير دقيقة',
                'طلب حذف حسابك وبياناتك',
                'سحب موافقتك على معالجة بيانات الموقع',
                'الاعتراض على استخدام معين لبياناتك',
              ].map(i => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              للاستخدام أي من هذه الحقوق، تواصل معنا على: <a href="mailto:support@fzaeen.com" className="text-orange-500 font-medium hover:underline">support@fzaeen.com</a>
            </p>
          </Section>

          <Section title="٨. الاحتفاظ بالبيانات">
            <p>
              نحتفظ ببياناتك طالما كان حسابك نشطاً. عند إغلاق الحساب، نحتفظ بالبيانات الضرورية لمدة
              لا تتجاوز ٩٠ يوماً لأغراض قانونية وتشغيلية قبل الحذف الكامل.
            </p>
          </Section>

          <Section title="٩. خصوصية الأطفال">
            <p>
              تطبيق فزّاعين غير مخصص لمن هم دون سن ١٨ عاماً. لا نجمع بيانات الأطفال عمداً.
              إذا علمنا بجمع بيانات طفل دون موافقة الوالدين، سنحذفها فوراً.
            </p>
          </Section>

          <Section title="١٠. التحديثات على هذه السياسة">
            <p>
              قد نحدّث هذه السياسة من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر إشعار داخل التطبيق أو
              البريد الإلكتروني. الاستمرار في استخدام التطبيق بعد التحديث يعني موافقتك على السياسة الجديدة.
            </p>
          </Section>

          <Section title="١١. تواصل معنا">
            <p>لأي استفسار بشأن سياسة الخصوصية:</p>
            <div className="mt-3 space-y-1.5">
              <p>📧 البريد الإلكتروني: <a href="mailto:support@fzaeen.com" className="text-orange-500 font-medium hover:underline">support@fzaeen.com</a></p>
              <p>🌐 الموقع الإلكتروني: <span className="text-orange-500 font-medium">fzaeen.com</span></p>
            </div>
          </Section>

          <div className="border-t border-gray-100 pt-6 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-xs">© {new Date().getFullYear()} فزّاعين – جميع الحقوق محفوظة</p>
            <div className="flex gap-4">
              <Link to="/" className="text-orange-500 text-sm font-medium hover:underline">الرئيسية</Link>
              <Link to="/terms" className="text-orange-500 text-sm font-medium hover:underline">الشروط والأحكام</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
