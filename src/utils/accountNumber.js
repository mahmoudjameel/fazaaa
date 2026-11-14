/**
 * الرقم المرجعي الثابت للحساب (مزود P10001 / عميل C10001) — يعطيه السيرفر عند إنشاء الحساب
 * ولا يتغير بتغيّر الجوال أو البيانات (functions/lib/accountNumbers.js).
 */
const normalize = (value) => String(value || '').trim().toUpperCase();

/** «P10001» أو «p10001» أو «10001» تطابق P10001 */
export const matchesAccountNumber = (accountNumber, term) => {
  const number = normalize(accountNumber);
  const query = normalize(term);
  if (!number || !query) return false;
  if (number === query) return true;
  return /^\d{5,}$/.test(query) && number.slice(1) === query;
};
