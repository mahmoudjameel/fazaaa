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
import { Complaints } from './pages/Complaints';
import BankSettings from './pages/BankSettings';
import WithdrawalRequests from './pages/WithdrawalRequests';
import AppSettings from './pages/AppSettings';
import Admins from './pages/Admins';
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
          <Route path="cities" element={<Cities />} />
          <Route path="orders" element={<Orders />} />
          <Route path="distribution" element={<DistributionSettings />} />
          <Route path="city-managers" element={<CityManagers />} />
          <Route path="users" element={<Users />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="bank-settings" element={<BankSettings />} />
          <Route path="withdrawal-requests" element={<WithdrawalRequests />} />
          <Route path="app-settings" element={<AppSettings />} />
          <Route path="admins" element={<Admins />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

