import { useEffect, useState } from 'react';
import { Users, ShoppingBag, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
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
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'إجمالي المزودين',
      value: stats?.totalProviders || 0,
      icon: Users,
      color: 'from-green-500 to-green-600',
      change: '+12%',
    },
    {
      title: 'المزودون النشطون',
      value: stats?.activeProviders || 0,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      change: '+5%',
    },
    {
      title: 'إجمالي الطلبات',
      value: stats?.totalOrders || 0,
      icon: ShoppingBag,
      color: 'from-green-500 to-green-600',
      change: '+23%',
    },
    {
      title: 'الإيرادات',
      value: `${(stats?.totalRevenue || 0).toLocaleString()} ر.س`,
      icon: DollarSign,
      color: 'from-green-500 to-green-600',
      change: '+18%',
    },
    {
      title: 'طلبات اليوم',
      value: stats?.todayOrders || 0,
      icon: Clock,
      color: 'from-green-500 to-green-600',
      change: '+8%',
    },
    {
      title: 'طلبات قيد التنفيذ',
      value: stats?.activeOrders || 0,
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      change: '+3%',
    },
  ];

  const getStatusBadge = (status) => {
    const badges = {
      completed: { text: 'مكتمل', color: 'bg-green-100 text-green-700' },
      searching: { text: 'قيد البحث', color: 'bg-yellow-100 text-yellow-700' },
      accepted: { text: 'مقبول', color: 'bg-blue-100 text-blue-700' },
      arriving: { text: 'في الطريق', color: 'bg-purple-100 text-purple-700' },
      cancelled: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
      canceled_by_provider: { text: 'ملغي من المزود', color: 'bg-red-100 text-red-700' },
      canceled_by_client: { text: 'ملغي من العميل', color: 'bg-red-100 text-red-700' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const getActivityIcon = (type) => {
    const icons = {
      order: ShoppingBag,
      rejection: AlertCircle,
      provider_cancel: AlertCircle,
      client_cancel: AlertCircle,
    };
    return icons[type] || ShoppingBag;
  };

  const getActivityColor = (type) => {
    const colors = {
      order: 'from-yellow-400 to-teal-400',
      rejection: 'from-orange-400 to-red-400',
      provider_cancel: 'from-red-400 to-pink-400',
      client_cancel: 'from-red-400 to-pink-400',
    };
    return colors[type] || 'from-yellow-400 to-teal-400';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-800 mb-2">لوحة التحكم</h1>
        <p className="text-gray-600">نظرة عامة على النظام</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`bg-gradient-to-r ${stat.color} p-3 rounded-xl`}>
                  <Icon className="text-white" size={24} />
                </div>
                <span className="text-sm font-semibold text-green-600">{stat.change}</span>
              </div>
              <h3 className="text-gray-600 text-sm mb-2">{stat.title}</h3>
              <p className="text-3xl font-black text-gray-800">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">النشاط الأخير</h2>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد أنشطة حديثة</p>
          ) : (
            activities.map((activity) => {
              const statusBadge = getStatusBadge(activity.status);
              const ActivityIcon = getActivityIcon(activity.type);
              const activityColor = getActivityColor(activity.type);
              
              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`bg-gradient-to-r ${activityColor} p-2 rounded-lg`}>
                      <ActivityIcon className="text-white" size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {activity.title || `طلب جديد - ${activity.serviceType || 'خدمة'}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.location || 'موقع غير محدد'}
                        {activity.providerName && ` • ${activity.providerName}`}
                      </p>
                      {activity.message && (
                        <p className="text-xs text-gray-400 mt-1">{activity.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-left">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}
                    >
                      {statusBadge.text}
                    </span>
                    <p className="text-sm text-gray-500 mt-2">
                      {activity.timestamp || activity.createdAt
                        ? (() => {
                            const timestamp = activity.timestamp || activity.createdAt;
                            const date = timestamp?.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
                            return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
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

