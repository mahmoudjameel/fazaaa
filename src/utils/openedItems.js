/**
 * عناصر فتحها الأدمن في هذه الجلسة (تذاكر/شكاوى) مع فلتر الحالة الذي فُتحت تحته —
 * تبقى ظاهرة تحت نفس الفلتر حتى لو تغيّرت حالتها بعد الرد (مفتوحة → قيد المعالجة)
 * فلا "تختفي" من القائمة، دون أن تظهر تحت فلاتر حالات أخرى.
 */
const storageKey = (scope) => `fz_opened_${scope}`;

/** @returns {Map<string, string>} id → statusFilter وقت الفتح */
export function loadOpenedIds(scope) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(storageKey(scope)) || '[]');
    return new Map(Array.isArray(raw) ? raw.filter((e) => Array.isArray(e) && e.length === 2) : []);
  } catch {
    return new Map();
  }
}

export function rememberOpenedId(scope, id, statusFilter, current) {
  if (!id || current.get(id) === statusFilter) return current;
  const next = new Map(current);
  next.delete(id);
  next.set(id, statusFilter);
  try {
    sessionStorage.setItem(storageKey(scope), JSON.stringify([...next].slice(-200)));
  } catch { /* ignore */ }
  return next;
}

/** هل يبقى العنصر ظاهراً تحت فلتر الحالة الحالي لأنه فُتح تحته؟ */
export function isOpenedUnderFilter(openedIds, id, statusFilter) {
  return statusFilter !== 'all' && openedIds.get(id) === statusFilter;
}
