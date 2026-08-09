import { useEffect, useState } from 'react';
import { MessageSquare, Search, Eye, User, Phone, X, RefreshCw } from 'lucide-react';
import { collection, getDocs, doc, getDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatOrderNumberLabel } from '../utils/orderNumber';

const CHATS_COLLECTION = 'chats';
/** لا نجلب كل المحادثات — كانت تسبب تعليق «جاري التحميل» بسبب آلاف القراءات المتسلسلة */
const CHATS_PAGE_SIZE = 80;

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const Chats = () => {
  const [chatsList, setChatsList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [requestInfo, setRequestInfo] = useState(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    let list = chatsList;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          (c.orderId && c.orderId.toLowerCase().includes(term)) ||
          (c.orderNumber && String(c.orderNumber).includes(term)) ||
          (c.customerName && c.customerName.toLowerCase().includes(term)) ||
          (c.providerName && c.providerName.toLowerCase().includes(term)) ||
          (c.lastMessage?.text && c.lastMessage.text.toLowerCase().includes(term))
      );
    }
    setFilteredList(list);
  }, [chatsList, searchTerm]);

  const loadChats = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const chatsQuery = query(
        collection(db, CHATS_COLLECTION),
        orderBy('updatedAt', 'desc'),
        limit(CHATS_PAGE_SIZE)
      );
      const snapshot = await getDocs(chatsQuery);

      const baseChats = snapshot.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          orderId: d.id,
          participants: data.participants || [],
          status: data.status || 'active',
          lastMessage: data.lastMessage || null,
          updatedAt: toMillis(data.updatedAt),
          updatedAtRaw: data.updatedAt,
        };
      });

      // موجة واحدة: جلب الطلبات بالتوازي
      const requestSnaps = await Promise.all(
        baseChats.map((chat) =>
          getDoc(doc(db, 'requests', chat.orderId)).catch(() => null)
        )
      );

      const customerIds = new Set();
      const withRequests = baseChats.map((chat, index) => {
        const requestSnap = requestSnaps[index];
        const req = requestSnap?.exists?.() ? requestSnap.data() : null;
        if (req?.customerId) customerIds.add(req.customerId);
        return {
          ...chat,
          orderNumber: req?.orderNumber != null ? req.orderNumber : null,
          providerId: req?.providerId || null,
          providerName: req?.providerName || '—',
          customerId: req?.customerId || null,
          customerName: '—',
        };
      });

      // موجة ثانية: أسماء العملاء الفريدة فقط
      const customerEntries = await Promise.all(
        [...customerIds].map(async (customerId) => {
          try {
            const custSnap = await getDoc(doc(db, 'customers', customerId));
            if (!custSnap.exists()) return [customerId, null];
            const c = custSnap.data() || {};
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || 'عميل';
            return [customerId, name];
          } catch (_) {
            return [customerId, null];
          }
        })
      );
      const customersMap = Object.fromEntries(customerEntries);

      const chats = withRequests.map((chat) => ({
        ...chat,
        customerName: (chat.customerId && customersMap[chat.customerId]) || '—',
      }));

      setChatsList(chats);
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoadError(error?.message || 'فشل تحميل المحادثات');
      setChatsList([]);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (chat) => {
    setSelectedChat(chat);
    setRequestInfo({
      orderNumber: chat.orderNumber,
      orderId: chat.orderId,
      customerName: chat.customerName,
      providerName: chat.providerName,
      providerId: chat.providerId,
    });
    setMessages([]);
  };

  useEffect(() => {
    if (!selectedChat?.orderId) return undefined;
    const messagesRef = collection(db, CHATS_COLLECTION, selectedChat.orderId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            ...x,
            createdAt: toMillis(x.createdAt),
          };
        });
        setMessages(list);
      },
      (error) => {
        console.error('Error listening to chat messages:', error);
        setMessages([]);
      }
    );
    return () => unsubscribe();
  }, [selectedChat?.orderId]);

  const getMessagePreview = (msg) => {
    if (!msg) return '—';
    if (msg.text) return msg.text;
    if (msg.type === 'image') return '📷 صورة';
    if (msg.type === 'audio') return '🎙️ مقطع صوتي';
    if (msg.type === 'location') return '📍 موقع';
    return '—';
  };

  const isProviderMessage = (senderId) => selectedChat?.providerId && senderId === selectedChat.providerId;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
        <div className="text-gray-500">جاري تحميل المحادثات...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mb-1 sm:mb-2">محادثات العميل والمزود</h1>
          <p className="text-sm sm:text-base text-gray-600">
            أحدث {CHATS_PAGE_SIZE} محادثة — عرض ومتابعة المحادثات حسب الطلب
          </p>
        </div>
        <button
          type="button"
          onClick={loadChats}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="ابحث برقم الطلب، اسم العميل، المزود، أو نص الرسالة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 sm:pr-10 pl-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm sm:text-base"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">لا توجد محادثات</p>
          </div>
        ) : (
          filteredList.map((chat) => (
            <div
              key={chat.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-bold text-gray-800">طلب {formatOrderNumberLabel(chat.orderNumber)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${chat.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {chat.status === 'active' ? 'نشط' : 'مغلق'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  <User className="inline w-4 h-4 ml-1" /> العميل: {chat.customerName}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <Phone className="inline w-4 h-4 ml-1" /> المزود: {chat.providerName}
                </p>
                {chat.lastMessage && (
                  <p className="text-xs text-gray-500 truncate">آخر رسالة: {getMessagePreview(chat.lastMessage)}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {chat.updatedAt ? format(new Date(chat.updatedAt), 'dd MMM yyyy, HH:mm', { locale: ar }) : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openChat(chat)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all text-sm font-semibold shrink-0"
              >
                <Eye className="w-4 h-4" />
                عرض المحادثة
              </button>
            </div>
          ))
        )}
      </div>

      {selectedChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">محادثة الطلب {formatOrderNumberLabel(requestInfo?.orderNumber)}</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  العميل: {requestInfo?.customerName} — المزود: {requestInfo?.providerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChat(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0 bg-gray-50 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد رسائل في هذه المحادثة</p>
              ) : (
                messages.map((msg) => {
                  const isProvider = isProviderMessage(msg.senderId);
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isProvider ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 ${
                          isProvider ? 'bg-white border border-gray-200 text-right' : 'bg-teal-600 text-white text-right'
                        }`}
                      >
                        <p className="text-xs font-semibold mb-0.5 opacity-90">{isProvider ? 'المزود' : 'العميل'}</p>
                        {msg.type === 'text' && msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                        {msg.type === 'image' && msg.mediaUrl && (
                          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 underline text-sm">
                            📷 عرض الصورة
                          </a>
                        )}
                        {msg.type === 'audio' && msg.mediaUrl && (
                          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline text-sm">
                            🎙️ استماع
                          </a>
                        )}
                        {msg.type === 'location' && msg.locationCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${msg.locationCoords.latitude},${msg.locationCoords.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-sm"
                          >
                            📍 فتح الموقع
                          </a>
                        )}
                        <p className="text-xs opacity-75 mt-1">
                          {msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm', { locale: ar }) : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
