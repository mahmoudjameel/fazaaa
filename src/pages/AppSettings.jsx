import React, { useState, useEffect } from 'react';
import { Save, FileText, Info } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function AppSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('terms'); // 'terms' or 'about'

    const [terms, setTerms] = useState({
        title: 'الشروط والأحكام',
        content: '',
        lastUpdated: null,
    });

    const [about, setAbout] = useState({
        title: 'من نحن',
        content: '',
        lastUpdated: null,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Terms
            const termsRef = doc(db, 'settings', 'termsAndConditions');
            const termsSnap = await getDoc(termsRef);
            if (termsSnap.exists()) {
                setTerms(termsSnap.data());
            }

            // Load About Us
            const aboutRef = doc(db, 'settings', 'aboutUs');
            const aboutSnap = await getDoc(aboutRef);
            if (aboutSnap.exists()) {
                setAbout(aboutSnap.data());
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeTab === 'terms') {
                const docRef = doc(db, 'settings', 'termsAndConditions');
                await setDoc(docRef, {
                    ...terms,
                    lastUpdated: new Date().toISOString(),
                });
                alert('تم حفظ الشروط والأحكام بنجاح');
            } else {
                const docRef = doc(db, 'settings', 'aboutUs');
                await setDoc(docRef, {
                    ...about,
                    lastUpdated: new Date().toISOString(),
                });
                alert('تم حفظ بيانات "من نحن" بنجاح');
            }
            loadData();
        } catch (error) {
            console.error('Error saving settings:', error);
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
                <h1 className="text-2xl font-bold text-gray-900">إعدادات المحتوى</h1>
                <p className="text-gray-600 mt-1">إدارة الشروط والأحكام ومعلومات "من نحن" في التطبيق</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab('terms')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'terms'
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    الشروط والأحكام
                </button>
                <button
                    onClick={() => setActiveTab('about')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'about'
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                        }`}
                >
                    <Info className="w-4 h-4" />
                    من نحن
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md">
                {activeTab === 'terms' ? (
                    <>
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
                                rows="15"
                                dir="rtl"
                                style={{ lineHeight: '1.8' }}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-6 border-b border-gray-200">
                            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                                <Info className="w-4 h-4 ml-2 text-teal-600" />
                                عنوان الصفحة
                            </label>
                            <input
                                type="text"
                                value={about.title}
                                onChange={(e) => setAbout(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                placeholder="مثال: من نحن"
                                dir="rtl"
                            />
                        </div>
                        <div className="p-6">
                            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                                <Info className="w-4 h-4 ml-2 text-teal-600" />
                                معلومات عن التطبيق
                            </label>
                            <textarea
                                value={about.content}
                                onChange={(e) => setAbout(prev => ({ ...prev, content: e.target.value }))}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-arabic"
                                placeholder="اكتب معلومات عن التطبيق هنا..."
                                rows="15"
                                dir="rtl"
                                style={{ lineHeight: '1.8' }}
                            />
                        </div>
                    </>
                )}

                {/* Last Updated Info */}
                {(activeTab === 'terms' ? terms.lastUpdated : about.lastUpdated) && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            آخر تحديث: {new Date(activeTab === 'terms' ? terms.lastUpdated : about.lastUpdated).toLocaleString('ar-SA', {
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
                <div className="p-6 border-t border-gray-200 flex justify-between items-center">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    <p className="text-sm text-gray-600 mt-1">كيف سيظهر المحتوى في التطبيق</p>
                </div>
                <div className="p-6 bg-gray-50">
                    <div className="bg-white p-8 rounded-xl shadow-inner max-w-2xl mx-auto border border-gray-200">
                        <h3 className="text-2xl font-black text-teal-600 mb-6 text-center border-b-2 border-teal-500 pb-2 inline-block">
                            {activeTab === 'terms' ? terms.title : about.title}
                        </h3>
                        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-right" dir="rtl">
                            {(activeTab === 'terms' ? terms.content : about.content) || 'لا يوجد محتوى بعد...'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
