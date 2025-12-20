import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Shield, Eye, EyeOff } from 'lucide-react';

export const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      if (email === 'admin@fazaaa.com' && password === 'admin123') {
        localStorage.setItem('admin_authenticated', 'true');
        if (onLogin) {
          onLogin();
        }
        navigate('/');
      } else {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-orange via-orange-400 to-primary-yellow flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo Card */}
        <div className="bg-white rounded-3xl shadow-large p-8 sm:p-10">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-orange to-primary-yellow rounded-2xl shadow-medium mb-4">
              <Shield className="text-white" size={40} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-2">
              فزّاعين
            </h1>
            <p className="text-text-secondary font-medium">لوحة تحكم المدير</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-status-error p-4 rounded-xl text-sm font-semibold animate-fadeIn">
                {error}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-sm font-bold text-text-primary mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-secondary"
                  size={20}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-12 pl-4 py-3.5 border-2 border-border-light rounded-xl focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:outline-none transition-all text-text-primary font-medium"
                  placeholder="admin@fazaaa.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-bold text-text-primary mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-secondary"
                  size={20}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-12 pl-12 py-3.5 border-2 border-border-light rounded-xl focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:outline-none transition-all text-text-primary font-medium"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-orange to-primary-yellow text-white font-bold py-3.5 rounded-xl hover:shadow-large transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>

          {/* Info Section */}
          <div className="mt-6 pt-6 border-t border-border-light">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-800 font-semibold text-center">
                البيانات الافتراضية للدخول:
              </p>
              <div className="mt-2 text-center space-y-1">
                <p className="text-sm font-bold text-blue-900">
                  admin@fazaaa.com
                </p>
                <p className="text-sm font-bold text-blue-900">admin123</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/90 text-sm mt-6 font-medium">
          © 2024 فزّاعين - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
};
