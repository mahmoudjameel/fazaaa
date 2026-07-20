/**
 * عرض رقم الطلب الموحّد (نفس التطبيقات: #100000187)
 * لا نستخدم معرّف Firestore كرقم طلب أبداً.
 */
export function formatOrderNumberDisplay(orderNumber, _requestId) {
  if (orderNumber == null || orderNumber === '') return '—';
  let raw = String(orderNumber).trim();
  if (raw.startsWith('#')) raw = raw.slice(1);
  // تجاهل معرّفات Firestore القصيرة/الأبجدية التي كانت تُعرض خطأً كرقم طلب
  if (!/^\d+$/.test(raw)) return '—';
  return raw.padStart(9, '0');
}

/** رقم طلب التصعيد: orderNumber من السجل أو من جلب الطلب المرتبط */
export function formatEscalationOrderLabel(esc, orderNumberByRequestId = {}) {
  const num =
    esc?.orderNumber ??
    (esc?.requestId ? orderNumberByRequestId[esc.requestId] : null);
  if (num != null && num !== '') {
    return formatOrderNumberLabel(num, null);
  }
  return '—';
}

export function formatOrderNumberLabel(orderNumber, requestId) {
  const n = formatOrderNumberDisplay(orderNumber, requestId);
  return n === '—' ? '—' : `#${n}`;
}
