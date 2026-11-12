/**
 * «ملف حالة» لعملية شحن يسأل عنها المزود: المزود غالباً يرسل أرقام محاولة فاشلة
 * ثم يعيد الدفع بأرقام مختلفة تنجح. نعرض كل عملياته حول نفس الوقت مع حكم واضح.
 */
export const CASE_WINDOW_MS = 24 * 60 * 60 * 1000;

const msOf = (row) => row?.createdAt?.getTime?.() || row?.paidAt?.getTime?.() || 0;
const isPaid = (row) => String(row?.state || '').toUpperCase() === 'PAID';
const OPEN_STATES = ['CREATED', 'PENDING_PAYMENT', 'PROCESSING'];

const minutesLabel = (ms) => {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.round(minutes / 60);
  return `${hours} س`;
};

/** عمليات المزود نفسه خلال 24 ساعة قبل/بعد العملية المطابقة، الأقدم أولاً */
export function relatedTopUps(match, providerRows) {
  const center = msOf(match);
  return providerRows
    .filter((row) => !center || Math.abs(msOf(row) - center) <= CASE_WINDOW_MS)
    .sort((a, b) => msOf(a) - msOf(b));
}

/**
 * الحكم: { tone: 'ok'|'warn'|'bad', text, paidRow? }
 * - المطابقة مدفوعة → وصل الرصيد
 * - فاشلة/ملغاة وبعدها (أو قبلها) شحن ناجح بنفس المبلغ → الرصيد وصل عبر العملية الأخرى
 * - ما زالت مفتوحة → النظام يستعلم البنك تلقائياً
 * - غير ذلك → لا يوجد شحن ناجح في هذه الفترة
 */
export function topUpCaseVerdict(match, related) {
  if (!match) return null;
  if (isPaid(match)) {
    return { tone: 'ok', text: 'هذه العملية ناجحة والرصيد أُضيف للمزود.', paidRow: match };
  }
  const state = String(match.state || '').toUpperCase();
  const paidOthers = related.filter((row) => row.id !== match.id && isPaid(row));
  const sameAmount = paidOthers.filter((row) => Number(row.amount) === Number(match.amount));
  const candidates = sameAmount.length ? sameAmount : paidOthers;
  const after = candidates.filter((row) => msOf(row) >= msOf(match));
  const paidRow = after[0] || candidates[candidates.length - 1];
  if (paidRow) {
    const gap = msOf(paidRow) - msOf(match);
    const when = gap >= 0 ? `بعدها بـ${minutesLabel(gap)}` : `قبلها بـ${minutesLabel(gap)}`;
    return {
      tone: 'ok',
      text: `هذه المحاولة لم تكتمل، لكن المزود شحن بنجاح ${when} (${paidRow.amount} ر.س) — الرصيد وصله.`,
      paidRow,
    };
  }
  if (OPEN_STATES.includes(state)) {
    return { tone: 'warn', text: 'العملية ما زالت مفتوحة — النظام يستعلم البنك تلقائياً كل 10 دقائق ويشحن إن دُفعت.' };
  }
  return { tone: 'bad', text: 'لم تنجح هذه العملية، ولا يوجد شحن ناجح لهذا المزود خلال 24 ساعة منها.' };
}
