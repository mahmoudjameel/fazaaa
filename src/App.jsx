import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Terms } from './pages/Terms';
import { Dashboard } from './pages/Dashboard';
import { Services } from './pages/Services';
import { EmergencyServices } from './pages/EmergencyServices';
import { Providers } from './pages/Providers';
import { Cities } from './pages/Cities';
import { Orders } from './pages/Orders';
import { DistributionSettings } from './pages/DistributionSettings';
import { CityManagers } from './pages/CityManagers';
import { Users } from './pages/Users';
import { Notifications } from './pages/Notifications';
import { Complaints } from './pages/Complaints';
import { Chats } from './pages/Chats';
import BankSettings from './pages/BankSettings';
import WithdrawalRequests from './pages/WithdrawalRequests';
import ProviderProfileRequests from './pages/ProviderProfileRequests';
import AppSettings from './pages/AppSettings';
import Admins from './pages/Admins';
import Banners from './pages/Banners';
import { SupportTickets } from './pages/SupportTickets';
import { AddProvider } from './pages/AddProvider';
import { SLATracking } from './pages/SLATracking';
import { Login } from './pages/Login';
import ProviderDrawerSections from './pages/ProviderDrawerSections';
import CustomerDrawerSections from './pages/CustomerDrawerSections';
import LandingSettings from './pages/LandingSettings';
import { DeleteAccount } from './pages/DeleteAccount';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authStatus = localStorage.getItem('admin_authenticated') === 'true';
      setIsAuthenticated(authStatus);
      setIsLoading(false);
    };

    checkAuth();

    const handleStorageChange = (e) => {
      if (e.key === 'admin_authenticated') {
        setIsAuthenticated(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(checkAuth, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
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
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/delete-account" element={<DeleteAccount />} />

        {/* Admin login */}
        <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />

        {/* Admin dashboard – protected */}
        <Route
          path="/admin"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Dashboard />} />
          <Route path="services" element={<Services />} />
          <Route path="emergency-services" element={<EmergencyServices />} />
          <Route path="providers" element={<Providers />} />
          <Route path="add-provider" element={<AddProvider />} />
          <Route path="cities" element={<Cities />} />
          <Route path="orders" element={<Orders />} />
          <Route path="distribution" element={<DistributionSettings />} />
          <Route path="city-managers" element={<CityManagers />} />
          <Route path="users" element={<Users />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="sla-tracking" element={<SLATracking />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="chats" element={<Chats />} />
          <Route path="bank-settings" element={<BankSettings />} />
          <Route path="withdrawal-requests" element={<WithdrawalRequests />} />
          <Route path="provider-profile-requests" element={<ProviderProfileRequests />} />
          <Route path="app-settings" element={<AppSettings />} />
          <Route path="provider-drawer-sections" element={<ProviderDrawerSections />} />
          <Route path="customer-drawer-sections" element={<CustomerDrawerSections />} />
          <Route path="banners" element={<Banners />} />
          <Route path="landing-settings" element={<LandingSettings />} />
          <Route path="support-tickets" element={<SupportTickets />} />
          <Route path="admins" element={<Admins />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
