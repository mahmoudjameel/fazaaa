import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Hash } from 'lucide-react';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { SeoHead } from '../components/SeoHead';
import { SITE_NAME, absoluteUrl, DEFAULT_OG_IMAGE } from '../seo/config';
import { getArticleBySlug, getPublishedArticles } from '../services/articlesService';
import { useMarketingPageView } from '../hooks/useMarketingPageView';

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

function renderParagraphs(content) {
  return String(content || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const ArticleDetail = () => {
  const { slug } = useParams();
  useMarketingPageView(slug ? `/blog/${slug}` : '/blog', 'مقال | فزاعين');
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const a = await getArticleBySlug(slug);
        if (cancelled) return;
        if (!a || a.published === false) {
          setNotFound(true);
          setArticle(null);
          return;
        }
        setArticle(a);
        const all = await getPublishedArticles({ max: 12 });
        if (cancelled) return;
        const sameTag = all.filter(
          (x) =>
            x.id !== a.id &&
            (x.hashtags || []).some((t) => (a.hashtags || []).includes(t))
        );
        setRelated((sameTag.length ? sameTag : all.filter((x) => x.id !== a.id)).slice(0, 3));
      } catch (e) {
        console.error(e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const paragraphs = useMemo(() => renderParagraphs(article?.content), [article?.content]);

  const keywords = useMemo(() => {
    if (!article) return '';
    return [...new Set([...(article.hashtags || []), ...(article.keywords || [])])].join(', ');
  }, [article]);

  const jsonLd = useMemo(() => {
    if (!article) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt || '',
      image: article.coverImage || DEFAULT_OG_IMAGE,
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: { '@type': 'ImageObject', url: absoluteUrl('/favicon-192x192.png') },
      },
      mainEntityOfPage: absoluteUrl(`/blog/${article.slug}`),
      keywords,
    };
  }, [article, keywords]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500" dir="rtl">
        جاري التحميل...
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4" dir="rtl">
        <SeoHead title={`المقال غير موجود | ${SITE_NAME}`} description="" path={`/blog/${slug}`} noindex />
        <h1 className="text-2xl font-black text-gray-800">المقال غير موجود</h1>
        <Link to="/blog" className="text-teal-700 font-bold hover:underline">
          العودة للمقالات
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative" dir="rtl" style={{ fontFamily: "'Cairo', system-ui, sans-serif" }}>
      <SeoHead
        title={article.seoTitle || `${article.title} | ${SITE_NAME}`}
        description={article.seoDescription || article.excerpt || article.content?.slice(0, 155)}
        keywords={keywords}
        path={`/blog/${article.slug}`}
        type="article"
        image={article.coverImage || DEFAULT_OG_IMAGE}
        jsonLd={jsonLd}
      />
      <WhatsAppFloat />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-16">
        <Link to="/blog" className="inline-flex items-center gap-2 text-teal-700 hover:text-teal-800 text-sm font-bold mb-6">
          <ArrowRight className="w-4 h-4" />
          كل المقالات
        </Link>

        <div className="text-xs text-gray-400 mb-3">{formatDate(article.publishedAt || article.createdAt)}</div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-4">{article.title}</h1>

        {(article.hashtags || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {article.hashtags.map((t) => (
              <Link
                key={t}
                to={`/blog?tag=${encodeURIComponent(t)}`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-100 hover:bg-teal-100"
              >
                <Hash className="w-3 h-3" />
                {t}
              </Link>
            ))}
          </div>
        )}

        {article.coverImage && (
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full rounded-2xl object-cover max-h-[420px] mb-8 border border-gray-100"
          />
        )}

        {article.excerpt && (
          <p className="text-lg text-gray-600 font-medium leading-relaxed mb-8 border-r-4 border-teal-500 pr-4">
            {article.excerpt}
          </p>
        )}

        <div className="prose prose-lg max-w-none text-gray-800 space-y-4 leading-8">
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>

        {related.length > 0 && (
          <section className="mt-14 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-black text-gray-900 mb-4">مقالات ذات صلة</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/blog/${r.slug}`}
                  className="bg-white border border-gray-100 rounded-xl p-3 hover:border-teal-200 transition-colors"
                >
                  <div className="font-bold text-sm text-gray-900 line-clamp-2 mb-1">{r.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-2">{r.excerpt}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
};

export default ArticleDetail;
