import React, { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, XCircle, Clock, DollarSign, User, Phone } from 'lucide-react';
import { getAllWithdrawalRequests, approveWithdrawalRequest, rejectWithdrawalRequest } from '../services/withdrawalService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function WithdrawalRequests() {
    const [requests, setRequests] = useState([]);
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionModal, setActionModal] = useState({ show: false, type: null, request: null });
    const [adminNotes, setAdminNotes] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadRequests();
    }, [statusFilter]);

    useEffect(() => {
        filterRequests();
    }, [requests, searchTerm]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await getAllWithdrawalRequests(statusFilter);
            setRequests(data);
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterRequests = () => {
        let filtered = requests;

        if (searchTerm) {
            filtered = filtered.filter(req =>
                req.providerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.providerPhone?.includes(searchTerm)
            );
        }

        setFilteredRequests(filtered);
    };

    const handleApprove = async () => {
        if (!actionModal.request) return;

        setProcessing(true);
        try {
            await approveWithdrawalRequest(
                actionModal.request.id,
                'admin',
                adminNotes
            );

            alert('تمت الموافقة على الطلب بنجاح');
            setActionModal({ show: false, type: null, request: null });
            setAdminNotes('');
            loadRequests();
        } catch (error) {
            console.error('Error approving request:', error);
            alert('فشل في الموافقة: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!actionModal.request || !adminNotes.trim()) {
            alert('يرجى كتابة سبب الرفض');
            return;
        }

        setProcessing(true);
        try {
            await rejectWithdrawalRequest(
                actionModal.request.id,
                'admin',
                adminNotes
            );

            alert('تم رفض الطلب');
            setActionModal({ show: false, type: null, request: null });
            setAdminNotes('');
            loadRequests();
        } catch (error) {
            console.error('Error rejecting request:', error);
            alert('فشل في الرفض');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            pending: { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            approved: { label: 'مكتمل', color: 'bg-green-100 text-green-800', icon: CheckCircle },
            rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-800', icon: XCircle },
        };

        const { label, color, icon: Icon } = config[status] || config.pending;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${color}`}>
                <Icon className="w-4 h-4" />
                {label}
            </span>
        );
    };

    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        totalAmount: requests.reduce((sum, r) => sum + r.amount, 0),
    };

    return (
        <div className="p-3 sm:p-4 md:p-6">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">طلبات سحب الرصيد</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">إدارة طلبات سحب الرصيد من المزودين</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-gray-600">إجمالي الطلبات</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-yellow-700">قيد المراجعة</div>
                    <div className="text-xl sm:text-2xl font-bold text-yellow-800">{stats.pending}</div>
                </div>
                <div className="bg-green-50 p-3 sm:p-4 rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-green-700">مكتملة</div>
                    <div className="text-xl sm:text-2xl font-bold text-green-800">{stats.approved}</div>
                </div>
                <div className="bg-red-50 p-3 sm:p-4 rounded-lg shadow">
                    <div className="text-xs sm:text-sm text-red-700">مرفوضة</div>
                    <div className="text-xl sm:text-2xl font-bold text-red-800">{stats.rejected}</div>
                </div>
                <div className="bg-teal-50 p-3 sm:p-4 rounded-lg shadow col-span-2 lg:col-span-1">
                    <div className="text-xs sm:text-sm text-teal-700">إجمالي المبالغ</div>
                    <div className="text-xl sm:text-2xl font-bold text-teal-800">{stats.totalAmount} ر.س</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
                <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="بحث بالاسم أو رقم الهاتف..."
                                className="w-full pr-9 sm:pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm sm:text-base"
                                dir="rtl"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['all', 'pending', 'approved', 'rejected'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 sm:px-4 py-2 rounded-lg font-semibold transition text-xs sm:text-sm ${statusFilter === status
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {status === 'all' && 'الكل'}
                                {status === 'pending' && 'قيد المراجعة'}
                                {status === 'approved' && 'مكتملة'}
                                {status === 'rejected' && 'مرفوضة'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Requests - Desktop Table / Mobile Cards */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">لا توجد طلبات</div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">المزود</th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">المبلغ</th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">التاريخ</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredRequests.map((request) => (
                                        <tr key={request.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                                                        <User className="w-4 h-4" />
                                                        {request.providerName || 'غير محدد'}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                        <Phone className="w-4 h-4" />
                                                        {request.providerPhone || 'لا يوجد'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-5 h-5 text-teal-600" />
                                                    <span className="text-lg font-bold text-gray-900">{request.amount} ر.س</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {format(request.createdAt, 'dd MMM yyyy - HH:mm', { locale: ar })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedRequest(request)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    >
                                                        <Eye size={20} />
                                                    </button>
                                                    {request.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => setActionModal({ show: true, type: 'approve', request })}
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                                            >
                                                                <CheckCircle size={20} />
                                                            </button>
                                                            <button
                                                                onClick={() => setActionModal({ show: true, type: 'reject', request })}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            >
                                                                <XCircle size={20} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-200">
                            {filteredRequests.map((request) => (
                                <div key={request.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <User className="w-4 h-4 text-gray-500" />
                                                <span className="font-semibold text-gray-900">{request.providerName || 'غير محدد'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                                <Phone className="w-4 h-4" />
                                                <span>{request.providerPhone || 'لا يوجد'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign className="w-5 h-5 text-teal-600" />
                                                <span className="text-lg font-bold text-gray-900">{request.amount} ر.س</span>
                                            </div>
                                            <div className="mb-2">{getStatusBadge(request.status)}</div>
                                            <div className="text-xs text-gray-600">
                                                {format(request.createdAt, 'dd MMM yyyy - HH:mm', { locale: ar })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setSelectedRequest(request)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        {request.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => setActionModal({ show: true, type: 'approve', request })}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setActionModal({ show: true, type: 'reject', request })}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Details Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4" onClick={() => setSelectedRequest(null)}>
                    <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">تفاصيل الطلب</h3>
                        <div className="space-y-2 sm:space-y-3">
                            <div className="text-sm sm:text-base">
                                <strong className="text-gray-700">المزود:</strong> 
                                <span className="mr-2 text-gray-900">{selectedRequest.providerName}</span>
                            </div>
                            <div className="text-sm sm:text-base">
                                <strong className="text-gray-700">الهاتف:</strong> 
                                <span className="mr-2 text-gray-900">{selectedRequest.providerPhone}</span>
                            </div>
                            <div className="text-sm sm:text-base">
                                <strong className="text-gray-700">المبلغ:</strong> 
                                <span className="mr-2 text-gray-900">{selectedRequest.amount} ر.س</span>
                            </div>
                            <div className="text-sm sm:text-base">
                                <strong className="text-gray-700">الحالة:</strong> 
                                <span className="mr-2">{getStatusBadge(selectedRequest.status)}</span>
                            </div>
                            <div className="text-sm sm:text-base">
                                <strong className="text-gray-700">تاريخ الإنشاء:</strong> 
                                <span className="mr-2 text-gray-900">{format(selectedRequest.createdAt, 'dd MMM yyyy - HH:mm', { locale: ar })}</span>
                            </div>
                            {selectedRequest.adminNotes && (
                                <div className="text-sm sm:text-base">
                                    <strong className="text-gray-700">ملاحظات الإدارة:</strong> 
                                    <span className="mr-2 text-gray-900">{selectedRequest.adminNotes}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedRequest(null)}
                            className="mt-4 sm:mt-6 w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 text-sm sm:text-base"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {actionModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
                    <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
                        <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                            {actionModal.type === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
                            {actionModal.type === 'approve'
                                ? 'هل أنت متأكد من الموافقة على هذا الطلب؟ سيتم خصم المبلغ من رصيد المزود.'
                                : 'يرجى كتابة سبب رفض الطلب:'}
                        </p>
                        <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder={actionModal.type === 'approve' ? 'ملاحظات (اختياري)' : 'سبب الرفض'}
                            className="w-full p-3 border rounded-lg mb-3 sm:mb-4 text-sm sm:text-base"
                            rows="3"
                            dir="rtl"
                        />
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button
                                onClick={() => {
                                    setActionModal({ show: false, type: null, request: null });
                                    setAdminNotes('');
                                }}
                                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 text-sm sm:text-base"
                                disabled={processing}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                                className={`flex-1 text-white py-2 rounded-lg text-sm sm:text-base ${actionModal.type === 'approve'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                    } disabled:opacity-50`}
                                disabled={processing}
                            >
                                {processing ? 'جارٍ المعالجة...' : 'تأكيد'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
