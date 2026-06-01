/**
 * عرض رقم الطلب الموحّد (نفس التطبيقات: 100000187)
 */
export function formatOrderNumberDisplay(orderNumber, requestId) {
  if (orderNumber != null && orderNumber !== '') {
    return String(orderNumber).padStart(9, '0');
  }
  // لا نعرض معرّف Firestore كرقم طلب — يُفصل في واجهات التشخيص فقط
  if (requestId) {
    return requestId.substring(0, 8);
  }
  return '—';
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
