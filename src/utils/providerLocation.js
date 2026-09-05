/** عتبات حداثة الموقع (نفس منطق صفحة المزودين) */
export const FRESH_MS = 2 * 60 * 1000;
export const OK_MS = 15 * 60 * 1000;

export const ACTIVE_REQUEST_STATUSES = [
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'pending_client_confirmation',
  'pending_review',
  'pending_legal_docs',
];

export const REQUEST_STATUS_LABELS = {
  searching: 'يبحث عن مزود',
  assigned: 'مُسند',
  en_route: 'في الطريق',
  arrived: 'وصل',
  in_progress: 'قيد التنفيذ',
  pending_client_confirmation: 'بانتظار تأكيد العميل',
  pending_review: 'قيد المراجعة',
  pending_legal_docs: 'مستندات قانونية',
  completed: 'مكتمل',
  canceled_by_client: 'ألغاه العميل',
  canceled_by_provider: 'ألغاه المزود',
  timed_out: 'انتهى وقت البحث',
};

export function timestampToDate(ts) {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000);
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function getProviderCoords(provider) {
  if (!provider) return null;
  const candidates = [
    provider.location,
    provider.locationCoordinates,
    provider.coordinates,
    provider.lastKnownLocation,
    provider.lastLoginLocation,
  ];
  for (const c of candidates) {
    const lat = Number(c?.latitude ?? c?.lat);
    const lng = Number(c?.longitude ?? c?.lng ?? c?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng, source: c === provider.lastLoginLocation ? 'login' : 'live' };
    }
  }
  return null;
}

export function getProviderFreshness(provider, nowMs = Date.now()) {
  const locationAt = provider?.locationUpdatedAt || provider?.location?.timestamp;
  const heartbeatAt = provider?.lastHeartbeat;
  const dLoc = timestampToDate(locationAt);
  const dHb = timestampToDate(heartbeatAt);
  let d = null;
  if (dLoc && dHb) d = dLoc.getTime() >= dHb.getTime() ? dLoc : dHb;
  else d = dLoc || dHb;
  if (!d) return 'unknown';
  const ageMs = nowMs - d.getTime();
  if (ageMs <= FRESH_MS) return 'fresh';
  if (ageMs <= OK_MS) return 'ok';
  return 'stale';
}

export function getFreshnessAgeMs(provider, nowMs = Date.now()) {
  const locationAt = provider?.locationUpdatedAt || provider?.location?.timestamp;
  const heartbeatAt = provider?.lastHeartbeat;
  const dLoc = timestampToDate(locationAt);
  const dHb = timestampToDate(heartbeatAt);
  let d = null;
  if (dLoc && dHb) d = dLoc.getTime() >= dHb.getTime() ? dLoc : dHb;
  else d = dLoc || dHb;
  return d ? Math.max(0, nowMs - d.getTime()) : null;
}

export function formatRelativeAgo(ts, nowMs = Date.now()) {
  const d = timestampToDate(ts);
  if (!d) return null;
  const diffSec = Math.max(0, Math.floor((nowMs - d.getTime()) / 1000));
  if (diffSec < 60) return `قبل ${diffSec} ث`;
  if (diffSec < 3600) return `قبل ${Math.floor(diffSec / 60)} د`;
  if (diffSec < 86400) return `قبل ${Math.floor(diffSec / 3600)} س`;
  return `قبل ${Math.floor(diffSec / 86400)} ي`;
}

export function isProviderOnline(provider) {
  if (!provider) return false;
  const avail = provider.availabilityStatus;
  if (avail === 'available' || avail === 'busy') return true;
  if (avail === 'paused' || avail === 'offline') return false;
  return provider.isOnline === true;
}

export function getProviderAvailabilityLabel(provider) {
  const avail = provider?.availabilityStatus;
  if (avail === 'available') return 'متاح';
  if (avail === 'busy' || provider?.isBusy) return 'مشغول';
  if (avail === 'paused') return 'متوقف مؤقتاً';
  if (avail === 'offline' || provider?.isOnline === false) return 'غير متصل';
  if (provider?.isOnline === true) return 'متصل';
  return 'غير متصل';
}

export function getProviderDisplayName(provider) {
  if (!provider) return 'مزود';
  if (provider.shopName) return provider.shopName;
  const name = [provider.firstName, provider.lastName].filter(Boolean).join(' ').trim();
  return name || provider.phone || `…${String(provider.id || '').slice(-6)}`;
}

export function isProviderApproved(provider) {
  const s = provider?.approvalStatus || provider?.status;
  return s === 'approved';
}

/**
 * يُستنتج من بيانات Firestore — صلاحية «الموقع دائماً» لا تُخزَّن صراحةً في المزود.
 */
