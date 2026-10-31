import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { groupRequestsByArea } from '../utils/noCoverage';

const VISIBLE_ROWS = 10;

const MODES = [
  { id: 'orders', label: 'الأكثر طلبات', sortValue: (a) => a.total },
  { id: 'no_coverage', label: 'الأكثر بلا تغطية', sortValue: (a) => a.noCoverage },
];

/** ترتيب المدن ضمن فترة الصفحة — الضغط على مدينة يفعّل فلترها */
export const CityRanking = ({ requests, cities, selectedCityId, onSelectCity }) => {
  const [open, setOpen] = useState(false);
  const [modeId, setModeId] = useState('orders');
  const mode = MODES.find((m) => m.id === modeId);

  const rows = useMemo(() => {
    if (!open) return [];
    return groupRequestsByArea(requests, cities)
      .filter((area) => mode.sortValue(area) > 0)
      .sort((a, b) => mode.sortValue(b) - mode.sortValue(a))
      .slice(0, VISIBLE_ROWS);
  }, [open, requests, cities, mode]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center justify-between text-right">
        <span className="flex items-center gap-2 text-sm font-black text-gray-800">
          <BarChart3 className="w-4 h-4 text-teal-600" /> ترتيب المدن
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModeId(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${m.id === modeId ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-right font-semibold py-2 px-2">المدينة</th>
                  <th className="text-right font-semibold py-2 px-2">كل الطلبات</th>
                  <th className="text-right font-semibold py-2 px-2" title="لم يُشعَر أي مزود: لا يوجد مزودون في النطاق">بلا تغطية</th>
                  <th className="text-right font-semibold py-2 px-2" title="وصل لمزودين ولم يقبله أحد">لم يقبل أحد</th>
                  <th className="text-right font-semibold py-2 px-2">نسبة بلا تغطية</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((area) => (
                  <tr key={area.key} className={`border-b border-gray-50 ${area.cityId && area.cityId === selectedCityId ? 'bg-teal-50' : ''}`}>
                    <td className="py-2 px-2 font-bold text-gray-800">
                      {area.isCity && area.cityId ? (
                        <button type="button" onClick={() => onSelectCity(area.cityId)} className="text-teal-700 hover:underline text-right">{area.label}</button>
                      ) : area.label}
                    </td>
                    <td className="py-2 px-2 font-semibold text-gray-700">{area.total}</td>
                    <td className="py-2 px-2 font-black text-red-600">{area.noCoverage}</td>
                    <td className="py-2 px-2 font-semibold text-amber-700">{area.notAccepted}</td>
                    <td className="py-2 px-2 text-gray-600">{Math.round((area.noCoverage / area.total) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="text-sm text-gray-400 py-3">لا توجد طلبات في هذه الفترة.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
