import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Globe, MapPin, AlertTriangle, RefreshCw, TrendingUp,
  Users, ShoppingBag, Eye, Target, Megaphone, Loader2, Lightbulb, Download, Smartphone,
} from 'lucide-react';
import {
  getLatestMarketingSnapshot,
  refreshMarketingInsights,
  formatCoverageStatus,
  channelLabel,
  sourceLabel,
  mediumLabel,
  downloadSectionLabel,
  DOWNLOAD_MATRIX_ROWS,
} from '../services/marketingInsightsService';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { id: 'downloads', label: 'تحميل التطبيق', icon: Download },
  { id: 'sources', label: 'مصادر الزيارات', icon: Megaphone },
  { id: 'cities', label: 'المدن', icon: MapPin },
  { id: 'gaps', label: 'فجوات التغطية', icon: AlertTriangle },
  { id: 'recommendations', label: 'توصيات', icon: Lightbulb },
];

function StatCard({ icon: Icon, label, value, sub, color = 'amber' }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-black text-gray-900">{value ?? '—'}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, value, max, extra }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="font-semibold text-gray-800 truncate">{label}</span>
        <span className="text-gray-500 flex-shrink-0">{value}{extra ? ` · ${extra}` : ''}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-l from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MarketingInsights() {
  const [snapshot, setSnapshot] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await getLatestMarketingSnapshot();
      setSnapshot(res.snapshot);
      setMeta(res.meta);
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل البيانات. تأكد من نشر Cloud Functions وتشغيل التجميع.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await refreshMarketingInsights(30);
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'فشل تحديث البيانات');
    } finally {
      setRefreshing(false);
    }
  };

  const totals = snapshot?.totals || {};
  const traffic = snapshot?.traffic || {};
  const downloads = snapshot?.downloads || {};
  const cities = snapshot?.cities || [];
  const gaps = snapshot?.gaps || [];
  const recommendations = snapshot?.recommendations || [];

  const topSources = useMemo(() => {
    const entries = Object.entries(traffic.bySource || {}).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return { entries: entries.slice(0, 12), max };
  }, [traffic.bySource]);

  const topChannels = useMemo(() => {
    const entries = Object.entries(traffic.byChannel || {}).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return { entries, max };
  }, [traffic.byChannel]);

  const topMediums = useMemo(() => {
    const entries = Object.entries(traffic.byMedium || {}).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return { entries, max };
  }, [traffic.byMedium]);

  const topPages = useMemo(() => {
    const entries = Object.entries(traffic.byPage || {}).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return { entries: entries.slice(0, 10), max };
  }, [traffic.byPage]);

  const downloadSections = useMemo(() => {
    const entries = Object.entries(downloads.bySection || {}).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return { entries, max };
  }, [downloads.bySection]);

  const downloadSources = useMemo(() => {
    const entries = Object.entries(downloads.bySource || {}).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return { entries, max };
  }, [downloads.bySource]);

  const downloadCities = useMemo(
    () => [...(downloads.byCity || [])].sort((a, b) => b.total - a.total),
    [downloads.byCity]
  );

  const matrix = downloads.matrix || {};

  const sortedCities = useMemo(
    () => [...cities].sort((a, b) => b.pageViews - a.pageViews),
    [cities]
  );

  const conversionRate = totals.pageViews > 0 && totals.downloadClicks != null
    ? Math.round((totals.downloadClicks / totals.pageViews) * 1000) / 10
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">جاري تحميل تحليلات التسويق...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Globe className="w-7 h-7 text-amber-500" />
            تحليلات التسويق والتغطية
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            مصادر الزيارات، المدن الجغرافية، ومقارنتها بالمزودين والطلبات
            {meta?.date ? ` · آخر تحديث: ${meta.date}` : ''}
            {snapshot?.periodDays ? ` · آخر ${snapshot.periodDays} يوم` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-950 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'جاري التحديث...' : 'تحديث البيانات'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {snapshot && totals.pageViews === 0 && totals.downloadClicks === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3 space-y-1">
          <p className="font-bold">لا توجد زيارات أو ضغطات مسجّلة في هذه الفترة</p>
          <p className="text-xs leading-relaxed">
            تأكد أنك تختبر من موقع React (مثل <strong>fazaaa.vercel.app</strong>) وليس من GoDaddy.
            افتح اللاندينق `/` → اضغط تحميل → ارجع واضغط «تحديث البيانات».
            {totals.rawEventsLoaded != null && (
              <> · أحداث محمّلة: {totals.rawEventsLoaded}
                {totals.sampleEventsAllTime > 0 && totals.rawEventsLoaded === 0
                  ? ` (يوجد ${totals.sampleEventsAllTime}+ أحداث خارج نطاق ${snapshot.periodDays} يوم)`
                  : ''}
              </>
            )}
          </p>
        </div>
      )}

      {!snapshot && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-800">لا توجد بيانات مجمّعة بعد</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">
            بعد زيارات الصفحات العامة (الرئيسية، المدونة) اضغط «تحديث البيانات» لتجميع الإحصائيات.
            تأكد من نشر الدوال <code className="text-xs bg-gray-100 px-1 rounded">recordMarketingPageView</code> و
            <code className="text-xs bg-gray-100 px-1 rounded mx-1">refreshMarketingInsights</code>.
          </p>
        </div>
      )}

      {snapshot && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Eye} label="زيارات الصفحات" value={totals.pageViews} sub={`${totals.sessions || 0} جلسة`} color="amber" />
            <StatCard icon={Download} label="ضغطات التحميل" value={totals.downloadClicks ?? downloads.total ?? 0} sub={`${conversionRate}% من الزيارات`} color="blue" />
            <StatCard icon={Users} label="المزودون المعتمدون" value={totals.providers} color="emerald" />
            <StatCard icon={Users} label="العملاء" value={totals.customers} color="violet" />
            <StatCard icon={ShoppingBag} label="الطلبات (الفترة)" value={totals.orders} color="violet" />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    active ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {t.id === 'gaps' && gaps.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{gaps.length}</span>
                  )}
                  {t.id === 'downloads' && (downloads.total ?? 0) > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] px-1.5 rounded-full">{downloads.total}</span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <h3 className="font-black text-gray-900">أهم قنوات الزيارات</h3>
                {topChannels.entries.length === 0 ? (
                  <p className="text-sm text-gray-400">لا توجد بيانات بعد</p>
                ) : (
                  topChannels.entries.map(([ch, val]) => (
                    <BarRow key={ch} label={channelLabel(ch)} value={val} max={topChannels.max} />
                  ))
                )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <h3 className="font-black text-gray-900">ملخص التحميلات</h3>
                {(downloads.total ?? 0) === 0 ? (
                  <p className="text-sm text-gray-400">لا توجد ضغطات تحميل بعد — جرّب الضغط على أزرار App Store / Google Play في الصفحة الرئيسية</p>
                ) : (
                  DOWNLOAD_MATRIX_ROWS.map((row) => (
                    <BarRow key={row.key} label={row.label} value={matrix[row.key] || 0} max={downloads.total || 1} />
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'downloads' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Download} label="إجمالي الضغطات" value={downloads.total ?? 0} color="amber" />
                <StatCard icon={Smartphone} label="App Store" value={downloads.byStore?.apple ?? 0} color="blue" />
                <StatCard icon={Smartphone} label="Google Play" value={downloads.byStore?.google ?? 0} color="emerald" />
                <StatCard icon={TrendingUp} label="معدل التحويل" value={`${conversionRate}%`} sub="ضغطات ÷ زيارات" color="violet" />
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-black text-gray-900">جدول التحميلات — حسب التطبيق والمتجر</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-right px-4 py-3 font-bold">التطبيق</th>
                        <th className="text-right px-4 py-3 font-bold">App Store</th>
                        <th className="text-right px-4 py-3 font-bold">Google Play</th>
                        <th className="text-right px-4 py-3 font-bold">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'تطبيق العميل', apple: matrix.customer_apple || 0, google: matrix.customer_google || 0 },
                        { label: 'تطبيق المزود', apple: matrix.provider_apple || 0, google: matrix.provider_google || 0 },
                      ].map((row) => (
                        <tr key={row.label} className="border-t border-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{row.label}</td>
                          <td className="px-4 py-3">{row.apple}</td>
                          <td className="px-4 py-3">{row.google}</td>
                          <td className="px-4 py-3 font-bold text-amber-700">{row.apple + row.google}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-100 bg-gray-50/80 font-bold">
                        <td className="px-4 py-3">المجموع</td>
                        <td className="px-4 py-3">{downloads.byStore?.apple ?? 0}</td>
                        <td className="px-4 py-3">{downloads.byStore?.google ?? 0}</td>
                        <td className="px-4 py-3 text-amber-700">{downloads.total ?? 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">حسب موقع الزر في الصفحة</h3>
                  {downloadSections.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">لا توجد بيانات</p>
                  ) : (
                    downloadSections.entries.map(([section, val]) => (
                      <BarRow key={section} label={downloadSectionLabel(section)} value={val} max={downloadSections.max} />
                    ))
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">حسب مصدر الزيارة (UTM / Referrer)</h3>
                  {downloadSources.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">لا توجد بيانات</p>
                  ) : (
                    downloadSources.entries.map(([src, val]) => (
                      <BarRow key={src} label={channelLabel(src) !== src ? channelLabel(src) : src} value={val} max={downloadSources.max} />
                    ))
                  )}
                </div>
              </div>

              {downloadCities.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-black text-gray-900">التحميلات حسب المدينة</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs">
                          <th className="text-right px-4 py-3 font-bold">المدينة</th>
                          <th className="text-right px-4 py-3 font-bold">عميل Apple</th>
                          <th className="text-right px-4 py-3 font-bold">عميل Google</th>
                          <th className="text-right px-4 py-3 font-bold">مزود Apple</th>
                          <th className="text-right px-4 py-3 font-bold">مزود Google</th>
                          <th className="text-right px-4 py-3 font-bold">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {downloadCities.slice(0, 20).map((c) => (
                          <tr key={c.cityKey} className="border-t border-gray-50 hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-semibold">{c.cityName}</td>
                            <td className="px-4 py-3">{c.customer_apple || 0}</td>
                            <td className="px-4 py-3">{c.customer_google || 0}</td>
                            <td className="px-4 py-3">{c.provider_apple || 0}</td>
                            <td className="px-4 py-3">{c.provider_google || 0}</td>
                            <td className="px-4 py-3 font-bold">{c.total || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'sources' && (
            <div className="space-y-6">
              {(topSources.entries.length === 0 && topChannels.entries.length === 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3">
                  <p className="font-bold">لا توجد مصادر زيارات بعد</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    استخدم روابط UTM في الإعلانات، مثل:{' '}
                    <code className="bg-white/80 px-1 rounded text-[11px]">
                      ?utm_source=instagram&utm_medium=social&utm_campaign=ramadan
                    </code>
                    ثم افتح اللاندينق واضغط «تحديث البيانات».
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">حسب المصدر (utm / referrer)</h3>
                  {topSources.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">لا توجد بيانات — تشمل زيارات الصفحة وضغطات التحميل</p>
                  ) : (
                    topSources.entries.map(([src, val]) => (
                      <BarRow key={src} label={sourceLabel(src)} value={val} max={topSources.max} extra={src} />
                    ))
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">حسب القناة</h3>
                  {topChannels.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">لا توجد بيانات</p>
                  ) : (
                    topChannels.entries.map(([ch, val]) => (
                      <BarRow key={ch} label={channelLabel(ch)} value={val} max={topChannels.max} />
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">حسب الوسيط (medium)</h3>
                  {topMediums.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">لا توجد بيانات</p>
                  ) : (
                    topMediums.entries.map(([med, val]) => (
                      <BarRow key={med} label={mediumLabel(med)} value={val} max={topMediums.max} extra={med} />
                    ))
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">حملات UTM</h3>
                  {Object.keys(traffic.byCampaign || {}).length === 0 ? (
                    <p className="text-sm text-gray-400">أضف <code className="text-xs bg-gray-100 px-1 rounded">utm_campaign</code> في روابط الإعلانات لتتبع الحملات.</p>
                  ) : (
                    Object.entries(traffic.byCampaign)
                      .sort((a, b) => b[1] - a[1])
                      .map(([camp, val]) => (
                        <BarRow key={camp} label={camp} value={val} max={topSources.max} />
                      ))
                  )}
                </div>
              </div>

              {downloadSources.entries.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">مصادر ضغطات التحميل</h3>
                  {downloadSources.entries.map(([src, val]) => (
                    <BarRow key={src} label={sourceLabel(src)} value={val} max={downloadSources.max} extra={src} />
                  ))}
                </div>
              )}

              {topPages.entries.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-900">أكثر الصفحات زيارة</h3>
                  {topPages.entries.map(([page, val]) => (
                    <BarRow key={page} label={page} value={val} max={topPages.max} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'cities' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs">
                      <th className="text-right px-4 py-3 font-bold">المدينة</th>
                      <th className="text-right px-4 py-3 font-bold">زيارات</th>
                      <th className="text-right px-4 py-3 font-bold">جلسات</th>
                      <th className="text-right px-4 py-3 font-bold">مزودون</th>
                      <th className="text-right px-4 py-3 font-bold">عملاء</th>
                      <th className="text-right px-4 py-3 font-bold">طلبات</th>
                      <th className="text-right px-4 py-3 font-bold">الحالة</th>
                      <th className="text-right px-4 py-3 font-bold">فجوة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCities.map((c) => {
                      const st = formatCoverageStatus(c.coverageStatus);
                      return (
                        <tr key={c.cityKey} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{c.cityName}</td>
                          <td className="px-4 py-3">{c.pageViews}</td>
                          <td className="px-4 py-3">{c.sessions}</td>
                          <td className="px-4 py-3">{c.providers}</td>
                          <td className="px-4 py-3">{c.customers}</td>
                          <td className="px-4 py-3">{c.orders}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-bold border ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${c.gapScore >= 50 ? 'text-red-600' : c.gapScore >= 25 ? 'text-orange-600' : 'text-gray-500'}`}>
                              {c.gapScore}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'gaps' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gaps.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400">
                  <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  لا توجد فجوات حرجة في الفترة الحالية
                </div>
              ) : (
                gaps.map((g) => {
                  const st = formatCoverageStatus(g.coverageStatus);
                  return (
                    <div key={g.cityKey} className="bg-white rounded-2xl border border-gray-100 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-gray-900">{g.cityName}</h3>
                          <span className={`inline-flex mt-2 px-2 py-0.5 rounded-lg text-xs font-bold border ${st.cls}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="text-left">
                          <div className="text-2xl font-black text-red-600">{g.gapScore}</div>
                          <div className="text-[10px] text-gray-400">درجة الفجوة</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-400">زيارات</span><div className="font-bold">{g.pageViews}</div></div>
                        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-400">مزودون</span><div className="font-bold">{g.providers}</div></div>
                        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-400">طلبات</span><div className="font-bold">{g.orders}</div></div>
                        <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-400">تحويل</span><div className="font-bold">{g.conversionRate}%</div></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'recommendations' && (
            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">ستظهر التوصيات بعد تجميع بيانات كافية</p>
              ) : (
                recommendations.map((r, i) => (
                  <div
                    key={`${r.cityKey}-${i}`}
                    className={`rounded-2xl border p-4 ${
                      r.priority === 'high' ? 'border-red-200 bg-red-50/50' : r.priority === 'medium' ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <h3 className="font-bold text-gray-900">{r.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 pr-6">{r.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
