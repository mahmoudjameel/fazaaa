import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, LogOut, Menu, X,
  MessageSquare, MessageCircle, UserCheck, Sliders, MapPin,
  UserCog, CreditCard, Banknote, AlertCircle, Shield,
  ChevronLeft, UserPlus, Bell, ImageIcon, Ticket, Timer,
  PanelRight, PanelLeft,   Route, Globe, AlertTriangle, Stethoscope, FlaskConical, Ban, FileText, BarChart3
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { isUnresolvedEscalation, isUnreadEscalation, getSeenEscalationIds, ESCALATIONS_SEEN_EVENT } from '../utils/escalationStatus';
import {
  canAccessMenuItem,
  getAdminSessionFromStorage,
  ADMIN_SESSION_UPDATED_EVENT,
} from '../utils/adminPermissions';
import { SeoHead } from './SeoHead';
import { AdminRouteGuard } from './AdminRouteGuard';

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [newEscalationsCount, setNewEscalationsCount] = useState(0);
  const [sessionVersion, setSessionVersion] = useState(0);
  const lastPendingReviewCountRef = useRef(0);
  const escalationsPrimedRef = useRef(false);
  const latestUnresolvedRef = useRef([]);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  const refreshUnreadBadge = () => {
    const unread = latestUnresolvedRef.current.filter((d) =>
      isUnreadEscalation(d.data(), d.id)
    );
    setNewEscalationsCount(unread.length);
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const q = query(collection(db, 'requests'), where('status', '==', 'pending_review'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setPendingReviewCount(count);
      if (count > lastPendingReviewCountRef.current) {
        audioRef.current.play().catch(() => {});
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('فزّاعين: طلب جديد يحتاج مراجعة', {
            body: `هناك ${count} طلبات بانتظار مراجعتك الآن.`,
            icon: '/logo192.png'
          });
        }
      }
      lastPendingReviewCountRef.current = count;
    });
    const tq = query(collection(db, 'support_tickets'), where('status', '==', 'open'));
    const unsubTickets = onSnapshot(tq, (snapshot) => {
      setOpenTicketsCount(snapshot.size);
    });

    // الشارة = تصعيدات غير مقروءة فقط؛ الصوت/الإشعار عند وصول تصعيد جديد بعد التحميل
    const eq = query(collection(db, 'admin_escalations'), where('status', '==', 'new'));
    const unsubEscalations = onSnapshot(eq, (snapshot) => {
      const unresolvedDocs = snapshot.docs.filter((d) => isUnresolvedEscalation(d.data()));
      latestUnresolvedRef.current = unresolvedDocs;
      refreshUnreadBadge();

      if (!escalationsPrimedRef.current) {
        escalationsPrimedRef.current = true;
        return;
      }

      const seenBefore = getSeenEscalationIds();
      const newlyAdded = snapshot.docChanges().filter((change) => {
        if (change.type !== 'added') return false;
        if (!isUnresolvedEscalation(change.doc.data())) return false;
        // جديد فعلاً وغير مقروء
        return !seenBefore.has(change.doc.id);
      });
      if (newlyAdded.length === 0) return;

      // لا تكرر الصوت إذا الأدمن على شاشة التصعيدات (ستُعلَّم مقروءة فوراً) — الصوت يبقى ليعرف بالتحديث
      audioRef.current.play().catch(() => {});
      if ('Notification' in window && Notification.permission === 'granted') {
        const first = newlyAdded[0].doc.data() || {};
        const label =
          first.type === 'no_providers'
            ? 'لا يوجد مزودون'
            : first.type === 'all_rejected'
              ? 'جميع المزودين رفضوا'
              : 'انتهاء وقت البحث';
        new Notification('فزّاعين: تصعيد جديد', {
          body:
            newlyAdded.length === 1
              ? `${label} — طلب يحتاج مراجعة.`
              : `${newlyAdded.length} تصعيدات جديدة تحتاج مراجعة.`,
          icon: '/fzaeen-logo.jpeg',
          tag: `escalation-${newlyAdded[0].doc.id}`,
        });
      }
    });

    const onSeenUpdated = () => refreshUnreadBadge();
    window.addEventListener(ESCALATIONS_SEEN_EVENT, onSeenUpdated);

    return () => {
      unsubscribe();
      unsubTickets();
      unsubEscalations();
      window.removeEventListener(ESCALATIONS_SEEN_EVENT, onSeenUpdated);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onSession = () => setSessionVersion((v) => v + 1);
    window.addEventListener(ADMIN_SESSION_UPDATED_EVENT, onSession);
    return () => window.removeEventListener(ADMIN_SESSION_UPDATED_EVENT, onSession);
  }, []);

  const handleLogout = async () => {
    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_permissions');
      try {
        await signOut(auth);
      } catch (_) { /* ignore */ }
      navigate('/login');
    }
  };

  const menuItems = [
    { id: 'dashboard',               path: '/admin',                          icon: LayoutDashboard, label: 'لوحة التحكم',             category: 'main' },
    { id: 'emergency_services',      path: '/admin/emergency-services',       icon: AlertCircle,     label: 'خدمات الطوارئ',           category: 'services' },
    { id: 'providers',               path: '/admin/providers',                icon: Users,           label: 'المزودون',                 category: 'management' },
    { id: 'add_provider',            path: '/admin/add-provider',             icon: UserPlus,        label: 'إضافة مزود',              category: 'management' },
    { id: 'orders',                  path: '/admin/orders',                   icon: ShoppingBag,     label: 'الطلبات',                  category: 'management' },
    { id: 'sla_tracking',            path: '/admin/sla-tracking',             icon: Timer,           label: 'متابعة SLA',               category: 'management' },
    { id: 'escalations',             path: '/admin/escalations',              icon: AlertTriangle,   label: 'تصعيدات النظام',           category: 'management' },
    { id: 'users',                   path: '/admin/users',                    icon: UserCheck,       label: 'العملاء',                  category: 'management' },
    { id: 'blocked_phones',          path: '/admin/blocked-phones',           icon: Ban,             label: 'حظر الأرقام',              category: 'management' },
    { id: 'notifications',           path: '/admin/notifications',            icon: Bell,            label: 'الإشعارات',                category: 'management' },
    { id: 'support_tickets',         path: '/admin/support-tickets',          icon: Ticket,          label: 'تذاكر الدعم',              category: 'management' },
    { id: 'complaints',              path: '/admin/complaints',               icon: MessageSquare,   label: 'الشكاوي',                  category: 'management' },
    { id: 'marketing_insights',      path: '/admin/marketing-insights',       icon: BarChart3,       label: 'تحليلات التسويق',          category: 'management' },
    { id: 'chats',                   path: '/admin/chats',                    icon: MessageCircle,   label: 'المحادثات',                category: 'management' },
    { id: 'withdrawal_requests',     path: '/admin/withdrawal-requests',      icon: Banknote,        label: 'طلبات السحب',              category: 'financial' },
    { id: 'cities',                  path: '/admin/cities',                   icon: MapPin,          label: 'المدن',                    category: 'settings' },
    { id: 'city_managers',           path: '/admin/city-managers',            icon: UserCog,         label: 'مديرو المدن',              category: 'settings' },
    { id: 'distribution',            path: '/admin/distribution',             icon: Route,           label: 'إعدادات التوزيع',          category: 'settings' },
    { id: 'dispatch_diagnostics',    path: '/admin/dispatch-diagnostics',     icon: Stethoscope,     label: 'تشخيص التوزيع',            category: 'settings' },
    { id: 'order_test_lab',          path: '/admin/order-test-lab',           icon: FlaskConical,    label: 'مختبر اختبار الطلبات',      category: 'settings' },
    { id: 'bank_settings',           path: '/admin/bank-settings',            icon: CreditCard,      label: 'إعدادات البنك',            category: 'settings' },
    { id: 'app_settings',            path: '/admin/app-settings',             icon: Sliders,         label: 'إعدادات التطبيق',          category: 'settings' },
    { id: 'provider_drawer_sections',path: '/admin/provider-drawer-sections', icon: PanelRight,      label: 'Drawer المزود',            category: 'settings' },
    { id: 'customer_drawer_sections',path: '/admin/customer-drawer-sections', icon: PanelLeft,       label: 'Drawer العميل',            category: 'settings' },
    { id: 'banners',                 path: '/admin/banners',                  icon: ImageIcon,       label: 'البانرات',                 category: 'settings' },
    { id: 'landing_settings',        path: '/admin/landing-settings',         icon: Globe,           label: 'الاندنق بيج',              category: 'settings' },
    { id: 'articles',                path: '/admin/articles',                 icon: FileText,        label: 'مقالات SEO',               category: 'settings' },
    { id: 'admins',                  path: '/admin/admins',                   icon: Shield,          label: 'المديرون',                 category: 'settings', restricted: true },
  ];

  const session = getAdminSessionFromStorage();
  // sessionVersion يُحدَّث بعد مزامنة Firestore لإعادة رسم القائمة حسب الصلاحيات
  void sessionVersion;
  const filteredMenuItems = menuItems.filter((item) => canAccessMenuItem(item, session));
  const groupedMenuItems = {
    main:       filteredMenuItems.filter(i => i.category === 'main'),
    services:   filteredMenuItems.filter(i => i.category === 'services'),
    management: filteredMenuItems.filter(i => i.category === 'management'),
    financial:  filteredMenuItems.filter(i => i.category === 'financial'),
    settings:   filteredMenuItems.filter(i => i.category === 'settings'),
  };

  const categoryLabels = {
    main:       'الرئيسية',
    services:   'الخدمات',
    management: 'الإدارة',
    financial:  'المالية',
    settings:   'الإعدادات',
  };

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <button
        onClick={() => { navigate(item.path); if (isMobile) setSidebarOpen(false); }}
        title={!sidebarOpen ? item.label : ''}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative text-right
          ${isActive
            ? 'bg-amber-400/12 text-amber-400'
            : 'text-white/45 hover:text-white/80 hover:bg-white/5'
          }`}
      >
        {isActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 rounded-l-full" />
        )}
        <Icon className={`flex-shrink-0 w-4.5 h-4.5 ${sidebarOpen ? '' : 'mx-auto'} ${isActive ? 'text-amber-400' : 'text-white/35 group-hover:text-white/70'}`}
          style={{ width: '18px', height: '18px' }} />
        {sidebarOpen && (
          <>
            <span className={`flex-1 text-sm font-semibold truncate ${isActive ? 'text-amber-400' : ''}`}>
              {item.label}
            </span>
            {item.id === 'orders' && pendingReviewCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                {pendingReviewCount}
              </span>
            )}
            {item.id === 'support_tickets' && openTicketsCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {openTicketsCount}
              </span>
            )}
            {item.id === 'escalations' && newEscalationsCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                {newEscalationsCount}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" dir="rtl">
      <SeoHead
        title="لوحة التحكم | فزاعين"
        description="لوحة تحكم إدارة منصة فزاعين"
        path="/admin"
        noindex
      />

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile open button */}
      {isMobile && !sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)}
          className="fixed top-3 right-3 z-50 lg:hidden p-2.5 bg-gray-950 rounded-xl shadow-lg border border-white/10 text-white">
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-50 bg-gray-950 transition-all duration-300 ease-in-out flex flex-col border-l border-white/6
        ${sidebarOpen ? 'w-60 sm:w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-16 lg:translate-x-0'}`}>

        {/* Brand header */}
        <div className="flex-shrink-0 h-16 flex items-center px-4 border-b border-white/6">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 w-full">
              <img src="/fzaeen-logo.jpeg" alt="فزاعين"
                className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-base leading-none">فزاعين</div>
                <div className="text-white/35 text-[11px] mt-0.5">لوحة التحكم</div>
              </div>
              <button onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-white/30 hover:text-white/70 hover:bg-white/8 rounded-lg transition-all lg:hidden">
                <X className="w-4 h-4" />
              </button>
              <button onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-white/30 hover:text-white/70 hover:bg-white/8 rounded-lg transition-all hidden lg:block">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <button onClick={() => setSidebarOpen(true)} className="relative group">
                <img src="/fzaeen-logo.jpeg" alt="فزاعين"
                  className="w-9 h-9 rounded-xl object-cover" />
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
          {Object.entries(groupedMenuItems).map(([cat, items]) => {
            if (!items.length) return null;
            return (
              <div key={cat} className="mb-1">
                {sidebarOpen && (
                  <div className="px-3 pt-3 pb-1.5">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                      {categoryLabels[cat]}
                    </span>
                  </div>
                )}
                {!sidebarOpen && <div className="my-2 mx-2 h-px bg-white/6" />}
                <div className="space-y-0.5">
                  {items.map(item => <NavItem key={item.path} item={item} />)}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="flex-shrink-0 p-2 border-t border-white/6">
          <button onClick={handleLogout}
            title={!sidebarOpen ? 'تسجيل الخروج' : ''}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/8 transition-all group ${!sidebarOpen ? 'justify-center' : ''}`}>
            <LogOut style={{ width: '18px', height: '18px' }}
              className="flex-shrink-0 group-hover:scale-110 transition-transform" />
            {sidebarOpen && <span className="text-sm font-semibold">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center gap-4 px-4 sm:px-6 flex-shrink-0">
          {!isMobile && !sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-950" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-black text-gray-900 leading-none">مشرف النظام</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {localStorage.getItem('admin_role') === 'super_admin' ? 'Super Admin' : 'Admin'}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <AdminRouteGuard>
              <Outlet />
            </AdminRouteGuard>
          </div>
        </main>
      </div>
    </div>
  );
};
