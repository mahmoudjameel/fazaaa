import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MapPin, RefreshCw, Users, Wifi, WifiOff, AlertTriangle, Navigation,
  ExternalLink, X, Filter, Crosshair, ShieldAlert,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { listenToAllProviders } from '../services/adminService';
import { db } from '../services/firebase';
import { resolveProviderWalletBalance, countProviderRemainingServices } from '../utils/providerWallet';
import { PhoneWithActions } from '../components/PhoneWithActions';
import {
  getProviderCoords,
  getProviderFreshness,
  getProviderDisplayName,
  getProviderAvailabilityLabel,
  isProviderOnline,
  isProviderApproved,
  inferLocationTrackingIssue,
  hasLocationTrackingIssue,
  getMarkerVisual,
  formatRelativeAgo,
  heartbeatSourceLabel,
  getFreshnessAgeMs,
  ACTIVE_REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  timestampToDate,
} from '../utils/providerLocation';

const SA_CENTER = [24.7136, 46.6753];
const SA_ZOOM = 6;

function makeDivIcon(color, ring) {
  const ringStyle = ring ? `box-shadow:0 0 0 3px ${ring};` : '';
  return window.L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;${ringStyle}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export const ProvidersMap = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') || '';

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [selectedId, setSelectedId] = useState(highlightId || null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [activeOrderOnly, setActiveOrderOnly] = useState(false);
  const [locationIssueOnly, setLocationIssueOnly] = useState(
    searchParams.get('locationIssue') === '1'
  );

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());

  useEffect(() => {
    const unsub = listenToAllProviders((list) => {
      setProviders(Array.isArray(list) ? list.filter((p) => !p.mergedInto) : []);
      setLoading(false);
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !window.L) return;

    const map = window.L.map(mapContainerRef.current, {
      center: SA_CENTER,
      zoom: SA_ZOOM,
      zoomControl: true,
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = window.L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markerByIdRef.current.clear();
    };
  }, []);

  const cities = useMemo(() => {
    const set = new Set();
    providers.forEach((p) => {
      const c = p.cityName || p.city;
      if (c) set.add(String(c));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers.filter((p) => {
      if (!isProviderApproved(p)) return false;
      if (onlineOnly && !isProviderOnline(p)) return false;
      if (activeOrderOnly && !(p.activeRequestId || p.isBusy)) return false;
      if (locationIssueOnly && !hasLocationTrackingIssue(p, clock)) return false;
      if (cityFilter !== 'all') {
        const c = p.cityName || p.city || '';
        if (c !== cityFilter) return false;
      }
      if (q) {
        const hay = [
          getProviderDisplayName(p),
          p.phone,
          p.cityName,
          p.city,
          p.id,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [providers, search, cityFilter, onlineOnly, activeOrderOnly, locationIssueOnly, clock]);

  const stats = useMemo(() => {
    const approved = providers.filter(isProviderApproved);
    const onMap = approved.filter((p) => getProviderCoords(p));
    return {
      total: approved.length,
      online: approved.filter(isProviderOnline).length,
      onMap: onMap.length,
      withIssue: approved.filter((p) => hasLocationTrackingIssue(p, clock)).length,
      busy: approved.filter((p) => p.activeRequestId || p.isBusy).length,
    };
  }, [providers, clock]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedId) || null,
    [providers, selectedId]
  );

  const selectProvider = useCallback((id) => {
    setSelectedId(id);
    if (id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('highlight', id);
        return next;
      }, { replace: true });
    }
  }, [setSearchParams]);

  useEffect(() => {
    if (!highlightId) return;
    setSelectedId(highlightId);
  }, [highlightId]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerByIdRef.current.clear();

    filteredProviders.forEach((p) => {
      const coords = getProviderCoords(p);
      if (!coords) return;

      const visual = getMarkerVisual(p, clock);
      const marker = window.L.marker([coords.latitude, coords.longitude], {
        icon: makeDivIcon(visual.color, visual.ring),
        title: getProviderDisplayName(p),
      });

      marker.on('click', () => selectProvider(p.id));
      marker.addTo(layer);
      markerByIdRef.current.set(p.id, marker);
    });

    if (selectedId && markerByIdRef.current.has(selectedId)) {
      const m = markerByIdRef.current.get(selectedId);
      const latlng = m.getLatLng();
      map.panTo(latlng, { animate: true });
    }
  }, [filteredProviders, clock, selectedId, selectProvider]);

  useEffect(() => {
    if (!selectedProvider?.activeRequestId) {
      setActiveRequest(null);
      return;
    }
    let cancelled = false;
    setLoadingRequest(true);
    getDoc(doc(db, 'requests', selectedProvider.activeRequestId))
      .then((snap) => {
        if (cancelled) return;
        setActiveRequest(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      })
      .catch(() => {
        if (!cancelled) setActiveRequest(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRequest(false);
      });
    return () => { cancelled = true; };
  }, [selectedProvider?.activeRequestId, selectedProvider?.id]);

  const fitAllMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = [];
    filteredProviders.forEach((p) => {
      const c = getProviderCoords(p);
      if (c) bounds.push([c.latitude, c.longitude]);
    });
    if (bounds.length === 0) {
      map.setView(SA_CENTER, SA_ZOOM);
      return;
    }
    if (bounds.length === 1) {
      map.setView(bounds[0], 12);
      return;
    }
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  };

  const focusProvider = (p) => {
    selectProvider(p.id);
    const c = getProviderCoords(p);
    if (c && mapRef.current) {
      mapRef.current.setView([c.latitude, c.longitude], 14, { animate: true });
    }
  };

  const locationIssue = selectedProvider ? inferLocationTrackingIssue(selectedProvider, clock) : null;
  const coords = selectedProvider ? getProviderCoords(selectedProvider) : null;
  const freshness = selectedProvider ? getProviderFreshness(selectedProvider, clock) : 'unknown';
  const ageMs = selectedProvider ? getFreshnessAgeMs(selectedProvider, clock) : null;
  const locationAt = selectedProvider?.locationUpdatedAt || selectedProvider?.location?.timestamp;
  const heartbeatAt = selectedProvider?.lastHeartbeat;
  const freshestTs = (() => {
    const a = timestampToDate(locationAt);
    const b = timestampToDate(heartbeatAt);
    if (a && b) return a.getTime() >= b.getTime() ? locationAt : heartbeatAt;
    return locationAt || heartbeatAt;
  })();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[560px] gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-teal-600" size={28} />
            خريطة المزودين
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            جميع المدن على خريطة واحدة — تحديث مباشر من Firestore
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fitAllMarkers}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
          >
            <Crosshair size={16} />
            عرض الكل
          </button>
          <Link
            to="/admin/providers?locationIssue=1"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 text-sm font-bold hover:bg-amber-100"
          >
            <ShieldAlert size={16} />
            فلتر مشاكل الموقع ({stats.withIssue})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'معتمدون', value: stats.total, icon: Users, color: 'text-gray-700' },
          { label: 'متصلون', value: stats.online, icon: Wifi, color: 'text-green-600' },
          { label: 'على الخريطة', value: stats.onMap, icon: MapPin, color: 'text-teal-600' },
          { label: 'مشغولون', value: stats.busy, icon: Navigation, color: 'text-blue-600' },
          { label: 'مشكلة موقع', value: stats.withIssue, icon: AlertTriangle, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center gap-2">
            <s.icon size={18} className={s.color} />
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-black text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[280px] lg:min-h-0">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <input
              type="search"
              placeholder="بحث بالاسم أو الجوال..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-teal-400 focus:outline-none text-sm"
            />
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border cursor-pointer">
                <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
                متصل فقط
              </label>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border cursor-pointer">
                <input type="checkbox" checked={activeOrderOnly} onChange={(e) => setActiveOrderOnly(e.target.checked)} />
                لديه طلب
              </label>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 cursor-pointer text-red-800 font-semibold">
                <input type="checkbox" checked={locationIssueOnly} onChange={(e) => setLocationIssueOnly(e.target.checked)} />
                مشكلة موقع
              </label>
            </div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm font-semibold"
            >
              <option value="all">جميع المدن</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <p className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</p>
            ) : filteredProviders.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">لا يوجد مزودون مطابقون</p>
            ) : (
              filteredProviders.map((p) => {
                const issue = inferLocationTrackingIssue(p, clock);
                const onMap = !!getProviderCoords(p);
                const visual = getMarkerVisual(p, clock);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => focusProvider(p)}
                    className={`w-full text-right p-3 hover:bg-teal-50 transition-colors ${selectedId === p.id ? 'bg-teal-50 border-r-4 border-teal-500' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0 border border-white shadow"
                        style={{ backgroundColor: visual.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{getProviderDisplayName(p)}</p>
                        <p className="text-xs text-gray-500">{p.cityName || p.city || '—'} · {getProviderAvailabilityLabel(p)}</p>
                        {issue && (
                          <p className="text-xs text-red-600 font-semibold mt-0.5">{issue.label}</p>
                        )}
                        {!onMap && (
                          <p className="text-xs text-gray-400">غير ظاهر على الخريطة</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Map + detail panel */}
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-[360px] lg:min-h-0">
          <div className="flex-1 relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm min-h-[280px]">
            <div ref={mapContainerRef} className="absolute inset-0 z-0" />
            <div className="absolute top-3 left-3 z-[500] bg-white/95 backdrop-blur rounded-xl px-3 py-2 text-xs shadow border flex flex-wrap gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> متاح</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> مشغول</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> غير متصل</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-red-400" /> مشكلة موقع</span>
            </div>
          </div>

          {selectedProvider && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 max-h-[42vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900">{getProviderDisplayName(selectedProvider)}</h2>
                  <p className="text-sm text-gray-500">{selectedProvider.cityName || selectedProvider.city || '—'}</p>
                </div>
                <button type="button" onClick={() => selectProvider(null)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-500">الحالة</p>
                  <p className="font-bold text-sm">{getProviderAvailabilityLabel(selectedProvider)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-500">حداثة الموقع</p>
                  <p className="font-bold text-sm">{freshness === 'fresh' ? 'حديث' : freshness === 'ok' ? 'مقبول' : freshness === 'stale' ? 'قديم' : '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-500">الرصيد</p>
                  <p className="font-bold text-sm">{resolveProviderWalletBalance(selectedProvider).toFixed(0)} ر.س</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-500">خدمات متبقية</p>
                  <p className="font-bold text-sm">{countProviderRemainingServices(selectedProvider)}</p>
                </div>
              </div>

              {locationIssue && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm">
                  <p className="font-bold flex items-center gap-2">
                    <ShieldAlert size={16} />
                    {locationIssue.label}
                  </p>
                  <p className="mt-1 text-red-800">{locationIssue.hint}</p>
                  <Link
                    to={`/admin/providers?search=${encodeURIComponent(selectedProvider.phone || '')}`}
                    className="inline-block mt-2 text-xs font-bold text-red-700 underline"
                  >
                    فتح في صفحة المزودين للتواصل
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-gray-500 mb-1">الجوال:</p>
                  <PhoneWithActions phone={selectedProvider.phone} size="sm" />
                </div>
                <p><span className="text-gray-500">آخر تحديث:</span> {formatRelativeAgo(freshestTs, clock) || '—'}</p>
                <p><span className="text-gray-500">مصدر النبض:</span> {heartbeatSourceLabel(selectedProvider.heartbeatSource)}</p>
                <p><span className="text-gray-500">حالة التطبيق:</span> {selectedProvider.clientAppState || '—'}</p>
                {coords && (
                  <p className="sm:col-span-2" dir="ltr">
                    <span className="text-gray-500">GPS:</span> {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    {coords.source === 'login' ? ' (دخول)' : ''}
                  </p>
                )}
              </div>

              {(selectedProvider.activeRequestId || selectedProvider.isBusy) && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 mb-4">
                  <p className="font-bold text-blue-900 mb-2">طلب نشط</p>
                  {loadingRequest ? (
                    <p className="text-sm text-blue-700">جاري التحميل...</p>
                  ) : activeRequest ? (
                    <div className="text-sm space-y-1">
                      <p>الخدمة: <strong>{activeRequest.serviceName || '—'}</strong></p>
                      <p>الحالة: <strong>{REQUEST_STATUS_LABELS[activeRequest.status] || activeRequest.status}</strong></p>
                      <p>الموقع: {activeRequest.location || '—'}</p>
                      <p>السعر: {activeRequest.servicePrice ?? '—'} ر.س</p>
                      <Link
                        to={`/admin/orders?search=${activeRequest.id}`}
                        className="inline-flex items-center gap-1 text-teal-700 font-bold text-xs mt-2"
                      >
                        <ExternalLink size={14} />
                        فتح الطلب
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-blue-800">معرّف الطلب: {selectedProvider.activeRequestId}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {coords && (
                  <a
                    href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm font-bold"
                  >
                    <Navigation size={14} />
                    Google Maps
                  </a>
                )}
                <Link
                  to={`/admin/providers?highlight=${selectedProvider.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-teal-200 text-teal-800 text-sm font-bold"
                >
                  <ExternalLink size={14} />
                  ملف المزود
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProvidersMap;
