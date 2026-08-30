import { useEffect } from 'react';
import { trackDownloadClick, inferStoreFromHref } from '../utils/marketingAnalytics';

function resolveAppRole(href) {
  const h = String(href || '').toLowerCase();
  if (h.includes('com.fazaa.provider') || h.includes('fzaeen-provider') || h.includes('id6761298718')) {
    return 'provider';
  }
  return 'customer';
}

function isStoreHref(href) {
  const lower = String(href || '').toLowerCase();
  return (
    lower.includes('apps.apple.com') ||
    lower.includes('play.google.com') ||
    lower.includes('itunes.apple.com')
  );
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => { setTimeout(resolve, ms); }),
  ]);
}

/**
 * يلتقط أي ضغطة على روابط App Store / Google Play في اللاندنق (React أو HTML مخصص)
 * ويُرسل الحدث قبل فتح المتجر.
 */
export function useLandingDownloadTracking() {
  useEffect(() => {
    const onClickCapture = (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      if (!isStoreHref(href)) return;

      event.preventDefault();
      event.stopPropagation();

      const section = anchor.getAttribute('data-download-section') || 'landing_link';
      const appRole = anchor.getAttribute('data-download-app') || resolveAppRole(href);
      const store = anchor.getAttribute('data-download-store') || inferStoreFromHref(href);

      withTimeout(
        trackDownloadClick({
          appRole,
          store,
          section,
          href,
          pagePath: '/',
        }),
        2500,
      ).finally(() => {
        window.open(href, anchor.getAttribute('target') || '_blank', 'noopener,noreferrer');
      });
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);
}
