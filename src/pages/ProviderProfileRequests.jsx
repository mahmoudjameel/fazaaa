import React, { useState, useEffect } from 'react';
import { Search, User, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  getProviderProfileChangeRequests,
  approveProviderProfileChange,
  rejectProviderProfileChange,
} from '../services/adminService';

const FIELD_LABELS = {
  firstName: 'الاسم الأول',
  lastName: 'الاسم الأخير',
  phone: 'رقم الهاتف',
  email: 'البريد الإلكتروني',
  nationality: 'الجنسية',
  city: 'المدينة',
};

export default function ProviderProfileRequests() {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processing, setProcessing] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getProviderProfileChangeRequests(statusFilter);
      setRequests(data);
    } catch (error) {
      console.error('Error loading profile change requests:', error);
      alert('فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  useEffect(() => {
    let filtered = requests;
    if (searchTerm) {
      filtered = filtered.filter(
        (r) =>
          r.providerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.requestedChanges?.phone || '').includes(searchTerm) ||
          (r.currentData?.phone || '').includes(searchTerm)
      );
    }
    setFilteredRequests(filtered);
  }, [requests, searchTerm]);

  const handleApprove = async (req) => {
    if (!req?.id) return;
    setProcessing(true);
    try {
      await approveProviderProfileChange(req.id);
      alert('تمت الموافقة على التعديلات وتطبيقها على الملف الشخصي للمزود.');
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      alert('فشل: ' + (error.message || 'تعذر تنفيذ العملية'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (req) => {
    if (!req?.id) return;
    if (!window.confirm('هل تريد رفض طلب التعديل؟')) return;
    setProcessing(true);
    try {
      await rejectProviderProfileChange(req.id);
      alert('تم رفض الطلب.');
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      alert('فشل: ' + (error.message || 'تعذر تنفيذ العملية'));
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { label: 'مقبول', color: 'bg-green-100 text-green-800', icon: CheckCircle },
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

  const formatDate = (v) => {
    if (!v) return '—';
    try {
      const d = v.toDate ? v.toDate() : new Date(v);
      return d.toLocaleDateString('ar-SA', { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(v);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">طلبات تعديل بيانات المزودين</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">تعديلات المزودين المعتمدين — تطبق بعد موافقة الإدارة</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600">إجمالي الطلبات</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{requests.length}</div>
        </div>
        <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-yellow-700">قيد المراجعة</div>
          <div className="text-xl sm:text-2xl font-bold text-yellow-800">{pendingCount}</div>
        </div>
        <div className="bg-green-50 p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-green-700">مقبولة</div>
          <div className="text-xl sm:text-2xl font-bold text-green-800">{requests.filter((r) => r.status === 'approved').length}</div>
        </div>
        <div className="bg-red-50 p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-red-700">مرفوضة</div>
          <div className="text-xl sm:text-2xl font-bold text-red-800">{requests.filter((r) => r.status === 'rejected').length}</div>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
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
            {['pending', 'all', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-semibold transition text-xs sm:text-sm ${
                  statusFilter === status ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' && 'الكل'}
                {status === 'pending' && 'قيد المراجعة'}
                {status === 'approved' && 'مقبولة'}
                {status === 'rejected' && 'مرفوضة'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد طلبات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:text-base" dir="rtl">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right py-3 px-3 font-semibold text-gray-700">المزود</th>
                  <th className="text-right py-3 px-3 font-semibold text-gray-700">التاريخ</th>
                  <th className="text-right py-3 px-3 font-semibold text-gray-700">الحالة</th>
                  <th className="text-right py-3 px-3 font-semibold text-gray-700">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="font-medium text-gray-900">{req.providerName || '—'}</div>
                      <div className="text-gray-500 text-xs">{req.requestedChanges?.phone || req.currentData?.phone || ''}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{formatDate(req.requestedAt)}</td>
                    <td className="py-3 px-3">{getStatusBadge(req.status)}</td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(selectedRequest?.id === req.id ? null : req)}
                        className="text-teal-600 hover:underline font-medium"
                      >
                        {selectedRequest?.id === req.id ? 'إخفاء' : 'عرض'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !processing && setSelectedRequest(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-gray-900">تفاصيل طلب التعديل</h2>
              <button type="button" onClick={() => setSelectedRequest(null)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              <User className="inline w-4 h-4 ml-1" />
              {selectedRequest.providerName}
            </p>
            <div className="space-y-3 text-sm">
              {['firstName', 'lastName', 'phone', 'email', 'nationality', 'city'].map((key) => {
                const current = selectedRequest.currentData?.[key] ?? '—';
                const requested = selectedRequest.requestedChanges?.[key] ?? '—';
                const changed = String(current) !== String(requested);
                if (!changed && current === '—' && requested === '—') return null;
                return (
                  <div key={key} className={`p-3 rounded-lg ${changed ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <div className="font-semibold text-gray-700">{FIELD_LABELS[key]}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="text-gray-500">الحالي: {current || '—'}</span>
                      {changed && <span className="text-teal-600 font-medium">→ المطلوب: {requested || '—'}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedRequest.status === 'pending' && (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleApprove(selectedRequest)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  موافقة وتطبيق التعديلات
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleReject(selectedRequest)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  رفض
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
