/**
 * يولّد HTML ثابت لصفحات الخدمات حتى يفهرسها قوقل بدون تشغيل جافاسكربت.
 * التشغيل: node scripts/build-service-pages.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_PAGES, servicePath } from '../src/seo/servicePages.js';
import { articlesForService } from '../src/seo/seoContent.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://fzaeen.com';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageHtml(page) {
  const url = `${site}${servicePath(page.slug)}`;
  const keywords = page.keywords.join('، ');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: page.title,
        serviceType: page.title,
        description: page.description,
        url,
        areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
        provider: { '@type': 'Organization', name: 'فزاعين', url: site },
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faqs.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'فزاعين', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'الخدمات', item: `${site}/services` },
          { '@type': 'ListItem', position: 3, name: page.title, item: url },
        ],
      },
    ],
  };

  const others = SERVICE_PAGES.filter((item) => item.slug !== page.slug)
    .map(
      (item) =>
        `<a href="${servicePath(item.slug)}">${esc(item.title)}</a>`
    )
    .join('');
  const reads = articlesForService(page.slug)
    .map((article) => `<a href="/blog/${article.slug}">${esc(article.title)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(page.seoTitle)}</title>
  <meta name="description" content="${esc(page.description)}" />
  <meta name="keywords" content="${esc(page.keywords.join(', '))}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="geo.region" content="SA" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="ar_SA" />
  <meta property="og:site_name" content="فزاعين" />
  <meta property="og:title" content="${esc(page.seoTitle)}" />
  <meta property="og:description" content="${esc(page.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${site}/landing-hero.jpg" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    body { margin: 0; font-family: Cairo, sans-serif; background: #f8fafc; color: #111827; }
    a { color: #0f766e; }
    header, main, footer { max-width: 760px; margin: 0 auto; padding: 0 20px; }
    header { padding-top: 28px; }
    .brand { font-weight: 900; color: #0f766e; text-decoration: none; font-size: 22px; }
    h1 { font-size: 32px; line-height: 1.35; margin: 18px 0 10px; }
    h2 { font-size: 20px; margin: 28px 0 10px; }
    p, li { line-height: 1.9; color: #374151; }
    .cta { display: inline-block; background: #0f766e; color: #fff; text-decoration: none; font-weight: 800; padding: 12px 18px; border-radius: 12px; margin-top: 8px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px 20px; margin-top: 16px; }
    .links { display: flex; flex-wrap: wrap; gap: 8px; }
    .links a { background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 12px; text-decoration: none; font-size: 14px; font-weight: 700; }
    footer { padding: 28px 20px 48px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="/">فزاعين</a>
    <h1>${esc(page.title)}</h1>
    <p>${esc(page.description)}</p>
    <a class="cta" href="/app">اطلب الخدمة من التطبيق</a>
  </header>
  <main>
    ${page.paragraphs.map((text) => `<p>${esc(text)}</p>`).join('\n    ')}
    <h2>كيف تطلب الخدمة</h2>
    <ol>
      ${page.steps.map((step) => `<li>${esc(step)}</li>`).join('\n      ')}
    </ol>
    <div class="card">
      <h2>كلمات يبحث عنها الناس</h2>
      <p>${esc(keywords)}</p>
    </div>
    <h2>أسئلة شائعة</h2>
    ${page.faqs
      .map(
        (item) => `<div class="card"><h2>${esc(item.q)}</h2><p>${esc(item.a)}</p></div>`
      )
      .join('\n    ')}
    ${reads ? `<h2>اقرأ أيضاً</h2>\n    <div class="links">${reads}</div>` : ''}
    <h2>خدمات ثانية</h2>
    <div class="links">${others}</div>
  </main>
  <footer>
    <a href="/services">كل خدمات المساعدة على الطريق</a>
    · <a href="/">الرئيسية</a>
    · فزاعين في السعودية
  </footer>
</body>
</html>
`;
}

function indexHtml() {
  const cards = SERVICE_PAGES.map(
    (page) => `<a class="card" href="${servicePath(page.slug)}"><strong>${esc(page.title)}</strong><span>${esc(page.description)}</span></a>`
  ).join('\n    ');
  const url = `${site}/services`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>خدمات فزاعين: اشتراك بطارية وبنشر كفرات وفتح سيارة | السعودية</title>
  <meta name="description" content="صفحات خدمات فزاعين في السعودية: اشتراك بطارية، تبديل بطارية، بنشر كفرات، نفخ كفر، رقعة كفر، وفتح سيارة مقفلة." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <link rel="icon" href="/favicon.ico" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; font-family: Cairo, sans-serif; background: #f8fafc; color: #111827; }
    main { max-width: 860px; margin: 0 auto; padding: 32px 20px 64px; }
    a.brand { color: #0f766e; font-weight: 800; text-decoration: none; font-size: 22px; }
    h1 { font-size: 32px; line-height: 1.35; }
    .grid { display: grid; gap: 12px; }
    .card { display: block; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px 18px; text-decoration: none; color: inherit; }
    .card strong { display: block; margin-bottom: 6px; }
    .card span { color: #4b5563; line-height: 1.7; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <a class="brand" href="/">فزاعين</a>
    <h1>خدمات المساعدة على الطريق في السعودية</h1>
    <p>إذا تبحث عن اشتراك بطارية أو بنشر كفرات أو فتح سيارة، هذي صفحات الخدمة. الطلب نفسه يتم من تطبيق فزاعين.</p>
    <div class="grid">
    ${cards}
    </div>
  </main>
</body>
</html>
`;
}

const servicesDir = join(root, 'public', 'services');
mkdirSync(servicesDir, { recursive: true });
writeFileSync(join(servicesDir, 'index.html'), indexHtml());
for (const page of SERVICE_PAGES) {
  const dir = join(servicesDir, page.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), pageHtml(page));
}
console.log(`service pages: ${SERVICE_PAGES.length}`);
