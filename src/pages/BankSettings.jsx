import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Save, Building2, CreditCard, Phone, MessageCircle } from 'lucide-react';

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
        setBankInfo(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">إعدادات البنك</h1>
                <p className="text-gray-600 mt-1">إدارة معلومات الحساب البنكي لاستقبال التحويلات</p>
            </div>

            <div className="bg-white rounded-lg shadow-md">
                <div className="p-6 space-y-6">
                    {/* Bank Name */}
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <Building2 className="w-4 h-4 ml-2 text-teal-600" />
                            اسم البنك
                        </label>
                        <input
                            type="text"
                            value={bankInfo.bankName}
                            onChange={(e) => handleChange('bankName', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="مثال: البنك الأهلي السعودي"
                            dir="rtl"
                        />
                    </div>

                    {/* Account Name */}
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <CreditCard className="w-4 h-4 ml-2 text-teal-600" />
                            اسم الحساب
                        </label>
                        <input
                            type="text"
                            value={bankInfo.accountName}
                            onChange={(e) => handleChange('accountName', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="مثال: فزاعين للخدمات"
                            dir="rtl"
                        />
                    </div>

                    {/* IBAN */}
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <CreditCard className="w-4 h-4 ml-2 text-teal-600" />
                            رقم الآيبان (IBAN)
                        </label>
                        <input
                            type="text"
                            value={bankInfo.iban}
                            onChange={(e) => handleChange('iban', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                            placeholder="SA0000000000000000000000"
                            maxLength="24"
                        />
                        <p className="text-xs text-gray-500 mt-1">يجب أن يبدأ بـ SA ويتكون من 24 رقم</p>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <Phone className="w-4 h-4 ml-2 text-teal-600" />
                            رقم الهاتف
                        </label>
                        <input
                            type="tel"
                            value={bankInfo.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="00966xxxxxxxxx"
                            dir="ltr"
                        />
                    </div>

                    {/* WhatsApp */}
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <MessageCircle className="w-4 h-4 ml-2 text-green-600" />
                            واتساب
                        </label>
                        <input
                            type="tel"
                            value={bankInfo.whatsapp}
                            onChange={(e) => handleChange('whatsapp', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="00966xxxxxxxxx"
                            dir="ltr"
                        />
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4 border-t">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                        </button>
                    </div>
                </div>

                {/* Preview Section */}
                <div className="bg-gray-50 p-6 border-t">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">معاينة البيانات</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">البنك:</span>
                            <span className="font-medium mr-2">{bankInfo.bankName || 'غير محدد'}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">الحساب:</span>
                            <span className="font-medium mr-2">{bankInfo.accountName || 'غير محدد'}</span>
                        </div>
                        <div className="md:col-span-2">
                            <span className="text-gray-600">IBAN:</span>
                            <span className="font-mono font-medium mr-2">{bankInfo.iban || 'غير محدد'}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">الهاتف:</span>
                            <span className="font-medium mr-2">{bankInfo.phone || 'غير محدد'}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">واتساب:</span>
                            <span className="font-medium mr-2">{bankInfo.whatsapp || 'غير محدد'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
