import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Shield, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

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

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // التحقق من صلاحيات المدير من مجموعة app_admins
      const adminDocRef = doc(db, 'app_admins', user.uid);
      const adminDoc = await getDoc(adminDocRef);

      if (adminDoc.exists()) {
        const adminData = adminDoc.data();

        // حفظ بيانات الجلسة والصلاحيات
        localStorage.setItem('admin_authenticated', 'true');
        localStorage.setItem('admin_role', adminData.role || 'viewer');
        localStorage.setItem('admin_permissions', JSON.stringify(adminData.permissions || []));
        localStorage.setItem('admin_email', user.email);
        localStorage.setItem('admin_name', adminData.name || 'Admin');

        if (onLogin) {
          onLogin();
        }
        navigate('/');
      } else {
        // BOOTSTRAP: إذا كان هذا هو البريد "admin@fazaaa.com" أو المستخدم يحاول الدخول كمدير رئيسي
        // سنقوم بإنشاء السجل تلقائياً لتسهيل الدخول الأول
        const BOOTSTRAP_EMAILS = ['admin@fazaaa.com', 'ma7moudos@gmail.com'];

        if (BOOTSTRAP_EMAILS.includes(email.toLowerCase()) || email.startsWith('admin')) {
          await setDoc(adminDocRef, {
            name: 'Main Admin',
            email: user.email,
            role: 'super_admin',
            permissions: [],
            isActive: true,
            createdAt: serverTimestamp()
          });

          // Proceed as Super Admin
          localStorage.setItem('admin_authenticated', 'true');
          localStorage.setItem('admin_role', 'super_admin');
          localStorage.setItem('admin_permissions', JSON.stringify([]));
          localStorage.setItem('admin_email', user.email);
          localStorage.setItem('admin_name', 'Main Admin');

          if (onLogin) onLogin();
          navigate('/');
          return;
        }

        // إذا لم يكن لديه سجل في app_admins (حتى لو كان مسجل في Auth)
        setError('ليس لديك صلاحية الوصول للوحة التحكم');
        await auth.signOut();
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-login-credentials' || err.code === 'auth/invalid-email' || err.code === 'auth/wrong-password') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (err.code === 'auth/too-many-requests') {
        setError('تم حظر المحاولات مؤقتاً، يرجى المحاولة لاحقاً');
      } else {
        setError('حدث خطأ في تسجيل الدخول');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultAdmin = async () => {
    if (!window.confirm('هل تريد إنشاء حساب المدير الافتراضي (admin@fazaaa.com)؟')) return;
    setIsLoading(true);
    try {
      // 1. Create Auth User

      try {
        await createUserWithEmailAndPassword(auth, 'admin@fazaaa.com', '123456');
      } catch (authError) {
        if (authError.code !== 'auth/email-already-in-use') {
          throw authError;
        }
        // If already exists, we proceed to update permissions
        console.log('User already exists, updating permissions...');
      }

      // 2. Create Admin Doc
      const adminDocRef = doc(db, 'app_admins', auth.currentUser?.uid || (await signInWithEmailAndPassword(auth, 'admin@fazaaa.com', '123456')).user.uid);

      await setDoc(adminDocRef, {
        name: 'Main Admin',
        email: 'admin@fazaaa.com',
        role: 'super_admin',
        permissions: [],
        isActive: true,
        createdAt: serverTimestamp()
      });

      alert('تم إنشاء حساب المدير الافتراضي بنجاح! يمكنك الآن تسجيل الدخول.');
      setEmail('admin@fazaaa.com');
      setPassword('123456');
    } catch (error) {
      console.error('Error creating default admin:', error);
      alert('حدث خطأ: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-orange via-orange-400 to-primary-yellow flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-large p-6 sm:p-8 md:p-10">
          {/* Logo Section */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-orange to-primary-yellow rounded-xl sm:rounded-2xl shadow-medium mb-3 sm:mb-4">
              <Shield className="text-white w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-text-primary mb-1 sm:mb-2">
              فزّاعين
            </h1>
            <p className="text-sm sm:text-base text-text-secondary font-medium">لوحة تحكم المدير</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-status-error p-3 sm:p-4 rounded-xl text-xs sm:text-sm font-semibold animate-fadeIn">
                {error}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-text-primary mb-1 sm:mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail
                  className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-text-secondary w-4 h-4 sm:w-5 sm:h-5"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-10 sm:pr-12 pl-4 py-2.5 sm:py-3.5 border-2 border-border-light rounded-lg sm:rounded-xl focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:outline-none transition-all text-text-primary font-medium text-sm sm:text-base"
                  placeholder="admin@fazaaa.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-text-primary mb-1 sm:mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-text-secondary w-4 h-4 sm:w-5 sm:h-5"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 sm:pr-12 pl-10 sm:pl-12 py-2.5 sm:py-3.5 border-2 border-border-light rounded-lg sm:rounded-xl focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:outline-none transition-all text-text-primary font-medium text-sm sm:text-base"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-orange to-primary-yellow text-white font-bold py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl hover:shadow-large transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </form>

          {/* Dev Helper - Default Admin Setup */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={createDefaultAdmin}
              className="text-xs text-blue-600 hover:underline"
            >
              (Dev) إعداد حساب المدير الافتراضي
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-white/90 text-xs sm:text-sm mt-4 sm:mt-6 font-medium">
            © 2024 فزّاعين - جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
};
