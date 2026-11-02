import { useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { exportTable } from '../utils/exportTable';
import { registerPartnerVehicles, validatePartnerVehicles } from '../services/membershipsService';

const FLEET_COLUMNS = [
  { key: 'plate', header: 'اللوحة' },
  { key: 'make', header: 'النوع' },
  { key: 'model', header: 'الموديل' },
  { key: 'color', header: 'اللون' },
  { key: 'vin', header: 'رقم الهيكل (اختياري)' },
  { key: 'ownerName', header: 'اسم المالك' },
  { key: 'ownerPhone', header: 'جوال المالك' },
];

const downloadTemplate = () => exportTable({
  baseName: 'fazaeen-fleet-template',
  columns: FLEET_COLUMNS.map((c) => ({ header: c.header, value: (row) => row[c.key] })),
  rows: [{ plate: '1234 ABJ', make: 'تويوتا', model: 'كامري 2023', color: 'أبيض' }],
});

/** أعمدة الملف بعنوانها لا بترتيبها، والأرقام تصل من Excel كقيم عددية */
const readFleetFile = async (file) => {
  const { readSheet } = await import('read-excel-file/browser');
  const [headerRow = [], ...dataRows] = await readSheet(file);
  const headers = headerRow.map((cell) => String(cell ?? '').trim());
  const columnIndexes = FLEET_COLUMNS.map((c) => [c.key, headers.indexOf(c.header)]);
  if (columnIndexes.some(([key, index]) => key === 'plate' && index < 0)) {
    throw new Error('لم يُعثر على عمود «اللوحة». استخدم القالب.');
  }
  return dataRows
    .map((row, rowIndex) => ({ row, sheetLine: rowIndex + 2 }))
    .filter(({ row }) => row.some((cell) => cell != null && cell !== ''))
    .map(({ row, sheetLine }) => ({
      sheetLine,
      ...Object.fromEntries(columnIndexes.map(([key, index]) => [key, index < 0 ? '' : String(row[index] ?? '').trim()])),
    }));
};

/** رفع أسطول كامل: فحص كل سطر أولاً، ثم اعتماد السليم فقط */
export const PartnerFleetUpload = ({ partner, plan, termsAccepted, reload }) => {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runStep = async (step) => {
    setBusy(true);
    setError('');
    try {
      await step();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'تعذر تنفيذ العملية');
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPreview(null);
    runStep(async () => {
      const vehicles = await readFleetFile(file);
      const { rows } = await validatePartnerVehicles({ partnerId: partner.id, vehicles });
      setPreview({ vehicles, rows });
    });
  };

  const invalidRows = preview?.rows.filter((row) => row.errors.length > 0) ?? [];
  const validVehicles = preview?.vehicles.filter((_, index) => preview.rows[index].errors.length === 0) ?? [];

  const approve = () => runStep(async () => {
    await registerPartnerVehicles({ partnerId: partner.id, planId: plan?.id, vehicles: validVehicles, termsAccepted });
    setPreview(null);
    await reload?.();
  });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-gray-800">رفع ملف أسطول</h3>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          اختيار ملف Excel
          <input type="file" accept=".xlsx" disabled={busy} onChange={onFileChosen} className="sr-only" />
        </label>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700">
          <Download className="w-4 h-4" /> تنزيل القالب
        </button>
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {preview && (
        <div className="space-y-2 bg-gray-50 rounded-xl p-3">
          <p className="text-sm font-bold text-gray-800">
            {preview.rows.length} سطر: {validVehicles.length} سليم، {invalidRows.length} فيه أخطاء
          </p>
          {invalidRows.length > 0 && (
            <ul className="max-h-56 overflow-auto space-y-1 text-sm text-red-700">
              {invalidRows.map((row) => (
                <li key={row.line}>سطر {row.line} · {row.plate || 'بلا لوحة'}: {row.errors.join('، ')}</li>
              ))}
            </ul>
          )}
          {!termsAccepted && <p className="text-xs text-gray-600">أكد موافقة الجهة على الشروط أعلاه قبل الاعتماد.</p>}
          <button
            type="button"
            disabled={busy || !plan || !termsAccepted || validVehicles.length === 0}
            onClick={approve}
            className="px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50"
          >
            اعتماد {validVehicles.length} سيارة ({validVehicles.length * (plan?.totalSar ?? 0)} ر.س)
          </button>
        </div>
      )}
    </div>
  );
};
