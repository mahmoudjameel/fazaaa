import { useEffect, useState } from 'react';
import { Package, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { collection, doc, onSnapshot, writeBatch, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * إدارة باقات شحن المزود — مجموعة wallet_packages.
 * فارغة = الباقات الافتراضية (نفس قيم السيرفر في functions/lib/alrajhi/packages.js).
 * أول تعديل يحفظ الافتراضية ثم يطبّق التعديل عليها.
 */
const COLLECTION = 'wallet_packages';
const DEFAULT_PACKAGES = [
  { id: 'services_4', serviceCredits: 4, amountSar: 40, active: true, sortOrder: 0 },
  { id: 'services_10', serviceCredits: 10, amountSar: 100, active: true, sortOrder: 1 },
];
const MAX_AMOUNT = 5000;
const MAX_CREDITS = 500;

const labelFor = (credits) => `إضافة رصيد ${credits} ${credits > 10 ? 'خدمة' : 'خدمات'}`;

export function WalletPackagesManager() {
  const [docs, setDocs] = useState(null);
  const [editing, setEditing] = useState(null); // { id|null, serviceCredits, amountSar }
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(collection(db, COLLECTION), (snap) => {
    setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (e) => {
    console.error('wallet_packages:', e);
    setDocs([]);
  }), []);

  const isDefault = docs !== null && docs.length === 0;
  const list = (isDefault ? DEFAULT_PACKAGES : docs || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.serviceCredits - b.serviceCredits);
  const activeCount = list.filter((p) => p.active !== false).length;

  /** يحفظ الافتراضية في Firestore أول مرة حتى يصبح التعديل عليها ممكناً */
  const ensureSeeded = async () => {
    if (!isDefault) return;
    const batch = writeBatch(db);
    DEFAULT_PACKAGES.forEach(({ id, ...p }) => {
      batch.set(doc(db, COLLECTION, id), { ...p, labelAr: labelFor(p.serviceCredits), updatedAt: new Date().toISOString() });
    });
    await batch.commit();
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      await ensureSeeded();
      await fn();
    } catch (e) {
      console.error('WalletPackagesManager:', e);
      alert('تعذّر الحفظ: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const serviceCredits = Number(editing.serviceCredits);
    const amountSar = Number(editing.amountSar);
    if (!Number.isInteger(serviceCredits) || serviceCredits <= 0 || serviceCredits > MAX_CREDITS) {
      alert(`عدد الطلبات لازم يكون رقم صحيح بين 1 و ${MAX_CREDITS}`);
      return;
    }
    if (!Number.isFinite(amountSar) || amountSar <= 0 || amountSar > MAX_AMOUNT) {
      alert(`السعر لازم يكون بين 1 و ${MAX_AMOUNT} ر.س`);
      return;
    }
    run(async () => {
      const data = { serviceCredits, amountSar, labelAr: labelFor(serviceCredits), updatedAt: new Date().toISOString() };
      if (editing.id) {
        await updateDoc(doc(db, COLLECTION, editing.id), data);
      } else {
        const id = `pkg_${serviceCredits}_${Date.now().toString(36)}`;
        const maxOrder = Math.max(-1, ...list.map((p) => p.sortOrder ?? 0));
        await setDoc(doc(db, COLLECTION, id), { ...data, active: true, sortOrder: maxOrder + 1 });
      }
      setEditing(null);
    });
  };

  const toggleActive = (p) => {
    if (p.active !== false && activeCount <= 1) {
      alert('لازم تبقى باقة واحدة مفعّلة على الأقل');
      return;
    }
    run(() => updateDoc(doc(db, COLLECTION, p.id), { active: p.active === false }));
  };

  const remove = (p) => {
    if (p.active !== false && activeCount <= 1) {
      alert('لازم تبقى باقة واحدة مفعّلة على الأقل');
      return;
    }
    if (!window.confirm(`حذف باقة ${p.serviceCredits} طلبات؟`)) return;
    run(() => deleteDoc(doc(db, COLLECTION, p.id)));
  };

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    run(async () => {
      const reordered = list.slice();
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      const batch = writeBatch(db);
      reordered.forEach((p, i) => batch.update(doc(db, COLLECTION, p.id), { sortOrder: i }));
      await batch.commit();
    });
  };

  const resetToDefault = () => {
    if (!window.confirm('الرجوع للباقات الافتراضية (4 و 10)؟ سيتم حذف كل الباقات المخصّصة.')) return;
    setBusy(true);
    const batch = writeBatch(db);
    (docs || []).forEach((p) => batch.delete(doc(db, COLLECTION, p.id)));
    batch.commit()
      .catch((e) => alert('تعذّر الرجوع: ' + (e?.message || e)))
      .finally(() => setBusy(false));
  };

  const inputCls = 'w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-teal-400';

  const editor = (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200">
      <input
        type="number" min="1" step="1" placeholder="الطلبات" className={inputCls}
        value={editing?.serviceCredits ?? ''}
        onChange={(e) => setEditing({ ...editing, serviceCredits: e.target.value })}
      />
      <span className="text-sm font-semibold text-gray-600">طلبات بسعر</span>
      <input
        type="number" min="1" step="any" placeholder="السعر" className={inputCls}
        value={editing?.amountSar ?? ''}
        onChange={(e) => setEditing({ ...editing, amountSar: e.target.value })}
      />
      <span className="text-sm font-semibold text-gray-600">ر.س</span>
      <button onClick={save} disabled={busy} className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50" aria-label="حفظ">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => setEditing(null)} className="p-2 rounded-lg bg-white text-gray-500 border border-gray-200" aria-label="إلغاء">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">باقات الشحن</h2>
            <p className="text-xs text-gray-500">
              {isDefault ? 'الباقات الافتراضية مفعّلة — أي تعديل يحفظها ويطبّق عليها' : 'باقات مخصّصة من لوحة التحكم — تظهر للمزود بنفس الترتيب'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin text-teal-600" />}
          {!isDefault && docs !== null && (
            <button onClick={resetToDefault} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" /> الافتراضية
            </button>
          )}
          <button
            onClick={() => setEditing({ id: null, serviceCredits: '', amountSar: '' })}
            disabled={busy || docs === null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> إضافة باقة
          </button>
        </div>
      </div>

      {docs === null ? (
        <div className="py-6 flex justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {editing && !editing.id && editor}
          {list.map((p, i) => (
            editing?.id === p.id ? <div key={p.id}>{editor}</div> : (
              <div
                key={p.id}
                className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border ${p.active === false ? 'bg-gray-50 border-gray-100 opacity-60' : 'border-teal-100'}`}
              >
                <div className="flex items-baseline gap-1.5 min-w-[90px]">
                  <span className="text-2xl font-black text-teal-600">{p.serviceCredits}</span>
                  <span className="text-sm font-bold text-gray-700">طلبات</span>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <div className="font-black text-gray-900">{p.amountSar} ر.س</div>
                  <div className="text-xs text-gray-500">
                    {(p.amountSar / p.serviceCredits).toFixed(2).replace(/\.00$/, '')} ر.س للطلب
                    {isDefault && <span className="mr-2 text-teal-600 font-bold">· افتراضي</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-30" aria-label="رفع">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={busy || i === list.length - 1} className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-30" aria-label="خفض">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(p)}
                    disabled={busy}
                    className={`px-3 py-2 rounded-lg text-xs font-bold ${p.active === false ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {p.active === false ? 'مخفية' : 'ظاهرة'}
                  </button>
                  <button onClick={() => setEditing({ id: p.id, serviceCredits: p.serviceCredits, amountSar: p.amountSar })} disabled={busy} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" aria-label="تعديل">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(p)} disabled={busy} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" aria-label="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
