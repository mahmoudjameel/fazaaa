import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Hash } from 'lucide-react';
import { getPublishedArticles } from '../services/articlesService';

function formatDate(value) {
  try {
    const d =
      value?.toDate?.() ||
      (value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null);
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * قسم مقالات SEO على اللاندينغ — يقرأ من Firestore (منشور + showOnLanding)
 */
export function LandingArticlesSection({ primaryColor = '#0d9488' }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getPublishedArticles({ max: 6, landingOnly: true });
        if (!cancelled) setArticles(list);
      } catch (e) {
        console.warn('LandingArticlesSection:', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || articles.length === 0) return null;

  return (
    <section id="articles" className="py-16 sm:py-20 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div className="text-right">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              <FileText className="w-3.5 h-3.5" />
              مقالات ونصائح
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900">
              من مدونة فزاعين
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl text-sm sm:text-base">
              مواضيع مساعدة الطريق والكلمات المفتاحية المهمة لخدمات السيارات في السعودية
            </p>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 font-bold text-sm hover:opacity-80"
            style={{ color: primaryColor }}
          >
            كل المقالات
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a) => (
            <Link
              key={a.id}
              to={`/blog/${a.slug}`}
              className="group rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 hover:bg-white hover:shadow-md transition-all"
            >
              {a.coverImage ? (
                <img src={a.coverImage} alt={a.title} className="w-full h-40 object-cover" loading="lazy" />
              ) : (
                <div
                  className="w-full h-40 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}18, ${primaryColor}08)` }}
                >
                  <FileText className="w-8 h-8 opacity-40" style={{ color: primaryColor }} />
                </div>
              )}
              <div className="p-4">
                <div className="text-[11px] text-gray-400 mb-1.5">{formatDate(a.publishedAt || a.createdAt)}</div>
                <h3 className="font-black text-gray-900 group-hover:opacity-90 line-clamp-2 mb-2">{a.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{a.excerpt || a.content?.slice(0, 100)}</p>
                {(a.hashtags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.hashtags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-100 text-gray-600"
                      >
                        <Hash className="w-2.5 h-2.5" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
