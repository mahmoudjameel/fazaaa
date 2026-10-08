import CITIES from '../services/cities.json';

// مدن/صيغ قديمة سُجّل بها مزودون وليست في cities.json
const EXTRA_SLUGS = {
  'al-khobar': 'الخبر',
  'al-kharj': 'الخرج',
  'al-ahsa': 'الأحساء',
  'al-jouf': 'الجوف',
  qassim: 'القصيم',
  unaizah: 'عنيزة',
  diriyah: 'الدرعية',
  'abu-arish': 'أبو عريش',
};

// توحيد للمقارنة: حروف صغيرة، أ/إ/آ→ا، ة→ه، ى→ي، بلا مسافات زائدة
const norm = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');

const LOOKUP = new Map();
CITIES.forEach((c) => {
  [c.id, c.name, c.nameEn].forEach((k) => k && LOOKUP.set(norm(k), c.name));
});
Object.entries(EXTRA_SLUGS).forEach(([slug, name]) => {
  LOOKUP.set(norm(slug), name);
  LOOKUP.set(norm(name), name);
});

// الأسماء العربية للبحث داخل نص حر ("الرياض النرجس" → الرياض)، الأطول أولاً
const ARABIC_NAMES = [...new Set(LOOKUP.values())].sort((a, b) => b.length - a.length);

/** اسم مدينة عربي موحّد من أي صيغة (slug إنجليزي، عربي، نص حر). */
export const canonicalCityName = (value) => {
  const key = norm(value);
  if (!key) return '';
  if (LOOKUP.has(key)) return LOOKUP.get(key);
  const contained = ARABIC_NAMES.find((name) => key.includes(norm(name)));
  return contained || String(value).trim();
};

/** مدينة المزود موحّدة — تجرّب cityName ثم city ثم cityId. */
export const providerCityName = (p) => {
  const fields = [p?.cityName, p?.city, p?.cityId].filter((v) => String(v || '').trim());
  for (const f of fields) {
    const key = norm(f);
    if (LOOKUP.has(key)) return LOOKUP.get(key);
  }
  return fields.length ? canonicalCityName(fields[0]) : 'غير محدد';
};
