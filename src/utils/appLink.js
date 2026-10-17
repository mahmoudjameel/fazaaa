export const APP_LINK_PATH = '/app';
export const OFFICIAL_ORIGIN = 'https://fzaeen.com';

/** روابط تطبيق العميل كما في اللاندنق، إذا الإعدادات فاضية أو عامة */
export const DEFAULT_APP_STORES = {
  appStoreUrl: 'https://apps.apple.com/sa/app/fzaeen-%D9%81%D8%B2%D8%A7%D8%B9%D9%8A%D9%86/id6748981486',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.londonerazooz.app',
};

export const DEFAULT_APP_LINK_COPY = {
  eyebrow: 'التطبيق',
  title: 'أقرب مساعدة لسيارتك',
  redirectText: 'جاري فتح المتجر',
  desktopText: 'امسح الكود',
  linkTitle: 'رابط واحد للتطبيق',
  linkText: 'شاركه أو اطبعه، ويفتح متجر الجوال اللي يمسحه',
};

export function appLinkUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : OFFICIAL_ORIGIN;
  return `${origin}${APP_LINK_PATH}`;
}

/** للطباعة والمشاركة خارج الموقع */
export function officialAppLinkUrl() {
  return `${OFFICIAL_ORIGIN}${APP_LINK_PATH}`;
}

export function appLinkLabel(url = officialAppLinkUrl()) {
  return String(url).replace(/^https?:\/\/(www\.)?/i, '');
}

/** 'android' | 'ios' | 'desktop' */
export function detectPlatform(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function usableStoreUrl(value, fallback) {
  const url = String(value || '').trim();
  if (
    !url
    || url === 'https://apps.apple.com'
    || url === 'https://apps.apple.com/'
    || url === 'https://play.google.com'
    || url === 'https://play.google.com/'
  ) {
    return fallback;
  }
  return url;
}

/** روابط متاجر تطبيق العميل من settings/landingContent.apps */
export function customerStoreUrls(apps = {}) {
  return {
    appStoreUrl: usableStoreUrl(apps.appleHref, DEFAULT_APP_STORES.appStoreUrl),
    playStoreUrl: usableStoreUrl(apps.googleHref, DEFAULT_APP_STORES.playStoreUrl),
  };
}

export function appLinkCopy(raw = {}) {
  const copy = { ...DEFAULT_APP_LINK_COPY };
  Object.keys(DEFAULT_APP_LINK_COPY).forEach((key) => {
    const value = String(raw?.[key] || '').trim();
    if (value) copy[key] = value;
  });
  return copy;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

/** QR كـ SVG. يشاور على /app نفسه، مو على متجر معيّن. */
export async function appLinkQrSvg(color = '#1C1917') {
  const QR = (await import('qrcode')).default;
  return QR.toString(appLinkUrl(), {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: color, light: '#0000' },
  });
}
