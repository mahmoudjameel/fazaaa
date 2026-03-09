import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
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
import { Login } from './pages/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // التحقق من حالة المصادقة عند التحميل
    const checkAuth = () => {
      const authStatus = localStorage.getItem('admin_authenticated') === 'true';
      setIsAuthenticated(authStatus);
      setIsLoading(false);
    };

    checkAuth();

    // الاستماع لتغييرات localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'admin_authenticated') {
        setIsAuthenticated(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // التحقق الدوري من حالة المصادقة (للتأكد من التحديثات في نفس النافذة)
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
        <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
        <Route
          path="/"
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
          <Route path="complaints" element={<Complaints />} />
          <Route path="chats" element={<Chats />} />
          <Route path="bank-settings" element={<BankSettings />} />
          <Route path="withdrawal-requests" element={<WithdrawalRequests />} />
          <Route path="provider-profile-requests" element={<ProviderProfileRequests />} />
          <Route path="app-settings" element={<AppSettings />} />
          <Route path="banners" element={<Banners />} />
          <Route path="support-tickets" element={<SupportTickets />} />
          <Route path="admins" element={<Admins />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

