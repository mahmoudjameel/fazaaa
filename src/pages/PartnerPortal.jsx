import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { auth, db, functions } from '../services/firebase';

const call = async (name, payload) => (await httpsCallable(functions, name)(payload)).data;

const STATUS_TEXT = {
  searching: 'نبحث عن أقرب مزود',
  assigned: 'قبل المزود طلبك',
  en_route: 'المزود في الطريق',
  arrived: 'المزود وصل',
  in_progress: 'المزود ينفذ الخدمة',
  pending_legal_docs: 'بانتظار استكمال المستندات',
  pending_client_confirmation: 'بانتظار التأكيد',
  pending_review: 'قيد المراجعة',
  completed: 'اكتملت الخدمة',
  timed_out: 'لا يوجد مزود متاح الآن',
};

const inputCls = 'w-full min-w-0 min-h-[48px] px-3 bg-white border border-gray-300 rounded-xl text-base focus:outline-none focus:border-teal-600';
const primaryCls = 'w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-teal-700 text-white text-base font-bold disabled:opacity-50';

const toSaudiPhone = (value) => {
  const digits = String(value || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const local = digits.replace(/^(00)?966/, '').replace(/^0/, '');
  return /^5\d{8}$/.test(local) ? `966${local}` : null;
};

const available = (membership, key) => (membership.remaining?.[key] || 0) - (membership.reserved?.[key] || 0);

const groupKeyOf = (membership, service) => (membership.services || [])
  .find((s) => (s.parentServiceIds || []).map(String).includes(String(service.parentServiceId)))?.key;

const Screen = ({ title, children }) => (
  <main dir="rtl" className="min-h-screen bg-gray-50 px-4 py-6 flex justify-center">
    <div className="w-full max-w-[480px] space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-teal-700 flex-shrink-0" />
        <h1 className="text-xl font-black text-gray-900 min-w-0 break-words">{title}</h1>
      </header>
      {children}
    </div>
  </main>
);

const Card = ({ children }) => <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">{children}</section>;

const PhoneStep = ({ onSignedIn }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر إكمال العملية');
    } finally {
      setBusy(false);
    }
  };

  const send = () => run(async () => {
    const formatted = toSaudiPhone(phone);
    if (!formatted) throw new Error('اكتب رقم جوال سعودي صحيح');
    const result = await call('sendOTP', { phoneNumber: formatted, accountType: 'customer' });
    if (result.success === false) throw new Error(result.error || 'تعذر إرسال الرمز');
    setSentTo(formatted);
  });

  const verify = () => run(async () => {
    const result = await call('verifyOTP', { phoneNumber: sentTo, otp, accountType: 'customer', partnerPortal: true });
    if (!result.success || !result.customToken) throw new Error(result.error || 'رمز التحقق غير صحيح');
    await signInWithCustomToken(auth, result.customToken);
    onSignedIn();
  });

  return (
    <Card>
      {sentTo ? (
        <>
          <label className="block text-sm font-bold text-gray-800">رمز التحقق
            <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className={`${inputCls} mt-1`} dir="ltr" />
          </label>
          {error && <p className="text-sm font-bold text-red-700">{error}</p>}
          <button type="button" disabled={busy || !otp} onClick={verify} className={primaryCls}>تأكيد</button>
        </>
      ) : (
        <>
          <label className="block text-sm font-bold text-gray-800">رقم الجوال
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="05xxxxxxxx" className={`${inputCls} mt-1`} dir="ltr" />
          </label>
          {error && <p className="text-sm font-bold text-red-700">{error}</p>}
          <button type="button" disabled={busy} onClick={send} className={primaryCls}>إرسال رمز التحقق</button>
        </>
      )}
    </Card>
  );
};

