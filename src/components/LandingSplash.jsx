import { useEffect, useState } from 'react';

const SPLASH_MS = 1600;
const FADE_MS = 400;

/**
 * سبلاش بسيط للاندينغ — خلفية فاتحة + اللوجو + نص مختصر
 */
export function LandingSplash({ logoUrl = '/fzaeen-logo.jpeg', siteName = 'فزاعين' }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_MS);
    const hideTimer = setTimeout(() => setVisible(false), SPLASH_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`landing-splash${fading ? ' landing-splash--out' : ''}`}
      aria-hidden="true"
    >
      <div className="landing-splash__inner">
        <img
          src={logoUrl}
          alt={siteName}
          className="landing-splash__logo"
          draggable={false}
        />
        <p className="landing-splash__tagline">مساعدة الطريق… في لحظات</p>
      </div>
    </div>
  );
}
