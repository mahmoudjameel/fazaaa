import { useState, useEffect, useRef } from 'react';
import {
    AlertTriangle, MapPin, Clock, CheckCircle, Users,
    Timer, RefreshCw, XCircle, Wrench, PhoneOff,
    Filter, Search, ChevronDown,
} from 'lucide-react';
import {
    collection, query, orderBy, onSnapshot,
    doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

// ── إعدادات نوع التصعيد ──────────────────────────────────────────────────────
const TYPE_CONFIG = {
    no_providers: {
        label: 'لا يوجد مزودون',
        shortLabel: 'لا مزودون',
        icon: Users,
        cardBorder: 'border-amber-200',
        headerBg: 'bg-amber-50',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-700',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        dotColor: 'bg-amber-500',
        summaryBg: 'bg-amber-50 border-amber-200',
        summaryText: 'text-amber-700',
        summaryCount: 'text-amber-900',
    },
    all_rejected: {
        label: 'جميع المزودين رفضوا',
        shortLabel: 'جميع رفضوا',
        icon: XCircle,
        cardBorder: 'border-red-200',
        headerBg: 'bg-red-50',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-700',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        dotColor: 'bg-red-500',
        summaryBg: 'bg-red-50 border-red-200',
        summaryText: 'text-red-700',
        summaryCount: 'text-red-900',
    },
    search_timeout: {
        label: 'انتهاء وقت البحث',
        shortLabel: 'وقت البحث',
        icon: Timer,
        cardBorder: 'border-blue-200',
        headerBg: 'bg-blue-50',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-700',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        dotColor: 'bg-blue-500',
        summaryBg: 'bg-blue-50 border-blue-200',
        summaryText: 'text-blue-700',
        summaryCount: 'text-blue-900',
    },
};

const FALLBACK_TYPE = TYPE_CONFIG.search_timeout;

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export const Escalations = () => {
    const [escalations, setEscalations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('new');   // 'all' | 'new' | 'resolved'
    const [typeFilter, setTypeFilter] = useState('all');        // 'all' | 'no_providers' | 'all_rejected' | 'search_timeout'
    const [searchText, setSearchText] = useState('');
    const [resolvingId, setResolvingId] = useState(null);
    const prevNewCountRef = useRef(0);
    const audioRef = useRef(null);

    // ── اشتراك Firestore ─────────────────────────────────────────────────────
    useEffect(() => {
        audioRef.current = new Audio(
            'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
        );

        const q = query(
            collection(db, 'admin_escalations'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setEscalations(items);
            setLoading(false);

            const newCount = items.filter((e) => e.status === 'new').length;
            if (newCount > prevNewCountRef.current) {
                audioRef.current?.play().catch(() => {});
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('فزّاعين: تصعيد جديد', {
                        body: 'طلب لم يُلبَّ — يحتاج مراجعة.',
                        icon: '/fzaeen-logo.jpeg',
                    });
                }
            }
            prevNewCountRef.current = newCount;
        });

        return () => unsubscribe();
    }, []);

    // ── إجراءات ──────────────────────────────────────────────────────────────
    const handleResolve = async (id) => {
        setResolvingId(id);
        try {
            await updateDoc(doc(db, 'admin_escalations', id), {
                status: 'resolved',
                resolvedAt: serverTimestamp(),
                resolvedBy: localStorage.getItem('admin_role') || 'admin',
            });
        } catch (e) {
            console.error('Failed to resolve escalation:', e);
        } finally {
            setResolvingId(null);
        }
    };

    const handleReopen = async (id) => {
        try {
            await updateDoc(doc(db, 'admin_escalations', id), {
                status: 'new',
                resolvedAt: null,
                resolvedBy: null,
            });
        } catch (e) {
            console.error('Failed to reopen escalation:', e);
        }
    };

    const openMaps = (coordinates, location) => {
        if (coordinates?.latitude && coordinates?.longitude) {
            window.open(
                `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`,
                '_blank'
            );
        } else if (location) {
            window.open(`https://www.google.com/maps?q=${encodeURIComponent(location)}`, '_blank');
        }
    };

    // ── تصفية ────────────────────────────────────────────────────────────────
    const filtered = escalations.filter((e) => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (typeFilter !== 'all' && e.type !== typeFilter) return false;
        if (searchText) {
            const q = searchText.toLowerCase();
            const hay = [e.serviceName, e.location, e.requestId, e.customerId]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    // ── إحصاءات ──────────────────────────────────────────────────────────────
    const counts = {
        all: escalations.length,
        new: escalations.filter((e) => e.status === 'new').length,
        resolved: escalations.filter((e) => e.status === 'resolved').length,
    };

    const typeCounts = {
        no_providers: escalations.filter((e) => e.type === 'no_providers').length,
        all_rejected: escalations.filter((e) => e.type === 'all_rejected').length,
        search_timeout: escalations.filter((e) => e.type === 'search_timeout').length,
    };

    const typeCountsNew = {
        no_providers: escalations.filter((e) => e.type === 'no_providers' && e.status === 'new').length,
        all_rejected: escalations.filter((e) => e.type === 'all_rejected' && e.status === 'new').length,
        search_timeout: escalations.filter((e) => e.type === 'search_timeout' && e.status === 'new').length,
    };

    // ── مساعد وقت ─────────────────────────────────────────────────────────────
    const toDate = (val) =>
        val?.toDate ? val.toDate() : val ? new Date(val) : null;

    // ── واجهة ─────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto" dir="rtl">

            {/* ── رأس الصفحة ── */}
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center">
                            <AlertTriangle size={20} className="text-orange-600" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-800">تصعيدات النظام</h1>
                        {counts.new > 0 && (
                            <span className="px-2.5 py-1 bg-red-500 text-white text-sm font-black rounded-full animate-pulse">
                                {counts.new} جديد
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm pr-1">
                        طلبات لم تُلبَّ بعد انتهاء مهلة البحث (3 دقائق) — تحتاج متابعة من الإدارة
                    </p>
                </div>

                {/* بطاقات الإجمالي */}
                <div className="flex gap-3">
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-center min-w-[72px]">
                        <div className="text-2xl font-black text-red-600">{counts.new}</div>
                        <div className="text-xs text-red-500 font-bold mt-0.5">جديد</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center min-w-[72px]">
                        <div className="text-2xl font-black text-green-600">{counts.resolved}</div>
                        <div className="text-xs text-green-500 font-bold mt-0.5">تم الحل</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-center min-w-[72px]">
                        <div className="text-2xl font-black text-gray-600">{counts.all}</div>
                        <div className="text-xs text-gray-500 font-bold mt-0.5">الكل</div>
                    </div>
                </div>
            </div>

            {/* ── بطاقات تلخيص الأنواع ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
                    const Icon = cfg.icon;
                    const isActive = typeFilter === type;
                    return (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(isActive ? 'all' : type)}
                            className={`p-4 rounded-2xl border-2 text-right transition-all hover:shadow-sm ${
                                isActive
                                    ? `${cfg.summaryBg} ${cfg.cardBorder}`
                                    : 'bg-white border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.iconBg}`}>
                                    <Icon size={18} className={cfg.iconColor} />
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-gray-800">
                                        {typeCounts[type]}
                                    </div>
                                    {typeCountsNew[type] > 0 && (
                                        <div className="text-xs font-bold text-red-500">
                                            {typeCountsNew[type]} جديد
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-sm font-bold text-gray-700">{cfg.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* ── شريط الفلاتر والبحث ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                {/* تبويبات الحالة */}
                <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                    {[
                        { id: 'all',      label: `الكل (${counts.all})` },
                        { id: 'new',      label: `جديد (${counts.new})` },
                        { id: 'resolved', label: `تم الحل (${counts.resolved})` },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                statusFilter === tab.id
                                    ? 'bg-gray-900 text-white shadow'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* بحث */}
                <div className="flex-1 relative">
                    <Search
                        size={16}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                        type="text"
                        placeholder="بحث بالخدمة أو الموقع أو رقم الطلب..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-sm text-right focus:outline-none focus:border-gray-300 shadow-sm"
                    />
                </div>
            </div>

            {/* ── قائمة التصعيدات ── */}
            {loading ? (
                <div className="bg-white rounded-3xl p-16 flex flex-col items-center justify-center border border-gray-100">
                    <RefreshCw className="animate-spin text-gray-400 mb-4" size={36} />
                    <p className="text-gray-500 font-bold">جاري تحميل التصعيدات...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 flex flex-col items-center justify-center border border-gray-100 text-center">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={40} className="text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">لا توجد تصعيدات</h3>
                    <p className="text-gray-500 text-sm">
                        {statusFilter === 'new'
                            ? 'جميع التصعيدات تم حلها — أداء ممتاز!'
                            : 'لا توجد سجلات تطابق الفلتر الحالي'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((esc) => {
                        const cfg = TYPE_CONFIG[esc.type] || FALLBACK_TYPE;
                        const Icon = cfg.icon;
                        const isNew = esc.status === 'new';
                        const isResolving = resolvingId === esc.id;
                        const createdDate = toDate(esc.createdAt);
                        const resolvedDate = toDate(esc.resolvedAt);

                        return (
                            <div
                                key={esc.id}
                                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md ${
                                    isNew ? cfg.cardBorder : 'border-gray-100'
                                }`}
                            >
                                {/* شريط ملوّن علوي حسب النوع */}
                                <div className={`px-5 py-3 flex items-center justify-between gap-3 ${cfg.headerBg}`}>
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                                            <Icon size={16} className={cfg.iconColor} />
                                        </div>
                                        <span className={`text-sm font-black ${cfg.badgeText}`}>
                                            {cfg.label}
                                        </span>
                                        {isNew && (
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-500 text-white animate-pulse">
                                                جديد
                                            </span>
                                        )}
                                        {esc.status === 'resolved' && (
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-green-100 text-green-700">
                                                تم الحل
                                            </span>
                                        )}
                                    </div>
                                    {/* ID الطلب */}
                                    {esc.requestId && (
                                        <span className="text-xs font-mono bg-white/70 px-2 py-0.5 rounded-lg text-gray-500 flex-shrink-0">
                                            #{esc.requestId.slice(-6).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* المحتوى */}
                                <div className="p-5">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {/* تفاصيل */}
                                        <div className="flex-1 min-w-0 space-y-2.5">
                                            {/* الخدمة */}
                                            {esc.serviceName && esc.serviceName !== 'غير محدد' && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Wrench size={14} className="text-gray-400 flex-shrink-0" />
                                                    <span className="font-bold text-gray-800 truncate">
                                                        {esc.serviceName}
                                                    </span>
                                                </div>
                                            )}

                                            {/* الموقع */}
                                            {(esc.coordinates || esc.location) && (
                                                <button
                                                    onClick={() => openMaps(esc.coordinates, esc.location)}
                                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors text-right w-full"
                                                >
                                                    <MapPin size={14} className="flex-shrink-0 text-blue-500" />
                                                    <span className="underline truncate">
                                                        {esc.location || 'عرض الموقع على الخريطة'}
                                                    </span>
                                                </button>
                                            )}

                                            {/* عدادات المزودين */}
                                            <div className="flex flex-wrap gap-3">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl">
                                                    <Users size={13} className="text-gray-400" />
                                                    <span>
                                                        أُشعر:{' '}
                                                        <strong className="text-gray-800">
                                                            {esc.notifiedProvidersCount ?? 0}
                                                        </strong>{' '}
                                                        مزود
                                                    </span>
                                                </div>
                                                {(esc.rejectedProvidersCount ?? 0) > 0 && (
                                                    <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-xl">
                                                        <PhoneOff size={13} />
                                                        <span>
                                                            رفض:{' '}
                                                            <strong>
                                                                {esc.rejectedProvidersCount}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl">
                                                    <Timer size={13} className="text-gray-400" />
                                                    <span>
                                                        المرحلة:{' '}
                                                        <strong className="text-gray-800">
                                                            {esc.lastSearchStage ?? 0}
                                                        </strong>
                                                        /{esc.totalStages ?? 9}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* سبب التصعيد */}
                                            {esc.reason && (
                                                <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
                                                    {esc.reason}
                                                </p>
                                            )}

                                            {/* الوقت */}
                                            <div className="flex flex-wrap items-center gap-3 pt-1">
                                                {createdDate && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                        <Clock size={12} />
                                                        <span>
                                                            {format(createdDate, 'dd MMM yyyy — hh:mm a', { locale: ar })}
                                                        </span>
                                                        <span className="text-gray-300">·</span>
                                                        <span>
                                                            {formatDistanceToNow(createdDate, {
                                                                addSuffix: true,
                                                                locale: ar,
                                                            })}
                                                        </span>
                                                    </div>
                                                )}
                                                {esc.status === 'resolved' && resolvedDate && (
                                                    <div className="flex items-center gap-1.5 text-xs text-green-500">
                                                        <CheckCircle size={12} />
                                                        <span>
                                                            تم الحل{' '}
                                                            {formatDistanceToNow(resolvedDate, {
                                                                addSuffix: true,
                                                                locale: ar,
                                                            })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* أزرار الإجراء */}
                                        <div className="flex sm:flex-col gap-2 justify-end shrink-0">
                                            {isNew ? (
                                                <button
                                                    onClick={() => handleResolve(esc.id)}
                                                    disabled={isResolving}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    <CheckCircle size={15} />
                                                    {isResolving ? 'جاري...' : 'تم الحل'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleReopen(esc.id)}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold rounded-xl transition-all whitespace-nowrap"
                                                >
                                                    <RefreshCw size={15} />
                                                    إعادة فتح
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
