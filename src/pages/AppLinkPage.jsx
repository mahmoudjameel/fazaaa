import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppLinkQr } from '../components/AppLinkQr';
import {
  DEFAULT_APP_STORES,
  appLinkCopy,
  customerStoreUrls,
  detectPlatform,
  OFFICIAL_ORIGIN,
} from '../utils/appLink';

const SETTINGS_WAIT_MS = 1200;
const BRAND_DELAY_MS = 700;

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M1.71 23.1c-.22-.22-.35-.52-.35-.85V1.75c0-.33.13-.63.35-.85L12.29 12 1.71 23.1z" />
      <path fill="#34A853" d="M21.24 10.86 17.41 8.65l-3.63 3.63 3.63 3.63 3.83-2.21c1.01-.66 1.01-2.1 0-2.84z" />
      <path fill="#FBBC04" d="m16.12 15.71-11.36 6.61 8.32-8.32 3.04 1.71z" />
      <path fill="#EA4335" d="m16.12 8.29-3.04 3.03L4.76 1.68l11.36 6.61z" />
    </svg>
  );
}

function StoreButton({ store, href, compact = false }) {
  const apple = store === 'apple';
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#1C1917] text-white font-bold hover:bg-black transition-colors ${
        compact ? 'px-4 py-3 text-sm w-full' : 'px-4 py-3 text-[13px] flex-1 min-w-0'
      }`}
    >
      {apple ? <AppleIcon /> : <GooglePlayIcon />}
      <span className="leading-tight text-right">
        <span className="block text-[10px] font-medium text-white/70">
          {apple ? 'حمّل من' : 'احصل عليه من'}
        </span>
        <span className="block">{apple ? 'App Store' : 'Google Play'}</span>
      </span>
    </a>
  );
}

function Dots() {
  return (
    <div className="mt-6 flex items-center justify-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#DC2626] animate-bounce"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

export default function AppLinkPage() {
  const [platform] = useState(() => detectPlatform());
  const [stores, setStores] = useState(DEFAULT_APP_STORES);
  const [copy, setCopy] = useState(() => appLinkCopy());
  const [logoUrl, setLogoUrl] = useState('/fzaeen-logo.jpeg');

  useEffect(() => {
    document.title = 'تطبيق فزاعين';
  }, []);

  useEffect(() => {
    let alive = true;
    let started = false;
    let redirectTimer = 0;

    const apply = (data) => {
      if (!alive) return;
      const apps = data?.apps || {};
      setStores(customerStoreUrls(apps));
      setCopy(appLinkCopy(apps.appLink));
      if (data?.header?.logoUrl) setLogoUrl(data.header.logoUrl);
      return customerStoreUrls(apps);
    };

    const load = getDoc(doc(db, 'settings', 'landingContent'))
      .then((snap) => (snap.exists() ? snap.data() : {}))
      .catch(() => ({}));

    if (platform === 'desktop') {
      load.then((data) => { if (alive) apply(data); });
      return () => { alive = false; };
    }

    const begin = (nextStores) => {
      if (!alive || started) return;
      started = true;
      setStores(nextStores);
      const url = platform === 'ios' ? nextStores.appStoreUrl : nextStores.playStoreUrl;
      redirectTimer = window.setTimeout(() => {
        if (alive) window.location.replace(url);
      }, BRAND_DELAY_MS);
    };

    const fallbackTimer = window.setTimeout(() => begin(DEFAULT_APP_STORES), SETTINGS_WAIT_MS);
    load.then((data) => {
      window.clearTimeout(fallbackTimer);
      const next = apply(data);
      begin(next);
    });

    return () => {
      alive = false;
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [platform]);

  const storeHref = platform === 'ios' ? stores.appStoreUrl : stores.playStoreUrl;
  const domain = OFFICIAL_ORIGIN.replace(/^https?:\/\/(www\.)?/i, '');

  return (
    <div className="min-h-screen bg-[#FFF4F0] flex items-center justify-center p-5" dir="rtl">
      <div className="w-full max-w-[420px] rounded-[36px] bg-white px-7 py-10 text-center shadow-[0_24px_80px_rgba(220,38,38,0.08)]">
        <img
          src={logoUrl}
          alt="فزاعين"
          className="mx-auto h-[72px] w-[72px] rounded-[22px] object-cover shadow-[0_12px_40px_rgba(220,38,38,0.28)]"
        />
        <p className="mt-5 text-sm font-bold text-[#DC2626]">{copy.eyebrow}</p>
        <h1 className="mt-2 text-[30px] font-black leading-snug text-[#1C1917]">{copy.title}</h1>

        {platform === 'desktop' ? (
          <>
            <p className="mt-3 text-sm text-neutral-400">{copy.desktopText}</p>
            <div className="mt-6">
              <AppLinkQr size={232} />
            </div>
            <div className="mt-6 flex gap-3" dir="ltr">
              <StoreButton store="google" href={stores.playStoreUrl} />
              <StoreButton store="apple" href={stores.appStoreUrl} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-neutral-400">{copy.redirectText}</p>
            <Dots />
            <div className="mt-6">
              <StoreButton
                store={platform === 'ios' ? 'apple' : 'google'}
                href={storeHref}
                compact
              />
            </div>
          </>
        )}

        <p className="mt-7 text-sm text-neutral-400" dir="ltr">{domain}</p>
      </div>
    </div>
  );
}
