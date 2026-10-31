import { format } from 'date-fns';

/**
 * تصدير جدول إلى Excel أو CSV.
 * columns: [{ header, value(row) }] — القيمة نص أو رقم أو Date أو null.
 */
const DATE_TEXT_FORMAT = 'yyyy-MM-dd HH:mm';
const MIN_COLUMN_WIDTH = 12;
const MAX_COLUMN_WIDTH = 42;

const dateStamp = () => format(new Date(), 'yyyy-MM-dd');

const toCellText = (value) => {
  if (value == null) return '';
  return value instanceof Date ? format(value, DATE_TEXT_FORMAT) : String(value);
};

/** اسم يبدأ بـ = أو + ينفّذه Excel كمعادلة عند فتح CSV — البادئة ' تبقيه نصاً */
const guardFormula = (text) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

export const buildCsv = (columns, rows) => {
  const toCsvCell = (value) => {
    const text = typeof value === 'number' ? String(value) : guardFormula(toCellText(value));
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = columns.map((c) => toCsvCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => toCsvCell(c.value(row))).join(','));
  return `﻿${[header, ...lines].join('\r\n')}`; // BOM حتى يقرأ Excel العربية
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const columnWidth = (column, rows) => {
  const longest = rows.slice(0, 200).reduce(
    (max, row) => Math.max(max, toCellText(column.value(row)).length),
    column.header.length,
  );
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, longest + 2));
};

export const buildExcelSheet = (columns, rows) => {
  const toExcelCell = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date) return { value: format(value, DATE_TEXT_FORMAT), type: String };
    return typeof value === 'number' ? { value, type: Number } : { value: String(value), type: String };
  };
  return [
    columns.map((c) => ({ value: c.header, type: String, fontWeight: 'bold', backgroundColor: '#E6F4F1' })),
    ...rows.map((row) => columns.map((c) => toExcelCell(c.value(row)))),
  ];
};

export const exportTable = async ({ baseName, columns, rows, fileFormat }) => {
  const fileName = `${baseName}-${dateStamp()}`;
  if (fileFormat === 'csv') {
    downloadBlob(new Blob([buildCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`);
    return;
  }
  // تحميل عند الطلب — المكتبة لا تدخل في الحزمة الأساسية للوحة
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(buildExcelSheet(columns, rows), {
    columns: columns.map((c) => ({ width: columnWidth(c, rows) })),
    rightToLeft: true,
    stickyRowsCount: 1,
  }).toFile(`${fileName}.xlsx`);
};

/** رقم الجوال بمسافات: يبقى نصاً في Excel بدل صيغة 9.66E+11 */
export const formatPhoneForExport = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const match = digits.match(/^(?:00)?966(\d{2})(\d{3})(\d{4})$/) || digits.match(/^0?(5\d)(\d{3})(\d{4})$/);
  return match ? `966 ${match[1]} ${match[2]} ${match[3]}` : String(phone || '');
};
