import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  AlertTriangle, ChevronDown, Loader2, LogOut, RefreshCw, Search, Smartphone, Users,
} from 'lucide-react';
import { db } from '../services/firebase';
import { revokeProviderDevices } from '../services/adminService';

/**
 * كم جهازاً داخل بكل حساب مزود — لكشف الحساب الذي يستخدمه أكثر من شخص.
 * المصدران:
 *  - providers/{id}/devices: كل جهاز يسجّل نفسه مع النبض (تطبيق 5.5.32 فما فوق) → «متصل الآن» = ظهر خلال 24 ساعة
 *  - providers/{id}/loginSessions: كل دخول برمز التحقق (كل النسخ) → أجهزة دخلت خلال 60 يوماً
 */
const DAY = 86400000;
const CONNECTED_WINDOW = DAY;
const LOGIN_WINDOW = 60 * DAY;

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
};
const fmt = (ms) => (ms ? format(new Date(ms), 'dd MMM، HH:mm', { locale: ar }) : '—');
const nameOf = (p) => p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';
const deviceLabel = (d) => [d.brand, d.model].filter(Boolean).join(' ') || d.deviceId?.slice(0, 10) || 'جهاز';

const FILTERS = [
  { key: 'multiNow', label: 'أكثر من جهاز متصل الآن' },
  { key: 'multi60', label: 'أكثر من جهاز خلال 60 يوماً' },
  { key: 'mismatch', label: 'جهاز الإشعارات غير جهاز الدخول' },
  { key: 'all', label: 'الكل' },
];

