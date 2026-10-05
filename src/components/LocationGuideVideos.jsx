import React, { useEffect, useState } from 'react';
import { Apple, Smartphone, Upload, Trash2, Loader2, Video } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';

/**
 * فيديو شرح تفعيل الموقع لتطبيق المزود — فيديو لكل نظام.
 * يُحفظ في settings/locationGuide { iosVideoUrl, androidVideoUrl } ويظهر داخل نافذة «اسمح بالموقع».
 */
const PLATFORMS = [
  { key: 'ios', label: 'آيفون (iOS)', icon: Apple, hint: 'خطوات: أثناء الاستخدام ← التغيير إلى السماح دائماً' },
  { key: 'android', label: 'أندرويد', icon: Smartphone, hint: 'خطوات: تشغيل الموقع ← أثناء استخدام التطبيق' },
];

const MAX_MB = 80;
const SETTINGS_REF = () => doc(db, 'settings', 'locationGuide');

export default function LocationGuideVideos() {
  const [urls, setUrls] = useState({ ios: '', android: '' });
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({}); // { ios: 0..100 }

  useEffect(() => {
    getDoc(SETTINGS_REF())
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        setUrls({ ios: d.iosVideoUrl || '', android: d.androidVideoUrl || '' });
      })
      .catch((e) => console.error('locationGuide load:', e))
      .finally(() => setLoading(false));
  }, []);

  const saveUrl = async (platform, url) => {
    await setDoc(
      SETTINGS_REF(),
      { [`${platform}VideoUrl`]: url, lastUpdated: new Date().toISOString() },
      { merge: true }
    );
    setUrls((u) => ({ ...u, [platform]: url }));
  };

  const handleFile = (platform) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('اختر ملف فيديو (MP4 أو MOV)');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`حجم الفيديو أكبر من ${MAX_MB} ميجابايت — اضغطه قبل الرفع`);
      return;
    }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const task = uploadBytesResumable(
      ref(storage, `location_guide/${platform}_${Date.now()}.${ext}`),
      file,
      { contentType: file.type }
    );
    setProgress((p) => ({ ...p, [platform]: 0 }));
    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setProgress((p) => ({ ...p, [platform]: pct }));
      },
      (err) => {
        console.error('upload video:', err);
        alert('فشل رفع الفيديو');
        setProgress((p) => ({ ...p, [platform]: undefined }));
      },
      async () => {
        try {
          await saveUrl(platform, await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          console.error('save video url:', err);
          alert('تم الرفع لكن فشل الحفظ — حاول مرة ثانية');
        } finally {
          setProgress((p) => ({ ...p, [platform]: undefined }));
        }
      }
    );
  };

  const handleRemove = async (platform) => {
    if (!window.confirm('حذف الفيديو؟ لن يظهر زر «شاهد الشرح» للمزودين على هذا النظام.')) return;
    try {
      await saveUrl(platform, '');
    } catch (err) {
      console.error(err);
      alert('فشل الحذف');
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="font-bold text-gray-900">فيديو شرح تفعيل الموقع</h2>
        <p className="text-sm text-gray-500 mt-1">
          يظهر للمزود زر «شاهد الشرح» داخل نافذة «اسمح بالموقع» ويفتح الفيديو بكامل الشاشة — حسب نوع جواله.
          الحفظ تلقائي بعد الرفع.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map(({ key, label, icon: Icon, hint }) => {
          const url = urls[key];
          const pct = progress[key];
          const uploading = pct !== undefined;
          return (
            <div key={key} className="border border-gray-100 rounded-2xl p-4 bg-gray-50 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-800">{label}</span>
                {url ? (
                  <span className="mr-auto text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    مفعّل
                  </span>
                ) : (
                  <span className="mr-auto text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    لا يوجد فيديو
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{hint}</p>

              {url ? (
                <video src={url} controls preload="metadata" className="w-full max-h-72 rounded-xl bg-black" />
              ) : (
                <div className="h-40 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
                  <Video className="w-7 h-7" />
                  <span className="text-xs">ارفع فيديو عمودي (MP4) حتى {MAX_MB}MB</span>
                </div>
              )}

              {uploading ? (
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">جاري الرفع… {pct}%</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 text-gray-950 rounded-xl font-bold text-sm cursor-pointer hover:bg-amber-500">
                    <Upload className="w-4 h-4" />
                    {url ? 'استبدال الفيديو' : 'رفع فيديو'}
                    <input type="file" accept="video/*" className="hidden" onChange={handleFile(key)} />
                  </label>
                  {url ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(key)}
                      className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
