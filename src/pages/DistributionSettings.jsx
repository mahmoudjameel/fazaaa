import { useEffect, useState } from 'react';
import { Settings, MapPin, Clock, DollarSign, Users, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const DistributionSettings = () => {
  const [settings, setSettings] = useState({
    vipEnabled: true,
    cumulativeEnabled: true,
    searchStages: [
      { id: 1, type: 'vip', minRadius: 0, maxRadius: 6, waitTime: 20 },
      { id: 2, type: 'all', minRadius: 0, maxRadius: 4, waitTime: 20 },
      { id: 3, type: 'all', minRadius: 4, maxRadius: 7, waitTime: 20 },
      { id: 4, type: 'all', minRadius: 7, maxRadius: 10, waitTime: 20 },
      { id: 5, type: 'all', minRadius: 10, maxRadius: 13, waitTime: 20 },
      { id: 6, type: 'all', minRadius: 13, maxRadius: 16, waitTime: 20 },
      { id: 7, type: 'all', minRadius: 16, maxRadius: 19, waitTime: 20 }
    ]
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'distribution');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setSettings({
          vipEnabled: data.vipEnabled ?? true,
          cumulativeEnabled: data.cumulativeEnabled ?? true,
          searchStages: data.searchStages || []
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
      const settingsRef = doc(db, 'settings', 'distribution');
      await setDoc(settingsRef, {
        vipEnabled: settings.vipEnabled,
        cumulativeEnabled: settings.cumulativeEnabled,
        searchStages: settings.searchStages,
        updatedAt: new Date().toISOString()
      });
      
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('هل أنت متأكد من إعادة تعيين الإعدادات إلى القيم الافتراضية؟')) {
      const defaultSettings = {
        vipEnabled: true,
        cumulativeEnabled: true,
        searchStages: [
          { id: 1, type: 'vip', minRadius: 0, maxRadius: 6, waitTime: 20 },
          { id: 2, type: 'all', minRadius: 0, maxRadius: 4, waitTime: 20 },
          { id: 3, type: 'all', minRadius: 4, maxRadius: 7, waitTime: 20 },
          { id: 4, type: 'all', minRadius: 7, maxRadius: 10, waitTime: 20 },
          { id: 5, type: 'all', minRadius: 10, maxRadius: 13, waitTime: 20 },
          { id: 6, type: 'all', minRadius: 13, maxRadius: 16, waitTime: 20 },
          { id: 7, type: 'all', minRadius: 16, maxRadius: 19, waitTime: 20 }
        ]
      };
      
      setSettings(defaultSettings);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إعدادات توزيع وتوسيع الطلبات</h1>
          <p className="text-gray-600">إدارة حلقات البحث الجغرافي (Zoning) وتوقيت ظهور الإشعارات.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
          >
            <RotateCcw size={20} />
            إعادة تعيين الافتراضي
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* VIP Status Toggle Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${settings.vipEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">نظام أولوية VIP</h3>
                <p className="text-sm text-gray-500">تفعيل مراحل خاصة لمزودي الـ VIP.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.vipEnabled}
                  onChange={(e) => setSettings({...settings, vipEnabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${settings.cumulativeEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">توزيع تراكمي (Strict Zoning)</h3>
                <p className="text-sm text-gray-500">استمرار تنبيه المزودين في المراحل السابقة دفعة واحدة.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.cumulativeEnabled}
                  onChange={(e) => setSettings({...settings, cumulativeEnabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg mb-6 p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">توزيع الطلب حسب الحلقات (Strict Zoning)</h3>
              <p className="text-sm text-gray-500">سيتم البحث في كل حلقة بشكل منفصل وبالترتيب الزمني المكتوب.</p>
            </div>
            <button
              onClick={() => {
                const newId = settings.searchStages.length > 0
                  ? Math.max(...settings.searchStages.map(s => s.id)) + 1
                  : 1;
                setSettings(prev => ({
                  ...prev,
                  searchStages: [...prev.searchStages, { id: newId, type: 'all', minRadius: 0, maxRadius: 20, waitTime: 20 }]
                }));
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-bold transition-all"
            >
              + إضافة حلقة جديدة
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-sm font-bold text-gray-700">المرحلة</th>
                  <th className="p-4 text-sm font-bold text-gray-700">نوع المزود</th>
                  <th className="p-4 text-sm font-bold text-gray-700">من (كم)</th>
                  <th className="p-4 text-sm font-bold text-gray-700">إلى (كم)</th>
                  <th className="p-4 text-sm font-bold text-gray-700">الانتظار (ثانية)</th>
                  <th className="p-4 text-sm font-bold text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {settings.searchStages?.map((stage, index) => (
                  <tr key={stage.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-600">{index + 1}</td>
                    <td className="p-4">
                      <select
                        value={stage.type}
                        disabled={!settings.vipEnabled && stage.type !== 'all'}
                        onChange={(e) => {
                          const newStages = [...settings.searchStages];
                          newStages[index].type = e.target.value;
                          setSettings({ ...settings, searchStages: newStages });
                        }}
                        className={`bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-green-500 ${!settings.vipEnabled && stage.type !== 'all' ? 'opacity-50' : ''}`}
                      >
                        <option value="all">الكل (VIP + عام)</option>
                        <option value="vip">VIP فقط</option>
                        <option value="general">عام فقط</option>
                      </select>
                      {!settings.vipEnabled && stage.type !== 'all' && (
                        <p className="text-[10px] text-amber-600 mt-1 italic">سيتم تجاهل الفلتر لأن VIP معطل</p>
                      )}
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={stage.minRadius}
                        onChange={(e) => {
                          const newStages = [...settings.searchStages];
                          newStages[index].minRadius = parseInt(e.target.value) || 0;
                          setSettings({ ...settings, searchStages: newStages });
                        }}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={stage.maxRadius}
                        onChange={(e) => {
                          const newStages = [...settings.searchStages];
                          newStages[index].maxRadius = parseInt(e.target.value) || 0;
                          setSettings({ ...settings, searchStages: newStages });
                        }}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={stage.waitTime}
                        onChange={(e) => {
                          const newStages = [...settings.searchStages];
                          newStages[index].waitTime = parseInt(e.target.value) || 0;
                          setSettings({ ...settings, searchStages: newStages });
                        }}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                      />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          const newStages = settings.searchStages.filter(s => s.id !== stage.id);
                          setSettings({ ...settings, searchStages: newStages });
                        }}
                        className="text-red-500 hover:text-red-700 text-sm font-bold"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                {(!settings.searchStages || settings.searchStages.length === 0) && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400 italic">
                      لا توجد حلقات بحث معرفة. سيتم إغلاق الطلبات فوراً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-800 mb-2">تنبيه هام</h3>
            <p className="text-yellow-700 text-sm">
              التغييرات هنا تنعكس فوراً على جميع الطلبات الجديدة. يرجى التأكد من أن الحلقات تغطي مساحات جغرافية منطقية لضمان وصول الخدمة للعملاء.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
