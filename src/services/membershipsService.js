import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from './firebase';

const call = async (name, payload) => (await httpsCallable(functions, name)(payload)).data;

const listAll = async (collectionName) => {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getMembershipPlan = async () => (await call('getMembershipPlan', {})).plan;
export const saveMembershipPlan = (plan) => setDoc(doc(db, 'package_plans', 'default'), {
  name: plan.name,
  priceSar: Number(plan.priceSar),
  taxPercent: Number(plan.taxPercent) || 0,
  validityDays: Number(plan.validityDays),
  activationHours: Number(plan.activationHours),
  services: plan.services,
  laborOnlyNotice: plan.laborOnlyNotice,
  active: true,
  updatedAt: serverTimestamp(),
}, { merge: true });

export const listMemberships = () => listAll('memberships');
export const listPartners = () => listAll('partners');
export const listMembershipPayments = () => listAll('membership_payments');
export const listPartnerLedger = async (partnerId) => {
  const snap = await getDocs(query(collection(db, 'partner_ledger'), where('partnerId', '==', partnerId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createPartner = (partner) => addDoc(collection(db, 'partners'), {
  ...partner, status: 'active', balanceDue: 0, createdAt: serverTimestamp(),
});
export const setPartnerStatus = (partnerId, status) => updateDoc(doc(db, 'partners', partnerId), { status });

export const registerPartnerVehicles = (payload) => call('adminRegisterPartnerVehicles', payload);
export const confirmPartnerPayment = (paymentRecordId) => call('adminConfirmPartnerPayment', { paymentRecordId });
export const recordPartnerPayment = (payload) => call('adminRecordPartnerPayment', payload);
export const authorizeRenter = (payload) => call('adminAuthorizeRenter', payload);

export const listProviderEarnings = () => listAll('provider_earnings');
export const listProviderSettlements = () => listAll('provider_settlements');
export const reviewEarning = (payload) => call('adminReviewEarning', payload);
export const reverseSettlement = (payload) => call('adminReverseSettlement', payload);

export const createSettlement = async ({ proofFile, ...payload }) => {
  const proofRef = ref(storage, `settlement_proofs/${payload.providerId}/${Date.now()}_${proofFile.name}`);
  await uploadBytes(proofRef, proofFile);
  return call('adminCreateSettlement', { ...payload, proofUrl: await getDownloadURL(proofRef) });
};

/** دفعات بانتظار التفعيل — للتنبيه الفوري في القائمة */
export const listenToWaitingMembershipPayments = (onChange) => onSnapshot(
  query(collection(db, 'membership_payments'), where('activationState', '==', 'waiting_24h')),
  onChange,
  (e) => console.error('membership payments listener:', e),
);

