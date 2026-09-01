import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MapPin, RefreshCw, Users, Wifi, WifiOff, AlertTriangle, Navigation,
  ExternalLink, X, Filter, Crosshair, ShieldAlert, Maximize2, Minimize2,
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
  ACTIVE_REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  timestampToDate,
} from '../utils/providerLocation';

const SA_CENTER = [24.7136, 46.6753];
const SA_ZOOM = 6;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeDivIcon(color, ring, selected = false) {
  const size = selected ? 18 : 14;
  const ringStyle = ring ? `box-shadow:0 0 0 ${selected ? 4 : 3}px ${ring};` : '';
  const pulse = selected ? 'animation:pm-pulse 1.5s ease-in-out infinite;' : '';
  return window.L.divIcon({
    className: selected ? 'provider-marker-selected' : '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;${ringStyle}${pulse}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildMarkerPopupHtml(provider, clock) {
  const name = escapeHtml(getProviderDisplayName(provider));
  const city = escapeHtml(provider.cityName || provider.city || '—');
  const status = escapeHtml(getProviderAvailabilityLabel(provider));
  const issue = inferLocationTrackingIssue(provider, clock);
  const issueHtml = issue
    ? `<p style="margin:6px 0 0;color:#dc2626;font-size:11px;font-weight:700">${escapeHtml(issue.label)}</p>`
    : '';
  return `
    <div style="font-family:Cairo,system-ui,sans-serif;min-width:200px;max-width:260px;text-align:right;direction:rtl;line-height:1.4">
      <p style="margin:0;font-size:16px;font-weight:900;color:#111827">${name}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${city} · ${status}</p>
      ${issueHtml}
    </div>
  `;
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
  const [fullscreen, setFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());
  const openPopupIdRef = useRef(null);

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
      openPopupIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

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

  const selectProvider = useCallback((id, { zoom = false } = {}) => {
    setSelectedId(id);
    if (id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('highlight', id);
        return next;
      }, { replace: true });

      if (zoom) {
        const provider = providers.find((p) => p.id === id);
        const c = provider ? getProviderCoords(provider) : null;
        const map = mapRef.current;
        if (c && map) {
          map.setView([c.latitude, c.longitude], Math.max(map.getZoom(), 14), { animate: true });
        }
      }
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      }, { replace: true });
      openPopupIdRef.current = null;
    }
  }, [setSearchParams, providers]);

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

      const isSelected = p.id === selectedId;
      const visual = getMarkerVisual(p, clock);
      const marker = window.L.marker([coords.latitude, coords.longitude], {
        icon: makeDivIcon(visual.color, visual.ring, isSelected),
        title: getProviderDisplayName(p),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.bindPopup(buildMarkerPopupHtml(p, clock), {
        closeButton: true,
        autoPan: true,
        maxWidth: 280,
        className: 'provider-map-popup',
      });

      marker.on('click', () => {
        selectProvider(p.id, { zoom: true });
        marker.openPopup();
        openPopupIdRef.current = p.id;
      });

      marker.addTo(layer);
      markerByIdRef.current.set(p.id, marker);
    });

    if (selectedId && markerByIdRef.current.has(selectedId)) {
      const m = markerByIdRef.current.get(selectedId);
      const latlng = m.getLatLng();
      map.panTo(latlng, { animate: true });
      if (openPopupIdRef.current !== selectedId) {
        m.openPopup();
        openPopupIdRef.current = selectedId;
      }
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
    selectProvider(p.id, { zoom: true });
    const marker = markerByIdRef.current.get(p.id);
    if (marker) {
      marker.openPopup();
      openPopupIdRef.current = p.id;
    }
  };

  const locationIssue = selectedProvider ? inferLocationTrackingIssue(selectedProvider, clock) : null;
  const coords = selectedProvider ? getProviderCoords(selectedProvider) : null;
  const freshness = selectedProvider ? getProviderFreshness(selectedProvider, clock) : 'unknown';
  const locationAt = selectedProvider?.locationUpdatedAt || selectedProvider?.location?.timestamp;
  const heartbeatAt = selectedProvider?.lastHeartbeat;
  const freshestTs = (() => {
    const a = timestampToDate(locationAt);
    const b = timestampToDate(heartbeatAt);
    if (a && b) return a.getTime() >= b.getTime() ? locationAt : heartbeatAt;
    return locationAt || heartbeatAt;
  })();

  const selectedVisual = selectedProvider ? getMarkerVisual(selectedProvider, clock) : null;

  const renderProviderList = () => (
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
  );

  const renderFilters = () => (
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
  );

  const renderDetailPanel = (compact = false) => {
    if (!selectedProvider) return null;
    return (
      <div className={`bg-white/98 backdrop-blur rounded-2xl border border-gray-200 shadow-xl overflow-y-auto ${compact ? 'max-h-[38vh] p-3' : 'max-h-[45vh] p-4'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            {selectedVisual && (
              <span
                className="w-4 h-4 rounded-full mt-1 flex-shrink-0 border-2 border-white shadow"
                style={{ backgroundColor: selectedVisual.color, boxShadow: selectedVisual.ring ? `0 0 0 3px ${selectedVisual.ring}` : undefined }}
              />
            )}
            <div className="min-w-0">
              <h2 className={`font-black text-gray-900 leading-tight ${compact ? 'text-base' : 'text-lg'}`}>
                {getProviderDisplayName(selectedProvider)}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedProvider.cityName || selectedProvider.city || '—'} · {getProviderAvailabilityLabel(selectedProvider)}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => selectProvider(null)} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
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
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
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
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 mb-3">
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
    );
  };

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[9998] bg-gray-50 flex flex-col p-3 gap-3'
          : 'flex flex-col h-[calc(100vh-4rem)] min-h-[560px] gap-4'
      }
    >
      {fullscreen ? (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="text-teal-600 flex-shrink-0" size={22} />
            <span className="font-bold text-gray-900 truncate">خريطة المزودين — ملء الشاشة</span>
            <span className="text-xs text-gray-500 hidden sm:inline">({filteredProviders.length} مزود)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              <Filter size={15} />
              {showFilters ? 'إخفاء القائمة' : 'القائمة والبحث'}
            </button>
            <button
              type="button"
              onClick={fitAllMarkers}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
            >
              <Crosshair size={15} />
              عرض الكل
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
            >
              <Minimize2 size={15} />
              خروج
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}

      <div className={`flex-1 flex min-h-0 gap-3 ${fullscreen ? 'relative' : ''}`}>
        {/* Sidebar */}
        {(!fullscreen || showFilters) && (
          <>
            {!fullscreen && showFilters && (
              <button
                type="button"
                aria-label="إغلاق القائمة"
                className="fixed inset-0 z-[590] bg-black/30 lg:hidden"
                onClick={() => setShowFilters(false)}
              />
            )}
            <div
              className={
                fullscreen
                  ? 'absolute top-0 bottom-0 right-0 z-[600] w-full max-w-sm flex flex-col bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden'
                  : `${showFilters ? 'fixed inset-y-4 right-4 left-4 z-[600] max-w-sm mx-auto lg:mx-0 lg:relative lg:inset-auto lg:flex' : 'hidden lg:flex'} w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[280px] lg:min-h-0`
              }
            >
            {renderFilters()}
            {renderProviderList()}
            {fullscreen && (
              <div className="p-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                >
                  إغلاق القائمة
                </button>
              </div>
            )}
            {!fullscreen && showFilters && (
              <div className="p-3 border-t border-gray-100 lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                >
                  إغلاق القائمة
                </button>
              </div>
            )}
          </div>
          </>
        )}

        {/* Map */}
        <div className="flex-1 relative min-w-0 min-h-[320px]">
          <div className="absolute inset-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div ref={mapContainerRef} className="absolute inset-0 z-0" />

            {/* Map toolbar */}
            <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setFullscreen((v) => !v)}
                title={fullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/95 backdrop-blur border border-gray-200 shadow text-gray-800 hover:bg-teal-50 hover:text-teal-700"
              >
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              {!fullscreen && (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  title="القائمة والبحث"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/95 backdrop-blur border border-gray-200 shadow text-gray-800 hover:bg-teal-50 hover:text-teal-700 lg:hidden"
                >
                  <Filter size={18} />
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="absolute top-3 left-3 z-[500] bg-white/95 backdrop-blur rounded-xl px-3 py-2 text-xs shadow border flex flex-wrap gap-3 max-w-[90%]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> متاح</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> مشغول</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> غير متصل</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-red-400" /> مشكلة موقع</span>
            </div>

            {/* Selected provider banner */}
            {selectedProvider && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[500] w-[min(92%,520px)]">
                <div className="bg-white/98 backdrop-blur border-2 border-teal-400 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
                  {selectedVisual && (
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white shadow"
                      style={{ backgroundColor: selectedVisual.color }}
                    />
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-black text-gray-900 text-base sm:text-lg truncate">
                      {getProviderDisplayName(selectedProvider)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedProvider.cityName || selectedProvider.city || '—'} · {getProviderAvailabilityLabel(selectedProvider)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectProvider(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"
                    aria-label="إغلاق"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Detail panel overlay on map */}
            {selectedProvider && (
              <div className="absolute bottom-3 left-3 right-3 z-[500] pointer-events-none">
                <div className="pointer-events-auto max-w-xl mr-0 ml-auto">
                  {renderDetailPanel(true)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle when not fullscreen */}
      {!fullscreen && !showFilters && (
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="lg:hidden fixed bottom-6 left-6 z-[500] inline-flex items-center gap-2 px-4 py-3 rounded-full bg-teal-600 text-white font-bold shadow-lg"
        >
          <Filter size={18} />
          بحث ({filteredProviders.length})
        </button>
      )}
    </div>
  );
};

export default ProvidersMap;
