import { useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserX, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { auth, db, functions } from '../services/firebase';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { SeoHead } from '../components/SeoHead';
import { PAGE_SEO } from '../seo/config';

/** مطابق لـ formatPhoneToInternational في تطبيقات فزّاعين */
function normalizePhone(raw) {
  const clean = String(raw || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  if (clean.startsWith('966')) return clean;
  if (clean.startsWith('05')) return `966${clean.slice(1)}`;
  if (clean.startsWith('0')) return `966${clean.slice(1)}`;
  if (clean.startsWith('5') && clean.length === 9) return `966${clean}`;
  return clean;
}

/** قبول 05xxxxxxxx أو 5xxxxxxxx أو 9665xxxxxxxx — كما في validateSaudiPhone بالتطبيقات */
function validateSaudiMobileInput(raw) {
  const clean = String(raw || '').replace(/[^0-9]/g, '');
  if (clean.length === 10 && clean.startsWith('05')) return true;
  if (clean.length === 9 && clean.startsWith('5')) return true;
  if (clean.length === 12 && clean.startsWith('9665')) return true;
  return false;
}

export const DeleteAccount = () => {
  const [accountType, setAccountType] = useState('customer');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formattedPhone = normalizePhone(phone);

  const sendOtp = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!validateSaudiMobileInput(phone)) {
      setError('أدخل رقم جوال سعودي: 10 أرقام تبدأ بـ 05، أو 9 أرقام تبدأ بـ 5، أو الصيغة الدولية 9665…');
      return;
    }
    if (!/^9665[0-9]{8}$/.test(formattedPhone)) {
      setError('رقم الجوال غير صحيح. تحقق من الأرقام (مثال: 0591234567 أو 591234567)');
      return;
    }
    setLoading(true);
    try {
      const sendOtpFn = httpsCallable(functions, 'sendOTP');
      const { data } = await sendOtpFn({ phoneNumber: formattedPhone });
      if (data && data.success === false && data.error) {
        setError(data.error);
        return;
      }
      setStep('otp');
      setOtp('');
    } catch (err) {
      setError(err.message || 'تعذر إرسال رمز التحقق. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeletion = async (e) => {
    e?.preventDefault?.();
    setError('');
    const code = otp.replace(/\D/g, '');
    if (code.length !== 4) {
      setError('أدخل رمز التحقق المكوّن من 4 أرقام');
      return;
    }
    setLoading(true);
    try {
      const verifyOtpFn = httpsCallable(functions, 'verifyOTP');
      const { data } = await verifyOtpFn({
        phoneNumber: formattedPhone,
        otp: code,
        accountType,
      });
      if (!data?.success) {
        setError(data?.error || 'رمز التحقق غير صحيح');
        return;
      }
      if (!data.customToken) {
        setError(
          accountType === 'provider'
            ? 'لا يوجد حساب مزوّد مسجّل بهذا الرقم'
            : 'لا يوجد حساب عميل مسجّل بهذا الرقم'
        );
        return;
      }
      const credential = await signInWithCustomToken(auth, data.customToken);
      const uid = credential.user.uid;
      const collectionName = accountType === 'provider' ? 'providers' : 'customers';
      const ref = doc(db, collectionName, uid);
      const profileSnap = await getDoc(ref);
      if (!profileSnap.exists()) {
        const otherCol = collectionName === 'providers' ? 'customers' : 'providers';
        const otherRef = doc(db, otherCol, uid);
        const otherSnap = await getDoc(otherRef);
        await signOut(auth);
        if (otherSnap.exists()) {
          setError(
            otherCol === 'customers'
              ? 'هذا الرقم مسجّل كعميل. اختر «عميل» أعلاه ثم أعد إرسال الرمز والتحقق.'
              : 'هذا الرقم مسجّل كمزوّد. اختر «مزوّد خدمة» ثم أعد إرسال الرمز والتحقق.'
          );
        } else {
          setError('لم يُعثر على ملف الحساب في النظام. تواصل مع الدعم.');
        }
        return;
      }
      await updateDoc(ref, {
        accountDeletionRequestedAt: serverTimestamp(),
      });
      await signOut(auth);
      setStep('success');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('No document to update')) {
        setError(
          'لا يوجد ملف مطابق لنوع الحساب المختار. جرّب تغيير «عميل / مزوّد» أو تأكد أن الرقم كما في التطبيق.'
        );
      } else {
        setError(msg || 'تعذر إتمام الطلب');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('phone');
    setOtp('');
    setError('');
    setPhone('');
  };

  return (
    <div className="min-h-screen bg-gray-50 relative" dir="rtl">
      <SeoHead {...PAGE_SEO.deleteAccount} />
      <WhatsAppFloat />

      <div className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 text-white pt-14 pb-16 sm:pt-20 sm:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-xl mx-auto px-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/85 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl flex items-center justify-center">
              <UserX className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs sm:text-sm font-medium">فزّاعين</p>
              <h1 className="text-2xl sm:text-3xl font-black">طلب حذف الحساب</h1>
            </div>
          </div>
          <p className="text-white/85 text-sm sm:text-base leading-relaxed max-w-lg">
            يمكن طلب حذف حساب عميل أو مزوّد بعد التحقق من رقم الجوال. إذا لم يُسجَّل دخول خلال 3 أيام، يُحذف
            الحساب تلقائياً، وتسجيل الدخول خلال تلك المدة يلغي طلب الحذف.
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-8 pb-16 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-10">
          {step === 'success' ? (
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" strokeWidth={2} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">تم تسجيل طلب الحذف</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                سيُحذف حسابك تلقائياً بعد 3 أيام إذا لم تسجّل دخولاً من التطبيق. يمكنك إلغاء الطلب بتسجيل
                الدخول قبل انتهاء المدة.
              </p>
              <Link
                to="/"
                className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
              >
                العودة للرئيسية
              </Link>
            </div>
          ) : (
            <>
              <div className="flex rounded-2xl bg-gray-100 p-1 mb-8">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('customer');
                    setError('');
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                    accountType === 'customer'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  عميل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('provider');
                    setError('');
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                    accountType === 'provider'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  مزوّد خدمة
                </button>
              </div>

              {step === 'phone' && (
                <form onSubmit={sendOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">رقم الجوال</label>
                    <input
                      type="tel"
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition text-left"
                      placeholder="05xxxxxxxx"
                      value={phone}
                      onChange={(ev) => setPhone(ev.target.value)}
                      autoComplete="tel"
                    />
                    <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                      نفس الرقم في حسابك بفزّاعين. يمكن إدخال 10 أرقام (05XXXXXXXX) أو 9 أرقام تبدأ بـ 5 بدون صفر، مثل
                      التطبيقات.
                    </p>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-60 transition-colors"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    إرسال رمز التحقق
                  </button>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={confirmDeletion} className="space-y-5">
                  <p className="text-sm text-gray-600">
                    أدخل الرمز المرسل إلى{' '}
                    <span className="font-mono font-semibold text-gray-900 dir-ltr inline-block">{formattedPhone}</span>
                  </p>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">رمز التحقق</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-400 text-center text-2xl tracking-[0.5em] font-mono"
                      placeholder="••••"
                      value={otp}
                      onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, '').slice(0, 4))}
                      autoComplete="one-time-code"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={resetFlow}
                      className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      تغيير الرقم
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      تأكيد طلب حذف الحساب
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={loading}
                    className="w-full text-sm text-orange-600 font-semibold hover:underline"
                  >
                    إعادة إرسال الرمز
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-8 px-2">
          للمساعدة:{' '}
          <a href="mailto:support@fzaeen.com" className="text-orange-600 font-medium hover:underline">
            support@fzaeen.com
          </a>
        </p>
      </div>
    </div>
  );
};
