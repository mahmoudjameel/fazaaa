import { useEffect, useState } from 'react';
import {
  Search, Ticket, Clock, CheckCircle, AlertCircle, MessageSquare,
  User, Calendar, Filter, Send, XCircle, ArrowRight, RefreshCw
} from 'lucide-react';
import { collection, getDocs, query, orderBy, doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_OPTIONS = [
  { key: 'open', label: 'مفتوحة', color: 'amber', icon: Clock },
  { key: 'in_progress', label: 'قيد المعالجة', color: 'blue', icon: RefreshCw },
  { key: 'resolved', label: 'تم الحل', color: 'green', icon: CheckCircle },
  { key: 'closed', label: 'مغلقة', color: 'gray', icon: XCircle },
];

const CATEGORY_LABELS = {
  general: 'استفسار عام',
  order: 'مشكلة في طلب',
  payment: 'مشكلة في الدفع',
  provider: 'شكوى على مزود',
  app: 'مشكلة تقنية',
  suggestion: 'اقتراح',
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'open': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
    case 'closed': return 'bg-gray-100 text-gray-600 border-gray-200';
    default: return 'bg-amber-100 text-amber-700 border-amber-200';
  }
};

const getStatusLabel = (status) => {
  const s = STATUS_OPTIONS.find(o => o.key === status);
  return s?.label || 'مفتوحة';
};

export const SupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setTickets(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    let filtered = [...tickets];
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        (t.subject || '').toLowerCase().includes(s) ||
        (t.userName || '').toLowerCase().includes(s) ||
        (t.userPhone || '').includes(s) ||
        (t.message || '').toLowerCase().includes(s)
      );
    }
    setFilteredTickets(filtered);
  }, [tickets, statusFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets]);

  const formatDate = (ts) => {
    if (!ts) return '-';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return format(d, 'dd MMM yyyy - hh:mm a', { locale: ar });
    } catch { return '-'; }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
        adminReply: replyText.trim(),
        status: selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status,
        updatedAt: serverTimestamp(),
        repliedBy: localStorage.getItem('admin_name') || 'Admin',
        repliedAt: serverTimestamp(),
      });
      setReplyText('');
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('حدث خطأ أثناء إرسال الرد');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">جاري تحميل التذاكر...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">تذاكر الدعم الفني</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة تذاكر الدعم والرد على العملاء</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setStatusFilter('all')}>
          <div className="flex items-center justify-between mb-2">
            <Ticket className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-black text-gray-800">{stats.total}</span>
          </div>
          <p className="text-sm text-gray-500 font-medium text-right">إجمالي التذاكر</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setStatusFilter('open')}>
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-black text-amber-600">{stats.open}</span>
          </div>
          <p className="text-sm text-amber-600 font-medium text-right">مفتوحة</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setStatusFilter('in_progress')}>
          <div className="flex items-center justify-between mb-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-black text-blue-600">{stats.in_progress}</span>
          </div>
          <p className="text-sm text-blue-600 font-medium text-right">قيد المعالجة</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => setStatusFilter('resolved')}>
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-black text-green-600">{stats.resolved}</span>
          </div>
          <p className="text-sm text-green-600 font-medium text-right">تم الحل</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالعنوان، الاسم، الهاتف..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-orange/20 focus:border-primary-orange outline-none text-right"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-orange/20 focus:border-primary-orange outline-none text-right bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            {STATUS_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-orange/20 focus:border-primary-orange outline-none text-right bg-white"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">كل التصنيفات</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tickets list */}
        <div className={`${selectedTicket ? 'hidden lg:block lg:w-2/5' : 'w-full'}`}>
          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">لا توجد تذاكر</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => { setSelectedTicket(ticket); setReplyText(ticket.adminReply || ''); }}
                  className={`bg-white rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md ${selectedTicket?.id === ticket.id ? 'border-primary-orange shadow-md ring-1 ring-primary-orange/20' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getStatusStyle(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                    <h3 className="flex-1 text-sm font-bold text-gray-800 text-right line-clamp-1">{ticket.subject}</h3>
                  </div>
                  <p className="text-xs text-gray-500 text-right line-clamp-2 mb-3">{ticket.message}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                    <div className="flex items-center gap-2">
                      <span>{ticket.userName || 'عميل'}</span>
                      <User className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                    {ticket.adminReply ? (
                      <span className="text-green-500 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> تم الرد
                      </span>
                    ) : (
                      <span className="text-amber-500 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> بانتظار الرد
                      </span>
                    )}
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTicket && (
          <div className="flex-1 lg:w-3/5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Detail header */}
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setSelectedTicket(null)} className="lg:hidden text-sm text-primary-orange font-medium flex items-center gap-1">
                    <ArrowRight className="w-4 h-4" /> الرجوع
                  </button>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${getStatusStyle(selectedTicket.status)}`}>
                    {getStatusLabel(selectedTicket.status)}
                  </span>
                </div>
                <h2 className="text-lg font-black text-gray-800 text-right mb-2">{selectedTicket.subject}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedTicket.userName || 'عميل'}</span>
                  {selectedTicket.userPhone && <span className="direction-ltr">{selectedTicket.userPhone}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(selectedTicket.createdAt)}</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded-md font-medium">{CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}</span>
                </div>
              </div>

              {/* Message */}
              <div className="p-5 border-b border-gray-100">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2 justify-end">
                    <span className="text-sm font-bold text-amber-700">رسالة العميل</span>
                    <User className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed text-right whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>
              </div>

              {/* Status change */}
              <div className="p-5 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-2 text-right">تغيير الحالة:</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.key}
                        onClick={() => handleStatusChange(s.key)}
                        disabled={updatingStatus || selectedTicket.status === s.key}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          selectedTicket.status === s.key
                            ? getStatusStyle(s.key) + ' ring-2 ring-offset-1'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        } disabled:opacity-50`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reply section */}
              <div className="p-5">
                <p className="text-sm font-bold text-gray-700 mb-3 text-right">الرد على العميل:</p>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-orange/20 focus:border-primary-orange outline-none text-right resize-none"
                  rows={4}
                  placeholder="اكتب ردك هنا..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  dir="rtl"
                />
                <div className="flex items-center justify-between mt-3">
                  {selectedTicket.repliedAt && (
                    <span className="text-xs text-gray-400">
                      آخر رد: {formatDate(selectedTicket.repliedAt)} — {selectedTicket.repliedBy || ''}
                    </span>
                  )}
                  <button
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-orange text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md mr-auto"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        إرسال الرد
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTickets;
