import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { AlertTriangle, Car, Download, Loader2, LogOut, Search } from 'lucide-react';
import { auth, functions } from '../services/firebase';
import { exportTable } from '../utils/exportTable';
import { PhoneStep } from './PartnerPortal';

const call = async (name, payload) => (await httpsCallable(functions, name)(payload)).data;

const PERIODS = [
  { days: 30, label: '30 يوماً' },
  { days: 90, label: '90 يوماً' },
  { days: 365, label: 'سنة' },
  { days: null, label: 'الكل' },
];
const TABS = [
  { key: 'overview', label: 'الملخص' },
  { key: 'vehicles', label: 'السيارات' },
  { key: 'orders', label: 'الطلبات' },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const VEHICLE_STATUS = { active: 'مفعّلة', pending_activation: 'بانتظار التفعيل', pending_payment: 'بانتظار الدفع', suspended: 'موقوفة', expired: 'منتهية', cancelled: 'ملغاة' };
const ORDER_STATUS = { completed: 'مكتمل', searching: 'جارٍ البحث', assigned: 'تم القبول', en_route: 'في الطريق', arrived: 'وصل المزود', in_progress: 'قيد التنفيذ', timed_out: 'لم يوجد مزود' };
const orderStatusText = (status) => ORDER_STATUS[status] || 'ملغي';

const formatDate = (ms) => (ms ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium' }).format(ms) : '—');
const formatDateTime = (ms) => (ms ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }).format(ms) : '—');
const formatMoney = (amount) => `${Math.round(amount).toLocaleString('en-US')} ر.س`;
const vehicleName = (v) => [v.make, v.model].filter(Boolean).join(' ') || '—';

const subscriptionText = ({ state, endsAtMs }) => {
  if (state === 'free_forever') return 'اشتراك مجاني';
  return `${state === 'paid' ? 'الاشتراك' : 'مجاني'} حتى ${formatDate(endsAtMs)}`;
};

const Stat = ({ label, value }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
    <p className="text-sm text-gray-600">{label}</p>
    <p className="text-2xl font-black text-gray-900 tabular-nums mt-1 break-words">{value}</p>
  </div>
);

