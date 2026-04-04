import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Save, Building2, CreditCard, Phone, MessageCircle, Loader2 } from 'lucide-react';

const inputClass =
  'w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-all text-gray-800 placeholder-gray-400';

const labelClass = 'flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2';

export default function BankSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankInfo, setBankInfo] = useState({
    bankName: '',
    accountName: '',
    iban: '',
    phone: '',
    whatsapp: '',
  });

  useEffect(() => {
    loadBankInfo();
  }, []);

  const loadBankInfo = async () => {
    try {
      const docRef = doc(db, 'settings', 'bankInfo');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setBankInfo(docSnap.data());
      }
    } catch (error) {
      console.error('Error loading bank info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', 'bankInfo');
      await setDoc(docRef, {
        ...bankInfo,
        updatedAt: new Date().toISOString(),
      });
      alert('تم حفظ بيانات البنك بنجاح');
    } catch (error) {
      console.error('Error saving bank info:', error);
      alert('فشل حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setBankInfo((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent" />
        <p className="text-sm text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إعدادات البنك</h1>
        <p className="text-gray-500 mt-1 text-sm">إدارة معلومات الحساب البنكي لاستقبال التحويلات</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            بيانات الحساب البنكي
          </h2>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className={labelClass}>
              <Building2 className="w-4 h-4 text-amber-500" />
              اسم البنك
            </label>
            <input
              type="text"
              value={bankInfo.bankName}
              onChange={(e) => handleChange('bankName', e.target.value)}
              className={inputClass}
              placeholder="مثال: البنك الأهلي السعودي"
              dir="rtl"
            />
          </div>

          <div>
            <label className={labelClass}>
              <CreditCard className="w-4 h-4 text-amber-500" />
              اسم الحساب
            </label>
            <input
              type="text"
              value={bankInfo.accountName}
              onChange={(e) => handleChange('accountName', e.target.value)}
              className={inputClass}
              placeholder="مثال: فزاعين للخدمات"
              dir="rtl"
            />
          </div>

          <div>
            <label className={labelClass}>
              <CreditCard className="w-4 h-4 text-amber-500" />
              رقم الآيبان (IBAN)
            </label>
            <input
              type="text"
              value={bankInfo.iban}
              onChange={(e) => handleChange('iban', e.target.value)}
              className={inputClass + ' font-mono tracking-wider'}
              placeholder="SA0000000000000000000000"
              maxLength="24"
            />
            <p className="text-xs text-gray-400 mt-1.5">يجب أن يبدأ بـ SA ويتكون من 24 رقم</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>
                <Phone className="w-4 h-4 text-amber-500" />
                رقم الهاتف
              </label>
              <input
                type="tel"
                value={bankInfo.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={inputClass}
                placeholder="00966xxxxxxxxx"
                dir="ltr"
              />
            </div>

            <div>
              <label className={labelClass}>
                <MessageCircle className="w-4 h-4 text-green-500" />
                واتساب
              </label>
              <input
                type="tel"
                value={bankInfo.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                className={inputClass}
                placeholder="00966xxxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 text-gray-950 rounded-xl font-bold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 text-sm">معاينة البيانات</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'البنك', value: bankInfo.bankName },
            { label: 'الحساب', value: bankInfo.accountName },
            { label: 'الهاتف', value: bankInfo.phone },
            { label: 'واتساب', value: bankInfo.whatsapp },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-gray-500">{label}:</span>
              <span className="font-medium text-gray-800">{value || <span className="text-gray-300">غير محدد</span>}</span>
            </div>
          ))}
          <div className="md:col-span-2 flex items-center gap-2">
            <span className="text-gray-500">IBAN:</span>
            <span className="font-mono font-medium text-gray-800 tracking-wider">{bankInfo.iban || <span className="text-gray-300">غير محدد</span>}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
