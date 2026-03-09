import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  MessageSquare,
  MessageCircle,
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
  UserPlus,
  Bell,
  ImageIcon,
  Ticket,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const lastCountRef = useRef(0);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const q = query(collection(db, 'requests'), where('status', '==', 'pending_review'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setPendingReviewCount(count);
      if (count > lastCountRef.current) {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('فزّاعين: طلب جديد يحتاج مراجعة', {
            body: `هناك ${count} طلبات بانتظار مراجعتك الآن.`,
            icon: '/logo192.png'
          });
        }
      }
      lastCountRef.current = count;
    });

    const tq = query(collection(db, 'support_tickets'), where('status', '==', 'open'));
    const unsubTickets = onSnapshot(tq, (snapshot) => {
      setOpenTicketsCount(snapshot.size);
    });

    return () => { unsubscribe(); unsubTickets(); };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // على الديسكتوب: يبقى Sidebar مفتوح دائماً
      if (!mobile) {
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

  useEffect(() => {
    // التحقق من الصلاحيات
    const checkPermissions = () => {
      const role = localStorage.getItem('admin_role');
      const permissionsStr = localStorage.getItem('admin_permissions');

      // إذا كان super_admin يرى كل شيء
      if (role === 'super_admin') return;

      if (permissionsStr) {
        try {
          const permissions = JSON.parse(permissionsStr);
          // سنقوم بتصفية العناصر لاحقاً بناءً على هذه القائمة
          // لكن هنا فقط نتأكد من تحميلها
        } catch (e) {
          console.error('Error parsing permissions', e);
        }
      }
    };
    checkPermissions();
  }, []);

  const menuItems = [
    {
      id: 'dashboard',
      path: '/',
      icon: LayoutDashboard,
      label: 'لوحة التحكم',
      color: 'from-primary-orange to-primary-yellow',
      category: 'main',
    },
    {
      id: 'emergency_services',
      path: '/emergency-services',
      icon: AlertCircle,
      label: 'إدارة خدمات الطوارئ',
      color: 'from-primary-red to-red-600',
      category: 'services',
    },
    {
      id: 'providers',
      path: '/providers',
      icon: Users,
      label: 'إدارة المزودين',
      color: 'from-primary-green to-green-600',
      category: 'management',
    },
    {
      id: 'add_provider',
      path: '/add-provider',
      icon: UserPlus,
      label: 'إضافة مزود يدوي',
      color: 'from-blue-400 to-blue-600',
      category: 'management',
    },
    {
      id: 'orders',
      path: '/orders',
      icon: ShoppingBag,
      label: 'إدارة الطلبات',
      color: 'from-primary-teal to-teal-600',
      category: 'management',
    },
    {
      id: 'users',
      path: '/users',
      icon: UserCheck,
      label: 'العملاء',
      color: 'from-purple-500 to-purple-600',
      category: 'management',
    },
    {
      id: 'notifications',
      path: '/notifications',
      icon: Bell,
      label: 'إدارة الإشعارات',
      color: 'from-orange-400 to-orange-600',
      category: 'management',
    },
    {
      id: 'cities',
      path: '/cities',
      icon: MapPin,
      label: 'إدارة المدن',
      color: 'from-indigo-500 to-indigo-600',
      category: 'settings',
    },
    {
      id: 'city_managers',
      path: '/city-managers',
      icon: UserCog,
      label: 'بيانات مديري المدن',
      color: 'from-cyan-500 to-cyan-600',
      category: 'settings',
    },
    {
      id: 'support_tickets',
      path: '/support-tickets',
      icon: Ticket,
      label: 'تذاكر الدعم الفني',
      color: 'from-emerald-400 to-emerald-600',
      category: 'management',
    },
    {
      id: 'complaints',
      path: '/complaints',
      icon: MessageSquare,
      label: 'الشكاوي والملاحظات',
      color: 'from-pink-500 to-pink-600',
      category: 'management',
    },
    {
      id: 'chats',
      path: '/chats',
      icon: MessageCircle,
      label: 'المحادثات (عميل–مزود)',
      color: 'from-violet-500 to-violet-600',
      category: 'management',
    },
    {
      id: 'withdrawal_requests',
      path: '/withdrawal-requests',
      icon: Banknote,
      label: 'طلبات سحب الرصيد',
      color: 'from-amber-500 to-amber-600',
      category: 'financial',
    },
    {
      id: 'distribution',
      path: '/distribution',
      icon: Settings,
      label: 'إعدادات التوزيع',
      color: 'from-slate-500 to-slate-600',
      category: 'settings',
    },
    {
      id: 'bank_settings',
      path: '/bank-settings',
      icon: CreditCard,
      label: 'إعدادات البنك',
      color: 'from-emerald-500 to-emerald-600',
      category: 'settings',
    },
    {
      id: 'app_settings',
      path: '/app-settings',
      icon: Settings,
      label: 'إعدادات التطبيق',
      color: 'from-gray-500 to-gray-600',
      category: 'settings',
    },
    {
      id: 'banners',
      path: '/banners',
      icon: ImageIcon,
      label: 'بانر الشاشة الرئيسية',
      color: 'from-amber-500 to-amber-600',
      category: 'settings',
    },
    {
      id: 'admins',
      path: '/admins',
      icon: Shield,
      label: 'إدارة المديرين',
      color: 'from-red-500 to-red-600',
      category: 'settings',
      restricted: true // Only super_admin can see this by default
    }
  ];

  // تصفية القائمة بناءً على الصلاحيات
  const getFilteredItems = () => {
    const role = localStorage.getItem('admin_role');
    const permissionsStr = localStorage.getItem('admin_permissions');

    // السوبر أدمن يرى كل شيء
    if (role === 'super_admin') return menuItems;

    let permissions = [];
    if (permissionsStr) {
      try {
        permissions = JSON.parse(permissionsStr);
      } catch (e) {
        console.error('Error parsing permissions', e);
      }
    }

    return menuItems.filter(item => {
      // إذا كان العنصر مقيد بـ super_admin فقط
      if (item.restricted && role !== 'super_admin') return false;

      // إذا كانت الصلاحيات تحتوي على معرف العنصر
      // أو إذا كانت الصلاحيات تحتوي على الفئة (management, settings...)
      return permissions.includes(item.id) || permissions.includes(item.category) || permissions.includes('all');
    });
  };

  const filteredMenuItems = getFilteredItems();

  const groupedMenuItems = {
    main: filteredMenuItems.filter((item) => item.category === 'main'),
    services: filteredMenuItems.filter((item) => item.category === 'services'),
    management: filteredMenuItems.filter((item) => item.category === 'management'),
    financial: filteredMenuItems.filter((item) => item.category === 'financial'),
    settings: filteredMenuItems.filter((item) => item.category === 'settings'),
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Menu Button - Fixed at top (يظهر فقط عندما يكون Sidebar مغلق) */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 right-3 z-50 lg:hidden p-2.5 sm:p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-all border border-gray-200"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 bg-white shadow-large transition-all duration-300 ease-in-out ${sidebarOpen
          ? 'w-64 sm:w-72 translate-x-0'
          : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
          } flex flex-col border-l border-border-light relative`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-border-light bg-gradient-to-br from-primary-orange to-primary-yellow flex-shrink-0">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 sm:gap-4 w-full">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-medium flex-shrink-0">
                <Shield className="text-primary-orange w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h1 className="text-base sm:text-lg md:text-xl font-black text-white truncate">فزّاعين</h1>
                <p className="text-xs text-white/90 font-medium hidden sm:block">لوحة التحكم</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-all text-white hover:scale-110 flex-shrink-0 lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-medium">
                <Shield className="text-primary-orange w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute left-3 sm:left-4 p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-all text-white hover:scale-110 hidden lg:flex"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 sm:py-4 px-2 sm:px-3">
          {Object.entries(groupedMenuItems).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="mb-4 sm:mb-6">
                {sidebarOpen && (
                  <div className="px-2 sm:px-4 mb-2 sm:mb-3 text-start">
                    <h3 className="text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider">
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
                        className={`w-full flex items-center gap-3 md:gap-4 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl transition-all duration-200 group relative ${isActive
                          ? `bg-gradient-to-r ${item.color} text-white shadow-medium`
                          : 'text-text-secondary hover:bg-gray-100/80 hover:text-text-primary'
                          }`}
                        title={!sidebarOpen ? item.label : ''}
                      >
                        <div
                          className={`flex-shrink-0 ${isActive
                            ? 'text-white'
                            : 'text-text-secondary group-hover:text-primary-orange'
                            }`}
                        >
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        {sidebarOpen && (
                          <>
                            <span
                              className={`flex-1 text-start font-semibold text-sm sm:text-sm md:text-base truncate ${isActive ? 'text-white' : 'text-text-primary'
                                }`}
                            >
                              {item.label}
                            </span>
                            {item.id === 'orders' && pendingReviewCount > 0 && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white text-teal-600' : 'bg-red-500 text-white animate-pulse shadow-md'}`}>
                                {pendingReviewCount}
                              </span>
                            )}
                            {item.id === 'support_tickets' && openTicketsCount > 0 && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white shadow-md'}`}>
                                {openTicketsCount}
                              </span>
                            )}
                            {isActive && (
                              <ChevronRight
                                className="w-3 h-3 sm:w-4 sm:h-4 text-white opacity-80 flex-shrink-0"
                              />
                            )}
                          </>
                        )}
                        {isActive && sidebarOpen && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 sm:w-1 bg-white rounded-r-full" />
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
        <div className="p-2 sm:p-3 md:p-4 border-t border-border-light bg-background-light flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center sm:justify-start gap-3 md:gap-4 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl text-status-error hover:bg-red-50 transition-all duration-200 group font-semibold text-sm sm:text-sm md:text-base"
            title={!sidebarOpen ? 'تسجيل الخروج' : ''}
          >
            <LogOut
              className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform flex-shrink-0"
            />
            {sidebarOpen && <span className="truncate">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background-light">
        <div className="p-3 pt-16 sm:p-4 sm:pt-16 md:p-6 md:pt-16 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div >
  );
};
