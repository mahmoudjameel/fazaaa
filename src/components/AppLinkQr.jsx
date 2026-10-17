import { useEffect, useState } from 'react';
import { appLinkQrSvg } from '../utils/appLink';

export function AppLinkQr({ size = 168, color = '#1C1917' }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let alive = true;
    appLinkQrSvg(color).then((markup) => {
      if (alive) setSvg(markup);
    }).catch(() => {
      if (alive) setSvg('');
    });
    return () => {
      alive = false;
    };
  }, [color]);

  return (
    <div
      className="bg-white rounded-[22px] border border-black/5 shadow-[0_8px_30px_rgba(28,25,23,0.06)] p-3 mx-auto"
      style={{ width: size, height: size }}
    >
      {svg ? (
        <div
          className="w-full h-full [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-full w-full animate-pulse rounded-2xl bg-neutral-100" />
      )}
    </div>
  );
}
