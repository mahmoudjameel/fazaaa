import { useEffect, useState } from 'react';
import { Settings, MapPin, Clock, DollarSign, Users, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const DistributionSettings = () => {
  const [settings, setSettings] = useState({
    autoAssignment: {
      enabled: true,
      maxDistance: 50,
      maxProvidersPerOrder: 3,
      priorityRadius: 10,
      responseTimeout: 300
    },
    pricing: {
      baseFee: 10,
      commissionRate: 0.15,
      vipCommissionRate: 0.10,
      emergencyFee: 25,
      nightFee: 15,
      minimumOrderAmount: 50
    },
    serviceAreas: {
      defaultRadius: 50,
      vipRadius: 100,
      emergencyRadius: 200,
      expansionEnabled: false
    },
    notifications: {
      smsEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      adminNotifications: true
    },
    workingHours: {
      start: "06:00",
      end: "23:00",
      weekendEnabled: true,
      emergency24h: true
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('assignment');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'distribution');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
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
      await updateDoc(settingsRef, {
        ...settings,
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
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      const defaultSettings = {
        autoAssignment: {
          enabled: true,
          maxDistance: 50,
          maxProvidersPerOrder: 3,
          priorityRadius: 10,
          responseTimeout: 300
        },
        pricing: {
          baseFee: 10,
          commissionRate: 0.15,
          vipCommissionRate: 0.10,
          emergencyFee: 25,
          nightFee: 15,
          minimumOrderAmount: 50
        },
        serviceAreas: {
          defaultRadius: 50,
          vipRadius: 100,
          emergencyRadius: 200,
          expansionEnabled: false
        },
        notifications: {
          smsEnabled: true,
          emailEnabled: true,
          pushEnabled: true,
          adminNotifications: true
        },
        workingHours: {
          start: "06:00",
          end: "23:00",
          weekendEnabled: true,
          emergency24h: true
        }
      };
      
      setSettings(defaultSettings);
    }
  };

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'assignment', label: 'التوزيع التلقائي', icon: Users },
    { id: 'pricing', label: 'الأسعار والعمولات', icon: DollarSign },
    { id: 'areas', label: 'مناطق الخدمة', icon: MapPin },
    { id: 'notifications', label: 'الإشعارات', icon: Settings },
    { id: 'hours', label: 'ساعات العمل', icon: Clock }
  ];

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إعدادات التوزيع</h1>
          <p className="text-gray-600">إدارة إعدادات توزيع الطلبات والخدمات</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
          >
            <RotateCcw size={20} />
            إعادة تعيين
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg mb-6">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex flex-nowrap space-x-4 md:space-x-8 px-4 md:px-6 min-w-max" dir="ltr">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 md:gap-2 py-4 px-2 md:px-1 border-b-2 font-medium text-xs md:text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={14} className="md:w-4 md:h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Auto Assignment Settings */}
          {activeTab === 'assignment' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">إعدادات التوزيع التلقائي</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">تفعيل التوزيع التلقائي</label>
                      <p className="text-sm text-gray-500 mt-1">توزيع الطلبات تلقائياً على المزودين المتاحين</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoAssignment.enabled}
                      onChange={(e) => updateSetting('autoAssignment', 'enabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الحد الأقصى للمسافة (كم)</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={settings.autoAssignment.maxDistance}
                        onChange={(e) => updateSetting('autoAssignment', 'maxDistance', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الحد الأقصى للمزودين لكل طلب</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.autoAssignment.maxProvidersPerOrder}
                        onChange={(e) => updateSetting('autoAssignment', 'maxProvidersPerOrder', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">نطاق الأولوية (كم)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.autoAssignment.priorityRadius}
                        onChange={(e) => updateSetting('autoAssignment', 'priorityRadius', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">مهلة الاستجابة (ثانية)</label>
                      <input
                        type="number"
                        min="60"
                        max="1800"
                        value={settings.autoAssignment.responseTimeout}
                        onChange={(e) => updateSetting('autoAssignment', 'responseTimeout', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Settings */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">إعدادات الأسعار والعمولات</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الرسوم الأساسية (ر.س)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.pricing.baseFee}
                      onChange={(e) => updateSetting('pricing', 'baseFee', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">نسبة العمولة (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.pricing.commissionRate}
                      onChange={(e) => updateSetting('pricing', 'commissionRate', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">عمولة VIP (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.pricing.vipCommissionRate}
                      onChange={(e) => updateSetting('pricing', 'vipCommissionRate', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">رسوم الطوارئ (ر.س)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.pricing.emergencyFee}
                      onChange={(e) => updateSetting('pricing', 'emergencyFee', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">رسوم الليل (ر.س)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.pricing.nightFee}
                      onChange={(e) => updateSetting('pricing', 'nightFee', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الحد الأدنى للطلب (ر.س)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.pricing.minimumOrderAmount}
                      onChange={(e) => updateSetting('pricing', 'minimumOrderAmount', parseFloat(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Service Areas Settings */}
          {activeTab === 'areas' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">إعدادات مناطق الخدمة</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">نطاق الخدمة الافتراضي (كم)</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={settings.serviceAreas.defaultRadius}
                        onChange={(e) => updateSetting('serviceAreas', 'defaultRadius', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">نطاق خدمة VIP (كم)</label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={settings.serviceAreas.vipRadius}
                        onChange={(e) => updateSetting('serviceAreas', 'vipRadius', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">نطاق الطوارئ (كم)</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={settings.serviceAreas.emergencyRadius}
                        onChange={(e) => updateSetting('serviceAreas', 'emergencyRadius', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">توسيع مناطق الخدمة تلقائياً</label>
                      <p className="text-sm text-gray-500 mt-1">توسيع نطاق الخدمة عند عدم وجود مزودين</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.serviceAreas.expansionEnabled}
                      onChange={(e) => updateSetting('serviceAreas', 'expansionEnabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">إعدادات الإشعارات</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">إشعارات الرسائل النصية</label>
                      <p className="text-sm text-gray-500 mt-1">إرسال إشعارات عبر الرسائل النصية</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.smsEnabled}
                      onChange={(e) => updateSetting('notifications', 'smsEnabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">إشعارات البريد الإلكتروني</label>
                      <p className="text-sm text-gray-500 mt-1">إرسال إشعارات عبر البريد الإلكتروني</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailEnabled}
                      onChange={(e) => updateSetting('notifications', 'emailEnabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">إشعارات الدفع</label>
                      <p className="text-sm text-gray-500 mt-1">إرسال إشعارات فورية للتطبيق</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.pushEnabled}
                      onChange={(e) => updateSetting('notifications', 'pushEnabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">إشعارات المدير</label>
                      <p className="text-sm text-gray-500 mt-1">إرسال إشعارات مهمة للمديرين</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.adminNotifications}
                      onChange={(e) => updateSetting('notifications', 'adminNotifications', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Working Hours Settings */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">إعدادات ساعات العمل</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">وقت بدء العمل</label>
                      <input
                        type="time"
                        value={settings.workingHours.start}
                        onChange={(e) => updateSetting('workingHours', 'start', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">وقت انتهاء العمل</label>
                      <input
                        type="time"
                        value={settings.workingHours.end}
                        onChange={(e) => updateSetting('workingHours', 'end', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">العمل في عطلة نهاية الأسبوع</label>
                      <p className="text-sm text-gray-500 mt-1">توفير الخدمة خلال عطلة نهاية الأسبوع</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.workingHours.weekendEnabled}
                      onChange={(e) => updateSetting('workingHours', 'weekendEnabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="font-semibold text-gray-700">خدمة الطوارئ 24/7</label>
                      <p className="text-sm text-gray-500 mt-1">توفير خدمة الطوارئ على مدار الساعة</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.workingHours.emergency24h}
                      onChange={(e) => updateSetting('workingHours', 'emergency24h', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning Card */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-800 mb-2">تنبيه هام</h3>
            <p className="text-yellow-700 text-sm">
              قد تؤثر تغييرات الإعدادات على أداء النظام وتجربة المستخدمين. يرجى مراجعة جميع التغييرات بعناية قبل حفظها.
              بعض الإعدادات قد تحتاج إلى إعادة تشغيل النظام لتطبيقها.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
