import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import {
  AlertTriangle, ArrowRight, BarChart3, Bell, Car, ClipboardList, Download, FileSpreadsheet,
  LayoutDashboard, LogOut, RefreshCw, Search,
} from 'lucide-react';
import { auth, functions } from '../services/firebase';
import { exportTable } from '../utils/exportTable';
import { PhoneStep } from './PartnerPortal';

const call = async (name, payload) => (await httpsCallable(functions, name)(payload)).data;

const PERIODS = [
  { days: 30, label: 'آخر 30 يوماً' },
  { days: 90, label: 'آخر 90 يوماً' },
  { days: 365, label: 'آخر سنة' },
  { days: null, label: 'كل الفترات' },
];
const SECTIONS = [
  { key: 'overview', label: 'الملخص', icon: LayoutDashboard },
  { key: 'vehicles', label: 'السيارات', icon: Car },
  { key: 'orders', label: 'الطلبات', icon: ClipboardList },
];
const LOGIN_POINTS = [
  { icon: Car, text: 'سجل كامل لكل سيارة باللوحة والرقم الداخلي' },
  { icon: Bell, text: 'تنبيه للسيارات التي تتكرر أعطالها' },
  { icon: BarChart3, text: 'تقارير التكلفة والخدمات حسب الشهر' },
  { icon: FileSpreadsheet, text: 'تصدير الطلبات إلى Excel' },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const VEHICLE_STATUS = { active: 'مفعّلة', pending_activation: 'بانتظار التفعيل', pending_payment: 'بانتظار الدفع', suspended: 'موقوفة', expired: 'منتهية', cancelled: 'ملغاة' };
const ORDER_STATUS = { completed: 'مكتمل', searching: 'جارٍ البحث', assigned: 'تم القبول', en_route: 'في الطريق', arrived: 'وصل المزود', in_progress: 'قيد التنفيذ', timed_out: 'لم يوجد مزود' };
const orderStatusText = (status) => ORDER_STATUS[status] || 'ملغي';
const orderStatusColor = (status) => {
  if (status === 'completed') return 'bg-green-50 text-green-800';
  return ORDER_STATUS[status] && status !== 'timed_out' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700';
};

const dateFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' });
const monthFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', month: 'long', year: 'numeric' });
const formatDate = (ms) => (ms ? dateFormat.format(ms) : '—');
const formatDateTime = (ms) => (ms ? dateTimeFormat.format(ms) : '—');
const formatMoney = (amount) => `${Math.round(amount).toLocaleString('en-US')} ر.س`;
const vehicleName = (v) => [v.make, v.model].filter(Boolean).join(' ') || '—';
const monthKey = (ms) => new Date(ms + RIYADH_OFFSET_MS).toISOString().slice(0, 7);

const subscriptionText = ({ state, endsAtMs }) => {
  if (state === 'free_forever') return 'اشتراك مجاني';
  return `${state === 'paid' ? 'الاشتراك' : 'مجاني'} حتى ${formatDate(endsAtMs)}`;
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

const Stat = ({ label, value, hint }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
    <p className="text-sm text-gray-600">{label}</p>
    <p className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums mt-1 break-words">{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const Panel = ({ title, action, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3 min-w-0">
    {(title || action) && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title && <h2 className="text-base font-black text-gray-900 min-w-0 break-words">{title}</h2>}
        {action}
      </div>
    )}
    {children}
  </section>
);

const EmptyNote = ({ children }) => <p className="py-6 text-center text-sm text-gray-600">{children}</p>;

