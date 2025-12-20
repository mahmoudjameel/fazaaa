import { useEffect, useState } from 'react';
import {
  Users,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Loader2,
} from 'lucide-react';
import { getDashboardStats, getRecentActivity } from '../services/adminService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResult, activitiesResult] = await Promise.all([
          getDashboardStats(),
          getRecentActivity(),
        ]);
        setStats(statsResult.stats);
        setActivities(activitiesResult.activities);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-orange animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'إجمالي المزودين',
      value: stats?.totalProviders || 0,
      icon: Users,
      gradient: 'from-primary-green to-green-600',
      bgColor: 'bg-green-50',
      change: '+12%',
      changeColor: 'text-status-success',
    },
    {
      title: 'المزودون النشطون',
      value: stats?.activeProviders || 0,
      icon: CheckCircle,
      gradient: 'from-primary-teal to-teal-600',
      bgColor: 'bg-teal-50',
      change: '+5%',
      changeColor: 'text-status-success',
    },
    {
      title: 'إجمالي الطلبات',
      value: stats?.totalOrders || 0,
      icon: ShoppingBag,
      gradient: 'from-primary-blue to-blue-600',
      bgColor: 'bg-blue-50',
      change: '+23%',
      changeColor: 'text-status-success',
    },
    {
      title: 'الإيرادات',
      value: `${(stats?.totalRevenue || 0).toLocaleString()} ر.س`,
      icon: DollarSign,
      gradient: 'from-primary-yellow to-yellow-600',
      bgColor: 'bg-yellow-50',
      change: '+18%',
      changeColor: 'text-status-success',
    },
    {
      title: 'طلبات اليوم',
      value: stats?.todayOrders || 0,
      icon: Clock,
      gradient: 'from-primary-orange to-orange-600',
      bgColor: 'bg-orange-50',
      change: '+8%',
      changeColor: 'text-status-success',
    },
    {
      title: 'طلبات قيد التنفيذ',
      value: stats?.activeOrders || 0,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      change: '+3%',
      changeColor: 'text-status-success',
    },
  ];

  const getStatusBadge = (status) => {
    const badges = {
      completed: {
        text: 'مكتمل',
        color: 'bg-status-success/10 text-status-success border-status-success/20',
      },
      searching: {
        text: 'قيد البحث',
        color: 'bg-status-warning/10 text-status-warning border-status-warning/20',
      },
      accepted: {
        text: 'مقبول',
        color: 'bg-status-info/10 text-status-info border-status-info/20',
      },
      arriving: {
        text: 'في الطريق',
        color: 'bg-purple-100 text-purple-700 border-purple-200',
      },
      cancelled: {
        text: 'ملغي',
        color: 'bg-status-error/10 text-status-error border-status-error/20',
      },
      canceled_by_provider: {
        text: 'ملغي من المزود',
        color: 'bg-status-error/10 text-status-error border-status-error/20',
      },
      canceled_by_client: {
        text: 'ملغي من العميل',
        color: 'bg-status-error/10 text-status-error border-status-error/20',
      },
    };
    return (
      badges[status] || {
        text: status,
        color: 'bg-gray-100 text-gray-700 border-gray-200',
      }
    );
  };

  const getActivityIcon = (type) => {
    const icons = {
      order: ShoppingBag,
      rejection: AlertCircle,
      provider_cancel: AlertCircle,
      provider_cancel_after_accept: AlertCircle,
      client_cancel: AlertCircle,
    };
    return icons[type] || ShoppingBag;
  };

  const getActivityColor = (type) => {
    const colors = {
      order: 'from-primary-yellow to-primary-teal',
      rejection: 'from-primary-orange to-status-error',
      provider_cancel: 'from-status-error to-pink-500',
      provider_cancel_after_accept: 'from-red-600 to-red-800',
      client_cancel: 'from-status-error to-pink-500',
    };
    return colors[type] || 'from-primary-yellow to-primary-teal';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-2">
          لوحة التحكم
        </h1>
        <p className="text-text-secondary font-medium">
          نظرة عامة على النظام والإحصائيات
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-soft hover:shadow-large transition-all duration-300 card-hover border border-border-light"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`bg-gradient-to-r ${stat.gradient} p-3 rounded-xl shadow-medium`}
                >
                  <Icon className="text-white" size={24} />
                </div>
                <span
                  className={`text-sm font-bold px-2 py-1 rounded-lg ${stat.changeColor} ${stat.bgColor}`}
                >
                  {stat.change}
                </span>
              </div>
              <h3 className="text-text-secondary text-sm font-semibold mb-2">
                {stat.title}
              </h3>
              <p className="text-3xl sm:text-4xl font-black text-text-primary">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rejections After Acceptance - Special Section */}
      {(() => {
        const providerRejectionsAfterAccept = activities.filter(
          (a) =>
            a.type === 'provider_cancel_after_accept' ||
            (a.wasAcceptedAfter && a.type === 'provider_cancel')
        );

        const clientRejectionsAfterAccept = activities.filter(
          (a) =>
            a.type === 'client_cancel_after_accept' ||
            (a.wasAcceptedAfter && a.type === 'client_cancel')
        );

        const allRejections = [
          ...providerRejectionsAfterAccept,
          ...clientRejectionsAfterAccept,
        ];

        if (allRejections.length > 0) {
          return (
            <div className="bg-gradient-to-br from-red-50 via-orange-50 to-red-50 border-2 border-red-200 rounded-2xl shadow-large p-6">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="text-status-error" size={24} />
                  </div>
                  <h2 className="text-xl font-black text-red-800">
                    الرفض والإلغاء بعد قبول الطلبات
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-status-error text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-medium">
                    {providerRejectionsAfterAccept.length} مزود
                  </span>
                  <span className="bg-primary-orange text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-medium">
                    {clientRejectionsAfterAccept.length} عميل
                  </span>
                </div>
              </div>

              {/* Provider Rejections */}
              {providerRejectionsAfterAccept.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-status-error rounded-full shadow-sm"></div>
                    <h3 className="font-bold text-red-800 text-lg">
                      رفض المزودين ({providerRejectionsAfterAccept.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {providerRejectionsAfterAccept.slice(0, 3).map((activity) => (
                      <div
                        key={activity.id}
                        className="bg-white rounded-xl p-4 border-r-4 border-status-error shadow-soft hover:shadow-medium transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-bold text-text-primary mb-2">
                              {activity.title}
                            </p>
                            <p className="text-sm text-text-secondary mb-2">
                              المزود:{' '}
                              <span className="font-bold text-text-primary">
                                {activity.providerName}
                              </span>
                              {' • '}
                              {activity.location}
                            </p>
                            {activity.reason && (
                              <p className="text-sm text-status-error mt-2 font-bold bg-red-50 p-2 rounded-lg">
                                ⚠️ السبب: {activity.reason}
                              </p>
                            )}
                            {activity.message && !activity.reason && (
                              <p className="text-sm text-status-error mt-2">
                                {activity.message}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-text-secondary font-medium">
                              {activity.timestamp || activity.createdAt
                                ? (() => {
                                    const timestamp =
                                      activity.timestamp || activity.createdAt;
                                    const date = timestamp?.toMillis
                                      ? new Date(timestamp.toMillis())
                                      : new Date(timestamp);
                                    return isNaN(date.getTime())
                                      ? '-'
                                      : format(date, 'dd MMM, HH:mm', {
                                          locale: ar,
                                        });
                                  })()
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {providerRejectionsAfterAccept.length > 3 && (
                    <p className="text-sm text-status-error mt-3 text-center font-bold">
                      و {providerRejectionsAfterAccept.length - 3} حالة أخرى...
                    </p>
                  )}
                </div>
              )}

              {/* Client Rejections */}
              {clientRejectionsAfterAccept.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-primary-orange rounded-full shadow-sm"></div>
                    <h3 className="font-bold text-orange-800 text-lg">
                      إلغاء العملاء ({clientRejectionsAfterAccept.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {clientRejectionsAfterAccept.slice(0, 3).map((activity) => (
                      <div
                        key={activity.id}
                        className="bg-white rounded-xl p-4 border-r-4 border-primary-orange shadow-soft hover:shadow-medium transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-bold text-text-primary mb-2">
                              {activity.title}
                            </p>
                            <p className="text-sm text-text-secondary mb-2">
                              المزود:{' '}
                              <span className="font-bold text-text-primary">
                                {activity.providerName}
                              </span>
                              {' • '}
                              {activity.location}
                            </p>
                            {activity.reason && (
                              <p className="text-sm text-primary-orange mt-2 font-bold bg-orange-50 p-2 rounded-lg">
                                ⚠️ السبب: {activity.reason}
                              </p>
                            )}
                            {activity.message && !activity.reason && (
                              <p className="text-sm text-primary-orange mt-2">
                                {activity.message}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-text-secondary font-medium">
                              {activity.timestamp || activity.createdAt
                                ? (() => {
                                    const timestamp =
                                      activity.timestamp || activity.createdAt;
                                    const date = timestamp?.toMillis
                                      ? new Date(timestamp.toMillis())
                                      : new Date(timestamp);
                                    return isNaN(date.getTime())
                                      ? '-'
                                      : format(date, 'dd MMM, HH:mm', {
                                          locale: ar,
                                        });
                                  })()
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {clientRejectionsAfterAccept.length > 3 && (
                    <p className="text-sm text-primary-orange mt-3 text-center font-bold">
                      و {clientRejectionsAfterAccept.length - 3} حالة أخرى...
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-soft p-6 border border-border-light">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-orange/10 rounded-lg">
            <Activity className="text-primary-orange" size={24} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-text-primary">
            النشاط الأخير
          </h2>
        </div>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-text-light mx-auto mb-4 opacity-50" />
              <p className="text-text-secondary font-medium">
                لا توجد أنشطة حديثة
              </p>
            </div>
          ) : (
            activities.map((activity) => {
              const statusBadge = getStatusBadge(activity.status);
              const ActivityIcon = getActivityIcon(activity.type);
              const activityColor = getActivityColor(activity.type);

              return (
                <div
                  key={activity.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-background-light rounded-xl hover:bg-gray-100 transition-all duration-200 border border-border-light card-hover"
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1">
                    <div
                      className={`bg-gradient-to-r ${activityColor} p-2.5 rounded-xl shadow-medium flex-shrink-0`}
                    >
                      <ActivityIcon className="text-white" size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-primary mb-1">
                        {activity.title ||
                          `طلب جديد - ${activity.serviceType || 'خدمة'}`}
                      </p>
                      <p className="text-sm text-text-secondary mb-1">
                        {activity.location || 'موقع غير محدد'}
                        {activity.providerName &&
                          ` • المزود: ${activity.providerName}`}
                      </p>
                      {activity.message && (
                        <p className="text-xs text-text-light mt-1">
                          {activity.message}
                        </p>
                      )}
                      {activity.wasAcceptedAfter && activity.reason && (
                        <p className="text-xs text-status-error mt-1 font-bold">
                          ⚠️ السبب: {activity.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 mt-3 sm:mt-0 sm:mr-4">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusBadge.color} inline-block`}
                    >
                      {statusBadge.text}
                    </span>
                    <p className="text-xs text-text-secondary font-medium">
                      {activity.timestamp || activity.createdAt
                        ? (() => {
                            const timestamp =
                              activity.timestamp || activity.createdAt;
                            const date = timestamp?.toMillis
                              ? new Date(timestamp.toMillis())
                              : new Date(timestamp);
                            return isNaN(date.getTime())
                              ? '-'
                              : format(date, 'dd MMM yyyy, HH:mm', {
                                  locale: ar,
                                });
                          })()
                        : '-'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