const RequestStep = ({ memberships, services, onCreated }) => {
  const usable = useMemo(() => memberships.filter((m) => m.status === 'active'), [memberships]);
  const [membershipId, setMembershipId] = useState(usable[0]?.id || '');
  const [subServiceId, setSubServiceId] = useState('');
  const [position, setPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const membership = usable.find((m) => m.id === membershipId);
  const options = membership
    ? services.filter((service) => {
      const key = groupKeyOf(membership, service);
      return key && available(membership, key) > 0;
    })
    : [];

  const locate = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('جهازك لا يدعم تحديد الموقع');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setError('اسمح بالوصول للموقع ثم حاول مرة ثانية'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { requestId } = await call('createPartnerRequest', { membershipId, subServiceId, coordinates: position, location: 'موقع محدد من صفحة الشركة' });
      onCreated(requestId);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  };

  if (usable.length === 0) {
    const waiting = memberships.find((m) => m.status === 'pending_activation');
    return (
      <Card>
        <p className="text-base font-bold text-gray-900">{waiting ? 'الباقة لم تتفعّل بعد' : 'لا توجد سيارة مشمولة على جوالك'}</p>
        <p className="text-sm leading-6 text-gray-600">
          {waiting
            ? `تتفعّل في ${new Date(waiting.activatesAtMs).toLocaleString('ar-SA-u-ca-gregory-nu-latn')}.`
            : 'لا يمكن الطلب على هذه الباقة من هذا الرقم. تواصل مع الجهة، أو اطلب طلباً شخصياً من تطبيق فزاعين على حسابك.'}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <label className="block text-sm font-bold text-gray-800">السيارة
        <select value={membershipId} onChange={(e) => { setMembershipId(e.target.value); setSubServiceId(''); }} className={`${inputCls} mt-1`}>
          {usable.map((m) => <option key={m.id} value={m.id}>{[m.vehicle?.make, m.vehicle?.model].filter(Boolean).join(' ')} · {m.vehicle?.plate}</option>)}
        </select>
      </label>
      <p className="text-sm font-bold text-teal-800 bg-teal-50 rounded-lg p-3">
        هذه السيارة مشمولة: الطلب على باقة {membership?.partnerName || 'فزاعين'}. الأجرة مدفوعة، وثمن القطع عليك.
      </p>
      <label className="block text-sm font-bold text-gray-800">الخدمة
        <select value={subServiceId} onChange={(e) => setSubServiceId(e.target.value)} className={`${inputCls} mt-1`}>
          <option value="">اختر الخدمة</option>
          {options.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
      </label>
      {options.length === 0 && <p className="text-sm text-gray-600">استُهلكت كل خدمات الباقة.</p>}
      <button type="button" onClick={locate} className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 text-base font-bold text-gray-800">
        <MapPin className="w-5 h-5" /> {position ? 'تم تحديد موقعك' : 'حدد موقعي'}
      </button>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      <button type="button" disabled={busy || !subServiceId || !position} onClick={submit} className={primaryCls}>
        {busy && <Loader2 className="w-5 h-5 animate-spin" />} إرسال الطلب
      </button>
    </Card>
  );
};

const TrackingStep = ({ requestId }) => {
  const [request, setRequest] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'requests', requestId), (snap) => setRequest(snap.data())), [requestId]);
  if (!request) return <Card><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></Card>;
  return (
    <Card>
      <p className="flex items-center gap-2 text-base font-black text-gray-900"><CheckCircle2 className="w-5 h-5 text-teal-700" /> طلب #{request.orderNumber}</p>
      <p className="text-lg font-bold text-teal-800">{STATUS_TEXT[request.status] || 'تم إلغاء الطلب'}</p>
      <p className="text-sm text-gray-700">{request.serviceName}</p>
      {request.coverage && <p className="text-sm font-bold text-gray-700">مدفوع من الباقة. لا تدفع أجرة الخدمة، وثمن القطع عليك.</p>}
      {request.coverageRejected && <p className="text-sm font-bold text-amber-800">{request.coverageRejected.message}</p>}
    </Card>
  );
};

export const PartnerPortal = () => {
  const { slug } = useParams();
  const [partnerData, setPartnerData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [memberships, setMemberships] = useState(null);
  const [requestId, setRequestId] = useState(null);

  useEffect(() => {
    call('getPartnerBySlug', { slug }).then(setPartnerData).catch((e) => {
      console.error(e);
      setFailed(true);
    });
  }, [slug]);

  const loadMemberships = async () => {
    try {
      setMemberships((await call('getMyMemberships', {})).memberships || []);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };

  if (failed) return <Screen title="فزاعين"><Card><p className="text-base font-bold text-gray-900">الرابط غير صحيح أو الخدمة غير متاحة الآن.</p></Card></Screen>;
  if (!partnerData) return <Screen title="فزاعين"><Card><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></Card></Screen>;

  const title = partnerData.partner.name;
  if (requestId) return <Screen title={title}><TrackingStep requestId={requestId} /></Screen>;
  if (!memberships) return <Screen title={title}><PhoneStep onSignedIn={loadMemberships} /></Screen>;
  return (
    <Screen title={title}>
      <RequestStep memberships={memberships} services={partnerData.services} onCreated={setRequestId} />
    </Screen>
  );
};
