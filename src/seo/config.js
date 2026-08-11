/** إعدادات SEO لموقع فزاعين — موجّه للبحث في السعودية */

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://fzaeen.com').replace(/\/$/, '');
export const SITE_NAME = 'فزاعين';
export const SITE_NAME_EN = 'Fzaeen';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/landing-hero.jpg`;
export const LOGO_URL = `${SITE_URL}/favicon-192x192.png`;
export const FAVICON_URL = `${SITE_URL}/favicon-48x48.png`;
export const CONTACT_EMAIL = 'fzaeen@fzaeen.com';
export const LOCALE = 'ar_SA';

/** كلمات مفتاحية أساسية للخدمات في السعودية */
export const PRIMARY_KEYWORDS = [
  'فزاعين',
  'مساعدة الطريق',
  'المساعدة على الطريق',
  'بنشر متنقل',
  'بنشر إطارات',
  'تبديل إطار',
  'نفخ كفر',
  'شحن بطارية',
  'اشتراك بطارية',
  'تبديل بطارية',
  'فتح سيارة',
  'فتح سيارات مقفلة',
  'خدمة طريق السعودية',
  'كراج متنقل',
  'طوارئ سيارات',
];

export const SAUDI_CITIES = [
  'الرياض',
  'جدة',
  'مكة المكرمة',
  'المدينة المنورة',
  'الدمام',
  'الخبر',
  'الظهران',
  'الأحساء',
  'الطائف',
  'أبها',
  'خميس مشيط',
  'تبوك',
  'بريدة',
  'عنيزة',
  'حائل',
  'جازان',
  'نجران',
  'ينبع',
  'الجبيل',
  'القطيف',
];

export const SERVICES_SEO = [
  {
    id: 'tires',
    name: 'بنشر الإطارات المتنقل',
    shortName: 'بنشر متنقل',
    description:
      'خدمة بنشر متنقل في السعودية: نفخ كفر، تغيير الاحتياطي، رقعة كفر خارجية، وتغيير الكفر عند البنشر — نصلك في موقعك عبر تطبيق فزاعين.',
    keywords: ['بنشر متنقل', 'بنشر إطارات', 'تغيير كفر', 'رقعة كفر', 'نفخ إطارات'],
  },
  {
    id: 'battery',
    name: 'خدمات البطارية المتنقلة',
    shortName: 'بطارية متنقلة',
    description:
      'اشتراك بطارية وتبديل بطارية في موقعك داخل المملكة. مزودو فزاعين يصلونك بسرعة عند نفاد البطارية أو تعطل التشغيل.',
    keywords: ['اشتراك بطارية', 'تبديل بطارية', 'شحن بطارية سيارة', 'بطارية فارغة'],
  },
  {
    id: 'lockout',
    name: 'فتح السيارة المقفلة',
    shortName: 'فتح سيارة',
    description:
      'نسيت المفتاح داخل السيارة؟ خدمة فتح سيارات مقفلة بأدوات احترافية وبدون ضرر قدر الإمكان عبر شبكة مزودي فزاعين في أنحاء السعودية.',
    keywords: ['فتح سيارة', 'فتح سيارات مقفلة', 'مفتاح داخل السيارة', 'فتح قفل سيارة'],
  },
];

export const FAQ_SEO = [
  {
    q: 'ما هي خدمات فزاعين للمساعدة على الطريق؟',
    a: 'فزاعين منصة تقنية في السعودية تربطك بأقرب مزود خدمة معتمد لخدمات بنشر الإطارات، اشتراك وتبديل البطارية، وفتح السيارة المقفلة — مع تتبع مباشر من التطبيق.',
  },
  {
    q: 'هل خدمة بنشر متنقل متوفرة في مدن السعودية؟',
    a: 'نعم، فزاعين يعمل عبر شبكة مزودين في أنحاء المملكة العربية السعودية، بما في ذلك الرياض وجدة والدمام ومكة والمدينة ومدن أخرى حسب توفر المزودين المتصلين.',
  },
  {
    q: 'كيف أطلب مساعدة طريق من فزاعين؟',
    a: 'حمّل تطبيق فزاعين للعملاء من App Store أو Google Play، سجّل برقم جوالك، اختر الخدمة (بنشر، بطارية، أو فتح سيارة)، وأرسل الطلب. أقرب مزود متاح يتواصل معك وتتابعه على الخريطة.',
  },
  {
    q: 'هل الأسعار واضحة قبل تأكيد الطلب؟',
    a: 'نعم. في فزاعين تعرف السعر قبل تأكيد الطلب — بدون رسوم مخفية، مع شفافية كاملة لتجربة آمنة في حالات الطوارئ على الطريق.',
  },
  {
    q: 'كيف أنضم كمزود خدمة مع فزاعين؟',
    a: 'حمّل تطبيق فزاعين مزود الخدمة، أكمل التسجيل وارفع المستندات المطلوبة. بعد موافقة الإدارة يمكنك استقبال طلبات المساعدة على الطريق في منطقتك.',
  },
];

const keywordsJoin = (...lists) =>
  [...new Set(lists.flat().filter(Boolean))].join(', ');

export const PAGE_SEO = {
  home: {
    title: 'فزاعين | مساعدة الطريق وبنشر متنقل وبطارية وفتح سيارة في السعودية',
    description:
      'فزاعين منصة مساعدة الطريق في السعودية: بنشر متنقل، اشتراك وتبديل بطارية، وفتح سيارات مقفلة. اطلب من التطبيق ووصلك أقرب مزود معتمد مع تتبع مباشر.',
    keywords: keywordsJoin(
      PRIMARY_KEYWORDS,
      SAUDI_CITIES.map((c) => `بنشر متنقل ${c}`),
      SAUDI_CITIES.slice(0, 8).map((c) => `مساعدة الطريق ${c}`),
      ['تطبيق مساعدة طريق', 'فزاعين السعودية', 'طوارئ سيارات السعودية']
    ),
    path: '/',
    type: 'website',
  },
  support: {
    title: 'الدعم والمساعدة | فزاعين',
    description:
      'تواصل مع دعم فزاعين عبر واتساب أو البريد، واطّلع على الأسئلة الشائعة حول بنشر الإطارات وخدمات البطارية وفتح السيارة في السعودية.',
    keywords: keywordsJoin(PRIMARY_KEYWORDS, ['دعم فزاعين', 'تواصل فزاعين', 'واتساب فزاعين']),
    path: '/support',
    type: 'website',
  },
  blog: {
    title: 'مقالات ونصائح مساعدة الطريق | فزاعين',
    description:
      'مدونة فزاعين: مقالات عن بنشر متنقل، بطارية السيارة، فتح السيارات المقفلة، والمساعدة على الطريق في السعودية — حسب الكلمات المفتاحية والهاشتاقات.',
    keywords: keywordsJoin(PRIMARY_KEYWORDS, ['مقالات فزاعين', 'نصائح مساعدة الطريق', 'مدونة فزاعين']),
    path: '/blog',
    type: 'website',
  },
  privacy: {
    title: 'سياسة الخصوصية | فزاعين',
    description: 'تعرّف على كيفية جمع واستخدام وحماية بياناتك في منصة وتطبيقات فزاعين للمساعدة على الطريق في السعودية.',
    keywords: 'سياسة الخصوصية, فزاعين, حماية البيانات',
    path: '/privacy',
    type: 'article',
  },
  terms: {
    title: 'الشروط والأحكام | فزاعين',
    description: 'الشروط والأحكام لاستخدام منصة وتطبيقات فزاعين كوسيط تقني لخدمات المساعدة على الطريق في المملكة العربية السعودية.',
    keywords: 'الشروط والأحكام, فزاعين, استخدام التطبيق',
    path: '/terms',
    type: 'article',
  },
  deleteAccount: {
    title: 'طلب حذف الحساب | فزاعين',
    description: 'قدّم طلب حذف حساب عميل أو مزود خدمة في فزاعين بعد التحقق برقم الجوال وفق سياسة الخصوصية.',
    keywords: 'حذف حساب, فزاعين, حذف بيانات',
    path: '/delete-account',
    type: 'website',
  },
  login: {
    title: 'تسجيل الدخول | لوحة تحكم فزاعين',
    description: 'دخول لوحة تحكم إدارة فزاعين.',
    keywords: 'لوحة تحكم فزاعين',
    path: '/login',
    type: 'website',
    noindex: true,
  },
};

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: [SITE_NAME_EN, 'فزّاعين', 'Fzaeen Saudi'],
    url: SITE_URL,
    logo: LOGO_URL,
    email: CONTACT_EMAIL,
    areaServed: {
      '@type': 'Country',
      name: 'Saudi Arabia',
    },
    sameAs: [
      'https://apps.apple.com/sa/app/fzaeen-%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86/id6748981486',
      'https://play.google.com/store/apps/details?id=com.londonerazooz.app',
      'https://apps.apple.com/sa/app/%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86-%D8%A7%D9%84%D9%85%D8%B2%D9%88%D8%AF-fzaeen-provider/id6761298718',
      'https://play.google.com/store/apps/details?id=com.fazaa.provider',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: CONTACT_EMAIL,
        availableLanguage: ['Arabic', 'ar'],
        areaServed: 'SA',
      },
    ],
  };
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    inLanguage: 'ar-SA',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: LOGO_URL,
    },
  };
}

export function buildServicesJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'خدمات المساعدة على الطريق — فزاعين',
    itemListElement: SERVICES_SEO.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.name,
        description: service.description,
        provider: {
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
        },
        areaServed: {
          '@type': 'Country',
          name: 'Saudi Arabia',
        },
        serviceType: service.shortName,
      },
    })),
  };
}

export function buildFaqJsonLd(faqItems = FAQ_SEO) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

export function buildMobileApplicationJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'فزاعين — العملاء',
      alternateName: 'Fzaeen',
      operatingSystem: 'iOS, Android',
      applicationCategory: 'LifestyleApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'SAR',
      },
      description:
        'تطبيق فزاعين للعملاء لطلب بنشر متنقل وخدمات البطارية وفتح السيارة مع تتبع المزود على الخريطة في السعودية.',
      url: absoluteUrl('/'),
      downloadUrl: [
        'https://apps.apple.com/sa/app/fzaeen-%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86/id6748981486',
        'https://play.google.com/store/apps/details?id=com.londonerazooz.app',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'فزاعين مزود الخدمة',
      alternateName: 'Fzaeen Provider',
      operatingSystem: 'iOS, Android',
      applicationCategory: 'BusinessApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'SAR',
      },
      description:
        'تطبيق فزاعين لمزودي الخدمة لاستقبال طلبات المساعدة على الطريق في المملكة العربية السعودية.',
      downloadUrl: [
        'https://apps.apple.com/sa/app/%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86-%D8%A7%D9%84%D9%85%D8%B2%D9%88%D8%AF-fzaeen-provider/id6761298718',
        'https://play.google.com/store/apps/details?id=com.fazaa.provider',
      ],
    },
  ];
}

export function buildHomeJsonLd() {
  return [
    buildOrganizationJsonLd(),
    buildWebSiteJsonLd(),
    buildServicesJsonLd(),
    buildFaqJsonLd(),
    ...buildMobileApplicationJsonLd(),
  ];
}
