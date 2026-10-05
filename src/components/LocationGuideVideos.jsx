import React, { useEffect, useState } from 'react';
import {
  Apple, Smartphone, Upload, Trash2, Loader2, Video, Image as Images, ChevronUp, ChevronDown, ImagePlus,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';

/**
 * شرح تفعيل الموقع لتطبيق المزود — لكل نظام: فيديو أو مجموعة صور مرتبة (خطوات).
 * settings/locationGuide:
 *   { iosType: 'video'|'images', iosVideoUrl, iosImages: [{ url, caption }], …android }
 * يظهر للمزود زر «شاهد الشرح» داخل نافذة «اسمح بالموقع» حسب نوع جواله.
 */
const PLATFORMS = [
  { key: 'ios', label: 'آيفون (iOS)', icon: Apple, hint: 'أثناء الاستخدام ← التغيير إلى السماح دائماً' },
  { key: 'android', label: 'أندرويد', icon: Smartphone, hint: 'تشغيل الموقع ← أثناء استخدام التطبيق' },
];

const MAX_VIDEO_MB = 80;
const MAX_IMAGE_MB = 8;
const MAX_IMAGES = 10;
const SETTINGS_REF = () => doc(db, 'settings', 'locationGuide');

const emptyGuide = () => ({ type: 'video', videoUrl: '', images: [] });

const readGuide = (d, key) => {
  const videoUrl = d[`${key}VideoUrl`] || '';
  const images = Array.isArray(d[`${key}Images`]) ? d[`${key}Images`].filter((i) => i?.url) : [];
  const type = d[`${key}Type`] || (videoUrl ? 'video' : images.length ? 'images' : 'video');
  return { type, videoUrl, images };
};

const uploadFile = (path, file, onProgress) =>
  new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });

