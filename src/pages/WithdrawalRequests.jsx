import React, { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, XCircle, Clock, DollarSign, User, Phone, Loader2, X } from 'lucide-react';
import { getAllWithdrawalRequests, approveWithdrawalRequest, rejectWithdrawalRequest } from '../services/withdrawalService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_CONFIG = {
  pending:  { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800',  icon: Clock },
  approved: { label: 'مكتمل',        color: 'bg-green-100 text-green-800',  icon: CheckCircle },
  rejected: { label: 'مرفوض',        color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const StatusBadge = ({ status }) => {
  const { label, color, icon: Icon } = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

const StatCard = ({ label, value, colorClass }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4`}>
    <div className={`text-2xl font-black mb-1 ${colorClass || 'text-gray-800'}`}>{value}</div>
    <div className="text-sm text-gray-500">{label}</div>
  </div>
);

export default function WithdrawalRequests() {
  const [requests, setRequests]           = useState([]);
  const [filteredRequests, setFiltered]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [statusFilter, setStatusFilter]   = useState('all');
  const [searchTerm, setSearchTerm]       = useState('');
  const [selectedRequest, setSelected]    = useState(null);
  const [actionModal, setActionModal]     = useState({ show: false, type: null, request: null });
  const [adminNotes, setAdminNotes]       = useState('');
  const [processing, setProcessing]       = useState(false);

  useEffect(() => { loadRequests(); }, [statusFilter]);

  useEffect(() => {
    let filtered = requests;
    if (searchTerm) {
      filtered = filtered.filter(
        (r) =>
          r.providerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.providerPhone?.includes(searchTerm)
      );
    }
    setFiltered(filtered);
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

  const handleApprove = async () => {
    if (!actionModal.request) return;
    setProcessing(true);
    try {
      await approveWithdrawalRequest(actionModal.request.id, 'admin', adminNotes);
      alert('تمت الموافقة على الطلب بنجاح');
      closeAction();
      loadRequests();
    } catch (error) {
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
      await rejectWithdrawalRequest(actionModal.request.id, 'admin', adminNotes);
      alert('تم رفض الطلب');
      closeAction();
      loadRequests();
    } catch (error) {
      alert('فشل في الرفض');
    } finally {
      setProcessing(false);
    }
  };

  const closeAction = () => {
    setActionModal({ show: false, type: null, request: null });
    setAdminNotes('');
  };

  const stats = {
    total:       requests.length,
    pending:     requests.filter((r) => r.status === 'pending').length,
    approved:    requests.filter((r) => r.status === 'approved').length,
    rejected:    requests.filter((r) => r.status === 'rejected').length,
    totalAmount: requests.reduce((s, r) => s + (r.amount || 0), 0),
  };

  const STATUS_FILTERS = [
    { key: 'all',      label: 'الكل' },
    { key: 'pending',  label: 'قيد المراجعة' },
    { key: 'approved', label: 'مكتملة' },
    { key: 'rejected', label: 'مرفوضة' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">طلبات سحب الرصيد</h1>
        <p className="text-gray-500 mt-1 text-sm">إدارة طلبات سحب الرصيد من المزودين</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="إجمالي الطلبات"  value={stats.total}       />
        <StatCard label="قيد المراجعة"    value={stats.pending}     colorClass="text-amber-600" />
        <StatCard label="مكتملة"          value={stats.approved}    colorClass="text-green-600" />
        <StatCard label="مرفوضة"          value={stats.rejected}    colorClass="text-red-600"   />
        <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-sm p-4 col-span-2 lg:col-span-1">
          <div className="text-2xl font-black mb-1 text-amber-400">{stats.totalAmount} <span className="text-base font-semibold">ر.س</span></div>
          <div className="text-sm text-gray-400">إجمالي المبالغ</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم أو رقم الهاتف..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-sm transition-all"
              dir="rtl"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  statusFilter === key
                    ? 'bg-amber-400 text-gray-950 shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="animate-spin rounded-full h-9 w-9 border-2 border-amber-400 border-t-transparent" />
            <p className="text-sm text-gray-400">جاري التحميل...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="font-medium">لا توجد طلبات</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['المزود', 'المبلغ', 'الحالة', 'التاريخ', 'إجراءات'].map((h) => (
                      <th key={h} className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800 text-sm">{req.providerName || 'غير محدد'}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {req.providerPhone || 'لا يوجد'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-black text-gray-900">{req.amount}</span>
                        <span className="text-sm text-gray-500 mr-1">ر.س</span>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(req.createdAt, 'dd MMM yyyy - HH:mm', { locale: ar })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelected(req)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            <Eye size={17} />
                          </button>
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => setActionModal({ show: true, type: 'approve', request: req })}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              >
                                <CheckCircle size={17} />
                              </button>
                              <button
                                onClick={() => setActionModal({ show: true, type: 'reject', request: req })}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <XCircle size={17} />
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
            <div className="md:hidden divide-y divide-gray-50">
              {filteredRequests.map((req) => (
                <div key={req.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <StatusBadge status={req.status} />
                    <span className="text-xl font-black text-gray-900">{req.amount} <span className="text-sm font-normal text-gray-500">ر.س</span></span>
                  </div>
                  <div className="font-semibold text-gray-800 mb-1">{req.providerName || 'غير محدد'}</div>
                  <div className="text-xs text-gray-500 mb-3">{req.providerPhone || 'لا يوجد'}</div>
                  <div className="text-xs text-gray-400 mb-3">{format(req.createdAt, 'dd MMM yyyy - HH:mm', { locale: ar })}</div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelected(req)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-all">
                      <Eye size={17} />
                    </button>
                    {req.status === 'pending' && (
                      <>
                        <button onClick={() => setActionModal({ show: true, type: 'approve', request: req })} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all">
                          <CheckCircle size={17} />
                        </button>
                        <button onClick={() => setActionModal({ show: true, type: 'reject', request: req })} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <XCircle size={17} />
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">تفاصيل الطلب</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                { label: 'المزود', value: selectedRequest.providerName },
                { label: 'الهاتف', value: selectedRequest.providerPhone },
                { label: 'المبلغ', value: `${selectedRequest.amount} ر.س` },
                { label: 'التاريخ', value: format(selectedRequest.createdAt, 'dd MMM yyyy - HH:mm', { locale: ar }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[70px]">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 min-w-[70px]">الحالة:</span>
                <StatusBadge status={selectedRequest.status} />
              </div>
              {selectedRequest.adminNotes && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <span className="text-gray-500 text-xs block mb-1">ملاحظات الإدارة:</span>
                  <p className="text-gray-800">{selectedRequest.adminNotes}</p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100">
              <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {actionModal.type === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </h3>
              <button onClick={closeAction} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                {actionModal.type === 'approve'
                  ? 'هل أنت متأكد من الموافقة على هذا الطلب؟ سيتم خصم المبلغ من رصيد المزود.'
                  : 'يرجى كتابة سبب رفض الطلب:'}
              </p>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={actionModal.type === 'approve' ? 'ملاحظات (اختياري)' : 'سبب الرفض (إلزامي)'}
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-sm resize-none"
                rows={3}
                dir="rtl"
              />
              <div className="flex gap-3">
                <button
                  onClick={closeAction}
                  disabled={processing}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={actionModal.type === 'approve' ? handleApprove : handleReject}
                  disabled={processing}
                  className={`flex-1 py-2.5 text-white rounded-xl font-bold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionModal.type === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {processing && <Loader2 size={14} className="animate-spin" />}
                  {processing ? 'جارٍ المعالجة...' : 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
