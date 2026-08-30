import { useEffect } from 'react';
import { trackMarketingPageView } from '../utils/marketingAnalytics';

/**
 * يسجّل زيارة الصفحة عند التحميل (مع منع التكرار خلال 30 دقيقة)
 */
export function useMarketingPageView(pagePath, pageTitle) {
  useEffect(() => {
    trackMarketingPageView({ pagePath, pageTitle });
  }, [pagePath, pageTitle]);
}