const RankedBars = ({ rows, valueText, emptyText = 'لا توجد بيانات في هذه الفترة.' }) => {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <EmptyNote>{emptyText}</EmptyNote>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-bold text-gray-800 min-w-0 break-words">{row.label}</span>
            <span className="text-gray-700 tabular-nums whitespace-nowrap">{valueText(row)}</span>
          </div>
          <div className="h-2 mt-1.5 rounded bg-gray-100"><div className="h-2 rounded bg-teal-700" style={{ width: `${(row.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
};

const AlertsPanel = ({ data, onOpenVehicle }) => {
  const { repeatThreshold, repeatWindowDays } = data.repeatRule;
  return (
    <Panel title="سيارات تحتاج فحصاً">
      <p className="text-sm text-gray-600">{repeatThreshold} مرات أو أكثر لنفس الخدمة خلال {repeatWindowDays} يوماً، وتشمل المحاولات المرفوضة.</p>
      {data.alerts.length === 0 ? <EmptyNote>لا توجد سيارة متكررة الأعطال الآن.</EmptyNote> : (
        <ul className="divide-y divide-gray-100">
          {data.alerts.map((alert) => (
            <li key={`${alert.plateKey}-${alert.serviceKey}`}>
              <button type="button" onClick={() => onOpenVehicle(alert.plateKey)} className="w-full min-h-[56px] py-2 flex items-center gap-3 text-start hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 rounded-lg">
                <span className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-amber-700" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-gray-900 break-words">{alert.plate}</span>
                  <span className="block text-sm text-gray-700 break-words">{alert.serviceName || alert.serviceKey}: {alert.count} مرات، آخرها {formatDate(alert.lastAtMs)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const Overview = ({ data, orders, onOpenVehicle }) => {
  const completed = orders.filter((o) => o.completed);
  const totalCost = completed.reduce((sum, o) => sum + o.cost, 0);
  const byService = groupRows(completed, (o) => o.serviceName || o.serviceKey, (o) => o.serviceName || o.serviceKey).sort((a, b) => b.value - a.value);
  const byMonth = groupRows(completed, (o) => monthKey(o.createdAtMs), (o) => monthFormat.format(o.createdAtMs)).sort((a, b) => b.key.localeCompare(a.key));
  const topVehicles = groupRows(completed, (o) => o.plateKey, (o) => [o.internalNumber, o.plate].filter(Boolean).join(' · ')).map((row) => ({ ...row, value: row.cost })).sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat label="السيارات" value={data.vehicles.length} />
        <Stat label="الطلبات" value={orders.length} />
        <Stat label="المكتملة" value={completed.length} hint={orders.length ? `${Math.round((completed.length / orders.length) * 100)}% من الطلبات` : undefined} />
        <Stat label="قيمة الخدمات" value={formatMoney(totalCost)} />
      </div>
      <AlertsPanel data={data} onOpenVehicle={onOpenVehicle} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="الخدمات المكتملة"><RankedBars rows={byService} valueText={(r) => `${r.value} · ${formatMoney(r.cost)}`} /></Panel>
        <Panel title="أعلى السيارات تكلفة"><RankedBars rows={topVehicles} valueText={(r) => formatMoney(r.cost)} /></Panel>
      </div>
      <Panel title="حسب الشهر"><RankedBars rows={byMonth} valueText={(r) => `${r.value} · ${formatMoney(r.cost)}`} /></Panel>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap ${orderStatusColor(status)}`}>{orderStatusText(status)}</span>
);

const InfoRow = ({ label, children }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-gray-600 flex-shrink-0">{label}</span>
    <span className="font-bold text-gray-900 min-w-0 text-end break-words">{children}</span>
  </div>
);

const OrderCard = ({ order }) => (
  <li className="py-3 space-y-1.5">
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm font-black text-gray-900 min-w-0 break-words">{order.serviceName || '—'}</span>
      <StatusBadge status={order.status} />
    </div>
    <p className="text-xs text-gray-600">طلب #{order.orderNumber} · {formatDateTime(order.createdAtMs)}</p>
    <InfoRow label="السيارة">{order.plate}{order.internalNumber ? ` · ${order.internalNumber}` : ''}</InfoRow>
    <InfoRow label="طلبه">{order.requesterName || 'غير مسجل'}</InfoRow>
    <InfoRow label="نفّذه">{order.providerName || '—'}</InfoRow>
    <InfoRow label="القيمة">{order.completed ? formatMoney(order.cost) : '—'}</InfoRow>
    {order.plateImage && <a href={order.plateImage} target="_blank" rel="noreferrer" className="inline-block text-sm font-bold text-teal-800 underline">صورة اللوحة</a>}
  </li>
);

const OrdersTable = ({ orders }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[760px] text-sm text-start">
      <thead>
        <tr className="border-b border-gray-200 text-gray-600">
          {['الطلب', 'التاريخ', 'السيارة', 'الخدمة', 'طلبه', 'نفّذه', 'الحالة', 'القيمة'].map((header) => (
            <th key={header} scope="col" className="py-2 px-2 font-bold text-start whitespace-nowrap">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {orders.map((order) => (
          <tr key={order.requestId}>
            <td className="py-2.5 px-2 tabular-nums">#{order.orderNumber}</td>
            <td className="py-2.5 px-2 whitespace-nowrap">{formatDate(order.createdAtMs)}</td>
            <td className="py-2.5 px-2 font-bold whitespace-nowrap">{order.plate}{order.internalNumber ? <span className="block text-xs font-normal text-gray-600">{order.internalNumber}</span> : null}</td>
            <td className="py-2.5 px-2">{order.serviceName || '—'}</td>
            <td className="py-2.5 px-2">{order.requesterName || 'غير مسجل'}</td>
            <td className="py-2.5 px-2">{order.providerName || '—'}</td>
            <td className="py-2.5 px-2"><StatusBadge status={order.status} /></td>
            <td className="py-2.5 px-2 tabular-nums whitespace-nowrap">{order.completed ? formatMoney(order.cost) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const VehicleDetail = ({ vehicle, orders, refusals, isDemo, onSaved, onClose }) => {
  const [number, setNumber] = useState(vehicle.internalNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const own = orders.filter((o) => o.plateKey === vehicle.plateKey);
  const done = own.filter((o) => o.completed);
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
    <div className="space-y-4 min-w-0">
      <button type="button" onClick={onClose} className="lg:hidden inline-flex items-center gap-1 min-h-[48px] text-sm font-bold text-gray-800">
        <ArrowRight className="w-5 h-5" /> كل السيارات
      </button>
      <Panel title={vehicle.plate}>
        <p className="text-sm text-gray-700">{vehicleName(vehicle)}{vehicle.color ? ` · ${vehicle.color}` : ''} · {VEHICLE_STATUS[vehicle.status] || vehicle.status}</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="الخدمات" value={done.length} />
          <Stat label="القيمة" value={formatMoney(done.reduce((sum, o) => sum + o.cost, 0))} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-bold text-gray-800 flex-1 min-w-[160px]">الرقم الداخلي
            <input value={number} onChange={(e) => setNumber(e.target.value)} disabled={isDemo} className="w-full min-h-[48px] mt-1 px-3 border border-gray-300 rounded-xl text-base bg-white disabled:bg-gray-50" />
          </label>
          {!isDemo && <button type="button" disabled={busy || number === vehicle.internalNumber} onClick={save} className="min-h-[48px] px-5 rounded-xl bg-teal-700 text-white text-sm font-bold disabled:opacity-50">حفظ</button>}
        </div>
        {error && <p className="text-sm font-bold text-red-700">{error}</p>}
        {ownRefusals.length > 0 && <p className="text-sm font-bold text-amber-800 bg-amber-50 rounded-lg p-3">محاولات رُفضت لنفاد الخدمة: {ownRefusals.length}، آخرها {formatDate(ownRefusals[0].atMs)}</p>}
      </Panel>
      <Panel title={`سجل الخدمات (${own.length})`}>
        {own.length === 0 ? <EmptyNote>لا توجد طلبات لهذه السيارة.</EmptyNote> : (
          <ul className="divide-y divide-gray-100">{own.map((order) => <OrderCard key={order.requestId} order={order} />)}</ul>
        )}
      </Panel>
    </div>
  );
};

const VehiclesTab = ({ data, selectedPlate, setSelectedPlate, reload }) => {
  const [search, setSearch] = useState('');
  const selected = data.vehicles.find((v) => v.plateKey === selectedPlate);
  const term = search.trim().toLowerCase();
  const rows = data.vehicles.filter((v) => !term || [v.plate, v.internalNumber, v.make, v.model].some((text) => String(text || '').toLowerCase().includes(term)));
  const alertedPlates = new Set(data.alerts.map((alert) => alert.plateKey));
  const statsOf = (plateKey) => {
    const done = data.orders.filter((o) => o.plateKey === plateKey && o.completed);
    return { count: done.length, cost: done.reduce((sum, o) => sum + o.cost, 0) };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">
      <div className={`space-y-3 min-w-0 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="relative">
          <Search className="w-5 h-5 text-gray-500 absolute top-3.5 start-3" />
          <input aria-label="بحث في السيارات" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باللوحة أو الرقم الداخلي" className="w-full min-h-[48px] ps-10 pe-3 border border-gray-300 rounded-xl text-base bg-white" />
        </div>
        {rows.length === 0 && <EmptyNote>لا توجد سيارات مطابقة.</EmptyNote>}
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2">
          {rows.map((vehicle) => {
            const stats = statsOf(vehicle.plateKey);
            const isSelected = vehicle.plateKey === selectedPlate;
            return (
              <li key={vehicle.id}>
                <button type="button" aria-current={isSelected ? 'true' : undefined} onClick={() => setSelectedPlate(vehicle.plateKey)} className={`w-full h-full text-start bg-white rounded-xl border p-3 min-h-[72px] hover:border-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${isSelected ? 'border-teal-700' : 'border-gray-200'}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-black text-gray-900 min-w-0 break-words">{vehicle.plate}</span>
                    {alertedPlates.has(vehicle.plateKey) && <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" aria-label="تحتاج فحصاً" />}
                  </span>
                  <span className="block text-sm text-gray-700 break-words">{vehicle.internalNumber ? `${vehicle.internalNumber} · ` : ''}{vehicleName(vehicle)}</span>
                  <span className="block text-xs text-gray-600 mt-0.5 tabular-nums">{stats.count} خدمة · {formatMoney(stats.cost)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={`min-w-0 lg:sticky lg:top-4 ${selected ? '' : 'hidden lg:block'}`}>
        {selected ? (
          <VehicleDetail key={selected.plateKey + selected.internalNumber} vehicle={selected} orders={data.orders} refusals={data.refusals} isDemo={data.company.isDemo} onSaved={reload} onClose={() => setSelectedPlate(null)} />
        ) : (
          <Panel><EmptyNote>اختر سيارة لعرض سجلها.</EmptyNote></Panel>
        )}
      </div>
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
  <Panel
    title={`الطلبات (${orders.length})`}
    action={(
      <button type="button" disabled={orders.length === 0} onClick={() => exportTable({ baseName: 'fazaeen-company-orders', columns: ORDER_COLUMNS, rows: orders })} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-300 text-sm font-bold text-gray-800 disabled:opacity-50">
        <Download className="w-4 h-4" /> تصدير Excel
      </button>
    )}
  >
    {orders.length === 0 ? <EmptyNote>لا توجد طلبات في هذه الفترة.</EmptyNote> : (
      <>
        <ul className="xl:hidden grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 divide-y divide-gray-100 lg:divide-y-0">{orders.map((order) => <OrderCard key={order.requestId} order={order} />)}</ul>
        <div className="hidden xl:block"><OrdersTable orders={orders} /></div>
      </>
    )}
  </Panel>
);

const Logo = ({ className }) => <img src="/fzaeen-logo.jpeg" alt="فزاعين" className={`rounded-xl object-cover flex-shrink-0 ${className}`} />;

const LoginScreen = () => (
  <main dir="rtl" className="min-h-screen bg-gray-50 lg:grid lg:grid-cols-2">
    <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:order-1">
      <div className="w-full max-w-[420px] space-y-5">
        <div className="flex items-center gap-3">
          <Logo className="w-12 h-12 lg:hidden" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900">لوحة الشركة</h1>
            <p className="text-sm text-gray-600">ادخل بالجوال المسجل لدى فزاعين</p>
          </div>
        </div>
        <PhoneStep onSignedIn={() => {}} />
        <ul className="lg:hidden space-y-2 text-sm text-gray-700">
          {LOGIN_POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2"><Icon className="w-4 h-4 text-teal-700 flex-shrink-0" /> <span className="min-w-0">{text}</span></li>
          ))}
        </ul>
      </div>
    </section>
    <aside className="hidden lg:flex flex-col justify-center gap-8 bg-teal-900 text-white px-12 xl:px-20 py-12 lg:order-2">
      <Logo className="w-16 h-16" />
      <div className="space-y-3">
        <h2 className="text-3xl font-black leading-snug">أسطولك كله في مكان واحد</h2>
        <p className="text-base leading-7 text-teal-100">اعرف ماذا حدث لكل سيارة، وكم كلّف، ومن طلب ومن نفّذ.</p>
      </div>
      <ul className="space-y-4">
        {LOGIN_POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-base"><Icon className="w-5 h-5 text-teal-200 flex-shrink-0" /> <span className="min-w-0">{text}</span></li>
        ))}
      </ul>
    </aside>
  </main>
);

const LoadingScreen = () => (
  <main dir="rtl" aria-busy="true" aria-label="جارٍ التحميل" className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-4">
    <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((index) => <div key={index} className="h-24 rounded-xl bg-gray-200 animate-pulse" />)}
    </div>
    <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
  </main>
);

const DeniedScreen = ({ error, onRetry, onSignOut }) => (
  <main dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="w-full max-w-[420px] bg-white rounded-xl border border-gray-200 p-6 space-y-3 text-center">
      <Logo className="w-14 h-14 mx-auto" />
      <h1 className="text-lg font-black text-gray-900">تعذر الدخول</h1>
      <p className="text-sm leading-6 text-gray-700">{error}</p>
      <button type="button" onClick={onRetry} className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 text-white text-sm font-bold"><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
      <button type="button" onClick={onSignOut} className="w-full min-h-[48px] rounded-xl border border-gray-300 text-sm font-bold text-gray-800">الدخول برقم آخر</button>
    </div>
  </main>
);

const NavButton = ({ section, isActive, onSelect, compact }) => {
  const Icon = section.icon;
  return (
    <button type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSelect(section.key)} title={section.label} className={`w-full min-h-[48px] rounded-xl flex items-center gap-3 px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${compact ? 'justify-center lg:justify-start' : ''} ${isActive ? 'bg-teal-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className={compact ? 'sr-only lg:not-sr-only' : ''}>{section.label}</span>
    </button>
  );
};

const Sidebar = ({ data, section, onSelect, onSignOut }) => (
  <aside className="hidden md:flex flex-col sticky top-0 h-screen w-[72px] lg:w-60 flex-shrink-0 bg-white border-s border-gray-200 p-3 gap-4">
    <div className="flex items-center gap-2 min-w-0">
      <Logo className="w-11 h-11 mx-auto lg:mx-0" />
      <div className="hidden lg:block min-w-0">
        <p className="text-sm font-black text-gray-900 break-words">{data.company.name}</p>
        <p className="text-xs text-gray-600">{subscriptionText(data.subscription)}</p>
      </div>
    </div>
    <nav aria-label="أقسام اللوحة" className="space-y-1 flex-1">
      {SECTIONS.map((item) => <NavButton key={item.key} section={item} isActive={section === item.key} onSelect={onSelect} compact />)}
    </nav>
    <button type="button" onClick={onSignOut} title="خروج" className="w-full min-h-[48px] rounded-xl flex items-center justify-center lg:justify-start gap-3 px-3 text-sm font-bold text-gray-700 hover:bg-gray-100">
      <LogOut className="w-5 h-5 flex-shrink-0" /><span className="sr-only lg:not-sr-only">خروج</span>
    </button>
  </aside>
);

const BottomTabs = ({ section, onSelect }) => (
  <nav aria-label="أقسام اللوحة" className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
    <div className="grid grid-cols-3">
      {SECTIONS.map(({ key, label, icon: Icon }) => (
        <button key={key} type="button" aria-current={section === key ? 'page' : undefined} onClick={() => onSelect(key)} className={`min-h-[60px] flex flex-col items-center justify-center gap-1 text-xs font-bold ${section === key ? 'text-teal-800' : 'text-gray-600'}`}>
          <Icon className="w-5 h-5" /> {label}
        </button>
      ))}
    </div>
  </nav>
);

const MobileHeader = ({ data, onSignOut }) => (
  <header className="md:hidden flex items-center gap-2 bg-white border-b border-gray-200 px-4 py-2">
    <Logo className="w-10 h-10" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-black text-gray-900 break-words">{data.company.name}</p>
      <p className="text-xs text-gray-600">{subscriptionText(data.subscription)}</p>
    </div>
    <button type="button" onClick={onSignOut} aria-label="خروج" className="w-12 h-12 flex items-center justify-center text-gray-700 flex-shrink-0"><LogOut className="w-5 h-5" /></button>
  </header>
);

export const CompanyConsole = () => {
  const [phase, setPhase] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [periodDays, setPeriodDays] = useState(90);
  const [section, setSection] = useState('overview');
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

  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'signed_out') return <LoginScreen />;
  if (phase === 'denied') return <DeniedScreen error={error} onRetry={load} onSignOut={leave} />;

  const selectSection = (key) => {
    setSection(key);
    setSelectedPlate(null);
  };
  const openVehicle = (plateKey) => {
    setSection('vehicles');
    setSelectedPlate(plateKey);
  };
  const title = SECTIONS.find((item) => item.key === section).label;

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 md:flex">
      <Sidebar data={data} section={section} onSelect={selectSection} onSignOut={leave} />
      <div className="flex-1 min-w-0">
        <MobileHeader data={data} onSignOut={leave} />
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 pb-24 md:pb-6 space-y-4">
          {data.company.isDemo && <p className="text-sm font-bold text-amber-800 bg-amber-50 rounded-lg px-3 py-2">حساب تجريبي: البيانات نموذجية وليست حقيقية.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl lg:text-2xl font-black text-gray-900">{title}</h1>
            {section !== 'vehicles' && (
              <label className="text-sm font-bold text-gray-800">
                <span className="sr-only">الفترة</span>
                <select value={periodDays ?? ''} onChange={(e) => setPeriodDays(e.target.value ? Number(e.target.value) : null)} className="min-h-[44px] px-3 rounded-xl border border-gray-300 bg-white text-sm">
                  {PERIODS.map((period) => <option key={period.label} value={period.days ?? ''}>{period.label}</option>)}
                </select>
              </label>
            )}
          </div>
          {section === 'overview' && <Overview data={data} orders={orders} onOpenVehicle={openVehicle} />}
          {section === 'vehicles' && <VehiclesTab data={data} selectedPlate={selectedPlate} setSelectedPlate={setSelectedPlate} reload={load} />}
          {section === 'orders' && <OrdersTab orders={orders} />}
        </main>
      </div>
      <BottomTabs section={section} onSelect={selectSection} />
    </div>
  );
};
