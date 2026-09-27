/**
 * تنبيهات لوحة التحكم — نغمات مميزة مولّدة عبر Web Audio (بدون ملفات خارجية)
 * + تحديد إن كان التصعيد من مدينة مستهدفة.
 */

let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// المتصفح يمنع الصوت قبل أول تفاعل — نفعّل السياق عند أول نقرة/ضغطة
if (typeof window !== 'undefined') {
  const unlock = () => {
    getCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** [تردد Hz، بداية بالثواني، مدة بالثواني] */
const TONES = {
  // تصعيد مدينة مستهدفة: إنذار متناوب عالي ×3
  escalation_priority: {
    wave: 'square',
    gain: 0.18,
    notes: [
      [988, 0, 0.18], [740, 0.2, 0.18], [988, 0.4, 0.18], [740, 0.6, 0.18],
      [988, 0.8, 0.18], [740, 1.0, 0.18],
    ],
  },
  // تذكرة دعم: رنّة صاعدة ثنائية
  ticket: {
    wave: 'sine',
    gain: 0.35,
    notes: [[660, 0, 0.16], [880, 0.18, 0.28], [660, 0.6, 0.16], [880, 0.78, 0.28]],
  },
  // شكوى: ثلاث نغمات هابطة
  complaint: {
    wave: 'triangle',
    gain: 0.4,
    notes: [[1047, 0, 0.14], [784, 0.16, 0.14], [523, 0.32, 0.3]],
  },
};

export function playAlertTone(kind) {
  const def = TONES[kind];
  const ctx = getCtx();
  if (!def || !ctx) return;
  const t0 = ctx.currentTime + 0.02;
  def.notes.forEach(([freq, start, dur]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = def.wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0 + start);
    g.gain.exponentialRampToValueAtTime(def.gain, t0 + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.05);
  });
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * المدينة المستهدفة التي يقع فيها التصعيد (أو null).
 * التصعيد لا يحمل حقل مدينة — نطابق بالإحداثيات ضمن نطاق خدمة المدينة، ثم باسمها في العنوان.
 */
export function findPriorityCityForEscalation(escalation, priorityCities) {
  if (!escalation || !priorityCities?.length) return null;
  const c = escalation.coordinates || {};
  const lat = Number(c.latitude ?? c.lat);
  const lng = Number(c.longitude ?? c.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const location = String(escalation.location || '');

  for (const city of priorityCities) {
    const cLat = Number(city.coordinates?.lat);
    const cLng = Number(city.coordinates?.lng);
    if (hasCoords && Number.isFinite(cLat) && Number.isFinite(cLng)) {
      const radius = Number(city.serviceRadius) || 50;
      if (distanceKm(lat, lng, cLat, cLng) <= radius) return city;
    }
    if (city.name && location.includes(city.name)) return city;
    if (city.nameEn && location.toLowerCase().includes(String(city.nameEn).toLowerCase())) return city;
  }
  return null;
}
