import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportTable } from '../utils/exportTable';

const FORMATS = [
  { id: 'xlsx', label: 'Excel' },
  { id: 'csv', label: 'CSV' },
];

/** يصدّر الصفوف الظاهرة بعد الفلاتر */
export const ExportButtons = ({ baseName, columns, rows, className = '' }) => {
  const [exporting, setExporting] = useState(null);
  const [failed, setFailed] = useState(false);

  const handleExport = async (fileFormat) => {
    setExporting(fileFormat);
    setFailed(false);
    try {
      await exportTable({ baseName, columns: columns(), rows, fileFormat });
    } catch (e) {
      console.error('Export failed:', e);
      setFailed(true);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {failed && <span className="text-xs font-bold text-red-600">تعذر التصدير</span>}
      {FORMATS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleExport(id)}
          disabled={rows.length === 0 || exporting !== null}
          title={`تصدير ${rows.length} صف`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:border-teal-300 disabled:opacity-40"
        >
          {exporting === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {label}
        </button>
      ))}
    </div>
  );
};
