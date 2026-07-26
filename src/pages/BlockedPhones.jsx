import { useEffect, useMemo, useState } from 'react';
import { Ban, Loader2, Phone, Plus, RefreshCw, Search, ShieldOff, User, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  banPhoneNumber,
  getBlockedPhones,
  normalizeBanPhone966,
  unbanPhoneNumber,
} from '../services/adminService';

const KIND_LABEL = {
  customer: 'عميل',
  provider: 'مزود',
  all: 'عام',
};

const toDate = (val) => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val?.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function BlockedPhones() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [kindInput, setKindInput] = useState('all');
  const [saving, setSaving] = useState(false);
  const [unbanningId, setUnbanningId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getBlockedPhones();
      setBlocks(result.blocks || []);
      if (!result.success && result.error) setError(result.error);
    } catch (e) {
      setError(e?.message || 'فشل تحميل القائمة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return blocks;
    return blocks.filter((b) => {
      const hay = [
        b.phone,
        b.phoneDisplay,
        b.reason,
        b.relatedUserName,
        b.bannedByName,
        b.bannedBy,
        KIND_LABEL[b.accountKind] || b.accountKind,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term) || String(b.phone || '').includes(term.replace(/\D/g, ''));
    });
  }, [blocks, searchTerm]);

  const handleBan = async (e) => {
    e.preventDefault();
    setError('');
    const phone = normalizeBanPhone966(phoneInput);
    if (!phone || phone.length < 12) {
      setError('أدخل رقم جوال سعودي صالح');
      return;
    }
    setSaving(true);
    try {
      await banPhoneNumber({
        phone,
        reason: reasonInput,
        accountKind: kindInput,
        bannedBy: localStorage.getItem('admin_email') || localStorage.getItem('admin_uid') || null,
        bannedByName: localStorage.getItem('admin_name') || null,
      });
      setPhoneInput('');
      setReasonInput('');
      setKindInput('all');
      await load();
    } catch (err) {
      setError(err?.message || 'فشل الحظر');
    } finally {
      setSaving(false);
    }
  };

  const handleUnban = async (block) => {
    if (!window.confirm(`إلغاء الحظر عن الرقم ${block.phoneDisplay || block.phone}؟`)) return;
    setUnbanningId(block.id || block.phone);
    setError('');
    try {
      await unbanPhoneNumber(block.phone || block.id);
      await load();
    } catch (err) {
      setError(err?.message || 'فشل إلغاء الحظر');
    } finally {
      setUnbanningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Ban className="w-7 h-7 text-red-600" />
            حظر الأرقام
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            الرقم المحظور لا يستطيع التسجيل أو الدخول كتطبيق عميل أو مزود (يُمنع إرسال رمز التحقق من السيرفر).
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <form
        onSubmit={handleBan}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-4"
      >
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus className="w-5 h-5 text-red-600" />
          حظر رقم جديد
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1">رقم الجوال</label>
            <input
              type="tel"
              dir="ltr"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="05xxxxxxxx"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-red-400 outline-none font-mono"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1">نوع الحساب (للمرجع)</label>
            <select
              value={kindInput}
              onChange={(e) => setKindInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none"
            >
              <option value="all">عام</option>
              <option value="customer">عميل</option>
              <option value="provider">مزود</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">سبب الحظر (اختياري)</label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="مثال: إساءة استخدام / احتيال"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-red-400 outline-none"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
          حظر الرقم
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالرقم أو السبب أو الاسم…"
              className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none text-sm"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            {filtered.length} محظور
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">لا توجد أرقام محظورة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">الرقم</th>
                  <th className="px-4 py-3 text-right font-semibold">النوع</th>
                  <th className="px-4 py-3 text-right font-semibold">الحساب المرتبط</th>
                  <th className="px-4 py-3 text-right font-semibold">السبب</th>
                  <th className="px-4 py-3 text-right font-semibold">تاريخ الحظر</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((block) => {
                  const created = toDate(block.createdAt) || toDate(block.createdAtIso);
                  const busy = unbanningId === (block.id || block.phone);
                  return (
                    <tr key={block.id || block.phone} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-mono text-gray-800" dir="ltr">
                          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <div className="font-bold">{block.phoneDisplay || block.phone}</div>
                            <div className="text-[11px] text-gray-400">{block.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                          {block.accountKind === 'provider' ? (
                            <Wrench className="w-3 h-3" />
                          ) : block.accountKind === 'customer' ? (
                            <User className="w-3 h-3" />
                          ) : null}
                          {KIND_LABEL[block.accountKind] || 'عام'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {block.relatedUserName || '—'}
                        {block.relatedUserId && (
                          <div className="text-[10px] font-mono text-gray-400 truncate max-w-[140px]" dir="ltr">
                            {block.relatedUserId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                        {block.reason || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {created
                          ? format(created, 'dd MMM yyyy، HH:mm', { locale: ar })
                          : '—'}
                        {block.bannedByName && (
                          <div className="text-[10px] text-gray-400">بواسطة {block.bannedByName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleUnban(block)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldOff className="w-3.5 h-3.5" />
                          )}
                          إلغاء الحظر
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
