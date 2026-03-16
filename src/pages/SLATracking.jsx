import { useEffect, useState, useMemo } from 'react';
import { 
  Clock, 
  MapPin, 
  Search, 
  Filter, 
  AlertTriangle, 
  ChevronRight, 
  Calendar,
  AlertCircle,
  Timer,
  ShoppingBag
} from 'lucide-react';
import { format, subDays, isAfter, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getAllCities } from '../services/adminService';
import SAUDI_CITIES_FALLBACK from '../services/cities.json';

export const SLATracking = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month
  const [cityFilter, setCityFilter] = useState('all');
  const [thresholdFilter, setThresholdFilter] = useState('over_15'); // highlighting the main goal
  const [providersDict, setProvidersDict] = useState({});
  const [cities, setCities] = useState(SAUDI_CITIES_FALLBACK);

  useEffect(() => {
    // Fetch Cities
    const fetchCities = async () => {
      const result = await getAllCities();
      if (result.success && result.cities.length > 0) {
        setCities(result.cities);
      }
    };
    fetchCities();

    // Fetch Providers for fallback calculations
    const fetchProviders = async () => {
      try {
        const q = query(collection(db, 'providers'));
        const snap = await getDocs(q);
        const pDict = {};
        snap.forEach(doc => {
          pDict[doc.id] = doc.data();
        });
        setProvidersDict(pDict);
      } catch (e) {
        console.error('Error fetching providers for SLA:', e);
      }
    };
    fetchProviders();

    // Listen to Requests
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(reqs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenLocation = (order) => {
    if (order.coordinates) {
      const { latitude, longitude } = order.coordinates;
      window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
    } else if (order.location) {
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(order.location)}`, '_blank');
    }
  };

  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // 1. Time Filter
    if (timeFilter !== 'all') {
      const now = new Date();
      let thresholdDate;
      if (timeFilter === 'today') thresholdDate = startOfDay(now);
      else if (timeFilter === 'week') thresholdDate = subDays(now, 7);
      else if (timeFilter === 'month') thresholdDate = subDays(now, 30);

      filtered = filtered.filter(req => {
        if (!req.createdAt) return false;
        const createdAt = req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt.seconds * 1000);
        return isAfter(createdAt, thresholdDate);
      });
    }

    // 2. City Filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(req => {
        const reqCityId = String(req.cityId || '');
        const reqCityName = String(req.city || '').toLowerCase();
        const reqLocation = String(req.location || '').toLowerCase();
        const selectedCity = cities.find(c => c.id === cityFilter);
        const searchCityName = selectedCity ? selectedCity.name.toLowerCase() : '';

        return reqCityId === cityFilter || 
               reqCityName.includes(searchCityName) || 
               reqLocation.includes(searchCityName);
      });
    }

    // 3. SLA Threshold Filter
    filtered = filtered.filter(req => {
      let durationMin = req.providerAcceptedDurationMin;
      
      // Fallback calculation
      if (durationMin == null && req.coordinates && req.providerId) {
        const pData = providersDict[req.providerId];
        if (pData) {
          const loc = pData.locationCoordinates || pData.location || pData.coordinates;
          if (loc && (loc.latitude ?? loc.lat) && (loc.longitude ?? loc.lng)) {
            const distKm = calculateDistanceKm(
              req.coordinates.latitude, 
              req.coordinates.longitude, 
              loc.latitude ?? loc.lat, 
              loc.longitude ?? loc.lng
            );
            durationMin = Math.round((distKm / 40) * 60) || 1;
          }
        }
      }

      if (durationMin == null) return false;

      if (thresholdFilter === 'over_15') return durationMin > 15;
      if (thresholdFilter === 'under_15') return durationMin <= 15;
      return true;
    });

    return filtered;
  }, [requests, timeFilter, cityFilter, thresholdFilter, providersDict, cities]);

  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const totalDuration = filteredRequests.reduce((acc, curr) => acc + (curr.providerAcceptedDurationMin || 0), 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    
    return { total, avgDuration };
  }, [filteredRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-orange"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Timer className="text-primary-orange" size={28} />
            متابعة الـ SLA (الاستجابة)
          </h1>
          <p className="text-gray-500 font-medium">مراقبة جودة الخدمة ومدة وصول المزودين للعملاء</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <div className="px-4 py-2 border-l border-gray-100 last:border-0 text-center">
            <p className="text-xs text-gray-400 font-bold mb-1">إجمالي الطلبات</p>
            <p className="text-xl font-black text-primary-orange">{stats.total}</p>
          </div>
          <div className="px-4 py-2 text-center">
            <p className="text-xs text-gray-400 font-bold mb-1">متوسط الاستجابة</p>
            <p className="text-xl font-black text-teal-600">{stats.avgDuration} دقيقة</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold text-gray-400 px-1 flex items-center gap-1">
            <Calendar size={14} /> النطاق الزمني
          </label>
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-orange focus:outline-none font-semibold text-gray-700"
          >
            <option value="all">كل الأوقات</option>
            <option value="today">اليوم</option>
            <option value="week">آخر 7 أيام (أسبوع)</option>
            <option value="month">آخر 30 يوم (شهر)</option>
          </select>
        </div>

        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold text-gray-400 px-1 flex items-center gap-1">
            <MapPin size={14} /> المدينة
          </label>
          <select 
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-primary-teal focus:outline-none font-semibold text-gray-700"
          >
            <option value="all">كل المدن</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold text-gray-400 px-1 flex items-center gap-1">
            <AlertCircle size={14} /> حالة الـ SLA
          </label>
          <select 
            value={thresholdFilter}
            onChange={(e) => setThresholdFilter(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none font-semibold ${
              thresholdFilter === 'over_15' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            <option value="all">الكل</option>
            <option value="over_15">استجابة متأخرة (أكثر من 15 دقيقة)</option>
            <option value="under_15">استجابة سريعة (15 دقيقة أو أقل)</option>
          </select>
        </div>
      </div>

      {/* Results List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-bold">لا توجد طلبات تطابق هذه المعايير</p>
          </div>
        ) : (
          filteredRequests.map(order => {
            let durationMin = order.providerAcceptedDurationMin;
            let distanceKm = order.providerAcceptedDistanceKm;
            let isCalculated = false;

            if (durationMin == null && order.coordinates && order.providerId) {
              const pData = providersDict[order.providerId];
              if (pData) {
                const loc = pData.locationCoordinates || pData.location || pData.coordinates;
                if (loc && (loc.latitude ?? loc.lat) && (loc.longitude ?? loc.lng)) {
                  distanceKm = calculateDistanceKm(order.coordinates.latitude, order.coordinates.longitude, loc.latitude ?? loc.lat, loc.longitude ?? loc.lng);
                  durationMin = Math.round((distanceKm / 40) * 60) || 1;
                  isCalculated = true;
                }
              }
            }

            const isExceeded = (durationMin || 0) > 15;

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isExceeded ? 'bg-red-50' : 'bg-green-50'}`}>
                    <ShoppingBag className={isExceeded ? 'text-red-500' : 'text-green-500'} size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {order.serviceName || 'طلب خدمة'}
                      <span className="text-xs text-gray-400 font-normal mr-2">#{order.orderNumber || order.id.substring(0,8)}</span>
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <button 
                        onClick={() => handleOpenLocation(order)}
                        className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-bold hover:underline transition-all"
                        title="فتح الموقع في الخرائط"
                      >
                        <MapPin size={14} />
                        <span>
                          {(() => {
                            // 1. Try case-insensitive lookup in cities
                            const cityEntry = cities.find(c => 
                              String(c.id).toLowerCase() === String(order.cityId || '').toLowerCase()
                            );
                            if (cityEntry) return cityEntry.name;

                            // 2. Fallback to order.city
                            if (order.city) return order.city;

                            // 3. Fallback to order.location (truncated)
                            if (order.location) {
                              return order.location.length > 30 
                                ? order.location.substring(0, 30) + '...' 
                                : order.location;
                            }

                            return 'غير محدد';
                          })()}
                        </span>
                      </button>
                      <div className="flex items-center gap-1 text-gray-500 border-r pr-3">
                        <Calendar size={14} />
                        <span>{order.createdAt ? format(order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt.seconds * 1000), 'dd MMM, HH:mm', { locale: ar }) : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl border flex flex-col items-center min-w-[120px] ${isExceeded ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                    <span className="text-[10px] uppercase font-black opacity-60">وقت الاستجابة</span>
                    <span className="text-lg font-black">{durationMin || '--'} دقيقة</span>
                    {distanceKm && <span className="text-[10px] font-bold">({distanceKm.toFixed(1)} كم)</span>}
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-bold text-gray-500">المزود: <span className="text-gray-800">{order.providerName || 'غير محدد'}</span></div>
                    {isCalculated && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 rounded-full border border-amber-100 w-fit">حساب تقديري</span>}
                    {!isCalculated && <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 rounded-full border border-teal-100 w-fit">بيانات مؤرشفة</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
