import { useEffect, useState } from 'react';
import { Search, MessageSquare, AlertTriangle, CheckCircle, Clock, User, Calendar, Filter } from 'lucide-react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const Complaints = () => {
  const [complaintsList, setComplaintsList] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    filterComplaints();
  }, [complaintsList, searchTerm, statusFilter, typeFilter]);

  const fetchComplaints = async () => {
    try {
      const complaintsRef = collection(db, 'complaints');
      const q = query(complaintsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const complaintsData = [];
      querySnapshot.forEach((doc) => {
        complaintsData.push({ id: doc.id, ...doc.data() });
      });
      setComplaintsList(complaintsData);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaints = () => {
    let filtered = complaintsList;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((c) => c.type === typeFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredComplaints(filtered);
  };

  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      const complaintRef = doc(db, 'complaints', complaintId);
      await updateDoc(complaintRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      
      // Update local state
      setComplaintsList(complaintsList.map(c => 
        c.id === complaintId ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c
      ));
      
      setSelectedComplaint(null);
    } catch (error) {
      console.error('Error updating complaint status:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700' },
      in_progress: { text: 'قيد المعالجة', color: 'bg-blue-100 text-blue-700' },
      resolved: { text: 'تم الحل', color: 'bg-green-100 text-green-700' },
      rejected: { text: 'مرفوض', color: 'bg-red-100 text-red-700' },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
  };

  const getTypeBadge = (type) => {
    const badges = {
      complaint: { text: 'شكوى', color: 'bg-red-100 text-red-700' },
      suggestion: { text: 'اقتراح', color: 'bg-blue-100 text-blue-700' },
      feedback: { text: 'ملاحظة', color: 'bg-purple-100 text-purple-700' },
      bug: { text: 'بلاغ عن مشكلة', color: 'bg-orange-100 text-orange-700' },
    };
    return badges[type] || { text: type, color: 'bg-gray-100 text-gray-700' };
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: { text: 'منخفض', color: 'bg-gray-100 text-gray-700' },
      medium: { text: 'متوسط', color: 'bg-yellow-100 text-yellow-700' },
      high: { text: 'مرتفع', color: 'bg-red-100 text-red-700' },
      urgent: { text: 'عاجل', color: 'bg-red-200 text-red-800' },
    };
    return badges[priority] || { text: 'medium', color: 'bg-gray-100 text-gray-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mb-1 sm:mb-2">الشكاوي والملاحظات</h1>
        <p className="text-sm sm:text-base text-gray-600">عرض ومتابعة جميع الشكاوي والملاحظات من المستخدمين</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">إجمالي الشكاوي</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">{complaintsList.length}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-yellow-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">قيد الانتظار</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {complaintsList.filter((c) => c.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">قيد المعالجة</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {complaintsList.filter((c) => c.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-green-500 w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm text-gray-600">تم الحل</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-800">
            {complaintsList.filter((c) => c.status === 'resolved').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="ابحث عن شكوى..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 sm:pr-10 pl-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm sm:text-base"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm sm:text-base"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="in_progress">قيد المعالجة</option>
            <option value="resolved">تم الحل</option>
            <option value="rejected">مرفوض</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm sm:text-base"
          >
            <option value="all">جميع الأنواع</option>
            <option value="complaint">شكوى</option>
            <option value="suggestion">اقتراح</option>
            <option value="feedback">ملاحظة</option>
            <option value="bug">بلاغ عن مشكلة</option>
          </select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {filteredComplaints.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <p className="text-gray-500">لا توجد شكاوي</p>
          </div>
        ) : (
          filteredComplaints.map((complaint) => {
            const statusBadge = getStatusBadge(complaint.status);
            const typeBadge = getTypeBadge(complaint.type);
            const priorityBadge = getPriorityBadge(complaint.priority);
            
            return (
              <div
                key={complaint.id}
                className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${
                      complaint.type === 'complaint' ? 'bg-red-100' :
                      complaint.type === 'suggestion' ? 'bg-blue-100' :
                      complaint.type === 'feedback' ? 'bg-purple-100' :
                      'bg-orange-100'
                    }`}>
                      <MessageSquare className={`w-5 h-5 sm:w-6 sm:h-6 ${
                        complaint.type === 'complaint' ? 'text-red-600' :
                        complaint.type === 'suggestion' ? 'text-blue-600' :
                        complaint.type === 'feedback' ? 'text-purple-600' :
                        'text-orange-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-800">{complaint.subject || 'بدون موضوع'}</h3>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color} whitespace-nowrap`}>
                          {statusBadge.text}
                        </span>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${typeBadge.color} whitespace-nowrap`}>
                          {typeBadge.text}
                        </span>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${priorityBadge.color} whitespace-nowrap`}>
                          {priorityBadge.text}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">
                        {complaint.description || 'لا يوجد وصف'}
                      </p>
                      <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>{complaint.userName || 'مستخدم غير محدد'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>
                            {complaint.createdAt
                              ? (() => {
                                  const date = new Date(complaint.createdAt);
                                  return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm', { locale: ar });
                                })()
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right sm:ml-4">
                    <button
                      onClick={() => setSelectedComplaint(complaint)}
                      className="flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 bg-green-50 hover:bg-green-100 rounded-lg transition-all text-xs sm:text-sm font-semibold w-full sm:w-auto"
                    >
                      <Filter className="w-4 h-4" />
                      التفاصيل
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">تفاصيل الشكوى</h2>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الموضوع</h3>
                <p className="text-sm sm:text-base text-gray-800">{selectedComplaint.subject || 'بدون موضوع'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الوصف</h3>
                <p className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap">{selectedComplaint.description || 'لا يوجد وصف'}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">اسم المستخدم</h3>
                  <p className="text-sm sm:text-base text-gray-800">{selectedComplaint.userName || 'غير محدد'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">البريد الإلكتروني</h3>
                  <p className="text-sm sm:text-base text-gray-800 break-all">{selectedComplaint.userEmail || 'غير محدد'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">النوع</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${getTypeBadge(selectedComplaint.type).color}`}>
                    {getTypeBadge(selectedComplaint.type).text}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الأولوية</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${getPriorityBadge(selectedComplaint.priority).color}`}>
                    {getPriorityBadge(selectedComplaint.priority).text}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">الحالة</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${getStatusBadge(selectedComplaint.status).color}`}>
                    {getStatusBadge(selectedComplaint.status).text}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-gray-700 mb-1 sm:mb-2">تاريخ الإنشاء</h3>
                <p className="text-sm sm:text-base text-gray-800">
                  {selectedComplaint.createdAt
                    ? (() => {
                        const date = new Date(selectedComplaint.createdAt);
                        return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy, HH:mm:ss', { locale: ar });
                      })()
                    : '-'}
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
                {selectedComplaint.status === 'pending' && (
                  <button
                    onClick={() => updateComplaintStatus(selectedComplaint.id, 'in_progress')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm sm:text-base"
                  >
                    بدء المعالجة
                  </button>
                )}
                {selectedComplaint.status === 'in_progress' && (
                  <button
                    onClick={() => updateComplaintStatus(selectedComplaint.id, 'resolved')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm sm:text-base"
                  >
                    تم الحل
                  </button>
                )}
                {(selectedComplaint.status === 'pending' || selectedComplaint.status === 'in_progress') && (
                  <button
                    onClick={() => updateComplaintStatus(selectedComplaint.id, 'rejected')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm sm:text-base"
                  >
                    رفض
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