const Panel = ({ title, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 min-w-0">
    <h2 className="text-base font-black text-gray-900">{title}</h2>
    {children}
  </section>
);

const RankedBars = ({ rows, valueText }) => {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="text-sm text-gray-600">لا توجد بيانات في هذه الفترة.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-bold text-gray-800 min-w-0 break-words">{row.label}</span>
            <span className="text-gray-700 tabular-nums whitespace-nowrap">{valueText(row)}</span>
          </div>
          <div className="h-2 mt-1 rounded bg-gray-100"><div className="h-2 rounded bg-teal-700" style={{ width: `${(row.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
};

const groupRows = (orders, keyOf, labelOf) => {
  const groups = new Map();
  orders.forEach((order) => {
    const key = keyOf(order);
    const group = groups.get(key) || { key, label: labelOf(order), value: 0, cost: 0 };
    group.value += 1;
    group.cost += order.cost;
    groups.set(key, group);
  });
  return [...groups.values()];
};

const monthKey = (ms) => new Date(ms + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);

const Overview = ({ data, orders, onOpenVehicle }) => {
  const completed = orders.filter((o) => o.completed);
  const byService = groupRows(completed, (o) => o.serviceName || o.serviceKey, (o) => o.serviceName || o.serviceKey).sort((a, b) => b.value - a.value);
  const byMonth = groupRows(completed, (o) => monthKey(o.createdAtMs), (o) => monthKey(o.createdAtMs)).sort((a, b) => b.key.localeCompare(a.key));
  const topVehicles = groupRows(completed, (o) => o.plateKey, (o) => [o.internalNumber, o.plate].filter(Boolean).join(' · ')).sort((a, b) => b.cost - a.cost || b.value - a.value).slice(0, 10);
  const { repeatThreshold, repeatWindowDays } = data.repeatRule;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="السيارات" value={data.vehicles.length} />
        <Stat label="الطلبات" value={orders.length} />
        <Stat label="المكتملة" value={completed.length} />
        <Stat label="قيمة الخدمات" value={formatMoney(completed.reduce((sum, o) => sum + o.cost, 0))} />
      </div>
      <Panel title="سيارات تحتاج فحصاً">
        <p className="text-sm text-gray-600">{repeatThreshold} مرات أو أكثر لنفس الخدمة خلال {repeatWindowDays} يوماً، وتشمل المحاولات المرفوضة.</p>
        {data.alerts.length === 0 && <p className="text-sm font-bold text-gray-800">لا توجد سيارة متكررة الأعطال الآن.</p>}
        <ul className="divide-y divide-gray-100">
          {data.alerts.map((alert) => (
            <li key={`${alert.plateKey}-${alert.serviceKey}`}>
              <button type="button" onClick={() => onOpenVehicle(alert.plateKey)} className="w-full min-h-[48px] py-2 flex items-center gap-2 text-start">
                <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />
                <span className="min-w-0 text-sm font-bold text-gray-900 break-words">{alert.plate}: {alert.serviceName || alert.serviceKey} {alert.count} مرات، آخرها {formatDate(alert.lastAtMs)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="الخدمات المكتملة"><RankedBars rows={byService} valueText={(r) => `${r.value} · ${formatMoney(r.cost)}`} /></Panel>
        <Panel title="أعلى السيارات تكلفة"><RankedBars rows={topVehicles} valueText={(r) => formatMoney(r.cost)} /></Panel>
      </div>
      <Panel title="حسب الشهر"><RankedBars rows={byMonth} valueText={(r) => `${r.value} · ${formatMoney(r.cost)}`} /></Panel>
    </div>
  );
};

const OrderCard = ({ order }) => (
  <li className="py-3 space-y-1 text-sm">
    <div className="flex flex-wrap justify-between gap-2">
      <span className="font-black text-gray-900">{order.serviceName || '—'} · طلب #{order.orderNumber}</span>
      <span className="font-bold text-gray-700">{orderStatusText(order.status)}</span>
    </div>
    <p className="text-gray-700">{order.plate}{order.internalNumber ? ` · رقم ${order.internalNumber}` : ''} · {formatDateTime(order.createdAtMs)}</p>
    <p className="text-gray-700">طلبه: {order.requesterName || 'غير مسجل'}{order.requesterPhone ? ` (${order.requesterPhone})` : ''} · نفّذه: {order.providerName || '—'}</p>
    <p className="text-gray-700">
      القيمة: {order.completed ? formatMoney(order.cost) : '—'}
      {order.plateImage ? <> · <a href={order.plateImage} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline">صورة اللوحة</a></> : ''}
    </p>
  </li>
);

const VehicleDetail = ({ vehicle, orders, refusals, onSaved, onClose }) => {
  const [number, setNumber] = useState(vehicle.internalNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const own = orders.filter((o) => o.plateKey === vehicle.plateKey);
  const ownRefusals = refusals.filter((r) => r.plateKey === vehicle.plateKey);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await call('companySetVehicleNumber', { plateKey: vehicle.plateKey, internalNumber: number });
      await onSaved();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`سجل السيارة ${vehicle.plate}`}>
      <p className="text-sm text-gray-700">{vehicleName(vehicle)}{vehicle.color ? ` · ${vehicle.color}` : ''} · {VEHICLE_STATUS[vehicle.status] || vehicle.status}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold text-gray-800 flex-1 min-w-[180px]">الرقم الداخلي
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="w-full min-h-[48px] mt-1 px-3 border border-gray-300 rounded-xl text-base" />
        </label>
        <button type="button" disabled={busy || number === vehicle.internalNumber} onClick={save} className="min-h-[48px] px-4 rounded-xl bg-teal-700 text-white text-sm font-bold disabled:opacity-50">حفظ</button>
        <button type="button" onClick={onClose} className="min-h-[48px] px-4 rounded-xl border border-gray-300 text-sm font-bold text-gray-800">إغلاق</button>
      </div>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      {ownRefusals.length > 0 && <p className="text-sm font-bold text-amber-800">محاولات رُفضت لنفاد الخدمة: {ownRefusals.length}، آخرها {formatDate(ownRefusals[0].atMs)}</p>}
      {own.length === 0 && <p className="text-sm text-gray-600">لا توجد طلبات لهذه السيارة.</p>}
      <ul className="divide-y divide-gray-100">{own.map((order) => <OrderCard key={order.requestId} order={order} />)}</ul>
    </Panel>
  );
};

const VehiclesTab = ({ data, selectedPlate, setSelectedPlate, reload }) => {
  const [search, setSearch] = useState('');
  const selected = data.vehicles.find((v) => v.plateKey === selectedPlate);
  const term = search.trim().toLowerCase();
  const rows = data.vehicles.filter((v) => !term || [v.plate, v.internalNumber, v.make, v.model].some((text) => String(text || '').toLowerCase().includes(term)));
  const statsOf = (plateKey) => {
    const done = data.orders.filter((o) => o.plateKey === plateKey && o.completed);
    return { count: done.length, cost: done.reduce((sum, o) => sum + o.cost, 0), lastMs: done[0]?.createdAtMs };
  };

  return (
    <div className="space-y-4">
      {selected && <VehicleDetail key={selected.plateKey + selected.internalNumber} vehicle={selected} orders={data.orders} refusals={data.refusals} onSaved={reload} onClose={() => setSelectedPlate(null)} />}
      <div className="relative">
        <Search className="w-5 h-5 text-gray-500 absolute top-3.5 start-3" />
        <input aria-label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باللوحة أو الرقم الداخلي" className="w-full min-h-[48px] ps-10 pe-3 border border-gray-300 rounded-xl text-base bg-white" />
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-600">لا توجد سيارات.</p>}
      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map((vehicle) => {
          const stats = statsOf(vehicle.plateKey);
          return (
            <li key={vehicle.id}>
              <button type="button" onClick={() => setSelectedPlate(vehicle.plateKey)} className="w-full h-full text-start bg-white rounded-xl border border-gray-200 p-4 space-y-1 hover:border-teal-700">
                <span className="flex items-center gap-2 font-black text-gray-900"><Car className="w-5 h-5 text-gray-600 flex-shrink-0" /> <span className="min-w-0 break-words">{vehicle.plate}</span></span>
                <span className="block text-sm text-gray-700">{vehicle.internalNumber ? `رقم ${vehicle.internalNumber} · ` : ''}{vehicleName(vehicle)}</span>
                <span className="block text-sm text-gray-700">{stats.count} خدمة · {formatMoney(stats.cost)} · آخر خدمة {formatDate(stats.lastMs)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ORDER_COLUMNS = [
  { header: 'رقم الطلب', value: (o) => o.orderNumber },
  { header: 'التاريخ', value: (o) => (o.createdAtMs ? new Date(o.createdAtMs) : null) },
  { header: 'الرقم الداخلي', value: (o) => o.internalNumber },
  { header: 'اللوحة', value: (o) => o.plate },
  { header: 'الخدمة', value: (o) => o.serviceName },
  { header: 'الحالة', value: (o) => orderStatusText(o.status) },
  { header: 'طلبه', value: (o) => o.requesterName },
  { header: 'نفّذه', value: (o) => o.providerName },
  { header: 'القيمة', value: (o) => o.cost },
];

const OrdersTab = ({ orders }) => (
  <Panel title={`الطلبات (${orders.length})`}>
    <button type="button" disabled={orders.length === 0} onClick={() => exportTable({ baseName: 'fazaeen-company-orders', columns: ORDER_COLUMNS, rows: orders })} className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-xl border border-gray-300 text-sm font-bold text-gray-800 disabled:opacity-50">
      <Download className="w-4 h-4" /> تصدير Excel
    </button>
    {orders.length === 0 && <p className="text-sm text-gray-600">لا توجد طلبات في هذه الفترة.</p>}
    <ul className="divide-y divide-gray-100">{orders.map((order) => <OrderCard key={order.requestId} order={order} />)}</ul>
  </Panel>
);

const Shell = ({ title, subtitle, onSignOut, children }) => (
  <main dir="rtl" className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
    <div className="max-w-6xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 break-words">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
        {onSignOut && (
          <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1 min-h-[48px] px-3 text-sm font-bold text-gray-700">
            <LogOut className="w-4 h-4" /> خروج
          </button>
        )}
      </header>
      {children}
    </div>
  </main>
);

export const CompanyConsole = () => {
  const [phase, setPhase] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [periodDays, setPeriodDays] = useState(30);
  const [tab, setTab] = useState('overview');
  const [selectedPlate, setSelectedPlate] = useState(null);

  const load = async () => {
    try {
      setData(await call('getCompanyConsole', {}));
      setError('');
      setPhase('ready');
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر تحميل البيانات');
      setPhase('denied');
    }
  };

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) load();
    else setPhase('signed_out');
  }), []);

  const orders = useMemo(() => {
    if (!data) return [];
    if (!periodDays) return data.orders;
    const since = Date.now() - periodDays * DAY_MS;
    return data.orders.filter((order) => order.createdAtMs >= since);
  }, [data, periodDays]);

  const leave = async () => {
    setData(null);
    await signOut(auth);
  };

  if (phase === 'loading') return <Shell title="لوحة الشركة"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></Shell>;
  if (phase === 'signed_out') {
    return (
      <Shell title="لوحة الشركة" subtitle="ادخل بالجوال المسجل لدى فزاعين">
        <div className="max-w-[480px]"><PhoneStep onSignedIn={() => {}} /></div>
      </Shell>
    );
  }
  if (phase === 'denied') {
    return (
      <Shell title="لوحة الشركة" onSignOut={leave}>
        <Panel title="تعذر الدخول"><p className="text-sm text-gray-700">{error}</p></Panel>
      </Shell>
    );
  }

  const openVehicle = (plateKey) => {
    setSelectedPlate(plateKey);
    setTab('vehicles');
  };

  return (
    <Shell title={data.company.name} subtitle={subscriptionText(data.subscription)} onSignOut={leave}>
      <nav aria-label="أقسام اللوحة" className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => (
          <button key={item.key} type="button" aria-current={tab === item.key ? 'page' : undefined} onClick={() => setTab(item.key)} className={`min-h-[48px] px-4 rounded-xl text-sm font-bold ${tab === item.key ? 'bg-teal-700 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
            {item.label}
          </button>
        ))}
        {tab !== 'vehicles' && (
          <label className="ms-auto text-sm font-bold text-gray-800">
            <span className="sr-only">الفترة</span>
            <select value={periodDays ?? ''} onChange={(e) => setPeriodDays(e.target.value ? Number(e.target.value) : null)} className="min-h-[48px] px-3 rounded-xl border border-gray-300 bg-white text-sm">
              {PERIODS.map((period) => <option key={period.label} value={period.days ?? ''}>{period.label}</option>)}
            </select>
          </label>
        )}
      </nav>
      {tab === 'overview' && <Overview data={data} orders={orders} onOpenVehicle={openVehicle} />}
      {tab === 'vehicles' && <VehiclesTab data={data} selectedPlate={selectedPlate} setSelectedPlate={setSelectedPlate} reload={load} />}
      {tab === 'orders' && <OrdersTab orders={orders} />}
    </Shell>
  );
};
