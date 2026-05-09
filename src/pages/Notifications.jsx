import { useState, useEffect } from 'react';
import { Send, History, Users, UserCheck, Bell, MessageSquare, Clock, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import SAUDI_CITIES_RAW from '../services/cities.json';

const SAUDI_CITIES = [...SAUDI_CITIES_RAW]
    .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ar'))
    .map((city) => ({ value: String(city.id), label: city.name }));

export const Notifications = () => {
    const [activeTab, setActiveTab] = useState('send'); // 'send' or 'history'
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [notificationsHistory, setNotificationsHistory] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        target: 'all', // 'all', 'customer', 'provider'
        providerCities: [], // فلترة خاصة بالمزودين حسب مدينة العمل
    });

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const q = query(
                collection(db, 'admin_notifications'),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const history = [];
            querySnapshot.forEach((doc) => {
                history.push({ id: doc.id, ...doc.data() });
            });
            setNotificationsHistory(history);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.message) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'admin_notifications'), {
                ...formData,
                providerCityNames: SAUDI_CITIES
                    .filter((c) => formData.providerCities.includes(c.value))
                    .map((c) => c.label),
                createdAt: serverTimestamp(),
                type: 'admin_broadcast'
            });

            alert('تم إرسال الإشعار بنجاح');
            setFormData({ title: '', message: '', target: 'all', providerCities: [] });
            setActiveTab('history');
        } catch (error) {
            console.error('Error sending notification:', error);
            alert('حدث خطأ أثناء إرسال الإشعار');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الإشعار من السجل؟')) return;
        try {
            await deleteDoc(doc(db, 'admin_notifications', id));
            setNotificationsHistory(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getTargetLabel = (target) => {
        switch (target) {
            case 'all': return 'الجميع';
            case 'customer': return 'العملاء فقط';
            case 'provider': return 'المزودين فقط';
            default: return target;
        }
    };

    const targetIncludesProviders = formData.target === 'provider' || formData.target === 'all';
    const toggleProviderCity = (cityId) => {
        setFormData((prev) => ({
            ...prev,
            providerCities: prev.providerCities.includes(cityId)
                ? prev.providerCities.filter((id) => id !== cityId)
                : [...prev.providerCities, cityId],
        }));
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 mb-2 font-arabic">مركز الإشعارات</h1>
                    <p className="text-gray-600">إرسال رسائل وتنبيهات عامة لمستخدمي التطبيق</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 max-w-fit">
                <button
                    onClick={() => setActiveTab('send')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'send'
                            ? 'bg-primary-orange text-white shadow-lg shadow-primary-orange/20'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <Send size={18} />
                    إرسال إشعار
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'history'
                            ? 'bg-primary-orange text-white shadow-lg shadow-primary-orange/20'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <History size={18} />
                    سجل الإرسال
                </button>
            </div>

            {activeTab === 'send' ? (
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-fadeIn">
                    <div className="bg-gradient-to-r from-primary-orange to-primary-yellow p-8 text-white">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                <Bell size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">إنشاء إشعار جديد</h2>
                                <p className="text-white/80 text-sm">سيصل الإشعار للهدف المحدد فوراً</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSend} className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 pr-1">الفئة المستهدفة</label>
                                <div className="flex gap-3">
                                    {[
                                        { id: 'all', label: 'الجميع', icon: Users },
                                        { id: 'customer', label: 'العملاء', icon: UserCheck },
                                        { id: 'provider', label: 'المزودين', icon: UserCheck }
                                    ].map((target) => (
                                        <button
                                            key={target.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, target: target.id })}
                                            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${formData.target === target.id
                                                    ? 'border-primary-orange bg-primary-orange/5 text-primary-orange'
                                                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                                                }`}
                                        >
                                            <target.icon size={20} />
                                            <span className="text-xs font-bold">{target.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 pr-1">عنوان الإشعار</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: عرض خاص جديد!"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary-orange focus:bg-white focus:outline-none transition-all font-semibold"
                                />
                            </div>
                        </div>

                        {targetIncludesProviders && (
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-700 pr-1">
                                    مدن عمل المزوّدين (اختياري)
                                </label>
                                <p className="text-xs text-gray-500">
                                    إذا اخترت مدناً محددة، سيصل الإشعار فقط للمزوّدين الذين مدينة عملهم ضمن الاختيار.
                                    عند تركها بدون اختيار سيصل لجميع المزوّدين المستهدفين.
                                </p>
                                <div className="max-h-48 overflow-y-auto bg-gray-50 border-2 border-gray-100 rounded-2xl p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {SAUDI_CITIES.map((city) => {
                                        const selected = formData.providerCities.includes(city.value);
                                        return (
                                            <button
                                                key={city.value}
                                                type="button"
                                                onClick={() => toggleProviderCity(city.value)}
                                                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${selected
                                                    ? 'bg-primary-orange/10 border-primary-orange text-primary-orange'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                    }`}
                                            >
                                                {city.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700 pr-1">نص الرسالة</label>
                            <textarea
                                required
                                rows={5}
                                placeholder="اكتب تفاصيل الإشعار هنا..."
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary-orange focus:bg-white focus:outline-none transition-all font-semibold resize-none"
                            />
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl text-blue-700 border border-blue-100">
                            <AlertCircle className="shrink-0" size={20} />
                            <p className="text-sm font-medium leading-relaxed">
                                سيتم إرسال هذا الإشعار كنص يظهر في قائمة الإشعارات داخل التطبيق للمستخدمين المستهدفين. يرجى التأكد من صحة المعلومات قبل الإرسال.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-primary-orange text-white rounded-2xl font-black text-lg shadow-lg shadow-primary-orange/30 hover:bg-primary-yellow hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>جاري الإرسال...</span>
                                </div>
                            ) : (
                                'إرسال الإشعار الآن'
                            )}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="space-y-4 animate-fadeIn">
                    {historyLoading ? (
                        <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center border border-gray-100 shadow-sm">
                            <Loader2 className="animate-spin text-primary-orange mb-4" size={40} />
                            <p className="text-gray-500 font-bold">جاري تحميل سجل الإشعارات...</p>
                        </div>
                    ) : notificationsHistory.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center border border-gray-100 shadow-sm text-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <MessageSquare size={40} className="text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">لا يوجد سجل إرسال</h3>
                            <p className="text-gray-500 max-w-xs">لم يتم إرسال أي إشعارات عامة بعد. الإشعارات التي ترسلها ستظهر هنا.</p>
                        </div>
                    ) : (
                        notificationsHistory.map((notification) => (
                            <div
                                key={notification.id}
                                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group"
                            >
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="flex gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${notification.target === 'all' ? 'bg-blue-50 text-blue-500' :
                                                notification.target === 'customer' ? 'bg-purple-50 text-purple-500' : 'bg-teal-50 text-teal-500'
                                            }`}>
                                            <Bell size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-gray-800 text-lg leading-tight">{notification.title}</h3>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${notification.target === 'all' ? 'bg-blue-100 text-blue-700' :
                                                        notification.target === 'customer' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                                                    }`}>
                                                    {getTargetLabel(notification.target)}
                                                </span>
                                                {Array.isArray(notification.providerCityNames) && notification.providerCityNames.length > 0 && (
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                                                        مدن مزودين محددة ({notification.providerCityNames.length})
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-600 font-medium">{notification.message}</p>
                                            {Array.isArray(notification.providerCityNames) && notification.providerCityNames.length > 0 && (
                                                <p className="text-xs text-gray-500">
                                                    المدن: {notification.providerCityNames.join('، ')}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 pt-2">
                                                <div className="flex items-center gap-1.5 text-gray-400 text-xs font-bold">
                                                    <Clock size={14} />
                                                    <span>
                                                        {notification.createdAt
                                                            ? format(notification.createdAt.toDate(), 'dd MMMM yyyy - hh:mm a', { locale: ar })
                                                            : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                                        <button
                                            onClick={() => handleDelete(notification.id)}
                                            className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                            title="حذف من السجل"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
