import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Landmark } from 'lucide-react';

// رسوم بوابة الدفع على مدى كما تظهر في كشف التسوية: 0.6% + ضريبة 15% على الرسوم
// (مثال فعلي: 40 ر.س → رسوم 0.24 + ضريبة 0.04 = صافي 39.72)
const MADA_FEE_RATE = 0.006;
const FEE_VAT_RATE = 0.15;
const DAYS_SHOWN = 14;

const round2 = (n) => Math.round(n * 100) / 100;
const sar = (n) => n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** يوم العملية بتوقيت الرياض — البنك يسوّي عمليات اليوم في دفعة واحدة فجر اليوم التالي */
const riyadhDayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(date);

const dayLabel = (key) =>
  new Intl.DateTimeFormat('ar-SA', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${key}T00:00:00Z`));

/** دفع فعلي نجح عند البنك (حتى لو لم يُشحن الرصيد بعد) — شحن الإدارة لا يمرّ بالبنك */
const isSettledByBank = (r) =>
  r?.source !== 'admin_panel'
  && (String(r?.state || '').toUpperCase() === 'PAID' || String(r?.gatewayResult || '').toUpperCase() === 'CAPTURED');

// cardType فارغ في العمليات القديمة — نحسبها مدى (الأغلب) لكن نبيّن عددها
const isMada = (r) => !r?.cardType || String(r.cardType).toUpperCase() === 'MADA';
const hasNoCardType = (r) => !r?.cardType;

/**
 * ملخص التسوية اليومية — للمطابقة مع إيداع البنك «Payment gateway settlement» في اليوم التالي.
 * اليوم = تاريخ إنشاء العملية (وقت الدفع)، لا وقت الشحن: الشحن المتأخر عبر Inquiry لا يغيّر يوم التسوية.
 */
/** rowsLimit: سقف ما تجلبه الصفحة — إن بلغته فأقدم يوم معروض قد يكون ناقصاً */
export function DailySettlementSummary({ rows, rowsLimit }) {
  const [openDay, setOpenDay] = useState(null);

  const days = useMemo(() => {
    const allRows = rows || [];
    const limitReached = rowsLimit != null && allRows.length >= rowsLimit;
    const oldestMs = Math.min(...allRows.map((r) => r.createdAt?.getTime?.() || Infinity));
    const oldestKey = limitReached && Number.isFinite(oldestMs) ? riyadhDayKey(new Date(oldestMs)) : null;
    const byDay = new Map();
    (rows || []).filter(isSettledByBank).forEach((r) => {
      const at = r.createdAt || r.paidAt;
      if (!at) return;
      const key = riyadhDayKey(at);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(r);
    });
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, DAYS_SHOWN)
      .map(([key, items]) => {
        const gross = items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const madaGross = items.filter(isMada).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const fee = round2(madaGross * MADA_FEE_RATE);
        const vat = round2(fee * FEE_VAT_RATE);
        const nonMadaCount = items.filter((r) => !isMada(r)).length;
        const unknownCardCount = items.filter(hasNoCardType).length;
        return {
          key,
          items: [...items].sort((a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0)),
          count: items.length,
          gross: round2(gross),
          fee,
          vat,
          net: round2(gross - fee - vat),
          nonMadaCount,
          unknownCardCount,
          maybeIncomplete: oldestKey != null && key <= oldestKey,
        };
      });
  }, [rows, rowsLimit]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-bold text-gray-900">التسوية اليومية</h2>
      </div>
      <p className="text-xs text-gray-500 mb-3 leading-5">
        عمليات كل يوم يودعها البنك دفعة واحدة فجر اليوم التالي باسم «Payment gateway settlement».
        طابق عدد العمليات والمبلغ مع «Credit Transaction count» و«Original Amount» في الكشف.
        الصافي تقديري لبطاقات مدى (0.6% + ضريبة 15%) — قد يختلف عن الإيداع ببضع هللات بسبب التقريب.
      </p>

      {days.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center">لا توجد عمليات مدفوعة عبر البنك</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-100">
                <th className="text-right font-semibold py-2 px-2">يوم العمليات</th>
                <th className="text-right font-semibold py-2 px-2">العدد</th>
                <th className="text-right font-semibold py-2 px-2">المبلغ</th>
                <th className="text-right font-semibold py-2 px-2">رسوم + ضريبة</th>
                <th className="text-right font-semibold py-2 px-2">الصافي المتوقع</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const open = openDay === d.key;
                return (
                  <Fragment key={d.key}>
                    <tr
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setOpenDay(open ? null : d.key)}
                    >
                      <td className="py-2 px-2 font-semibold text-gray-800 whitespace-nowrap">
                        {dayLabel(d.key)}
                        {d.maybeIncomplete && (
                          <span className="block text-[11px] font-normal text-amber-600">قد يكون ناقصاً — خارج آخر العمليات المحمّلة</span>
                        )}
                      </td>
                      <td className="py-2 px-2">{d.count}</td>
                      <td className="py-2 px-2 font-semibold">{sar(d.gross)}</td>
                      <td className="py-2 px-2 text-gray-500">
                        {sar(d.fee)} + {sar(d.vat)}
                        {d.nonMadaCount > 0 && (
                          <span className="block text-[11px] text-amber-600">
                            {d.nonMadaCount} بغير مدى — رسومها مختلفة
                          </span>
                        )}
                        {d.unknownCardCount > 0 && (
                          <span className="block text-[11px] text-gray-400">
                            {d.unknownCardCount} بدون نوع بطاقة — حُسبت مدى
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 font-black text-teal-700">{sar(d.net)}</td>
                      <td className="py-2 px-2 text-gray-400">
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-3 py-2">
                          <div className="space-y-1">
                            {d.items.map((r) => (
                              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-gray-700">
                                <span className="font-semibold">{r.providerName || r.providerPhone || '—'}</span>
                                <span>{sar(Number(r.amount) || 0)} ر.س</span>
                                <span dir="ltr" className="font-mono">RRN {r.ref || '—'}</span>
                                <span className="text-gray-400">{r.cardType || 'مدى'}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

