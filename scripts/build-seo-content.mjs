/**
 * يولّد صفحات المقالات والهاشتاقات كـ HTML ثابت، ويحدّث خريطة الموقع.
 * التشغيل: node scripts/build-seo-content.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_PAGES, servicePath } from '../src/seo/servicePages.js';
import { SEO_ARTICLES, SEO_HASHTAGS, articlesForHashtag } from '../src/seo/seoContent.js';
import { SEARCH_PHRASES } from '../src/seo/searchPhrases.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://fzaeen.com';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const style = `
  body { margin: 0; font-family: Cairo, sans-serif; background: #f8fafc; color: #111827; }
  a { color: #0f766e; }
  header, main, footer { max-width: 760px; margin: 0 auto; padding: 0 20px; }
  header { padding-top: 28px; }
  .brand { font-weight: 900; color: #0f766e; text-decoration: none; font-size: 22px; }
  h1 { font-size: 32px; line-height: 1.4; margin: 18px 0 10px; }
  h2 { font-size: 20px; margin: 28px 0 10px; }
  p { line-height: 1.9; color: #374151; }
  .cta { display: inline-block; background: #0f766e; color: #fff; text-decoration: none; font-weight: 800; padding: 12px 18px; border-radius: 12px; }
  .links { display: flex; flex-wrap: wrap; gap: 8px; }
  .links a, .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; text-decoration: none; }
  .links a { border-radius: 999px; padding: 6px 12px; font-size: 14px; font-weight: 700; }
  .card { display: block; padding: 14px 16px; margin-top: 10px; color: inherit; }
  .card strong { display: block; margin-bottom: 4px; }
  .card span { color: #4b5563; font-size: 14px; line-height: 1.7; }
  footer { padding: 28px 20px 48px; color: #6b7280; font-size: 14px; }
`;

function shell({ title, description, canonical, jsonLd, body }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="geo.region" content="SA" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="ar_SA" />
  <meta property="og:site_name" content="فزاعين" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${site}/landing-hero.jpg" />
  <link rel="icon" href="/favicon.ico" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${style}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function articleHtml(article) {
  const url = `${site}/blog/${article.slug}`;
  const paragraphs = article.content.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const tags = article.hashtags
    .map((tag) => {
      const hashtag = SEO_HASHTAGS.find((item) => item.tag === tag);
      const href = hashtag ? `/tags/${hashtag.slug}` : '/blog';
      const label = hashtag?.label || tag;
      return `<a href="${href}">${esc(label)}</a>`;
    })
    .join('');
  const service = SERVICE_PAGES.find((page) => page.slug === article.serviceSlug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seoDescription,
    inLanguage: 'ar-SA',
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'فزاعين', url: site },
    publisher: { '@type': 'Organization', name: 'فزاعين', url: site },
  };
  const body = `
  <header>
    <a class="brand" href="/">فزاعين</a>
    <h1>${esc(article.title)}</h1>
    <p>${esc(article.excerpt)}</p>
    <div class="links">${tags}</div>
  </header>
  <main>
    ${paragraphs.map((text) => `<p>${esc(text)}</p>`).join('\n    ')}
    ${service ? `<p><a href="${servicePath(service.slug)}">صفحة الخدمة: ${esc(service.title)}</a></p>` : ''}
    <a class="cta" href="/app">اطلب الخدمة من التطبيق</a>
  </main>
  <footer><a href="/blog">كل المقالات</a> · <a href="/services">الخدمات</a></footer>`;
  return shell({
    title: article.seoTitle,
    description: article.seoDescription,
    canonical: url,
    jsonLd,
    body,
  });
}

function tagHtml(hashtag) {
  const url = `${site}/tags/${hashtag.slug}`;
  const posts = articlesForHashtag(hashtag.tag);
  const service = SERVICE_PAGES.find((page) => page.slug === hashtag.slug);
  const cards = posts
    .map(
      (article) =>
        `<a class="card" href="/blog/${article.slug}"><strong>${esc(article.title)}</strong><span>${esc(article.excerpt)}</span></a>`
    )
    .join('\n    ');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hashtag.label,
    description: hashtag.seoDescription,
    url,
    inLanguage: 'ar-SA',
  };
  const body = `
  <header>
    <a class="brand" href="/">فزاعين</a>
    <h1>${esc(hashtag.label)}</h1>
    <p>${esc(hashtag.intro)}</p>
    ${service ? `<p><a href="${servicePath(service.slug)}">${esc(service.title)}</a></p>` : ''}
  </header>
  <main>
    <h2>مقالات</h2>
    ${cards || '<p>لا توجد مقالات بعد.</p>'}
    <h2>عبارات البحث</h2>
    <ul>
      ${(SEARCH_PHRASES[hashtag.slug] || []).map((phrase) => `<li>${esc(phrase)}</li>`).join('\n      ')}
    </ul>
    <p style="margin-top:24px"><a class="cta" href="/app">اطلب الخدمة من التطبيق</a></p>
  </main>
  <footer><a href="/blog">كل المقالات</a> · <a href="/services">الخدمات</a></footer>`;
  return shell({
    title: hashtag.seoTitle,
    description: hashtag.seoDescription,
    canonical: url,
    jsonLd,
    body,
  });
}

function blogIndexHtml() {
  const url = `${site}/blog`;
  const cards = SEO_ARTICLES.map(
    (article) =>
      `<a class="card" href="/blog/${article.slug}"><strong>${esc(article.title)}</strong><span>${esc(article.excerpt)}</span></a>`
  ).join('\n    ');
  const tags = SEO_HASHTAGS.map(
    (hashtag) => `<a href="/tags/${hashtag.slug}">${esc(hashtag.label)}</a>`
  ).join('');
  const body = `
  <header>
    <a class="brand" href="/">فزاعين</a>
    <h1>مقالات مساعدة الطريق</h1>
    <p>نصائح عن اشتراك البطارية، بنشر الكفرات، وفتح السيارة في السعودية.</p>
    <div class="links">${tags}</div>
  </header>
  <main>${cards}</main>
  <footer><a href="/services">خدمات فزاعين</a></footer>`;
  return shell({
    title: 'مقالات ونصائح مساعدة الطريق | فزاعين',
    description: 'مقالات فزاعين عن اشتراك البطارية، تبديل البطارية، بنشر الكفرات، نفخ الكفر، رقعة الكفر، وفتح السيارة في السعودية.',
    canonical: url,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'مقالات فزاعين',
      url,
      inLanguage: 'ar-SA',
    },
    body,
  });
}

function sitemap() {
  const urls = [
    ['/', 'weekly', '1.0'],
    ['/services', 'weekly', '0.9'],
    ...SERVICE_PAGES.map((page) => [servicePath(page.slug), 'monthly', '0.8']),
    ['/blog', 'weekly', '0.9'],
    ...SEO_ARTICLES.map((article) => [`/blog/${article.slug}`, 'monthly', '0.7']),
    ...SEO_HASHTAGS.map((hashtag) => [`/tags/${hashtag.slug}`, 'monthly', '0.6']),
    ['/support', 'monthly', '0.5'],
    ['/privacy', 'yearly', '0.3'],
    ['/terms', 'yearly', '0.3'],
    ['/app', 'monthly', '0.6'],
  ];
  const body = urls
    .map(
      ([path, freq, priority]) => `  <url>
    <loc>${site}${path}</loc>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

const blogDir = join(root, 'public', 'blog');
mkdirSync(blogDir, { recursive: true });
writeFileSync(join(blogDir, 'index.html'), blogIndexHtml());
for (const article of SEO_ARTICLES) {
  const dir = join(blogDir, article.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), articleHtml(article));
}

const tagsDir = join(root, 'public', 'tags');
mkdirSync(tagsDir, { recursive: true });
for (const hashtag of SEO_HASHTAGS) {
  const dir = join(tagsDir, hashtag.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), tagHtml(hashtag));
}

writeFileSync(join(root, 'public', 'sitemap.xml'), sitemap());
console.log(`articles: ${SEO_ARTICLES.length}, hashtags: ${SEO_HASHTAGS.length}`);
