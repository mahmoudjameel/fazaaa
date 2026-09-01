/** عمولة/تكلفة خدمة واحدة — القيم الجديدة (شحن وتخصيم جديد) */
export const DEFAULT_COMMISSION_PER_ORDER = 10;

/** عمولة الخدمات المشحونة/المتبقية من النظام السابق (5 ر.س) */
export const LEGACY_COMMISSION_PER_ORDER = 5;

/** الحد الأدنى للرصيد لاستقبال الطلبات (خدمة واحدة بالسعر الجديد) */
export const DEFAULT_MIN_BALANCE_FOR_REQUEST = 10;

export const DEFAULT_PRICING = {
  providerCommissionPerOrder: DEFAULT_COMMISSION_PER_ORDER,
  legacyProviderCommissionPerOrder: LEGACY_COMMISSION_PER_ORDER,
  minBalanceForRequest: DEFAULT_MIN_BALANCE_FOR_REQUEST,
};

export function normalizePricing(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const commission =
    typeof p.providerCommissionPerOrder === 'number' && p.providerCommissionPerOrder > 0
      ? p.providerCommissionPerOrder
      : DEFAULT_COMMISSION_PER_ORDER;
  const legacy =
    typeof p.legacyProviderCommissionPerOrder === 'number' && p.legacyProviderCommissionPerOrder > 0
      ? p.legacyProviderCommissionPerOrder
      : LEGACY_COMMISSION_PER_ORDER;
  const minBalance =
    typeof p.minBalanceForRequest === 'number' && p.minBalanceForRequest > 0
      ? p.minBalanceForRequest
      : DEFAULT_MIN_BALANCE_FOR_REQUEST;
  return {
    providerCommissionPerOrder: commission,
    legacyProviderCommissionPerOrder: legacy,
    minBalanceForRequest: minBalance,
  };
}

/**
 * تهيئة كسولية: رصيد قديم بـ 5 ر.س/خدمة → legacyServiceCredits
 * (لا يغيّر الرصيد بالريال — يحافظ على عدد الخدمات)
 */
export function ensureWalletCreditsShape(wallet = {}) {
  const balance = Number(wallet.balance) || 0;
  const hasLegacyField = typeof wallet.legacyServiceCredits === 'number';
  const hasNewField = typeof wallet.serviceCredits === 'number';
  let legacyServiceCredits = hasLegacyField ? wallet.legacyServiceCredits : null;
  let serviceCredits = hasNewField ? wallet.serviceCredits : 0;

  if (!hasLegacyField && !hasNewField && balance > 0) {
    legacyServiceCredits = Math.floor(balance / LEGACY_COMMISSION_PER_ORDER);
  }
  if (legacyServiceCredits == null) legacyServiceCredits = 0;

  return {
    balance,
    legacyServiceCredits,
    serviceCredits,
  };
}

/** إجمالي الخدمات المتبقية (للعرض) */
export function countRemainingServices(wallet, pricing = DEFAULT_PRICING) {
  const w = ensureWalletCreditsShape(wallet);
  if (w.legacyServiceCredits > 0 || w.serviceCredits > 0) {
    return w.legacyServiceCredits + w.serviceCredits;
  }
  const unit = pricing.providerCommissionPerOrder || DEFAULT_COMMISSION_PER_ORDER;
  return Math.floor(w.balance / unit);
}

/** هل الرصيد كافٍ لاستقبال طلب؟ */
export function canReceiveRequestsWithWallet(wallet, pricing = DEFAULT_PRICING) {
  const w = ensureWalletCreditsShape(wallet);
  const p = normalizePricing(pricing);
  if (w.legacyServiceCredits > 0 && w.balance >= p.legacyProviderCommissionPerOrder) return true;
  if (w.serviceCredits > 0 && w.balance >= p.providerCommissionPerOrder) return true;
  if (w.legacyServiceCredits === 0 && w.serviceCredits === 0) {
    return w.balance >= p.minBalanceForRequest;
  }
  return false;
}

/** مبلغ الخصم التالي عند إكمال طلب */
export function resolveNextDeductionAmount(wallet, pricing = DEFAULT_PRICING) {
  const w = ensureWalletCreditsShape(wallet);
  const p = normalizePricing(pricing);
  if (w.legacyServiceCredits > 0) return p.legacyProviderCommissionPerOrder;
  return p.providerCommissionPerOrder;
}

/** اعتماد شحن جديد — مضاعفات السعر الحالي */
export function validateTopUpAmount(amount, pricing = DEFAULT_PRICING) {
  const p = normalizePricing(pricing);
  const unit = p.providerCommissionPerOrder;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'المبلغ يجب أن يكون أكبر من صفر' };
  }
  if (amount % unit !== 0) {
    return {
      ok: false,
      error: `المبلغ يجب أن يكون من مضاعفات ${unit} ر.س (${unit}، ${unit * 2}، ${unit * 3} ...)` ,
    };
  }
  return { ok: true, serviceCredits: amount / unit, unitValue: unit };
}
