import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Map as MapIcon, RefreshCw } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getDispatchAuditsSince, getRequestsCreatedBetween } from '../services/adminService';
import { buildCityReport, PRIORITY_CITY_NAMES } from '../utils/cityReport';
import { LOSS_REASONS } from '../utils/lossDiagnosis';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  { value: 7, label: 'آخر أسبوع' },
  { value: 30, label: 'آخر شهر' },
  { value: 90, label: 'آخر ٣ أشهر' },
];
const VISIBLE_AREAS = 12;

const OUTCOMES = {
  completed: { label: 'مكتمل', color: '#15803d' },
  cancelled: { label: 'ملغي', color: '#b45309' },
  lost: { label: 'غير مخدوم', color: '#b91c1c' },
  active: { label: 'جارٍ', color: '#0f766e' },
};

const selectCls =
  'w-full appearance-none pr-3 pl-7 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-teal-400 cursor-pointer';

const Select = ({ value, onChange, label, children }) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={selectCls}>{children}</select>
    <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
  </div>
);

const Tile = ({ label, value, hint }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-3" title={hint}>
    <div className="text-[11px] font-semibold text-gray-500">{label}</div>
    <div className="text-xl font-black text-gray-900 mt-0.5">{value}</div>
  </div>
);

const Section = ({ title, children }) => (
  <section className="bg-white rounded-2xl border border-gray-100 p-4">
    <h2 className="text-sm font-black text-gray-800 mb-3">{title}</h2>
    {children}
  </section>
);

const CountList = ({ rows, labelOf = (key) => key, empty }) => {
  if (rows.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  const max = rows[0][1];
  return (
    <ul className="space-y-2">
      {rows.map(([key, count]) => (
        <li key={key}>
          <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-gray-700 min-w-0 break-words">{labelOf(key)}</span>
            <span className="font-black text-gray-900 flex-shrink-0">{count}</span>
          </div>
          <div className="h-1 mt-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const HourBars = ({ hours, pick, colorClass }) => {
  const max = Math.max(1, ...hours.map(pick));
  return (
    <div dir="ltr">
      <div className="flex items-end gap-[2px] h-24 border-b border-gray-200">
        {hours.map((hour, index) => (
          <div key={index} className="flex-1 h-full flex items-end" title={`الساعة ${index}: ${pick(hour)} طلب`}>
            <div className={`w-full rounded-t ${colorClass}`} style={{ height: `${(pick(hour) / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        {[0, 6, 12, 18, 23].map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
};

/** عنصر نصي: Leaflet يعرض النصوص كـ HTML، والعنوان يكتبه العميل */
const tooltipNode = (point) => {
  const node = document.createElement('span');
  node.textContent = `${OUTCOMES[point.outcome].label} · ${point.service || 'خدمة'} · ${point.areaName}`;
  return node;
};

const OutcomeMap = ({ points }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!window.L || !containerRef.current || mapRef.current) return undefined;
    mapRef.current = window.L.map(containerRef.current);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(mapRef.current);
    layerRef.current = window.L.layerGroup().addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current.clearLayers();
    points.forEach((point) => {
      window.L.circleMarker([point.lat, point.lng], {
        radius: 6, weight: 2, color: '#ffffff', fillColor: OUTCOMES[point.outcome].color, fillOpacity: 0.9,
      })
        .bindTooltip(tooltipNode(point))
        .addTo(layerRef.current);
    });
    if (points.length > 0) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [24, 24], maxZoom: 13 });
  }, [points]);

  return <div ref={containerRef} className="h-80 rounded-xl overflow-hidden z-0" />;
};

export const CityReport = () => {
  const [cityName, setCityName] = useState(PRIORITY_CITY_NAMES[0]);
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const fromMs = Date.now() - period * DAY_MS;
        const [orders, audits, citiesSnap] = await Promise.all([
          getRequestsCreatedBetween(fromMs),
          getDispatchAuditsSince(fromMs),
          getDocs(collection(db, 'cities')),
        ]);
        if (!cancelled) setData({ orders, audits, cities: citiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) });
      } catch (e) {
        console.error('CityReport load:', e);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, reloadKey]);

  const report = useMemo(
    () => (data ? buildCityReport(data.orders, cityName, data.cities, data.audits) : null),
    [data, cityName]
  );
  const lostShare = report?.total ? Math.round((report.lost / report.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <MapIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">تقرير المدن</h1>
            <p className="text-sm text-gray-500">أين نخسر الطلبات ولماذا</p>
          </div>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-teal-600" aria-label="تحديث">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select value={cityName} onChange={setCityName} label="المدينة">
          {PRIORITY_CITY_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
        <Select value={period} onChange={(v) => setPeriod(Number(v))} label="الفترة">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
      </div>

      {failed ? (
        <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
          <p className="text-gray-700 font-semibold">تعذر تحميل البيانات.</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold">إعادة المحاولة</button>
        </div>
      ) : loading || !report ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="كل الطلبات" value={report.total} />
            <Tile label="مكتملة" value={report.completed} />
            <Tile label="ملغاة" value={report.cancelled} hint="بعد القبول، أو من الإدارة، أو مصعّدة" />
            <Tile label="غير مخدومة" value={`${report.lost} (${lostShare}%)`} hint="انتهت مهلتها أو تركها العميل قبل القبول" />
          </div>

          <Section title="الخريطة">
            <OutcomeMap points={report.points} />
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
              {Object.values(OUTCOMES).map((o) => (
                <span key={o.label} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.color }} />{o.label}
                </span>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="أسباب عدم الخدمة">
              <CountList rows={report.lostReasons} labelOf={(key) => LOSS_REASONS[key]} empty="لا توجد طلبات غير مخدومة." />
              {report.approximateLost > 0 && (
                <p className="text-[11px] text-gray-400 mt-3">{report.approximateLost} طلب بلا لقطة توزيع، فسببها تقديري.</p>
              )}
            </Section>
            <Section title="الخدمات المطلوبة">
              <CountList rows={report.services} empty="لا توجد طلبات." />
            </Section>
            <Section title="كل الطلبات حسب الساعة (توقيت السعودية)">
              <HourBars hours={report.hours} pick={(h) => h.total} colorClass="bg-teal-600" />
            </Section>
            <Section title="الطلبات غير المخدومة حسب الساعة">
              <HourBars hours={report.hours} pick={(h) => h.lost} colorClass="bg-red-700" />
            </Section>
          </div>

          <Section title="الأحياء والمناطق">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-right font-semibold py-2 px-2">الحي / المنطقة</th>
                    <th className="text-right font-semibold py-2 px-2">الطلبات</th>
                    <th className="text-right font-semibold py-2 px-2">غير مخدومة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.areas.slice(0, VISIBLE_AREAS).map((area) => (
                    <tr key={area.name} className="border-b border-gray-50">
                      <td className="py-2 px-2 font-bold text-gray-800">{area.name}</td>
                      <td className="py-2 px-2">{area.total}</td>
                      <td className="py-2 px-2 font-black text-red-700">{area.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="توفر المزودين وقت الطلب">
            {report.averageAvailable == null ? (
              <p className="text-sm text-gray-500">يبدأ التسجيل من طلبات ما بعد تفعيل السجل.</p>
            ) : (
              <p className="text-sm text-gray-700">
                متوسط المزودين المؤهلين لكل طلب: <b>{report.averageAvailable.toFixed(1)}</b> (من {report.auditedOrders} طلب مسجل).
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  );
};
