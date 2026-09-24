import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

/** تحميل كسول للصفحات — يمنع تحميل كل اللوحة دفعة واحدة عند فتح أي تاب */
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const Terms = lazy(() => import('./pages/Terms').then((m) => ({ default: m.Terms })));
const Support = lazy(() => import('./pages/Support').then((m) => ({ default: m.Support })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Services = lazy(() => import('./pages/Services').then((m) => ({ default: m.Services })));
const EmergencyServices = lazy(() => import('./pages/EmergencyServices').then((m) => ({ default: m.EmergencyServices })));
const Providers = lazy(() => import('./pages/Providers').then((m) => ({ default: m.Providers })));
const ProvidersMap = lazy(() => import('./pages/ProvidersMap').then((m) => ({ default: m.ProvidersMap })));
const Cities = lazy(() => import('./pages/Cities').then((m) => ({ default: m.Cities })));
const Orders = lazy(() => import('./pages/Orders').then((m) => ({ default: m.Orders })));
const DistributionSettings = lazy(() => import('./pages/DistributionSettings').then((m) => ({ default: m.DistributionSettings })));
const DispatchDiagnostics = lazy(() => import('./pages/DispatchDiagnostics').then((m) => ({ default: m.DispatchDiagnostics })));
const OrderTestLab = lazy(() => import('./pages/OrderTestLab').then((m) => ({ default: m.OrderTestLab })));
const CityManagers = lazy(() => import('./pages/CityManagers').then((m) => ({ default: m.CityManagers })));
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })));
const Notifications = lazy(() => import('./pages/Notifications').then((m) => ({ default: m.Notifications })));
const Complaints = lazy(() => import('./pages/Complaints').then((m) => ({ default: m.Complaints })));
const Chats = lazy(() => import('./pages/Chats').then((m) => ({ default: m.Chats })));
const BankSettings = lazy(() => import('./pages/BankSettings'));
const WithdrawalRequests = lazy(() => import('./pages/WithdrawalRequests'));
const WalletTopUps = lazy(() => import('./pages/WalletTopUps'));
const ProviderProfileRequests = lazy(() => import('./pages/ProviderProfileRequests'));
const AppSettings = lazy(() => import('./pages/AppSettings'));
const Admins = lazy(() => import('./pages/Admins'));
const Banners = lazy(() => import('./pages/Banners'));
const SupportTickets = lazy(() => import('./pages/SupportTickets').then((m) => ({ default: m.SupportTickets })));
const AddProvider = lazy(() => import('./pages/AddProvider').then((m) => ({ default: m.AddProvider })));
const SLATracking = lazy(() => import('./pages/SLATracking').then((m) => ({ default: m.SLATracking })));
const Escalations = lazy(() => import('./pages/Escalations').then((m) => ({ default: m.Escalations })));
const ProviderDrawerSections = lazy(() => import('./pages/ProviderDrawerSections'));
const CustomerDrawerSections = lazy(() => import('./pages/CustomerDrawerSections'));
const LandingSettings = lazy(() => import('./pages/LandingSettings'));
const Articles = lazy(() => import('./pages/Articles'));
const Blog = lazy(() => import('./pages/Blog').then((m) => ({ default: m.Blog })));
const ArticleDetail = lazy(() => import('./pages/ArticleDetail').then((m) => ({ default: m.ArticleDetail })));
const DeleteAccount = lazy(() => import('./pages/DeleteAccount').then((m) => ({ default: m.DeleteAccount })));
const BlockedPhones = lazy(() => import('./pages/BlockedPhones'));
const MarketingInsights = lazy(() => import('./pages/MarketingInsights'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-sm text-gray-500">جاري تحميل الصفحة...</div>
    </div>
  );
}

/** يحفظ المسار الحالي حتى يرجع الأدمن لنفس القسم بعد تسجيل الدخول */
function RequireAuth({ isAuthenticated, children }) {
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      const flag = localStorage.getItem('admin_authenticated') === 'true';
      setIsAuthenticated(!!user && flag);
      if (flag && !user) {
        localStorage.removeItem('admin_authenticated');
      }
      setIsLoading(false);
    });

    const handleStorageChange = (e) => {
      if (e.key === 'admin_authenticated') {
        setIsAuthenticated(e.newValue === 'true' && !!auth.currentUser);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      unsubAuth();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<ArticleDetail />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/delete-account" element={<DeleteAccount />} />

          {/* Admin login */}
          <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />

          {/* Admin dashboard – protected */}
          <Route
            path="/admin"
            element={<RequireAuth isAuthenticated={isAuthenticated}><Layout /></RequireAuth>}
          >
            <Route index element={<Dashboard />} />
            <Route path="services" element={<Services />} />
            <Route path="emergency-services" element={<EmergencyServices />} />
            <Route path="providers" element={<Providers />} />
            <Route path="providers-map" element={<ProvidersMap />} />
            <Route path="add-provider" element={<AddProvider />} />
            <Route path="cities" element={<Cities />} />
            <Route path="orders" element={<Orders />} />
            <Route path="distribution" element={<DistributionSettings />} />
            <Route path="dispatch-diagnostics" element={<DispatchDiagnostics />} />
            <Route path="order-test-lab" element={<OrderTestLab />} />
            <Route path="city-managers" element={<CityManagers />} />
            <Route path="users" element={<Users />} />
            <Route path="blocked-phones" element={<BlockedPhones />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="sla-tracking" element={<SLATracking />} />
            <Route path="escalations" element={<Escalations />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="chats" element={<Chats />} />
            <Route path="bank-settings" element={<BankSettings />} />
            <Route path="withdrawal-requests" element={<WithdrawalRequests />} />
            <Route path="wallet-topups" element={<WalletTopUps />} />
            <Route path="provider-profile-requests" element={<ProviderProfileRequests />} />
            <Route path="app-settings" element={<AppSettings />} />
            <Route path="provider-drawer-sections" element={<ProviderDrawerSections />} />
            <Route path="customer-drawer-sections" element={<CustomerDrawerSections />} />
            <Route path="banners" element={<Banners />} />
            <Route path="landing-settings" element={<LandingSettings />} />
            <Route path="articles" element={<Articles />} />
            <Route path="support-tickets" element={<SupportTickets />} />
            <Route path="admins" element={<Admins />} />
            <Route path="marketing-insights" element={<MarketingInsights />} />
            {/* مسار داخلي غير معروف: ابقَ داخل اللوحة بدل الرجوع للصفحة العامة */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
