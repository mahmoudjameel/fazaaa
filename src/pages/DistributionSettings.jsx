import { useEffect, useState } from 'react';
import { Settings, MapPin, Clock, DollarSign, Users, Save, RotateCcw, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const DEFAULT_STAGES = [
  { id: 1, type: 'vip', minRadius: 0, maxRadius: 6, waitTime: 20 },
  { id: 2, type: 'all', minRadius: 0, maxRadius: 4, waitTime: 20 },
  { id: 3, type: 'all', minRadius: 4, maxRadius: 7, waitTime: 20 },
  { id: 4, type: 'all', minRadius: 7, maxRadius: 10, waitTime: 20 },
  { id: 5, type: 'all', minRadius: 10, maxRadius: 13, waitTime: 20 },
  { id: 6, type: 'all', minRadius: 13, maxRadius: 16, waitTime: 20 },
  { id: 7, type: 'all', minRadius: 16, maxRadius: 19, waitTime: 20 },
];

export const DistributionSettings = () => {
  const [settings, setSettings] = useState({
    vipEnabled: true,
    cumulativeEnabled: true,
    searchStages: DEFAULT_STAGES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'distribution'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setSettings({
          vipEnabled: data.vipEnabled ?? true,
          cumulativeEnabled: data.cumulativeEnabled ?? true,
          searchStages: data.searchStages || [],
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'distribution'), {
        ...settings,
        updatedAt: new Date().toISOString(),
      });
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين الإعدادات إلى القيم الافتراضية؟')) {
      setSettings({ vipEnabled: true, cumulativeEnabled: true, searchStages: DEFAULT_STAGES });
    }
  };

  const updateStage = (index, field, value) => {
    const newStages = [...settings.searchStages];
    newStages[index][field] = value;
    setSettings({ ...settings, searchStages: newStages });
  };

  const addStage = () => {
    const newId = settings.searchStages.length > 0
      ? Math.max(...settings.searchStages.map((s) => s.id)) + 1
      : 1;
    setSettings((prev) => ({
      ...prev,
      searchStages: [...prev.searchStages, { id: newId, type: 'all', minRadius: 0, maxRadius: 20, waitTime: 20 }],
    }));
  };

  const removeStage = (id) => {
    setSettings((prev) => ({
      ...prev,
      searchStages: prev.searchStages.filter((s) => s.id !== id),
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent" />
        <p className="text-sm text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  const Toggle = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400" />
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات توزيع الطلبات</h1>
          <p className="text-gray-500 mt-1 text-sm">إدارة حلقات البحث الجغرافي وتوقيت ظهور الإشعارات</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold text-sm shadow-sm"
          >
            <RotateCcw size={16} />
            إعادة الافتراضي
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 text-gray-950 rounded-xl hover:bg-amber-500 transition-all font-bold text-sm shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* Toggle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-r-4 border-r-amber-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${settings.vipEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">نظام أولوية VIP</h3>
                <p className="text-xs text-gray-500 mt-0.5">تفعيل مراحل خاصة لمزودي VIP</p>
              </div>
            </div>
            <Toggle
              checked={settings.vipEnabled}
              onChange={(e) => setSettings({ ...settings, vipEnabled: e.target.checked })}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-r-4 border-r-blue-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${settings.cumulativeEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">توزيع تراكمي</h3>
                <p className="text-xs text-gray-500 mt-0.5">استمرار تنبيه المزودين في المراحل السابقة</p>
              </div>
            </div>
            <Toggle
              checked={settings.cumulativeEnabled}
              onChange={(e) => setSettings({ ...settings, cumulativeEnabled: e.target.checked })}
            />
          </div>
        </div>
      </div>

      {/* Stages Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">حلقات البحث الجغرافي</h3>
            <p className="text-xs text-gray-500 mt-0.5">يتم البحث في كل حلقة بالترتيب</p>
          </div>
          <button
            onClick={addStage}
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-gray-950 rounded-xl text-sm font-bold hover:bg-amber-500 transition-all"
          >
            <Plus size={16} />
            إضافة حلقة
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">المرحلة</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">نوع المزود</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">من (كم)</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">إلى (كم)</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">انتظار (ث)</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {settings.searchStages?.map((stage, index) => (
                <tr key={stage.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">{index + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={stage.type}
                      disabled={!settings.vipEnabled && stage.type !== 'all'}
                      onChange={(e) => updateStage(index, 'type', e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400 disabled:opacity-50"
                    >
                      <option value="all">الكل (VIP + عام)</option>
                      <option value="vip">VIP فقط</option>
                      <option value="general">عام فقط</option>
                    </select>
                    {!settings.vipEnabled && stage.type !== 'all' && (
                      <p className="text-[10px] text-amber-600 mt-1">سيتم تجاهل الفلتر (VIP معطل)</p>
                    )}
                  </td>
                  {['minRadius', 'maxRadius', 'waitTime'].map((field) => (
                    <td key={field} className="px-4 py-3">
                      <input
                        type="number"
                        value={stage[field]}
                        onChange={(e) => updateStage(index, field, parseInt(e.target.value) || 0)}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-amber-400"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeStage(stage.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {(!settings.searchStages || settings.searchStages.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm italic">
                    لا توجد حلقات. سيتم إغلاق الطلبات فوراً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={18} />
          <div>
            <h3 className="font-semibold text-amber-800 text-sm mb-1">تنبيه هام</h3>
            <p className="text-amber-700 text-sm leading-relaxed">
              التغييرات هنا تنعكس فوراً على جميع الطلبات الجديدة. يرجى التأكد من أن الحلقات تغطي مساحات جغرافية منطقية.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributionSettings;
