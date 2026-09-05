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
 *
 * مهم: لا تُحسب legacy من رصيد يتضمن شحن جديد لم يُسجَّل بعد في serviceCredits.
 */
export function ensureWalletCreditsShape(wallet = {}) {
  const balance = Number(wallet.balance) || 0;
  const hasLegacyField = typeof wallet.legacyServiceCredits === 'number';
  const hasNewField = typeof wallet.serviceCredits === 'number';
  let legacyServiceCredits = hasLegacyField ? wallet.legacyServiceCredits : null;
  let serviceCredits = hasNewField ? wallet.serviceCredits : 0;

  if (!hasLegacyField && !hasNewField && balance > 0) {
    // محفظة قديمة بالكامل قبل نظام الرصيد المزدوج → كلها خدمات بـ 5 ر.س
    legacyServiceCredits = Math.floor(balance / LEGACY_COMMISSION_PER_ORDER);
  } else if (!hasLegacyField && hasNewField && balance > 0) {
    // وُجد serviceCredits فقط: ما تبقى بعد حجز الشحن الجديد يُحسب قديماً بـ 5
    const reservedNew = Math.max(0, Number(serviceCredits) || 0) * DEFAULT_COMMISSION_PER_ORDER;
    const leftover = Math.max(0, balance - reservedNew);
    legacyServiceCredits = Math.floor(leftover / LEGACY_COMMISSION_PER_ORDER);
  }
  if (legacyServiceCredits == null) legacyServiceCredits = 0;

  return {
    balance,
    legacyServiceCredits,
    serviceCredits,
  };
}

/**
 * عند الشحن: ثبّت خدمات الـ 5 ر.س من الرصيد الحالي قبل إضافة الشحن الجديد بـ 10 ر.س.
 */
export function applyTopUpCredits(wallet, amountSar, pricing = DEFAULT_PRICING) {
  const validation = validateTopUpAmount(Number(amountSar), pricing);
  if (!validation.ok) return { ok: false, error: validation.error };

  const before = ensureWalletCreditsShape(wallet || {});
  const newBalance = before.balance + Number(amountSar);
  return {
    ok: true,
    newBalance,
    legacyServiceCredits: before.legacyServiceCredits,
    serviceCredits: before.serviceCredits + validation.serviceCredits,
    serviceCreditsAdded: validation.serviceCredits,
    unitValue: validation.unitValue,
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

/** مبلغ الخصم عند إكمال طلب: قديم 5 ر.س أولاً، ثم شحن جديد 10 ر.س */
export function resolveNextDeductionAmount(wallet, pricing = DEFAULT_PRICING) {
  const w = ensureWalletCreditsShape(wallet);
  const p = normalizePricing(pricing);
  if (w.legacyServiceCredits > 0) return p.legacyProviderCommissionPerOrder;
  return p.providerCommissionPerOrder;
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
