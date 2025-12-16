import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingBag, LogOut, Menu, X, MessageSquare, UserCheck, Package, Settings, MapPin, UserCog, CreditCard, Banknote, FileText } from 'lucide-react';
import { useState } from 'react';

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { path: '/emergency-services', icon: Package, label: 'إدارة خدمات الطوارئ' },
    { path: '/services', icon: Package, label: 'الخدمات والأسعار' },
    { path: '/providers', icon: Users, label: 'إدارة المزودين' },
    { path: '/cities', icon: MapPin, label: 'إدارة المدن' },
    { path: '/orders', icon: ShoppingBag, label: 'إدارة الطلبات' },
    { path: '/distribution', icon: Settings, label: 'إعدادات التوزيع' },
    { path: '/city-managers', icon: UserCog, label: 'بيانات مديري المدن' },
    { path: '/users', icon: UserCheck, label: 'العملاء' },
    { path: '/complaints', icon: MessageSquare, label: 'الشكاوي والملاحظات' },
    { path: '/withdrawal-requests', icon: Banknote, label: 'طلبات سحب الرصيد' },
    { path: '/terms-settings', icon: FileText, label: 'الشروط والأحكام' },
    { path: '/bank-settings', icon: CreditCard, label: 'إعدادات البنك' },
  ];

  return (
    <div className="flex h-screen bg-gray-50" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`bg - white shadow - lg transition - all duration - 300 ${sidebarOpen ? 'w-64' : 'w-20'
          } `}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h1 className="text-2xl font-black text-gray-800">فزّاعين</h1>
                <p className="text-sm text-gray-500">لوحة التحكم</p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <nav className="p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold ${isActive
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-600'
                  }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-semibold">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="font-semibold">تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