export default function LocationGuideVideos() {
  const [guides, setGuides] = useState({ ios: emptyGuide(), android: emptyGuide() });
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({}); // { ios: 0..100 }

  useEffect(() => {
    getDoc(SETTINGS_REF())
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        setGuides({ ios: readGuide(d, 'ios'), android: readGuide(d, 'android') });
      })
      .catch((e) => console.error('locationGuide load:', e))
      .finally(() => setLoading(false));
  }, []);

  /** يحدّث الحالة ويحفظ حقول النظام المعني فوراً */
  const saveGuide = async (platform, patch) => {
    const next = { ...guides[platform], ...patch };
    setGuides((g) => ({ ...g, [platform]: next }));
    await setDoc(
      SETTINGS_REF(),
      {
        [`${platform}Type`]: next.type,
        [`${platform}VideoUrl`]: next.videoUrl,
        [`${platform}Images`]: next.images,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const safeSave = (platform, patch) =>
    saveGuide(platform, patch).catch((err) => {
      console.error('locationGuide save:', err);
      alert('فشل الحفظ — حاول مرة ثانية');
    });

  const setBusy = (platform, pct) => setProgress((p) => ({ ...p, [platform]: pct }));

  // ---------- فيديو ----------
  const handleVideo = (platform) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) return alert('اختر ملف فيديو (MP4 أو MOV)');
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return alert(`حجم الفيديو أكبر من ${MAX_VIDEO_MB} ميجابايت — اضغطه قبل الرفع`);
    }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    setBusy(platform, 0);
    try {
      const url = await uploadFile(`location_guide/${platform}_${Date.now()}.${ext}`, file, (pct) =>
        setBusy(platform, pct)
      );
      await saveGuide(platform, { videoUrl: url, type: 'video' });
    } catch (err) {
      console.error('upload video:', err);
      alert('فشل رفع الفيديو');
    } finally {
      setBusy(platform, undefined);
    }
  };

  // ---------- صور ----------
  const handleImages = (platform) => async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const current = guides[platform].images;
    const room = MAX_IMAGES - current.length;
    if (room <= 0) return alert(`الحد الأقصى ${MAX_IMAGES} صور`);
    const accepted = files
      .filter((f) => f.type.startsWith('image/') && f.size <= MAX_IMAGE_MB * 1024 * 1024)
      .slice(0, room);
    if (accepted.length < files.length) {
      alert(`تم تجاهل بعض الملفات (ليست صوراً، أكبر من ${MAX_IMAGE_MB}MB، أو تجاوزت ${MAX_IMAGES} صور)`);
    }
    if (!accepted.length) return;

    setBusy(platform, 0);
    try {
      const uploaded = [];
      for (let i = 0; i < accepted.length; i += 1) {
        const f = accepted[i];
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const url = await uploadFile(
          `location_guide/${platform}_img_${Date.now()}_${i}.${ext}`,
          f,
          (pct) => setBusy(platform, Math.round(((i + pct / 100) / accepted.length) * 100))
        );
        uploaded.push({ url, caption: '' });
      }
      await saveGuide(platform, { images: [...current, ...uploaded], type: 'images' });
    } catch (err) {
      console.error('upload images:', err);
      alert('فشل رفع الصور');
    } finally {
      setBusy(platform, undefined);
    }
  };

  const moveImage = (platform, index, delta) => {
    const images = [...guides[platform].images];
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    [images[index], images[target]] = [images[target], images[index]];
    safeSave(platform, { images });
  };

  const removeImage = (platform, index) => {
    if (!window.confirm('حذف هذه الصورة من الشرح؟')) return;
    safeSave(platform, { images: guides[platform].images.filter((_, i) => i !== index) });
  };

  const editCaption = (platform, index, caption) =>
    setGuides((g) => ({
      ...g,
      [platform]: {
        ...g[platform],
        images: g[platform].images.map((img, i) => (i === index ? { ...img, caption } : img)),
      },
    }));

  const removeVideo = (platform) => {
    if (!window.confirm('حذف الفيديو؟')) return;
    safeSave(platform, { videoUrl: '' });
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
        <h2 className="font-bold text-gray-900">شرح تفعيل الموقع (فيديو أو صور)</h2>
        <p className="text-sm text-gray-500 mt-1">
          اختر لكل نظام: فيديو، أو صور مرتبة كخطوات. يظهر للمزود زر «شاهد الشرح» داخل نافذة «اسمح بالموقع»
          ويفتح بكامل الشاشة حسب نوع جواله. الحفظ تلقائي.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLATFORMS.map(({ key, label, icon: Icon, hint }) => {
          const guide = guides[key];
          const pct = progress[key];
          const uploading = pct !== undefined;
          const active =
            guide.type === 'images' ? guide.images.length > 0 : Boolean(guide.videoUrl);

          return (
            <div key={key} className="border border-gray-100 rounded-2xl p-4 bg-gray-50 space-y-3">
              {/* رأس البطاقة */}
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-800">{label}</span>
                <span
                  className={`mr-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                    active ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 bg-gray-100'
                  }`}
                >
                  {active ? (guide.type === 'images' ? `مفعّل — ${guide.images.length} صور` : 'مفعّل — فيديو') : 'غير مفعّل'}
                </span>
              </div>
              <p className="text-xs text-gray-400">الخطوات: {hint}</p>

              {/* نوع الشرح */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-gray-100">
                {[
                  { id: 'video', text: 'فيديو', icon: Video },
                  { id: 'images', text: 'صور', icon: Images },
                ].map(({ id, text, icon: TIcon }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={uploading}
                    onClick={() => guide.type !== id && safeSave(key, { type: id })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                      guide.type === id ? 'bg-amber-400 text-gray-950' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <TIcon className="w-4 h-4" />
                    {text}
                  </button>
                ))}
              </div>

              {/* المحتوى */}
              {guide.type === 'video' ? (
                guide.videoUrl ? (
                  <video src={guide.videoUrl} controls preload="metadata" className="w-full max-h-72 rounded-xl bg-black" />
                ) : (
                  <div className="h-40 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
                    <Video className="w-7 h-7" />
                    <span className="text-xs">ارفع فيديو عمودي (MP4) حتى {MAX_VIDEO_MB}MB</span>
                  </div>
                )
              ) : guide.images.length ? (
                <ol className="space-y-2">
                  {guide.images.map((img, index) => (
                    <li key={img.url} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-2">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <img src={img.url} alt="" className="w-12 h-20 object-cover rounded-lg bg-gray-100 shrink-0" />
                      <input
                        type="text"
                        dir="rtl"
                        value={img.caption || ''}
                        placeholder="وصف الخطوة (اختياري) — مثال: اختر «الموقع»"
                        onChange={(e) => editCaption(key, index, e.target.value)}
                        onBlur={() => safeSave(key, { images: guides[key].images })}
                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-amber-400 outline-none"
                      />
                      <div className="flex flex-col">
                        <button
                          type="button"
                          title="للأعلى"
                          disabled={index === 0}
                          onClick={() => moveImage(key, index, -1)}
                          className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="للأسفل"
                          disabled={index === guide.images.length - 1}
                          onClick={() => moveImage(key, index, 1)}
                          className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        title="حذف"
                        onClick={() => removeImage(key, index)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="h-40 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
                  <Images className="w-7 h-7" />
                  <span className="text-xs">ارفع لقطات الشاشة بالترتيب (حتى {MAX_IMAGES} صور)</span>
                </div>
              )}

              {/* الأزرار */}
              {uploading ? (
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">جاري الرفع… {pct}%</p>
                </div>
              ) : guide.type === 'video' ? (
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 text-gray-950 rounded-xl font-bold text-sm cursor-pointer hover:bg-amber-500">
                    <Upload className="w-4 h-4" />
                    {guide.videoUrl ? 'استبدال الفيديو' : 'رفع فيديو'}
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideo(key)} />
                  </label>
                  {guide.videoUrl ? (
                    <button
                      type="button"
                      onClick={() => removeVideo(key)}
                      className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <label
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm ${
                    guide.images.length >= MAX_IMAGES
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-400 text-gray-950 cursor-pointer hover:bg-amber-500'
                  }`}
                >
                  <ImagePlus className="w-4 h-4" />
                  {guide.images.length ? 'إضافة صور' : 'رفع الصور'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={guide.images.length >= MAX_IMAGES}
                    onChange={handleImages(key)}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
