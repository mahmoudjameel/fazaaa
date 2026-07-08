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

/** رصيد منخفض: 25 ريال فأقل */
export const LOW_BALANCE_THRESHOLD = 25;

export function isLowWalletBalance(providerData, threshold = LOW_BALANCE_THRESHOLD) {
  return resolveProviderWalletBalance(providerData) <= threshold;
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
