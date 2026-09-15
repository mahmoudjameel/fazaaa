/**
 * كاش بسيط لنتائج getDocs في لوحة التحكم —
 * يمنع إعادة تحميل كامل المجموعة عند الرجوع لنفس التاب خلال TTL.
 */

const store = new Map();

export function getCached(key, ttlMs = 45_000) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function setCached(key, value) {
  store.set(key, { value, at: Date.now() });
  return value;
}

export function invalidateCached(keyOrPrefix) {
  if (!keyOrPrefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) store.delete(k);
  }
}

/**
 * مستمع مشترك: يبقى حياً بعد مغادرة الصفحة لفترة قصيرة
 * حتى الرجوع للتاب لا يعيد تنزيل المجموعة من الصفر.
 *
 * throttleMs: يحدّ من إعادة رسم الصفحة عند تحديثات Firestore الكثيرة
 * (مثل تحديثات البحث المتدرج / GPS كل بضع ثوانٍ).
 */
export function createSharedSnapshotListener({
  key,
  setup,
  keepAliveMs = 90_000,
  throttleMs = 0,
}) {
  let unsubscribeFs = null;
  let lastData = null;
  let keepAliveTimer = null;
  let throttleTimer = null;
  let pendingData = undefined;
  let lastEmitAt = 0;
  const subscribers = new Set();

  const deliver = (data) => {
    lastData = data;
    subscribers.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[sharedListener:${key}] subscriber error`, e);
      }
    });
  };

  const emit = (data) => {
    if (!throttleMs || throttleMs <= 0) {
      deliver(data);
      return;
    }

    pendingData = data;
    const elapsed = Date.now() - lastEmitAt;
    if (elapsed >= throttleMs) {
      lastEmitAt = Date.now();
      pendingData = undefined;
      deliver(data);
      return;
    }

    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      lastEmitAt = Date.now();
      if (pendingData !== undefined) {
        const next = pendingData;
        pendingData = undefined;
        deliver(next);
      }
    }, throttleMs - elapsed);
  };

  const start = () => {
    if (unsubscribeFs) return;
    unsubscribeFs = setup(emit);
  };

  const stop = () => {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    pendingData = undefined;
    if (unsubscribeFs) {
      unsubscribeFs();
      unsubscribeFs = null;
    }
  };

  return (callback) => {
    if (typeof callback !== 'function') return () => {};

    subscribers.add(callback);
    if (keepAliveTimer) {
      clearTimeout(keepAliveTimer);
      keepAliveTimer = null;
    }

    if (lastData != null) {
      try {
        callback(lastData);
      } catch (e) {
        console.error(`[sharedListener:${key}] hydrate error`, e);
      }
    }

    start();

    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        keepAliveTimer = setTimeout(() => {
          if (subscribers.size === 0) stop();
          keepAliveTimer = null;
        }, keepAliveMs);
      }
    };
  };
}
