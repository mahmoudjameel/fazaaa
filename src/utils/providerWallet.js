import {
  countRemainingServices,
  DEFAULT_PRICING,
  ensureWalletCreditsShape,
  normalizePricing,
} from './providerPricing.js';

const toFiniteBalance = (value) => {
  if (value == null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : null;
};

/**
 * استخراج رصيد محفظة المزود من الحقول المعروفة في Firestore
 * (wallet.balance — walletBalance القديم — أو آخر حركة في السجل)
 */
export function resolveProviderWalletBalance(providerData, transactionHistory = []) {
  if (!providerData) return 0;

  const nested = toFiniteBalance(providerData.wallet?.balance);
  if (nested != null) return nested;

  // بعض السجلات القديمة خزّنت الرصيد كرقم مباشرة في wallet
  if (typeof providerData.wallet === 'number') {
    const asNumber = toFiniteBalance(providerData.wallet);
    if (asNumber != null) return asNumber;
  }

  const legacy = toFiniteBalance(providerData.walletBalance);
  if (legacy != null) return legacy;

  if (Array.isArray(transactionHistory) && transactionHistory.length > 0) {
    for (const item of transactionHistory) {
      const fromTx = toFiniteBalance(item?.balance);
      if (fromTx != null) return fromTx;
    }
  }

  return 0;
}

/** عدد الخدمات المتبقية — يحترم رصيد الشحن القديم (5 ر.س) والجديد (10 ر.س) */
export function countProviderRemainingServices(providerData, pricing = DEFAULT_PRICING) {
  const balance = Math.max(0, resolveProviderWalletBalance(providerData));
  const wallet = { ...providerData?.wallet, balance };
  const shaped = ensureWalletCreditsShape(wallet);
  const prices = normalizePricing(pricing);
  const legacy = Math.min(
    Math.max(0, Math.floor(shaped.legacyServiceCredits)),
    Math.floor(balance / prices.legacyProviderCommissionPerOrder)
  );
  const remainingBalance = Math.max(0, balance - legacy * prices.legacyProviderCommissionPerOrder);
  const affordable = legacy + Math.floor(remainingBalance / prices.providerCommissionPerOrder);
  // العدادات القديمة قد لا تتزامن مع الخصم؛ لا نعرض خدمات لا يغطيها الرصيد.
  return Math.max(0, Math.min(Math.floor(countRemainingServices(wallet, prices)), affordable));
}

/** رصيد منخفض: 3 خدمات أو أقل */
export const LOW_BALANCE_SERVICE_THRESHOLD = 3;

export function isLowWalletBalance(providerData, threshold = LOW_BALANCE_SERVICE_THRESHOLD, pricing = DEFAULT_PRICING) {
  return countProviderRemainingServices(providerData, pricing) <= threshold;
}

export function withNormalizedProviderWallet(provider, transactionHistory = []) {
  if (!provider) return provider;
  const balance = resolveProviderWalletBalance(provider, transactionHistory);
  return {
    ...provider,
    wallet: {
      ...(typeof provider.wallet === 'object' && provider.wallet ? provider.wallet : {}),
      balance,
    },
  };
}