export default function ProviderDevices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('multiNow');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [providersSnap, devicesSnap, loginsSnap] = await Promise.all([
        getDocs(collection(db, 'providers')),
        getDocs(collectionGroup(db, 'devices')),
        getDocs(collectionGroup(db, 'loginSessions')),
      ]);
      const now = Date.now();
      const devicesBy = new Map();
      devicesSnap.forEach((d) => {
        const providerId = d.ref.parent.parent?.id;
        if (!providerId) return;
        if (!devicesBy.has(providerId)) devicesBy.set(providerId, []);
        devicesBy.get(providerId).push({ ...d.data(), lastSeenMs: toMs(d.data().lastSeenAt) });
      });
      const loginsBy = new Map();
      loginsSnap.forEach((d) => {
        const providerId = d.ref.parent.parent?.id;
        const data = d.data();
        const at = toMs(data.loggedInAt);
        if (!providerId || now - at > LOGIN_WINDOW) return;
        if (!loginsBy.has(providerId)) loginsBy.set(providerId, []);
        loginsBy.get(providerId).push({
          deviceId: data.deviceInfo?.deviceId || null,
          model: data.deviceInfo?.modelName || data.deviceInfo?.model || null,
          brand: data.deviceInfo?.brand || null,
          platform: data.platform || null,
          appVersion: data.appVersion || null,
          at,
        });
      });

      const list = [];
      providersSnap.forEach((d) => {
        const p = d.data();
        if (p.mergedInto) return;
        const status = p.approvalStatus || p.status;
        if (!['approved', 'suspended'].includes(status)) return;
        const devices = (devicesBy.get(d.id) || []).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
        const connected = devices.filter((x) => now - x.lastSeenMs <= CONNECTED_WINDOW);
        const logins = (loginsBy.get(d.id) || []).sort((a, b) => b.at - a.at);
        const loginDevices = new Set(logins.map((x) => x.deviceId).filter(Boolean));
        const lastLoginPlatform = logins[0]?.platform || null;
        list.push({
          id: d.id,
          name: nameOf(p),
          number: p.providerNumber || '—',
          phone: p.phone || '',
          city: p.city || '',
          status,
          devices,
          connectedCount: connected.length,
          logins,
          loginDeviceCount: loginDevices.size,
          mismatch: Boolean(lastLoginPlatform && p.pushPlatform && lastLoginPlatform !== p.pushPlatform),
          pushPlatform: p.pushPlatform || null,
          lastLoginPlatform,
          lastHeartbeatMs: toMs(p.lastHeartbeat),
        });
      });
      list.sort((a, b) => (b.connectedCount - a.connectedCount) || (b.loginDeviceCount - a.loginDeviceCount));
      setRows(list);
    } catch (e) {
      setError(e?.message || 'تعذر التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    multiNow: rows.filter((r) => r.connectedCount > 1).length,
    multi60: rows.filter((r) => r.loginDeviceCount > 1).length,
    mismatch: rows.filter((r) => r.mismatch).length,
    all: rows.length,
    reporting: rows.filter((r) => r.devices.length > 0).length,
  }), [rows]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return rows.filter((r) => {
      if (filter === 'multiNow' && r.connectedCount < 2) return false;
      if (filter === 'multi60' && r.loginDeviceCount < 2) return false;
      if (filter === 'mismatch' && !r.mismatch) return false;
      if (!term) return true;
      return r.name.toLowerCase().includes(term) || r.number.toLowerCase() === term
        || (digits.length >= 4 && r.phone.includes(digits.slice(-9)));
    });
  }, [rows, filter, search]);

  const revoke = async (row) => {
    if (!window.confirm(`إخراج كل الأجهزة من حساب ${row.name} (${row.number})؟`)) return;
    setRevoking(row.id);
    try {
      await revokeProviderDevices(row.id);
      alert('تم: الأجهزة الحديثة تخرج فوراً، والقديمة خلال ساعة كحد أقصى');
    } catch (e) {
      alert(e?.message || 'تعذر الإخراج');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-teal-600" />
            أجهزة المزودين
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            كم جهازاً داخل بكل حساب. «متصل الآن» = ظهر خلال آخر 24 ساعة، ويظهر لمن عنده التطبيق 5.5.32 فما فوق
            ({counts.reporting} حساب يرسل حالياً). النسخ الأقدم تظهر من سجل الدخول برمز التحقق.
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

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold ${filter === f.key ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {f.label} <span className="opacity-70">({counts[f.key]})</span>
          </button>
        ))}
        <div className="relative mr-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اسم، جوال أو P10014"
            className="pr-9 pl-3 py-2 rounded-xl border border-gray-200 text-sm w-56"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-6 text-center">لا يوجد حسابات بهذا الفلتر.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-right">المزود</th>
                  <th className="px-4 py-2 text-center">متصل الآن</th>
                  <th className="px-4 py-2 text-center">دخل خلال 60 يوماً</th>
                  <th className="px-4 py-2 text-right">ملاحظة</th>
                  <th className="px-4 py-2 text-right">آخر نبض</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-right flex items-center gap-2">
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open === r.id ? 'rotate-180' : ''}`} />
                          <span>
                            <span className="font-bold text-gray-900">{r.name}</span>
                            <span className="block text-xs text-gray-500" dir="ltr">
                              <Link to={`/admin/account-history?q=${r.number}`} className="text-teal-700 underline decoration-dotted">{r.number}</Link>
                              {' · '}{r.phone}{r.status === 'suspended' ? ' · موقوف' : ''}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full font-black ${r.connectedCount > 1 ? 'bg-red-100 text-red-700' : r.connectedCount === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                          {r.devices.length ? r.connectedCount : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full font-bold ${r.loginDeviceCount > 1 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                          {r.loginDeviceCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {r.mismatch && (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            دخل من {r.lastLoginPlatform} والإشعارات على {r.pushPlatform}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmt(r.lastHeartbeatMs)}</td>
                      <td className="px-4 py-3 text-left">
                        {(r.connectedCount > 1 || r.loginDeviceCount > 1 || r.mismatch) && (
                          <button
                            type="button"
                            onClick={() => revoke(r)}
                            disabled={revoking === r.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                          >
                            {revoking === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                            إخراج كل الأجهزة
                          </button>
                        )}
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="grid md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-bold text-gray-700 mb-1 flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> الأجهزة التي ترسل نبضاً</div>
                              {r.devices.length === 0 ? <p className="text-gray-400">لا يوجد (نسخة أقدم من 5.5.32)</p> : (
                                <ul className="space-y-1">
                                  {r.devices.map((dv) => (
                                    <li key={dv.deviceId} className="flex flex-wrap gap-x-2">
                                      <span className={`font-bold ${Date.now() - dv.lastSeenMs <= CONNECTED_WINDOW ? 'text-emerald-700' : 'text-gray-500'}`}>{deviceLabel(dv)}</span>
                                      <span className="text-gray-500">{dv.platform} {dv.osVersion} · نسخة {dv.appVersion || '—'}</span>
                                      <span className="text-gray-400">آخر ظهور {fmt(dv.lastSeenMs)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-gray-700 mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> الدخول برمز التحقق (60 يوماً)</div>
                              {r.logins.length === 0 ? <p className="text-gray-400">لا يوجد</p> : (
                                <ul className="space-y-1">
                                  {r.logins.slice(0, 10).map((l, i) => (
                                    <li key={i} className="flex flex-wrap gap-x-2">
                                      <span className="font-bold text-gray-700">{deviceLabel(l)}</span>
                                      <span className="text-gray-500">{l.platform} · نسخة {l.appVersion || '—'}</span>
                                      <span className="text-gray-400">{fmt(l.at)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
