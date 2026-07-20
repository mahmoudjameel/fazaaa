import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Eye,
  MapPin,
  Clock,
  DollarSign,
  Star,
  AlertCircle,
  XCircle,
  User,
  Phone,
  Package,
  CheckCircle,
  X,
  Mail,
  Filter,
  ShoppingBag,
  ChevronRight,
  Target,
  Calculator,
  AlertTriangle,
  UserPlus,
  Trash2,
  Edit,
  Plus,
  Info,
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  Stethoscope,
} from 'lucide-react';
import {
  listenToAllRequests,
  getProviderById,
  getUsersBySearch,
  getProvidersBySearch,
  createManualOrder,
  updateOrderDetails,
  getAllCities
} from '../services/adminService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import SAUDI_CITIES_FALLBACK from '../services/cities.json';
import { formatOrderNumberLabel } from '../utils/orderNumber';

const MapPickerWidget = ({ coordinates, onLocationSelect }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef(null);
  const suggestionsRef = useRef(null);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`
      );
      const data = await res.json();
      return data.display_name || '';
    } catch {
      return '';
    }
  }, []);

  const placeMarker = useCallback((lat, lng, map) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = window.L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', async () => {
        const pos = markerRef.current.getLatLng();
        const addr = await reverseGeocode(pos.lat, pos.lng);
        onLocationSelect({ latitude: pos.lat, longitude: pos.lng }, addr);
      });
    }
    map.setView([lat, lng], map.getZoom() < 13 ? 15 : map.getZoom());
  }, [onLocationSelect, reverseGeocode]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultLat = coordinates?.latitude || 24.7136;
    const defaultLng = coordinates?.longitude || 46.6753;

    const map = window.L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: coordinates ? 15 : 6,
      zoomControl: true,
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    if (coordinates) {
      placeMarker(defaultLat, defaultLng, map);
    }

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      placeMarker(lat, lng, map);
      const addr = await reverseGeocode(lat, lng);
      onLocationSelect({ latitude: lat, longitude: lng }, addr);
    });

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=6&accept-language=ar&countrycodes=sa`
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (mapInstanceRef.current) {
      placeMarker(lat, lng, mapInstanceRef.current);
    }
    onLocationSelect({ latitude: lat, longitude: lng }, item.display_name || '');
    setSearchQuery(item.display_name || '');
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className="border-2 border-teal-200 rounded-xl overflow-hidden">
      <div className="p-3 bg-teal-50 relative" ref={suggestionsRef}>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" size={16} />
          <input
            type="text"
            placeholder="ابحث عن مكان... (مثلاً: الرياض، جدة، حي العليا)"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-teal-400 outline-none bg-white"
            dir="rtl"
          />
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {suggestions.map((item, idx) => (
              <button
                key={item.place_id || idx}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-right px-4 py-3 hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-0 flex items-start gap-2"
              >
                <MapPin size={14} className="text-teal-500 mt-1 shrink-0" />
                <span className="text-sm text-gray-700 leading-relaxed">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={mapContainerRef} className="w-full h-80" style={{ zIndex: 0 }} />
      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 flex items-center gap-1">
        <MapPin size={12} />
        انقر على الخريطة لتحديد الموقع، أو اسحب المؤشر، أو ابحث في مربع البحث
      </div>
    </div>
  );
};

export const Orders = () => {
  const location = useLocation();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchedUids, setMatchedUids] = useState([]);
  const [isSearchingUids, setIsSearchingUids] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [cities, setCities] = useState(SAUDI_CITIES_FALLBACK);

  const [providersDict, setProvidersDict] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [providerOrders, setProviderOrders] = useState([]);
  const [loadingProviderOrders, setLoadingProviderOrders] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');
  const [mainServices, setMainServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [services, setServices] = useState([]);

  // Manual Order State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomerForOrder, setSelectedCustomerForOrder] = useState(null);
  const [newOrderData, setNewOrderData] = useState({
    serviceId: '',
    serviceName: '',
    serviceCategory: '',
    price: '',
    location: '',
    coordinates: null,
    cityId: '',
    notes: ''
  });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const customerSearchTimerRef = useRef(null);

  // Edit Order State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderData, setEditOrderData] = useState({
    serviceName: '',
    price: '',
    location: '',
    cancelReason: '',
    status: ''
  });

  useEffect(() => {
    // جلب المزودين لغرض حساب مسافة SLA للطلبات القديمة التي لم يُحفظ فيها الوقت
    const fetchAllProvidersForSla = async () => {
      try {
        const snap = await getDocs(collection(db, 'providers'));
        const dict = {};
        snap.forEach(d => {
          dict[d.id] = d.data();
        });
        setProvidersDict(dict);
      } catch (e) {
        console.warn('Failed to fetch providers dictionary for SLA:', e.message);
      }
    };
    fetchAllProvidersForSla();

    // Fetch Cities
    const fetchCities = async () => {
      const result = await getAllCities();
      if (result.success && result.cities.length > 0) {
        setCities(result.cities);
      }
    };
    fetchCities();

    // استخدام real-time listener بدلاً من fetch
    const unsubscribe = listenToAllRequests((reqs) => {
      setRequests(reqs);
      setLoading(false);
    });

    // جلب الخدمات الرئيسية
    fetchMainServices();
    fetchServices();

    // Deep linking from Dashboard
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status) {
      if (status === 'active') {
        setStatusFilter('active');
      } else {
        setStatusFilter(status);
      }
    }

    return () => unsubscribe();
  }, [location.search]);

  // فتح تفاصيل طلب محدد عند القدوم من الشكاوى / لوحة التحكم
  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get('orderId');
    if (!orderId) return;

    const fromList = requests.find((r) => r.id === orderId);
    if (fromList) {
      setSelectedRequest(fromList);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'requests', orderId));
        if (cancelled || !snap.exists()) return;
        setSelectedRequest({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.warn('Failed to open order from deep link:', e?.message);
      }
    })();

    return () => { cancelled = true; };
  }, [location.search, requests]);


  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'emergency-services'));
      const servicesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(servicesList);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchMainServices = async () => {
    try {
      const servicesRef = collection(db, 'emergency-services');
      const querySnapshot = await getDocs(servicesRef);
      const servicesList = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const subServices = (data.subServices || []).map((sub, i) => ({
          id: sub.id || `sub-${docSnap.id}-${i}`,
          name: sub.name || '',
          price: sub.price || 0,
          parentServiceId: docSnap.id,
          parentServiceName: data.name || '',
        }));
        servicesList.push({
          id: docSnap.id,
          serviceId: data.id || docSnap.id,
          name: data.name || '',
          subServices,
          ...data
        });
      });
      setMainServices(servicesList);
    } catch (error) {
      console.error('Error fetching main services:', error);
    }
  };

  // البحث الذكي: تحويل رقم الهاتف إلى مصفوفة من المعرفات (UIDs)
  useEffect(() => {
    const sTerm = searchTerm.trim();
    const searchDigits = sTerm.replace(/\D/g, '');

    // لا نقوم بالبحث عبر المجموعات إلا إذا كان المدخل "رقمي" وطوله كافٍ
    if (searchDigits.length < 3) {
      setMatchedUids([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUids(true);
      try {
        const [usersRes, providersRes] = await Promise.all([
          getUsersBySearch(sTerm),
          getProvidersBySearch(sTerm)
        ]);

        const uids = new Set();
        if (usersRes.success) usersRes.users.forEach(u => uids.add(u.id));
        if (providersRes.success) providersRes.providers.forEach(p => uids.add(p.id));

        setMatchedUids(Array.from(uids));
      } catch (error) {
        console.error('Smart search error:', error);
      } finally {
        setIsSearchingUids(false);
      }
    }, 500); // تأخير نصف ثانية لتقليل الضغط على قاعدة البيانات

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    filterOrders();
  }, [requests, searchTerm, statusFilter, cityFilter, serviceFilter, matchedUids]);

  // جلب بيانات العميل عند فتح Modal تفاصيل الطلب
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!selectedRequest) {
        setSelectedCustomer(null);
        return;
      }

      const userId = selectedRequest.userId || selectedRequest.customerId || selectedRequest.uid;
      if (!userId) {
        setSelectedCustomer(null);
        return;
      }

      setLoadingCustomer(true);
      try {
        const customerRef = doc(db, 'customers', userId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
          setSelectedCustomer({ id: customerSnap.id, ...customerSnap.data() });
        } else {
          setSelectedCustomer(null);
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        setSelectedCustomer(null);
      } finally {
        setLoadingCustomer(false);
      }
    };

    fetchCustomer();
  }, [selectedRequest]);

  const handleProviderClick = async (order, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    console.log('Order data:', order); // للتتبع

    // محاولة جلب providerId بطرق مختلفة
    let providerId = order.providerId || order.provider?.id;

    // إذا لم يكن موجوداً مباشرة، نبحث في history
    if (!providerId && order.history && Array.isArray(order.history)) {
      const assignedEvent = order.history.find(h =>
        (h.status === 'assigned' && h.providerId) ||
        h.providerId
      );
      if (assignedEvent && assignedEvent.providerId) {
        providerId = assignedEvent.providerId;
      }
    }

    console.log('Provider ID found:', providerId); // للتتبع

    if (!providerId) {
      // إذا لم يكن هناك providerId، نبحث عن المزود بالاسم
      if (order.providerName) {
        console.warn('Provider ID not found for provider:', order.providerName);
        alert('معرف المزود غير متوفر في بيانات الطلب. يرجى البحث عن المزود من صفحة إدارة المزودين.');
        return;
      }
      alert('بيانات المزود غير متوفرة');
      return;
    }

    setLoadingProvider(true);
    try {
      const result = await getProviderById(providerId);
      if (result.success) {
        setSelectedProvider(result.provider);
        fetchProviderOrders(providerId);
      } else {
        alert(result.error || 'فشل جلب بيانات المزود');
      }
    } catch (error) {
      console.error('Error fetching provider:', error);
      alert('حدث خطأ أثناء جلب بيانات المزود: ' + error.message);
    } finally {
      setLoadingProvider(false);
    }
  };

  const fetchProviderOrders = async (providerId) => {
    setLoadingProviderOrders(true);
    setActivityFilter('all');
    try {
      const allOrders = new Map();

      // 1) من الطلبات المحملة حالياً في الصفحة
      requests.forEach(req => {
        if (req.providerId === providerId) {
          allOrders.set(req.id, req);
        } else if (Array.isArray(req.history) && req.history.some(h => h.providerId === providerId)) {
          allOrders.set(req.id, req);
        }
      });

      // 2) جلب من requests collection
      try {
        const q1 = query(collection(db, 'requests'), where('providerId', '==', providerId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(d => {
          if (!allOrders.has(d.id)) allOrders.set(d.id, { id: d.id, ...d.data() });
        });
      } catch (e) {
        console.warn('requests query failed:', e.message);
      }
      // 3) جلب من orders collection
      try {
        const q2 = query(collection(db, 'orders'), where('providerId', '==', providerId));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(d => {
          if (!allOrders.has(d.id)) allOrders.set(d.id, { id: d.id, ...d.data() });
        });
      } catch (e) {
        console.warn('orders query failed:', e.message);
      }

      const getTs = (item) => {
        if (item.createdAt?.toMillis) return item.createdAt.toMillis();
        if (item.createdAt?.seconds) return item.createdAt.seconds * 1000;
        if (item.createdAt) return new Date(item.createdAt).getTime() || 0;
        return 0;
      };

      const sorted = [...allOrders.values()].sort((a, b) => getTs(b) - getTs(a));
      setProviderOrders(sorted);
    } catch (error) {
      console.error('Error fetching provider orders:', error);
      setProviderOrders([]);
    } finally {
      setLoadingProviderOrders(false);
    }
  };

  // دالة حساب المسافة للـ Fallback
  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const filterOrders = () => {
    let filtered = requests;
    const sTerm = searchTerm.trim();


    // 1. Filter by Service
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(req => req.serviceId === serviceFilter || req.serviceType === serviceFilter);
    }

    // 2. Filter by City
    if (cityFilter !== 'all') {
      const cityName = cities.find(c => c.id === cityFilter)?.name || cityFilter;
      filtered = filtered.filter(req => {
        const matchesId = req.cityId === cityFilter || req.city === cityFilter;
        const matchesName = req.city === cityName;
        const matchesLocation = req.location?.includes(cityName) || req.location?.includes(cityFilter);
        return matchesId || matchesName || matchesLocation;
      });
    }

    // 3. Filter by Status
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter((r) => ['searching', 'assigned', 'en_route', 'arrived', 'in_progress'].includes(r.status));
      } else if (statusFilter === 'cancelled') {
        filtered = filtered.filter((r) => r.status?.includes('canceled'));
      } else if (statusFilter === 'cancelled_by_customer') {
        filtered = filtered.filter((r) => r.status === 'canceled_by_client' || r.status === 'canceled_by_client_with_reason');
      } else if (statusFilter === 'cancelled_by_provider') {
        filtered = filtered.filter((r) => r.status === 'canceled_by_provider' || r.status === 'canceled_by_provider_with_reason');
      } else if (statusFilter === 'no_providers_timeout') {
        filtered = filtered.filter(o => {
          if (o.status === 'timed_out') return true;
          if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') {
            return false;
          }
          const wasAccepted = o.assignedAt || (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
          if (wasAccepted) return false;
          const cancelReason = o.cancelReason || (Array.isArray(o.history) ? o.history.find(h => h.cancelReason)?.cancelReason : '') || '';
          const timeoutReasons = ['لا يوجد مزودين متاحين', 'ضغط على الشبكة', 'انتهى وقت البحث', 'لايوجد شبكة متاحة', 'ضغط على الشبكة', 'نعتذر لايوجد شبكة متاحة في منطقتكم', 'نعتذر يوجد ضغط على الشبكة في الوقت الحالي'];
          return timeoutReasons.some(r => cancelReason.includes(r));
        });
      } else if (statusFilter === 'rejections_after_accept') {
        filtered = filtered.filter(o => {
          const wasAccepted = o.assignedAt || (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
          if (!wasAccepted) return false;
          const isCancelled = o.status?.includes('canceled') ||
            (Array.isArray(o.history) && o.history.some(h => h.status?.includes('canceled') || h.action?.includes('cancellation')));
          return isCancelled;
        });
      } else {
        filtered = filtered.filter((r) => r.status === statusFilter);
      }
    }

    // 4. Filter by SLA (> 15 min travel time)
    if (slaFilter !== 'all') {
      filtered = filtered.filter(req => {
        let isOver15 = false;
        
        // إذا كان وقت الوصول أو المسافة محفوظاً بشكل مسبق (الطلبات الجديدة)
        if (req.providerAcceptedDurationMin != null) {
          isOver15 = req.providerAcceptedDurationMin > 15;
        } else if (req.coordinates && req.coordinates.latitude && req.coordinates.longitude && req.providerId) {
          // Fallback للطلبات القديمة (حساب ديناميكي باستخدام موقع المزود الحالي إذا أمكن)
          const pData = providersDict[req.providerId];
          if (pData) {
            const loc = pData.locationCoordinates || pData.location || pData.coordinates;
            if (loc && (loc.latitude ?? loc.lat) && (loc.longitude ?? loc.lng)) {
              const pLat = loc.latitude ?? loc.lat;
              const pLng = loc.longitude ?? loc.lng;
              const distKm = calculateDistanceKm(req.coordinates.latitude, req.coordinates.longitude, pLat, pLng);
              const estimatedMin = Math.round((distKm / 40) * 60) || 1;
              isOver15 = estimatedMin > 15;
            }
          }
        }
        
        if (slaFilter === 'over_15') return isOver15;
        if (slaFilter === 'under_15') return !isOver15;
        return true;
      });
    }

    // 5. تطبيق البحث (Search)
    if (sTerm) {
      const searchLower = sTerm.toLowerCase();
      const normalize = (val) => String(val || '').replace(/\D/g, '');
      const normalizedSearch = normalize(sTerm);

      filtered = filtered.filter(
        (r) => {
          const matchOrder = r.orderNumber != null && String(r.orderNumber).includes(sTerm);
          const matchCustomerPhone = normalizedSearch && normalize(r.customerPhone).includes(normalizedSearch);
          const matchProviderPhone = normalizedSearch && normalize(r.providerPhone).includes(normalizedSearch);
          const matchUid = matchedUids.includes(r.customerId) ||
            matchedUids.includes(r.providerId) ||
            matchedUids.includes(r.userId) ||
            matchedUids.includes(r.uid);
          const matchText = r.id?.toLowerCase().includes(searchLower) ||
            r.customerName?.toLowerCase().includes(searchLower) ||
            r.providerName?.toLowerCase().includes(searchLower) ||
            r.serviceName?.toLowerCase().includes(searchLower);

          return matchOrder || matchCustomerPhone || matchProviderPhone || matchUid || matchText;
        }
      );
    }

    setFilteredRequests(filtered);
  };


  const handleOpenLocation = (order) => {
    if (order.coordinates) {
      const { latitude, longitude } = order.coordinates;
      window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
    } else if (order.location) {
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(order.location)}`, '_blank');
    }
  };

  const handleCustomerSearch = (term) => {
    setCustomerSearchTerm(term);
    if (customerSearchTimerRef.current) clearTimeout(customerSearchTimerRef.current);

    if (term.trim().length < 2) {
      setCustomerSearchResults([]);
      setIsSearchingCustomer(false);
      return;
    }

    setIsSearchingCustomer(true);
    customerSearchTimerRef.current = setTimeout(async () => {
      try {
        const result = await getUsersBySearch(term);
        if (result.success) {
          setCustomerSearchResults(result.users);
        }
      } catch (error) {
        console.error('Customer search error:', error);
        setCustomerSearchResults([]);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 400);
  };

  const handleCreateManualOrder = async (e) => {
    e.preventDefault();
    if (!selectedCustomerForOrder) {
      alert('الرجاء اختيار عميل أولاً');
      return;
    }

    if (!newOrderData.serviceId || !newOrderData.price) {
      alert('الرجاء تعبئة بيانات الخدمة والسعر');
      return;
    }

    try {
      let serviceName = newOrderData.serviceName;
      let serviceCategory = newOrderData.serviceCategory || '';
      if (!serviceName) {
        const mainSvc = mainServices.find(s => s.id === newOrderData.serviceId);
        if (mainSvc) {
          serviceName = mainSvc.name;
          serviceCategory = mainSvc.name;
        } else {
          for (const ms of mainServices) {
            const sub = (ms.subServices || []).find(s => s.id === newOrderData.serviceId);
            if (sub) {
              serviceName = sub.name;
              serviceCategory = ms.name;
              break;
            }
          }
        }
      }

      const orderPayload = {
        customerId: selectedCustomerForOrder.id,
        customerName: selectedCustomerForOrder.name || `${selectedCustomerForOrder.firstName || ''} ${selectedCustomerForOrder.lastName || ''}`.trim(),
        customerPhone: selectedCustomerForOrder.phone,
        serviceId: newOrderData.serviceId,
        serviceName: serviceName || 'خدمة',
        serviceCategory: serviceCategory,
        serviceType: newOrderData.serviceId,
        price: Number(newOrderData.price),
        servicePrice: Number(newOrderData.price),
        location: newOrderData.location,
        coordinates: newOrderData.coordinates || null,
        cityId: newOrderData.cityId,
        notes: newOrderData.notes,
        status: 'searching',
        providerIdsToNotify: [],
        source: 'admin_manual',
      };

      const result = await createManualOrder(orderPayload);
      if (result.success) {
        alert('تم إنشاء الطلب بنجاح');
        setIsManualModalOpen(false);
        setNewOrderData({ serviceId: '', serviceName: '', serviceCategory: '', price: '', location: '', coordinates: null, cityId: '', notes: '' });
        setSelectedCustomerForOrder(null);
        setCustomerSearchTerm('');
      }
    } catch (error) {
      alert('حدث خطأ أثناء إنشاء الطلب: ' + error.message);
    }
  };

  const handleEditClick = (order, e) => {
    if (e) e.stopPropagation();
    setEditingOrder(order);
    setEditOrderData({
      serviceName: order.serviceName || '',
      price: order.price || order.servicePrice || '',
      location: order.location || '',
      cancelReason: order.cancelReason || '',
      status: order.status || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    try {
      const newPrice = Number(editOrderData.price);
      const result = await updateOrderDetails(editingOrder.id, {
        serviceName: editOrderData.serviceName,
        price: newPrice,
        servicePrice: newPrice,
        location: editOrderData.location,
        cancelReason: editOrderData.cancelReason,
        status: editOrderData.status
      });
      if (result.success) {
        alert('تم تحديث الطلب بنجاح');
        setIsEditModalOpen(false);
      }
    } catch (error) {
      alert('حدث خطأ أثناء تحديث الطلب: ' + error.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      searching: { text: 'جاري البحث', color: 'bg-yellow-100 text-yellow-700' },
      assigned: { text: 'مقبول', color: 'bg-teal-100 text-teal-700' },
      en_route: { text: 'في الطريق', color: 'bg-blue-100 text-blue-700' },
      arrived: { text: 'وصل', color: 'bg-purple-100 text-purple-700' },
      in_progress: { text: 'قيد التنفيذ', color: 'bg-orange-100 text-orange-700' },
      pending_client_confirmation: { text: 'بانتظار تأكيد العميل', color: 'bg-yellow-100 text-yellow-700' },
      pending_review: { text: 'قيد المراجعة', color: 'bg-amber-100 text-amber-700' },
      suspended: { text: 'معلق', color: 'bg-gray-100 text-gray-700' },
      completed: { text: 'مكتمل', color: 'bg-green-100 text-green-700' },
      pending_legal_docs: { text: 'بانتظار السند', color: 'bg-orange-100 text-orange-700' },
      canceled_by_client: { text: 'ملغي من العميل', color: 'bg-red-100 text-red-700' },
      canceled_by_provider: { text: 'ملغي من المزود', color: 'bg-red-100 text-red-700' },
      canceled_by_client_with_reason: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
      canceled_by_provider_with_reason: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
      timed_out: { text: 'انتهت المهلة', color: 'bg-purple-100 text-purple-700' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const getServiceIcon = (serviceType) => {
    const icons = {
      tires: '🚗',
      battery: '🔋',
      locksmith: '🔐',
    };
    return icons[serviceType] || '📦';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-4">
        <RefreshCw className="animate-spin text-gray-400" size={36} />
        <p className="text-gray-400 font-bold text-sm">جاري تحميل الطلبات…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto" dir="rtl">

      {/* ── رأس الصفحة ── */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-teal-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={22} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">إدارة الطلبات</h1>
            <p className="text-gray-400 text-sm font-medium">عرض ومتابعة جميع طلبات الخدمة — تحديث فوري</p>
          </div>
        </div>
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all font-bold shadow-sm text-sm flex-shrink-0"
        >
          <Plus size={17} />
          إنشاء طلب يدوي
        </button>
      </div>

      {/* ── بطاقات الإحصاء — قابلة للنقر كفلتر ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          {
            key: 'active',
            label: 'قيد التنفيذ',
            icon: Clock,
            value: requests.filter(o => ['searching','assigned','en_route','arrived','in_progress','pending_legal_docs'].includes(o.status)).length,
            dot: 'bg-teal-500',
            active: 'bg-teal-600 border-teal-600 text-white',
            inactive: 'bg-white border-gray-200 hover:border-teal-300 text-gray-800',
          },
          {
            key: 'pending_review',
            label: 'قيد المراجعة',
            icon: AlertTriangle,
            value: requests.filter(o => o.status === 'pending_review').length,
            dot: 'bg-amber-500',
            active: 'bg-amber-500 border-amber-500 text-white',
            inactive: 'bg-white border-gray-200 hover:border-amber-300 text-gray-800',
          },
          {
            key: 'no_providers_timeout',
            label: 'انتهاء المهلة',
            icon: XCircle,
            value: requests.filter(o => {
              if (o.status === 'timed_out') return true;
              if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') return false;
              const wasAccepted = o.assignedAt || (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
              if (wasAccepted) return false;
              const cancelReason = o.cancelReason || (Array.isArray(o.history) ? o.history.find(h => h.cancelReason)?.cancelReason : '') || '';
              return ['لا يوجد مزودين متاحين','ضغط على الشبكة','انتهى وقت البحث','لايوجد شبكة متاحة','نعتذر لايوجد شبكة متاحة في منطقتكم'].some(r => cancelReason.includes(r));
            }).length,
            dot: 'bg-purple-500',
            active: 'bg-purple-600 border-purple-600 text-white',
            inactive: 'bg-white border-gray-200 hover:border-purple-300 text-gray-800',
          },
          {
            key: 'rejections_after_accept',
            label: 'إلغاء بعد القبول',
            icon: AlertCircle,
            value: requests.filter(o => {
              const wasAccepted = o.assignedAt || (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
              if (!wasAccepted) return false;
              return o.status?.includes('canceled') || (Array.isArray(o.history) && o.history.some(h => h.status?.includes('canceled') || h.action?.includes('cancellation')));
            }).length,
            dot: 'bg-red-500',
            active: 'bg-red-600 border-red-600 text-white',
            inactive: 'bg-white border-gray-200 hover:border-red-300 text-gray-800',
          },
          {
            key: 'completed',
            label: 'مكتملة',
            icon: CheckCircle,
            value: requests.filter(o => o.status === 'completed').length,
            dot: 'bg-green-500',
            active: 'bg-green-600 border-green-600 text-white',
            inactive: 'bg-white border-gray-200 hover:border-green-300 text-gray-800',
          },
          {
            key: 'all',
            label: 'إجمالي الطلبات',
            icon: Package,
            value: requests.length,
            dot: 'bg-blue-500',
            active: 'bg-blue-600 border-blue-600 text-white',
            inactive: 'bg-white border-gray-200 hover:border-blue-300 text-gray-800',
          },
        ].map(card => {
          const Icon = card.icon;
          const isActive = statusFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setStatusFilter(card.key)}
              className={`rounded-2xl p-4 border-2 text-right transition-all shadow-sm hover:shadow-md ${isActive ? card.active : card.inactive}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-white/60' : card.dot}`} />
                <Icon size={18} className={isActive ? 'text-white/80' : 'text-gray-400'} />
              </div>
              <p className={`text-2xl font-black leading-none mb-1.5 ${isActive ? 'text-white' : 'text-gray-800'}`}>
                {card.value}
              </p>
              <p className={`text-xs font-bold leading-tight ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                {card.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* No Providers / Timeout - Alert Section */}
      {(() => {
        const noProvidersTimeoutOrders = requests.filter(o => {
          if (o.status === 'timed_out') return true;

          // التحقق من أن الطلب ملغي من العميل
          if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') {
            return false;
          }

          // التحقق من أن الطلب لم يتم قبوله (لا يوجد assignedAt)
          const wasAccepted = o.assignedAt ||
            (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));

          if (wasAccepted) {
            return false; // تم قبوله، لا نعرضه هنا
          }

          // التحقق من سبب الإلغاء
          const cancelReason = o.cancelReason || '';
          const historyCancelReason = Array.isArray(o.history)
            ? o.history.find(h => h.cancelReason)?.cancelReason || ''
            : '';

          const reason = cancelReason || historyCancelReason;

          // الأسباب المتعلقة بعدم وجود مزودين أو انتهاء المهلة
          const timeoutReasons = [
            'لا يوجد مزودين متاحين',
            'ضغط على الشبكة',
            'انتهى وقت البحث',
            'نعتذر لايوجد شبكة متاحة في منطقتكم',
            'نعتذر يوجد ضغط على الشبكة في الوقت الحالي',
            'لايوجد شبكة متاحة',
            'ضغط على الشبكة'
          ];

          return timeoutReasons.some(r => reason.includes(r));
        });

        if (noProvidersTimeoutOrders.length > 0 && statusFilter === 'no_providers_timeout') {
          return (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <XCircle className="text-purple-600 w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-purple-800">عدم وجود مزودين وانتهاء المهلة المحددة</h3>
                    <p className="text-xs sm:text-sm text-purple-600">طلبات تم إلغاؤها بسبب عدم وجود مزودين أو انتهاء وقت البحث</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-base sm:text-lg font-bold">
                    {noProvidersTimeoutOrders.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {noProvidersTimeoutOrders.slice(0, 6).map((order) => {
                  const cancelReason = order.cancelReason ||
                    (Array.isArray(order.history)
                      ? order.history.find(h => h.cancelReason)?.cancelReason
                      : '') ||
                    'لم يتم تحديد السبب';

                  // تحديد نوع السبب
                  let reasonType = 'غير محدد';
                  let reasonColor = 'text-purple-700';

                  if (cancelReason.includes('لا يوجد مزودين') || cancelReason.includes('لايوجد شبكة') || cancelReason.includes('نعتذر لايوجد شبكة')) {
                    reasonType = 'لا يوجد مزودين في المنطقة';
                    reasonColor = 'text-red-700';
                  } else if (cancelReason.includes('ضغط على الشبكة') || order.status === 'timed_out') {
                    reasonType = order.status === 'timed_out' ? 'انتهاء مهلة البحث' : 'ضغط على الشبكة';
                    reasonColor = 'text-orange-700';
                  } else if (cancelReason.includes('انتهى وقت البحث')) {
                    reasonType = 'انتهى وقت البحث';
                    reasonColor = 'text-yellow-700';
                  }

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-lg p-4 border-l-4 border-purple-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 mb-1">
                            {order.serviceName || order.serviceType || 'خدمة'}
                          </p>
                          <p className="text-xs text-gray-600 mb-1">
                            الموقع: 
                            <button 
                              onClick={() => handleOpenLocation(order)}
                              className="mr-1 text-teal-600 font-bold hover:underline transition-all"
                            >
                              {order.location || 'غير محدد'}
                            </button>
                          </p>
                          <p className={`text-xs font-semibold mt-2 ${reasonColor}`}>
                            ⚠️ {reasonType}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(() => {
                              if (!order.createdAt) return '-';
                              let date;
                              if (order.createdAt?.toMillis) {
                                date = new Date(order.createdAt.toMillis());
                              } else if (order.createdAt?.toDate) {
                                date = order.createdAt.toDate();
                              } else if (order.createdAt?.seconds) {
                                date = new Date(order.createdAt.seconds * 1000);
                              } else {
                                date = new Date(order.createdAt);
                              }
                              return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                            })()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedRequest(order)}
                          className="text-purple-600 hover:text-purple-800 text-xs font-semibold"
                        >
                          عرض التفاصيل
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {noProvidersTimeoutOrders.length > 6 && (
                <p className="text-sm text-purple-600 mt-2 text-center">
                  و {noProvidersTimeoutOrders.length - 6} حالة أخرى...
                </p>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Rejections After Acceptance - Alert Section */}
      {(() => {
        const providerRejectionsAfterAccept = requests.filter(
          o => {
            const hadProviderCancel = o.status === 'canceled_by_provider' || o.status === 'canceled_by_provider_with_reason' ||
              (Array.isArray(o.history) && o.history.some(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason'));
            if (!hadProviderCancel) return false;
            const wasAccepted = o.assignedAt ||
              (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
            return wasAccepted;
          }
        );

        const clientRejectionsAfterAccept = requests.filter(
          o => {
            if (o.status !== 'canceled_by_client' && o.status !== 'canceled_by_client_with_reason') {
              return false;
            }
            // التحقق من أن الطلب تم قبوله أولاً
            const wasAccepted = o.assignedAt ||
              (Array.isArray(o.history) && o.history.some(h => h.status === 'assigned'));
            return wasAccepted;
          }
        );

        const allRejections = [...providerRejectionsAfterAccept, ...clientRejectionsAfterAccept];

        if (allRejections.length > 0 && statusFilter === 'rejections_after_accept') {
          return (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-600" size={24} />
                  <div>
                    <h3 className="text-lg font-bold text-red-800">الرفض والإلغاء بعد قبول الطلبات</h3>
                    <p className="text-sm text-red-600">حالات رفض المزود أو العميل بعد قبول الطلب</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-600 text-white px-4 py-2 rounded-full text-lg font-bold">
                    {providerRejectionsAfterAccept.length} مزود
                  </span>
                  <span className="bg-orange-600 text-white px-4 py-2 rounded-full text-lg font-bold">
                    {clientRejectionsAfterAccept.length} عميل
                  </span>
                </div>
              </div>

              {/* Provider Rejections */}
              {providerRejectionsAfterAccept.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <h4 className="font-semibold text-red-800">رفض المزودين ({providerRejectionsAfterAccept.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {providerRejectionsAfterAccept.slice(0, 4).map((order) => {
                      const cancelEvent = Array.isArray(order.history)
                        ? order.history.find(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                        : null;
                      const reason = order.cancelReason || cancelEvent?.cancelReason || cancelEvent?.reason || (cancelEvent?.message?.split('السبب: ')[1]) || 'لم يتم تحديد السبب';

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-xl p-4 border border-red-200 border-r-4 border-r-red-500 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 mb-1">
                                {order.serviceName || order.serviceType || 'خدمة'}
                              </p>
                              <p className="text-xs text-gray-600 mb-2">
                                المزود: {order.providerName ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleProviderClick(order, e)}
                                    className="font-semibold text-teal-600 hover:text-teal-700 underline decoration-dotted cursor-pointer"
                                  >
                                    {order.providerName}
                                  </button>
                                ) : (
                                  <span className="font-semibold">غير محدد</span>
                                )}
                              </p>
                              <div className="bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                                <p className="text-xs font-bold text-red-700 mb-0.5">سبب الإلغاء</p>
                                <p className="text-sm text-red-800">{reason}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedRequest(order)}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold flex-shrink-0"
                            >
                              عرض التفاصيل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {providerRejectionsAfterAccept.length > 4 && (
                    <p className="text-sm text-red-600 mt-2 text-center">
                      و {providerRejectionsAfterAccept.length - 4} حالة أخرى...
                    </p>
                  )}
                </div>
              )}

              {/* Client Rejections */}
              {clientRejectionsAfterAccept.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
                    <h4 className="font-semibold text-orange-800">إلغاء العملاء ({clientRejectionsAfterAccept.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {clientRejectionsAfterAccept.slice(0, 4).map((order) => {
                      const cancelEvent = Array.isArray(order.history)
                        ? order.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                        : null;
                      const reason = order.cancelReason || cancelEvent?.cancelReason || 'لم يتم تحديد السبب';

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-lg p-4 border-l-4 border-orange-500"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 mb-1">
                                {order.serviceName || order.serviceType || 'خدمة'}
                              </p>
                              <p className="text-xs text-gray-600 mb-1">
                                المزود: {order.providerName ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleProviderClick(order, e)}
                                    className="font-semibold text-teal-600 hover:text-teal-700 underline decoration-dotted cursor-pointer"
                                  >
                                    {order.providerName}
                                  </button>
                                ) : (
                                  <span className="font-semibold">غير محدد</span>
                                )}
                              </p>
                              <p className="text-xs text-orange-700 font-semibold mt-2">
                                ⚠️ السبب: {reason}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedRequest(order)}
                              className="text-orange-600 hover:text-orange-800 text-xs font-semibold"
                            >
                              عرض التفاصيل
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {clientRejectionsAfterAccept.length > 4 && (
                    <p className="text-sm text-orange-600 mt-2 text-center">
                      و {clientRejectionsAfterAccept.length - 4} حالة أخرى...
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* ── شريط الفلاتر والبحث ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 space-y-3">

        {/* صف البحث */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          <input
            type="text"
            placeholder="ابحث برقم الطلب، جوال العميل، اسم المزود، نوع الخدمة…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-teal-400 focus:bg-white focus:outline-none transition-all"
            dir="rtl"
          />
          {isSearchingUids && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <RefreshCw size={15} className="animate-spin text-teal-500" />
            </div>
          )}
        </div>

        {/* صف الفلاتر */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* الحالة */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none pr-3 pl-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="all">كل الحالات</option>
              <option value="active">قيد التنفيذ</option>
              <option value="pending_client_confirmation">بانتظار التأكيد</option>
              <option value="pending_review">قيد المراجعة</option>
              <option value="completed">مكتملة</option>
              <option value="cancelled">ملغاة (الكل)</option>
              <option value="no_providers_timeout">فشل العثور على مزود</option>
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* المدينة */}
          <div className="relative">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full appearance-none pr-3 pl-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="all">كل المدن</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* الخدمة */}
          <div className="relative">
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full appearance-none pr-3 pl-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="all">كل الخدمات</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* SLA */}
          <div className="relative">
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className={`w-full appearance-none pr-3 pl-7 py-2 border rounded-xl text-sm font-semibold focus:outline-none cursor-pointer transition-colors ${
                slaFilter !== 'all'
                  ? 'bg-red-50 border-red-300 text-red-700 focus:border-red-400'
                  : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-teal-400'
              }`}
            >
              <option value="all">كل الاستجابات (SLA)</option>
              <option value="over_15">استجابة &gt; 15 دقيقة</option>
              <option value="under_15">استجابة ≤ 15 دقيقة</option>
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── قائمة الطلبات ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm text-gray-500 font-medium">
          يعرض <strong className="text-gray-800">{filteredRequests.length}</strong> طلب
        </span>
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-teal-600 font-bold hover:underline">
            مسح البحث ✕
          </button>
        )}
      </div>

      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-14 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={28} className="text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-600 mb-1">لا توجد طلبات</h3>
            <p className="text-gray-400 text-sm">جرّب تغيير الفلاتر أو مصطلح البحث</p>
          </div>
        ) : (
          filteredRequests.map((order) => {
            const statusBadge = getStatusBadge(order.status);
            const isActive = ['searching','assigned','en_route','arrived','in_progress'].includes(order.status);
            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md ${
                  order.status === 'completed'       ? 'border-green-200' :
                  order.status === 'pending_review'  ? 'border-amber-300' :
                  order.status === 'timed_out'       ? 'border-purple-200' :
                  isActive                           ? 'border-teal-200'  :
                  order.status?.includes('canceled') ? 'border-red-200'   : 'border-gray-100'
                }`}
              >
                <div className="p-4 sm:p-5">
                  {/* ── صف الرأس: أيقونة + معلومات + سعر + أزرار ── */}
                  <div className="flex items-start gap-3">
                    {/* أيقونة الخدمة */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-teal-100' :
                      order.status === 'completed' ? 'bg-green-100' :
                      order.status === 'pending_review' ? 'bg-amber-100' :
                      order.status === 'timed_out' ? 'bg-purple-100' :
                      order.status?.includes('canceled') ? 'bg-red-50' : 'bg-gray-100'
                    }`}>
                      <ShoppingBag size={20} className={
                        isActive ? 'text-teal-600' :
                        order.status === 'completed' ? 'text-green-600' :
                        order.status === 'pending_review' ? 'text-amber-600' :
                        order.status === 'timed_out' ? 'text-purple-500' :
                        order.status?.includes('canceled') ? 'text-red-400' : 'text-gray-400'
                      } />
                    </div>

                    {/* المعلومات الرئيسية */}
                    <div className="flex-1 min-w-0">
                      {/* عنوان + رقم + شارة الحالة + تقييم */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-base font-bold text-gray-800 leading-tight">
                          {order.serviceName || order.serviceType || 'خدمة'}
                        </h3>
                        <span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                          {formatOrderNumberLabel(order.orderNumber)}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge.color}`}>
                          {statusBadge.text}
                        </span>
                        {order.status === 'completed' && (
                          <span className="flex items-center gap-0.5">
                            <Star size={13} className={order.rated ? 'fill-amber-500 text-amber-500' : 'text-gray-300'} />
                            <span className="text-xs font-semibold text-gray-600">
                              {order.rated ? `${order.rating ?? '—'}/5` : 'لم يُقيّم'}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* شريط المعلومات: مدينة + موقع + تاريخ + مزود */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {(order.city || order.cityId) && (
                          <span className="flex items-center gap-1 text-teal-600 font-semibold">
                            <MapPin size={12} className="shrink-0" />
                            {cities.find(c => c.id === order.cityId)?.name || order.city}
                          </span>
                        )}
                        {order.location && (
                          <button
                            onClick={() => handleOpenLocation(order)}
                            className="flex items-center gap-1 text-gray-500 hover:text-teal-600 transition-colors"
                          >
                            <MapPin size={12} className="shrink-0 text-gray-400" />
                            <span className="truncate max-w-[200px]">{order.location}</span>
                          </button>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="shrink-0" />
                          {(() => {
                            if (!order.createdAt) return '-';
                            let date;
                            if (order.createdAt?.toMillis) date = new Date(order.createdAt.toMillis());
                            else if (order.createdAt?.toDate) date = order.createdAt.toDate();
                            else if (order.createdAt?.seconds) date = new Date(order.createdAt.seconds * 1000);
                            else date = new Date(order.createdAt);
                            return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                          })()}
                        </span>
                        {order.providerName && (
                          <span className="flex items-center gap-1">
                            <User size={12} className="shrink-0 text-gray-400" />
                            <button
                              type="button"
                              onClick={(e) => handleProviderClick(order, e)}
                              className="text-teal-600 hover:text-teal-700 font-semibold underline decoration-dotted"
                            >
                              {order.providerName}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* السعر + الأزرار */}
                    <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
                      <div className="text-left">
                        <p className="text-xl font-black text-green-600 leading-none">
                          {order.price || 0} <span className="text-sm font-bold text-green-500">ر.س</span>
                        </p>
                        {order.status === 'completed' && order.commission != null && (
                          <p className="text-[11px] font-bold text-teal-600 mt-0.5">عمولة: {order.commission} ر.س</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedRequest(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-all text-xs font-bold border border-teal-100"
                        >
                          <Eye size={13} />
                          عرض
                        </button>
                        <button
                          onClick={(e) => handleEditClick(order, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-bold border border-gray-200"
                        >
                          <Edit size={13} />
                          تعديل
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── شريط التنبيهات: SLA + إلغاء المزود + إلغاء العميل ── */}
                  {(() => {
                    const chips = [];

                    // SLA
                    let durationMin = order.providerAcceptedDurationMin;
                    let distanceKm = order.providerAcceptedDistanceKm;
                    let isCalculated = false;
                    if (durationMin == null && order.coordinates?.latitude && order.coordinates?.longitude && order.providerId) {
                      const pData = providersDict[order.providerId];
                      if (pData) {
                        const loc = pData.locationCoordinates || pData.location || pData.coordinates;
                        if (loc && (loc.latitude ?? loc.lat) && (loc.longitude ?? loc.lng)) {
                          const pLat = loc.latitude ?? loc.lat;
                          const pLng = loc.longitude ?? loc.lng;
                          distanceKm = calculateDistanceKm(order.coordinates.latitude, order.coordinates.longitude, pLat, pLng);
                          durationMin = Math.round((distanceKm / 40) * 60) || 1;
                          isCalculated = true;
                        }
                      }
                    }
                    if (durationMin != null) {
                      const exceeded = durationMin > 15;
                      chips.push(
                        <span key="sla" className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${exceeded ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                          <Clock size={11} />
                          SLA: {durationMin} د {distanceKm != null ? `(${distanceKm.toFixed(1)} km)` : ''}{isCalculated ? ' ‎*' : ''}
                          {exceeded && <span className="text-[10px] font-black">⚠ تجاوز</span>}
                        </span>
                      );
                    }

                    // رفض المزود بعد القبول
                    const provCancelEvent = Array.isArray(order.history)
                      ? [...order.history].reverse().find(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                      : null;
                    const provReason = order.cancelReason || provCancelEvent?.cancelReason || provCancelEvent?.message?.split('السبب: ')[1];
                    const wasAcceptedProv = order.assignedAt || (Array.isArray(order.history) && order.history.some(h => h.status === 'assigned'));
                    if (provReason && wasAcceptedProv) {
                      chips.push(
                        <span key="prov-cancel" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-red-50 text-red-700 border-red-200 max-w-xs truncate">
                          ⚠ رفض المزود: {provReason}
                        </span>
                      );
                    }

                    // إلغاء العميل بعد القبول
                    if (order.status === 'canceled_by_client' || order.status === 'canceled_by_client_with_reason') {
                      const clientCancelEvent = Array.isArray(order.history)
                        ? order.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                        : null;
                      const clientReason = order.cancelReason || clientCancelEvent?.cancelReason;
                      const wasAcceptedClient = order.assignedAt || (Array.isArray(order.history) && order.history.some(h => h.status === 'assigned'));
                      if (clientReason && wasAcceptedClient) {
                        chips.push(
                          <span key="client-cancel" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-orange-50 text-orange-700 border-orange-200 max-w-xs truncate">
                            ⚠ إلغاء العميل: {clientReason}
                          </span>
                        );
                      }
                    }

                    if (chips.length === 0) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                        {chips}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Order Details Modal */}
      {
        selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    تفاصيل الطلب
                    <span className="text-sm font-normal text-gray-500">رقم {formatOrderNumberLabel(selectedRequest.orderNumber)}</span>
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        handleEditClick(selectedRequest);
                        setSelectedRequest(null);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all text-sm font-bold shadow-sm border border-blue-100"
                    >
                      <Edit size={16} />
                      تعديل الطلب
                    </button>
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
                {selectedRequest.id && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-1">معرّف Firebase (للتشخيص)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs sm:text-sm text-gray-800 break-all font-mono flex-1" dir="ltr">
                        {selectedRequest.id}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedRequest.id);
                            setCopiedRequestId(true);
                            setTimeout(() => setCopiedRequestId(false), 2000);
                          } catch {
                            alert('تعذر النسخ — انسخ النص يدوياً');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 shrink-0"
                      >
                        {copiedRequestId ? <Check size={14} /> : <Copy size={14} />}
                        {copiedRequestId ? 'تم النسخ' : 'نسخ'}
                      </button>
                      <a
                        href={`/admin/dispatch-diagnostics?requestId=${encodeURIComponent(selectedRequest.id)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg hover:bg-amber-200 shrink-0"
                      >
                        <Stethoscope size={14} />
                        تشخيص التوزيع
                      </a>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                      رقم الطلب {formatOrderNumberLabel(selectedRequest.orderNumber)} للعرض فقط؛ التشخيص يحتاج المعرّف أعلاه.
                    </p>
                  </div>
                )}
                {/* تفاصيل العميل */}
                {loadingCustomer ? (
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500">جاري تحميل بيانات العميل...</p>
                  </div>
                ) : selectedCustomer ? (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 border border-blue-200 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="text-white w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                          {selectedCustomer.firstName || ''} {selectedCustomer.lastName || ''}
                        </h3>
                        <p className="text-sm text-gray-600">العميل</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {selectedCustomer.phone && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Phone className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">رقم الجوال</h4>
                          </div>
                          <p className="text-sm text-gray-800">{selectedCustomer.phone}</p>
                        </div>
                      )}
                      {selectedCustomer.email && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">البريد الإلكتروني</h4>
                          </div>
                          <p className="text-sm text-gray-800 break-words">{selectedCustomer.email}</p>
                        </div>
                      )}
                      {selectedCustomer.city && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">المدينة</h4>
                          </div>
                          <p className="text-sm text-gray-800">{selectedCustomer.city}</p>
                        </div>
                      )}
                      {selectedCustomer.carModel && (
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="w-4 h-4 text-gray-600" />
                            <h4 className="font-semibold text-xs sm:text-sm text-gray-700">نوع السيارة</h4>
                          </div>
                          <p className="text-sm text-gray-800">{selectedCustomer.carModel}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">نوع الخدمة</h3>
                  <p className="text-sm sm:text-base text-gray-800">{selectedRequest.serviceType}</p>
                </div>
                {selectedRequest.serviceOption && (
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الخدمة المحددة</h3>
                    <p className="text-sm sm:text-base text-gray-800">{selectedRequest.serviceOption}</p>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الموقع</h3>
                  <p className="text-sm sm:text-base text-gray-800 mb-2">{selectedRequest.location || 'غير محدد'}</p>
                  {(selectedRequest.coordinates?.latitude || selectedRequest.coordinates?.lat) && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedRequest.coordinates?.latitude || selectedRequest.coordinates?.lat},${selectedRequest.coordinates?.longitude || selectedRequest.coordinates?.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all text-sm font-semibold border border-blue-200"
                    >
                      <MapPin size={16} />
                      فتح في خرائط جوجل
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-600 mb-1">سعر الخدمة</h3>
                    <p className="text-lg font-bold text-green-600">{selectedRequest.price || selectedRequest.servicePrice || 0} ر.س</p>
                  </div>
                  {selectedRequest.status === 'completed' && (
                    <div>
                      <h3 className="font-semibold text-xs sm:text-sm text-gray-600 mb-1">العمولة المستقطعة</h3>
                      <p className="text-lg font-bold text-teal-600">{selectedRequest.commission || 0} ر.س</p>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الحالة</h3>
                  <span
                    className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${getStatusBadge(selectedRequest.status).color
                      }`}
                  >
                    {getStatusBadge(selectedRequest.status).text}
                  </span>
                  {/* سبب إلغاء المزود — عرض مرتب */}
                  {(() => {
                    const cancelEvents = Array.isArray(selectedRequest.history)
                      ? selectedRequest.history.filter(h => h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                      : [];
                    const hasProviderCancel = cancelEvents.length > 0 || selectedRequest.cancelReason;
                    if (!hasProviderCancel) return null;

                    const latestCancel = cancelEvents[cancelEvents.length - 1];
                    const reason = selectedRequest.cancelReason || latestCancel?.cancelReason || latestCancel?.reason || (latestCancel?.message && latestCancel.message.includes('السبب:') ? latestCancel.message.split('السبب: ')[1] : null) || 'لم يُحدد';
                    const wasAccepted = selectedRequest.assignedAt || (Array.isArray(selectedRequest.history) && selectedRequest.history.some(h => h.status === 'assigned'));

                    return (
                      <div className="space-y-3">
                        <div className="mt-3 p-4 bg-red-50 border border-red-200 border-r-4 border-r-red-500 rounded-xl shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            <h4 className="text-base font-bold text-red-800">
                              {wasAccepted ? 'إلغاء المزود بعد قبول الطلب' : 'رفض الطلب من المزود'}
                            </h4>
                          </div>
                          <dl className="space-y-2 text-sm">
                            <div>
                              <dt className="text-red-600 font-semibold mb-0.5">سبب الإلغاء</dt>
                              <dd className="text-red-800 bg-white/60 rounded-lg px-3 py-2 border border-red-100">
                                {reason}
                              </dd>
                            </div>
                            {latestCancel?.timestamp && (
                              <div>
                                <dt className="text-red-600 font-semibold mb-0.5">وقت الإلغاء</dt>
                                <dd className="text-red-700">
                                  {format(new Date(latestCancel.timestamp), 'dd MMMM yyyy، الساعة HH:mm', { locale: ar })}
                                </dd>
                              </div>
                            )}
                            {latestCancel?.providerId && (
                              <div>
                                <dt className="text-red-600 font-semibold mb-0.5">معرف المزود</dt>
                                <dd className="text-red-700 font-mono text-xs">{latestCancel.providerId}</dd>
                              </div>
                            )}
                          </dl>
                        </div>

                        {cancelEvents.length > 1 && (
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">سجل الرفض المتكرر ({cancelEvents.length})</h4>
                            <div className="space-y-2">
                              {cancelEvents.slice(0, -1).reverse().map((event, idx) => (
                                <div key={idx} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                                  <p className="font-semibold text-gray-700">
                                    {event.cancelReason || event.reason || (event.message?.split('السبب: ')[1]) || event.message || 'تم رفض الطلب'}
                                  </p>
                                  <p className="text-gray-400 mt-0.5">
                                    {event.timestamp && format(new Date(event.timestamp), 'dd MMM، HH:mm', { locale: ar })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Completion Denial Reason - سبب رفض الانتهاء */}
                  {(selectedRequest.status === 'pending_review' && selectedRequest.pendingReviewReason) && (
                    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 border-r-4 border-r-amb-500 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <h4 className="text-base font-bold text-amber-800">
                          رفض تأكيد الانتهاء من العميل
                        </h4>
                      </div>
                      <dl className="space-y-2 text-sm">
                        <div>
                          <dt className="text-amber-600 font-semibold mb-0.5">سبب الرفض</dt>
                          <dd className="text-amber-800 bg-white/60 rounded-lg px-3 py-2 border border-amber-100">
                            {selectedRequest.pendingReviewReason}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-amber-600 font-semibold mb-0.5">الحالة الحالية</dt>
                          <dd className="text-amber-700">
                            الطلب قيد المراجعة من قبل الإدارة
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {/* Client Cancellation */}
                  {(selectedRequest.status === 'canceled_by_client' || selectedRequest.status === 'canceled_by_client_with_reason') && (
                    (() => {
                      const cancelEvent = Array.isArray(selectedRequest.history)
                        ? selectedRequest.history.find(h => h.status === 'canceled_by_client' || h.status === 'canceled_by_client_with_reason')
                        : null;
                      const reason = selectedRequest.cancelReason || cancelEvent?.cancelReason;
                      const wasAccepted = selectedRequest.assignedAt || (Array.isArray(selectedRequest.history) && selectedRequest.history.some(h => h.status === 'assigned'));

                      // 1) إذا كانت أسباب timeout/لا يوجد مزودين => استخدم بلوك الـ timeout الحالي
                      const timeoutReasons = [
                        'لا يوجد مزودين متاحين',
                        'ضغط على الشبكة',
                        'انتهى وقت البحث',
                        'نعتذر لايوجد شبكة متاحة في منطقتكم',
                        'نعتذر يوجد ضغط على الشبكة في الوقت الحالي',
                        'لايوجد شبكة متاحة',
                        'لايوجد شبكة متاحة'
                      ];

                      const isTimeoutReason =
                        selectedRequest.status === 'timed_out' ||
                        (typeof reason === 'string' && timeoutReasons.some(r => reason.includes(r)));

                      if ((selectedRequest.status === 'timed_out' || !wasAccepted) && reason && isTimeoutReason) {
                        let reasonType = 'غير محدد';
                        let bgColor = 'bg-purple-50';
                        let borderColor = 'border-purple-500';
                        let textColor = 'text-purple-800';
                        let reasonTextColor = 'text-purple-700';

                        if (reason.includes('لا يوجد مزودين') || reason.includes('لايوجد شبكة') || reason.includes('نعتذر لايوجد شبكة')) {
                          reasonType = 'لا يوجد مزودين في المنطقة';
                          bgColor = 'bg-red-50';
                          borderColor = 'border-red-500';
                          textColor = 'text-red-800';
                          reasonTextColor = 'text-red-700';
                        } else if (reason.includes('ضغط على الشبكة') || selectedRequest.status === 'timed_out') {
                          reasonType = selectedRequest.status === 'timed_out' ? 'انتهاء مهلة البحث' : 'ضغط على الشبكة';
                          bgColor = 'bg-orange-50';
                          borderColor = 'border-orange-500';
                          textColor = 'text-orange-800';
                          reasonTextColor = 'text-orange-700';
                        } else if (reason.includes('انتهى وقت البحث')) {
                          reasonType = 'انتهى وقت البحث';
                          bgColor = 'bg-yellow-50';
                          borderColor = 'border-yellow-500';
                          textColor = 'text-yellow-800';
                          reasonTextColor = 'text-yellow-700';
                        }

                        return (
                          <div className={`mt-3 p-3 ${bgColor} border-r-4 ${borderColor} rounded-lg`}>
                            <p className={`text-sm font-semibold ${textColor} mb-2`}>
                              ⚠️ عدم وجود مزودين وانتهاء المهلة المحددة
                            </p>
                            <p className={`text-sm ${reasonTextColor} mb-2`}>
                              <span className="font-semibold">نوع السبب:</span> {reasonType}
                            </p>
                            <p className={`text-sm ${reasonTextColor}`}>
                              <span className="font-semibold">السبب الكامل:</span> {reason}
                            </p>
                            {selectedRequest.cancelledAt && (
                              <p className={`text-xs ${reasonTextColor} mt-2`}>
                                وقت الإلغاء: {(() => {
                                  const date = selectedRequest.cancelledAt?.toMillis
                                    ? new Date(selectedRequest.cancelledAt.toMillis())
                                    : new Date(selectedRequest.cancelledAt);
                                  return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                })()}
                              </p>
                            )}
                          </div>
                        );
                      }

                      // 2) إلغاء العميل: اعرض السبب حتى لو لم يتم قبول الطلب (wasAccepted=false)
                      if (reason) {
                        return (
                          <div className="mt-3 p-3 bg-orange-50 border-r-4 border-orange-500 rounded-lg">
                            <p className="text-sm font-semibold text-orange-800 mb-2">
                              {wasAccepted ? '⚠️ إلغاء العميل بعد قبول الطلب' : 'إلغاء العميل'}
                            </p>
                            <p className="text-sm text-orange-700">
                              <span className="font-semibold">السبب:</span> {reason}
                            </p>
                            {selectedRequest.cancelledBy && (
                              <p className="text-xs text-orange-600 mt-2">
                                معرف العميل: {selectedRequest.cancelledBy}
                              </p>
                            )}
                            {selectedRequest.cancelledAt && (
                              <p className="text-xs text-orange-600 mt-1">
                                وقت الإلغاء: {(() => {
                                  const date = selectedRequest.cancelledAt?.toMillis
                                    ? new Date(selectedRequest.cancelledAt.toMillis())
                                    : new Date(selectedRequest.cancelledAt);
                                  return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                })()}
                              </p>
                            )}
                          </div>
                        );
                      }

                      return null;
                    })()
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">السعر الإجمالي</h3>
                    <p className="text-xl sm:text-2xl font-black text-green-600">
                      {selectedRequest.servicePrice || selectedRequest.price || 0} ر.س
                    </p>
                  </div>
                  {selectedRequest.status === 'completed' && (
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">عمولة الإدارة</h3>
                      <p className="text-xl sm:text-2xl font-black text-red-500">
                        {selectedRequest.commission || 5} ر.س
                      </p>
                    </div>
                  )}
                </div>
                {selectedRequest.status === 'completed' && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <h3 className="font-semibold text-sm text-green-800 mb-1">صافي ربح المزود</h3>
                    <p className="text-2xl font-black text-green-700">
                      {(selectedRequest.servicePrice || selectedRequest.price || 0) - (selectedRequest.commission || 5)} ر.س
                    </p>
                  </div>
                )}
                {/* Timeline Section */}
                <div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-200">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    <span>الخط الزمني للطلب</span>
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    {/* وقت الإنشاء */}
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex flex-col items-center pt-0.5 sm:pt-1 flex-shrink-0">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                        <div className="w-0.5 h-full bg-gray-300 mt-1"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base mb-1">وقت الإنشاء</p>
                        <p className="text-gray-600 text-xs sm:text-sm break-words">
                          {(() => {
                            if (!selectedRequest.createdAt) return '-';

                            let date;
                            if (selectedRequest.createdAt?.toMillis) {
                              date = new Date(selectedRequest.createdAt.toMillis());
                            } else if (selectedRequest.createdAt?.toDate) {
                              date = selectedRequest.createdAt.toDate();
                            } else if (selectedRequest.createdAt?.seconds) {
                              date = new Date(selectedRequest.createdAt.seconds * 1000);
                            } else {
                              date = new Date(selectedRequest.createdAt);
                            }

                            return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* وقت قبول المزود */}
                    {(() => {
                      const assignedAt = selectedRequest.assignedAt ||
                        (Array.isArray(selectedRequest.history)
                          ? selectedRequest.history.find(h => h.status === 'assigned' || h.action === 'assigned')?.timestamp
                          : null);

                      if (!assignedAt) return null;

                      let assignedDate;
                      if (assignedAt?.toMillis) {
                        assignedDate = new Date(assignedAt.toMillis());
                      } else if (assignedAt?.toDate) {
                        assignedDate = assignedAt.toDate();
                      } else if (assignedAt?.seconds) {
                        assignedDate = new Date(assignedAt.seconds * 1000);
                      } else {
                        assignedDate = new Date(assignedAt);
                      }

                      if (isNaN(assignedDate.getTime())) return null;

                      return (
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex flex-col items-center pt-0.5 sm:pt-1 flex-shrink-0">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                            <div className="w-0.5 h-full bg-gray-300 mt-1"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base mb-1">وقت قبول المزود</p>
                            <p className="text-gray-600 text-xs sm:text-sm break-words">
                              {format(assignedDate, 'dd MMM yyyy, HH:mm:ss', { locale: ar })}
                            </p>
                            {selectedRequest.createdAt && (() => {
                              let createdDate;
                              if (selectedRequest.createdAt?.toMillis) {
                                createdDate = new Date(selectedRequest.createdAt.toMillis());
                              } else if (selectedRequest.createdAt?.toDate) {
                                createdDate = selectedRequest.createdAt.toDate();
                              } else if (selectedRequest.createdAt?.seconds) {
                                createdDate = new Date(selectedRequest.createdAt.seconds * 1000);
                              } else {
                                createdDate = new Date(selectedRequest.createdAt);
                              }
                              if (!isNaN(createdDate.getTime())) {
                                const diffMinutes = Math.round((assignedDate - createdDate) / (1000 * 60));
                                return (
                                  <p className="text-xs text-gray-500 mt-1">
                                    (بعد {diffMinutes} دقيقة من الإنشاء)
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    })()}

                    {/* وقت التنفيذ / الإكمال */}
                    {(() => {
                      const completedAt = selectedRequest.completedAt ||
                        (Array.isArray(selectedRequest.history)
                          ? selectedRequest.history.find(h => h.status === 'completed' || h.action === 'completed')?.timestamp
                          : null);

                      if (!completedAt) return null;

                      let completedDate;
                      if (completedAt?.toMillis) {
                        completedDate = new Date(completedAt.toMillis());
                      } else if (completedAt?.toDate) {
                        completedDate = completedAt.toDate();
                      } else if (completedAt?.seconds) {
                        completedDate = new Date(completedAt.seconds * 1000);
                      } else {
                        completedDate = new Date(completedAt);
                      }

                      if (isNaN(completedDate.getTime())) return null;

                      return (
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex flex-col items-center pt-0.5 sm:pt-1 flex-shrink-0">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-teal-500 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base mb-1">وقت التنفيذ</p>
                            <p className="text-gray-600 text-xs sm:text-sm break-words">
                              {format(completedDate, 'dd MMM yyyy, HH:mm:ss', { locale: ar })}
                            </p>
                            {selectedRequest.createdAt && (() => {
                              let createdDate;
                              if (selectedRequest.createdAt?.toMillis) {
                                createdDate = new Date(selectedRequest.createdAt.toMillis());
                              } else if (selectedRequest.createdAt?.toDate) {
                                createdDate = selectedRequest.createdAt.toDate();
                              } else if (selectedRequest.createdAt?.seconds) {
                                createdDate = new Date(selectedRequest.createdAt.seconds * 1000);
                              } else {
                                createdDate = new Date(selectedRequest.createdAt);
                              }
                              if (!isNaN(createdDate.getTime())) {
                                const diffMinutes = Math.round((completedDate - createdDate) / (1000 * 60));
                                const diffHours = Math.floor(diffMinutes / 60);
                                const remainingMinutes = diffMinutes % 60;
                                const timeText = diffHours > 0
                                  ? `${diffHours} ساعة و ${remainingMinutes} دقيقة`
                                  : `${diffMinutes} دقيقة`;
                                return (
                                  <p className="text-xs text-gray-500 mt-1">
                                    (بعد {timeText} من الإنشاء)
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Rating Section */}
                {selectedRequest.rated && (
                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                    <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Star className="text-yellow-500 fill-yellow-500" size={20} />
                      تقييم العميل
                    </h3>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={20}
                          className={`${i < selectedRequest.rating
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                            }`}
                        />
                      ))}
                      <span className="mr-2 font-bold text-gray-700">
                        ({selectedRequest.rating}/5)
                      </span>
                    </div>
                    {selectedRequest.ratingComment && (
                      <p className="text-gray-600 text-sm bg-white p-3 rounded-lg border border-yellow-100 italic">
                        "{selectedRequest.ratingComment}"
                      </p>
                    )}
                    {selectedRequest.ratedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        تاريخ التقييم: {format(
                          selectedRequest.ratedAt?.toMillis
                            ? new Date(selectedRequest.ratedAt.toMillis())
                            : new Date(selectedRequest.ratedAt),
                          'dd MMM yyyy, HH:mm',
                          { locale: ar }
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* Car Plate Image */}
                {selectedRequest.carPlateImage && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">صورة لوحة السيارة</h3>
                    <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-teal-400 transition-all">
                      <img
                        src={selectedRequest.carPlateImage}
                        alt="لوحة السيارة"
                        className="w-full h-auto object-cover cursor-pointer"
                        onClick={() => window.open(selectedRequest.carPlateImage, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                        <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                      </div>
                    </div>
                    {selectedRequest.carPlateImageTimestamp && (
                      <p className="text-xs text-gray-500 mt-2">
                        تم الرفع: {format(new Date(selectedRequest.carPlateImageTimestamp), 'dd MMM yyyy, HH:mm', { locale: ar })}
                      </p>
                    )}
                  </div>
                )}

                {/* Service Documentation Images (Before/After) */}
                {(selectedRequest.serviceDocumentationBefore || selectedRequest.serviceDocumentationAfter) && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">صور توثيق الخدمة</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before Image */}
                      {selectedRequest.serviceDocumentationBefore && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">قبل الخدمة</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-orange-400 transition-all">
                            <img
                              src={selectedRequest.serviceDocumentationBefore}
                              alt="قبل الخدمة"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.serviceDocumentationBefore, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.serviceDocumentationBeforeTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.serviceDocumentationBeforeTimestamp), 'HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* After Image */}
                      {selectedRequest.serviceDocumentationAfter && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">بعد الخدمة</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-green-400 transition-all">
                            <img
                              src={selectedRequest.serviceDocumentationAfter}
                              alt="بعد الخدمة"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.serviceDocumentationAfter, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.serviceDocumentationAfterTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.serviceDocumentationAfterTimestamp), 'HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Legal Documents (Ownership Proof / Disclaimer / Lock Form) */}
                {(selectedRequest.legalOwnershipProof || selectedRequest.legalDisclaimerForm || selectedRequest.legalLockForm) && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">المستندات والنماذج</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Ownership Proof */}
                      {selectedRequest.legalOwnershipProof && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">إثبات الملكية</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-purple-400 transition-all">
                            <img
                              src={selectedRequest.legalOwnershipProof}
                              alt="إثبات الملكية"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.legalOwnershipProof, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.legalOwnershipProofTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.legalOwnershipProofTimestamp), 'dd MMM yyyy, HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Lock Opening Service Form */}
                      {selectedRequest.legalLockForm && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded">نموذج خدمة فتح السيارة</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-amber-400 transition-all">
                            <img
                              src={selectedRequest.legalLockForm}
                              alt="نموذج خدمة فتح السيارة"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.legalLockForm, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.legalLockFormTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.legalLockFormTimestamp), 'dd MMM yyyy, HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Disclaimer Form */}
                      {selectedRequest.legalDisclaimerForm && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">نموذج إخلاء المسؤولية</span>
                          </div>
                          <div className="relative group overflow-hidden rounded-xl border-2 border-gray-200 hover:border-yellow-400 transition-all">
                            <img
                              src={selectedRequest.legalDisclaimerForm}
                              alt="نموذج إخلاء المسؤولية"
                              className="w-full h-48 object-cover cursor-pointer"
                              onClick={() => window.open(selectedRequest.legalDisclaimerForm, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                            </div>
                          </div>
                          {selectedRequest.legalDisclaimerFormTimestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(selectedRequest.legalDisclaimerFormTimestamp), 'dd MMM yyyy, HH:mm', { locale: ar })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No Images Message */}
                {!selectedRequest.carPlateImage &&
                  !selectedRequest.serviceDocumentationBefore &&
                  !selectedRequest.serviceDocumentationAfter &&
                  !selectedRequest.legalOwnershipProof &&
                  !selectedRequest.legalDisclaimerForm &&
                  !selectedRequest.legalLockForm && (
                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                      <p className="text-gray-500 text-sm">لا توجد صور توثيق لهذا الطلب</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )
      }

      {/* Provider Details Modal */}
      {
        selectedProvider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">تفاصيل المزود</h2>
                  <button
                    onClick={() => setSelectedProvider(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 space-y-4">
                {loadingProvider ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">جاري التحميل...</p>
                  </div>
                ) : (
                  <>
                    {/* الاسم */}
                    <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl p-4 sm:p-5 border border-teal-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
                          <User className="text-white w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                            {selectedProvider.firstName || ''} {selectedProvider.lastName || ''}
                          </h3>
                          <p className="text-sm text-gray-600">المزود</p>
                        </div>
                      </div>
                    </div>

                    {/* معلومات التواصل */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-5 h-5 text-gray-600" />
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700">رقم الجوال</h4>
                        </div>
                        <p className="text-sm sm:text-base text-gray-800">{selectedProvider.phone || 'غير محدد'}</p>
                      </div>

                      {selectedProvider.email && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-5 h-5 text-gray-600" />
                            <h4 className="font-semibold text-sm sm:text-base text-gray-700">البريد الإلكتروني</h4>
                          </div>
                          <p className="text-sm sm:text-base text-gray-800 break-words">{selectedProvider.email}</p>
                        </div>
                      )}
                    </div>

                    {/* الحالة */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-gray-600" />
                        <h4 className="font-semibold text-sm sm:text-base text-gray-700">حالة الموافقة</h4>
                      </div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${selectedProvider.approvalStatus === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : selectedProvider.approvalStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : selectedProvider.approvalStatus === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                        {selectedProvider.approvalStatus === 'approved' ? 'موافق عليه' :
                          selectedProvider.approvalStatus === 'pending' ? 'قيد الانتظار' :
                            selectedProvider.approvalStatus === 'rejected' ? 'مرفوض' : 'غير محدد'}
                      </span>
                    </div>

                    {/* الخدمات */}
                    {selectedProvider.services && Object.keys(selectedProvider.services).length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="w-5 h-5 text-gray-600" />
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700">الخدمات</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(selectedProvider.services).map(([serviceId, serviceData]) => {
                            const isActive = serviceData === true || (serviceData && serviceData.isActive !== false);
                            // البحث عن اسم الخدمة من mainServices
                            const service = mainServices.find(s =>
                              s.id === serviceId ||
                              s.serviceId === serviceId ||
                              s.id?.toLowerCase() === serviceId?.toLowerCase()
                            );
                            const serviceName = service?.name || serviceId;

                            return (
                              <div
                                key={serviceId}
                                className={`p-3 rounded-lg border ${isActive
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-gray-50 border-gray-200'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-800 block truncate">
                                      {serviceName}
                                    </span>
                                    {service && serviceName !== serviceId && (
                                      <span className="text-xs text-gray-500 block mt-0.5 truncate">
                                        {serviceId}
                                      </span>
                                    )}
                                  </div>
                                  {isActive ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mr-2" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* سجل الطلبات والإحصائيات */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <ShoppingBag className="w-5 h-5 text-gray-600" />
                        <h4 className="font-semibold text-sm sm:text-base text-gray-700">سجل نشاط المزود</h4>
                      </div>

                      {loadingProviderOrders ? (
                        <div className="text-center py-8 text-gray-400 text-sm">جاري تحميل سجل النشاط...</div>
                      ) : (() => {
                        const COMPLETED_STATUSES = ['completed'];
                        const CANCELLED_STATUSES = ['canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_client', 'canceled_by_client_with_reason', 'timed_out'];
                        const ACTIVE_STATUSES = ['searching', 'accepted', 'assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs', 'arriving', 'pending_client_confirmation', 'pending_review'];

                        const completed = providerOrders.filter(req =>
                          COMPLETED_STATUSES.includes(req.status) && req.providerId === selectedProvider.id
                        );
                        const cancelled = providerOrders.filter(req => {
                          if (CANCELLED_STATUSES.includes(req.status)) return true;
                          return Array.isArray(req.history) && req.history.some(h =>
                            h.providerId === selectedProvider.id &&
                            (h.action === 'provider_cancellation' || CANCELLED_STATUSES.includes(h.status))
                          );
                        });
                        const active = providerOrders.filter(req =>
                          ACTIVE_STATUSES.includes(req.status) && req.providerId === selectedProvider.id
                        );

                        const filteredList = activityFilter === 'completed' ? completed
                          : activityFilter === 'cancelled' ? cancelled
                            : activityFilter === 'active' ? active
                              : providerOrders;

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-2 sm:gap-3">
                              <button
                                type="button"
                                onClick={() => setActivityFilter(activityFilter === 'all' ? 'all' : 'all')}
                                className={`p-2 sm:p-3 rounded-lg text-center transition-all border-2 ${activityFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50' : 'border-transparent bg-blue-50 hover:border-blue-200'}`}
                              >
                                <p className="text-[10px] sm:text-xs text-blue-600 font-bold mb-1">إجمالي التفاعل</p>
                                <p className="text-lg sm:text-xl font-black text-blue-800">{providerOrders.length}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityFilter(activityFilter === 'completed' ? 'all' : 'completed')}
                                className={`p-2 sm:p-3 rounded-lg text-center transition-all border-2 ${activityFilter === 'completed' ? 'border-green-400 ring-2 ring-green-200 bg-green-50' : 'border-transparent bg-green-50 hover:border-green-200'}`}
                              >
                                <p className="text-[10px] sm:text-xs text-green-600 font-bold mb-1">مكتملة</p>
                                <p className="text-lg sm:text-xl font-black text-green-800">{completed.length}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityFilter(activityFilter === 'cancelled' ? 'all' : 'cancelled')}
                                className={`p-2 sm:p-3 rounded-lg text-center transition-all border-2 ${activityFilter === 'cancelled' ? 'border-red-400 ring-2 ring-red-200 bg-red-50' : 'border-transparent bg-red-50 hover:border-red-200'}`}
                              >
                                <p className="text-[10px] sm:text-xs text-red-600 font-bold mb-1">ملغية/اعتذار</p>
                                <p className="text-lg sm:text-xl font-black text-red-800">{cancelled.length}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityFilter(activityFilter === 'active' ? 'all' : 'active')}
                                className={`p-2 sm:p-3 rounded-lg text-center transition-all border-2 ${activityFilter === 'active' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-50' : 'border-transparent bg-orange-50 hover:border-orange-200'}`}
                              >
                                <p className="text-[10px] sm:text-xs text-orange-600 font-bold mb-1">نشطة</p>
                                <p className="text-lg sm:text-xl font-black text-orange-800">{active.length}</p>
                              </button>
                            </div>

                            <div className="space-y-2">
                              <h5 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {activityFilter === 'all' ? `كل النشاطات (${filteredList.length})` :
                                  activityFilter === 'completed' ? `المكتملة (${filteredList.length})` :
                                    activityFilter === 'cancelled' ? `الملغية/الاعتذار (${filteredList.length})` :
                                      `النشطة (${filteredList.length})`}
                              </h5>
                              {filteredList.length > 0 ? (
                                filteredList.slice(0, 10).map((order, idx) => {
                                  let statusText = getStatusBadge(order.status).text;
                                  let statusColor = getStatusBadge(order.status).color;

                                  const didCancelThis = Array.isArray(order.history) && order.history.some(h =>
                                    h.providerId === selectedProvider.id &&
                                    (h.action === 'provider_cancellation' || h.status === 'canceled_by_provider' || h.status === 'canceled_by_provider_with_reason')
                                  );

                                  if (didCancelThis && order.providerId !== selectedProvider.id) {
                                    statusText = "تم الاعتذار عنه";
                                    statusColor = "bg-red-100 text-red-700";
                                  }

                                  const orderDate = order.createdAt?.toMillis
                                    ? new Date(order.createdAt.toMillis())
                                    : order.createdAt?.seconds
                                      ? new Date(order.createdAt.seconds * 1000)
                                      : order.createdAt ? new Date(order.createdAt) : null;

                                  return (
                                    <div
                                      key={order.id || idx}
                                      className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors cursor-pointer"
                                      onClick={() => {
                                        const found = requests.find(r => r.id === order.id);
                                        if (found) {
                                          setSelectedRequest(found);
                                          setSelectedProvider(null);
                                        }
                                      }}
                                    >
                                      <div className="flex-1 min-w-0 pr-2">
                                        <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{order.serviceName || order.serviceType || 'خدمة'}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          {order.location && (
                                            <button 
                                              onClick={() => handleOpenLocation(order)}
                                              className="text-[10px] text-teal-600 font-bold hover:underline truncate max-w-[120px]"
                                            >
                                              {order.location}
                                            </button>
                                          )}
                                          {orderDate && (
                                            <span className="text-[10px] text-gray-500">
                                              {format(orderDate, 'dd MMM, HH:mm', { locale: ar })}
                                            </span>
                                          )}
                                          {order.price && (
                                            <span className="text-[10px] text-teal-600 font-bold">{order.price} ر.س</span>
                                          )}
                                        </div>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusColor}`}>
                                        {statusText}
                                      </span>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-center py-4 text-xs text-gray-400 italic">لا يوجد سجل طلبات متاح</p>
                              )}
                              {filteredList.length > 10 && (
                                <p className="text-center text-xs text-gray-400 pt-1">
                                  يعرض 10 من أصل {filteredList.length} طلب
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* النوع والمجموعة */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedProvider.type && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700 mb-2">النوع</h4>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${selectedProvider.type === 'vip'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                            }`}>
                            {selectedProvider.type === 'vip' ? 'VIP' : 'عام'}
                          </span>
                        </div>
                      )}

                      {selectedProvider.createdAt && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-semibold text-sm sm:text-base text-gray-700 mb-2">تاريخ التسجيل</h4>
                          <p className="text-sm text-gray-600">
                            {(() => {
                              let date;
                              if (selectedProvider.createdAt?.toMillis) {
                                date = new Date(selectedProvider.createdAt.toMillis());
                              } else if (selectedProvider.createdAt?.toDate) {
                                date = selectedProvider.createdAt.toDate();
                              } else if (selectedProvider.createdAt?.seconds) {
                                date = new Date(selectedProvider.createdAt.seconds * 1000);
                              } else {
                                date = new Date(selectedProvider.createdAt);
                              }
                              return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy', { locale: ar });
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Manual Order Modal */}
      {
        isManualModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">إنشاء طلب يدوي جديد</h2>
                <button onClick={() => setIsManualModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateManualOrder} className="p-6 space-y-6">
                {/* Customer Search Section */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">البحث عن عميل</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، الجوال (بمقدمة أو بدونها)، الإيميل…"
                      value={customerSearchTerm}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                      className="w-full pr-10 pl-10 py-3 border-2 border-gray-200 rounded-xl focus:border-teal-400 outline-none transition-all text-sm"
                      dir="rtl"
                    />
                    {isSearchingCustomer ? (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <RefreshCw size={16} className="animate-spin text-teal-500" />
                      </div>
                    ) : customerSearchTerm.trim().length >= 2 && !isSearchingCustomer && (
                      <button
                        type="button"
                        onClick={() => { setCustomerSearchTerm(''); setCustomerSearchResults([]); }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {/* Search Results */}
                  {!selectedCustomerForOrder && customerSearchTerm.trim().length >= 2 && !isSearchingCustomer && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {customerSearchResults.length === 0 ? (
                        <div className="p-5 text-center">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <User size={18} className="text-gray-400" />
                          </div>
                          <p className="text-sm font-semibold text-gray-600">لا توجد نتائج</p>
                          <p className="text-xs text-gray-400 mt-0.5">جرّب بصيغة أخرى: الرقم بدون صفر، بـ +966، أو بالاسم كاملاً</p>
                        </div>
                      ) : (
                        <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                          <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">النتائج</span>
                            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                              {customerSearchResults.length} عميل
                            </span>
                          </div>
                          {customerSearchResults.map(customer => {
                            const displayName = customer.name ||
                              [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                              customer.displayName || 'مستخدم';
                            const initials = displayName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                            return (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerForOrder(customer);
                                  setCustomerSearchTerm(displayName);
                                  setCustomerSearchResults([]);
                                }}
                                className="w-full text-right px-4 py-3 hover:bg-teal-50 cursor-pointer flex items-center gap-3 transition-colors"
                              >
                                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-black text-teal-700">{initials || '—'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-800 text-sm truncate">{displayName}</p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    {customer.phone && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Phone size={10} className="text-gray-400" />
                                        {customer.phone}
                                      </span>
                                    )}
                                    {customer.email && (
                                      <span className="text-xs text-gray-400 truncate max-w-[160px]">
                                        {customer.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <UserPlus size={15} className="text-teal-500 flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Customer Card */}
                  {selectedCustomerForOrder && (
                    <div className="mt-2 p-3 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-teal-900">{selectedCustomerForOrder.name || 'مستخدم'}</p>
                          <p className="text-xs text-teal-700">{selectedCustomerForOrder.phone}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerForOrder(null);
                          setCustomerSearchTerm('');
                        }}
                        className="text-teal-600 hover:text-teal-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Service Details Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">اختر الخدمة</label>
                  <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-100 rounded-xl p-3">
                    {mainServices.filter(s => s.isActive !== false).map(service => (
                      <div key={service.id} className="space-y-1">
                        {/* الخدمة الرئيسية كعنوان قابل للاختيار */}
                        <button
                          type="button"
                          onClick={() => {
                            setNewOrderData({
                              ...newOrderData,
                              serviceId: service.id,
                              serviceName: service.name,
                              serviceCategory: service.name,
                              price: ''
                            });
                          }}
                          className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-between ${newOrderData.serviceId === service.id ? 'bg-teal-500 text-white shadow-md' : 'bg-gray-50 text-gray-800 hover:bg-teal-50'}`}
                        >
                          <span className="text-xs opacity-70">{service.subServices?.length || 0} خدمة فرعية</span>
                          <span>{service.name}</span>
                        </button>
                        {/* الخدمات الفرعية */}
                        {service.subServices && service.subServices.length > 0 && (
                          <div className="mr-4 space-y-1">
                            {service.subServices.map(sub => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setNewOrderData({
                                    ...newOrderData,
                                    serviceId: sub.id,
                                    serviceName: sub.name,
                                    serviceCategory: service.name,
                                    price: sub.price ? String(sub.price) : newOrderData.price
                                  });
                                }}
                                className={`w-full text-right px-4 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${newOrderData.serviceId === sub.id ? 'bg-teal-100 text-teal-800 border-2 border-teal-400 font-bold' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100'}`}
                              >
                                {sub.price > 0 && <span className="text-xs font-semibold text-green-600">{sub.price} ر.س</span>}
                                <span>{sub.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {newOrderData.serviceId && (
                    <p className="text-xs text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">
                      المحدد: <strong>{newOrderData.serviceName}</strong>
                      {newOrderData.serviceCategory && newOrderData.serviceCategory !== newOrderData.serviceName && (
                        <span className="text-gray-500"> ({newOrderData.serviceCategory})</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">السعر (ر.س)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={newOrderData.price}
                      onChange={(e) => setNewOrderData({ ...newOrderData, price: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">المدينة</label>
                    <select
                      required
                      value={newOrderData.cityId}
                      onChange={(e) => setNewOrderData({ ...newOrderData, cityId: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                    >
                      <option value="">اختر المدينة...</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* الموقع - خريطة تفاعلية + بحث مع اقتراحات */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">الموقع</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        placeholder="اكتب العنوان أو اختر من الخريطة..."
                        value={newOrderData.location}
                        onChange={(e) => setNewOrderData({ ...newOrderData, location: e.target.value })}
                        className="w-full pr-10 pl-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(!showMapPicker)}
                      className={`px-4 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${showMapPicker ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'}`}
                    >
                      <Target size={18} />
                      الخريطة
                    </button>
                  </div>
                  {newOrderData.coordinates && (
                    <p className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <CheckCircle size={14} />
                      تم تحديد الإحداثيات: {newOrderData.coordinates.latitude.toFixed(5)}, {newOrderData.coordinates.longitude.toFixed(5)}
                    </p>
                  )}
                  {showMapPicker && (
                    <MapPickerWidget
                      coordinates={newOrderData.coordinates}
                      onLocationSelect={(coords, address) => {
                        setNewOrderData(prev => ({
                          ...prev,
                          coordinates: coords,
                          location: address || prev.location || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                        }));
                      }}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">ملاحظات إضافية (اختياري)</label>
                  <textarea
                    placeholder="أي تفاصيل أخرى..."
                    value={newOrderData.notes}
                    onChange={(e) => setNewOrderData({ ...newOrderData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal outline-none transition-all h-24 resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary-teal text-white rounded-xl font-bold hover:bg-teal-600 transition-all shadow-lg shadow-teal-100"
                  >
                    إنشاء الطلب
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Order Modal */}
      {
        isEditModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">تعديل الطلب {formatOrderNumberLabel(editingOrder?.orderNumber)}</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateOrder} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">اسم الخدمة</label>
                    <input
                      type="text"
                      required
                      value={editOrderData.serviceName}
                      onChange={(e) => setEditOrderData({ ...editOrderData, serviceName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">السعر (ر.س)</label>
                    <input
                      type="number"
                      required
                      value={editOrderData.price}
                      onChange={(e) => setEditOrderData({ ...editOrderData, price: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">الموقع</label>
                  <input
                    type="text"
                    required
                    value={editOrderData.location}
                    onChange={(e) => setEditOrderData({ ...editOrderData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">الحالة</label>
                  <select
                    value={editOrderData.status}
                    onChange={(e) => setEditOrderData({ ...editOrderData, status: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-blue outline-none transition-all"
                  >
                    <option value="searching">جاري البحث</option>
                    <option value="assigned">تم التعيين</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="pending_client_confirmation">بانتظار تأكيد العميل</option>
                    <option value="pending_review">قيد المراجعة</option>
                    <option value="completed">مكتمل</option>
                    <option value="canceled_by_client">ملغي من العميل</option>
                    <option value="canceled_by_provider">ملغي من المزود</option>
                    <option value="canceled_by_provider_with_reason">ملغي من المزود (بسبب)</option>
                  </select>
                </div>

                {editOrderData.status.includes('canceled') && (
                  <div className="space-y-2 animate-fadeIn">
                    <label className="block text-sm font-semibold text-red-700 font-bold">سبب الإلغاء</label>
                    <textarea
                      required
                      placeholder="اكتب سبب الإلغاء بالتفصيل..."
                      value={editOrderData.cancelReason}
                      onChange={(e) => setEditOrderData({ ...editOrderData, cancelReason: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-red-100 rounded-xl focus:border-red-400 outline-none transition-all h-24 resize-none"
                    ></textarea>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
                  >
                    حفظ التغييرات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

