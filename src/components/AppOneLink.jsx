import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { AppLinkQr } from './AppLinkQr';
import {
  appLinkLabel,
  copyText,
  detectPlatform,
  officialAppLinkUrl,
} from '../utils/appLink';

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export function AppOneLink({ copy, appStoreUrl, playStoreUrl }) {
  const [platform] = useState(() => detectPlatform());
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const label = appLinkLabel();
  const shareUrl = officialAppLinkUrl();

  const onCopy = async () => {
    const ok = await copyText(shareUrl);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const onShare = async () => {
    try {
      await navigator.share({ title: 'فزاعين', text: copy.linkText, url: shareUrl });
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  };

  const storeClass = (store) => {
    const active = (store === 'apple' && platform === 'ios') || (store === 'google' && platform === 'android');
    return active
      ? 'bg-white text-gray-950 ring-2 ring-amber-400'
      : 'bg-white/10 text-white border border-white/15 hover:bg-white/15';
  };

  return (
    <div className="max-w-4xl mx-auto mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1 min-w-0 text-right">
          <h3 className="text-xl font-black text-white">{copy.linkTitle}</h3>
          <p className="mt-1 text-sm text-white/50">{copy.linkText}</p>
          <a href="/app" className="mt-3 inline-block font-mono text-lg font-bold text-amber-300" dir="ltr">
            {label}
          </a>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-950 px-4 py-2.5 text-sm font-bold"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
            {canShare && (
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Share2 className="w-4 h-4" />
                مشاركة
              </button>
            )}
            <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${storeClass('google')}`}>
              Google Play
            </a>
            <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${storeClass('apple')}`}>
              <AppleMark />
              App Store
            </a>
          </div>
        </div>
        {platform === 'desktop' && (
          <div className="shrink-0">
            <AppLinkQr size={168} />
          </div>
        )}
      </div>
    </div>
  );
}
