import { useState } from 'react';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { FAQ_SEO, SAUDI_CITIES, SERVICES_SEO } from '../seo/config';

/**
 * محتوى SEO مرئي وطبيعي — يساعد ظهور فزاعين في بحث السعودية
 * (بنشر متنقل، بطارية، فتح سيارة + مدن المملكة)
 */
export function LandingSeoSection({ primaryColor = '#DC2626' }) {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <section
      id="seo-coverage"
      className="py-16 sm:py-24 bg-white"
      aria-labelledby="seo-coverage-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Search className="w-4 h-4" style={{ color: primaryColor }} />
            تغطية المملكة
          </div>
          <h2
            id="seo-coverage-heading"
            className="text-3xl sm:text-4xl font-black text-gray-900 mb-4 leading-tight"
          >
            مساعدة الطريق في السعودية — بنشر وبطارية وفتح سيارة
          </h2>
          <p className="text-gray-500 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
            فزاعين منصة تقنية تربطك بأقرب مزود خدمة معتمد لخدمات الطوارئ على الطريق داخل المملكة العربية
            السعودية. اطلب من التطبيق: بنشر متنقل، اشتراك أو تبديل بطارية، وفتح سيارة مقفلة — مع تتبع مباشر
            حتى وصول المزود.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 sm:gap-6 mb-14">
          {SERVICES_SEO.map((service) => (
            <article
              key={service.id}
              className="rounded-2xl border border-gray-100 bg-gray-50/80 p-6 hover:border-gray-200 hover:shadow-sm transition-all"
            >
              <h3 className="text-lg font-black text-gray-900 mb-3">{service.name}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{service.description}</p>
              <ul className="flex flex-wrap gap-2">
                {service.keywords.map((kw) => (
                  <li
                    key={kw}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600"
                  >
                    {kw}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mb-14">
          <div className="flex items-center gap-2 mb-5 justify-center sm:justify-start">
            <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
            <h3 className="text-xl font-black text-gray-900">مدن ومناطق نخدمها في السعودية</h3>
          </div>
          <p className="text-gray-500 text-sm mb-5 text-center sm:text-right max-w-3xl">
            تتوفر الخدمة حسب المزودين المتصلين في منطقتك. من أبرز المدن: الرياض، جدة، الدمام، مكة المكرمة،
            المدينة المنورة، وأكثر.
          </p>
          <ul className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {SAUDI_CITIES.map((city) => (
              <li
                key={city}
                className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700"
              >
                {city}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-black text-gray-900 mb-5 text-center sm:text-right">
            أسئلة شائعة عن المساعدة على الطريق
          </h3>
          <div className="space-y-3 max-w-3xl mx-auto sm:mx-0">
            {FAQ_SEO.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl border transition-all ${
                    open ? 'border-gray-300 bg-white shadow-sm' : 'border-gray-100 bg-gray-50/80'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-right font-bold text-gray-900"
                    onClick={() => setOpenFaq(open ? -1 : idx)}
                    aria-expanded={open}
                  >
                    <span className="text-sm sm:text-base">{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open ? (
                    <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-gray-600 text-sm leading-relaxed -mt-1">
                      {item.a}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
