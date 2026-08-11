import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  applyAdminSessionFromDoc,
  canAccessAdminPath,
  getAdminSessionFromStorage,
  getFirstAllowedAdminPath,
} from '../utils/adminPermissions';
import { ShieldX } from 'lucide-react';

/**
 * يحمي محتوى لوحة التحكم:
 * - يحدّث الصلاحيات من Firestore عند الدخول
 * - يمنع فتح أي مسار غير مصرّح به حتى لو عُرف الرابط
 */
export function AdminRouteGuard({ children }) {
  const location = useLocation();
  const [session, setSession] = useState(() => getAdminSessionFromStorage());
  const [ready, setReady] = useState(false);
  const [deniedAccount, setDeniedAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        if (!cancelled) {
          setDeniedAccount(true);
          setReady(true);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'app_admins', uid));
        if (cancelled) return;

        if (!snap.exists()) {
          setDeniedAccount(true);
          setReady(true);
          return;
        }

        const data = snap.data() || {};
        if (data.isActive === false) {
          setDeniedAccount(true);
          setReady(true);
          return;
        }

        const next = applyAdminSessionFromDoc(data, auth.currentUser?.email);
        setSession(next);
        setDeniedAccount(false);
      } catch (e) {
        console.error('AdminRouteGuard sync failed:', e);
        setSession(getAdminSessionFromStorage());
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
        جاري التحقق من الصلاحيات...
      </div>
    );
  }

  if (deniedAccount) {
    return <Navigate to="/login" replace state={{ reason: 'no_admin_access' }} />;
  }

  const allowed = canAccessAdminPath(location.pathname, session);
  if (allowed) return children;

  const fallback = getFirstAllowedAdminPath(session);
  if (fallback && fallback !== location.pathname) {
    return <Navigate to={fallback} replace />;
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-4" dir="rtl">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <ShieldX className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-black text-gray-900">لا توجد صلاحية لهذا الصفحة</h2>
      <p className="text-sm text-gray-500 max-w-md">
        حسابك لا يملك صلاحية فتح هذا المسار. اطلب من المدير الرئيسي تفعيل الصلاحية المطلوبة من «إدارة المديرين والصلاحيات».
      </p>
    </div>
  );
}
