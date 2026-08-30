import { useMarketingPageView } from '../hooks/useMarketingPageView';

/** مكوّن خفيف لتتبع زيارات الصفحات العامة */
export function MarketingPageTracker({ pagePath, pageTitle }) {
  useMarketingPageView(pagePath, pageTitle);
  return null;
}
