import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';

/** حدود حجم الملفات المرفوعة */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 16 * 1024 * 1024;
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const DOCS_COL = 'provider_documents';
const CAMPAIGNS_COL = 'whatsapp_campaigns';

export const listenToProviderDocuments = (callback) =>
  onSnapshot(
    query(collection(db, DOCS_COL), orderBy('createdAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('listenToProviderDocuments:', err);
      callback([]);
    }
  );

export const uploadProviderDocument = async (file, title) => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('الملف يجب أن يكون PDF أو صورة (JPG/PNG)');
  }
  const kind = file.type === 'application/pdf' ? 'document' : 'image';
  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
  if (file.size > maxBytes) {
    throw new Error(kind === 'image' ? 'حجم الصورة أكبر من 5MB' : 'حجم الملف أكبر من 16MB');
  }
  const safeName = file.name.replace(/[^\w.\-؀-ۿ]+/g, '_');
  const storagePath = `${DOCS_COL}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  const docRef = await addDoc(collection(db, DOCS_COL), {
    title: String(title || file.name).trim(),
    fileName: file.name,
    contentType: file.type,
    kind,
    size: file.size,
    url,
    storagePath,
    uploadedBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const deleteProviderDocument = async (docItem) => {
  if (docItem.storagePath) {
    await deleteObject(ref(storage, docItem.storagePath)).catch(() => {});
  }
  await deleteDoc(doc(db, DOCS_COL, docItem.id));
};

export const listenToWhatsAppCampaigns = (callback, max = 20) =>
  onSnapshot(
    query(collection(db, CAMPAIGNS_COL), orderBy('createdAt', 'desc'), limit(max)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('listenToWhatsAppCampaigns:', err);
      callback([]);
    }
  );

/** حملة يدوية (رابط + wa.me) — تتبع من أُرسل له حتى يمكن الإكمال لاحقاً من أي جهاز */
export const createManualCampaign = async ({ documentId, documentTitle, message, providerIds }) => {
  const docRef = await addDoc(collection(db, CAMPAIGNS_COL), {
    mode: 'manual',
    documentId,
    documentTitle,
    message,
    providerIds,
    sent: 0,
    failed: 0,
    results: {},
    sentBy: auth.currentUser?.uid || null,
    sentByEmail: auth.currentUser?.email || null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const markManualCampaignResult = async (campaignId, providerId, status, prevStatus) => {
  const update = {
    [`results.${providerId}`]: { status, at: Date.now() },
    updatedAt: serverTimestamp(),
  };
  if (status === 'sent' && prevStatus !== 'sent') update.sent = increment(1);
  await updateDoc(doc(db, CAMPAIGNS_COL, campaignId), update);
};
