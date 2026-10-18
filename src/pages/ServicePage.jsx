import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SeoHead } from '../components/SeoHead';
import { getSeoPageBySlug } from '../services/articlesService';
import { SERVICE_PAGES, servicePath } from '../seo/servicePages';
import { SITE_NAME } from '../seo/config';

/**
 * صفحة خدمة يضيفها الأدمن. الصفحات الأساسية الست ملفات HTML ثابتة
 * ويخدمها السيرفر قبل ما يوصل الطلب لهذي الصفحة.
 */
export function ServicePage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSeoPageBySlug(slug)
      .then((found) => {
        if (!cancelled) setPage(found);
      })
      .catch(() => {
        if (!cancelled) setPage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-gray-500">جاري التحميل...</div>;
  }

  if (!page) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center" dir="rtl">
        <div>
          <h1 className="text-2xl font-black mb-3">الصفحة غير موجودة</h1>
          <Link to="/services" className="text-teal-700 font-bold">كل الخدمات</Link>
        </div>
      </div>
    );
  }

  const title = page.seoTitle || `${page.label || page.tag} | ${SITE_NAME}`;
  const description = page.seoDescription || page.intro || page.body.slice(0, 160);
  const paragraphs = [page.intro, ...String(page.body || '').split(/\n+/)].map((t) => t.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl" style={{ fontFamily: "'Cairo', system-ui, sans-serif" }}>
      <SeoHead
        title={title}
        description={description}
        keywords={(page.keywords || []).join(', ')}
        path={servicePath(page.slug)}
        type="article"
      />
      <main className="max-w-3xl mx-auto px-5 py-10">
        <Link to="/" className="text-teal-700 font-black text-xl">فزاعين</Link>
        <h1 className="text-3xl font-black text-gray-900 mt-4 mb-3">{page.label || page.tag}</h1>
        {paragraphs.map((text) => (
          <p key={text.slice(0, 24)} className="text-gray-700 leading-8 mb-4">{text}</p>
        ))}
        <Link to="/app" className="inline-block mt-2 bg-teal-700 text-white font-bold rounded-xl px-4 py-3">
          اطلب الخدمة من التطبيق
        </Link>
        <div className="flex flex-wrap gap-2 mt-8">
          {SERVICE_PAGES.map((item) => (
            <a key={item.slug} href={servicePath(item.slug)} className="text-sm font-bold border border-gray-200 rounded-full px-3 py-1.5 bg-white">
              {item.title}
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
