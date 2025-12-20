import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  MessageSquare,
  UserCheck,
  Package,
  Settings,
  MapPin,
  UserCog,
  CreditCard,
  Banknote,
  FileText,
  AlertCircle,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      localStorage.removeItem('admin_authenticated');
      navigate('/login');
    }
  };

  const menuItems = [
    {
      path: '/',
      icon: LayoutDashboard,
      label: 'لوحة التحكم',
      color: 'from-primary-orange to-primary-yellow',
      category: 'main',
    },
    {
      path: '/emergency-services',
      icon: AlertCircle,
      label: 'إدارة خدمات الطوارئ',
      color: 'from-primary-red to-red-600',
      category: 'services',
    },
    {
      path: '/services',
      icon: Package,
      label: 'الخدمات والأسعار',
      color: 'from-primary-blue to-blue-600',
      category: 'services',
    },
    {
      path: '/providers',
      icon: Users,
      label: 'إدارة المزودين',
      color: 'from-primary-green to-green-600',
      category: 'management',
    },
    {
      path: '/orders',
      icon: ShoppingBag,
      label: 'إدارة الطلبات',
      color: 'from-primary-teal to-teal-600',
      category: 'management',
    },
    {
      path: '/users',
      icon: UserCheck,
      label: 'العملاء',
      color: 'from-purple-500 to-purple-600',
      category: 'management',
    },
    {
      path: '/cities',
      icon: MapPin,
      label: 'إدارة المدن',
      color: 'from-indigo-500 to-indigo-600',
      category: 'settings',
    },
    {
      path: '/city-managers',
      icon: UserCog,
      label: 'بيانات مديري المدن',
      color: 'from-cyan-500 to-cyan-600',
      category: 'settings',
    },
    {
      path: '/complaints',
      icon: MessageSquare,
      label: 'الشكاوي والملاحظات',
      color: 'from-pink-500 to-pink-600',
      category: 'management',
    },
    {
      path: '/withdrawal-requests',
      icon: Banknote,
      label: 'طلبات سحب الرصيد',
      color: 'from-amber-500 to-amber-600',
      category: 'financial',
    },
    {
      path: '/distribution',
      icon: Settings,
      label: 'إعدادات التوزيع',
      color: 'from-slate-500 to-slate-600',
      category: 'settings',
    },
    {
      path: '/bank-settings',
      icon: CreditCard,
      label: 'إعدادات البنك',
      color: 'from-emerald-500 to-emerald-600',
      category: 'settings',
    },
    {
      path: '/terms-settings',
      icon: FileText,
      label: 'الشروط والأحكام',
      color: 'from-gray-500 to-gray-600',
      category: 'settings',
    },
  ];

  const groupedMenuItems = {
    main: menuItems.filter((item) => item.category === 'main'),
    services: menuItems.filter((item) => item.category === 'services'),
    management: menuItems.filter((item) => item.category === 'management'),
    financial: menuItems.filter((item) => item.category === 'financial'),
    settings: menuItems.filter((item) => item.category === 'settings'),
  };

  const categoryLabels = {
    main: 'الرئيسية',
    services: 'الخدمات',
    management: 'الإدارة',
    financial: 'المالية',
    settings: 'الإعدادات',
  };

  return (
    <div className="flex h-screen bg-background-light overflow-hidden" dir="rtl">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 bg-white shadow-large transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? 'w-72 translate-x-0'
            : 'w-20 -translate-x-full lg:translate-x-0'
        } flex flex-col border-l border-border-light`}
      >
        {/* Header */}
        <div className="p-6 border-b border-border-light bg-gradient-to-br from-primary-orange to-primary-yellow">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-3 animate-fadeIn">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-medium">
                  <Shield className="text-primary-orange" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white">فزّاعين</h1>
                  <p className="text-xs text-white/90 font-medium">لوحة التحكم</p>
                </div>
              </div>
            )}
            {!sidebarOpen && (
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-medium mx-auto">
                <Shield className="text-primary-orange" size={24} />
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/20 rounded-lg transition-all text-white hover:scale-110"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {Object.entries(groupedMenuItems).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="mb-6">
                {sidebarOpen && (
                  <div className="px-4 mb-3">
                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                      {categoryLabels[category]}
                    </h3>
                  </div>
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          if (isMobile) setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                          isActive
                            ? `bg-gradient-to-r ${item.color} text-white shadow-medium`
                            : 'text-text-secondary hover:bg-background-light hover:text-text-primary'
                        }`}
                        title={!sidebarOpen ? item.label : ''}
                      >
                        <div
                          className={`flex-shrink-0 ${
                            isActive
                              ? 'text-white'
                              : 'text-text-secondary group-hover:text-primary-orange'
                          }`}
                        >
                          <Icon size={20} />
                        </div>
                        {sidebarOpen && (
                          <>
                            <span
                              className={`flex-1 text-right font-semibold ${
                                isActive ? 'text-white' : 'text-text-primary'
                              }`}
                            >
                              {item.label}
                            </span>
                            {isActive && (
                              <ChevronRight
                                size={16}
                                className="text-white opacity-80"
                              />
                            )}
                          </>
                        )}
                        {isActive && sidebarOpen && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer - Logout */}
        <div className="p-4 border-t border-border-light bg-background-light">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-status-error hover:bg-red-50 transition-all duration-200 group font-semibold"
            title={!sidebarOpen ? 'تسجيل الخروج' : ''}
          >
            <LogOut
              size={20}
              className="group-hover:scale-110 transition-transform"
            />
            {sidebarOpen && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
