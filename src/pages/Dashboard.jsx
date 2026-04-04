import { useEffect, useState } from 'react';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, Clock,
  CheckCircle, AlertCircle, XCircle, Activity, Loader2,
  UserCheck, Banknote, Ticket, MessageSquare, ArrowUpRight,
  ArrowDownRight, Minus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getRecentActivity } from '../services/adminService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const StatusBadge = ({ status }) => {
  const map = {
    completed:                   { label: 'مكتمل',               cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    searching:                   { label: 'قيد البحث',           cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    accepted:                    { label: 'مقبول',               cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    arriving:                    { label: 'في الطريق',           cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    cancelled:                   { label: 'ملغي',                cls: 'bg-red-50 text-red-600 border-red-200' },
    canceled_by_provider:        { label: 'ملغي – المزود',       cls: 'bg-red-50 text-red-600 border-red-200' },
    canceled_by_client:          { label: 'ملغي – العميل',       cls: 'bg-red-50 text-red-600 border-red-200' },
    pending_client_confirmation: { label: 'بانتظار التأكيد',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  };
  const b = map[status] || { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${b.cls}`}>
      {b.label}
    </span>
  );
};

const formatTs = (ts) => {
  if (!ts) return '-';
  const d = ts?.toMillis ? new Date(ts.toMillis()) : new Date(ts);
  return isNaN(d.getTime()) ? '-' : format(d, 'dd MMM, HH:mm', { locale: ar });
};

const formatTsFull = (ts) => {
  if (!ts) return '-';
  const d = ts?.toMillis ? new Date(ts.toMillis()) : new Date(ts);
  return isNaN(d.getTime()) ? '-' : format(d, 'dd MMM yyyy, HH:mm', { locale: ar });
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([getDashboardStats(), getRecentActivity()]);
        setStats(s.stats);
        setActivities(a.activities);
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const changeDir = (val) => {
    if (!val || val === '0%') return 'flat';
    return val.startsWith('-') ? 'down' : 'up';
  };

  const statCards = [
    {
      title: 'إجمالي المزودين',
      value: stats?.totalProviders ?? 0,
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-r-blue-500',
      change: `${stats?.totalProviders ?? 0}`,
      dir: 'flat',
      link: '/admin/providers',
    },
    {
      title: 'المزودون النشطون',
      value: stats?.activeProviders ?? 0,
      icon: UserCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-r-emerald-500',
      change: 'متصل الآن',
      dir: 'up',
      link: '/admin/providers',
    },
    {
      title: 'إجمالي الطلبات',
      value: stats?.totalOrders ?? 0,
      icon: ShoppingBag,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      borderColor: 'border-r-violet-500',
      change: stats?.changeOrders || '0%',
      dir: changeDir(stats?.changeOrders),
      link: '/admin/orders',
    },
    {
      title: 'طلبات مكتملة',
      value: stats?.completedOrders ?? 0,
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-r-emerald-500',
      change: stats?.changeCompleted || '0%',
      dir: changeDir(stats?.changeCompleted),
      link: '/admin/orders',
    },
    {
      title: 'طلبات قيد التنفيذ',
      value: stats?.activeOrders ?? 0,
      icon: TrendingUp,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-r-amber-500',
      change: `${stats?.todayOrders ?? 0} اليوم`,
      dir: 'up',
      link: '/admin/orders',
    },
    {
      title: 'طلبات ملغاة',
      value: stats?.cancelledOrders ?? 0,
      icon: XCircle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      borderColor: 'border-r-red-500',
      change: stats?.changeCancelled || '0%',
      dir: changeDir(stats?.changeCancelled),
      link: '/admin/orders',
    },
    {
      title: 'الإيرادات',
      value: `${(stats?.totalRevenue ?? 0).toLocaleString()} ر.س`,
      icon: DollarSign,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-r-green-500',
      change: stats?.changeRevenue || '0%',
      dir: changeDir(stats?.changeRevenue),
    },
    {
      title: 'إجمالي العمولات',
      value: `${(stats?.totalCommission ?? 0).toLocaleString()} ر.س`,
      icon: Banknote,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-500',
      borderColor: 'border-r-orange-500',
      change: stats?.changeCommission || '0%',
      dir: changeDir(stats?.changeCommission),
    },
  ];

  const DirIcon = ({ dir }) => {
    if (dir === 'up')   return <ArrowUpRight className="w-3 h-3 text-emerald-500" />;
    if (dir === 'down') return <ArrowDownRight className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const dirCls = (dir) => {
    if (dir === 'up')   return 'text-emerald-600 bg-emerald-50';
    if (dir === 'down') return 'text-red-500 bg-red-50';
    return 'text-gray-500 bg-gray-100';
  };

  /* Rejections after accept */
  const providerRejects = activities.filter(a =>
    a.type === 'provider_cancel_after_accept' || (a.wasAcceptedAfter && a.type === 'provider_cancel')
  );
  const clientRejects = activities.filter(a =>
    a.type === 'client_cancel_after_accept' || (a.wasAcceptedAfter && a.type === 'client_cancel')
  );
  const allRejects = [...providerRejects, ...clientRejects];

  const getActivityIcon = (type) => {
    const map = {
      order: ShoppingBag,
      rejection: AlertCircle,
      provider_cancel: XCircle,
      provider_cancel_after_accept: XCircle,
      client_cancel: XCircle,
    };
    return map[type] || ShoppingBag;
  };

  const getActivityIconStyle = (type) => {
    const map = {
      order:                       'bg-amber-50 text-amber-600',
      rejection:                   'bg-red-50 text-red-500',
      provider_cancel:             'bg-red-50 text-red-500',
      provider_cancel_after_accept:'bg-red-50 text-red-500',
      client_cancel:               'bg-orange-50 text-orange-500',
    };
    return map[type] || 'bg-gray-100 text-gray-500';
  };

  const today = format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar });

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">{today}</p>
        </div>
        <button
          onClick={() => { setLoading(true); window.location.reload(); }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:border-gray-300 transition-all"
        >
          <Activity className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i}
              onClick={() => s.link && navigate(s.link)}
              className={`bg-white rounded-2xl p-5 border border-gray-100 border-r-2 ${s.borderColor} shadow-sm hover:shadow-md transition-all duration-200 ${s.link ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 ${s.iconBg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${dirCls(s.dir)}`}>
                  <DirIcon dir={s.dir} />
                  {s.change}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">{s.value}</div>
              <div className="text-gray-400 text-xs font-semibold">{s.title}</div>
            </div>
          );
        })}
      </div>

      {/* Rejections alert */}
      {allRejects.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 border-r-2 border-r-red-500 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">إلغاءات بعد قبول الطلبات</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                {providerRejects.length > 0 && `${providerRejects.length} من المزودين`}
                {providerRejects.length > 0 && clientRejects.length > 0 && ' · '}
                {clientRejects.length > 0 && `${clientRejects.length} من العملاء`}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {providerRejects.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-sm font-bold text-gray-700">رفض المزودين ({providerRejects.length})</span>
                </div>
                <div className="space-y-2">
                  {providerRejects.slice(0, 3).map(a => (
                    <div key={a.id} className="bg-red-50/60 border border-red-100 rounded-xl p-3.5">
                      <p className="font-bold text-gray-800 text-sm mb-1">{a.title}</p>
                      <p className="text-gray-500 text-xs mb-1.5">
                        المزود: <span className="font-semibold text-gray-700">{a.providerName}</span>
                        {a.location && ` · ${a.location}`}
                      </p>
                      {a.reason && (
                        <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                          السبب: {a.reason}
                        </p>
                      )}
                      <p className="text-gray-400 text-[10px] mt-1.5">{formatTs(a.timestamp || a.createdAt)}</p>
                    </div>
                  ))}
                  {providerRejects.length > 3 && (
                    <p className="text-xs text-red-500 font-semibold text-center pt-1">
                      و {providerRejects.length - 3} حالة أخرى...
                    </p>
                  )}
                </div>
              </div>
            )}
            {clientRejects.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <span className="text-sm font-bold text-gray-700">إلغاء العملاء ({clientRejects.length})</span>
                </div>
                <div className="space-y-2">
                  {clientRejects.slice(0, 3).map(a => (
                    <div key={a.id} className="bg-orange-50/60 border border-orange-100 rounded-xl p-3.5">
                      <p className="font-bold text-gray-800 text-sm mb-1">{a.title}</p>
                      <p className="text-gray-500 text-xs mb-1.5">
                        المزود: <span className="font-semibold text-gray-700">{a.providerName}</span>
                        {a.location && ` · ${a.location}`}
                      </p>
                      {a.reason && (
                        <p className="text-xs text-orange-700 font-semibold bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">
                          السبب: {a.reason}
                        </p>
                      )}
                      <p className="text-gray-400 text-[10px] mt-1.5">{formatTs(a.timestamp || a.createdAt)}</p>
                    </div>
                  ))}
                  {clientRejects.length > 3 && (
                    <p className="text-xs text-orange-500 font-semibold text-center pt-1">
                      و {clientRejects.length - 3} حالة أخرى...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-gray-50">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-gray-600" />
          </div>
          <h2 className="text-base font-black text-gray-900">النشاط الأخير</h2>
        </div>

        {activities.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm font-medium">لا توجد أنشطة حديثة</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map(a => {
              const Icon = getActivityIcon(a.type);
              const iconStyle = getActivityIconStyle(a.type);
              const orderId = a.requestId;
              return (
                <div key={a.id}
                  role="button" tabIndex={0}
                  onClick={() => orderId && navigate(`/admin/orders?orderId=${orderId}`)}
                  onKeyDown={e => e.key === 'Enter' && orderId && navigate(`/admin/orders?orderId=${orderId}`)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconStyle}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate group-hover:text-gray-900">
                      {a.title || `طلب جديد – ${a.serviceType || 'خدمة'}`}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      {a.location || 'موقع غير محدد'}
                      {a.providerName && ` · المزود: ${a.providerName}`}
                    </p>
                    {a.wasAcceptedAfter && a.reason && (
                      <p className="text-xs text-red-500 font-semibold mt-1">السبب: {a.reason}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <StatusBadge status={a.status} />
                    <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                      {formatTsFull(a.timestamp || a.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
