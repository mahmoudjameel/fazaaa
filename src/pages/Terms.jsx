import { Link } from 'react-router-dom';
import { FileText, ArrowRight, ChevronRight } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="mb-8 sm:mb-10">
    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-400 rounded-full flex-shrink-0" />
      {title}
    </h2>
    <div className="text-gray-600 leading-relaxed space-y-3 text-sm sm:text-base pr-4">{children}</div>
  </div>
);

export const Terms = () => {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white pt-16 pb-20 sm:pt-20 sm:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium mb-6 transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs sm:text-sm font-medium">فزّاعين</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black">الشروط والأحكام</h1>
            </div>
          </div>
          <p className="text-white/70 text-sm sm:text-base max-w-2xl">
            يرجى قراءة هذه الشروط بعناية قبل استخدام تطبيق فزّاعين. استخدامك للتطبيق يعني قبولك التام لهذه الشروط.
          </p>
          <p className="text-white/40 text-xs sm:text-sm mt-3">آخر تحديث: يناير ٢٠٢٥</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 pb-16 sm:pb-24 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-10 lg:p-14">

          <Section title="١. قبول الشروط">
            <p>
              باستخدامك لتطبيق فزّاعين أو تسجيلك فيه، فإنك تقر بأنك قرأت وفهمت ووافقت على الالتزام بهذه
              الشروط والأحكام وسياسة الخصوصية الخاصة بنا.
            </p>
            <p>
              إذا كنت لا توافق على أي من هذه الشروط، فيرجى عدم استخدام التطبيق.
            </p>
          </Section>

          <Section title="٢. وصف الخدمة">
            <p>
              فزّاعين منصة تقنية تعمل كوسيط يربط العملاء الذين يحتاجون إلى خدمات مساعدة الطريق
              بمزودي الخدمة المعتمدين والمستقلين.
            </p>
            <p className="font-medium text-gray-800">الخدمات المتاحة حالياً:</p>
            <ul className="list-none space-y-2 mt-2">
              {['خدمات إصلاح وتغيير الإطارات (البنشر)', 'خدمات البطاريات (شحن وتبديل)', 'خدمة فتح أقفال السيارات'].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm">
              <strong>تنبيه هام:</strong> فزّاعين ليست طرفاً في عقد الخدمة بين العميل والمزود. نحن نوفر
              المنصة التقنية فحسب، ولا نضمن جودة أو نتيجة الخدمة المقدمة من المزودين.
            </p>
          </Section>

          <Section title="٣. شروط استخدام العملاء">
            <ul className="list-none space-y-2">
              {[
                'يجب أن يكون عمرك ١٨ سنة أو أكثر لاستخدام التطبيق',
                'يجب تقديم بيانات صحيحة ودقيقة عند التسجيل',
                'أنت مسؤول عن سلامة بيانات تسجيل الدخول الخاصة بك',
                'يُحظر استخدام التطبيق لأغراض احتيالية أو غير مشروعة',
                'لا يمكن إلغاء طلب بعد قبوله من المزود إلا برسوم إلغاء محددة',
                'يجب أن تكون في الموقع المحدد عند وصول المزود',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="٤. شروط انضمام مزودي الخدمة">
            <ul className="list-none space-y-2">
              {[
                'التحقق من الهوية الشخصية ورخصة القيادة',
                'تقديم وثائق المركبة والمعدات المطلوبة',
                'الالتزام بالوصول في الوقت المحدد',
                'معاملة العملاء باحترام ومهنية',
                'الحصول على التراخيص اللازمة لممارسة النشاط',
                'الالتزام بمعايير الجودة والسلامة',
                'قبول تقييمات العملاء والالتزام بتحسين الخدمة',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="٥. الرسوم والمدفوعات">
            <p>
              تُحدد أسعار الخدمات بناءً على نوع الخدمة والموقع والوقت. الأسعار معروضة بوضوح قبل
              تأكيد الطلب.
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'يتم الدفع عبر التطبيق بوسائل الدفع المتاحة',
                'رسوم الخدمة غير قابلة للاسترداد بعد بدء تنفيذها',
                'في حالة الإلغاء قبل وصول المزود قد تطبق رسوم إلغاء',
                'يحق للمزودين تحصيل مبالغ إضافية عند الحاجة لمواد إضافية بعد موافقة العميل',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="٦. حدود المسؤولية">
            <p>
              فزّاعين غير مسؤولة عن:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'جودة الخدمة المقدمة من مزودي الخدمة المستقلين',
                'أي أضرار لاحقة أو غير مباشرة ناتجة عن استخدام التطبيق',
                'التأخير في الاستجابة الناتج عن ظروف خارجة عن السيطرة',
                'أعطال التطبيق الناتجة عن انقطاع الإنترنت أو أعطال تقنية',
                'قرارات المزود المستقل في كيفية تنفيذ الخدمة',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-red-800 text-sm">
              الحد الأقصى لمسؤوليتنا في أي نزاع لا يتجاوز قيمة الخدمة المدفوعة عبر التطبيق.
            </p>
          </Section>

          <Section title="٧. سلوك المستخدم المحظور">
            <ul className="list-none space-y-2">
              {[
                'انتحال شخصية شخص آخر أو تقديم بيانات مزورة',
                'محاولة اختراق أو التلاعب بالتطبيق أو قاعدة البيانات',
                'إرسال طلبات وهمية أو إساءة استخدام نظام الطلبات',
                'إساءة التعامل مع المزودين أو العملاء',
                'نشر محتوى مسيء أو مضلل في المراجعات',
                'استخدام التطبيق لأغراض تجارية غير مرخصة',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              نحتفظ بحق تعليق أو إلغاء أي حساب يخالف هذه الشروط دون إشعار مسبق.
            </p>
          </Section>

          <Section title="٨. الملكية الفكرية">
            <p>
              جميع حقوق الملكية الفكرية المتعلقة بالتطبيق، بما في ذلك الاسم التجاري "فزّاعين"،
              الشعار، التصميم، الكود البرمجي، ومحتوى التطبيق مملوكة حصرياً لشركة فزّاعين.
            </p>
            <p>
              يُمنع نسخ أو توزيع أو إعادة نشر أي محتوى من التطبيق دون إذن خطي مسبق.
            </p>
          </Section>

          <Section title="٩. التعديلات على الشروط">
            <p>
              نحتفظ بحق تعديل هذه الشروط في أي وقت. سنخطرك بالتغييرات الجوهرية عبر التطبيق أو
              البريد الإلكتروني. استمرارك في استخدام التطبيق بعد التعديل يعني موافقتك على الشروط الجديدة.
            </p>
          </Section>

          <Section title="١٠. تعليق الخدمة وإنهاء الحساب">
            <p>يحق لنا تعليق الخدمة أو إنهاء حسابك في الحالات التالية:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'مخالفة أي من شروط الاستخدام',
                'الاشتباه في نشاط احتيالي',
                'عدم الدفع أو وجود مديونية',
                'بناءً على طلب قانوني',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="١١. القانون المطبق">
            <p>
              تخضع هذه الشروط وتفسر وفقاً لقوانين المملكة العربية السعودية. أي نزاع ناشئ عن هذه
              الشروط يخضع للاختصاص القضائي للمحاكم السعودية المختصة.
            </p>
          </Section>

          <Section title="١٢. التواصل معنا">
            <p>للاستفسار عن هذه الشروط أو تقديم شكوى:</p>
            <div className="mt-3 space-y-1.5">
              <p>📧 البريد الإلكتروني: <a href="mailto:support@fzaeen.com" className="text-orange-500 font-medium hover:underline">support@fzaeen.com</a></p>
              <p>🌐 الموقع الإلكتروني: <span className="text-orange-500 font-medium">fzaeen.com</span></p>
            </div>
          </Section>

          <div className="border-t border-gray-100 pt-6 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-xs">© {new Date().getFullYear()} فزّاعين – جميع الحقوق محفوظة</p>
            <div className="flex gap-4">
              <Link to="/" className="text-orange-500 text-sm font-medium hover:underline">الرئيسية</Link>
              <Link to="/privacy" className="text-orange-500 text-sm font-medium hover:underline">سياسة الخصوصية</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
