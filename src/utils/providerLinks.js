/** رابط ملف المزود في صفحة المزودين مفتوحاً على تبويب الطلبات (?highlight يفتح النافذة، ?tab يختار التبويب) */
export const providerOrdersPath = (providerId) =>
  `/admin/providers?highlight=${encodeURIComponent(providerId)}&tab=orders`;
