import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

const WITHDRAWAL_REQUESTS_COLLECTION = 'withdrawalRequests';
const PROVIDERS_COLLECTION = 'providers';

/**
 * Get all withdrawal requests (Admin)
 * @param {string} statusFilter - Filter by status ('all', 'pending', 'approved', 'rejected')
 * @returns {Promise<Array>} Array of withdrawal requests
 */
export const getAllWithdrawalRequests = async (statusFilter = 'all') => {
    try {
        let q;
        if (statusFilter === 'all') {
            q = query(collection(db, WITHDRAWAL_REQUESTS_COLLECTION));
        } else {
            q = query(
                collection(db, WITHDRAWAL_REQUESTS_COLLECTION),
                where('status', '==', statusFilter)
            );
        }

        const querySnapshot = await getDocs(q);
        const requests = [];

        querySnapshot.forEach((doc) => {
            requests.push({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
                processedAt: doc.data().processedAt?.toDate?.() || null,
            });
        });

        // Sort by creation date (newest first)
        requests.sort((a, b) => b.createdAt - a.createdAt);

        return requests;
    } catch (error) {
        console.error('❌ Error getting all withdrawal requests:', error);
        return [];
    }
};

/**
 * Approve withdrawal request and update provider balance
 * @param {string} requestId - Request ID
 * @param {string} adminId - Admin ID
 * @param {string} adminNotes - Admin notes
 * @returns {Promise<void>}
 */
export const approveWithdrawalRequest = async (requestId, adminId, adminNotes = '') => {
    try {
        await runTransaction(db, async (transaction) => {
            // Get the withdrawal request
            const requestRef = doc(db, WITHDRAWAL_REQUESTS_COLLECTION, requestId);
            const requestDoc = await transaction.get(requestRef);

            if (!requestDoc.exists()) {
                throw new Error('Withdrawal request not found');
            }

            const requestData = requestDoc.data();

            if (requestData.status !== 'pending') {
                throw new Error('Request already processed');
            }

            // Get provider data
            const providerRef = doc(db, PROVIDERS_COLLECTION, requestData.providerId);
            const providerDoc = await transaction.get(providerRef);

            if (!providerDoc.exists()) {
                throw new Error('Provider not found');
            }

            const providerData = providerDoc.data();
            const currentBalance = providerData.walletBalance || 0;

            if (currentBalance < requestData.amount) {
                throw new Error('Insufficient balance');
            }

            const newBalance = currentBalance - requestData.amount;

            // Update provider balance
            transaction.update(providerRef, {
                walletBalance: newBalance,
                updatedAt: serverTimestamp(),
            });

            // Update request status
            transaction.update(requestRef, {
                status: 'approved',
                processedBy: adminId,
                processedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                adminNotes,
            });

            // Add transaction record
            const transactionsRef = collection(db, PROVIDERS_COLLECTION, requestData.providerId, 'transactions');
            transaction.set(doc(transactionsRef), {
                type: 'withdrawal',
                amount: requestData.amount,
                status: 'approved',
                note: `سحب رصيد - ${adminNotes || 'تمت الموافقة'}`,
                timestamp: serverTimestamp(),
                createdAt: new Date().toISOString(),
                requestId,
            });
        });

        console.log('✅ Withdrawal request approved');
    } catch (error) {
        console.error('❌ Error approving withdrawal:', error);
        throw error;
    }
};

/**
 * Reject withdrawal request
 * @param {string} requestId - Request ID
 * @param {string} adminId - Admin ID
 * @param {string} adminNotes - Reason for rejection
 * @returns {Promise<void>}
 */
export const rejectWithdrawalRequest = async (requestId, adminId, adminNotes) => {
    try {
        const requestRef = doc(db, WITHDRAWAL_REQUESTS_COLLECTION, requestId);

        await updateDoc(requestRef, {
            status: 'rejected',
            processedBy: adminId,
            processedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            adminNotes,
        });

        console.log('✅ Withdrawal request rejected');
    } catch (error) {
        console.error('❌ Error rejecting withdrawal:', error);
        throw error;
    }
};