export function inferLocationTrackingIssue(provider, nowMs = Date.now()) {
  if (!provider || !isProviderApproved(provider)) return null;

  const coords = getProviderCoords(provider);
  const freshness = getProviderFreshness(provider, nowMs);
  const online = isProviderOnline(provider);
  const hasHeartbeat = !!timestampToDate(provider.lastHeartbeat);

  if (!coords) {
    return {
      type: 'no_location',
      label: 'بدون موقع',
      hint: 'لم يُرسل المزود إحداثيات — غالباً صلاحية الموقع غير مفعّلة أو التطبيق مغلق.',
    };
  }

  if (!hasHeartbeat && coords.source === 'login') {
    return {
      type: 'login_only',
      label: 'موقع دخول فقط',
      hint: 'آخر موقع من تسجيل الدخول وليس تتبعاً حياً — يُرجى تفعيل الموقع «دائماً».',
    };
  }

  if (online && freshness === 'stale') {
    return {
      type: 'stale_while_online',
      label: 'متصل وموقع قديم',
      hint: 'المزود يظهر متصلاً لكن الموقع لم يُحدَّث منذ أكثر من 15 دقيقة.',
    };
  }

  if (online && freshness === 'ok') {
    const bgSources = new Set(['background', 'live_tracking_start', 'location_update']);
    if (!bgSources.has(provider.heartbeatSource)) {
      return {
        type: 'no_background',
        label: 'بدون تتبع خلفية',
        hint: 'المزود متصل لكن التحديثات ليست من الخلفية — قد لا يملك صلاحية «الموقع دائماً».',
      };
    }
  }

  if (!hasHeartbeat && freshness === 'unknown') {
    return {
      type: 'never_synced',
      label: 'لم يُرسل نبض موقع',
      hint: 'لا يوجد lastHeartbeat — اطلب من المزود فتح التطبيق وتفعيل الموقع.',
    };
  }

  return null;
}

export function hasLocationTrackingIssue(provider, nowMs = Date.now()) {
  return inferLocationTrackingIssue(provider, nowMs) != null;
}

export function getMarkerVisual(provider, nowMs = Date.now()) {
  const freshness = getProviderFreshness(provider, nowMs);
  const online = isProviderOnline(provider);
  const busy = provider?.isBusy || provider?.activeRequestId || provider?.availabilityStatus === 'busy';
  const issue = inferLocationTrackingIssue(provider, nowMs);

  if (issue?.type === 'no_location') {
    return { color: '#9CA3AF', ring: '#EF4444', label: 'بدون موقع' };
  }
  if (issue && (issue.type === 'stale_while_online' || issue.type === 'login_only')) {
    return { color: '#F97316', ring: '#EF4444', label: issue.label };
  }
  if (busy) return { color: '#3B82F6', ring: null, label: 'مشغول' };
  if (online && provider?.availabilityStatus === 'available') {
    return { color: freshness === 'fresh' ? '#10B981' : '#14B8A6', ring: freshness === 'stale' ? '#EF4444' : null, label: 'متاح' };
  }
  if (online) return { color: '#F59E0B', ring: null, label: 'متصل' };
  return { color: '#6B7280', ring: null, label: 'غير متصل' };
}

export function heartbeatSourceLabel(source) {
  const map = {
    background: 'خلفية',
    foreground: 'واجهة',
    start: 'بدء',
    'bg-simulator': 'محاكي',
    location_update: 'تحديث موقع',
    live_tracking_start: 'تتبع حي',
  };
  return map[source] || source || '—';
}

const BACKGROUND_HEARTBEAT_SOURCES = new Set([
  'background',
  'bg-simulator',
  'location_update',
  'live_tracking_start',
]);

/** نبض حديث بما يكفي لاعتبار التطبيق ما زال يعمل */
export const BACKGROUND_ALIVE_MS = 10 * 60 * 1000;

/**
 * حالة تشغيل تطبيق المزود (استنتاج من Firestore — ليست ضمانة 100%).
 * - foreground: التطبيق مفتوح أمام المستخدم
 * - background_ok: يعمل بالخلفية مع نبض حديث
 * - not_running: لا يوجد نبض حديث → غالباً مغلق أو أوقف الخلفية
 * - unknown: لا بيانات كافية
 */
export function getProviderAppRuntimeStatus(provider, nowMs = Date.now()) {
  if (!provider) return { id: 'unknown', label: 'غير معروف', hint: 'لا بيانات', healthy: false };

  const ageMs = getFreshnessAgeMs(provider, nowMs);
  const appState = String(provider.clientAppState || '').toLowerCase();
  const source = String(provider.heartbeatSource || '').toLowerCase();
  const hasRecentPulse = ageMs != null && ageMs <= BACKGROUND_ALIVE_MS;

  if (hasRecentPulse && appState === 'active') {
    return {
      id: 'foreground',
      label: 'مفتوح الآن',
      hint: 'التطبيق في الواجهة (أمام المستخدم).',
      healthy: true,
    };
  }

  if (hasRecentPulse && (appState === 'background' || BACKGROUND_HEARTBEAT_SOURCES.has(source))) {
    return {
      id: 'background_ok',
      label: 'يعمل بالخلفية',
      hint: 'نبض حديث من الخلفية — التتبع فعّال.',
      healthy: true,
    };
  }

  if (hasRecentPulse) {
    return {
      id: 'foreground',
      label: 'مفتوح / نبض حديث',
      hint: 'يوجد نبض حديث لكن مصدر الخلفية غير مؤكد.',
      healthy: true,
    };
  }

  if (ageMs == null) {
    return {
      id: 'unknown',
      label: 'غير معروف',
      hint: 'لا يوجد lastHeartbeat أو موقع — اطلب فتح التطبيق.',
      healthy: false,
    };
  }

  return {
    id: 'not_running',
    label: 'بدون خلفية / مغلق',
    hint: 'لا يوجد نبض منذ أكثر من 10 دقائق — التطبيق غالباً مغلق أو أوقف الموقع في الخلفية.',
    healthy: false,
  };
}

/** مزودون يحتاجون تنبيه: ليسوا يعملون بالخلفية بشكل سليم */
export function isProviderMissingBackground(provider, nowMs = Date.now()) {
  const status = getProviderAppRuntimeStatus(provider, nowMs);
  return status.id === 'not_running' || status.id === 'unknown';
}

export function clientAppStateLabel(state) {
  const s = String(state || '').toLowerCase();
  if (s === 'active') return 'واجهة (مفتوح)';
  if (s === 'background') return 'خلفية';
  return state || '—';
}
