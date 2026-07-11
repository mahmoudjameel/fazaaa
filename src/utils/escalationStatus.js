/**
 * تصعيد غير محلول فقط — يُستبعد أي سجل تم حلّه حتى لو status قديم/ناقص.
 */
export function isUnresolvedEscalation(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.resolvedAt) return false;
  if (data.status === 'resolved' || data.status === 'closed' || data.status === 'done') {
    return false;
  }
  return data.status === 'new' || data.status == null || data.status === '';
}

const SEEN_IDS_KEY = 'admin_escalations_seen_ids_v1';
const SEEN_EVENT = 'escalations-seen-updated';
const MAX_SEEN_IDS = 1500;

export function getSeenEscalationIds() {
  try {
    const raw = localStorage.getItem(SEEN_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

/** تعليم تصعيدات كمقروءة (عند فتح شاشة التصعيدات) */
export function markEscalationsSeen(ids) {
  if (!ids?.length) return;
  const seen = getSeenEscalationIds();
  let changed = false;
  ids.forEach((id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    changed = true;
  });
  if (!changed) return;

  const arr = [...seen];
  const trimmed = arr.length > MAX_SEEN_IDS ? arr.slice(arr.length - MAX_SEEN_IDS) : arr;
  try {
    localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(trimmed));
  } catch (_) { /* quota */ }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SEEN_EVENT));
  }
}

export function isUnreadEscalation(data, id, seenSet = getSeenEscalationIds()) {
  if (!id || !isUnresolvedEscalation(data)) return false;
  return !seenSet.has(id);
}

export function countUnreadEscalations(docs) {
  const seen = getSeenEscalationIds();
  return docs.filter((d) => isUnreadEscalation(d.data?.() ?? d.data, d.id, seen)).length;
}

export const ESCALATIONS_SEEN_EVENT = SEEN_EVENT;
