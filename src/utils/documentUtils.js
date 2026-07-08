/**
 * توحيد قراءة مستندات المزود — متوافق مع تطبيق المزود وإضافة الأدمن اليدوية
 */

export function getDocumentUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && trimmed !== 'undefined' ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = getDocumentUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === 'object') {
    return getDocumentUrl(value.url || value.uri);
  }
  return null;
}

export function hasDocumentValue(value) {
  return !!getDocumentUrl(value);
}

export function isCarPhotosVerified(docs = {}) {
  if (hasDocumentValue(docs.carPhotos)) {
    if (Array.isArray(docs.carPhotos)) {
      return docs.carPhotos.filter(hasDocumentValue).length >= 2;
    }
    return true;
  }
  const front = docs.carPhotoFront ?? docs.car_front;
  const side = docs.carPhotoSide ?? docs.car_side;
  return hasDocumentValue(front) && hasDocumentValue(side);
}

const FIELD_ALIASES = {
  idImage: ['idImage', 'id_photo', 'idPhoto'],
  equipmentPhoto: ['equipmentPhoto', 'equipment_photo'],
  licensePhoto: ['licensePhoto', 'driver_license'],
  registrationPhoto: ['registrationPhoto', 'car_registration'],
};

export function isProfileDocumentVerified(docs, fieldKey) {
  if (!docs) return false;
  if (fieldKey === 'carPhotos') return isCarPhotosVerified(docs);
  const aliases = FIELD_ALIASES[fieldKey] || [fieldKey];
  return aliases.some((key) => hasDocumentValue(docs[key]));
}

export const PROFILE_DOCUMENT_FIELDS = [
  { key: 'idImage', label: 'الهوية / الإقامة' },
  { key: 'equipmentPhoto', label: 'صورة العدة' },
];

export function resolveProfileDocuments(docs = {}) {
  return PROFILE_DOCUMENT_FIELDS.map((field) => ({
    ...field,
    status: isProfileDocumentVerified(docs, field.key) ? 'verified' : 'missing',
  }));
}

/** تسميات عربية لكل مفتاح محتمل في Firestore */
export const DOCUMENT_KEY_LABELS = {
  idImage: 'الهوية / الإقامة',
  id_photo: 'الهوية / الإقامة',
  idPhoto: 'الهوية / الإقامة',
  equipmentPhoto: 'صورة العدة',
  equipment_photo: 'صورة العدة',
  carPhotoFront: 'السيارة - أمام',
  car_front: 'السيارة - أمام',
  carPhotoSide: 'السيارة - جانبي',
  car_side: 'السيارة - جانبي',
  carPhotos: 'صور السيارة',
  licensePhoto: 'رخصة القيادة',
  driver_license: 'رخصة القيادة',
  registrationPhoto: 'استمارة السيارة',
  car_registration: 'استمارة السيارة',
};

export function getDocumentLabel(key) {
  return DOCUMENT_KEY_LABELS[key] || key;
}

/**
 * تطبيع مستندات الإدخال اليدوي إلى مفاتيح تطبيق المزود
 */
export function normalizeDocumentsForStorage(rawDocs = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (hasDocumentValue(rawDocs[k])) return rawDocs[k];
    }
    return null;
  };

  const toStored = (value) => {
    if (!value) return null;
    const url = getDocumentUrl(value);
    if (!url) return null;
    if (typeof value === 'object' && value.url) return value;
    return { url, type: (typeof value === 'object' && value.type) || 'image' };
  };

  const normalized = {};
  const id = toStored(pick('idImage', 'id_photo', 'idPhoto'));
  const equipment = toStored(pick('equipmentPhoto', 'equipment_photo'));
  const carFront = toStored(pick('carPhotoFront', 'car_front'));
  const carSide = toStored(pick('carPhotoSide', 'car_side'));
  const license = toStored(pick('licensePhoto', 'driver_license'));
  const registration = toStored(pick('registrationPhoto', 'car_registration'));

  if (id) normalized.idImage = id;
  if (equipment) normalized.equipmentPhoto = equipment;
  if (carFront) normalized.carPhotoFront = carFront;
  if (carSide) normalized.carPhotoSide = carSide;
  if (license) normalized.licensePhoto = license;
  if (registration) normalized.registrationPhoto = registration;

  return normalized;
}

/** قائمة مسطحة لعرض الشبكة في لوحة التحكم */
export function listDocumentsForDisplay(docs = {}) {
  const items = [];
  const seen = new Set();

  const push = (key, value) => {
    const url = getDocumentUrl(value);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const type = (typeof value === 'object' && value?.type) || 'image';
    items.push({ key, url, type, label: getDocumentLabel(key) });
  };

  Object.entries(docs || {}).forEach(([key, value]) => {
    if (key === 'carPhotos' && Array.isArray(value)) {
      value.forEach((v, i) => push(`carPhotos_${i}`, v));
    } else {
      push(key, value);
    }
  });

  return items;
}
