import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import TermsSettings from './pages/TermsSettings';
import { Login } from './pages/Login';

function App() {
  const isAuthenticated = localStorage.getItem('admin_authenticated') === 'true';

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
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
          <Route path="terms-settings" element={<TermsSettings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

