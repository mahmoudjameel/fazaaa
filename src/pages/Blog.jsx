import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, FileText, Hash, Search } from 'lucide-react';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { SeoHead } from '../components/SeoHead';
import { PAGE_SEO, SITE_NAME } from '../seo/config';
import {
  getPublishedArticles,
  getSeoHashtags,
  normalizeHashtag,
} from '../services/articlesService';

function formatDate(value) {
  try {
    const d =
      value?.toDate?.() ||
      (value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null);
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

export const Blog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagParam = normalizeHashtag(searchParams.get('tag') || '');
  const [articles, setArticles] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [arts, tags] = await Promise.all([
          getPublishedArticles({ max: 100 }),
          getSeoHashtags({ activeOnly: true }),
        ]);
        if (!cancelled) {
          setArticles(arts);
          setHashtags(tags);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = articles;
    if (tagParam) {
      list = list.filter((a) => (a.hashtags || []).includes(tagParam));
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((a) => {
        const blob = [a.title, a.excerpt, ...(a.hashtags || []), ...(a.keywords || [])]
          .join(' ')
          .toLowerCase();
        return blob.includes(query);
      });
    }
    return list;
  }, [articles, tagParam, q]);

  const seo = {
    ...PAGE_SEO.blog,
    title: tagParam
      ? `مقالات #${tagParam} | ${SITE_NAME}`
      : PAGE_SEO.blog.title,
    description: tagParam
      ? `مقالات فزاعين حول #${tagParam} — نصائح ومعلومات مساعدة الطريق في السعودية.`
      : PAGE_SEO.blog.description,
    path: tagParam ? `/blog?tag=${encodeURIComponent(tagParam)}` : '/blog',
  };

  return (
    <div className="min-h-screen bg-gray-50 relative" dir="rtl" style={{ fontFamily: "'Cairo', system-ui, sans-serif" }}>
      <SeoHead {...seo} />
      <WhatsAppFloat />

      <div className="bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 text-white pt-14 pb-16 sm:pt-16 sm:pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-6">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black mb-3">مقالات فزاعين</h1>
          <p className="text-white/80 max-w-2xl text-sm sm:text-base">
            دليل ونصائح حول بنشر الإطارات، البطارية، وفتح السيارة — لتحسين تجربة المساعدة على الطريق في السعودية.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بكلمة مفتاحية..."
                className="w-full pr-10 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>
          {hashtags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  !tagParam ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                الكل
              </button>
              {hashtags.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSearchParams({ tag: h.tag })}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    tagParam === h.tag
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {h.label || h.tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
            لا توجد مقالات مطابقة حالياً.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((a) => (
              <Link
                key={a.id}
                to={`/blog/${a.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {a.coverImage ? (
                  <img src={a.coverImage} alt={a.title} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center text-teal-600">
                    <FileText className="w-10 h-10 opacity-50" />
                  </div>
                )}
                <div className="p-4">
                  <div className="text-xs text-gray-400 mb-2">{formatDate(a.publishedAt || a.createdAt)}</div>
                  <h2 className="font-black text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-2 mb-2">
                    {a.title}
                  </h2>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-3">{a.excerpt || a.content?.slice(0, 120)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(a.hashtags || []).slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-800">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
