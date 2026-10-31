/**
 * طلبات «لا يوجد شبكة»: كل طلب انتهى بحثه بلا قبول (timed_out) — يرى العميل نفس الرسالة في الحالتين:
 *   • لم يصل لأحد (noCoverage): لم يُشعَر أي مزود — لا مزودين في النطاق.
 *   • لم يقبل أحد (notAccepted): أُشعر مزودون ولم يقبل أحد.
 * الطلب لا يحمل حقل مدينة — نحدّدها من إحداثياته: أقرب مدينة مسجّلة ضمن serviceRadius،
 * وإلا تُجمَع في منطقة شبكية (~20كم) خارج المدن مع بعدها واتجاهها من أقرب مدينة.
 */

const EARTH_KM = 6371;
const GRID_DEG = 0.2; // ≈ 20كم
const DEFAULT_CITY_RADIUS_KM = 50;

const rad = (x) => (x * Math.PI) / 180;

export function distanceKm(lat1, lng1, lat2, lng2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

function directionFrom(lat1, lng1, lat2, lng2) {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2))
    - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const names = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
  return names[Math.round(deg / 45) % 8];
}

const cityCoords = (c) => {
  const lat = Number(c?.coordinates?.lat ?? c?.coordinates?.latitude);
  const lng = Number(c?.coordinates?.lng ?? c?.coordinates?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const STALE_SEARCH_GRACE_MS = 2 * 60 * 1000;

const STALE_SEARCH_NO_DEADLINE_MS = 3 * 60 * 1000; // كما في resolveDisplayStatus بصفحة الطلبات
const toMs = (v) => v?.toMillis?.() ?? (v ? Date.parse(v) : NaN);

/** timed_out — أو ما زال searching بعد مهلته (تأخرت مهمة الإنهاء) والعميل رأى الرسالة */
export const isNetworkTimeoutRequest = (r) => {
  if (r?.status === 'timed_out') return true;
  if (r?.status !== 'searching') return false;
  const endsMs = toMs(r.searchEndsAt);
  if (Number.isFinite(endsMs)) return endsMs + STALE_SEARCH_GRACE_MS < Date.now();
  const sinceMs = toMs(r.updatedAt) || toMs(r.createdAt);
  return Number.isFinite(sinceMs) && sinceMs + STALE_SEARCH_NO_DEADLINE_MS < Date.now();
};

export const isNoCoverageRequest = (r) =>
  isNetworkTimeoutRequest(r) && !(Array.isArray(r.notifiedProviders) && r.notifiedProviders.length > 0);

/** إحداثيات الطلب: coordinates ثم address، بصيغة lat/lng أو latitude/longitude. null/'' و(0,0) غير صالحة */
const toCoord = (v) => (v == null || v === '' ? NaN : Number(v));
export const requestCoords = (r) => {
  for (const c of [r?.coordinates, r?.address]) {
    const lat = toCoord(c?.latitude ?? c?.lat);
    const lng = toCoord(c?.longitude ?? c?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return { lat, lng };
  }
  return null;
};

/** أقرب مدينة يغطيها نطاقها، وإلا منطقة شبكية خارج المدن */
const buildAreaLocator = (cities) => {
  const cityList = (cities || [])
    .map((c) => ({ ...c, pos: cityCoords(c) }))
    .filter((c) => c.pos);
  const areaFor = (lat, lng) => {
    // أقرب مدينة يغطي نطاقها النقطة (مدينة صغيرة أقرب لا تحجب مدينة كبيرة تغطيها)
    let covering = null;
    let coveringKm = Infinity;
    cityList.forEach((c) => {
      const d = distanceKm(lat, lng, c.pos.lat, c.pos.lng);
      if (d <= (Number(c.serviceRadius) || DEFAULT_CITY_RADIUS_KM) && d < coveringKm) {
        coveringKm = d;
        covering = c;
      }
    });
    if (covering) {
      return { key: `city:${covering.id || covering.name}`, isCity: true, label: covering.name, nearest: covering };
    }
    const gLat = Math.round(lat / GRID_DEG) * GRID_DEG;
    const gLng = Math.round(lng / GRID_DEG) * GRID_DEG;
    return { key: `grid:${gLat.toFixed(1)},${gLng.toFixed(1)}`, isCity: false };
  };
  const nearestCityTo = (lat, lng) => {
    let nearest = null;
    let nearestKm = Infinity;
    cityList.forEach((c) => {
      const d = distanceKm(lat, lng, c.pos.lat, c.pos.lng);
      if (d < nearestKm) { nearestKm = d; nearest = c; }
    });
    return nearest;
  };

  return { areaFor, nearestCityTo };
};

/** مدينة الطلب من إحداثياته — الطلب لا يحمل حقل مدينة */
export function resolveRequestCityName(request, cities) {
  const pos = requestCoords(request);
  if (!pos) return '';
  return buildAreaLocator(cities).areaFor(pos.lat, pos.lng).label || 'خارج المدن';
}

/**
 * @param {Array} requests طلبات الفترة (data + id)
 * @param {Array} cities مستندات cities (name, coordinates, serviceRadius)
 * @returns {Array<{ key, cityId, label, isCity, noNetwork, noCoverage, notAccepted, total, lat, lng, nearestCity, distanceFromCityKm }>}
 *   كل المناطق التي فيها طلبات، مرتبة تنازلياً بعدد طلبات «لا يوجد شبكة»
 */
export function groupRequestsByArea(requests, cities) {
  const { areaFor, nearestCityTo } = buildAreaLocator(cities);
  const areas = new Map();

  (requests || []).forEach((r) => {
    const pos = requestCoords(r);
    if (!pos) return;
    const { lat, lng } = pos;
    const a = areaFor(lat, lng);
    if (!areas.has(a.key)) {
      areas.set(a.key, { ...a, noNetwork: 0, noCoverage: 0, total: 0, sumLat: 0, sumLng: 0, pointCount: 0, allLat: 0, allLng: 0 });
    }
    const area = areas.get(a.key);
    area.total += 1;
    area.allLat += lat;
    area.allLng += lng;
    if (isNetworkTimeoutRequest(r)) {
      area.noNetwork += 1;
      if (!(Array.isArray(r.notifiedProviders) && r.notifiedProviders.length > 0)) area.noCoverage += 1;
      area.sumLat += lat;
      area.sumLng += lng;
      area.pointCount += 1;
    }
  });

  return [...areas.values()]
    .map((a) => {
      const lat = a.pointCount ? a.sumLat / a.pointCount : a.allLat / a.total;
      const lng = a.pointCount ? a.sumLng / a.pointCount : a.allLng / a.total;
      let label = a.label;
      let distanceFromCityKm = null;
      const nearest = a.isCity ? a.nearest : nearestCityTo(lat, lng);
      if (!a.isCity && nearest) {
        distanceFromCityKm = Math.round(distanceKm(nearest.pos.lat, nearest.pos.lng, lat, lng));
        label = `خارج المدن — ${distanceFromCityKm} كم ${directionFrom(nearest.pos.lat, nearest.pos.lng, lat, lng)} ${nearest.name}`;
      } else if (!a.isCity) {
        label = 'خارج المدن';
      }
      return {
        key: a.key,
        cityId: a.nearest?.id ?? null,
        label,
        isCity: a.isCity,
        noNetwork: a.noNetwork,
        noCoverage: a.noCoverage,
        notAccepted: a.noNetwork - a.noCoverage,
        total: a.total,
        lat,
        lng,
        nearestCity: nearest?.name || null,
        distanceFromCityKm,
      };
    })
    .sort((x, y) => y.noNetwork - x.noNetwork || y.noCoverage - x.noCoverage);
}

/** مناطق فيها طلبات «لا يوجد شبكة» فقط */
export const groupNoCoverageByArea = (requests, cities) =>
  groupRequestsByArea(requests, cities).filter((a) => a.noNetwork > 0);
