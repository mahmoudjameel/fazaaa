import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { WhatsAppFloat } from './WhatsAppFloat';
import { db } from '../services/firebase';

const formatLastUpdated = (value) => {
  if (!value) return null;
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

/**
 * صفحة قانونية عامة — تقرأ المحتوى من Firestore (لوحة الأدمن)
 */
export function LegalDocumentPage({
  docId,
  defaultTitle,
  subtitle,
  Icon,
  headerGradient,
  iconWrapClass,
  iconClass,
  otherLink,
  fallbackContent,
}) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', docId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.title) setTitle(data.title);
          if (typeof data.content === 'string') setContent(data.content);
          setLastUpdated(data.lastUpdated || null);
        }
      } catch (error) {
        console.error(`Error loading ${docId}:`, error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const updatedLabel = formatLastUpdated(lastUpdated);
  const hasCmsContent = content.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50 relative" dir="rtl">
      <WhatsAppFloat />

      <div className={`${headerGradient} text-white pt-16 pb-20 sm:pt-20 sm:pb-28 relative overflow-hidden`}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-300/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 backdrop-blur-sm border rounded-2xl flex items-center justify-center ${iconWrapClass}`}>
              <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${iconClass}`} />
            </div>
            <div>
              <p className="text-white/70 text-xs sm:text-sm font-medium">فزّاعين</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black">{title}</h1>
            </div>
          </div>
          {subtitle ? (
            <p className="text-white/80 text-sm sm:text-base max-w-2xl">{subtitle}</p>
          ) : null}
          {updatedLabel ? (
            <p className="text-white/60 text-xs sm:text-sm mt-3">آخر تحديث: {updatedLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 pb-16 sm:pb-24 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-10 lg:p-14">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent" />
              <p className="text-sm text-gray-500">جاري تحميل المحتوى...</p>
            </div>
          ) : hasCmsContent ? (
            <div className="text-gray-700 leading-8 text-sm sm:text-base whitespace-pre-wrap">
              {content}
            </div>
          ) : (
            fallbackContent
          )}

          <div className="border-t border-gray-100 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-xs">© {new Date().getFullYear()} فزّاعين – جميع الحقوق محفوظة</p>
            <div className="flex gap-4">
              <Link to="/" className="text-orange-500 text-sm font-medium hover:underline">
                الرئيسية
              </Link>
              {otherLink ? (
                <Link to={otherLink.to} className="text-orange-500 text-sm font-medium hover:underline">
                  {otherLink.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
