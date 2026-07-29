import { useEffect } from 'react';
import { absoluteUrl, DEFAULT_OG_IMAGE, LOCALE, SITE_NAME } from '../seo/config';

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value != null) el.setAttribute(key, value);
  });
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id, data) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.text = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * يحدّث عنوان الصفحة والميتا وJSON-LD لكل صفحة عامة.
 */
export function SeoHead({
  title,
  description,
  keywords,
  path = '/',
  type = 'website',
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  jsonLd,
}) {
  useEffect(() => {
    const fullTitle = title || SITE_NAME;
    const url = absoluteUrl(path);
    const robots = noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

    document.title = fullTitle;
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';

    upsertMeta('meta[name="description"]', { name: 'description', content: description || '' });
    if (keywords) {
      upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    }
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="googlebot"]', { name: 'googlebot', content: robots });
    upsertMeta('meta[name="author"]', { name: 'author', content: SITE_NAME });
    upsertMeta('meta[name="geo.region"]', { name: 'geo.region', content: 'SA' });
    upsertMeta('meta[name="geo.placename"]', { name: 'geo.placename', content: 'Saudi Arabia' });
    upsertMeta('meta[name="language"]', { name: 'language', content: 'Arabic' });

    upsertLink('canonical', url);

    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: LOCALE });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description || '' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[property="og:image:alt"]', {
      property: 'og:image:alt',
      content: `${SITE_NAME} — مساعدة الطريق في السعودية`,
    });

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description || '' });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });

    if (Array.isArray(jsonLd)) {
      jsonLd.forEach((item, idx) => setJsonLd(`fzaeen-jsonld-${idx}`, item));
    } else {
      setJsonLd('fzaeen-jsonld-0', jsonLd || null);
      // تنظيف أي سكربتات قديمة إضافية
      for (let i = 1; i < 12; i += 1) {
        const old = document.getElementById(`fzaeen-jsonld-${i}`);
        if (old) old.remove();
      }
    }

    return () => {
      // عند المغادرة لصفحة أخرى، المكوّن التالي يعيد الكتابة
    };
  }, [title, description, keywords, path, type, image, noindex, JSON.stringify(jsonLd)]);

  return null;
}
