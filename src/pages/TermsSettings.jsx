import React, { useState, useEffect } from 'react';
import { Save, FileText } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function TermsSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [terms, setTerms] = useState({
        title: 'الشروط والأحكام',
        content: '',
        lastUpdated: null,
    });

    useEffect(() => {
        loadTerms();
    }, []);

    const loadTerms = async () => {
        try {
            const docRef = doc(db, 'settings', 'termsAndConditions');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setTerms(docSnap.data());
            }
        } catch (error) {
            console.error('Error loading terms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!terms.content.trim()) {
            alert('يرجى كتابة محتوى الشروط والأحكام');
            return;
        }

        setSaving(true);
        try {
            const docRef = doc(db, 'settings', 'termsAndConditions');
            await setDoc(docRef, {
                ...terms,
                lastUpdated: new Date().toISOString(),
            });
            alert('تم حفظ الشروط والأحكام بنجاح');
            loadTerms();
        } catch (error) {
            console.error('Error saving terms:', error);
            alert('فشل حفظ البيانات');
        } finally {
            setSaving(false);
        }
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
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">الشروط والأحكام</h1>
                <p className="text-gray-600 mt-1">إدارة وتحديث شروط وأحكام استخدام التطبيق</p>
            </div>

            <div className="bg-white rounded-lg shadow-md">
                {/* Title Section */}
                <div className="p-6 border-b border-gray-200">
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 ml-2 text-teal-600" />
                        عنوان الصفحة
                    </label>
                    <input
                        type="text"
                        value={terms.title}
                        onChange={(e) => setTerms(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="مثال: الشروط والأحكام"
                        dir="rtl"
                    />
                </div>

                {/* Content Section */}
                <div className="p-6">
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 ml-2 text-teal-600" />
                        محتوى الشروط والأحكام
                    </label>
                    <textarea
                        value={terms.content}
                        onChange={(e) => setTerms(prev => ({ ...prev, content: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-arabic"
                        placeholder="اكتب الشروط والأحكام هنا..."
                        rows="20"
                        dir="rtl"
                        style={{ lineHeight: '1.8' }}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        💡 نصيحة: استخدم أسطر فارغة للفصل بين الفقرات. سيتم عرض النص كما هو مكتوب.
                    </p>
                </div>

                {/* Last Updated Info */}
                {terms.lastUpdated && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            آخر تحديث: {new Date(terms.lastUpdated).toLocaleString('ar-SA', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                )}

                {/* Save Button */}
                <div className="p-6 border-t border-gray-200">
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
            <div className="mt-6 bg-white rounded-lg shadow-md">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">معاينة</h2>
                    <p className="text-sm text-gray-600 mt-1">كيف ستظهر الشروط والأحكام في التطبيق</p>
                </div>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">{terms.title}</h3>
                    <div className="text-gray-700 whitespace-pre-wrap" style={{ lineHeight: '1.8' }}>
                        {terms.content || 'لا يوجد محتوى بعد...'}
                    </div>
                </div>
            </div>
        </div>
    );
}
