import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MapPin, Users, Wifi, AlertTriangle, Navigation,
  ExternalLink, X, Filter, Crosshair, ShieldAlert, Maximize2, Minimize2, UserRound,
  Bell, Send, Loader2,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { listenToAllProviders, listenToActiveMapRequests, sendAdminPushToProviders } from '../services/adminService';
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
  getProviderAppRuntimeStatus,
  isProviderMissingBackground,
  clientAppStateLabel,
  REQUEST_STATUS_LABELS,
  timestampToDate,
} from '../utils/providerLocation';

const SA_CENTER = [24.7136, 46.6753];
const SA_ZOOM = 6;

const PUSH_TEMPLATES = [
  {
    id: 'enable_always_location',
    title: 'فعّل الموقع دائماً',
    message:
      'مرحباً، لاستقبال الطلبات بشكل صحيح يرجى فتح تطبيق فزاعين وتفعيل صلاحية الموقع «دائماً / أثناء استخدام التطبيق وفي الخلفية»، ثم اترك التطبيق يعمل في الخلفية.',
  },
  {
    id: 'open_app_go_online',
    title: 'افتح التطبيق وحدّث حالتك',
    message:
      'نلاحظ أن التطبيق غير نشط في الخلفية. افتح تطبيق فزاعين الآن، فعّل حالتك إلى «متاح»، وتأكد من تشغيل الموقع والإشعارات.',
  },
  {
    id: 'enable_notifications',
    title: 'فعّل الإشعارات',
    message:
      'لتصلك طلبات الطوارئ فوراً، فعّل إشعارات تطبيق فزاعين من إعدادات الجوال، واترك التطبيق مسموحاً بالعمل في الخلفية.',
  },
  {
    id: 'battery_unrestricted',
    title: 'أزل تقييد البطارية',
    message:
      'قد يمنع نظام أندرويد التطبيق في الخلفية. من إعدادات البطارية اختر «بدون قيود» لتطبيق فزاعين، ثم افتح التطبيق مرة أخرى.',
  },
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateLabel(text, max = 16) {
  const s = String(text || '').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function getRequestCustomerCoords(request) {
  if (!request) return null;
  const candidates = [
    request.coordinates,
    request.customerLocation,
    request.locationCoordinates,
    request.customerCoordinates,
  ];
  for (const c of candidates) {
    const lat = Number(c?.latitude ?? c?.lat);
    const lng = Number(c?.longitude ?? c?.lng ?? c?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

function getRequestCustomerName(request) {
  return (
    request?.customerName
    || [request?.customerFirstName, request?.customerLastName].filter(Boolean).join(' ').trim()
    || request?.customerPhone
    || 'عميل'
  );
}

/** أيقونة مزود: شارة «مزود» + الاسم فوق نقطة ملونة */
function makeProviderDivIcon({ color, ring, name, selected = false, showLabel = true }) {
  const size = selected ? 18 : 14;
  const ringStyle = ring
    ? `box-shadow:0 0 0 ${selected ? 4 : 3}px ${ring};`
    : 'box-shadow:0 1px 4px rgba(0,0,0,0.35);';
  const pulse = selected ? 'animation:pm-pulse 1.5s ease-in-out infinite;' : '';
  const labelHtml = showLabel
    ? `<div class="pm-label pm-label-provider" style="${selected ? 'transform:scale(1.05);border-color:#0D9488;' : ''}">
         <span class="pm-badge pm-badge-provider">مزود</span>
         <span class="pm-name">${escapeHtml(truncateLabel(name, selected ? 22 : 14))}</span>
       </div>`
    : '';

  const width = showLabel ? 150 : size + 8;
  const height = showLabel ? 52 : size + 8;
  const anchorX = showLabel ? Math.round(width / 2) : Math.round((size + 8) / 2);
  const anchorY = showLabel ? height - 2 : Math.round((size + 8) / 2);

  return window.L.divIcon({
    className: 'provider-map-marker',
    html: `<div class="pm-marker-wrap" style="width:${width}px;height:${height}px;">
      ${labelHtml}
      <div class="pm-dot" style="width:${size}px;height:${size}px;background:${color};${ringStyle}${pulse}"></div>
    </div>`,
    iconSize: [width, height],
    iconAnchor: [anchorX, anchorY],
  });
}

/** أيقونة عميل: شكل مختلف + شارة «عميل» + الاسم */
function makeCustomerDivIcon({ name, selected = false, showLabel = true }) {
  const size = selected ? 18 : 14;
  const labelHtml = showLabel
    ? `<div class="pm-label pm-label-customer" style="${selected ? 'transform:scale(1.05);border-color:#6D28D9;' : ''}">
         <span class="pm-badge pm-badge-customer">عميل</span>
         <span class="pm-name">${escapeHtml(truncateLabel(name, selected ? 22 : 14))}</span>
       </div>`
    : '';

  const width = showLabel ? 150 : size + 8;
  const height = showLabel ? 52 : size + 8;
  const anchorX = showLabel ? Math.round(width / 2) : Math.round((size + 8) / 2);
  const anchorY = showLabel ? height - 2 : Math.round((size + 8) / 2);

  return window.L.divIcon({
    className: 'provider-map-marker',
    html: `<div class="pm-marker-wrap" style="width:${width}px;height:${height}px;">
      ${labelHtml}
      <div class="pm-dot pm-dot-customer" style="width:${size}px;height:${size}px;${selected ? 'animation:pm-pulse 1.5s ease-in-out infinite;' : ''}"></div>
    </div>`,
    iconSize: [width, height],
    iconAnchor: [anchorX, anchorY],
  });
}

function buildProviderPopupHtml(provider, clock) {
  const name = escapeHtml(getProviderDisplayName(provider));
  const city = escapeHtml(provider.cityName || provider.city || '—');
  const status = escapeHtml(getProviderAvailabilityLabel(provider));
  const issue = inferLocationTrackingIssue(provider, clock);
  const issueHtml = issue
    ? `<p style="margin:6px 0 0;color:#dc2626;font-size:11px;font-weight:700">${escapeHtml(issue.label)}</p>`
    : '';
  return `
    <div style="font-family:Cairo,system-ui,sans-serif;min-width:200px;max-width:260px;text-align:right;direction:rtl;line-height:1.4">
      <span style="display:inline-block;background:#CCFBF1;color:#0F766E;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;margin-bottom:6px">مزود</span>
      <p style="margin:0;font-size:16px;font-weight:900;color:#111827">${name}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${city} · ${status}</p>
      ${issueHtml}
    </div>
  `;
}

function buildCustomerPopupHtml(request) {
  const name = escapeHtml(getRequestCustomerName(request));
  const status = escapeHtml(REQUEST_STATUS_LABELS[request.status] || request.status || '—');
  const service = escapeHtml(request.serviceName || '—');
  const loc = escapeHtml(request.location || '—');
  return `
    <div style="font-family:Cairo,system-ui,sans-serif;min-width:200px;max-width:260px;text-align:right;direction:rtl;line-height:1.4">
      <span style="display:inline-block;background:#EDE9FE;color:#6D28D9;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;margin-bottom:6px">عميل</span>
      <p style="margin:0;font-size:16px;font-weight:900;color:#111827">${name}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${service} · ${status}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF">${loc}</p>
    </div>
  `;
}

export const ProvidersMap = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') || '';

  const [providers, setProviders] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [selectedId, setSelectedId] = useState(highlightId || null);
  const [selectedKind, setSelectedKind] = useState('provider'); // provider | customer
  const [activeRequest, setActiveRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [activeOrderOnly, setActiveOrderOnly] = useState(false);
  const [locationIssueOnly, setLocationIssueOnly] = useState(
    searchParams.get('locationIssue') === '1'
  );
  const [noBackgroundOnly, setNoBackgroundOnly] = useState(
    searchParams.get('noBackground') === '1'
  );
  const [entityFilter, setEntityFilter] = useState('all'); // all | providers | customers
  const [showNameLabels, setShowNameLabels] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mapZoom, setMapZoom] = useState(SA_ZOOM);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushScope, setPushScope] = useState('filtered'); // filtered | selected
  const [selectedTemplateId, setSelectedTemplateId] = useState(PUSH_TEMPLATES[0].id);
  const [customTitle, setCustomTitle] = useState(PUSH_TEMPLATES[0].title);
  const [customMessage, setCustomMessage] = useState(PUSH_TEMPLATES[0].message);
  const [sendingPush, setSendingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());
  const openPopupIdRef = useRef(null);
  const didAutoFitRef = useRef(false);

  useEffect(() => {
    const unsubProviders = listenToAllProviders((list) => {
      setProviders(Array.isArray(list) ? list.filter((p) => !p.mergedInto) : []);
      setLoading(false);
    });
    const unsubRequests = listenToActiveMapRequests((list) => {
      setActiveRequests(Array.isArray(list) ? list : []);
    });
    return () => {
      unsubProviders?.();
      unsubRequests?.();
    };
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

    map.on('zoomend', () => setMapZoom(map.getZoom()));

    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.off('zoomend');
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
    if (entityFilter === 'customers') return [];
    const q = search.trim().toLowerCase();
    return providers.filter((p) => {
      if (!isProviderApproved(p)) return false;
      if (onlineOnly && !isProviderOnline(p)) return false;
      if (activeOrderOnly && !(p.activeRequestId || p.isBusy)) return false;
      if (locationIssueOnly && !hasLocationTrackingIssue(p, clock)) return false;
      if (noBackgroundOnly && !isProviderMissingBackground(p, clock)) return false;
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
  }, [providers, search, cityFilter, onlineOnly, activeOrderOnly, locationIssueOnly, noBackgroundOnly, entityFilter, clock]);

  const filteredCustomers = useMemo(() => {
    if (entityFilter === 'providers') return [];
    const q = search.trim().toLowerCase();
    return activeRequests.filter((r) => {
      if (!getRequestCustomerCoords(r)) return false;
      if (cityFilter !== 'all') {
        const loc = String(r.location || r.cityName || r.city || '');
        if (!loc.includes(cityFilter)) return false;
      }
      if (q) {
        const hay = [
          getRequestCustomerName(r),
          r.customerPhone,
          r.location,
          r.serviceName,
          r.id,
          r.orderNumber,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeRequests, search, cityFilter, entityFilter]);

  const labelsEnabled = showNameLabels && (mapZoom >= 10 || filteredProviders.length + filteredCustomers.length <= 60);

  const stats = useMemo(() => {
    const approved = providers.filter(isProviderApproved);
    const onMap = approved.filter((p) => getProviderCoords(p));
    return {
      total: approved.length,
      online: approved.filter(isProviderOnline).length,
      onMap: onMap.length,
      withIssue: approved.filter((p) => hasLocationTrackingIssue(p, clock)).length,
      noBackground: approved.filter((p) => isProviderMissingBackground(p, clock)).length,
      busy: approved.filter((p) => p.activeRequestId || p.isBusy).length,
      customers: activeRequests.filter((r) => getRequestCustomerCoords(r)).length,
    };
  }, [providers, activeRequests, clock]);

  const pushTargetProviders = useMemo(() => {
    if (pushScope === 'selected' && selectedKind === 'provider' && selectedId) {
      const p = providers.find((x) => x.id === selectedId);
      return p ? [p] : [];
    }
    return filteredProviders;
  }, [pushScope, selectedKind, selectedId, providers, filteredProviders]);

  const openPushModal = useCallback((scope = 'filtered') => {
    setPushScope(scope);
    setPushFeedback(null);
    const tpl = PUSH_TEMPLATES[0];
    setSelectedTemplateId(tpl.id);
    setCustomTitle(tpl.title);
    setCustomMessage(tpl.message);
    setShowPushModal(true);
  }, []);

  const applyTemplate = useCallback((templateId) => {
    const tpl = PUSH_TEMPLATES.find((t) => t.id === templateId) || PUSH_TEMPLATES[0];
    setSelectedTemplateId(tpl.id);
    setCustomTitle(tpl.title);
    setCustomMessage(tpl.message);
  }, []);

  const handleSendPush = useCallback(async () => {
    const ids = pushTargetProviders.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) {
      setPushFeedback({ type: 'error', text: 'لا يوجد مزودون للإرسال' });
      return;
    }
    if (!window.confirm(`إرسال التنبيه إلى ${ids.length} مزود؟`)) return;

    setSendingPush(true);
    setPushFeedback(null);
    try {
      const res = await sendAdminPushToProviders({
        title: customTitle,
        message: customMessage,
        providerIds: ids,
        templateId: selectedTemplateId,
      });
      setPushFeedback({
        type: 'ok',
        text: `تم جدولة الإرسال لـ ${res.count} مزود (يصل خلال ثوانٍ عبر Push)`,
      });
    } catch (err) {
      setPushFeedback({ type: 'error', text: err?.message || 'فشل الإرسال' });
    } finally {
      setSendingPush(false);
    }
  }, [pushTargetProviders, customTitle, customMessage, selectedTemplateId]);

  const selectedProvider = useMemo(
    () => (selectedKind === 'provider' ? providers.find((p) => p.id === selectedId) || null : null),
    [providers, selectedId, selectedKind]
  );

  const selectedCustomerRequest = useMemo(
    () => (selectedKind === 'customer' ? activeRequests.find((r) => r.id === selectedId) || null : null),
    [activeRequests, selectedId, selectedKind]
  );

  const selectProvider = useCallback((id, { zoom = false, kind = 'provider' } = {}) => {
    setSelectedId(id);
    setSelectedKind(kind);
    if (id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('highlight', id);
        next.set('kind', kind);
        return next;
      }, { replace: true });

      if (zoom) {
        let latlng = null;
        if (kind === 'provider') {
          const provider = providers.find((p) => p.id === id);
          const c = provider ? getProviderCoords(provider) : null;
          if (c) latlng = [c.latitude, c.longitude];
        } else {
          const req = activeRequests.find((r) => r.id === id);
          const c = req ? getRequestCustomerCoords(req) : null;
          if (c) latlng = [c.latitude, c.longitude];
        }
        const map = mapRef.current;
        if (latlng && map) {
          map.setView(latlng, Math.max(map.getZoom(), 14), { animate: true });
        }
      }
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        next.delete('kind');
        return next;
      }, { replace: true });
      openPopupIdRef.current = null;
    }
  }, [setSearchParams, providers, activeRequests]);

  useEffect(() => {
    if (!highlightId) return;
    setSelectedId(highlightId);
    const kind = searchParams.get('kind');
    if (kind === 'customer' || kind === 'provider') setSelectedKind(kind);
  }, [highlightId, searchParams]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerByIdRef.current.clear();

    filteredProviders.forEach((p) => {
      const coords = getProviderCoords(p);
      if (!coords) return;

      const isSelected = selectedKind === 'provider' && p.id === selectedId;
      const visual = getMarkerVisual(p, clock);
      const name = getProviderDisplayName(p);
      const marker = window.L.marker([coords.latitude, coords.longitude], {
        icon: makeProviderDivIcon({
          color: visual.color,
          ring: visual.ring,
          name,
          selected: isSelected,
          showLabel: labelsEnabled || isSelected,
        }),
        title: `مزود · ${name}`,
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.bindPopup(buildProviderPopupHtml(p, clock), {
        closeButton: true,
        autoPan: true,
        maxWidth: 280,
        className: 'provider-map-popup',
      });

      marker.on('click', () => {
        selectProvider(p.id, { zoom: true, kind: 'provider' });
        marker.openPopup();
        openPopupIdRef.current = `p:${p.id}`;
      });

      marker.addTo(layer);
      markerByIdRef.current.set(`p:${p.id}`, marker);
    });

    filteredCustomers.forEach((r) => {
      const coords = getRequestCustomerCoords(r);
      if (!coords) return;

      const isSelected = selectedKind === 'customer' && r.id === selectedId;
      const name = getRequestCustomerName(r);
      const marker = window.L.marker([coords.latitude, coords.longitude], {
        icon: makeCustomerDivIcon({
          name,
          selected: isSelected,
          showLabel: labelsEnabled || isSelected,
        }),
        title: `عميل · ${name}`,
        zIndexOffset: isSelected ? 1100 : 200,
      });

      marker.bindPopup(buildCustomerPopupHtml(r), {
        closeButton: true,
        autoPan: true,
        maxWidth: 280,
        className: 'provider-map-popup',
      });

      marker.on('click', () => {
        selectProvider(r.id, { zoom: true, kind: 'customer' });
        marker.openPopup();
        openPopupIdRef.current = `c:${r.id}`;
      });

      marker.addTo(layer);
      markerByIdRef.current.set(`c:${r.id}`, marker);
    });

    const selectedKey = selectedId
      ? `${selectedKind === 'customer' ? 'c' : 'p'}:${selectedId}`
      : null;

    if (selectedKey && markerByIdRef.current.has(selectedKey)) {
      const m = markerByIdRef.current.get(selectedKey);
      const latlng = m.getLatLng();
      map.panTo(latlng, { animate: true });
      if (openPopupIdRef.current !== selectedKey) {
        m.openPopup();
        openPopupIdRef.current = selectedKey;
      }
    } else if (!didAutoFitRef.current && markerByIdRef.current.size > 0) {
      didAutoFitRef.current = true;
      const bounds = [];
      markerByIdRef.current.forEach((m) => bounds.push(m.getLatLng()));
      if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    }
  }, [
    filteredProviders,
    filteredCustomers,
    clock,
    selectedId,
    selectedKind,
    selectProvider,
    labelsEnabled,
  ]);

  useEffect(() => {
    if (!selectedProvider?.activeRequestId) {
      if (selectedKind === 'provider') setActiveRequest(null);
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
  }, [selectedProvider?.activeRequestId, selectedProvider?.id, selectedKind]);

  const fitAllMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = [];
    filteredProviders.forEach((p) => {
      const c = getProviderCoords(p);
      if (c) bounds.push([c.latitude, c.longitude]);
    });
    filteredCustomers.forEach((r) => {
      const c = getRequestCustomerCoords(r);
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
    selectProvider(p.id, { zoom: true, kind: 'provider' });
    const marker = markerByIdRef.current.get(`p:${p.id}`);
    if (marker) {
      marker.openPopup();
      openPopupIdRef.current = `p:${p.id}`;
    }
  };

  const focusCustomer = (r) => {
    selectProvider(r.id, { zoom: true, kind: 'customer' });
    const marker = markerByIdRef.current.get(`c:${r.id}`);
    if (marker) {
      marker.openPopup();
      openPopupIdRef.current = `c:${r.id}`;
    }
  };

  const locationIssue = selectedProvider ? inferLocationTrackingIssue(selectedProvider, clock) : null;
  const appRuntime = selectedProvider ? getProviderAppRuntimeStatus(selectedProvider, clock) : null;
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
      ) : filteredProviders.length === 0 && filteredCustomers.length === 0 ? (
        <p className="p-6 text-center text-gray-400 text-sm">لا يوجد نتائج مطابقة</p>
      ) : (
        <>
          {entityFilter !== 'customers' && filteredProviders.map((p) => {
            const issue = inferLocationTrackingIssue(p, clock);
            const runtime = getProviderAppRuntimeStatus(p, clock);
            const onMap = !!getProviderCoords(p);
            const visual = getMarkerVisual(p, clock);
            return (
              <button
                key={`p-${p.id}`}
                type="button"
                onClick={() => focusProvider(p)}
                className={`w-full text-right p-3 hover:bg-teal-50 transition-colors ${selectedKind === 'provider' && selectedId === p.id ? 'bg-teal-50 border-r-4 border-teal-500' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-3 h-3 rounded-full mt-1 flex-shrink-0 border border-white shadow"
                    style={{ backgroundColor: visual.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">مزود</span>
                      <p className="font-bold text-gray-900 truncate">{getProviderDisplayName(p)}</p>
                    </div>
                    <p className="text-xs text-gray-500">{p.cityName || p.city || '—'} · {getProviderAvailabilityLabel(p)}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${runtime.healthy ? 'text-emerald-700' : 'text-orange-700'}`}>
                      {runtime.label}
                    </p>
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
          })}
          {entityFilter !== 'providers' && filteredCustomers.map((r) => (
            <button
              key={`c-${r.id}`}
              type="button"
              onClick={() => focusCustomer(r)}
              className={`w-full text-right p-3 hover:bg-violet-50 transition-colors ${selectedKind === 'customer' && selectedId === r.id ? 'bg-violet-50 border-r-4 border-violet-500' : ''}`}
            >
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full mt-1 flex-shrink-0 border border-white shadow bg-violet-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">عميل</span>
                    <p className="font-bold text-gray-900 truncate">{getRequestCustomerName(r)}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.serviceName || '—'} · {REQUEST_STATUS_LABELS[r.status] || r.status}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </>
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
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'providers', label: 'مزودون' },
          { id: 'customers', label: 'عملاء' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setEntityFilter(opt.id)}
            className={`py-2 rounded-xl text-xs font-black border-2 transition-colors ${
              entityFilter === opt.id
                ? opt.id === 'customers'
                  ? 'border-violet-500 bg-violet-50 text-violet-900'
                  : 'border-teal-500 bg-teal-50 text-teal-900'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
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
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-300 cursor-pointer text-orange-900 font-semibold">
          <input type="checkbox" checked={noBackgroundOnly} onChange={(e) => setNoBackgroundOnly(e.target.checked)} />
          بدون خلفية ({stats.noBackground})
        </label>
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer text-amber-900 font-semibold">
          <input type="checkbox" checked={showNameLabels} onChange={(e) => setShowNameLabels(e.target.checked)} />
          إظهار الأسماء
        </label>
      </div>
      <button
        type="button"
        onClick={() => openPushModal('filtered')}
        disabled={filteredProviders.length === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Bell size={16} />
        تنبيه Push للنتائج ({filteredProviders.length})
      </button>
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
      <div
        className={`bg-white rounded-2xl border-2 border-teal-200 shadow-2xl overflow-y-auto overscroll-contain ${
          compact
            ? 'max-h-[min(52vh,420px)] sm:max-h-[min(60vh,480px)] p-3 sm:p-4'
            : 'max-h-[min(70vh,560px)] p-4'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3 sticky top-0 bg-white z-10 pb-1">
          <div className="flex items-start gap-3 min-w-0">
            {selectedVisual && (
              <span
                className="w-4 h-4 rounded-full mt-1 flex-shrink-0 border-2 border-white shadow"
                style={{ backgroundColor: selectedVisual.color, boxShadow: selectedVisual.ring ? `0 0 0 3px ${selectedVisual.ring}` : undefined }}
              />
            )}
            <div className="min-w-0">
              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 mb-1">مزود</span>
              <h2 className={`font-black text-gray-900 leading-tight ${compact ? 'text-base sm:text-lg' : 'text-lg'}`}>
                {getProviderDisplayName(selectedProvider)}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedProvider.cityName || selectedProvider.city || '—'} · {getProviderAvailabilityLabel(selectedProvider)}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => selectProvider(null)} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0 bg-gray-50" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <p className="text-[10px] text-gray-500">الحالة</p>
            <p className="font-bold text-sm">{getProviderAvailabilityLabel(selectedProvider)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <p className="text-[10px] text-gray-500">حداثة الموقع</p>
            <p className="font-bold text-sm">{freshness === 'fresh' ? 'حديث' : freshness === 'ok' ? 'مقبول' : freshness === 'stale' ? 'قديم' : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <p className="text-[10px] text-gray-500">الرصيد</p>
            <p className="font-bold text-sm">{resolveProviderWalletBalance(selectedProvider).toFixed(0)} ر.س</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <p className="text-[10px] text-gray-500">خدمات متبقية</p>
            <p className="font-bold text-sm">{countProviderRemainingServices(selectedProvider)}</p>
          </div>
        </div>

        {appRuntime && (
          <div className={`mb-3 p-3 rounded-xl border text-sm ${
            appRuntime.healthy
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-orange-50 border-orange-200 text-orange-950'
          }`}
          >
            <p className="font-bold flex items-center gap-2">
              <Wifi size={16} />
              حالة التطبيق: {appRuntime.label}
            </p>
            <p className="mt-1 opacity-90">{appRuntime.hint}</p>
          </div>
        )}

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
          <p><span className="text-gray-500">حالة التطبيق:</span> {clientAppStateLabel(selectedProvider.clientAppState)}</p>
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

        <div className="flex flex-wrap gap-2 sticky bottom-0 bg-white pt-1">
          <button
            type="button"
            onClick={() => openPushModal('selected')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-orange-300 bg-orange-50 text-orange-900 text-sm font-bold hover:bg-orange-100"
          >
            <Bell size={14} />
            إرسال تنبيه
          </button>
          {coords && (
            <a
              href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold hover:bg-gray-50"
            >
              <Navigation size={14} />
              Google Maps
            </a>
          )}
          <Link
            to={`/admin/providers?highlight=${selectedProvider.id}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-teal-200 bg-teal-50 text-teal-800 text-sm font-bold hover:bg-teal-100"
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
            <span className="text-xs text-gray-500 hidden sm:inline">
              ({filteredProviders.length} مزود · {filteredCustomers.length} عميل)
            </span>
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
              <button
                type="button"
                onClick={() => {
                  setNoBackgroundOnly(true);
                  setEntityFilter('providers');
                  setShowFilters(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-orange-300 bg-orange-50 text-orange-900 text-sm font-bold hover:bg-orange-100"
              >
                <Bell size={16} />
                بدون خلفية ({stats.noBackground})
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

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'معتمدون', value: stats.total, icon: Users, color: 'text-gray-700' },
              { label: 'متصلون', value: stats.online, icon: Wifi, color: 'text-green-600' },
              { label: 'على الخريطة', value: stats.onMap, icon: MapPin, color: 'text-teal-600' },
              { label: 'مشغولون', value: stats.busy, icon: Navigation, color: 'text-blue-600' },
              { label: 'عملاء نشطون', value: stats.customers, icon: UserRound, color: 'text-violet-600' },
              { label: 'مشكلة موقع', value: stats.withIssue, icon: AlertTriangle, color: 'text-red-600' },
              { label: 'بدون خلفية', value: stats.noBackground, icon: Bell, color: 'text-orange-600' },
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
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-md text-gray-800 hover:bg-teal-50 hover:text-teal-700"
              >
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              {!fullscreen && (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  title="القائمة والبحث"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-md text-gray-800 hover:bg-teal-50 hover:text-teal-700 lg:hidden"
                >
                  <Filter size={18} />
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="absolute top-3 left-3 z-[500] bg-white rounded-xl px-3 py-2 text-xs shadow-md border border-gray-200 flex flex-wrap gap-x-3 gap-y-1.5 max-w-[min(92%,420px)] sm:max-w-[min(70%,520px)]">
              <span className="flex items-center gap-1 font-bold text-teal-800"><span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> مزود</span>
              <span className="flex items-center gap-1 font-bold text-violet-800"><span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> عميل</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> متاح</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> مشغول</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> غير متصل</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-red-400" /> مشكلة موقع</span>
            </div>

            {/* Detail panel overlay on map — solid card, bottom sheet on mobile */}
            {selectedProvider && (
              <div className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-3 sm:left-3 sm:right-3 z-[600] pointer-events-none p-0 sm:p-0">
                <div className="pointer-events-auto w-full sm:max-w-md md:max-w-lg sm:mr-0 sm:ml-auto rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.18)] sm:shadow-2xl">
                  {renderDetailPanel(true)}
                </div>
              </div>
            )}

            {selectedCustomerRequest && (
              <div className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-3 sm:left-3 sm:right-3 z-[600] pointer-events-none">
                <div className="pointer-events-auto w-full sm:max-w-md md:max-w-lg sm:mr-0 sm:ml-auto bg-white rounded-t-2xl sm:rounded-2xl border-2 border-violet-200 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] sm:shadow-2xl p-3 sm:p-4 max-h-[min(52vh,420px)] sm:max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain">
                  <div className="flex items-start justify-between gap-3 mb-3 sticky top-0 bg-white z-10 pb-1">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">عميل</span>
                      <h2 className="text-base sm:text-lg font-black text-gray-900 mt-1 truncate">{getRequestCustomerName(selectedCustomerRequest)}</h2>
                      <p className="text-sm text-gray-500 line-clamp-2">{selectedCustomerRequest.location || '—'}</p>
                    </div>
                    <button type="button" onClick={() => selectProvider(null)} className="p-2 rounded-lg hover:bg-gray-100 bg-gray-50 flex-shrink-0" aria-label="إغلاق">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                    <p><span className="text-gray-500">الخدمة:</span> <strong>{selectedCustomerRequest.serviceName || '—'}</strong></p>
                    <p><span className="text-gray-500">الحالة:</span> <strong>{REQUEST_STATUS_LABELS[selectedCustomerRequest.status] || selectedCustomerRequest.status}</strong></p>
                    <div className="sm:col-span-2">
                      <p className="text-gray-500 mb-1">الجوال:</p>
                      <PhoneWithActions phone={selectedCustomerRequest.customerPhone} size="sm" />
                    </div>
                  </div>
                  <Link
                    to={`/admin/orders?search=${selectedCustomerRequest.id}`}
                    className="inline-flex items-center gap-1 text-violet-700 font-bold text-sm"
                  >
                    <ExternalLink size={14} />
                    فتح الطلب
                  </Link>
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
          بحث ({filteredProviders.length + filteredCustomers.length})
        </button>
      )}

      {showPushModal && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="إغلاق"
            onClick={() => !sendingPush && setShowPushModal(false)}
          />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Bell className="text-orange-500" size={20} />
                  إرسال تنبيه Push
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  المستهدفون: <strong>{pushTargetProviders.length}</strong> مزود
                  {pushScope === 'selected' ? ' (المحدد)' : ' (نتائج الفلتر)'}
                </p>
              </div>
              <button
                type="button"
                disabled={sendingPush}
                onClick={() => setShowPushModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 bg-gray-50"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-3">
              <p className="text-xs font-bold text-gray-500 mb-2">رسائل جاهزة</p>
              <div className="flex flex-col gap-2">
                {PUSH_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl.id)}
                    className={`text-right px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${
                      selectedTemplateId === tpl.id
                        ? 'border-orange-400 bg-orange-50 text-orange-950'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-bold text-gray-500">العنوان</span>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:outline-none text-sm font-bold"
              />
            </label>

            <label className="block mb-4">
              <span className="text-xs font-bold text-gray-500">نص الرسالة</span>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:outline-none text-sm resize-y"
              />
            </label>

            {pushFeedback && (
              <div
                className={`mb-3 p-3 rounded-xl text-sm font-semibold ${
                  pushFeedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}
              >
                {pushFeedback.text}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sendingPush || pushTargetProviders.length === 0 || !customTitle.trim() || !customMessage.trim()}
                onClick={handleSendPush}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white font-black text-sm hover:bg-orange-600 disabled:opacity-50"
              >
                {sendingPush ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                إرسال الآن ({pushTargetProviders.length})
              </button>
              <button
                type="button"
                disabled={sendingPush}
                onClick={() => setShowPushModal(false)}
                className="px-4 py-3 rounded-xl border-2 border-gray-200 font-bold text-sm hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              ملاحظة: الحالة تُستنتج من نبض الموقع خلال آخر 10 دقائق. الإشعار Push يصل حتى لو التطبيق مغلق (إن كان التوكن والإشعارات مفعّلة).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvidersMap;
