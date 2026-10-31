/**
 * جدول على الشاشات الواسعة، وبطاقات (عنوان: قيمة) على الجوال — لا تمرير أفقي للصفحة.
 * columns: [{ header, render(row) }]
 */
export const ResponsiveTable = ({ columns, rows, rowKey, empty }) => {
  if (rows.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-500 font-semibold">{empty}</div>;
  }
  return (
    <>
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              {columns.map((c) => <th key={c.header} className="text-right font-semibold py-3 px-3 whitespace-nowrap">{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-gray-50 align-top">
                {columns.map((c) => <td key={c.header} className="py-3 px-3 text-gray-800">{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={rowKey(row)} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            {columns.map((c) => (
              <div key={c.header} className="flex items-start justify-between gap-3 text-sm min-w-0">
                <span className="text-xs text-gray-500 flex-shrink-0">{c.header}</span>
                <span className="text-gray-800 text-left min-w-0 break-words">{c.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
