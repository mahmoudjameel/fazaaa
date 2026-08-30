/**
 * صلاحيات لوحة التحكم — مصدر واحد للقائمة + حماية المسارات
 */

/** كل شاشات الأدمن القابلة للتفويض */
export const ADMIN_PERMISSION_DEFS = [
  { id: 'dashboard', path: '/admin', exact: true, category: 'main', label: 'لوحة التحكم' },
  { id: 'emergency_services', path: '/admin/emergency-services', category: 'services', label: 'خدمات الطوارئ' },
  { id: 'services', path: '/admin/services', category: 'services', label: 'الخدمات' },
  { id: 'providers', path: '/admin/providers', category: 'management', label: 'المزودون' },
  { id: 'add_provider', path: '/admin/add-provider', category: 'management', label: 'إضافة مزود' },
  { id: 'provider_profile_requests', path: '/admin/provider-profile-requests', category: 'management', label: 'طلبات تعديل المزودين' },
  { id: 'orders', path: '/admin/orders', category: 'management', label: 'الطلبات' },
  { id: 'sla_tracking', path: '/admin/sla-tracking', category: 'management', label: 'متابعة SLA' },
  { id: 'escalations', path: '/admin/escalations', category: 'management', label: 'تصعيدات النظام' },
  { id: 'users', path: '/admin/users', category: 'management', label: 'العملاء' },
  { id: 'blocked_phones', path: '/admin/blocked-phones', category: 'management', label: 'حظر الأرقام' },
  { id: 'notifications', path: '/admin/notifications', category: 'management', label: 'الإشعارات' },
  { id: 'support_tickets', path: '/admin/support-tickets', category: 'management', label: 'تذاكر الدعم' },
  { id: 'complaints', path: '/admin/complaints', category: 'management', label: 'الشكاوي' },
  { id: 'chats', path: '/admin/chats', category: 'management', label: 'المحادثات' },
  { id: 'withdrawal_requests', path: '/admin/withdrawal-requests', category: 'financial', label: 'طلبات السحب' },
  { id: 'cities', path: '/admin/cities', category: 'settings', label: 'المدن' },
  { id: 'city_managers', path: '/admin/city-managers', category: 'settings', label: 'مديرو المدن' },
  { id: 'distribution', path: '/admin/distribution', category: 'settings', label: 'إعدادات التوزيع' },
  { id: 'dispatch_diagnostics', path: '/admin/dispatch-diagnostics', category: 'settings', label: 'تشخيص التوزيع' },
  { id: 'order_test_lab', path: '/admin/order-test-lab', category: 'settings', label: 'مختبر اختبار الطلبات' },
  { id: 'bank_settings', path: '/admin/bank-settings', category: 'settings', label: 'إعدادات البنك' },
  { id: 'app_settings', path: '/admin/app-settings', category: 'settings', label: 'إعدادات التطبيق' },
  { id: 'provider_drawer_sections', path: '/admin/provider-drawer-sections', category: 'settings', label: 'Drawer المزود' },
  { id: 'customer_drawer_sections', path: '/admin/customer-drawer-sections', category: 'settings', label: 'Drawer العميل' },
  { id: 'banners', path: '/admin/banners', category: 'settings', label: 'البانرات' },
  { id: 'landing_settings', path: '/admin/landing-settings', category: 'settings', label: 'الاندنق بيج' },
  { id: 'articles', path: '/admin/articles', category: 'settings', label: 'مقالات SEO' },
  { id: 'marketing_insights', path: '/admin/marketing-insights', category: 'management', label: 'تحليلات التسويق' },
  { id: 'admins', path: '/admin/admins', category: 'settings', label: 'المديرون والصلاحيات', restricted: true },
];

/** قائمة اختيار الصلاحيات في شاشة إدارة المديرين */
export const ADMIN_PERMISSIONS_LIST = ADMIN_PERMISSION_DEFS.filter((p) => !p.restricted).map(
  ({ id, label }) => ({ id, label })
);

export function parseAdminPermissions(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getAdminSessionFromStorage() {
  return {
    role: localStorage.getItem('admin_role') || '',
    permissions: parseAdminPermissions(localStorage.getItem('admin_permissions')),
    name: localStorage.getItem('admin_name') || '',
    email: localStorage.getItem('admin_email') || '',
  };
}

export function writeAdminSessionToStorage({ role, permissions, name, email }) {
  if (role != null) localStorage.setItem('admin_role', role);
  if (permissions != null) {
    localStorage.setItem('admin_permissions', JSON.stringify(parseAdminPermissions(permissions)));
  }
  if (name != null) localStorage.setItem('admin_name', name);
  if (email != null) localStorage.setItem('admin_email', email);
}

function normalizePath(pathname) {
  if (!pathname) return '/admin';
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === '' ? '/admin' : p;
}

/** إيجاد تعريف الصلاحية للمسار الحالي */
export function matchAdminRoute(pathname) {
  const path = normalizePath(pathname);
  const sorted = [...ADMIN_PERMISSION_DEFS].sort((a, b) => b.path.length - a.path.length);
  return (
    sorted.find((route) => {
      if (route.exact) return path === route.path;
      return path === route.path || path.startsWith(`${route.path}/`);
    }) || null
  );
}

/**
 * هل يملك المدير صلاحية فتح هذا المسار؟
 * super_admin → الكل
 * غير ذلك → id أو category أو 'all'
 * admins → super_admin فقط
 */
export function canAccessAdminPath(pathname, session = getAdminSessionFromStorage()) {
  const role = session?.role || '';
  if (role === 'super_admin') return true;

  const route = matchAdminRoute(pathname);
  if (!route) return false;
  if (route.restricted) return false;

  const permissions = parseAdminPermissions(session?.permissions);
  if (permissions.includes('all')) return true;
  if (permissions.includes(route.id)) return true;
  if (route.category && permissions.includes(route.category)) return true;
  return false;
}

/** هل يظهر عنصر القائمة لهذا المدير */
export function canAccessMenuItem(item, session = getAdminSessionFromStorage()) {
  const role = session?.role || '';
  if (role === 'super_admin') return true;
  if (item?.restricted) return false;
  return canAccessAdminPath(item.path, session);
}

/** أول مسار مسموح به بعد تسجيل الدخول / عند رفض مسار */
export function getFirstAllowedAdminPath(session = getAdminSessionFromStorage()) {
  const role = session?.role || '';
  if (role === 'super_admin') return '/admin';

  for (const route of ADMIN_PERMISSION_DEFS) {
    if (route.restricted) continue;
    if (canAccessAdminPath(route.path, session)) return route.path;
  }
  return null;
}

export const ADMIN_SESSION_UPDATED_EVENT = 'fazaa_admin_session_updated';

export function applyAdminSessionFromDoc(adminData, email) {
  const role = adminData?.role || 'admin';
  const permissions = parseAdminPermissions(adminData?.permissions);
  writeAdminSessionToStorage({
    role,
    permissions,
    name: adminData?.name || 'Admin',
    email: email || adminData?.email || '',
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_SESSION_UPDATED_EVENT));
  }
  return { role, permissions, name: adminData?.name || 'Admin', email };
}
