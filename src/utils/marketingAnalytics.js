import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-229FL5SZVW';
const SESSION_KEY = 'fazaa_mkt_session';
const DEDUP_PREFIX = 'fazaa_mkt_dedup_';
const DEDUP_MS = 30 * 60 * 1000;

let gaInitialized = false;

function getOrCreateSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

function parseUtmFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    utmSource: params.get('utm_source') || null,
    utmMedium: params.get('utm_medium') || null,
    utmCampaign: params.get('utm_campaign') || null,
    utmContent: params.get('utm_content') || null,
    utmTerm: params.get('utm_term') || null,
  };
}

function persistUtm(utm) {
  try {
    const hasUtm = Object.values(utm).some(Boolean);
    if (hasUtm) {
      sessionStorage.setItem('fazaa_mkt_utm', JSON.stringify(utm));
    }
  } catch { /* ignore */ }
}

function loadPersistedUtm() {
  try {
    const raw = sessionStorage.getItem('fazaa_mkt_utm');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function shouldSkipDedup(pagePath) {
  try {
    const key = DEDUP_PREFIX + pagePath;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < DEDUP_MS) return true;
    sessionStorage.setItem(key, String(Date.now()));
    return false;
  } catch {
    return false;
  }
}

/** تهيئة Google Analytics 4 */
export function initGoogleAnalytics() {
  if (typeof window === 'undefined' || gaInitialized) return;
  if (!GA_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });

  gaInitialized = true;
}

function sendGaEvent(name, params) {
  if (!gaInitialized || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

function sendGaPageView(pagePath, pageTitle) {
  sendGaEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
}

function buildMarketingPayload(extra = {}) {
  const urlUtm = parseUtmFromUrl();
  persistUtm(urlUtm);
  const utm = { ...loadPersistedUtm(), ...urlUtm };
  const pagePath = extra.pagePath || `${window.location.pathname}${window.location.search}`;

  return {
    pagePath,
    sessionId: getOrCreateSessionId(),
    referrer: document.referrer || null,
    landingPage: sessionStorage.getItem('fazaa_mkt_landing') || pagePath,
    ...utm,
    ...extra,
  };
}

async function sendMarketingEvent(payload) {
  try {
    const record = httpsCallable(functions, 'recordMarketingPageView');
    await record(payload);
    if (!sessionStorage.getItem('fazaa_mkt_landing') && payload.pagePath) {
      sessionStorage.setItem('fazaa_mkt_landing', payload.pagePath);
    }
  } catch (e) {
    console.warn('[marketing] track failed:', e?.message || e);
  }
}

export function inferStoreFromHref(href, fallback = 'google') {
  const url = String(href || '').toLowerCase();
  if (url.includes('apps.apple.com')) return 'apple';
  if (url.includes('play.google.com')) return 'google';
  return fallback;
}

/**
 * تسجيل ضغطة تحميل تطبيق (App Store / Google Play)
 * @param {'customer'|'provider'} appRole
 * @param {'apple'|'google'} store
 * @param {string} section - موقع الزر في الصفحة
 */
export function trackDownloadClick({ appRole, store, section, href, pagePath } = {}) {
  if (typeof window === 'undefined') return;

  const resolvedStore = store || inferStoreFromHref(href);
  const resolvedRole = appRole === 'provider' ? 'provider' : 'customer';
  const resolvedSection = String(section || 'unknown').slice(0, 80);

  sendGaEvent('download_click', {
    app_role: resolvedRole,
    store: resolvedStore,
    section: resolvedSection,
    link_url: href || null,
  });

  void sendMarketingEvent(buildMarketingPayload({
    pagePath: pagePath || `${window.location.pathname}${window.location.search}`,
    pageTitle: document.title || 'فزاعين',
    eventType: 'download_click',
    downloadApp: resolvedRole,
    downloadStore: resolvedStore,
    downloadSection: resolvedSection,
    downloadHref: href ? String(href).slice(0, 500) : null,
  }));
}

/** معالج onClick لروابط التحميل */
export function onDownloadClick(props) {
  return () => trackDownloadClick(props);
}

/**
 * تسجيل زيارة صفحة عامة — GA4 + Cloud Function
 */
export async function trackMarketingPageView({ pagePath, pageTitle } = {}) {
  if (typeof window === 'undefined') return;

  const path = pagePath || `${window.location.pathname}${window.location.search}`;
  const title = pageTitle || document.title || 'فزاعين';

  if (shouldSkipDedup(path)) {
    sendGaPageView(path, title);
    return;
  }

  const urlUtm = parseUtmFromUrl();
  persistUtm(urlUtm);
  const utm = { ...loadPersistedUtm(), ...urlUtm };

  sendGaPageView(path, title);

  try {
    await sendMarketingEvent(buildMarketingPayload({
      pagePath: path,
      pageTitle: title,
      eventType: 'page_view',
      ...utm,
    }));
  } catch (e) {
    console.warn('[marketing] track failed:', e?.message || e);
  }
}
